/**
 * `POST /api/contact` — the public contact form's only endpoint.
 *
 * A thin wrapper on purpose: it reads the form, hands the fields to
 * `lib/contact/submit.ts::submitContactMessage()` with the real side effects as arguments, and
 * turns the returned state into a 303 back to `/help?contact=…`. The decision itself — spam,
 * validation, the rate limit, store-before-mail, and which sentence the page may print — lives in
 * that module because it is the part with an *order* to prove, and it is proved there against
 * fakes with no HTTP and no database.
 *
 * **The ordering the card requires** (owner, 2026-11-02):
 *
 *   1. spam is decided invisibly — a filled honeypot or a submit too fast for a person gets the
 *      ordinary success page and writes nothing, so a bot learns nothing from the response;
 *   2. the fields are validated; a bad one comes back as `invalid` and stores nothing;
 *   3. the per-client rate limit is counted over the window the table's index serves;
 *   4. the row is inserted. **If this fails the answer is `failed`** — no confirmation, no
 *      thanks, because nothing reached us;
 *   5. only then is the notification mailed to the brand's internal mailbox with `Reply-To` set
 *      to the sender. `sent` needs a 2xx; `unset` (no mailer configured) and `failed` (refused or
 *      unreachable) both answer `received`, because the message is stored and a person can read
 *      it. That is the difference between "we have it" and "we told you we have it".
 *
 * **A 303, not a JSON body.** The form is a plain HTML `POST` (no JavaScript, no client state),
 * so the answer is a redirect and the page renders the sentence from its own fixture.
 *
 * **Nothing sensitive is logged.** The failure lines carry the step and the driver's error
 * *name* or code — never the message body, the sender's address, the name, or the database URL,
 * which a `pg` error can quote back.
 */
import { NextResponse } from "next/server";
import { helpPageCopy } from "@/data/pages/help";
import { clientIpOf, ipHashOf } from "@/lib/contact/ip";
import { sendContactMessage } from "@/lib/contact/mail";
import {
  countRecentContactMessages,
  recordMailOutcome,
  storeContactMessage,
} from "@/lib/contact/store";
import { submitContactMessage } from "@/lib/contact/submit";
import { CONTACT_RATE_WINDOW_MS, type ContactState } from "@/lib/contact/validation";
import { itemLabel, itemOf, sectionOf } from "@/lib/page-copy";

/** `pg` is a Node driver: this handler cannot run on the edge runtime. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The one place a state becomes a URL, so the redirect cannot drift from the page's parser. */
function answer(request: Request, state: ContactState): NextResponse {
  const url = new URL("/help", request.url);
  url.searchParams.set("contact", state);
  return NextResponse.redirect(url, 303);
}

/**
 * The throttle's answer is a **429**, not the 303 every other state gets.
 *
 * The card asks for it in those words (\"a per-address throttle answering 429 without writing\"):
 * a submit the limit refused is not a redirect a bot should read as \"accepted\", and a status code
 * is the one part of the response a script cannot be talked out of. It writes nothing — the
 * decision returns before the insert — and `Retry-After` carries the window, so the refusal is
 * actionable rather than mysterious.
 *
 * A person never meets this page unless they have sent five messages in ten minutes, so it is a
 * small document rather than a state band: the fixture's sentence for `throttled`, and the way
 * back to the form. Its words come from `data/pages/help.ts` like every other sentence this route
 * can cause a reader to see, so the 429 and `?contact=throttled` cannot say different things.
 */
function refused(): NextResponse {
  const band = sectionOf(helpPageCopy, "states");
  const item = itemOf(band, "throttled");
  const heading = item?.label ?? band.heading ?? "";
  const sentence = item?.body ?? "";
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
      <p><a href="/help#contact">${escapeHtml(itemLabel(band, "back"))}</a></p>
    </main>
  </body>
</html>`;
  return new NextResponse(document, {
    status: 429,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "retry-after": String(Math.ceil(CONTACT_RATE_WINDOW_MS / 1000)),
      "x-robots-tag": "noindex",
    },
  });
}

/** No interpolation in this document is a number or a fixed literal, but a fixture's words are. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(request: Request): Promise<NextResponse> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return answer(request, "invalid");
  }
  const value = (key: string): string => {
    const entry = form.get(key);
    return typeof entry === "string" ? entry : "";
  };

  const state = await submitContactMessage(
    {
      name: value("name"),
      email: value("email"),
      message: value("message"),
      website: value("website"),
      startedAt: value("startedAt"),
    },
    {
      now: Date.now(),
      ipHash: ipHashOf(clientIpOf(request.headers)),
      userAgent: request.headers.get("user-agent") ?? "",
      countRecent: countRecentContactMessages,
      store: storeContactMessage,
      mail: (message) => sendContactMessage(message),
      record: recordMailOutcome,
    },
  );

  /**
   * One line per request, in the shape an operator greps: the state, and nothing the sender
   * wrote. The mailer and the store log their own failures with the provider's status or the
   * driver's code; this line says which sentence the visitor saw.
   */
  if (state === "failed") {
    console.error("[contact] the message was not stored and the sender was told so");
  }
  if (state === "throttled") {
    console.warn("[contact] one throttle bucket was over budget; nothing was stored");
    return refused();
  }
  return answer(request, state);
}
