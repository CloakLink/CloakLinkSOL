import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

const registry = new Registry();
collectDefaultMetrics({ register: registry, eventLoopMonitoringPrecision: 10 });

const httpRequestDuration = new Histogram({
  name: 'api_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [registry],
});

const httpRequestsTotal = new Counter({
  name: 'api_http_requests_total',
  help: 'Count of HTTP requests received',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

function metricsMiddleware(req: { method: string; route?: { path?: string }; path?: string }, res: { statusCode: number; on: typeof import('node:events').EventEmitter.prototype.on }, next: () => void) {
  const route = req.route?.path ?? req.path ?? 'unknown';
  const method = req.method;
  const labels = { method, route, status_code: 'pending' } as const;
  const end = httpRequestDuration.startTimer(labels);

  res.on('finish', () => {
    const completedLabels = { method, route, status_code: String(res.statusCode) } as const;
    httpRequestsTotal.inc(completedLabels);
    end(completedLabels);
  });

  next();
}

export { metricsMiddleware, registry, httpRequestDuration, httpRequestsTotal };
