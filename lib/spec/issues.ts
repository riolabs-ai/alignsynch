/**
 * The spec register's GitHub half — the model (#1296).
 *
 * **Owner decision, 2026-11-19: "let forget in app editing and do gh".** The register stays
 * read-only in the app, GitHub becomes the editable layer, and this dash *pulls* what GitHub says.
 * The 28 open rows of the v2.0 release were filed as issues #1268–#1295, labelled `spec`,
 * `tier/R1|R2|Later` and an `area/*`; the issue is where a reviewer marks a row reviewed or
 * approved, and this module is how that judgement reaches the page.
 *
 * **The marker is the key, never a title and never a label.** Every filed body carries an HTML
 * comment — `<!-- spec-row:APP-05 -->` — naming the register row it belongs to, so a row renamed
 * or retitled in GitHub still lands on the same row here. A body without one is **skipped and
 * counted** (`skipped` on the read), never guessed at from its text: a heuristic that reads a title
 * is a parser this repo has already been burned by, and it fails silently on the day someone edits
 * a title.
 *
 * **Nothing here fetches, reads a file or knows a token.** This module is the shape and the mapping
 * — the payload in, the index out — so `tests/spec-issues.test.ts` drives every branch (a marker
 * that is there, one that is not, a duplicate, a pull request, a label that decides a pill) without
 * a network, a cache or a clock. The fetch, the cache and the token are `lib/spec/issues-github.ts`,
 * a server module; the page only ever sees what this module returns.
 *
 * **The two pills are labels, and a missing issue is not a "no".** `spec:reviewed` and
 * `spec:approved` are read off the issue's labels, so the reviewer's control is a label toggle in
 * GitHub and there is no write path here at all (AS-15). An issue that carries neither label reads
 * `false` — a real answer — while a register row with **no issue** reads `null` and the page draws
 * an em dash: "nobody filed this" and "filed and not yet reviewed" are different facts.
 */

/** The repository the rows are filed in. One spelling, so a query cannot land on a fork. */
export const SPEC_ISSUES_REPO = "riolabs-ai/alignsynch-web";

/** The collection a row's issue lives at — `GET …/issues?labels=spec&state=all&per_page=100`. */
export const SPEC_ISSUES_API = `https://api.github.com/repos/${SPEC_ISSUES_REPO}/issues`;

/** The label the whole register shares. A row issue without it is not part of the pull. */
export const SPEC_ISSUES_LABEL = "spec";

/**
 * One call, the whole set. `state=all` because a closed row is a delivered row and the register
 * still draws its line; `per_page=100` because the register is 88 rows and the release filed 28 —
 * a second page would be a silent truncation, so the read refuses a full page instead.
 */
export const SPEC_ISSUES_QUERY = `labels=${SPEC_ISSUES_LABEL}&state=all&per_page=100`;

/** The marker, exactly as the filed bodies carry it: `<!-- spec-row:WEB-06 -->`. */
export const SPEC_ROW_MARKER = /<!--\s*spec-row:\s*([A-Za-z0-9._-]+)\s*-->/;

/** The label a reviewer sets to mark a row reviewed. Read-only here: nothing toggles it. */
export const SPEC_REVIEWED_LABEL = "spec:reviewed";

/** The label that marks a row approved. Read-only here, for the same reason. */
export const SPEC_APPROVED_LABEL = "spec:approved";

/** The release tier rides the label's prefix: `tier/R1`, `tier/R2`, `tier/Later`. */
export const SPEC_TIER_PREFIX = "tier/";

/** One register row's issue, as the page needs it — five facts and the link. */
export interface SpecIssue {
  /** The register row this issue claims, from the body's marker. */
  readonly rowId: string;
  /** The issue number, which is also the link's text. */
  readonly number: number;
  readonly state: "open" | "closed";
  /** The HTML address, built here so the page never composes a URL. */
  readonly url: string;
  /** The milestone's title, or `null` when the issue carries none. */
  readonly milestone: string | null;
  /** The full tier label (`tier/R1`), or `null` when the issue carries none. */
  readonly tier: string | null;
  /** `spec:reviewed` is on the issue. A real answer, and the pill the reviewer set. */
  readonly reviewed: boolean;
  /** `spec:approved` is on the issue. */
  readonly approved: boolean;
}

/** The mapped set, keyed by register row. A row with no issue is simply absent. */
export type SpecIssueIndex = Readonly<Record<string, SpecIssue>>;

/** The read succeeded: `count` rows mapped, `skipped` entries that became no row. */
export interface SpecIssuesReady {
  readonly kind: "ready";
  readonly issues: SpecIssueIndex;
  /** How many entries became a row. Derived, never typed — a 29th issue needs no code change. */
  readonly count: number;
  /** Entries that did not: no marker, a repeated marker, or a shape that would not read. */
  readonly skipped: number;
  /** True when GitHub could not be reached and this is the last copy the server read. */
  readonly stale?: true;
}

/** Why a read has no rows: no grant answered, a refusal, or a call that never landed. */
export type SpecIssuesReason = "refused" | "failed" | "unreadable";

/** The read produced no set. The register still renders — without the GitHub column. */
export interface SpecIssuesUnavailable {
  readonly kind: "unavailable";
  readonly reason: SpecIssuesReason;
  /** The HTTP status, when GitHub answered one. Never a body: a body can echo a payload. */
  readonly status?: number;
}

