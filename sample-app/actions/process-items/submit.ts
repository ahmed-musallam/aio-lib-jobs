import { Hono } from "hono/quick";
import { ToOpenWhiskAction } from "hono-openwhisk-adapter";
import { init, type JobsClient } from "aio-lib-jobs";
import { ProcessItemsSchema } from "./schema";

const WORKER_ACTION = "aio-lib-jobs-sample/worker";

// Lazily initialized (not top-level await) so this works regardless of
// whether the bundle ends up CommonJS or ESM.
let jobsPromise: Promise<JobsClient> | undefined;
function getJobs(): Promise<JobsClient> {
  if (!jobsPromise) jobsPromise = init();
  return jobsPromise;
}

const app = new Hono();

// Hand-wired (not `jobs.router()`) so the payload can be validated before
// invoking the worker - see aio-lib-jobs' README "Validating job params".
app.post("/submit", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }
  const parsed = ProcessItemsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  const jobs = await getJobs();
  const result = await jobs.submit(WORKER_ACTION, parsed.data);
  return c.json(result, 202);
});

app.get("/status/:jobId", async (c) => {
  const jobs = await getJobs();
  return c.json(await jobs.getStatus(c.req.param("jobId")));
});

app.post("/cancel/:jobId", async (c) => {
  const jobs = await getJobs();
  const jobId = c.req.param("jobId");
  await jobs.cancel(jobId);
  return c.json({ jobId, cancelRequested: true });
});

app.get("/report", async (c) => {
  const jobs = await getJobs();
  return c.json(await jobs.report(WORKER_ACTION));
});

export const main = ToOpenWhiskAction(app);
