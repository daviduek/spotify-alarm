/**
 * Spec §62 — structured logger with redaction. Sinks are injected so the
 * mobile app can route to console in dev and to a ring buffer for the
 * diagnostics screen, while tests stay silent.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogRecord = {
  level: LogLevel;
  event: string;
  data?: Record<string, unknown>;
  at: string;
};

export type LogSink = (record: LogRecord) => void;

export interface Logger {
  debug(event: string, data?: Record<string, unknown>): void;
  info(event: string, data?: Record<string, unknown>): void;
  warn(event: string, data?: Record<string, unknown>): void;
  error(event: string, data?: Record<string, unknown>): void;
}

const SENSITIVE_KEY = /(token|secret|authorization|password|code_verifier|refresh|cookie|bearer)/i;

export function redact(data: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!data) return data;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (SENSITIVE_KEY.test(k)) out[k] = '[redacted]';
    else if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = redact(v as Record<string, unknown>);
    else out[k] = v;
  }
  return out;
}

export function createLogger(sink: LogSink, now: () => Date = () => new Date()): Logger {
  const emit = (level: LogLevel, event: string, data?: Record<string, unknown>) =>
    sink({ level, event, data: redact(data), at: now().toISOString() });
  return {
    debug: (e, d) => emit('debug', e, d),
    info: (e, d) => emit('info', e, d),
    warn: (e, d) => emit('warn', e, d),
    error: (e, d) => emit('error', e, d),
  };
}

/** In-memory ring buffer sink for the diagnostics screen. */
export function createRingBufferSink(capacity = 300): { sink: LogSink; records: () => LogRecord[]; clear: () => void } {
  const buf: LogRecord[] = [];
  return {
    sink: (r) => {
      buf.push(r);
      if (buf.length > capacity) buf.splice(0, buf.length - capacity);
    },
    records: () => [...buf],
    clear: () => {
      buf.length = 0;
    },
  };
}
