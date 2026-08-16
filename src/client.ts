import { decodeJobRecord, encodeCancelFlag } from "./codec.js";
import { JobsLibError } from "./errors.js";
import { buildJobId, deriveActionPrefix } from "./job-id.js";
import {
  cancelKey,
  jobIdFromKey,
  mainKey,
  reportMatchPattern,
  submittedAtKey,
} from "./keys.js";
import type { OwClient } from "./ow-client.js";
import type { StateClient } from "./state-client.js";
import { computeTiming } from "./timing.js";
import type { JobStatusResponse, ReservedWorkerParams } from "./types.js";
import { buildActionBaseUrl, buildCancelUrl, buildStatusUrl } from "./urls.js";

export interface InitConfig {
  /** Injectable for tests; otherwise built from `stateInit` via `@adobe/aio-lib-state`. */
  state?: StateClient;
  /** Injectable for tests; otherwise built from `owInit` via `openwhisk`. */
  ow?: OwClient;
  /** Forwarded to `@adobe/aio-lib-state`'s own `init()` when `state` isn't injected. */
  stateInit?: Record<string, unknown>;
  /** Forwarded to the `openwhisk` factory when `ow` isn't injected. */
  owInit?: Record<string, unknown>;
  /** Defaults to `process.env.__OW_NAMESPACE`. Needed by submit()/report() to fully-qualify worker action names. */
  namespace?: string;
  /** Defaults to `process.env.__OW_ACTION_NAME` - this submit/poll action's own name, for building statusUrl/cancelUrl. */
  selfActionName?: string;
  now?: () => Date;
}

export interface SubmitResult {
  jobId: string;
  statusUrl: string;
  cancelUrl: string;
}

export interface SubmitOptions {
  maxDurationMs?: number;
}

export interface JobsClient {
  submit(
    workerActionName: string,
    params: Record<string, unknown>,
    opts?: SubmitOptions,
  ): Promise<SubmitResult>;
  getStatus(jobId: string): Promise<JobStatusResponse>;
  cancel(jobId: string): Promise<void>;
  report(workerActionName: string): Promise<JobStatusResponse[]>;
  /** Returns a composable `Hono` sub-router - mount it, don't call `ToOpenWhiskAction` on it yourself. */
  router(workerActionName: string): Promise<import("hono").Hono>;
}

function fullyQualify(actionName: string, namespace: string): string {
  return `/${namespace}/${actionName.replace(/^\/+/, "")}`;
}

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new JobsLibError(
      "ERROR_BAD_ARGUMENT",
      `missing ${name} - set it in the action's environment or pass it explicitly to init()`,
    );
  }
  return value;
}

export async function init(config: InitConfig = {}): Promise<JobsClient> {
  const state =
    config.state ??
    (await (async () => {
      const mod = await import("@adobe/aio-lib-state");
      return mod.init(config.stateInit);
    })());

  const ow =
    config.ow ??
    (await (async () => {
      const mod = await import("openwhisk");
      const factory = (mod as unknown as { default?: (opts?: unknown) => OwClient }).default ??
        (mod as unknown as (opts?: unknown) => OwClient);
      return factory(config.owInit);
    })());

  const namespace = config.namespace ?? process.env.__OW_NAMESPACE;
  const selfActionName = config.selfActionName ?? process.env.__OW_ACTION_NAME;
  const now = config.now ?? (() => new Date());

  async function submit(
    workerActionName: string,
    params: Record<string, unknown>,
    opts?: SubmitOptions,
  ): Promise<SubmitResult> {
    const ns = required(namespace, "__OW_NAMESPACE");
    const selfName = required(selfActionName, "__OW_ACTION_NAME");

    if ("__aio_lib_jobs" in params) {
      throw new JobsLibError(
        "ERROR_BAD_ARGUMENT",
        "params must not contain the reserved key '__aio_lib_jobs'",
      );
    }

    const fqWorkerName = fullyQualify(workerActionName, ns);
    const invokeParams: Record<string, unknown> & ReservedWorkerParams = {
      ...params,
    };
    if (opts?.maxDurationMs !== undefined) {
      invokeParams.__aio_lib_jobs = { maxDurationMs: opts.maxDurationMs };
    }

    const { activationId } = await ow.actions.invoke({
      name: fqWorkerName,
      params: invokeParams,
      blocking: false,
    });

    const jobId = buildJobId(deriveActionPrefix(fqWorkerName), activationId);
    await state.put(submittedAtKey(jobId), now().toISOString());

    const base = buildActionBaseUrl({ actionName: selfName });
    return {
      jobId,
      statusUrl: buildStatusUrl(base, jobId),
      cancelUrl: buildCancelUrl(base, jobId),
    };
  }

  async function getStatus(jobId: string): Promise<JobStatusResponse> {
    const [mainRaw, submittedRaw] = await Promise.all([
      state.get(mainKey(jobId)),
      state.get(submittedAtKey(jobId)),
    ]);

    if (!mainRaw) {
      if (submittedRaw) {
        return { jobId, state: "queued", submittedAt: submittedRaw.value };
      }
      return { jobId, state: "not-found" };
    }

    const record = decodeJobRecord(mainRaw.value);
    const timing = computeTiming({
      status: record.status,
      submittedAt: submittedRaw?.value,
      startedAt: record.startedAt,
      updatedAt: record.updatedAt,
      maxDurationMs: record.maxDurationMs,
      now: now(),
    });

    return {
      jobId,
      state: record.status,
      result: record.result,
      error: record.error,
      ...timing,
    };
  }

  async function cancel(jobId: string): Promise<void> {
    await state.put(
      cancelKey(jobId),
      encodeCancelFlag({ cancelRequested: true, requestedAt: now().toISOString() }),
    );
  }

  async function report(workerActionName: string): Promise<JobStatusResponse[]> {
    const ns = required(namespace, "__OW_NAMESPACE");
    const prefix = deriveActionPrefix(fullyQualify(workerActionName, ns));

    const jobIds = new Set<string>();
    for await (const { keys } of state.list({ match: reportMatchPattern(prefix) })) {
      for (const key of keys) jobIds.add(jobIdFromKey(key));
    }
    return Promise.all([...jobIds].map((jobId) => getStatus(jobId)));
  }

  async function router(workerActionName: string) {
    const { Hono } = await import("hono");
    const app = new Hono();

    app.post("/submit", async (c) => {
      let params: Record<string, unknown>;
      try {
        params = await c.req.json<Record<string, unknown>>();
      } catch {
        return c.json({ error: "invalid JSON body" }, 400);
      }
      const result = await submit(workerActionName, params);
      return c.json(result, 202);
    });

    app.get("/status/:jobId", async (c) => {
      const result = await getStatus(c.req.param("jobId"));
      return c.json(result);
    });

    app.post("/cancel/:jobId", async (c) => {
      const jobId = c.req.param("jobId");
      await cancel(jobId);
      return c.json({ jobId, cancelRequested: true });
    });

    app.get("/report", async (c) => {
      const result = await report(workerActionName);
      return c.json(result);
    });

    return app;
  }

  return { submit, getStatus, cancel, report, router };
}
