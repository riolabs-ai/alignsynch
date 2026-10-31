import { NextResponse } from "next/server";
import { loginPathFor } from "@/lib/auth/paths";
import { currentUser } from "@/lib/auth/session";
import { ASSESSMENTS_PATH, NEW_TEMPLATE_PATH } from "@/lib/flow/paths";
import { readTemplateDraft, type AspectRowInput } from "@/lib/flow/template-draft";
import { createAssessmentTemplate } from "@/lib/flow/templates";

/**
 * `POST /assessment/templates` — save an authored template, then redirect (#255).
 *
 * A route handler and not a server action, for the reason `/assessment/new` gives: the flow has to
 * be drivable with a plain HTML form (no client bundle, and `curl` can post it), and the acceptance
 * is proved by a browser doing exactly what a person does.
 *
 * **Signed in is a gate, not a hint.** `currentUser()` resolves the account from the request's own
 * cookies before any field is read; with no session the answer is the gated pages' own — a redirect
 * to `/login` carrying this path, so the round trip returns to the form. Nothing posted by the
 * browser can assert an identity, and the store writes no identity: the model has no author field
 * to write one into.
 *
 * **A refusal is a redirect, not a JSON body.** The form is HTML, so a person who typed five
 * Aspects and left a Value blank gets the form back with the fixture's sentence above it, rather
 * than a JSON document in the browser window. The code travels in `?problem=`, the Aspect number in
 * `?aspect=` — numbers and enum members only, never the text anybody typed, so a crafted post
 * cannot put words of its own into a URL the next page renders.
 *
 * **A save is a 303 to `/assessment?created=<id>`.** 303 so the browser follows with a GET: a
 * reload of the list cannot save a second template. The id, not the title, is what the redirect
 * carries — the list already holds the titles, and an id that is not in the list simply draws no
 * notice.
 */
export async function POST(request: Request): Promise<Response> {
  const user = await currentUser();
  if (user === null) {
    return NextResponse.redirect(new URL(loginPathFor(NEW_TEMPLATE_PATH), request.url), 303);
  }

  const form = await request.formData();
  const text = (name: string) => String(form.get(name) ?? "");

  // The fields are indexed (`aspect-3-prompt`) rather than parallel arrays, so a row cannot be
  // shifted onto another row's Values by one missing field. Order is the field index — the order
  // the form drew them in, which is the order they will be asked in.
  const rows = new Map<number, { prompt: string; leftValue: string; rightValue: string }>();
  const FIELD = /^aspect-(\d+)-(prompt|leftValue|rightValue)$/;
  for (const [name, value] of form.entries()) {
    const match = FIELD.exec(name);
    if (match === null || typeof value !== "string") continue;
    const index = Number(match[1]);
    const row = rows.get(index) ?? { prompt: "", leftValue: "", rightValue: "" };
    if (match[2] === "prompt") row.prompt = value;
    if (match[2] === "leftValue") row.leftValue = value;
    if (match[2] === "rightValue") row.rightValue = value;
    rows.set(index, row);
  }
  const ordered: AspectRowInput[] = [...rows.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, row]) => row);

  const result = readTemplateDraft({ title: text("title"), rows: ordered });
  if (!result.ok) {
    const target = new URL(NEW_TEMPLATE_PATH, request.url);
    target.searchParams.set("problem", result.code);
    if (result.aspectNumber !== undefined) {
      target.searchParams.set("aspect", String(result.aspectNumber));
    }
    return NextResponse.redirect(target, 303);
  }

  const created = await createAssessmentTemplate(result.draft);
  const done = new URL(ASSESSMENTS_PATH, request.url);
  done.searchParams.set("created", created.id);
  return NextResponse.redirect(done, 303);
}

/** A GET on the POST endpoint is a mistake with a destination: the form, not a 405 body. */
export async function GET(request: Request): Promise<Response> {
  return NextResponse.redirect(new URL(NEW_TEMPLATE_PATH, request.url), 303);
}
