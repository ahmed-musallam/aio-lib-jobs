import { describe, expect, it } from "vitest";
import { buildActionBaseUrl, buildCancelUrl, buildStatusUrl } from "../src/urls.js";

describe("buildActionBaseUrl", () => {
  it("builds the public https://<namespace>.adobeioruntime.net/api/v1/web/<package>/<action> URL from __OW_ACTION_NAME", () => {
    const url = buildActionBaseUrl({
      actionName: "/my-namespace/my-package/my-action",
    });
    expect(url).toBe(
      "https://my-namespace.adobeioruntime.net/api/v1/web/my-package/my-action",
    );
  });

  it("inserts the 'default' package when the action has no package segment", () => {
    const url = buildActionBaseUrl({
      actionName: "/my-namespace/my-action",
    });
    expect(url).toBe(
      "https://my-namespace.adobeioruntime.net/api/v1/web/default/my-action",
    );
  });

  it("throws on a malformed action name", () => {
    expect(() =>
      buildActionBaseUrl({
        actionName: "/just-a-namespace",
      }),
    ).toThrowError(/ERROR_BAD_ARGUMENT|invalid action name/i);
  });
});

describe("buildStatusUrl / buildCancelUrl", () => {
  const base = "https://ns.adobeioruntime.net/api/v1/web/pkg/action";
  const jobId = "ns.pkg.action.abc123";

  it("appends /status/<jobId>", () => {
    expect(buildStatusUrl(base, jobId)).toBe(`${base}/status/${jobId}`);
  });

  it("appends /cancel/<jobId>", () => {
    expect(buildCancelUrl(base, jobId)).toBe(`${base}/cancel/${jobId}`);
  });
});
