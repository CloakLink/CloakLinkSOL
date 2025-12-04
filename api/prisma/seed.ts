import { Prisma } from '@prisma/client';
import { createPrismaClient } from '../src/prisma.js';

async function main() {
  const prisma = createPrismaClient();

  const alias = process.env.DEFAULT_PROFILE_ALIAS ?? 'Demo Alias';
  const receiveAddress =
    process.env.DEFAULT_RECEIVE_ADDRESS ?? 'H3UuEhEDuJeayQM2ngiZX6hgqPdh9vywgqbiZ9erjRzG';
  const defaultChain = process.env.DEFAULT_CHAIN ?? 'solana';

  const profile = await prisma.profile.upsert({
    where: { alias },
    update: { receiveAddress, defaultChain },
    create: { alias, receiveAddress, defaultChain },
  });

  await prisma.invoice.upsert({
    where: { slug: 'demo-invoice' },
    update: {},
    create: {
      profileId: profile.id,
      slug: 'demo-invoice',
      amount: new Prisma.Decimal(1),
      tokenSymbol: 'SOL',
      chain: defaultChain,
      receiveAddress,
      description: 'Demo invoice seeded for onboarding',
    },
  });

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Failed to seed database', error);
  process.exit(1);
});
