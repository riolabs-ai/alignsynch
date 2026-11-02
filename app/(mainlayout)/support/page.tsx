import { AccountSupportPage } from "@/components/support/account-support-page";
import { brand } from "@/data/brand";
import { supportPageCopy } from "@/data/pages/support";
import { currentUserIfConfigured } from "@/lib/auth/session";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: supportPageCopy.heading,
};

/**
 * Where a visitor with no session is sent. `/help` and not `/login`: the answers are public, and a
 * signed-out reader who asked for support wants the FAQ page, not a sign-in form. The route they
 * came from is still one URL, and this is the second of its two correct answers.
 */
const HELP_PATH = "/help";

/**
 * `/support` — the account support page: the contact form, inside the app shell.
 *
 * **The redirect is the split.** `/support` used to be the public hub; it is the in-app account
 * page now, and the same URL therefore has two answers — the account page for a member, `/help`
 * for everybody else. Resolving that in the page (session first, then `redirect`) is deliberate:
 * a blanket `next.config.mjs` redirect would send the member away from the page they can use, and
 * a 404 would make a real surface read as a bug.
 *
 * **`currentUserIfConfigured`, not `currentUser`.** `currentUser()` throws when `NEON_AUTH_*` is
 * absent, on purpose — a page behind an auth wall must not turn a deployment mistake into an
 * endless signed-out session. But no auth environment also means no session can exist, so the
 * honest answer for every request is `/help`, not a 500 on the route the marketing footer links.
 * This is the same question `lib/auth/config.ts::authConfigured()` answers for the flags, and the
 * gate (which carries no auth env) exercises exactly this branch.
 *
 * `force-dynamic` for the reason every gated route carries it: the session is per-request, so the
 * build must never prerender the page, and `pnpm build` passes with neither `NEON_AUTH_*` nor
 * `DATABASE_URL` set. Nothing here reads a database.
 */
export default async function SupportPage() {
  const user = await currentUserIfConfigured();
  if (user === null) redirect(HELP_PATH);

  return <AccountSupportPage copy={supportPageCopy} supportEmail={brand.supportEmail} />;
}
