import type { StateClient } from "../../src/state-client.js";

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replace(/\*/g, ".*")}$`);
}

/** In-memory stand-in for `AdobeState`, scoped to what `StateClient` uses. */
export class FakeStateClient implements StateClient {
  private readonly store = new Map<string, string>();

  async get(key: string) {
    const value = this.store.get(key);
    if (value === undefined) return undefined;
    return { value, expiration: new Date(Date.now() + 86_400_000).toISOString() };
  }

  async put(key: string, value: string): Promise<string> {
    this.store.set(key, value);
    return key;
  }

  async *list({ match }: { match: string }): AsyncGenerator<{ keys: string[] }> {
    const regex = globToRegExp(match);
    yield { keys: [...this.store.keys()].filter((key) => regex.test(key)) };
  }

  /** Test-only helper for asserting on raw stored values. */
  peek(key: string): string | undefined {
    return this.store.get(key);
  }
}
