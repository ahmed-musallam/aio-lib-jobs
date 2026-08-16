import { JobsLibError } from "./errors.js";

export interface BuildActionBaseUrlInput {
  /** e.g. `process.env.__OW_API_HOST` */
  apiHost: string;
  /** e.g. `process.env.__OW_ACTION_NAME`, formatted as /namespace/package/action */
  actionName: string;
}

/**
 * Builds the documented public URL for a web action -
 * `<apiHost>/api/v1/web/<namespace>/<package>/<action>` - entirely from
 * values the action already has in its own environment. No header-sniffing,
 * no consumer-supplied base URL config.
 */
export function buildActionBaseUrl({
  apiHost,
  actionName,
}: BuildActionBaseUrlInput): string {
  const trimmedHost = apiHost.replace(/\/+$/, "");
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

  return `${trimmedHost}/api/v1/web/${namespace}/${pkg}/${action}`;
}

export function buildStatusUrl(actionBaseUrl: string, jobId: string): string {
  return `${actionBaseUrl}/status/${jobId}`;
}

export function buildCancelUrl(actionBaseUrl: string, jobId: string): string {
  return `${actionBaseUrl}/cancel/${jobId}`;
}
