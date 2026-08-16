import type { OwClient, OwInvokeOptions } from "../../src/ow-client.js";

export class FakeOwClient implements OwClient {
  public readonly invocations: OwInvokeOptions[] = [];

  constructor(private readonly activationId: string) {}

  actions = {
    invoke: async (options: OwInvokeOptions) => {
      this.invocations.push(options);
      return { activationId: this.activationId };
    },
  };
}
