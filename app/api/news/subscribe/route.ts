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
 * **This is the only public form that sends mail, so it is guarded (#615).** The rules are
 * `lib/forms/guard.ts`'s — the contact form's, lifted rather than copied — and the window is
 * `lib/forms/attempts.ts`'s, the same store the auth proxy counts over. Four of them apply here,
 * and every one of them answers **the same success response** a person gets:
 *
 *   1. **the honeypot** — a field a person never fills; a filled one is a bot, and the endpoint
 *      must not be an oracle that says which rule it tripped;
 *   2. **the signed minimum fill time** — `GET` on this same path mints `"<ms>.<hmac>"`, the form
 *      posts it back, and a submit sooner than a person can type is dropped. It is *signed* so a
 *      script cannot post a start time it likes, and it is **optional**: a no-JavaScript post has
 *      no way to carry one, so the absence of a token is not a bot signal — only a present and
 *      unverifiable one is. A bot that omits the token gains the two seconds it would have spent
 *      waiting; the honeypot and the window are what stop the abuse;
 *   3. **the client window** — five submits per forwarded address per ten minutes, counted in
 *      `form_guard_attempt` from a salted *hash* of the address, never the address;
 *   4. **the address window** — five submits naming one mailbox, hashed the same way. This is the
 *      mail-bombing case: one stranger's address submitted from a hundred machines is one bucket.
 *
 * A submission past any of those answers `subscribed`, writes no `news_signup` row and sends no
 * mail. That is the contact form's precedent (a bot learns nothing from a response) and the only
 * one that fits an endpoint whose *success* is the abuse.
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
 * Nothing here reads a session: the signup is for anyone, signed in or not. The clock is read once
 * per request and passed down, so the guard's window and the row's `created_at` cannot disagree.
 */
import { shellPageCopy } from "@/data/pages/shell";
import { decideWindow } from "@/lib/forms/attempts";
import {
  CONTACT_RATE_MAX,
  CONTACT_RATE_WINDOW_MS,
  honeypotFilled,
  looksTooFast,
} from "@/lib/forms/guard";
import { addressHashOf, clientIpOf, ipHashOf } from "@/lib/forms/ip";
import { fillTokenConfigured, mintFillToken, readFillInstant } from "@/lib/forms/token";
import { newsConfirmationMessage, sendNewsConfirmation } from "@/lib/news/message";
import {
  newsSignupRefusal,
  type NewsSignupState,
  normalizeEmail,
  sourcePathOf,
} from "@/lib/news/signup";
import { storeNewsSignup } from "@/lib/news/store";
import { itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

/** The route reads a form body per request and must never be prerendered. */
export const dynamic = "force-dynamic";

/** `pg` is a Node driver: this handler cannot run on the edge runtime. */
export const runtime = "nodejs";

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

/**
 * `GET` mints the signed start instant the form posts back.
 *
 * It is a `GET` rather than a value baked into the page's HTML because the footer renders on
 * marketing pages that are prerendered: a build-time timestamp would make every visitor's elapsed
 * time as long as the build's age, which is no check at all. Asking for one at mount keeps those
 * pages static and still gives every submit an unforgeable "the form was on screen at" value.
 *
 * `token: null` is the honest answer in a tree with no signing secret (a unit test, a bare CI
 * checkout): nothing can be signed, so the form sends none, and the route treats a missing token
 * as no timing evidence rather than as a bot.
 */
export function GET(): Response {
  const token = fillTokenConfigured() ? (mintFillToken() ?? null) : null;
  return Response.json({ token }, { headers: { "cache-control": "no-store" } });
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

  /**
   * What a bot gets: the ordinary `subscribed` answer — 200, and the fixture's success sentence —
   * with nothing written and no mail sent. Deliberately not `duplicate`: that sentence says
   * "nothing changed", which is true here but is also a hint that the address is on the list.
   *
   * The line below names the *rule*, never the address: a log is copied and kept longer than a
   * table, and the address is the one thing this endpoint must not put in one.
   */
  const silentlyRefused = (why: string): Response => {
    console.warn(`[news] a submission was dropped without a write (${why})`);
    return answer("subscribed");
  };

  const now = Date.now();

  // 1. The honeypot, first: a bot learns nothing about the address rules from this answer.
  if (honeypotFilled(form.get("website"))) return silentlyRefused("honeypot");

  // 2. The signed minimum fill time. A token that is present and cannot be verified is a forged
  //    one; a token that is absent is a no-JavaScript post, which the honeypot and the window
  //    cover (see the module docblock).
  const token = form.get("fillToken");
  const startedAt = readFillInstant(token);
  if (typeof token === "string" && token !== "" && startedAt === undefined) {
    return silentlyRefused("unverifiable fill token");
  }
  if (startedAt !== undefined && looksTooFast({ startedAt, now })) {
    return silentlyRefused("too fast");
  }

  if (newsSignupRefusal(raw) !== undefined) return answer("invalid");

  const email = normalizeEmail(typeof raw === "string" ? raw : "");

  // 3. The window. Both buckets are counted from digests: the client (when the request carries
  //    one — a direct connection has no identity to bucket) and the mailbox itself.
  const ip = clientIpOf(request.headers);
  const verdict = await decideWindow({
    form: "news",
    clientHash: ip === "" ? undefined : ipHashOf(ip),
    addressHash: addressHashOf(email),
    now: new Date(now),
    windowMs: CONTACT_RATE_WINDOW_MS,
    max: CONTACT_RATE_MAX,
  });
  if (verdict.over) return silentlyRefused("window");

  const stored = await storeNewsSignup(email, source, new Date(now));
  if (stored === "unavailable") return answer("storage-failed");
  if (stored === "duplicate") return answer("duplicate");

  const sent = await sendNewsConfirmation(newsConfirmationMessage(email));
  return answer(sent === "sent" ? "subscribed" : "stored-send-failed");
}
