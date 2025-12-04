import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry, eventLoopMonitoringPrecision: 10 });

const rpcRequestsTotal = new Counter({
  name: 'indexer_rpc_requests_total',
  help: 'Total RPC requests performed by the indexer',
  labelNames: ['method', 'endpoint', 'outcome'],
  registers: [metricsRegistry],
});

const rpcRequestDuration = new Histogram({
  name: 'indexer_rpc_request_duration_seconds',
  help: 'Duration of RPC requests in seconds',
  labelNames: ['method', 'endpoint', 'outcome'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [metricsRegistry],
});

export { metricsRegistry, rpcRequestsTotal, rpcRequestDuration };
