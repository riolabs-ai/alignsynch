// template-ancestor: components/auth/login-view.tsx   (variation: the success band alone — no fields, no submit, one sentence and a way back to sign in)

import type { PageCopy } from "@/content/pages";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

/**
 * The `/reset/complete` band — the screen a spent link lands on (#password-reset).
 *
 * A server component with no state on purpose: by the time it renders, the password is set and
 * every session is gone, so there is nothing left to ask the server about and nothing that can
 * fail. It is a component rather than markup in the page module so the copy has an owner in
 * `components/auth/**` (E23 attributes a surface by what the page renders) and so the band can be
 * reused by the next flow that finishes somewhere.
 *
 * The words are `data/pages/password-reset.ts`'s `complete` band, passed in by the page. The one
 * sentence the card requires — other devices are signed out — is `signed-out`, and it is a fact
 * the store measured (`revokeSessions` returned a count) rather than a promise.
 */
export function ResetCompleteView({ copy }: { copy: PageCopy }) {
  const band = sectionOf(copy, "complete");
  return (
    <div className="w-full max-w-md space-y-4 text-center">
      <h1 className="text-3xl font-bold">{copy.heading}</h1>
      {copy.subtitle !== undefined && <p className="text-muted-foreground">{copy.subtitle}</p>}
      <p className="text-sm text-muted-foreground">{itemLabel(band, "signed-out")}</p>
      <Link href="/login" className="inline-flex items-center gap-1 font-medium text-action">
        {itemLabel(band, "sign-in")}
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
