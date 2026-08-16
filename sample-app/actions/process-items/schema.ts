import { z } from "zod";

/** Shared between the submit action and the worker action - they're independent bundles with no other link between them. */
export const ProcessItemsSchema = z.object({
  items: z.array(z.string()).min(1),
});

export type ProcessItemsParams = z.infer<typeof ProcessItemsSchema>;

export interface ProcessItemsResult {
  processed: number;
}
