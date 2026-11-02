/**
 * The news signup's pure half: what an address is, what may be said about it, and where the
 * person was standing.
 *
 * The band this serves is the footer's, so it runs on every marketing page and every product
 * page that mounts `components/layout/footer.tsx`. Three rules live here and nowhere else,
 * because all three are decided in more than one place if they are written twice:
 *
 *   normalise   one mailbox is one row. `Mailbox@Example.com` and `mailbox@example.com` differ
 *               only in case, and `0019_news_signup.sql`'s CHECK refuses a row that is not
 *               lower-cased — so the string the store writes and the string the mailer addresses
 *               are the same function of the input.
 *   refuse      an address that cannot receive mail is refused **before** anything is written,
 *               which is what makes "zero rows written" a property of the code rather than of a
 *               rollback. The shape test is `emailLooksDeliverable()` from `lib/flow/resend.ts` —
 *               the same one the invitation's address is held to, so the app has one answer to
 *               "is this deliverable-shaped".
 *   source      the page path the form was submitted from. It arrives from the request, so it is
 *               checked here: only a root-relative path is accepted, and anything else falls back
 *               to `/`. That is a redirect-safety rule as much as a data rule — the route handler
 *               redirects a no-JavaScript submit back to this value.
 *
 * No `pg`, no React, no clock: `tests/news-signup.test.ts` drives every branch.
 */
import { emailLooksDeliverable } from "@/lib/flow/resend";

export { NEWS_SIGNUP_STATES, type NewsSignupState, newsSignupStateOf } from "@/lib/news/states";

/** The one normal form of an address: trimmed, lower-cased, and nothing else. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Why this address may not be stored, or `undefined` when it may.
 *
 * `empty` and `invalid` are separate codes because they are different sentences to a person who
 * left the field alone versus one who typed `avery@`. Both refuse before the write.
 */
export function newsSignupRefusal(raw: unknown): "empty" | "invalid" | undefined {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value === "") return "empty";
  return emailLooksDeliverable(value) ? undefined : "invalid";
}

/**
 * The page path a submit came from, or `/`.
 *
 * Only a single-slash root-relative path survives: `//evil.example` is a protocol-relative URL
 * (a browser follows it off-site) and `https://…` is absolute, so neither may land in the
 * fallback page's link home. The value is also what the row stores, so a junk `source` is
 * refused at both ends.
 */
export function sourcePathOf(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  if (/\s/.test(value)) return "/";
  return value.split("?")[0]?.split("#")[0] || "/";
}
