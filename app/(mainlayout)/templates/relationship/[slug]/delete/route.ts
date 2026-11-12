/**
 * `POST /templates/relationship/[slug]/delete` — delete an authored template (#743).
 *
 * **This is the half of #743 archiving could not do.** Archive hides a row and stays reversible
 * (`archiveTargetOf`, `setTemplateStatus`); delete is the one action with no way back, so it has
 * its own address rather than another `status=` value — one URL cannot honestly mean both "move
 * it out of the list" and "destroy it".
 *
 * **What may be deleted is the writer's call, not this file's.** `deleteTemplate()` reads the row
 * `FOR UPDATE`, applies the author rule (`authorshipOf`) and refuses a template a relationship was
 * started from or that was ever published, each with a named code. This route never checks one of
 * those itself: a second copy of a permission rule is a second chance to get it wrong, which is
 * the rule `status/route.ts` states beside it.
 *
 * **The answer is always a 303, including every refusal.** A refused delete is a sentence on the
 * library ("that one has to be archived instead"), not a 500 and not an error page, and the
 * redirect means a reload cannot repeat the write.
 *
 * **The notice carries no title on success.** The row the notice would name is the row that just
 * stopped existing, and the library resolves every other notice's title from the record it read —
 * never from the query string. So a delete lands on `?deleted=1` and reads the fixture's own
 * sentence, while the two refusals (whose row still exists) name the template from the read.
 */
import { NextResponse } from "next/server";
import { loginPathFor } from "@/lib/auth/paths";
import { currentUser } from "@/lib/auth/session";
import { resolveTemplateHandle } from "@/lib/db/template-library";
import { TEMPLATE_LIBRARY_PATH } from "@/lib/flow/paths";
import { deleteTemplate } from "@/lib/flow/templates";
import { parseRealmFilter } from "@/components/assessment-flow/template-card";
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
  const realm = parseRealmFilter(text("realm"));
  const query = text("q");
  if (view !== "all") target.searchParams.set("view", view);
  if (status !== "all") target.searchParams.set("status", status);
  // The realm travels the same way the tab and the status do: rebuilt from a validated value,
  // so a write performed on the `Home` shelf lands back on it.
  if (realm !== null) target.searchParams.set("realm", realm);
  if (query !== "") target.searchParams.set("q", query);
  for (const [key, value] of Object.entries(extra ?? {})) target.searchParams.set(key, value);
  return target;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const user = await currentUser();
  if (user === null) {
    return NextResponse.redirect(new URL(loginPathFor(TEMPLATE_LIBRARY_PATH), request.url), 303);
  }

  const { slug } = await context.params;
  const form = await request.formData();

  const handle = await resolveTemplateHandle(slug);
  if (handle === undefined) {
    return NextResponse.redirect(libraryUrl(request, form, { problem: "unknown-template" }), 303);
  }

  const result = await deleteTemplate(handle.id, user.userId);
  if (!result.ok) {
    // `refused` carries the **slug**, not the title: the notice resolves the title against the
    // rows the page reads, exactly as `archived=` does. A title in a query string would let a
    // crafted link write a sentence onto somebody's screen.
    return NextResponse.redirect(
      libraryUrl(request, form, {
        problem: result.code,
        ...(result.code === "unknown-template" ? {} : { refused: handle.slug }),
      }),
      303,
    );
  }

  // The title is deliberately not carried: it is no longer a row the library can resolve, and a
  // title in a query string is a sentence a crafted link could write onto somebody's screen.
  return NextResponse.redirect(libraryUrl(request, form, { deleted: "1" }), 303);
}

/** A GET on a POST endpoint is a mistake with a destination: the library, not a 405 body. */
export async function GET(request: Request): Promise<Response> {
  return NextResponse.redirect(new URL(TEMPLATE_LIBRARY_PATH, request.url), 303);
}
