/**
 * The confirmation's words, and the send.
 *
 * **No second mailer.** `lib/flow/email.ts` owns the transport: `sendMail()` reads
 * `RESEND_API_KEY`, falls back to `RESEND_FROM || DEFAULT_FROM`, posts to `mailEndpoint()` and
 * answers `sent` / `unset` / `failed` without throwing. This module builds one message and hands
 * it over, which is why the news band cannot invent a different sender, a different endpoint or a
 * second retry policy. (`lib/flow/resend.ts`, which the card names, is the *re-invite* rule and
 * its address validator — `emailLooksDeliverable` is reused from there in `lib/news/signup.ts`.)
 *
 * **The words are the fixture's.** `data/pages/shell.ts`'s `footer-news` section owns them, so
 * the sentence under the form and the sentence in the mailbox cannot drift; `fillLabel()` fills
 * `{brand}`, `{email}` and `{support}`. The message is deliberately short and claims no cadence:
 * it says what the person asked for, that this note confirms it, and how to stop — a schedule
 * nobody has committed to would be a promise in a mailbox.
 *
 * Nothing here puts an address in a log line; `sendMail()` logs the provider's status only.
 */
import { brand } from "@/data/brand";
import { shellPageCopy } from "@/data/pages/shell";
import { sendMail, type MailOutcome, type MailMessage } from "@/lib/flow/email";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";

/** The fixture band the footer renders and this message reads. */
export const NEWS_BAND_ID = "footer-news";

/**
 * The confirmation for one address.
 *
 * `to` is the normalised address the row was written with — the caller passes the stored value,
 * not the raw form field, so the mailbox that receives the note and the row in the table cannot
 * disagree about capitalisation.
 */
export function newsConfirmationMessage(to: string): MailMessage {
  const band = sectionOf(shellPageCopy, NEWS_BAND_ID);
  const values = {
    brand: brand.name,
    email: to,
    support: brand.supportEmail,
  };
  return {
    to,
    subject: fillLabel(itemLabel(band, "confirm-subject"), values),
    text: fillLabel(itemLabel(band, "confirm-body"), values),
  };
}

/**
 * Send it, or say what kind of not-sent this was — the same three outcomes as every other
 * message in the app, because it is the same transport.
 */
export async function sendNewsConfirmation(
  message: MailMessage,
  fetchImpl: typeof fetch = fetch,
): Promise<MailOutcome> {
  return sendMail(message, { sender: "news", fetchImpl });
}
