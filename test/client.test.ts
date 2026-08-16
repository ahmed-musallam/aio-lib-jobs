import { describe, expect, it } from "vitest";
import { init } from "../src/client.js";
import { encodeJobRecord } from "../src/codec.js";
import { cancelKey, submittedAtKey } from "../src/keys.js";
import { FakeOwClient } from "./helpers/fake-ow-client.js";
import { FakeStateClient } from "./helpers/fake-state-client.js";

const fixedNow = () => new Date("2026-08-15T10:00:00.000Z");

async function makeClient(overrides: Record<string, unknown> = {}) {
  const state = new FakeStateClient();
  const ow = new FakeOwClient("abc123");
  const client = await init({
    state,
    ow,
    namespace: "my-namespace",
    selfActionName: "/my-namespace/my-package/my-submit-action",
    now: fixedNow,
    ...overrides,
  });
  return { client, state, ow };
}

describe("submit", () => {
  it("invokes the worker non-blocking with the fully-qualified name and returns jobId + status/cancel URLs", async () => {
    const { client, ow, state } = await makeClient();
    const result = await client.submit("my-package/my-worker", { foo: "bar" });

    expect(ow.invocations).toEqual([
      { name: "/my-namespace/my-package/my-worker", params: { foo: "bar" }, blocking: false },
    ]);

    expect(result.jobId).toBe("my-namespace.my-package.my-worker.abc123");
    expect(result.statusUrl).toBe(
      "https://my-namespace.adobeioruntime.net/api/v1/web/my-package/my-submit-action/status/my-namespace.my-package.my-worker.abc123",
    );
    expect(result.cancelUrl).toBe(
      "https://my-namespace.adobeioruntime.net/api/v1/web/my-package/my-submit-action/cancel/my-namespace.my-package.my-worker.abc123",
    );
    expect(state.peek(submittedAtKey(result.jobId))).toBe("2026-08-15T10:00:00.000Z");
  });

  it("passes a maxDurationMs override through as the reserved __aio_lib_jobs param", async () => {
    const { client, ow } = await makeClient();
    await client.submit("my-package/my-worker", { foo: "bar" }, { maxDurationMs: 5_000 });
    expect(ow.invocations[0]?.params).toEqual({
      foo: "bar",
      __aio_lib_jobs: { maxDurationMs: 5_000 },
    });
  });

  it("throws a clear error when __OW_NAMESPACE is not available", async () => {
    const state = new FakeStateClient();
    const ow = new FakeOwClient("abc123");
    const client = await init({
      state,
      ow,
      selfActionName: "/ns/pkg/action",
    });
    await expect(client.submit("pkg/worker", {})).rejects.toThrow(/__OW_NAMESPACE/);
  });

  it("rejects params that already use the reserved __aio_lib_jobs key", async () => {
    const { client, ow } = await makeClient();
    await expect(
      client.submit("my-package/my-worker", { __aio_lib_jobs: "whatever" }),
    ).rejects.toThrow(/__aio_lib_jobs/);
    expect(ow.invocations).toEqual([]);
  });
});

describe("getStatus", () => {
  it("returns not-found when nothing has been recorded for the jobId", async () => {
    const { client } = await makeClient();
    expect(await client.getStatus("my-namespace.my-package.my-worker.zzz")).toEqual({
      jobId: "my-namespace.my-package.my-worker.zzz",
      state: "not-found",
    });
  });

  it("returns queued when submittedAt exists but the worker hasn't written its first record yet", async () => {
    const { client, state } = await makeClient();
    const jobId = "my-namespace.my-package.my-worker.abc123";
    await state.put(submittedAtKey(jobId), "2026-08-15T10:00:00.000Z");

    expect(await client.getStatus(jobId)).toEqual({
      jobId,
      state: "queued",
      submittedAt: "2026-08-15T10:00:00.000Z",
    });
  });

  it("returns the record with computed timing once the worker has written running/succeeded/failed", async () => {
    const { client, state } = await makeClient({
      now: () => new Date("2026-08-15T10:01:00.000Z"),
    });
    const jobId = "my-namespace.my-package.my-worker.abc123";
    await state.put(submittedAtKey(jobId), "2026-08-15T10:00:00.000Z");
    await state.put(
      jobId,
      encodeJobRecord({
        status: "running",
        startedAt: "2026-08-15T10:00:01.000Z",
        updatedAt: "2026-08-15T10:00:01.000Z",
        maxDurationMs: 60_000,
      }),
    );

    const result = await client.getStatus(jobId);
    expect(result).toMatchObject({
      jobId,
      state: "running",
      submittedAt: "2026-08-15T10:00:00.000Z",
      startedAt: "2026-08-15T10:00:01.000Z",
      queuedMs: 1_000,
      elapsedMs: 59_000,
      stale: false,
    });
  });
});

