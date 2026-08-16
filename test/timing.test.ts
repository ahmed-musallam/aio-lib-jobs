import { describe, expect, it } from "vitest";
import { computeTiming } from "../src/timing.js";

const submittedAt = "2026-08-15T10:00:00.000Z";
const startedAt = "2026-08-15T10:00:01.000Z"; // 1s queueing delay
const maxDurationMs = 60_000;

describe("computeTiming", () => {
  it("computes elapsedMs from now for a running job", () => {
    const now = new Date("2026-08-15T10:00:31.000Z"); // 30s after start
    const result = computeTiming({
      status: "running",
      submittedAt,
      startedAt,
      updatedAt: startedAt,
      maxDurationMs,
      now,
    });
    expect(result.elapsedMs).toBe(30_000);
  });

  it("computes queuedMs as the gap between submittedAt and startedAt", () => {
    const now = new Date(startedAt);
    const result = computeTiming({
      status: "running",
      submittedAt,
      startedAt,
      updatedAt: startedAt,
      maxDurationMs,
      now,
    });
    expect(result.queuedMs).toBe(1_000);
  });

  it("omits queuedMs when submittedAt is not yet known", () => {
    const now = new Date(startedAt);
    const result = computeTiming({
      status: "running",
      startedAt,
      updatedAt: startedAt,
      maxDurationMs,
      now,
    });
    expect(result.queuedMs).toBeUndefined();
  });

  it("is not stale while running under maxDurationMs", () => {
    const now = new Date("2026-08-15T10:00:31.000Z"); // 30s elapsed, max 60s
    const result = computeTiming({
      status: "running",
      submittedAt,
      startedAt,
      updatedAt: startedAt,
      maxDurationMs,
      now,
    });
    expect(result.stale).toBe(false);
  });

  it("is stale once running exceeds maxDurationMs", () => {
    const now = new Date("2026-08-15T10:05:00.000Z"); // way past 60s
    const result = computeTiming({
      status: "running",
      submittedAt,
      startedAt,
      updatedAt: startedAt,
      maxDurationMs,
      now,
    });
    expect(result.stale).toBe(true);
  });

  it("uses updatedAt - startedAt for elapsedMs once terminal, ignoring `now`", () => {
    const updatedAt = "2026-08-15T10:00:45.000Z"; // 44s of actual work
    const now = new Date("2026-08-15T12:00:00.000Z"); // long after
    const result = computeTiming({
      status: "succeeded",
      submittedAt,
      startedAt,
      updatedAt,
      maxDurationMs,
      now,
    });
    expect(result.elapsedMs).toBe(44_000);
  });

  it("is never stale once terminal, even past maxDurationMs", () => {
    const updatedAt = "2026-08-15T10:05:00.000Z";
    const now = new Date("2026-08-15T12:00:00.000Z");
    const result = computeTiming({
      status: "failed",
      submittedAt,
      startedAt,
      updatedAt,
      maxDurationMs,
      now,
    });
    expect(result.stale).toBe(false);
  });
});
