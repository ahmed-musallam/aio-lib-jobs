import { describe, expect, it } from "vitest";
import {
  cancelKey,
  jobIdFromKey,
  mainKey,
  reportMatchPattern,
  submittedAtKey,
} from "../src/keys.js";

const jobId = "my-namespace.my-action.abc123";

describe("key builders", () => {
  it("mainKey is the jobId itself", () => {
    expect(mainKey(jobId)).toBe(jobId);
  });

  it("submittedAtKey appends .submittedAt", () => {
    expect(submittedAtKey(jobId)).toBe(`${jobId}.submittedAt`);
  });

  it("cancelKey appends .cancel", () => {
    expect(cancelKey(jobId)).toBe(`${jobId}.cancel`);
  });

  it("reportMatchPattern appends a glob wildcard to the prefix", () => {
    expect(reportMatchPattern("my-namespace.my-action")).toBe(
      "my-namespace.my-action.*",
    );
  });
});

describe("jobIdFromKey", () => {
  it("returns a plain jobId key unchanged", () => {
    expect(jobIdFromKey(jobId)).toBe(jobId);
  });

  it("strips the .submittedAt suffix, since list() globs match derived keys too", () => {
    expect(jobIdFromKey(submittedAtKey(jobId))).toBe(jobId);
  });

  it("strips the .cancel suffix, since list() globs match derived keys too", () => {
    expect(jobIdFromKey(cancelKey(jobId))).toBe(jobId);
  });
});