describe("cancel", () => {
  it("writes a cancel flag readable via the cancel key", async () => {
    const { client, state } = await makeClient();
    await client.cancel("some-job-id");
    const raw = state.peek(cancelKey("some-job-id"));
    expect(raw).toBeDefined();
    expect(JSON.parse(raw as string)).toEqual({
      cancelRequested: true,
      requestedAt: "2026-08-15T10:00:00.000Z",
    });
  });
});

describe("report", () => {
  it("scopes listing to the given worker action's prefix and excludes derived .submittedAt/.cancel keys", async () => {
    const { client, state } = await makeClient();
    const jobIdA = "my-namespace.my-package.my-worker.aaa";
    const jobIdB = "my-namespace.my-package.my-worker.bbb";
    const otherJobId = "my-namespace.other-package.other-worker.ccc";
    const record = encodeJobRecord({
      status: "running",
      startedAt: "2026-08-15T10:00:00.000Z",
      updatedAt: "2026-08-15T10:00:00.000Z",
      maxDurationMs: 1,
    });

    await state.put(jobIdA, record);
    await state.put(submittedAtKey(jobIdA), "2026-08-15T10:00:00.000Z");
    await state.put(jobIdB, record);
    await state.put(otherJobId, record);

    const results = await client.report("my-package/my-worker");
    expect(results.map((r) => r.jobId).sort()).toEqual([jobIdA, jobIdB].sort());
  });

  it("includes jobs that are still queued (only a .submittedAt key exists, no main record yet)", async () => {
    const { client, state } = await makeClient();
    const queuedJobId = "my-namespace.my-package.my-worker.queued-only";
    await state.put(submittedAtKey(queuedJobId), "2026-08-15T10:00:00.000Z");

    const results = await client.report("my-package/my-worker");
    expect(results).toEqual([
      { jobId: queuedJobId, state: "queued", submittedAt: "2026-08-15T10:00:00.000Z" },
    ]);
  });
});

describe("router", () => {
  it("wires submit/status/cancel/report as a composable Hono sub-app", async () => {
    const { client } = await makeClient();
    const app = await client.router("my-package/my-worker");

    const submitRes = await app.request("/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ foo: "bar" }),
    });
    expect(submitRes.status).toBe(202);
    const submitBody = (await submitRes.json()) as { jobId: string };
    expect(submitBody.jobId).toBe("my-namespace.my-package.my-worker.abc123");

    const statusRes = await app.request(`/status/${submitBody.jobId}`);
    expect(statusRes.status).toBe(200);
    const statusBody = (await statusRes.json()) as { state: string };
    expect(statusBody.state).toBe("queued");

    const cancelRes = await app.request(`/cancel/${submitBody.jobId}`, { method: "POST" });
    expect(cancelRes.status).toBe(200);
    expect(await cancelRes.json()).toEqual({ jobId: submitBody.jobId, cancelRequested: true });

    const reportRes = await app.request("/report");
    expect(reportRes.status).toBe(200);
    const reportBody = await reportRes.json();
    expect(reportBody).toEqual([{ jobId: submitBody.jobId, state: "queued", submittedAt: expect.any(String) }]);
  });

  it("returns 400 for a malformed JSON submit body instead of silently defaulting to empty params", async () => {
    const { client, ow } = await makeClient();
    const app = await client.router("my-package/my-worker");

    const res = await app.request("/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not valid json",
    });

    expect(res.status).toBe(400);
    expect(ow.invocations).toEqual([]);
  });
});
