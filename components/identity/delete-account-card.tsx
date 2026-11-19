"use client";

// template-ancestor: components/identity/password-card.tsx   (variation: a destructive action behind a typed phrase, over the same session)

import type { DeleteAccountOutcome } from "@/app/(mainlayout)/settings/delete-account-actions";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { FormSurface } from "@/components/ui/form-surface";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PageCopy } from "@/content/pages";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";
import { Check, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

/**
 * `/settings`' delete-account card (#278) — the in-app control the spec's §5 sentence needed.
 *
 * The card exists because the sentence on this page used to be a promise with no mechanism behind
 * it ("account deletion isn't available in-app yet"). What replaced it is the mechanism: the typed
 * phrase, then `deleteAccountAction`, which deletes the managed-auth user and scrubs `public` in one
 * transaction (`lib/account/purge.ts`).
 *
 * Every word is `data/pages/settings.ts`'s `deletion` band — E23's budget for `/settings` is 0, so
 * a sentence typed here is a red build. The phrase itself comes from the same band, and the server
 * compares against it, so the card cannot show one phrase and check another.
 *
 * **It does not decide anything.** The action re-resolves the session, re-checks the phrase and
 * performs the deletion on the server; this component only carries the typed value there and
 * renders the answer. A disabled button is a courtesy, not a permission.
 */
export function DeleteAccountCard({
  copy,
  remove,
}: {
  copy: PageCopy;
  remove: (confirmation: string) => Promise<DeleteAccountOutcome>;
}) {
  const band = sectionOf(copy, "deletion");
  const phrase = itemLabel(band, "confirm-phrase");
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<DeleteAccountOutcome | null>(null);
  const router = useRouter();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setOutcome(null);
    try {
      const result = await remove(typed);
      setOutcome(result);
      if (result.kind === "deleted") {
        // The session died with the account, so there is no signed-in page left to stay on.
        // `/` is the one route that renders for a request with no session.
        setTyped("");
        router.push("/");
        router.refresh();
      }
    } catch {
      setOutcome({ kind: "unavailable" });
    } finally {
      setPending(false);
    }
  };

  return (
    <FormSurface>
      <CardHeader>
        <h2 id="settings-deletion" className="text-base font-semibold text-primary">
          {band.heading}
        </h2>
        {band.body !== undefined && <CardDescription>{band.body}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="delete-confirmation">
              {fillLabel(itemLabel(band, "confirm-label"), { phrase })}
            </Label>
            <Input
              id="delete-confirmation"
              name="confirmation"
              autoComplete="off"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder={itemLabel(band, "confirm-placeholder")}
            />
          </div>
          <p className="text-xs text-muted-foreground">{itemLabel(band, "retained")}</p>
          {/*
            **Neutral outline with an ×, never red** (locked rule 4, #1136). The bundle draws the
            destructive control as an ordinary outlined button with a cross beside it; the palette
            has one red and it belongs to the answer scale. The typed phrase above is the guard, not
            the colour — a red button was never what made this safe.
          */}
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <X aria-hidden="true" className="mr-2 size-4 shrink-0" />
            )}
            {pending ? itemLabel(band, "pending") : itemLabel(band, "submit")}
          </Button>
        </form>

        {outcome !== null && (
          <p aria-live="polite" className="flex items-center gap-2 text-sm text-foreground">
            {outcome.kind === "deleted" ? (
              <Check aria-hidden="true" className="size-4 shrink-0" />
            ) : (
              <X aria-hidden="true" className="size-4 shrink-0" />
            )}
            {itemLabel(band, `outcome-${outcome.kind}`)}
          </p>
        )}
      </CardContent>
    </FormSurface>
  );
}
