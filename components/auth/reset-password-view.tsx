"use client";

// template-ancestor: components/auth/login-view.tsx   (variation: two password fields, no email, and the credential is the link in the address)

import { AuthHomeLink } from "@/components/auth/auth-home-link";
import {
  markBoxClass,
  markGroundClass,
  markTileClass,
  MarkGlyph,
} from "@/components/auth/mark-icon";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormSurface } from "@/components/ui/form-surface";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PageCopy } from "@/content/pages";
import type { AuthMarkId } from "@/lib/auth/marks";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  resetSetItemId,
  resetTokenStateItemId,
  type ResetSetOutcome,
  type ResetTokenState,
} from "@/lib/auth/reset-token";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

/**
 * `/reset/[token]`, the client half.
 *
 * Two shapes, chosen by the *server*: the token's state was read before this component rendered,
 * so a link that is expired, spent or simply not ours draws a sentence and an address to ask for a
 * new one — never a form that would fail on submit. The form is only mounted for a token that is
 * live at render time, and it re-checks on the server anyway, because a page can sit open for an
 * hour.
 *
 * **On success the view navigates to `/reset/complete`** rather than drawing a success band here.
 * That is a security decision, not a layout one: the token is a bearer credential in the path, and
 * the one place it must not stay is the address bar and the browser's history once it has been
 * spent. The destination carries no token and says the thing the card asks the success screen to
 * say — every other device was signed out.
 *
 * Failures are the closed set `ResetSetOutcome` names, each with its own sentence, so "expired",
 * "already used" and "not one we issued" are never collapsed into "invalid link".
 */
export function ResetPasswordView({
  copy,
  token,
  state,
  setPassword,
  mark,
  markSrc,
}: {
  copy: PageCopy;
  token: string;
  state: ResetTokenState;
  setPassword: (input: {
    token: string;
    password: string;
    confirmation: string;
  }) => Promise<ResetSetOutcome>;
  /**
   * This build's mark, resolved on the server from `lib/auth/marks.ts` and passed down as an id —
   * the same contract `/forgot-password` and `/register` use, and the only mechanism here.
   *
   * The route had none before: a person who opened the link from their mail saw a bare form with
   * nothing of the product on it. It is an id, not a component, because a React component is not a
   * serialisable prop across the server→client boundary and this view is a client module.
   */
  mark: AuthMarkId;
  /** The image the `brand-mark` id draws (`AUTH_MARK_SRC_BY_BRAND`), handed down beside the id. */
  markSrc: string;
}) {
  const band = sectionOf(copy, "form");
  /** The way back to the site (`auth-home-link.tsx`); `back` above is the way back to sign-in. */
  const home = sectionOf(copy, "home");
  const values = { min: String(PASSWORD_MIN_LENGTH), max: String(PASSWORD_MAX_LENGTH) };
  const router = useRouter();
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
      const result = await setPassword({
        token,
        password: passwordValue,
        confirmation,
      });
      if (result.kind === "set") {
        router.replace("/reset/complete");
        return;
      }
      setOutcome(result);
    } catch {
      setOutcome({ kind: "unavailable" });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      <header className="space-y-2 text-center">
        <div
          className={`mx-auto mb-4 flex ${markTileClass(mark, "h-12 w-12")} items-center justify-center rounded-xl ${markGroundClass(mark)}`}
        >
          <MarkGlyph
            id={mark}
            src={markSrc}
            className={`${markBoxClass(mark)} text-action-foreground`}
          />
        </div>
        <h1 className="text-3xl font-bold">{copy.heading}</h1>
        {copy.subtitle !== undefined && <p className="text-muted-foreground">{copy.subtitle}</p>}
      </header>

      <FormSurface>
        <CardHeader>
          <CardTitle>{band.heading}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === "valid" ? (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-password">{itemLabel(band, "password")}</Label>
                <Input
                  id="reset-password"
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
                <Label htmlFor="reset-confirm">{itemLabel(band, "confirm")}</Label>
                <Input
                  id="reset-confirm"
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
              <Button type="submit" className="w-full" disabled={pending}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {pending ? itemLabel(band, "pending") : itemLabel(band, "submit")}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {fillLabel(itemLabel(band, resetTokenStateItemId(state)), values)}
              </p>
              <Button asChild className="w-full">
                <Link href="/forgot-password">{itemLabel(band, "request-new")}</Link>
              </Button>
            </div>
          )}

          {outcome !== null && outcome.kind !== "set" && (
            <p aria-live="polite" className="text-sm text-red-600">
              {fillLabel(itemLabel(band, resetSetItemId(outcome.kind)), values)}
            </p>
          )}
        </CardContent>
      </FormSurface>

      <div className="flex items-center justify-between gap-4">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          {itemLabel(band, "back")}
        </Link>
        <AuthHomeLink label={itemLabel(home, "back")} />
      </div>
    </div>
  );
}
