import { PrismaClient } from '@prisma/client';

const timeoutMs = Number.parseInt(process.env.DB_WAIT_TIMEOUT_MS ?? '60000', 10);
const intervalMs = Number.parseInt(process.env.DB_WAIT_INTERVAL_MS ?? '2000', 10);
const start = Date.now();
const client = new PrismaClient();

async function check() {
  try {
    await client.$queryRaw`SELECT 1`;
    await client.$disconnect();
    process.exit(0);
  } catch (error) {
    if (Date.now() - start > timeoutMs) {
      console.error('Database not reachable within timeout', error);
      await client.$disconnect();
      process.exit(1);
    }
    const message = error instanceof Error ? error.message : String(error);
    console.info('Waiting for database...', { error: message });
    setTimeout(check, intervalMs);
  }
}

check();
