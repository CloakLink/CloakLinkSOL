import 'dotenv/config';
import type { Signals } from 'node:process';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { createIndexerRuntime } from './runtime.js';
import { RpcClient } from './rpcClient.js';
import { createPrismaClient } from './prisma.js';
import { startHealthServer } from './healthServer.js';

const config = loadConfig();
const logger = createLogger(config.logLevel, { component: 'bootstrap' });
const prisma = createPrismaClient();
const rpcClient = new RpcClient(config, logger.child({ component: 'rpc-client' }));

const runtime = createIndexerRuntime({
  rpcClient,
  prisma,
  config,
  logger: logger.child({ component: 'runtime' }),
});
const stopHealth = startHealthServer(runtime, config, logger.child({ component: 'health' }));
let stopRuntime: (() => void) | undefined;
let shuttingDown = false;

async function shutdown(signal: Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Received shutdown signal');
  try {
    stopRuntime?.();
    stopHealth();
    await prisma.$disconnect();
    logger.info('Indexer shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
}

async function start() {
  try {
    stopRuntime = await runtime.start();
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    logger.error({ err }, 'Indexer terminated with fatal error');
    await prisma.$disconnect();
    process.exit(1);
  }
}

start();
