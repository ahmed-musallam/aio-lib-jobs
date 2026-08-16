import { describe, expect, it } from "vitest";
import { buildActionBaseUrl, buildCancelUrl, buildStatusUrl } from "../src/urls.js";

describe("buildActionBaseUrl", () => {
  it("builds the documented /api/v1/web/<namespace>/<package>/<action> path from __OW_API_HOST + __OW_ACTION_NAME", () => {
    const url = buildActionBaseUrl({
      apiHost: "https://adobeioruntime.net",
      actionName: "/my-namespace/my-package/my-action",
    });
    expect(url).toBe(
      "https://adobeioruntime.net/api/v1/web/my-namespace/my-package/my-action",
    );
  });

  it("inserts the 'default' package when the action has no package segment", () => {
    const url = buildActionBaseUrl({
      apiHost: "https://adobeioruntime.net",
      actionName: "/my-namespace/my-action",
    });
    expect(url).toBe(
      "https://adobeioruntime.net/api/v1/web/my-namespace/default/my-action",
    );
  });

  it("trims a trailing slash from apiHost", () => {
    const url = buildActionBaseUrl({
      apiHost: "https://adobeioruntime.net/",
      actionName: "/my-namespace/my-package/my-action",
    });
    expect(url).toBe(
      "https://adobeioruntime.net/api/v1/web/my-namespace/my-package/my-action",
    );
  });

  it("throws on a malformed action name", () => {
    expect(() =>
      buildActionBaseUrl({
        apiHost: "https://adobeioruntime.net",
        actionName: "/just-a-namespace",
      }),
    ).toThrowError(/ERROR_BAD_ARGUMENT|invalid action name/i);
  });
});

describe("buildStatusUrl / buildCancelUrl", () => {
  const base = "https://adobeioruntime.net/api/v1/web/ns/pkg/action";
  const jobId = "ns.pkg.action.abc123";

  it("appends /status/<jobId>", () => {
    expect(buildStatusUrl(base, jobId)).toBe(`${base}/status/${jobId}`);
  });

  it("appends /cancel/<jobId>", () => {
    expect(buildCancelUrl(base, jobId)).toBe(`${base}/cancel/${jobId}`);
  });
});
