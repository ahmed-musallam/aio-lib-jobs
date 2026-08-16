export interface OwInvokeOptions {
  name: string;
  params?: Record<string, unknown>;
  blocking?: boolean;
}

export interface OwInvokeResult {
  activationId: string;
}

/**
 * The subset of the `openwhisk` npm client we depend on - narrowed to an
 * interface (rather than the SDK's own type) so tests can inject a fake
 * instead of making real non-blocking invocations.
 */
export interface OwClient {
  actions: {
    invoke(options: OwInvokeOptions): Promise<OwInvokeResult>;
  };
}
