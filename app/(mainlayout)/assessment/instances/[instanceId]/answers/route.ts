import { assessmentInstancePageCopy } from "@/data/pages/assessment-instance";
import { answersFrom } from "@/lib/flow/answers";
import { instancePath } from "@/lib/flow/paths";
import { partyCookieName } from "@/lib/flow/session";
import { submitAnswers } from "@/lib/flow/store";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * `POST /assessment/instances/[instanceId]/answers` — one party's whole sheet, or a refusal.
 *
 * **The freeze is a status code.** When both parties have submitted, this answers **409**
 * with a page that says the answers cannot be changed — not a 303 back to a screen that
 * looks the way a successful submit looks. A browser that is not a party to the instance
 * gets **403**; an unknown instance **404**. That is the difference the acceptance asks
 * for: an edit after the freeze is an error, and a test reads the status.
 *
 * The party is resolved from the cookie's token hash inside the store's transaction; the
 * form cannot say who it is. A form field called `role`, if one is posted, is not read as an
 * instruction — it is read as an **assertion**, and an assertion the cookie contradicts is
 * refused (403) rather than quietly written under the cookie's role (#202). That is what
 * makes a hand-written POST unable to record the other party's column.
 *
 * The refusal page is assembled here as HTML rather than rendered from a component, for
 * one mechanical reason: this Next version refuses `react-dom/server` inside `app/` (it
 * wants a Server Component, and a route handler that must return a status is not one). The
 * words are still the fixture's — `problems` in `data/pages/assessment-instance.ts` — plus
 * the store's own reason line, which says which role this session actually answers as.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ instanceId: string }> },
): Promise<Response> {
  const { instanceId } = await params;
  const form = await request.formData();
  const parsed = answersFrom(form);
  const jar = await cookies();
  const token = jar.get(partyCookieName(instanceId))?.value;
  const asserted = form.get("role");

  const result = await submitAnswers({
    instanceRecordId: instanceId,
    token,
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

  const problems = sectionOf(assessmentInstancePageCopy, "problems");
  const label = itemLabel(problems, result.code);
  const back = itemLabel(problems, "back");
  const href = escapeHtml(instancePath(instanceId));

  const html = [
    "<!doctype html>",
    '<html lang="en"><head><meta charset="utf-8" />',
    `<title>${escapeHtml(label)}</title></head>`,
    '<body class="mx-auto max-w-xl px-4 py-12">',
    `<main><h1 class="text-xl font-semibold text-red-800">${escapeHtml(label)}</h1>`,
    `<p class="mt-2 text-sm">${escapeHtml(result.reason)}</p>`,
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
