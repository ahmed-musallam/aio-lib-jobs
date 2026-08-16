const SUBMITTED_AT_SUFFIX = ".submittedAt";
const CANCEL_SUFFIX = ".cancel";

/** The main job record key. It IS the jobId - written exclusively by the worker. */
export function mainKey(jobId: string): string {
  return jobId;
}

/** Submitter-owned key holding the submission timestamp. Never written by the worker. */
export function submittedAtKey(jobId: string): string {
  return `${jobId}${SUBMITTED_AT_SUFFIX}`;
}

/** Cancel-route-owned key holding the cooperative cancellation flag. */
export function cancelKey(jobId: string): string {
  return `${jobId}${CANCEL_SUFFIX}`;
}

/** Glob pattern for listing every key derived from jobs under a given prefix. */
export function reportMatchPattern(prefix: string): string {
  return `${prefix}.*`;
}

/**
 * `list({ match: reportMatchPattern(prefix) })` returns the main key
 * *and* each job's derived `.submittedAt`/`.cancel` keys, since `*` matches
 * across dots. Reducing every returned key back to its canonical jobId
 * (deduping repeats) lets a report include jobs that are still `queued`
 * (only a `.submittedAt` key exists yet) rather than only ones with a main
 * record.
 */
export function jobIdFromKey(key: string): string {
  if (key.endsWith(SUBMITTED_AT_SUFFIX)) {
    return key.slice(0, -SUBMITTED_AT_SUFFIX.length);
  }
  if (key.endsWith(CANCEL_SUFFIX)) {
    return key.slice(0, -CANCEL_SUFFIX.length);
  }
  return key;
}
