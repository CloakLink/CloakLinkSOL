import 'dotenv/config';
import http from 'node:http';
import type { Signals } from 'node:process';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { stdSerializers, type Logger } from 'pino';
import pinoHttp from 'pino-http';
import { prisma } from './prisma.js';
import { Prisma } from '@prisma/client';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { PublicKey } from '@solana/web3.js';
import { logger } from './logger.js';
import { metricsMiddleware, registry } from './metrics.js';
import { config } from './config.js';

const app = express();
app.use(express.json());
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin: config.allowOrigin?.split(',') ?? '*',
    methods: ['GET', 'POST'],
  })
);

app.use(
  pinoHttp({
    logger,
    genReqId: (req, res) => {
      const existingId = req.headers['x-request-id'] as string | undefined;
      const requestId = existingId ?? randomUUID();
      res.setHeader('x-request-id', requestId);
      return requestId;
    },
    customLogLevel: (res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    serializers: {
      err: stdSerializers.err,
    },
  })
);
app.use((req, res, next) => {
  const reqWithLogger = req as RequestWithLogger;
  const requestId = reqWithLogger.id ?? (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
  reqWithLogger.id = requestId;
  res.setHeader('x-request-id', requestId);
  if (reqWithLogger.log) {
    reqWithLogger.log = reqWithLogger.log.child({ requestId });
  }
  next();
});
app.use(metricsMiddleware);

const port = config.port;

type RequestWithLogger = express.Request & { log?: Logger; id?: string };

function getRequestLogger(req: express.Request): Logger {
  const reqWithLogger = req as RequestWithLogger;
  if (reqWithLogger.log) return reqWithLogger.log;
  if (reqWithLogger.id) return logger.child({ requestId: reqWithLogger.id });
  return logger;
}

let server: http.Server | null = null;
let shuttingDown = false;

function isValidSolanaAddress(address: string) {
  try {
    return new PublicKey(address).toBase58() === address;
  } catch {
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
  const alias = config.defaultProfileAlias;
  const receiveAddress = config.defaultReceiveAddress;
  const defaultChain = config.defaultChain;
  const existing = await prisma.profile.findFirst({ where: { alias } });
  if (!existing) {
    await prisma.profile.create({ data: { alias, receiveAddress, defaultChain } });
    logger.info({ alias }, 'Seeded default profile');
  }
}

function sendError(res: express.Response, status: number, message: string, details?: unknown) {
  return res.status(status).json({ error: { message, details } });
}

function isUniqueConstraintError(err: unknown): err is { code: string } {
  return Boolean(err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'P2002');
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/metrics', async (_req, res) => {
  res.setHeader('Content-Type', registry.contentType);
  res.end(await registry.metrics());
});

app.post('/profiles', async (req, res) => {
  const reqLogger = getRequestLogger(req);
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'Invalid profile payload', parsed.error.flatten());
  }
  try {
    const profile = await prisma.profile.create({ data: parsed.data });
    reqLogger.info({ profileId: profile.id }, 'Profile created');
    res.status(201).json(profile);
  } catch (err) {
    reqLogger.error({ err }, 'Failed to create profile');
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
  const reqLogger = getRequestLogger(req);
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
    reqLogger.info({ profileId: profile.id, invoiceId: invoice.id }, 'Invoice created');
    res.status(201).json(invoice);
  } catch (err) {
    reqLogger.error({ err, profileId: profile.id }, 'Failed to create invoice');
    if (isUniqueConstraintError(err)) {
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
  server = app.listen(port, () => {
    logger.info({ port }, 'API server listening');
  });
}

async function shutdown(signal: Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Received shutdown signal');

  const closeServer = async () =>
    new Promise<void>((resolve, reject) => {
      if (!server) return resolve();
      server.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });

  try {
    await closeServer();
    await prisma.$disconnect();
    logger.info('API shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  main().catch((err) => {
    logger.error({ err }, 'API server failed to start');
    process.exit(1);
  });

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export { app, ensureDefaultProfile };
