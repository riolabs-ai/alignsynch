/**
 * The spec register's one call to GitHub — server-only, injectable, and honest when GitHub is not
 * there (#1296).
 *
 * **One request, the whole set.** `GET /repos/riolabs-ai/alignsynch-web/issues?labels=spec&state=all
 * &per_page=100` answers every filed row at once; the marker in each body is what decides which
 * register row it is (`lib/spec/issues.ts` maps it). Nothing here throttles, retries or pages: a
 * second request in one render is the cache's job (`lib/spec/issues-cache.ts`), and a read this
 * module cannot complete is answered as a degradation rather than as an empty set.
 *
 * **The token.** `GH_FEEDBACK_TOKEN` is the tree's existing fine-grained grant and this is its
 * second reader — `lib/docs/feedback-github.ts` is the first. Here it is a **read** of a public
 * repository, and it is never returned, logged or handed to a component: `scripts/client-graph.ts`
 * refuses a client module that reaches this file's imports, and no caller of `fetchSpecIssues` sees
 * anything but the mapped set. Without a token the request goes out **anonymous**, which is a
 * supported answer for a public repository. With a token that GitHub *refuses*, the read degrades
 * instead of retrying anonymously: a grant that has lost its scope is a deployment fault, and
 * spending the anonymous quota to hide it would report "fine" for a configuration nobody checked.
 *
 * **Nothing about a failure is logged but its kind and its status.** No token, no response body, no
 * reader identity: a response body is the one thing this call could carry back, and a log is copied
 * and kept longer than a screen.
 *
 * **No Next, no cache, no clock.** The import here is `./issues` and nothing else, so
 * `tests/spec-issues.test.ts` drives every branch — a 403, a timeout, a body that is not a
 * collection, a token sent and a token absent — against an injected `fetch`, and no probe can reach
 * the real API by accident.
 */
import { SPEC_ISSUES_API, SPEC_ISSUES_QUERY, specIssuesOf, type SpecIssuesRead } from "./issues";

/** GitHub is not allowed to hold a page render: the call answers or the read degrades. */
export const SPEC_ISSUES_TIMEOUT_MS = 8_000;

/** The environment variable holding the read grant, if the deployment has one. */
export const SPEC_ISSUES_TOKEN_ENV = "GH_FEEDBACK_TOKEN";

/** GitHub refuses a request without one. */
const USER_AGENT = "alignsynch-spec-register";

/** Everything a test needs to replace, so no probe reaches the real API by accident. */
export interface SpecIssuesFetchOptions {
  /** Passed in by a test; `process.env.GH_FEEDBACK_TOKEN` is the production path. */
  readonly token?: string;
  /** Passed in by a test; the global `fetch` is the production path. */
  readonly fetchImpl?: typeof fetch;
  /** Passed in by a test; the GitHub API root is the production path. */
  readonly api?: string;
  /** Passed in by a test, so a timeout can be exercised without waiting eight seconds. */
  readonly timeoutMs?: number;
}

/** The token this deployment carries, or `""`. Trimmed: a trailing newline is a 401. */
function tokenOf(override: string | undefined): string {
  if (override !== undefined) return override.trim();
  return (process.env[SPEC_ISSUES_TOKEN_ENV] ?? "").trim();
}

/** The headers one read sends. `authorization` is present only when there is a token. */
export function specIssuesHeaders(token: string): Record<string, string> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": USER_AGENT,
    "x-github-api-version": "2022-11-28",
  };
  // Only when there is one: an empty `Bearer ` is a 401, and an anonymous read of a public
  // repository is a supported answer.
  if (token !== "") headers.authorization = `Bearer ${token}`;
  return headers;
}

/**
 * One attempt. Never throws and never returns an empty set: the caller gets the rows it could map,
 * or the reason it could not.
 */
export async function fetchSpecIssues(
  options: SpecIssuesFetchOptions = {},
): Promise<SpecIssuesRead> {
  const token = tokenOf(options.token);
  const doFetch = options.fetchImpl ?? fetch;
  const api = options.api ?? SPEC_ISSUES_API;

  let response: Response;
  try {
    response = await doFetch(`${api}?${SPEC_ISSUES_QUERY}`, {
      method: "GET",
      headers: specIssuesHeaders(token),
      cache: "no-store",
      signal: AbortSignal.timeout(options.timeoutMs ?? SPEC_ISSUES_TIMEOUT_MS),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    console.error(`[spec-issues] the request failed before GitHub answered (${name})`);
    return { kind: "unavailable", reason: "failed" };
  }

  if (!response.ok) {
    // The status is a property of the grant or of the quota, not of the register: 401/403 is the
    // token or the rate limit, 404 the repository moved. The body is not read — it says nothing a
    // reader can act on, and a body is the one thing here that could carry a payload back.
    console.error(`[spec-issues] GitHub refused the read (${response.status})`);
    return { kind: "unavailable", reason: "refused", status: response.status };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    console.error("[spec-issues] GitHub answered a body this module could not parse");
    return { kind: "unavailable", reason: "unreadable" };
  }

  const mapped = specIssuesOf(payload);
  if (mapped === null) {
    console.error("[spec-issues] GitHub answered something that is not an issue collection");
    return { kind: "unavailable", reason: "unreadable" };
  }
  return mapped;
}
