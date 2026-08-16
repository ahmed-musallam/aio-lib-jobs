import { describe, expect, it } from "vitest";
import { buildJobId, deriveActionPrefix } from "../src/job-id.js";

describe("deriveActionPrefix", () => {
  it("strips the leading slash and joins remaining segments with dots", () => {
    expect(deriveActionPrefix("/my-namespace/my-package/my-action")).toBe(
      "my-namespace.my-package.my-action",
    );
  });

  it("handles a fully qualified name with no package segment", () => {
    expect(deriveActionPrefix("/my-namespace/my-action")).toBe(
      "my-namespace.my-action",
    );
  });

  it("works even without a leading slash", () => {
    expect(deriveActionPrefix("my-namespace/my-action")).toBe(
      "my-namespace.my-action",
    );
  });

  it("replaces any character outside the state key charset (alphanumeric, -, _, .) with a dash", () => {
    expect(deriveActionPrefix("/my namespace/my@action")).toBe(
      "my-namespace.my-action",
    );
  });
});

describe("buildJobId", () => {
  it("composes a jobId as <prefix>.<activationId>", () => {
    expect(buildJobId("my-namespace.my-action", "abc123")).toBe(
      "my-namespace.my-action.abc123",
    );
  });
});
