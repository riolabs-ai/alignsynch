import { assessmentInstancePageCopy } from "@/data/pages/assessment-instance";
import { opinionKindsFor } from "@/content/assessment";
import { authConfigured } from "@/lib/auth/config";
import { currentUser } from "@/lib/auth/session";
import { answersFrom } from "@/lib/flow/answers";
import { instancePath } from "@/lib/flow/paths";
import { partyCookieName } from "@/lib/flow/session";
import { readInstanceMode, submitAnswers } from "@/lib/flow/store";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * The signed-in account id, or `null` — never a thrown error on a tree without auth env.
 *
 * The same helper the instance, report and accept routes carry: `currentUser()` answers `null` for
 * "no session", and `authConfigured()` keeps a tree with no `NEON_AUTH_*` env rendering rather than
 * throwing.
 */
async function viewerUserId(): Promise<string | null> {
  if (!authConfigured()) return null;
  const user = await currentUser();
  return user?.userId ?? null;
}

/**
 * `POST /assessment/instances/[instanceId]/answers` — one party's whole sheet, or a refusal.
 *
 * **The freeze is per party, and it is a status code (#R2).** A submit is answered **409** once
 * the *submitting party* has accepted — their sheet is the record they agreed to, and an edit
 * would rewrite it for the other party without their knowing. Before that acceptance the window is
 * open even if the other party has already submitted: that is the prototype's edit-before-accept
 * review, and it is why the freeze is no longer "both parties have submitted". A browser that is
 * not a party to the instance gets **403**; an unknown instance **404**. An edit after the freeze
 * is an error, and a test reads the status.
 *
 * **The sheet is the instance's mode's sheet (#213).** The field names are read against
 * `opinionKindsFor(mode)` — `feel`/`wish` for Basic, all four for Advanced — and the mode
 * comes from the row (`readInstanceMode`), never from a form field. A post naming a kind the
 * mode does not ask (`think:…` against a Basic instance) is **refused here, with a 409**,
 * before the store is called: a field nobody reads is the silent success the freeze rule
 * exists to prevent. The store re-reads the mode under its lock and parses the sheet against
 * that value, so this read is a refusal's convenience and never the authority.
 *
 * The party is resolved from the cookie's token hash inside the store's transaction, and from the
 * signed-in account when the cookie is gone (#R2); the form cannot say who it is. A form field
 * called `role`, if one is posted, is not read as an instruction — it is read as an **assertion**,
 * and an assertion the cookie contradicts is refused (403) rather than quietly written under the
 * cookie's role (#202). That is what makes a hand-written POST unable to record the other party's
 * column.
 *
 * The refusal page is assembled here as HTML rather than rendered from a component, for
 * one mechanical reason: this Next version refuses `react-dom/server` inside `app/` (it
 * wants a Server Component, and a route handler that must return a status is not one). The
 * words are still the fixture's — `problems` in `data/pages/assessment-instance.ts` — plus
 * the store's own reason line, which says which role this session actually answers as.
 *
 * **The unlock notice no longer fires here (#R2).** Submission stopped being the completion hinge:
 * the session completes at the second *acceptance*, so the notice moved to the accept endpoint
 * (`…/accepts/route.ts`). This endpoint cannot complete a session any more — the store refuses a
 * submit from a party who has accepted, and the second acceptance is what completes — so sending
 * from here would be a notice for an event that did not happen.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ instanceId: string }> },
): Promise<Response> {
  const { instanceId } = await params;
  const form = await request.formData();
  const mode = await readInstanceMode(instanceId);
  const parsed = answersFrom(form, opinionKindsFor(mode ?? "basic"));
  const jar = await cookies();
  const token = jar.get(partyCookieName(instanceId))?.value;
  const asserted = form.get("role");

  // A field this mode does not ask is a refusal, not something to drop on the floor. An
  // unknown instance is still the store's question, so the parse only needs a legal shape.
  if (parsed.problems.length > 0) {
    return refusal(instanceId, 409, "incomplete", parsed.problems.join("; "));
  }

  const result = await submitAnswers({
    instanceRecordId: instanceId,
    token,
    // #R2 — the account is the second answer to "which seat is writing", asked only when the
    // cookie holds no party token for this instance.
    viewerUserId: await viewerUserId(),
    ...(typeof asserted === "string" ? { assertedRole: asserted } : {}),
    answers: parsed.answers,
  });

  if (result.ok) {
    return NextResponse.redirect(new URL(instancePath(instanceId), request.url), 303);
  }

  const status =
    result.code === "frozen" || result.code === "incomplete"
      ? 409
      : result.code === "not-a-party"
        ? 403
        : 404;

  return refusal(instanceId, status, result.code, result.reason, result.problems);
}

/**
 * The refusal page: the fixture's sentence for the code, the reason beneath it, and — when
 * the refusal was a parse — the per-Aspect problems, so a reader (and a test) can see *which*
 * rule stopped the sheet rather than only "incomplete".
 */
function refusal(
  instanceId: string,
  status: number,
  code: string,
  reason: string,
  problems: readonly string[] = [],
): Response {
  const section = sectionOf(assessmentInstancePageCopy, "problems");
  const label = itemLabel(section, code);
  const back = itemLabel(section, "back");
  const href = escapeHtml(instancePath(instanceId));
  const detail =
    problems.length === 0
      ? ""
      : `<ul class="mt-2 list-disc pl-6 text-sm">${problems
          .map((problem) => `<li>${escapeHtml(problem)}</li>`)
          .join("")}</ul>`;

  const html = [
    "<!doctype html>",
    '<html lang="en"><head><meta charset="utf-8" />',
    `<title>${escapeHtml(label)}</title></head>`,
    '<body class="mx-auto max-w-xl px-4 py-12">',
    `<main><h1 class="text-xl font-semibold text-red-800">${escapeHtml(label)}</h1>`,
    `<p class="mt-2 text-sm">${escapeHtml(reason)}</p>`,
    detail,
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
