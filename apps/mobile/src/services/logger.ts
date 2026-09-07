import { createLogger, createRingBufferSink, type LogRecord } from '@wake/domain';

const ring = createRingBufferSink(400);

/** Spec §62. Redaction happens inside @wake/domain before the record reaches any sink. */
export const logger = createLogger((record: LogRecord) => {
  ring.sink(record);
  if (__DEV__) {
    const fn = record.level === 'error' ? console.error : record.level === 'warn' ? console.warn : console.log;
    fn(`[wake] ${record.event}`, record.data ?? '');
  }
});

export const getLogRecords = ring.records;
export const clearLogRecords = ring.clear;
