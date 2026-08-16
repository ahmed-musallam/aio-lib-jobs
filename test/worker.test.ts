import { describe, expect, it } from "vitest";
import { runWorker, DEFAULT_MAX_DURATION_MS } from "../src/worker.js";
import { decodeJobRecord, encodeCancelFlag } from "../src/codec.js";
import { cancelKey, mainKey } from "../src/keys.js";
import { FakeStateClient } from "./helpers/fake-state-client.js";

const actionName = "/my-namespace/my-package/my-worker";
const activationId = "abc123";
const expectedJobId = "my-namespace.my-package.my-worker.abc123";

describe("runWorker", () => {
  it("writes a running record before invoking the handler, then succeeded after it resolves", async () => {
    const state = new FakeStateClient();
    let statusDuringHandler: string | undefined;

    const action = runWorker(
      async (ctx) => {
        const raw = await state.get(mainKey(ctx.jobId));
        statusDuringHandler = raw && decodeJobRecord(raw.value).status;
        return { total: 42 };
      },
      { state, activationId, actionName },
    );

    const outcome = await action({});

    expect(statusDuringHandler).toBe("running");
    expect(outcome).toEqual({
      jobId: expectedJobId,
      status: "succeeded",
      result: { total: 42 },
    });

    const finalRaw = state.peek(mainKey(expectedJobId));
    expect(finalRaw).toBeDefined();
    const finalRecord = decodeJobRecord(finalRaw as string);
    expect(finalRecord.status).toBe("succeeded");
    expect(finalRecord.result).toEqual({ total: 42 });
    expect(finalRecord.maxDurationMs).toBe(DEFAULT_MAX_DURATION_MS);
  });

  it("derives jobId from the injected activationId/actionName (standing in for __OW_ACTIVATION_ID/__OW_ACTION_NAME)", async () => {
    const state = new FakeStateClient();
    const action = runWorker(async (ctx) => ctx.jobId, { state, activationId, actionName });
    const outcome = await action({});
    expect(outcome.jobId).toBe(expectedJobId);
  });

  it("writes a failed record and rethrows when the handler throws", async () => {
    const state = new FakeStateClient();
    const action = runWorker(
      async () => {
        throw new Error("boom");
      },
      { state, activationId, actionName },
    );

    await expect(action({})).rejects.toThrow("boom");

    const finalRecord = decodeJobRecord(state.peek(mainKey(expectedJobId)) as string);
    expect(finalRecord.status).toBe("failed");
    expect(finalRecord.error?.message).toBe("boom");
  });

  it("strips the reserved __aio_lib_jobs param from ctx.params but honors its maxDurationMs override", async () => {
    const state = new FakeStateClient();
    let receivedParams: unknown;
    const action = runWorker(
      async (ctx) => {
        receivedParams = ctx.params;
        return null;
      },
      { state, activationId, actionName },
    );

    await action({
      businessField: "value",
      __aio_lib_jobs: { maxDurationMs: 5_000 },
    });

    expect(receivedParams).toEqual({ businessField: "value" });
    const finalRecord = decodeJobRecord(state.peek(mainKey(expectedJobId)) as string);
    expect(finalRecord.maxDurationMs).toBe(5_000);
  });

  it("ctx.isCancelled() reflects the cancel key written by the cancel route", async () => {
    const state = new FakeStateClient();
    let cancelledBefore: boolean | undefined;
    let cancelledAfter: boolean | undefined;

    const action = runWorker(
      async (ctx) => {
        cancelledBefore = await ctx.isCancelled();
        await state.put(
          cancelKey(ctx.jobId),
          encodeCancelFlag({ cancelRequested: true, requestedAt: new Date().toISOString() }),
        );
        cancelledAfter = await ctx.isCancelled();
        return null;
      },
      { state, activationId, actionName },
    );

    await action({});

    expect(cancelledBefore).toBe(false);
    expect(cancelledAfter).toBe(true);
  });

  it("throws a clear error when neither config nor env vars provide activationId/actionName", async () => {
    const state = new FakeStateClient();
    const action = runWorker(async () => null, { state });
    await expect(action({})).rejects.toThrow(/__OW_ACTIVATION_ID|__OW_ACTION_NAME/);
  });
});
