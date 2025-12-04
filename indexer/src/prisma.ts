import { PrismaClient } from '@prisma/client';

const defaultPoolLimit = process.env.DATABASE_POOL_MAX ?? '10';
const defaultPoolTimeout = process.env.DATABASE_POOL_TIMEOUT_MS ?? '5000';

export function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  return new PrismaClient({
    datasources: { db: { url: buildDatabaseUrl(databaseUrl) } },
  });
}

function buildDatabaseUrl(databaseUrl: string): string {
  const parsedUrl = new URL(databaseUrl);

  if (!parsedUrl.searchParams.has('connection_limit')) {
    parsedUrl.searchParams.set('connection_limit', defaultPoolLimit);
  }

  if (!parsedUrl.searchParams.has('pool_timeout')) {
    parsedUrl.searchParams.set('pool_timeout', defaultPoolTimeout);
  }

  return parsedUrl.toString();
}
