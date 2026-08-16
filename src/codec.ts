import type { CancelFlag, JobRecord } from "./types.js";

/**
 * `aio-lib-state`'s put() only accepts string values, so every structured
 * record we store is JSON-encoded going in and decoded coming out.
 */
export function encodeJobRecord(record: JobRecord): string {
  return JSON.stringify(record);
}

export function decodeJobRecord(value: string): JobRecord {
  return JSON.parse(value) as JobRecord;
}

export function encodeCancelFlag(flag: CancelFlag): string {
  return JSON.stringify(flag);
}

export function decodeCancelFlag(value: string): CancelFlag {
  return JSON.parse(value) as CancelFlag;
}
