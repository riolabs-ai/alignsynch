/**
 * `POST /api/news/subscribe` — the footer's news signup, stored and confirmed.
 *
 * A route handler rather than a server action, for the reason `app/api/profile/route.ts` gives:
 * the acceptance is a `curl` and a `psql`, so the write has to be a guarded HTTP verb somebody
 * can call without a browser. It is also the only shape that keeps the footer clean — the form is
 * one client component that posts here, so `components/layout/footer.tsx` never value-imports
 * `lib/db/**` and the two client pages that mount it stay out of E34's way.
 *
 * **Two audiences, one handler, one answer.**
 *
 *   `accept: application/json`  the footer's fetch call; the state comes back as a body
 *   anything else               a browser form post, including a reader with JavaScript off; the
 *                               state comes back as a one-sentence page with a link home
 *
 * Both branches resolve the *same* state through the *same* fixture band
 * (`data/pages/shell.ts`'s `footer-news`), so the sentence under the form and the sentence on the
 * fallback page cannot become two different claims about one write.
 *
 * **Order of operations, which is the whole honesty argument.**
 *
 *   1. read the address and refuse a malformed one **before** any write, so "zero rows written"
 *      is a property of the code and not of a rollback;
 *   2. write the row. `stored` and `duplicate` both mean the person is on the list; a duplicate is
 *      a success that sends nothing, because the confirmation went out the first time;
 *   3. only a row this request created is sent a confirmation. A send that was refused
 *      (`unset` / `failed`) is `stored-send-failed`: the subscription stands, the note did not,
 *      and the screen says exactly that. A storage failure is `storage-failed` and claims nothing.
 *
 * Nothing here reads a clock or a session: the signup is for anyone, signed in or not, and the
 * instant comes from `storeNewsSignup`'s default.
 */
import { newsConfirmationMessage, sendNewsConfirmation } from "@/lib/news/message";
import {
  newsSignupRefusal,
  type NewsSignupState,
  normalizeEmail,
  sourcePathOf,
} from "@/lib/news/signup";
import { storeNewsSignup } from "@/lib/news/store";
import { shellPageCopy } from "@/data/pages/shell";
import { itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

/** The route reads a form body per request and must never be prerendered. */
export const dynamic = "force-dynamic";

/** What the JSON branch answers with, per state. Only a refusal is not a 2xx. */
const STATUS_OF: Record<NewsSignupState, number> = {
  subscribed: 200,
  duplicate: 200,
  "stored-send-failed": 200,
  invalid: 400,
  "storage-failed": 503,
};

/** The fixture item that holds each state's sentence — the same map the form renders. */
const STATE_ITEM: Record<NewsSignupState, string> = {
  subscribed: "subscribed",
  duplicate: "duplicate",
  "stored-send-failed": "send-failed",
  invalid: "invalid",
  "storage-failed": "storage-failed",
};

/** Does this caller want a body it can read, or a page to land on? */
function wantsJson(request: Request): boolean {
  return (request.headers.get("accept") ?? "").includes("application/json");
}

function json(state: NewsSignupState): Response {
  return Response.json(
    { state },
    { status: STATUS_OF[state], headers: { "cache-control": "no-store" } },
  );
}

/**
 * The no-JavaScript answer: one sentence, in the fixture's words, and the way back.
 *
 * It is a document rather than a 303 for one reason — a redirect would drop the state on the
 * floor. A page that posted here and landed back on an unchanged `/pricing` would have no way to
 * say whether the address was kept, which is the exact ambiguity this feature exists to remove.
 * The link home is the path the form submitted, re-checked by `sourcePathOf()` against an
 * off-site `Location`.
 */
function confirmationPage(state: NewsSignupState, source: string): Response {
  const band = sectionOf(shellPageCopy, "footer-news");
  const heading = band.heading ?? "";
  const sentence = itemLabel(band, STATE_ITEM[state]);
  const back = sourcePathOf(source);
  const document = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(heading)}</title>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(heading)}</h1>
      <p>${escapeHtml(sentence)}</p>
      <p>${escapeHtml(sectionBody(band))}</p>
      <p><a href="${escapeHtml(back)}">${escapeHtml(itemLabel(band, "back"))}</a></p>
    </main>
  </body>
</html>`;
  return new Response(document, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

/** No interpolation in this document is a number or a fixed literal, but an address is not. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(request: Request): Promise<Response> {
  const asJson = wantsJson(request);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    // No body, or a body that is not a form: the same answer as an unreadable address, and the
    // same absence of a write.
    return asJson ? json("invalid") : confirmationPage("invalid", "/");
  }

  const raw = form.get("email");
  const source = sourcePathOf(form.get("source"));
  const answer = (state: NewsSignupState) =>
    asJson ? json(state) : confirmationPage(state, source);

  if (newsSignupRefusal(raw) !== undefined) return answer("invalid");

  const email = normalizeEmail(typeof raw === "string" ? raw : "");
  const stored = await storeNewsSignup(email, source);
  if (stored === "unavailable") return answer("storage-failed");
  if (stored === "duplicate") return answer("duplicate");

  const sent = await sendNewsConfirmation(newsConfirmationMessage(email));
  return answer(sent === "sent" ? "subscribed" : "stored-send-failed");
}
