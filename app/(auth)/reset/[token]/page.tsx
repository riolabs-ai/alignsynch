import { ResetPasswordView } from "@/components/auth/reset-password-view";
import { resetFormPageCopy } from "@/data/pages/password-reset";
import { readResetToken } from "@/lib/auth/reset-set";
import type { ResetTokenState } from "@/lib/auth/reset-token";
import { DatabaseUnavailableError } from "@/lib/db/client";
import type { Metadata } from "next";
import { setPassword } from "./actions";

export const metadata: Metadata = {
  title: "Set a new password",
  /**
   * The token is in this page's own path, so it must not travel anywhere in a referer header.
   * `next.config.mjs` also sends `Referrer-Policy: no-referrer` for `/reset/:path*`; this tag is
   * the belt to that brace, because the header is a deployment configuration and a page that
   * depends on it being right is a page that leaks if it is not.
   */
  referrer: "no-referrer",
};

/**
 * `/reset/[token]` — spend a link (#password-reset).
 *
 * **The state is read on the server, before anything renders.** `readResetToken` classifies the
 * path segment as `valid`, `unknown`, `expired`, `used` or `unavailable` and the view draws a form
 * only for the first: a dead link gets a sentence and a way to ask for another one, instead of a
 * form that would refuse on submit. The action re-reads it, because a page can sit open past the
 * token's hour.
 *
 * `params` is a Promise in Next 16 and is awaited — a synchronous `params.token` would render with
 * `undefined` and this page would answer "not one we issued" for every link.
 *
 * A database that is down is `unavailable`, not `unknown`: telling somebody their link is not ours
 * because the pool could not answer is a false statement about a credential they are holding.
 *
 * `force-dynamic` for the ordinary reason: the state is per request, and nothing here may be
 * cached — a cached "valid" for a spent token is the bug this page exists to avoid.
 */
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let state: ResetTokenState;
  try {
    state = await readResetToken(token);
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) state = "unavailable";
    else throw error;
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <ResetPasswordView
        copy={resetFormPageCopy}
        token={token}
        state={state}
        setPassword={setPassword}
      />
    </main>
  );
}
