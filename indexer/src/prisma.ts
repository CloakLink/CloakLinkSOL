import { PrismaClient } from '@prisma/client';
import { loadConfig } from './config.js';

const config = loadConfig();
const defaultPoolLimit = String(config.dbPoolMax);
const defaultPoolTimeout = String(config.dbPoolTimeoutMs);

export function createPrismaClient(): PrismaClient {
  const databaseUrl = config.databaseUrl;

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
