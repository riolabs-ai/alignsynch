"use client";

// template-ancestor: components/identity/password-card.tsx   (variation: one sentence about the session, one outline control that ends it)

/**
 * The Session card on `/settings` (#1136) — bundle 11's fifth section.
 *
 * It exists because the page carried two account controls at the bottom of a card called "Account"
 * — the address and a sign-out button — and the v2 page draws the address inside Profile and the
 * session as its **own** card: one sentence naming who is signed in and where, and one control that
 * ends it. Nothing here is new behaviour: the control runs `endSession()` (`lib/auth/sign-out.ts`),
 * the same step the rail's row and the account menu's row run, so the three doors cannot disagree
 * about whether the session was revoked.
 *
 * **Where it lands is `accountSignOutFor(brandId)`'s**, not this component's: the v2 build goes to
 * the public catalog and confirms with the fixture's sentence, the quiz build keeps the front page
 * it shipped. The confirmation is the bundle's own — a silent redirect reads as "the page changed".
 *
 * The button is an outline button with the sign-out glyph, exactly as the bundle measures it
 * (`settings.html`, Session). It is **not** destructive: locked rule 4 keeps red off every v2
 * surface, and signing out destroys nothing — the account and every relationship stay.
 *
 * Every word is `data/pages/settings.ts`'s `session` band (E23's budget for `/settings` is 0).
 */
import { Button } from "@/components/ui/button";
import { CardDescription, CardHeader } from "@/components/ui/card";
import { FormSurface } from "@/components/ui/form-surface";
import type { PageCopy } from "@/content/pages";
import type { BrandId } from "@/data/brand";
import { endSession } from "@/lib/auth/sign-out";
import { fillLabel, itemLabel, itemLabelOr, sectionOf } from "@/lib/page-copy";
import { accountSignOutFor } from "@/lib/shell/account-sign-out";
import { LogOut, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function SessionCard({
  copy,
  name,
  brandId,
}: {
  copy: PageCopy;
  /** The session's display name — the sentence's `{name}`. */
  name: string;
  /**
   * Which build's landing to use (`lib/shell/account-sign-out.ts`). `/settings` answers on both
   * brands, so the card inherits the page's own brand rather than hard-coding the v2 landing.
   */
  brandId: BrandId;
}) {
  const band = sectionOf(copy, "session");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const signOut = async () => {
    if (pending) return;
    setPending(true);
    setFailed(false);
    if (!(await endSession())) {
      // A failed revocation is said out loud and the control comes back: a button that reported
      // success while the cookie stayed valid is the defect #272 exists to prevent.
      setPending(false);
      setFailed(true);
      return;
    }
    const landing = accountSignOutFor(brandId);
    const says = landing.toast === undefined ? undefined : itemLabelOr(band, landing.toast);
    if (says !== undefined) toast(says);
    router.replace(landing.href);
    router.refresh();
  };

  return (
    <FormSurface>
      <CardHeader>
        <h2 id="settings-session" className="text-base font-semibold text-primary">
          {band.heading}
        </h2>
        {band.body !== undefined && (
          <CardDescription>{fillLabel(band.body, { name })}</CardDescription>
        )}
      </CardHeader>
      <div className="space-y-2 px-4 pb-4 lg:px-6">
        <Button type="button" variant="outline" onClick={signOut} disabled={pending}>
          <LogOut aria-hidden="true" className="mr-2 size-4 shrink-0" />
          {pending ? itemLabel(band, "signing-out") : itemLabel(band, "sign-out")}
        </Button>
        {failed && (
          <p role="status" className="flex items-center gap-2 text-sm text-foreground">
            <X aria-hidden="true" className="size-4 shrink-0" />
            {itemLabel(band, "error")}
          </p>
        )}
      </div>
    </FormSurface>
  );
}
