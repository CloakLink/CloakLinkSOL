import 'dotenv/config';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { createIndexerRuntime } from './runtime.js';
import { RpcClient } from './rpcClient.js';
import { createPrismaClient } from './prisma.js';
import { startHealthServer } from './healthServer.js';

const config = loadConfig();
const logger = createLogger(config.logLevel);
const prisma = createPrismaClient();
const rpcClient = new RpcClient(config, logger);

const runtime = createIndexerRuntime({ rpcClient, prisma, config, logger });
const stopHealth = startHealthServer(runtime, config, logger);

runtime
  .start()
  .catch((err) => {
    logger.error('Indexer terminated with fatal error', { error: { message: err?.message ?? String(err) } });
    process.exit(1);
  })
  .then((stop) => {
    process.on('SIGINT', () => {
      stop?.();
      stopHealth();
      process.exit(0);
    });
  });
