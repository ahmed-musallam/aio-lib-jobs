export interface StateGetResult {
  value: string;
  expiration: string;
}

/**
 * The subset of `@adobe/aio-lib-state`'s `AdobeState` we depend on. Kept as
 * a narrow interface (rather than importing the SDK's own class type) so
 * tests can inject an in-memory fake instead of hitting real state.
 */
export interface StateClient {
  get(key: string): Promise<StateGetResult | undefined>;
  put(key: string, value: string): Promise<string>;
  list(options: { match: string }): AsyncGenerator<{ keys: string[] }>;
}
