/**
 * `POST /assessment/templates/[templateId]/duplicate` — copy a template into this account's own.
 *
 * A duplicate is a **new record with copied items**, never a pointer: the copy carries the
 * source's title with " (copy)" appended, its summary, and its Aspects with their order, and it
 * is authored by the caller. Copying a built-in is allowed — that is how a person takes the
 * platform's starting point and makes it theirs — and copying another account's template is
 * refused by the store (`duplicateTemplate` asks `canUseTemplate`).
 *
 * The copy is published whatever state the source is in: the point of duplicating an archived
 * template is to get a usable one back, and unarchiving is the other action (and only the author
 * has it).
 *
 * A 303 to the library with `?duplicated=<new id>`, so a reload cannot make a second copy.
 */
import { NextResponse } from "next/server";
import { loginPathFor } from "@/lib/auth/paths";
import { currentUser } from "@/lib/auth/session";
import { TEMPLATE_LIBRARY_PATH } from "@/lib/flow/paths";
import { duplicateTemplate } from "@/lib/flow/templates";
import { parseLibraryStatus, parseLibraryView } from "@/lib/flow/template-library";

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
  const result = await duplicateTemplate(templateId, user.userId);
  if (!result.ok) {
    return NextResponse.redirect(libraryUrl(request, form, { problem: result.code }), 303);
  }

  return NextResponse.redirect(libraryUrl(request, form, { duplicated: result.template.id }), 303);
}

/** A GET on a POST endpoint is a mistake with a destination: the library, not a 405 body. */
export async function GET(request: Request): Promise<Response> {
  return NextResponse.redirect(new URL(TEMPLATE_LIBRARY_PATH, request.url), 303);
}
