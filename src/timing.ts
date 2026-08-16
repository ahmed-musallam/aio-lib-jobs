import type { JobStatus } from "./types.js";

export interface ComputeTimingInput {
  status: JobStatus;
  /** Absent during the brief window before the submitter's write completes. */
  submittedAt?: string;
  startedAt: string;
  updatedAt: string;
  maxDurationMs: number;
  now: Date;
}

export interface ComputeTimingOutput {
  submittedAt?: string;
  startedAt: string;
  updatedAt: string;
  queuedMs?: number;
  elapsedMs: number;
  stale: boolean;
}

/**
 * Derives read-time-only timing fields. Nothing here is ever written to
 * state - `stale` in particular is inferred from `startedAt` vs
 * `maxDurationMs` rather than a heartbeat, since there's no way to detect a
 * dead worker directly.
 */
export function computeTiming(input: ComputeTimingInput): ComputeTimingOutput {
  const { status, submittedAt, startedAt, updatedAt, maxDurationMs, now } =
    input;

  const startedAtMs = Date.parse(startedAt);
  const isRunning = status === "running";

  const elapsedMs = isRunning
    ? now.getTime() - startedAtMs
    : Date.parse(updatedAt) - startedAtMs;

  const stale = isRunning && now.getTime() - startedAtMs > maxDurationMs;

  return {
    submittedAt,
    startedAt,
    updatedAt,
    queuedMs:
      submittedAt !== undefined
        ? startedAtMs - Date.parse(submittedAt)
        : undefined,
    elapsedMs,
    stale,
  };
}
