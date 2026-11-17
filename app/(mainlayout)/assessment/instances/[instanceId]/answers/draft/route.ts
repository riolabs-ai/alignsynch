/**
 * `POST /assessment/instances/[instanceId]/answers/draft` — save as you go (#1128).
 *
 * The v2 answer screen asks one Aspect at a time and writes each pick as it is made, so it needs a
 * write that is **not** the seal: `/answers` is a whole sheet and refuses a missing Aspect, while a
 * draft is whatever has been picked so far. Two addresses rather than one with a mode field, because
 * "which refusal did I get" should be a question about the URL.
 *
 * **The shape it answers with depends on who is asking.** The pick handler in
 * `components/assessment-flow/aspect-answer-card.tsx` posts with `Accept: application/json` and
 * expects a verdict it can render beside the scale ("Saved", "Not saved — pick again"); a browser
 * with no JavaScript posts the same form and expects a document, so it gets a 303 to the position
 * the button named. Both paths call the same store function, so neither can save something the
 * other would not.
 *
 * **Nothing here decides who is writing.** The seat is resolved inside
 * `saveDraftAnswers()`' transaction from the party cookie's token hash and then the signed-in
 * account; the form carries no role, and the position fields (`item`, `aspect`, `go`) are
 * assertions about *where the reader is*, never about *whose column is written*. A refused write is
 * a 409/403/404 — the same table `/answers` uses — and the page draws the sentence for the code it
 * was bounced with.
 */
import { opinionKindsFor } from "@/content/assessment";
import { authConfigured } from "@/lib/auth/config";
import { currentUser } from "@/lib/auth/session";
import { answersFrom } from "@/lib/flow/answers";
import { answerAspectPath, answerSheetPath, sessionPath } from "@/lib/flow/paths";
import { partyCookieName } from "@/lib/flow/session";
import { parseDraft } from "@/lib/flow/state";
import { readSessionMode, saveDraftAnswers } from "@/lib/flow/store";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/** The button that sent the post, as the card draws it. */
const GOALS = ["save", "next", "back", "exit", "reset"] as const;
type Goal = (typeof GOALS)[number];

/** The status each refusal deserves, the same table `/answers` answers with. */
const REFUSAL_STATUS: Record<string, number> = {
  "not-a-party": 403,
  "no-such-instance": 404,
  frozen: 409,
  incomplete: 409,
  voided: 409,
  lapsed: 409,
  "payment-method-required": 409,
};

/** The signed-in account id, or `null` — never a thrown error on a tree without auth env. */
async function viewerUserId(): Promise<string | null> {
  if (!authConfigured()) return null;
  const user = await currentUser();
  return user?.userId ?? null;
}

/** A `go` value, or `save` for anything that is not one of the five the card draws. */
function goalOf(value: FormDataEntryValue | null): Goal {
  return typeof value === "string" && (GOALS as readonly string[]).includes(value)
    ? (value as Goal)
    : "save";
}

/** Does this request want a verdict it can render, rather than a document? */
function wantsJson(request: Request): boolean {
  return (request.headers.get("accept") ?? "").includes("application/json");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ instanceId: string }> },
): Promise<Response> {
  const { instanceId: sessionId } = await params;
  const form = await request.formData();
  const goal = goalOf(form.get("go"));
  const item = typeof form.get("item") === "string" ? String(form.get("item")) : "";

  /* The position the reader was on. Not trusted for anything but the destination: a forged value
   * moves a reader to another Aspect of **their own** sheet, which is a link they could have
   * typed. */
  const posted = Number(form.get("aspect"));
  const aspect = Number.isInteger(posted) && posted >= 1 ? posted : 1;

  const json = wantsJson(request);
  const mode = (await readSessionMode(sessionId)) ?? "basic";
  const parsed = answersFrom(form, opinionKindsFor(mode));
  const jar = await cookies();

  const result = await saveDraftAnswers({
    sessionRecordId: sessionId,
    token: jar.get(partyCookieName(sessionId))?.value,
    viewerUserId: await viewerUserId(),
    answers: parsed.answers,
    ...(goal === "reset" ? { clear: true } : {}),
  });

  if (!result.ok) {
    if (json) {
      return NextResponse.json(
        { ok: false, code: result.code, reason: result.reason },
        { status: REFUSAL_STATUS[result.code] ?? 409 },
      );
    }
    return NextResponse.redirect(
      new URL(`${answerSheetPath(sessionId)}?refused=${result.code}`, request.url),
      303,
    );
  }

  /* Is the Aspect the reader is standing on whole? The bundle blocks `Next Aspect` until it is
   * ("Pick a number for Feel and for Wish to continue."), and a no-JavaScript post gets the same
   * answer the browser-side guard gives: back to the same Aspect, with the hint. */
  const complete = parseDraft([item], parsed.answers, mode).length === 1;

  const target: string = (() => {
    if (goal === "reset") return answerAspectPath(sessionId, 1);
    if (goal === "exit") return sessionPath(sessionId);
    if (goal === "back") return answerAspectPath(sessionId, Math.max(aspect - 1, 1));
    if (goal === "next") {
      if (!complete) return `${answerAspectPath(sessionId, aspect)}&incomplete=1`;
      return aspect >= result.aspectCount
        ? answerAspectPath(sessionId, "review")
        : answerAspectPath(sessionId, aspect + 1);
    }
    return answerAspectPath(sessionId, aspect);
  })();

  if (json) {
    return NextResponse.json({ ok: true, answered: result.answered, complete });
  }
  return NextResponse.redirect(new URL(target, request.url), 303);
}
