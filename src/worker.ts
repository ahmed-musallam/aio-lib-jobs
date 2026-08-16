import { decodeCancelFlag, encodeJobRecord } from "./codec.js";
import { JobsLibError } from "./errors.js";
import { buildJobId, deriveActionPrefix } from "./job-id.js";
import { cancelKey, mainKey } from "./keys.js";
import type { StateClient } from "./state-client.js";
import type { JobRecord, ReservedWorkerParams } from "./types.js";

/** OpenWhisk's own ceiling on non-blocking action duration (180 minutes). */
export const DEFAULT_MAX_DURATION_MS = 180 * 60 * 1000;

export interface WorkerContext<TParams> {
  jobId: string;
  params: TParams;
  /** Best-effort check of the cooperative cancellation flag - never forces a stop. */
  isCancelled(): Promise<boolean>;
}

export interface RunWorkerConfig {
  state: StateClient;
  /** Defaults to `process.env.__OW_ACTIVATION_ID`. Override only for tests. */
  activationId?: string;
  /** Defaults to `process.env.__OW_ACTION_NAME`. Override only for tests. */
  actionName?: string;
  defaultMaxDurationMs?: number;
  /** Injectable clock for tests. */
  now?: () => Date;
}

export interface WorkerOutcome<TResult> {
  jobId: string;
  status: "succeeded";
  result: TResult;
}

/**
 * Wraps a job function so it becomes a worker action: derives the jobId
 * from its own activation identity, writes `running` before the job starts
 * and `succeeded`/`failed` after it settles, and rethrows so the underlying
 * OpenWhisk activation itself is still visible as failed to platform
 * tooling (e.g. `aio rt activation get`) even though state also recorded it.
 */
export function runWorker<
  TParams extends Record<string, unknown> = Record<string, unknown>,
  TResult = unknown,
>(
  handler: (ctx: WorkerContext<TParams>) => Promise<TResult>,
  config: RunWorkerConfig,
) {
  return async (
    rawParams: TParams & ReservedWorkerParams,
  ): Promise<WorkerOutcome<TResult>> => {
    const activationId = config.activationId ?? process.env.__OW_ACTIVATION_ID;
    const actionName = config.actionName ?? process.env.__OW_ACTION_NAME;
    if (!activationId || !actionName) {
      throw new JobsLibError(
        "ERROR_BAD_ARGUMENT",
        "runWorker requires __OW_ACTIVATION_ID and __OW_ACTION_NAME in the environment (or explicit activationId/actionName in config, for tests)",
      );
    }

    const now = config.now ?? (() => new Date());
    const jobId = buildJobId(deriveActionPrefix(actionName), activationId);
    const maxDurationMs =
      rawParams.__aio_lib_jobs?.maxDurationMs ??
      config.defaultMaxDurationMs ??
      DEFAULT_MAX_DURATION_MS;

    const startedAt = now().toISOString();
    const writeTerminal = (fields: Pick<JobRecord, "status" | "result" | "error">) =>
      config.state.put(
        mainKey(jobId),
        encodeJobRecord({
          startedAt,
          updatedAt: now().toISOString(),
          maxDurationMs,
          ...fields,
        }),
      );

    await config.state.put(
      mainKey(jobId),
      encodeJobRecord({ status: "running", startedAt, updatedAt: startedAt, maxDurationMs }),
    );

    const { __aio_lib_jobs: _reserved, ...params } = rawParams;

    const ctx: WorkerContext<TParams> = {
      jobId,
      params: params as TParams,
      isCancelled: async () => {
        const raw = await config.state.get(cancelKey(jobId));
        if (!raw) return false;
        return decodeCancelFlag(raw.value).cancelRequested === true;
      },
    };

    try {
      const result = await handler(ctx);
      await writeTerminal({ status: "succeeded", result });
      return { jobId, status: "succeeded", result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? String((err as { code: unknown }).code)
          : undefined;
      await writeTerminal({
        status: "failed",
        error: code ? { message, code } : { message },
      });
      throw err;
    }
  };
}
