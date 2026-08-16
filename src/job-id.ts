/**
 * aio-lib-state keys are restricted to alphanumeric characters plus -, _, .
 * Anything else gets replaced with a dash so the derived prefix is always a
 * valid state key segment.
 */
const DISALLOWED_KEY_CHARS = /[^A-Za-z0-9\-_.]/g;

/**
 * Derives a stable, state-key-safe prefix from an action's fully qualified
 * name (e.g. `__OW_ACTION_NAME`, formatted as `/namespace/package/action`).
 * `/` segment separators become `.`, and any character outside the
 * aio-lib-state key charset is replaced with `-`.
 */
export function deriveActionPrefix(fullyQualifiedActionName: string): string {
  const withoutLeadingSlash = fullyQualifiedActionName.replace(/^\/+/, "");
  const dotted = withoutLeadingSlash.replace(/\/+/g, ".");
  return dotted.replace(DISALLOWED_KEY_CHARS, "-");
}

/** Composes the externally-visible jobId from a derived prefix and the worker's activation id. */
export function buildJobId(prefix: string, activationId: string): string {
  return `${prefix}.${activationId}`;
}
