"use client";

// template-ancestor: components/identity/password-card.tsx   (variation: a destructive action behind a typed phrase, over the same session)

import type { DeleteAccountOutcome } from "@/app/(mainlayout)/settings/delete-account-actions";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormSurface } from "@/components/ui/form-surface";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PageCopy } from "@/content/pages";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

/**
 * `/settings`' delete-account card (#278) — the in-app control the spec's §5 sentence needed.
 *
 * The card exists because the sentence on this page used to be a promise with no mechanism behind
 * it ("account deletion isn't available in-app yet"). What replaced it is the mechanism: the typed
 * phrase, then `deleteAccount`, which deletes the managed-auth user and scrubs `public` in one
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
        <CardTitle className="text-destructive">{band.heading}</CardTitle>
        {band.body !== undefined && <CardDescription>{band.body}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
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
          <Button type="submit" variant="destructive" disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {pending ? itemLabel(band, "pending") : itemLabel(band, "submit")}
          </Button>
        </form>

        {outcome !== null && (
          <p
            aria-live="polite"
            className={
              outcome.kind === "deleted" ? "text-sm text-emerald-600" : "text-sm text-red-600"
            }
          >
            {itemLabel(band, `outcome-${outcome.kind}`)}
          </p>
        )}
      </CardContent>
    </FormSurface>
  );
}
