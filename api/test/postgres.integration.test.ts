import net from 'node:net';
import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

async function canReachPostgres(url: string) {
  const parsed = new URL(url);
  const port = Number.parseInt(parsed.port || '5432', 10);
  return new Promise<boolean>((resolve) => {
    const socket = net.connect(port, parsed.hostname);
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 500);
    socket.on('connect', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

describe('Postgres integration', () => {
  const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://cloaklink:cloaklink@localhost:5432/cloaklink?schema=public';

  it('creates and reads invoices when Postgres is available', async () => {
    process.env.DATABASE_URL = databaseUrl;

    const reachable = await canReachPostgres(databaseUrl);
    if (!reachable) {
      console.warn('Postgres not reachable; skipping integration assertion');
      return;
    }

    const { createPrismaClient } = await import('../src/prisma.js');
    const prisma = createPrismaClient();
    await prisma.invoice.deleteMany();
    await prisma.profile.deleteMany();

    const profile = await prisma.profile.create({
      data: { alias: 'integration', receiveAddress: 'H3UuEhEDuJeayQM2ngiZX6hgqPdh9vywgqbiZ9erjRzG', defaultChain: 'solana' },
    });

    const invoice = await prisma.invoice.create({
      data: {
        profileId: profile.id,
        slug: 'integration-test',
        amount: new Prisma.Decimal(1.5),
        tokenSymbol: 'SOL',
        chain: 'solana',
        receiveAddress: profile.receiveAddress,
      },
    });

    const fetched = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(fetched?.slug).toBe('integration-test');

    await prisma.invoice.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.$disconnect();
  });
});