/** What a read answered. Four shapes and no fifth. */
export type SpecIssuesRead = SpecIssuesReady | SpecIssuesUnavailable;

/* ------------------------------------------------------------------ *
 * The mapping — pure, and every unknown is a skipped entry
 * ------------------------------------------------------------------ */

/** A label arrives as `{ name }`; anything else is not a label this module can read. */
function labelNames(entry: Record<string, unknown>): string[] {
  const labels = entry.labels;
  if (!Array.isArray(labels)) return [];
  const names: string[] = [];
  for (const label of labels) {
    if (typeof label !== "object" || label === null) continue;
    const name = (label as { name?: unknown }).name;
    if (typeof name === "string" && name.trim() !== "") names.push(name.trim());
  }
  return names;
}

/** The milestone's title, or `null` — GitHub sends `null`, an object, or something unexpected. */
function milestoneOf(entry: Record<string, unknown>): string | null {
  const milestone = entry.milestone;
  if (typeof milestone !== "object" || milestone === null) return null;
  const title = (milestone as { title?: unknown }).title;
  return typeof title === "string" && title.trim() !== "" ? title.trim() : null;
}

/** The first `tier/*` label, as written on the issue. The prefix is the register's vocabulary. */
function tierOf(labels: readonly string[]): string | null {
  return labels.find((label) => label.startsWith(SPEC_TIER_PREFIX)) ?? null;
}

/** The register row a body claims, or `null` — a body with no marker is not a row. */
export function specRowMarkerOf(body: unknown): string | null {
  if (typeof body !== "string") return null;
  const match = SPEC_ROW_MARKER.exec(body);
  return match === null ? null : match[1];
}

/**
 * One entry from GitHub's issue collection, as a row — or `null` when it is not one.
 *
 * `null` covers the four shapes that are not a row and are all counted by the caller: a pull
 * request (GitHub serves both from `/issues`), a body with no marker, a repeated marker, and an
 * entry with no number. Nothing is invented to fill a gap: a row this cannot read is not drawn.
 */
export function specIssueOf(raw: unknown): SpecIssue | null {
  if (typeof raw !== "object" || raw === null) return null;
  const entry = raw as Record<string, unknown>;
  // `/issues` carries pull requests too. A PR is not a register row, whatever its labels say.
  if (entry.pull_request !== undefined) return null;

  const number = entry.number;
  if (typeof number !== "number" || !Number.isInteger(number) || number <= 0) return null;

  const rowId = specRowMarkerOf(entry.body);
  if (rowId === null) return null;

  const state = entry.state;
  if (state !== "open" && state !== "closed") return null;

  const labels = labelNames(entry);
  const htmlUrl = entry.html_url;
  const url =
    typeof htmlUrl === "string" && htmlUrl.startsWith("https://")
      ? htmlUrl
      : `https://github.com/${SPEC_ISSUES_REPO}/issues/${number}`;

  return {
    rowId,
    number,
    state,
    url,
    milestone: milestoneOf(entry),
    tier: tierOf(labels),
    reviewed: labels.includes(SPEC_REVIEWED_LABEL),
    approved: labels.includes(SPEC_APPROVED_LABEL),
  };
}

/**
 * The whole set, from one GitHub answer.
 *
 * `null` means the payload is not a collection at all — an error object, an HTML page, a proxy's
 * 200. The caller treats that as `unavailable`: an answer this module cannot read is not an empty
 * register, and rendering it as one would blank 88 rows of evidence over a bad response.
 *
 * A **full page** (`length === per_page`) is refused for the same reason: the register may be 88
 * rows and the pull is one call, so a truncated set would silently drop rows rather than say so.
 */
export function specIssuesOf(payload: unknown): SpecIssuesReady | null {
  if (!Array.isArray(payload)) return null;

  const issues: Record<string, SpecIssue> = {};
  let count = 0;
  let skipped = 0;

  for (const entry of payload) {
    const issue = specIssueOf(entry);
    if (issue === null) {
      skipped += 1;
      continue;
    }
    // The oldest issue wins, and a second one claiming the same row is counted rather than
    // overwriting: GitHub answers oldest-first, so "the first filed" is the row's own issue.
    if (issues[issue.rowId] !== undefined) {
      skipped += 1;
      continue;
    }
    issues[issue.rowId] = issue;
    count += 1;
  }

  return { kind: "ready", issues, count, skipped };
}

/**
 * One row's issue, or `null` when the row was never filed.
 *
 * `null` is the em dash: not reviewed and not approved are answers, and "there is no issue" is
 * the absence of one. A caller must never spell the second as `false`.
 */
export function specIssueFor(read: SpecIssuesRead | null, rowId: string): SpecIssue | null {
  if (read === null || read.kind !== "ready") return null;
  return read.issues[rowId] ?? null;
}

/**
 * Fresh answer, or the last copy the server read — never an empty set.
 *
 * This is the whole degradation policy as a pure function: a live read wins; a failed read is
 * answered with `lastGood` marked `stale` (the column still draws, and the page says it is a
 * copy); and with nothing to fall back on the failure itself is returned, which the page turns
 * into "no column, and here is why". Extracted so the three branches are testable without a
 * network — the fetch module holds no policy of its own.
 */
export function specIssuesAnswerOf(
  fresh: SpecIssuesRead,
  lastGood: SpecIssuesReady | null,
): SpecIssuesRead {
  if (fresh.kind === "ready") return fresh;
  if (lastGood === null) return fresh;
  return { ...lastGood, stale: true };
}
