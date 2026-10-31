/**
 * `POST /assessment/templates/[templateId]/status` — archive or unarchive a template.
 *
 * **The body carries the target state, not a toggle.** `status=archived|published` is read and
 * validated here, so a stale form (the row was archived in another tab) sets the state it says
 * rather than flipping whatever is there now. Anything else is refused before the store is
 * called.
 *
 * **The store decides whether this account may.** `setTemplateStatus()` reads the row
 * `FOR UPDATE`, compares `author_user_id` to the session's id in the same transaction that
 * writes, and refuses a built-in (`NULL` author) and another account's template with the same
 * code. The narrow `WHERE` is the permission; this route never checks one of its own, because a
 * second copy of a rule is a second chance to get it wrong.
 *
 * **Archiving is not deletion, and it cannot break an instance.** An instance copies its Aspects
 * into its own `item` rows when it is created, and the instance screen draws from that copy —
 * nothing joins back to the template. Archiving only stops the catalogue listing it and stops
 * `createInstanceFromTemplate` from copying it (that path refuses a non-published template).
 *
 * The answer is a 303 to the library with the record's id in `?archived=` / `?unarchived=`, so
 * the browser follows with a GET and a reload cannot perform the write twice. The filter the
 * person was looking at travels in hidden fields and is rebuilt here from the validated values —
 * never from a `return` URL, which would be an open redirect.
 */
import { NextResponse } from "next/server";
import { loginPathFor } from "@/lib/auth/paths";
import { currentUser } from "@/lib/auth/session";
import { TEMPLATE_LIBRARY_PATH } from "@/lib/flow/paths";
import { setTemplateStatus } from "@/lib/flow/templates";
import { parseLibraryStatus, parseLibraryView } from "@/lib/flow/template-library";

/** The library URL to land on, carrying the filter the write was performed under. */
function libraryUrl(request: Request, form: FormData, extra?: Record<string, string>): URL {
  const target = new URL(TEMPLATE_LIBRARY_PATH, request.url);
  const text = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : "";
  };
  const view = parseLibraryView(text("view"));
  const status = parseLibraryStatus(text("status-filter"));
  const query = text("q");
  if (view !== "all") target.searchParams.set("view", view);
  if (status !== "all") target.searchParams.set("status", status);
  if (query !== "") target.searchParams.set("q", query);
  for (const [key, value] of Object.entries(extra ?? {})) target.searchParams.set(key, value);
  return target;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ templateId: string }> },
): Promise<Response> {
  const user = await currentUser();
  if (user === null) {
    return NextResponse.redirect(new URL(loginPathFor(TEMPLATE_LIBRARY_PATH), request.url), 303);
  }

  const { templateId } = await context.params;
  const form = await request.formData();
  const wanted = form.get("status");
  const status = wanted === "archived" || wanted === "published" ? wanted : null;

  if (status === null) {
    return NextResponse.redirect(libraryUrl(request, form, { problem: "unknown-template" }), 303);
  }

  const result = await setTemplateStatus(templateId, user.userId, status);
  if (!result.ok) {
    return NextResponse.redirect(libraryUrl(request, form, { problem: result.code }), 303);
  }

  const landed = status === "archived" ? "archived" : "unarchived";
  return NextResponse.redirect(libraryUrl(request, form, { [landed]: result.template.id }), 303);
}

/** A GET on a POST endpoint is a mistake with a destination: the library, not a 405 body. */
export async function GET(request: Request): Promise<Response> {
  return NextResponse.redirect(new URL(TEMPLATE_LIBRARY_PATH, request.url), 303);
}
