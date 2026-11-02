import { ForgotPasswordView } from "@/components/auth/forgot-password-view";
import { brand, brandIdOf } from "@/data/brand";
import { resetRequestPageCopy } from "@/data/pages/password-reset";
import { AUTH_MARKS_BY_BRAND } from "@/lib/auth/marks";
import type { Metadata } from "next";
import { requestReset } from "./actions";

export const metadata: Metadata = {
  title: "Forgot your password",
};

/**
 * `/forgot-password` — the way back in for anyone who has forgotten a password, and the only way a
 * Google-only account can be reached without Google (#password-reset).
 *
 * A server module for the reason `/login` and `/register` are: the copy is parsed here so the
 * fixture's zod stays out of the bundle, and the action is wired here so the client view holds a
 * function reference rather than a database handle. `data:check` E23 attributes this module and
 * `components/auth/**` to the `/forgot-password` surface.
 *
 * **`force-dynamic`** because the action reads request headers (the client address for the
 * limiter): a prerendered form is fine in itself, but this route never has anything to cache and
 * the page sits behind a limiter whose keys are per request.
 *
 * The route is reachable from `/login` (`data/pages/login.ts`'s `forgot` item) and from
 * `/reset/[token]` when a link is stale — the two places a person actually finds themselves
 * needing it.
 *
 * **The mark is resolved here, on the server** (`AUTH_MARKS_BY_BRAND[brandId]`), the same way
 * `/login` and `/register` resolve theirs: this module may read `data/brand`, and the client view
 * is handed an id. Until this card the route drew nothing of the product at all, which is how the
 * alignment build's reset surface came to have no brand on it.
 */
export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  const marks = AUTH_MARKS_BY_BRAND[brandIdOf(brand)];
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <ForgotPasswordView copy={resetRequestPageCopy} request={requestReset} mark={marks.hero} />
    </main>
  );
}
