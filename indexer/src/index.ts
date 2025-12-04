import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Connection } from '@solana/web3.js';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { createIndexerRuntime } from './runtime.js';

const config = loadConfig();
const logger = createLogger(config.logLevel);
const prisma = new PrismaClient();
const connection = new Connection(config.rpcUrl, 'confirmed');

const runtime = createIndexerRuntime({ connection, prisma, config, logger });

runtime
  .start()
  .catch((err) => {
    logger.error('Indexer terminated with fatal error', { error: { message: err?.message ?? String(err) } });
    process.exit(1);
  })
  .then((stop) => {
    process.on('SIGINT', () => {
      stop?.();
      process.exit(0);
    });
  });
