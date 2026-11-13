/**
 * A note about a page of the documentation — the pure half (#894).
 *
 * Three jobs, and none of them touches the network, the filesystem or the environment, so the
 * route (which does) and the panel (which is a browser module) share the rules instead of each
 * carrying a copy:
 *
 *   `readFeedbackDraft()`     what the reader sent, or the one reason it is not acceptable. The
 *                             path is judged against **the manifest's own paths**, passed in rather
 *                             than read here: `lib/docs/tree.ts` is the only module that reads
 *                             `docs/docs.json`, and a schema in this module would put zod in the
 *                             panel's bundle.
 *   `composeFeedbackIssue()`  the title, the body and the labels of the issue it becomes. The body
 *                             carries the doc path, the heading the reader was looking at and the
 *                             build version, because the issue is the record — there is no table.
 *   `feedbackNoticeOf()`      what the panel says, per answer. Kept here so it is a test, not a
 *                             branch inside a component: the one rule this feature is accepted on
 *                             is that a note which reached nothing never draws a thank-you.
 *
 * **The kind is the label.** Two kinds, and each names an existing repository label
 * (`documentation` / `enhancement`). The set is closed on purpose — a card may not create a label,
 * so a kind without a label would be an issue filed into no queue.
 *
 * **A heading is evidence, not a field.** It is read off the page (`activeHeadingOf`) and echoed
 * into the body; it is never something the reader types, so it is bounded and trimmed rather than
 * validated into a refusal.
 */

/** The two problems a reader can report. Each maps to a label that already exists. */
export const FEEDBACK_KINDS = ["correction", "missing"] as const;

export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

/** The GitHub label each kind files under. Never invented at run time — both exist in the repo. */
export const FEEDBACK_LABEL_OF: Record<FeedbackKind, string> = {
  correction: "documentation",
  missing: "enhancement",
};

/** The word the title and the body use for a kind. A model value, not reader copy. */
const KIND_WORD: Record<FeedbackKind, string> = {
  correction: "Correction",
  missing: "Missing content",
};

/** A note is useless if it is one word and unreadable if it is an essay. */
export const FEEDBACK_MESSAGE_MIN = 10;
export const FEEDBACK_MESSAGE_MAX = 2000;

/** The echoed heading is bounded: it is a sentence off the page, not a payload. */
export const FEEDBACK_HEADING_MAX = 200;

/** A `docs/`-relative path is short by construction; the bound is a guard, not a rule. */
export const FEEDBACK_PATH_MAX = 400;

/** What the reader sent, after the rules have passed. */
export interface FeedbackDraft {
  readonly kind: FeedbackKind;
  readonly path: string;
  readonly heading: string;
  readonly message: string;
}

/** Why a note was refused. The panel turns each into its own sentence. */
export type FeedbackRefusal = "kind" | "path" | "message";

export type FeedbackCheck =
  | { readonly ok: true; readonly draft: FeedbackDraft }
  | { readonly ok: false; readonly reason: FeedbackRefusal };

/** The issue a draft becomes: what GitHub is asked to create. */
export interface FeedbackIssue {
  readonly title: string;
  readonly body: string;
  readonly labels: readonly string[];
}

/** Is this one of the two kinds? A request is JSON, so nothing about its shape is trusted. */
export function isFeedbackKind(value: unknown): value is FeedbackKind {
  return typeof value === "string" && (FEEDBACK_KINDS as readonly string[]).includes(value);
}

/** Trim a string field, or `""` when it is not a string at all. */
function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * The draft a request carries, or the first reason it cannot be one.
 *
 * `knownPaths` is the manifest's own set — a note about a page that does not exist is a note
 * nobody can act on, and accepting it would let a caller name any string as a document (including
 * `../` shapes) in an issue that looks authoritative. The order of the refusals is the order the
 * form draws its fields, so the panel names the field the reader is looking at.
 */
export function readFeedbackDraft(raw: unknown, knownPaths: ReadonlySet<string>): FeedbackCheck {
  const body = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};

  const kind = body.kind;
  if (!isFeedbackKind(kind)) return { ok: false, reason: "kind" };

  const path = textOf(body.path);
  if (path === "" || path.length > FEEDBACK_PATH_MAX || !knownPaths.has(path)) {
    return { ok: false, reason: "path" };
  }

  const message = textOf(body.message);
  if (message.length < FEEDBACK_MESSAGE_MIN || message.length > FEEDBACK_MESSAGE_MAX) {
    return { ok: false, reason: "message" };
  }

  return { ok: true, draft: { kind, path, heading: headingOf(body.heading), message } };
}

/** The heading as the body may carry it: one line, collapsed, bounded. */
export function headingOf(value: unknown): string {
  return textOf(value).replace(/\s+/g, " ").slice(0, FEEDBACK_HEADING_MAX);
}

/** A title GitHub will keep as one line: no newline, bounded length. */
const TITLE_MAX = 120;

