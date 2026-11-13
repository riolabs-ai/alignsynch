/**
 * The one write a documentation note makes: an issue on `riolabs-ai/alignsynch` (#894).
 *
 * **This module is the only reader of `GH_FEEDBACK_TOKEN`, and it is server-only by construction.**
 * The token is a fine-grained PAT with **Issues: Read and write** and nothing else (probed: a
 * `PUT /contents/…` answers 403, so it cannot touch a file), which makes it the one credential in
 * the tree that can create work in the repository. It is read here, used here and never returned,
 * logged or handed to a caller — `scripts/client-graph.ts` refuses a `"use client"` module that
 * reaches this path, because a browser copy of this token is a token anybody can file with.
 *
 * **No dependency.** The call is one `fetch` to the REST API. An Octokit client for one POST would
 * be a tree of dependencies for a call whose answer is one integer.
 *
 * **The union is the contract.** Four answers and no fifth:
 *
 *   `filed(number)`    GitHub created the issue, and this is its number
 *   `not-configured`   there is no token in this environment — the panel says so plainly
 *   `refused(status)`  GitHub answered a non-2xx: a 401/403 (the token lost its grant), a 404 (the
 *                      repo moved), a 422 (the body was refused). Nothing was filed.
 *   `failed(name)`     the call never reached an answer — a DNS error, a timeout, a socket reset
 *
 * **A non-2xx is never `filed`, and a 2xx without a number is never `filed` either.** The second
 * half is the uncomfortable one: GitHub created the issue and the body did not carry the number, so
 * the honest answer is `failed` — the note reached something, and the reader is told it did not.
 * That duplicates one issue in a case that cannot happen with the documented API; the alternative
 * would be a success panel naming `#undefined`, which is the failure this feature exists to make
 * impossible.
 *
 * **Nothing about a failure is logged but its name.** No token, no response body, no reader
 * identity: a log is copied and kept longer than a screen, and the response body of a 422 can echo
 * the payload that carried the reader's own words.
 */

/** The repository a note is filed into. One spelling, so an issue cannot land in a fork. */
export const FEEDBACK_REPO = "riolabs-ai/alignsynch";

/** The environment variable this module — and only this module — dereferences. */
export const FEEDBACK_TOKEN_ENV = "GH_FEEDBACK_TOKEN";

/** The API this module posts to. Injectable so a test never needs the network. */
export const GITHUB_API = "https://api.github.com";

/** GitHub refuses a request without one, and an empty one is refused by this module first. */
const USER_AGENT = "alignsynch-docs-feedback";

/** What an attempt to file a note answered. */
export type FeedbackResult =
  | { readonly kind: "filed"; readonly issueNumber: number }
  | { readonly kind: "not-configured" }
  | { readonly kind: "refused"; readonly status: number }
  | { readonly kind: "failed"; readonly errorName: string };

export interface FileFeedbackOptions {
  /** Passed in by a test; `process.env.GH_FEEDBACK_TOKEN` is the production path. */
  readonly token?: string;
  /** Passed in by a test; the global `fetch` is the production path. */
  readonly fetchImpl?: typeof fetch;
  /** Passed in by a test, so a probe can never reach a real GitHub API by accident. */
  readonly api?: string;
}

/** The token this deployment carries, or `""`. Trimmed: a trailing newline is a 401. */
function tokenOf(override: string | undefined): string {
  if (override !== undefined) return override.trim();
  return (process.env.GH_FEEDBACK_TOKEN ?? "").trim();
}

/** A number from a `201` body, or `null` when the body does not carry one. */
function issueNumberOf(body: unknown): number | null {
  if (typeof body !== "object" || body === null) return null;
  const number = (body as { number?: unknown }).number;
  return typeof number === "number" && Number.isInteger(number) && number > 0 ? number : null;
}

/**
 * File one issue. The caller has already validated the draft and authorised the reader; this
 * function answers only "did the repository accept it".
 */
export async function fileFeedbackIssue(
  issue: { readonly title: string; readonly body: string; readonly labels: readonly string[] },
  options: FileFeedbackOptions = {},
): Promise<FeedbackResult> {
  const token = tokenOf(options.token);
  if (token === "") return { kind: "not-configured" };

  const doFetch = options.fetchImpl ?? fetch;
  const api = options.api ?? GITHUB_API;

  let response: Response;
  try {
    response = await doFetch(`${api}/repos/${FEEDBACK_REPO}/issues`, {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "user-agent": USER_AGENT,
        "x-github-api-version": "2022-11-28",
      },
      body: JSON.stringify({
        title: issue.title,
        body: issue.body,
        labels: [...issue.labels],
      }),
      // A page render must not hang on GitHub: the reader is told the note failed, which is true.
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    console.error(`[docs-feedback] the request failed before GitHub answered (${name})`);
    return { kind: "failed", errorName: name };
  }

  if (!response.ok) {
    // The status is a property of the grant, not of the note: 401/403 lost the scope, 404 the repo
    // moved, 422 the body was refused. The body is deliberately not read — it can echo the note.
    console.error(`[docs-feedback] GitHub refused the issue (${response.status})`);
    return { kind: "refused", status: response.status };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    console.error("[docs-feedback] GitHub accepted the issue but answered no readable body");
    return { kind: "failed", errorName: "UnreadableResponse" };
  }

  const issueNumber = issueNumberOf(body);
  if (issueNumber === null) {
    console.error("[docs-feedback] GitHub accepted the issue but answered no number");
    return { kind: "failed", errorName: "MissingIssueNumber" };
  }

  return { kind: "filed", issueNumber };
}
