import { ResetCompleteView } from "@/components/auth/reset-complete-view";
import { resetCompletePageCopy } from "@/data/pages/password-reset";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Password set",
  referrer: "no-referrer",
};

/**
 * `/reset/complete` — the success screen, at an address that carries no token.
 *
 * It exists as its own route rather than as a band on `/reset/[token]` for one reason: the token is
 * a bearer credential in the path, and the moment it has been spent it should leave the address bar
 * and the browser's history. The form navigates here on success, so this page is what a person
 * sees — and what they see is the sentence the card asks for: every other device has been signed
 * out.
 *
 * A static page by construction: no session (the reset revoked them all), no database, no props. It
 * cannot fail, which is why the band states the fact plainly instead of offering a status.
 */
export default function ResetCompletePage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <ResetCompleteView copy={resetCompletePageCopy} />
    </main>
  );
}
