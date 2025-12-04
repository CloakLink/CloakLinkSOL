import http from 'node:http';
import { type IndexerConfig } from './config.js';
import { type createLogger } from './logger.js';
import { type IndexerRuntime } from './runtime.js';
import { metricsRegistry } from './metrics.js';

type Logger = ReturnType<typeof createLogger>;

type HealthRuntime = Pick<IndexerRuntime, 'healthSnapshot'>;

export function startHealthServer(runtime: HealthRuntime, config: IndexerConfig, logger: Logger) {
  const server = http.createServer(async (_req, res) => {
    if (_req.url?.startsWith('/health')) {
      const snapshot = runtime.healthSnapshot();
      res.setHeader('Content-Type', 'application/json');
      res.write(JSON.stringify({ status: 'ok', ...snapshot }));
      res.end();
      return;
    }

    if (_req.url?.startsWith('/metrics')) {
      res.setHeader('Content-Type', metricsRegistry.contentType);
      res.end(await metricsRegistry.metrics());
      return;
    }

    res.statusCode = 404;
    res.end();
  });

  server.listen(config.healthPort, () => {
    logger.info('Health server listening', { port: config.healthPort });
  });

  return () => server.close();
}
