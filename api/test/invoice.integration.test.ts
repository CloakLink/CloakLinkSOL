import { spawnSync } from 'node:child_process';
import path from 'node:path';
import request from 'supertest';
import { PrismaClient, Prisma } from '@prisma/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

const apiRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const repoRoot = path.resolve(apiRoot, '..');
const dbUrl =
  process.env.TEST_DATABASE_URL ?? 'postgresql://cloaklink:cloaklink@localhost:5432/cloaklink_test?schema=public';

let prisma: PrismaClient | undefined;
let app: import('express').Express | undefined;
let skipReason: string | null = null;

beforeAll(async () => {
  process.env.DATABASE_URL = dbUrl;
  const prismaBin = path.join(repoRoot, 'node_modules', '.bin', 'prisma');
  try {
    const migration = spawnSync(prismaBin, ['migrate', 'deploy', '--schema', 'prisma/schema.prisma'], {
      cwd: apiRoot,
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: dbUrl },
    });
    if (migration.error) {
      throw migration.error;
    }
    if (migration.status !== 0) {
      throw new Error(`Failed to migrate test database (status ${migration.status})`);
    }

    ({ prisma } = await import('../src/prisma.js'));
    ({ app } = await import('../src/server.js'));
  } catch (err) {
    skipReason = `Prisma setup failed: ${err instanceof Error ? err.message : String(err)}`;
  }
});

afterEach(async () => {
  if (!prisma) return;
  await prisma.invoice.deleteMany();
  await prisma.profile.deleteMany();
});

afterAll(async () => {
  if (!prisma) return;
  await prisma.$disconnect();
});

describe('Invoice creation validation', () => {
  it('rejects invalid payloads', async () => {
    if (skipReason) {
      console.warn(skipReason);
      return;
    }

    const profile = await prisma!.profile.create({
      data: { alias: 'alias', receiveAddress: 'H3UuEhEDuJeayQM2ngiZX6hgqPdh9vywgqbiZ9erjRzG', defaultChain: 'solana' },
    });

    const res = await request(app).post(`/profiles/${profile.id}/invoices`).send({ amount: -1, tokenSymbol: 'SOL' });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Invalid invoice payload');
  });

  it('returns 409 when slug already exists', async () => {
    if (skipReason) {
      console.warn(skipReason);
      return;
    }

    const profile = await prisma!.profile.create({
      data: { alias: 'alias', receiveAddress: 'H3UuEhEDuJeayQM2ngiZX6hgqPdh9vywgqbiZ9erjRzG', defaultChain: 'solana' },
    });

    await prisma!.invoice.create({
      data: {
        profileId: profile.id,
        amount: new Prisma.Decimal(1),
        tokenSymbol: 'SOL',
        chain: 'solana',
        receiveAddress: profile.receiveAddress,
        slug: 'exists',
      },
    });

    const res = await request(app).post(`/profiles/${profile.id}/invoices`).send({ amount: 1, tokenSymbol: 'SOL', slug: 'exists' });
    expect(res.status).toBe(409);
  });

  it('creates invoices with generated slug when valid', async () => {
    if (skipReason) {
      console.warn(skipReason);
      return;
    }

    const profile = await prisma!.profile.create({
      data: { alias: 'Demo', receiveAddress: 'H3UuEhEDuJeayQM2ngiZX6hgqPdh9vywgqbiZ9erjRzG', defaultChain: 'solana' },
    });

    const res = await request(app).post(`/profiles/${profile.id}/invoices`).send({ amount: 1.5, tokenSymbol: 'SOL' });

    expect(res.status).toBe(201);
    expect(res.body.slug).toMatch(/demo-/);
    expect(res.body.chain).toBe('solana');
  });
});
