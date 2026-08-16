import { JobsLibError } from "./errors.js";

export interface BuildActionBaseUrlInput {
  /** e.g. `process.env.__OW_ACTION_NAME`, formatted as /namespace/package/action */
  actionName: string;
}

/**
 * Builds the public web action URL - `https://<namespace>.adobeioruntime.net/api/v1/web/<package>/<action>`
 * - entirely from the action's own `__OW_ACTION_NAME`. Deliberately does NOT
 * use `__OW_API_HOST`: that env var points at Adobe I/O Runtime's internal
 * control-plane host (used by the `openwhisk` client for authenticated
 * invoke() calls), which is unreachable from outside the platform - verified
 * by an actual deployed round-trip, not just the docs.
 */
export function buildActionBaseUrl({
  actionName,
}: BuildActionBaseUrlInput): string {
  const segments = actionName.replace(/^\/+/, "").split("/").filter(Boolean);

  let namespace: string;
  let pkg: string;
  let action: string;

  if (segments.length === 3) {
    [namespace, pkg, action] = segments as [string, string, string];
  } else if (segments.length === 2) {
    [namespace, action] = segments as [string, string];
    pkg = "default";
  } else {
    throw new JobsLibError(
      "ERROR_BAD_ARGUMENT",
      `invalid action name: "${actionName}"`,
    );
  }

  return `https://${namespace}.adobeioruntime.net/api/v1/web/${pkg}/${action}`;
}

export function buildStatusUrl(actionBaseUrl: string, jobId: string): string {
  return `${actionBaseUrl}/status/${jobId}`;
}

export function buildCancelUrl(actionBaseUrl: string, jobId: string): string {
  return `${actionBaseUrl}/cancel/${jobId}`;
}
