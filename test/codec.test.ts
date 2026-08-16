import { describe, expect, it } from "vitest";
import { decodeCancelFlag, decodeJobRecord, encodeCancelFlag, encodeJobRecord } from "../src/codec.js";
import type { CancelFlag, JobRecord } from "../src/types.js";

describe("job record codec", () => {
  it("round-trips a running job record", () => {
    const record: JobRecord = {
      status: "running",
      startedAt: "2026-08-15T10:00:00.000Z",
      updatedAt: "2026-08-15T10:00:00.000Z",
      maxDurationMs: 60_000,
    };
    expect(decodeJobRecord(encodeJobRecord(record))).toEqual(record);
  });

  it("round-trips a succeeded job record with a result", () => {
    const record: JobRecord = {
      status: "succeeded",
      startedAt: "2026-08-15T10:00:00.000Z",
      updatedAt: "2026-08-15T10:00:30.000Z",
      maxDurationMs: 60_000,
      result: { total: 42 },
    };
    expect(decodeJobRecord(encodeJobRecord(record))).toEqual(record);
  });

  it("round-trips a failed job record with an error", () => {
    const record: JobRecord = {
      status: "failed",
      startedAt: "2026-08-15T10:00:00.000Z",
      updatedAt: "2026-08-15T10:00:30.000Z",
      maxDurationMs: 60_000,
      error: { message: "boom", code: "ERROR_INTERNAL" },
    };
    expect(decodeJobRecord(encodeJobRecord(record))).toEqual(record);
  });
});

describe("cancel flag codec", () => {
  it("round-trips a cancel flag", () => {
    const flag: CancelFlag = {
      cancelRequested: true,
      requestedAt: "2026-08-15T10:01:00.000Z",
    };
    expect(decodeCancelFlag(encodeCancelFlag(flag))).toEqual(flag);
  });
});
