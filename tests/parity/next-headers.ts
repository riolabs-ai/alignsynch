/**
 * `next/headers`, for the parity render — the fourth module a node render cannot have.
 *
 * `lib/auth/server.ts` imports `@neon/auth/next/server`, whose entry imports `next/headers`.
 * That import only resolves inside a Next build (`next/headers` has no plain-node entry), so
 * without this alias the parity suite cannot even *collect* the page modules it renders — and
 * it is the only suite in the repo that renders pages, which is why the alias lives in
 * `vitest.parity.mts` rather than in the shared config.
 *
 * There is no request in a node render, so these answer the request that has none: no headers,
 * no cookies, no draft mode. That is exactly what an anonymous request to `/profile/[username]`
 * is, which is the surface the snapshot pins; a signed-in variant is a different URL, not a
 * different brand, and `tests/profile-handle.test.ts` covers the session-aware path.
 *
 * They throw on write, so a future render that tries to *set* a cookie fails loudly here instead
 * of silently snapshotting a session that does not exist.
 */
export async function headers(): Promise<Headers> {
  return new Headers();
}

export type RequestCookies = {
  get: (name: string) => undefined;
  getAll: () => [];
  has: (name: string) => boolean;
  set: () => never;
  delete: () => never;
  toString: () => string;
};

export async function cookies(): Promise<RequestCookies> {
  return {
    get: () => undefined,
    getAll: () => [],
    has: () => false,
    set: () => {
      throw new Error(
        "parity renders are anonymous and read-only: a render that sets a cookie cannot be snapshotted",
      );
    },
    delete: () => {
      throw new Error(
        "parity renders are anonymous and read-only: a render that deletes a cookie cannot be snapshotted",
      );
    },
    toString: () => "",
  };
}

export async function draftMode(): Promise<{
  isEnabled: boolean;
  enable: () => never;
  disable: () => never;
}> {
  return {
    isEnabled: false,
    enable: () => {
      throw new Error("parity renders are anonymous: draft mode cannot be enabled");
    },
    disable: () => {
      throw new Error("parity renders are anonymous: draft mode cannot be disabled");
    },
  };
}
