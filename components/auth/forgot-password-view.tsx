"use client";

// template-ancestor: components/auth/login-view.tsx   (variation: one email field and one button, and the answer is a sentence rather than a session)

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PageCopy } from "@/content/pages";
import {
  RESET_TTL_MINUTES,
  resetRequestItemId,
  type ResetRequestOutcome,
} from "@/lib/auth/reset-token";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";

/**
 * `/forgot-password`, the client half. The words come from `data/pages/password-reset.ts`, parsed
 * by the page module and passed in — this is a client boundary and the fixture carries zod.
 *
 * **The view cannot tell whether an address has an account, and does not try.** It posts the
 * address, receives one of five outcomes, and draws the fixture's sentence for that outcome. Four
 * of the five are properties of the request (sent/none, no mailer, send failed, throttled, not an
 * address); the fifth — `unset`'s link — is the deployment's own state showing through, which is
 * the only way this page can be both "no account enumeration" and "never claim an email that did
 * not go out" on a tree with no `RESEND_*`.
 *
 * `request` is a server action wired by the page module, never an `authClient` call: the address
 * lookup, the limiter and the mail transport are all server-side, and a browser that could call
 * them directly could call them in any order.
 *
 * A thrown action (a dropped connection, a 500) is drawn as `failed` — "the reset email could not
 * be sent" — rather than as an error dialog, because from here that is exactly what happened.
 */
export function ForgotPasswordView({
  copy,
  request,
}: {
  copy: PageCopy;
  request: (email: string) => Promise<ResetRequestOutcome>;
}) {
  const band = sectionOf(copy, "request");
  const values = { minutes: String(RESET_TTL_MINUTES) };
  const [address, setAddress] = useState("");
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<ResetRequestOutcome | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setOutcome(null);
    try {
      setOutcome(await request(address));
    } catch {
      setOutcome({ kind: "failed" });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      <header className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">{copy.heading}</h1>
        {copy.subtitle !== undefined && (
          <p className="text-muted-foreground">{fillLabel(copy.subtitle, values)}</p>
        )}
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{band.heading}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">{itemLabel(band, "email")}</Label>
              <Input
                id="reset-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder={itemLabel(band, "email-placeholder")}
              />
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {pending ? itemLabel(band, "pending") : itemLabel(band, "submit")}
            </Button>
          </form>

          {outcome !== null && (
            <div aria-live="polite" className="mt-4 space-y-2 text-sm">
              <p className="text-muted-foreground">
                {fillLabel(itemLabel(band, resetRequestItemId(outcome.kind)), values)}
              </p>
              {outcome.kind === "unset" && (
                <Link href={outcome.link} className="font-medium text-action underline">
                  {itemLabel(band, "link")}
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          {itemLabel(band, "back")}
        </Link>
      </div>
    </div>
  );
}
