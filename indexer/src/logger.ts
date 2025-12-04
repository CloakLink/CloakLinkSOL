import { LogLevel } from './config';

type LogEntry = {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
};

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function write(entry: LogEntry) {
  const payload = JSON.stringify(entry);
  if (entry.level === 'error') {
    console.error(payload);
  } else if (entry.level === 'warn') {
    console.warn(payload);
  } else {
    console.log(payload);
  }
}

export function createLogger(minLevel: LogLevel) {
  const minLevelScore = levelPriority[minLevel];

  const log = (level: LogLevel, message: string, context?: Record<string, unknown>) => {
    if (levelPriority[level] < minLevelScore) return;
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(context ? { context } : {}),
    };
    write(entry);
  };

  return {
    debug: (message: string, context?: Record<string, unknown>) => log('debug', message, context),
    info: (message: string, context?: Record<string, unknown>) => log('info', message, context),
    warn: (message: string, context?: Record<string, unknown>) => log('warn', message, context),
    error: (message: string, context?: Record<string, unknown>) => log('error', message, context),
  };
}
