/**
 * `POST /assessment/instances/[instanceId]/steps` — one party's tick or reword of one Step (#478).
 *
 * The write half of the Steps panel. Two controls on the screen, one endpoint: a tick posts
 * `stepId` + `status`, a reword posts `stepId` + `text`. The seat is never a form field — the party
 * cookie's token (or, failing it, the signed-in account) is what `writeStep()` resolves inside its
 * transaction, so a hand-written POST cannot record the other party's progress.
 *
 * **Every refusal is a status code**, the same discipline as `/answers` and `/accepts`:
 *
 *   403  `not-a-party`   — a browser or account that holds no seat (a coach included)
 *   404  `no-such-instance`, `no-such-step`
 *   409  `incomplete`    — the session is not complete, so the Steps do not exist to tick
 *   400  `invalid`       — no `stepId`, no `status` **and** no `text`, or a status a party may not write
 *
 * **The happy path is a 303 back to the panel** (`#steps-heading`, so the reader lands where they
 * clicked), which is what makes a reload harmless: a tick posted twice finds the row already saying
 * `done` and writes nothing (`changed: false`), rather than a second state.
 *
 * The refusal page is assembled here as HTML rather than rendered from a component, for the reason
 * the `/answers` handler gives: this Next version refuses `react-dom/server` inside `app/`, and a
 * route handler that must return a status is not a Server Component. The words are the fixture's —
 * the `problems` section of `data/pages/assessment-instance.ts` — plus the store's own reason line.
 */
import { assessmentInstancePageCopy } from "@/data/pages/assessment-instance";
import { authConfigured } from "@/lib/auth/config";
import { currentUser } from "@/lib/auth/session";
import { instancePath } from "@/lib/flow/paths";
import { partyCookieName } from "@/lib/flow/session";
import { writeStep, type StepRefusal, type StepWriteInput } from "@/lib/flow/store";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/** The same auth guard the instance, answer and accept routes carry. */
async function viewerUserId(): Promise<string | null> {
  if (!authConfigured()) return null;
  const user = await currentUser();
  return user?.userId ?? null;
}

/** The HTTP status each refusal code deserves, in one table so no branch can invent one. */
const REFUSAL_STATUS: Record<StepRefusal, number> = {
  "not-a-party": 403,
  "no-such-instance": 404,
  "no-such-step": 404,
  incomplete: 409,
  invalid: 400,
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ instanceId: string }> },
): Promise<Response> {
  const { instanceId } = await params;
  const form = await request.formData();
  const stepId = form.get("stepId");
  if (typeof stepId !== "string" || stepId === "") {
    return refusal(instanceId, "invalid", "The form named no Step to write.", 400);
  }

  const patch = patchOf(form);
  if (typeof patch === "string") {
    return refusal(instanceId, "invalid", patch, 400);
  }

  const jar = await cookies();
  const result = await writeStep({
    instanceRecordId: instanceId,
    stepId,
    token: jar.get(partyCookieName(instanceId))?.value,
    viewerUserId: await viewerUserId(),
    patch,
  });

  if (!result.ok) {
    return refusal(instanceId, result.code, result.reason, REFUSAL_STATUS[result.code]);
  }

  // A 303, so the refresh cannot re-post the tick; the fragment keeps the reader at the panel.
  return NextResponse.redirect(
    new URL(`${instancePath(instanceId)}#steps-heading`, request.url),
    303,
  );
}

/**
 * The patch the form asked for, or the sentence explaining why it asked for nothing usable.
 *
 * A party writes `open`/`done` and words, never `closed`: closing is the derivation's write, on the
 * completion that finds a Gap fallen to 0, so a status of `closed` here is refused rather than
 * stored. When both a status and words arrive, the words win — a reword form always carries the text
 * and never a status, so the only way both appear is a hand-written post, and the words are the
 * narrower write.
 */
function patchOf(form: FormData): StepWriteInput["patch"] | string {
  const text = form.get("text");
  if (typeof text === "string") return { text };

  const status = form.get("status");
  if (status === "open" || status === "done") return { status };
  if (typeof status === "string") {
    return `A Step is marked open or done, never "${status}" — closing one is the session's write.`;
  }
  return "The form asked for no change: a Step is either ticked or reworded.";
}

/**
 * The refusal page: the fixture's sentence for the code, the store's reason beneath it, and the way
 * back to the instance the reader was on. Self-contained rather than shared with the `/answers`
 * handler: the two write different things and the shared part is nine lines of markup, but a helper
 * reached from both would be a change to a shipped endpoint in a card about Steps.
 */
function refusal(instanceId: string, code: StepRefusal, reason: string, status: number): Response {
  const section = sectionOf(assessmentInstancePageCopy, "problems");
  const label = itemLabel(section, code);
  const back = itemLabel(section, "back");
  const href = escapeHtml(instancePath(instanceId));

  const html = [
    "<!doctype html>",
    '<html lang="en"><head><meta charset="utf-8" />',
    `<title>${escapeHtml(label)}</title></head>`,
    '<body class="mx-auto max-w-xl px-4 py-12">',
    `<main><h1 class="text-xl font-semibold text-red-800">${escapeHtml(label)}</h1>`,
    `<p class="mt-2 text-sm">${escapeHtml(reason)}</p>`,
    `<p class="mt-4"><a class="text-sm font-medium underline" href="${href}">${escapeHtml(back)}</a></p>`,
    "</main></body></html>",
  ].join("");

  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

/** The four characters that would otherwise end an attribute or open a tag. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