/**
 * The issue a draft becomes.
 *
 * The body is a reading record rather than a template: the document's path, the heading the
 * reader had in view, the build that served the page, and then the note verbatim. `version` is the
 * caller's (`process.env.APP_VERSION`, which `next.config.mjs` inlines), so a note filed against a
 * stale deploy can be told apart from one filed against today's tree.
 *
 * Fenced with `---` so the note is visually the last thing, and never interpolated into anything a
 * markdown parser would treat as structure: the message is prose a stranger typed.
 */
export function composeFeedbackIssue(draft: FeedbackDraft, version: string): FeedbackIssue {
  const word = KIND_WORD[draft.kind];
  const where = draft.heading === "" ? draft.path : draft.heading;
  const title = `docs: ${word} — ${where}`.replace(/\s+/g, " ").slice(0, TITLE_MAX);

  const lines = [
    "Reported from the documentation reader (`/admin/docs`).",
    "",
    `- **Document:** \`${draft.path}\``,
    `- **Heading in view:** ${draft.heading === "" ? "(none — the page top)" : draft.heading}`,
    `- **Build:** ${version === "" ? "unknown" : version}`,
    `- **Kind:** ${word}`,
    "",
    "---",
    "",
    draft.message,
    "",
  ];

  return { title, body: lines.join("\n"), labels: [FEEDBACK_LABEL_OF[draft.kind]] };
}

/**
 * The heading the reader is looking at: the last one above the line, or `""`.
 *
 * Taken at the moment the panel opens, because that is when the reader decided something on this
 * screen was wrong — by the time they reach a panel under the article, every heading is above the
 * fold. `top` is a viewport coordinate (`getBoundingClientRect().top`), so `line = 0` is the top of
 * the window. A list that is empty, or entirely below the line, answers `""` and the caller falls
 * back to the page's own title.
 */
export function activeHeadingOf(
  headings: readonly { readonly text: string; readonly top: number }[],
  line = 0,
): string {
  let current = "";
  for (const heading of headings) {
    if (heading.top > line) break;
    current = heading.text;
  }
  return current;
}

/**
 * What the panel knows after an attempt. The panel's own state, and the route's answer, are the
 * same vocabulary — one union, so a new state cannot be added to one side only.
 */
export type FeedbackPhase =
  | { readonly kind: "filed"; readonly issueNumber: number }
  | { readonly kind: "not-configured" }
  | { readonly kind: "failed" }
  | { readonly kind: "invalid"; readonly reason: FeedbackRefusal }
  | { readonly kind: "limited" };

/** What the route answers. `issueNumber` is present only on `filed`, by construction. */
export type FeedbackAnswer = FeedbackPhase;

/**
 * The phase a route's JSON names — `failed` for anything unrecognised.
 *
 * This is the structural half of the acceptance rule. A 500 HTML page, a truncated body, a
 * renamed state or a proxy's error document all land on the same branch, and that branch is the
 * failure sentence. There is no path from "I could not read the answer" to a success panel.
 */
export function feedbackPhaseOf(answer: unknown): FeedbackPhase {
  const body =
    typeof answer === "object" && answer !== null ? (answer as Record<string, unknown>) : {};
  const state = body.state;
  if (state === "filed") {
    const number = body.issueNumber;
    if (typeof number === "number" && Number.isInteger(number) && number > 0) {
      return { kind: "filed", issueNumber: number };
    }
    return { kind: "failed" };
  }
  if (state === "not-configured") return { kind: "not-configured" };
  if (state === "limited") return { kind: "limited" };
  if (state === "invalid") {
    const reason = body.reason;
    return {
      kind: "invalid",
      reason: reason === "kind" || reason === "path" || reason === "message" ? reason : "message",
    };
  }
  return { kind: "failed" };
}

/** The sentence a phase draws: which fixture item, and the values it interpolates. */
export interface FeedbackNotice {
  /** `status` for an answer, `alert` for a refusal — the repo's own two roles. */
  readonly tone: "status" | "alert";
  /** The `data/pages/admin-docs-document.ts` item id. */
  readonly id: string;
  readonly values: Readonly<Record<string, string | number>>;
}

/**
 * What the panel says, per phase.
 *
 * `filed` is the **only** `status`, and it is the only branch that carries a number — so the
 * "nothing was recorded" sentence is reachable from every failure and unreachable from success.
 */
export function feedbackNoticeOf(phase: FeedbackPhase): FeedbackNotice {
  switch (phase.kind) {
    case "filed":
      return { tone: "status", id: "filed", values: { number: phase.issueNumber } };
    case "not-configured":
      return { tone: "alert", id: "not-configured", values: {} };
    case "limited":
      return { tone: "alert", id: "too-many", values: {} };
    case "invalid":
      return {
        tone: "alert",
        id: phase.reason === "message" ? "invalid-message" : "invalid",
        values: { min: FEEDBACK_MESSAGE_MIN, max: FEEDBACK_MESSAGE_MAX },
      };
    case "failed":
      return { tone: "alert", id: "failed", values: {} };
  }
}
