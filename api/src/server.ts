import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { prisma } from './prisma.js';
import { Prisma } from '@prisma/client';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { PublicKey } from '@solana/web3.js';

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: process.env.ALLOW_ORIGIN?.split(',') ?? '*',
    methods: ['GET', 'POST'],
  })
);

type RequestWithId = express.Request & { requestId?: string };

const requestIdMiddleware: express.RequestHandler = (req, res, next) => {
  const requestId = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
  (req as RequestWithId).requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
};

morgan.token('id', (req) => (req as RequestWithId).requestId ?? '');

app.use(requestIdMiddleware);
app.use(morgan(':method :url :status :response-time ms - :res[content-length] :id'));

const port = process.env.PORT ? Number(process.env.PORT) : 4000;

function isValidSolanaAddress(address: string) {
  try {
    return new PublicKey(address).toBase58() === address;
  } catch (err) {
    return false;
  }
}

const solanaAddressSchema = z
  .string()
  .min(32)
  .max(44)
  .refine(isValidSolanaAddress, 'Invalid Solana address');

const profileSchema = z.object({
  alias: z.string().min(2).max(50),
  receiveAddress: solanaAddressSchema,
  defaultChain: z.string().min(2).max(30),
  avatarUrl: z.string().url().optional(),
  description: z.string().max(160).optional(),
});

const amountSchema = z
  .union([z.number(), z.string()])
  .refine((value) => {
    const num = typeof value === 'string' ? Number(value) : value;
    return Number.isFinite(num) && num > 0;
  }, 'Amount must be a positive number');

const invoiceSchema = z.object({
  amount: amountSchema,
  tokenSymbol: z.string().regex(/^[A-Za-z0-9]{2,10}$/),
  tokenAddress: solanaAddressSchema.optional(),
  tokenDecimals: z.number().int().min(0).max(30).optional(),
  chain: z.string().min(2).max(30).optional(),
  description: z.string().max(280).optional(),
  slug: z.string().regex(/^[a-z0-9-]{3,}$/).optional(),
  expiresAt: z.string().datetime().optional(),
});

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

async function ensureDefaultProfile() {
  const alias = process.env.DEFAULT_PROFILE_ALIAS ?? 'Demo Alias';
  const receiveAddress =
    process.env.DEFAULT_RECEIVE_ADDRESS ?? 'H3UuEhEDuJeayQM2ngiZX6hgqPdh9vywgqbiZ9erjRzG';
  const defaultChain = process.env.DEFAULT_CHAIN ?? 'solana';
  const existing = await prisma.profile.findFirst({ where: { alias } });
  if (!existing) {
    await prisma.profile.create({ data: { alias, receiveAddress, defaultChain } });
    console.log(`Seeded default profile for alias ${alias}`);
  }
}

function sendError(res: express.Response, status: number, message: string, details?: unknown) {
  return res.status(status).json({ error: { message, details } });
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/profiles', async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'Invalid profile payload', parsed.error.flatten());
  }
  try {
    const profile = await prisma.profile.create({ data: parsed.data });
    res.status(201).json(profile);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: { message: 'Failed to create profile' } });
  }
});

app.get('/profiles/:id', async (req, res) => {
  const profile = await prisma.profile.findUnique({ where: { id: req.params.id } });
  if (!profile) return sendError(res, 404, 'Profile not found');
  res.json(profile);
});

app.get('/profiles', async (_req, res) => {
  const profiles = await prisma.profile.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(profiles);
});

app.post('/profiles/:id/invoices', async (req, res) => {
  const parsed = invoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'Invalid invoice payload', parsed.error.flatten());
  }
  const profile = await prisma.profile.findUnique({ where: { id: req.params.id } });
  if (!profile) return sendError(res, 404, 'Profile not found');

  const amountInput = parsed.data.amount;
  const amount = typeof amountInput === 'string' ? new Prisma.Decimal(amountInput) : new Prisma.Decimal(amountInput);
  const slug = parsed.data.slug ?? `${slugify(profile.alias)}-${nanoid(6)}`;
  const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined;

  try {
    const invoice = await prisma.invoice.create({
      data: {
        profileId: profile.id,
        amount,
        tokenSymbol: parsed.data.tokenSymbol,
        tokenAddress: parsed.data.tokenAddress,
        tokenDecimals: parsed.data.tokenDecimals,
        chain: parsed.data.chain ?? profile.defaultChain,
        receiveAddress: profile.receiveAddress,
        description: parsed.data.description,
        slug,
        expiresAt,
      },
    });
    res.status(201).json(invoice);
  } catch (err) {
    console.error(err);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return sendError(res, 409, 'Slug already exists. Provide a unique slug.');
    }
    res.status(500).json({ error: { message: 'Failed to create invoice' } });
  }
});

app.get('/profiles/:id/invoices', async (req, res) => {
  const invoices = await prisma.invoice.findMany({
    where: { profileId: req.params.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json(invoices);
});

app.get('/invoices/:id', async (req, res) => {
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!invoice) return sendError(res, 404, 'Invoice not found');
  res.json(invoice);
});

app.get('/invoices/:id/status', async (req, res) => {
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!invoice) return sendError(res, 404, 'Invoice not found');
  res.json({ status: invoice.status });
});

app.get('/invoices/slug/:slug', async (req, res) => {
  const invoice = await prisma.invoice.findUnique({ where: { slug: req.params.slug }, include: { profile: true } });
  if (!invoice) return sendError(res, 404, 'Invoice not found');
  res.json({
    id: invoice.id,
    slug: invoice.slug,
    amount: invoice.amount,
    tokenSymbol: invoice.tokenSymbol,
    tokenAddress: invoice.tokenAddress,
    tokenDecimals: invoice.tokenDecimals,
    chain: invoice.chain,
    receiveAddress: invoice.receiveAddress,
    description: invoice.description,
    expiresAt: invoice.expiresAt,
    status: invoice.status,
    profileAlias: invoice.profile.alias,
    createdAt: invoice.createdAt,
  });
});

app.get('/invoices/slug/:slug/status', async (req, res) => {
  const invoice = await prisma.invoice.findUnique({ where: { slug: req.params.slug } });
  if (!invoice) return sendError(res, 404, 'Invoice not found');
  res.json({ status: invoice.status });
});

async function main() {
  await ensureDefaultProfile();
  app.listen(port, () => {
    console.log(`API server listening on http://localhost:${port}`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { app, ensureDefaultProfile };
