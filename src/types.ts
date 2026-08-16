export type JobStatus = "running" | "succeeded" | "failed";

export interface JobRecord {
  status: JobStatus;
  startedAt: string;
  updatedAt: string;
  maxDurationMs: number;
  result?: unknown;
  error?: { message: string; code?: string };
}

export interface CancelFlag {
  cancelRequested: true;
  requestedAt: string;
}

export interface TimingFields {
  submittedAt?: string;
  startedAt?: string;
  updatedAt?: string;
  queuedMs?: number;
  elapsedMs?: number;
  stale?: boolean;
}

export type JobStatusResponse =
  | ({ jobId: string; state: "not-found" })
  | ({ jobId: string; state: "queued" } & Pick<TimingFields, "submittedAt">)
  | ({
      jobId: string;
      state: JobStatus;
      result?: unknown;
      error?: { message: string; code?: string };
    } & TimingFields);

/** Reserved, namespaced params merged into the worker's invoke payload alongside the caller's own params. */
export interface ReservedWorkerParams {
  __aio_lib_jobs?: {
    maxDurationMs?: number;
  };
}
