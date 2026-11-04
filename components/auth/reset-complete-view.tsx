// template-ancestor: components/auth/login-view.tsx   (variation: the success band alone — no fields, no submit, one sentence and a way back to sign in)

import { AuthHomeLink } from "@/components/auth/auth-home-link";
import {
  markBoxClass,
  markGroundClass,
  markTileClass,
  MarkGlyph,
} from "@/components/auth/mark-icon";
import type { PageCopy } from "@/content/pages";
import type { AuthMarkId } from "@/lib/auth/marks";
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
 *
 * **Two doors and a mark.** `mark` is this build's glyph, resolved on the server
 * (`AUTH_MARKS_BY_BRAND`) exactly like `/login`'s and `/register`'s, so the end of the reset flow
 * is not a bare page on the alignment build; `home` is the way back to the site, which this band
 * never had — a person who has just set a password is the least likely to want another form, and
 * the only control here used to be one.
 */
export function ResetCompleteView({
  copy,
  mark,
  markSrc,
}: {
  copy: PageCopy;
  mark: AuthMarkId;
  /** The image the `brand-mark` id draws (`AUTH_MARK_SRC_BY_BRAND`), handed down beside the id. */
  markSrc: string;
}) {
  const band = sectionOf(copy, "complete");
  const home = sectionOf(copy, "home");
  return (
    <div className="w-full max-w-md space-y-4 text-center">
      <div
        className={`mx-auto mb-2 flex ${markTileClass(mark, "h-12 w-12")} items-center justify-center rounded-xl ${markGroundClass(mark)}`}
      >
        <MarkGlyph
          id={mark}
          src={markSrc}
          className={`${markBoxClass(mark)} text-action-foreground`}
        />
      </div>
      <h1 className="text-3xl font-bold">{copy.heading}</h1>
      {copy.subtitle !== undefined && <p className="text-muted-foreground">{copy.subtitle}</p>}
      <p className="text-sm text-muted-foreground">{itemLabel(band, "signed-out")}</p>
      <div className="flex items-center justify-center gap-6">
        <Link href="/login" className="inline-flex items-center gap-1 font-medium text-action">
          {itemLabel(band, "sign-in")}
          <ArrowRight className="h-3 w-3" />
        </Link>
        <AuthHomeLink label={itemLabel(home, "back")} />
      </div>
    </div>
  );
}
