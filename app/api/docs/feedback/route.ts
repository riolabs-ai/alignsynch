/**
 * `POST /api/docs/feedback` — a reader's note about one page of the documentation (#894).
 *
 * A route handler rather than a server action, for the reason `app/api/profile/route.ts` gives: the
 * acceptance is a `curl`, and the panel is one client component that posts here — which is also
 * what keeps the token, the `fetch` and `lib/docs/feedback-limit.ts`'s `node:crypto` out of the
 * browser graph (`scripts/client-graph.ts` refuses a `"use client"` module that reaches the writer).
 *
 * **Order of operations, which is the whole security argument:**
 *
 *   1. `requireAdmin()` — the same gate the page runs, before the body is read. A signed-out
 *      visitor is redirected to `/login`, a member gets the 404 an unknown URL gets, and neither
 *      can probe the validation.
 *   2. read and bound the body, then validate it against **the manifest's own paths**. A note about
 *      a document that does not exist is refused, so no caller can put an arbitrary string in an
 *      issue that reads as an address.
 *   3. count the attempt per admin (`lib/docs/feedback-limit.ts`) and refuse the sixth.
 *   4. file it, and answer what GitHub answered.
 *
 * **Only `filed` claims anything was filed.** A refused grant, an unreachable API, an unreadable
 * answer and a missing token are four different sentences and one shared outcome: nothing was
 * recorded. `feedbackPhaseOf()` on the panel is the second half of that rule — it reads an
 * unrecognised answer as `failed`, so a proxy's HTML error page cannot become a success.
 *
 * **Nothing here is logged but a status or an error name**, and the note itself is never logged at
 * all: the issue is the record, and a log is a second copy nobody can delete.
 */
import { requireAdmin } from "@/lib/auth/require-role";
import { DocsManifestUnreadable } from "@/lib/docs/manifest";
import {
  composeFeedbackIssue,
  readFeedbackDraft,
  type FeedbackAnswer,
  type FeedbackRefusal,
} from "@/lib/docs/feedback";
import { fileFeedbackIssue } from "@/lib/docs/feedback-github";
import { decideFeedbackWindow, feedbackBucketOf } from "@/lib/docs/feedback-limit";
import { ADMIN_DOCS_PATH, docsRows } from "@/lib/docs/rows";
import { readDocsManifest } from "@/lib/docs/tree";

/** The route resolves a session and reads a manifest per request, so it is never prerendered. */
export const dynamic = "force-dynamic";

/** `fs` and `node:crypto` both sit behind this handler; neither has an edge build. */
export const runtime = "nodejs";

/** A note is a few hundred characters. Anything larger is not a reader typing. */
const BODY_MAX = 20_000;

/** What each answer is worth as an HTTP status. Only `filed` is a 2xx. */
const STATUS_OF: Record<FeedbackAnswer["kind"], number> = {
  filed: 200,
  invalid: 400,
  limited: 429,
  "not-configured": 503,
  failed: 502,
};

function json(answer: FeedbackAnswer): Response {
  return Response.json(answer, {
    status: STATUS_OF[answer.kind],
    headers: { "cache-control": "no-store" },
  });
}

/** Every path the manifest carries — the set a note's `path` is judged against. */
function knownPaths(): ReadonlySet<string> | null {
  try {
    return new Set(docsRows(readDocsManifest()).map((row) => row.path));
  } catch (error) {
    if (!(error instanceof DocsManifestUnreadable)) throw error;
    // A manifest that cannot be read means no path can be checked, so no note can be honest about
    // where it came from. `docs:check` is where this is diagnosed; the reader gets the failure line.
    console.error("[docs-feedback] the manifest could not be read, so the note was not filed");
    return null;
  }
}

/** What the draft check's refusal means to the panel. */
function invalid(reason: FeedbackRefusal): FeedbackAnswer {
  return { kind: "invalid", reason };
}

export async function POST(request: Request): Promise<Response> {
  // 1. The gate, before the body. `/admin/docs` is the page this note came from, so that is where
  //    a signed-out visitor is sent back to.
  const grant = await requireAdmin({ next: ADMIN_DOCS_PATH });

  // 2. The body: bounded before it is parsed, and parsed as JSON only.
  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > BODY_MAX) return json(invalid("message"));
    raw = JSON.parse(text);
  } catch {
    return json(invalid("message"));
  }

  const paths = knownPaths();
  if (paths === null) return json({ kind: "failed" });

  const check = readFeedbackDraft(raw, paths);
  if (!check.ok) return json(invalid(check.reason));

  // 3. The window, per admin. A digest of the actor's id — never the id itself, never an address.
  const verdict = decideFeedbackWindow({
    bucket: feedbackBucketOf(grant.user.userId),
    now: Date.now(),
  });
  if (!verdict.allowed) {
    console.warn("[docs-feedback] a note was not filed: the actor is over the window");
    return json({ kind: "limited" });
  }

  // 4. File it. `process.env.APP_VERSION` is inlined by `next.config.mjs`, so the issue names the
  //    build that served the page — a note filed against a stale deploy is then a fact, not a guess.
  const issue = composeFeedbackIssue(check.draft, process.env.APP_VERSION ?? "");
  const result = await fileFeedbackIssue(issue);

  if (result.kind === "filed") return json({ kind: "filed", issueNumber: result.issueNumber });
  if (result.kind === "not-configured") return json({ kind: "not-configured" });

  // `refused` and `failed` are two diagnoses and one answer: nothing was recorded either way, so
  // the panel draws the same sentence and a reader cannot mistake a 403 for a filed note.
  if (result.kind === "refused") {
    console.error(`[docs-feedback] the note was not filed (HTTP ${result.status})`);
  }
  return json({ kind: "failed" });
}
