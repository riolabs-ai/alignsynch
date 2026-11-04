"use server";

/**
 * `POST /dashboard/support` — the dashboard's request form (#542 phase 1), as a server action.
 *
 * **The decision is `lib/contact/submit.ts`, not a second copy of it.** The public route and this
 * action hand the same fields to the same function, so the order the card cares about — invisible
 * spam answer, validation, the per-address throttle, the insert, and only then the mail — is the
 * one implementation. The action's own job is three things: whose identity the message carries,
 * where the answer goes, and what the page can say afterwards.
 *
 * **The identity is the session's.** `requireRole("member", …)` resolves the account, and the name
 * and address the message stores are that account's, never the form's two read-only inputs. A
 * crafted POST that posts somebody else's address changes nothing: `storeContactMessage` is handed
 * the session's, which is also what makes `readOwnContactMessage(id, user.email)` on the page a
 * real check rather than a formality.
 *
 * **The redirect carries an id, and only when a row exists.** `submitContactMessage` reports a
 * state; this action wraps its `store` dependency to keep the id the insert returned, so a
 * successful submit answers `?contact=<state>&thread=<id>` and the page re-reads that row. The spam
 * answer (a filled honeypot, a submit too fast for a person) deliberately produces no id — the bot
 * gets the ordinary success page and nothing is written, and the page's plain `sent` sentence is
 * the truth about a message that does not exist.
 *
 * **Nothing sensitive is logged.** The public route's rule applies here unchanged: a failure line
 * names the step, never the message, the address, the name, or the database URL.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/require-role";
import { clientIpOf, ipHashOf } from "@/lib/contact/ip";
import { sendContactMessage } from "@/lib/contact/mail";
import {
  countRecentContactMessages,
  recordMailOutcome,
  storeContactMessage,
} from "@/lib/contact/store";
import { submitContactMessage } from "@/lib/contact/submit";
import { DASHBOARD_SUPPORT_PATH } from "@/lib/flow/paths";

/** One form value as a string — a missing field is `""`, never `undefined`. */
function fieldOf(formData: FormData, key: string): string {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry : "";
}

export async function sendSupportMessage(formData: FormData): Promise<void> {
  const { user } = await requireRole("member", { next: DASHBOARD_SUPPORT_PATH });

  /**
   * The id the insert returned, kept in a holder rather than a `let`: TypeScript narrows a
   * `let` initialised to `null` and does not see the assignment inside the callback below, so the
   * check after the call would read as unreachable and `params.set` would receive `never`.
   */
  const stored: { id?: string } = {};
  const headerBag = await headers();

  const state = await submitContactMessage(
    {
      name: user.name?.trim() === "" || user.name === undefined ? user.email : user.name,
      email: user.email,
      message: fieldOf(formData, "message"),
      website: fieldOf(formData, "website"),
      startedAt: fieldOf(formData, "startedAt"),
    },
    {
      now: Date.now(),
      ipHash: ipHashOf(clientIpOf(headerBag)),
      userAgent: headerBag.get("user-agent") ?? "",
      countRecent: countRecentContactMessages,
      store: async (input) => {
        const id = await storeContactMessage(input);
        stored.id = id;
        return id;
      },
      mail: (message) => sendContactMessage(message),
      record: recordMailOutcome,
    },
  );

  if (state === "failed") {
    console.error("[support] the message was not stored and the sender is being told so");
  }

  const params = new URLSearchParams({ contact: state });
  if (stored.id !== undefined) params.set("thread", stored.id);
  redirect(`${DASHBOARD_SUPPORT_PATH}?${params.toString()}`);
}
