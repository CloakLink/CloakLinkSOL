import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { prisma } from './prisma.js';
import { Prisma } from '@prisma/client';
import { nanoid } from 'nanoid';
import { z } from 'zod';

const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.ALLOW_ORIGIN?.split(',') ?? '*' }));
app.use(morgan('dev'));

const port = process.env.PORT ? Number(process.env.PORT) : 4000;

const profileSchema = z.object({
  alias: z.string().min(2),
  receiveAddress: z.string().min(4),
  defaultChain: z.string().min(2),
});

const invoiceSchema = z.object({
  amount: z.union([z.number().positive(), z.string().regex(/^\d+(\.\d+)?$/)]),
  tokenSymbol: z.string().min(1),
  chain: z.string().min(2).optional(),
  description: z.string().optional(),
  slug: z.string().min(3).optional(),
});

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

async function ensureDefaultProfile() {
  const alias = process.env.DEFAULT_PROFILE_ALIAS ?? 'Demo Alias';
  const receiveAddress = process.env.DEFAULT_RECEIVE_ADDRESS ?? '0x0000000000000000000000000000000000000000';
  const defaultChain = process.env.DEFAULT_CHAIN ?? 'ethereum';
  const existing = await prisma.profile.findFirst({ where: { alias } });
  if (!existing) {
    await prisma.profile.create({ data: { alias, receiveAddress, defaultChain } });
    console.log(`Seeded default profile for alias ${alias}`);
  }
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/profiles', async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  try {
    const profile = await prisma.profile.create({ data: parsed.data });
    res.status(201).json(profile);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create profile' });
  }
});

app.get('/profiles/:id', async (req, res) => {
  const profile = await prisma.profile.findUnique({ where: { id: req.params.id } });
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  res.json(profile);
});

app.get('/profiles', async (_req, res) => {
  const profiles = await prisma.profile.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(profiles);
});

app.post('/profiles/:id/invoices', async (req, res) => {
  const parsed = invoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const profile = await prisma.profile.findUnique({ where: { id: req.params.id } });
  if (!profile) return res.status(404).json({ error: 'Profile not found' });

  const amountInput = parsed.data.amount;
  const amount = typeof amountInput === 'string' ? new Prisma.Decimal(amountInput) : new Prisma.Decimal(amountInput);
  const slug = parsed.data.slug ?? `${slugify(profile.alias)}-${nanoid(6)}`;

  try {
    const invoice = await prisma.invoice.create({
      data: {
        profileId: profile.id,
        amount,
        tokenSymbol: parsed.data.tokenSymbol,
        chain: parsed.data.chain ?? profile.defaultChain,
        receiveAddress: profile.receiveAddress,
        description: parsed.data.description,
        slug,
      },
    });
    res.status(201).json(invoice);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create invoice' });
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
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  res.json(invoice);
});

app.get('/invoices/:id/status', async (req, res) => {
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  res.json({ status: invoice.status });
});

app.get('/invoices/slug/:slug', async (req, res) => {
  const invoice = await prisma.invoice.findUnique({ where: { slug: req.params.slug }, include: { profile: true } });
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  res.json({
    id: invoice.id,
    slug: invoice.slug,
    amount: invoice.amount,
    tokenSymbol: invoice.tokenSymbol,
    chain: invoice.chain,
    receiveAddress: invoice.receiveAddress,
    description: invoice.description,
    status: invoice.status,
    profileAlias: invoice.profile.alias,
    createdAt: invoice.createdAt,
  });
});

app.get('/invoices/slug/:slug/status', async (req, res) => {
  const invoice = await prisma.invoice.findUnique({ where: { slug: req.params.slug } });
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  res.json({ status: invoice.status });
});

async function main() {
  await ensureDefaultProfile();
  app.listen(port, () => {
    console.log(`API server listening on http://localhost:${port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
