"use server";

/**
 * `landingAfterSignIn` — the question the sign-in form asks **after** the password was accepted
 * (#1252).
 *
 * The login page validates `?next=` and hands the form a destination, but it validates it for a
 * request that is still **signed out**, and the role — the thing that decides where a stakeholder
 * lands — only exists once there is a session to read. So the form signs in, then asks this action
 * one question: "given who I just became, where do I go?"
 *
 * The answer is `lib/auth/paths.ts::signInLanding`, the same pure rule the Google finish route
 * runs, and it keeps every existing promise: a `next` that survived both gates still wins, an
 * unsafe or unshipped one has already become the brand's landing page, `admin`/`owner`/`member`/
 * `support` are unchanged, and a `stakeholder` with nothing asked for lands on `/admin/spec`.
 *
 * **Fails open to what the form already had.** A refused or failed action is not a failed sign-in:
 * the view falls back to the `next` prop it was rendered with, which is the destination every
 * brand had before this card. `currentRole()` answers `null` whenever no session can be read,
 * which is also a "keep the destination" answer — never a redirect loop.
 *
 * The raw `?next=` value arrives **bound on the server** (`.bind(null, target)` in
 * `app/(auth)/login/page.tsx`), so the view never carries a URL it could rewrite: the argument is
 * request data from the page's own parse, and `signInDestination` re-validates it here anyway.
 */
import { brand, brandIdOf } from "@/data/brand";
import { signInDestination } from "@/lib/auth/next-path";
import { AFTER_SIGN_IN_BY_BRAND, signInLanding } from "@/lib/auth/paths";
import { currentRole } from "@/lib/auth/require-role";

export async function landingAfterSignIn(requested: string | null): Promise<string> {
  const destination = AFTER_SIGN_IN_BY_BRAND[brandIdOf(brand)];
  const settled = signInDestination(requested, destination);
  return signInLanding(await currentRole(), settled, destination);
}
