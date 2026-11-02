"use client";

// template-ancestor: components/identity/settings-view.tsx   (variation: two password fields and one outcome band, over the same session)

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PageCopy } from "@/content/pages";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  resetSetItemId,
  type ResetSetOutcome,
} from "@/lib/auth/reset-token";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";
import { Loader2 } from "lucide-react";
import { type FormEvent, useState } from "react";

/**
 * The password card on `/settings` — the "set a password" path for a Google-only account.
 *
 * This is the half of the card that makes the gap real: an account created through Google has one
 * `google` provider row and no credential row, so it has never had a password and no reset email
 * can reach it (there is no password to forget). If the Google provider is unavailable — a rotated
 * client, an outage, a locked personal account — that person is locked out permanently. Being
 * signed in *now* is the one thing they still have, so the session is the proof and this card is
 * the door.
 *
 * It serves an account that already has a password too, with different words ("Change the password
 * you sign in with") and the same mechanism: the provider's own `setPassword` semantics, where a
 * live session authorises the write. There is no current-password field on purpose — the session
 * has already answered that question, and asking again would mean storing the answer to ask it.
 *
 * Every word is `data/pages/settings.ts`'s `password` band (`sectionOf(copy, "password")`), and
 * every refusal is one row of that band, joined through `resetSetItemId`. The card writes no copy of
 * its own — E23's budget for `/settings` is 0, so a sentence typed here is a red build.
 */
export function PasswordCard({
  copy,
  hasPassword,
  save,
}: {
  copy: PageCopy;
  /** Whether the account already has a password — a server read, never guessed from a provider id. */
  hasPassword: boolean;
  save: (input: { password: string; confirmation: string }) => Promise<ResetSetOutcome>;
}) {
  const band = sectionOf(copy, "password");
  const values = { min: String(PASSWORD_MIN_LENGTH), max: String(PASSWORD_MAX_LENGTH) };
  const [passwordValue, setPasswordValue] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<ResetSetOutcome | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setOutcome(null);
    try {
      const result = await save({ password: passwordValue, confirmation });
      setOutcome(result);
      // Cleared on success only: a refusal leaves the fields as typed, so a length fix is one
      // character rather than a retype.
      if (result.kind === "set") {
        setPasswordValue("");
        setConfirmation("");
      }
    } catch {
      setOutcome({ kind: "unavailable" });
    } finally {
      setPending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{band.heading}</CardTitle>
        <CardDescription>{itemLabel(band, hasPassword ? "body-set" : "body-none")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">{itemLabel(band, "password")}</Label>
            <Input
              id="new-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
              value={passwordValue}
              onChange={(event) => setPasswordValue(event.target.value)}
              placeholder={fillLabel(itemLabel(band, "password-placeholder"), values)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">{itemLabel(band, "confirm")}</Label>
            <Input
              id="confirm-password"
              name="confirmation"
              type="password"
              autoComplete="new-password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder={itemLabel(band, "confirm-placeholder")}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {fillLabel(itemLabel(band, "hint"), values)}
          </p>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {pending
              ? itemLabel(band, "pending")
              : itemLabel(band, hasPassword ? "submit-set" : "submit-none")}
          </Button>
        </form>

        {outcome !== null &&
          (outcome.kind === "set" ? (
            <p aria-live="polite" className="text-sm text-emerald-600">
              {itemLabel(band, "outcome-set")}
            </p>
          ) : (
            <p aria-live="polite" className="text-sm text-red-600">
              {fillLabel(itemLabel(band, resetSetItemId(outcome.kind)), values)}
            </p>
          ))}
      </CardContent>
    </Card>
  );
}
