import { init as initState } from "@adobe/aio-lib-state";
import { runWorker } from "aio-lib-jobs";
import { ProcessItemsSchema, type ProcessItemsResult } from "./schema";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * `runWorker` needs a resolved `StateClient`, and `main` may run in a
 * CommonJS bundle where top-level await isn't available - so `state` is
 * awaited inside an async `main` instead of at module scope.
 */
export async function main(params: Record<string, unknown>): Promise<unknown> {
  const state = await initState();

  return runWorker<Record<string, unknown>, ProcessItemsResult>(async (ctx) => {
    const { items } = ProcessItemsSchema.parse(ctx.params);
    let processed = 0;

    for (const item of items) {
      if (await ctx.isCancelled()) break; // cooperative - opts in to stopping early
      console.log(`processing item "${item}"`);
      await delay(1_000 + Math.random() * 4_000); // stand-in for a slow downstream call
      processed++;
    }

    return { processed };
  }, { state })(params);
}
