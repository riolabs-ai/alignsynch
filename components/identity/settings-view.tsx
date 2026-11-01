"use client";

// template-ancestor: components/settings/account-settings.tsx   (variation: the settings page over the identity record — four cards, one form each)

import { SignOutButton } from "@/components/identity/sign-out-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { PublicProfile } from "@/content/identity";
import type { PageCopy } from "@/content/pages";
import { loginPathFor } from "@/lib/auth/paths";
import { fillLabel, itemLabel, itemOf, sectionOf } from "@/lib/page-copy";
import { GeneratedAvatar } from "@/components/media/generated-avatar";
import { Check, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

/**
 * `/settings`, the editable half (issue #164).
 *
 * One form, one `POST /api/profile`. What it changes is exactly what `content/identity.ts` holds:
 * display name, handle, bio, the country pair. Email is shown and is **not** editable — it lives
 * in Neon's managed auth and the app cannot change it; the fixture says so next to the value
 * instead of offering a control that could only fail.
 *
 * Three things this component deliberately does not do:
 *
 *   - it does not decide who may save. The route resolves the session and writes that user's row;
 *     this component is only ever rendered for someone the *server* found signed in, and it treats
 *     a `401` as "the session ended while you were typing" rather than as a permission it can
 *     grant itself.
 *   - it does not trust its own validation. Handle shape, bio length and the country pair are
 *     enforced by the schema on the server; this form's only client-side checks are the two empty
 *     strings, because a form that re-implements the model is a second copy of it.
 *   - it does not report the server's technical message. A `400` renders the fixture's "check the
 *     fields" line; the schema's own wording stays in the response body for a developer.
 *
 * Status is a discriminated union rather than two booleans: "saving" and "saved" and "failed" are
 * mutually exclusive states of one request, and a pair of flags lets two of them be true at once.
 */
type SaveStatus =
  | { readonly kind: "idle" }
  | { readonly kind: "saving" }
  | { readonly kind: "saved" }
  | { readonly kind: "error"; readonly message: string };

interface SettingsViewProps {
  copy: PageCopy;
  /** The signed-in person's email, from the session. Read-only here. */
  email: string;
  /** The auth user's name — the default display name before the first save. */
  signedInName: string;
  /** Their saved profile, or `null` when they have never saved one. */
  profile: PublicProfile | null;
}

export function SettingsView({ copy, email, signedInName, profile }: SettingsViewProps) {
  const router = useRouter();
  const identity = sectionOf(copy, "identity");
  const countries = sectionOf(copy, "countries");
  const account = sectionOf(copy, "account");
  const links = sectionOf(copy, "links");

  const [displayName, setDisplayName] = useState(profile?.displayName ?? signedInName);
  const [handle, setHandle] = useState(profile?.handle ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [countryCode, setCountryCode] = useState(profile?.countryCode ?? "");
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });

  const fail = (message: string) => setStatus({ kind: "error", message });

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (displayName.trim() === "" || handle.trim() === "") {
      fail(itemLabel(identity, "error-required"));
      return;
    }

    setStatus({ kind: "saving" });
    const chosen = countryCode === "" ? undefined : itemOf(countries, countryCode);
    const payload = {
      handle: handle.trim().toLowerCase(),
      displayName: displayName.trim(),
      ...(bio.trim() === "" ? {} : { bio: bio.trim() }),
      ...(chosen === undefined ? {} : { country: chosen.label, countryCode: chosen.id }),
    };

    let response: Response;
    try {
      response = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
    } catch {
      fail(itemLabel(identity, "error-network"));
      return;
    }

    if (response.status === 401) {
      router.push(loginPathFor("/settings"));
      return;
    }
    if (response.status === 409) {
      fail(itemLabel(identity, "error-handle-taken"));
      return;
    }
    if (response.status === 400) {
      fail(itemLabel(identity, "error-invalid"));
      return;
    }
    if (!response.ok) {
      fail(itemLabel(identity, "error-unknown"));
      return;
    }

    // The saved row, not the form state: the server is the thing that decided what was stored.
    const body = (await response.json().catch(() => null)) as { profile?: PublicProfile } | null;
    if (body?.profile) {
      setDisplayName(body.profile.displayName);
      setHandle(body.profile.handle);
      setBio(body.profile.bio ?? "");
      setCountryCode(body.profile.countryCode ?? "");
    }
    setStatus({ kind: "saved" });
  };

  const publicHref = handle.trim() === "" ? undefined : `/profile/${handle.trim().toLowerCase()}`;

  return (
    <div className="container mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold">{copy.heading}</h1>
        {copy.subtitle !== undefined && <p className="text-muted-foreground">{copy.subtitle}</p>}
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{identity.heading}</CardTitle>
          {identity.body !== undefined && <CardDescription>{identity.body}</CardDescription>}
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-5">
            <div className="flex items-center gap-4">
              <GeneratedAvatar
                name={displayName || signedInName}
                seed={handle || email}
                size={64}
              />
              <div className="text-sm text-muted-foreground">
                {fillLabel(itemLabel(account, "signed-in-as"), { name: signedInName })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="display-name">{itemLabel(identity, "display-name")}</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder={itemLabel(identity, "display-name-placeholder")}
              />
              <p className="text-xs text-muted-foreground">
                {itemLabel(identity, "display-name-hint")}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="handle">{itemLabel(identity, "handle")}</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {itemLabel(identity, "handle-prefix")}
                </span>
                <Input
                  id="handle"
                  value={handle}
                  onChange={(event) => setHandle(event.target.value)}
                  placeholder={itemLabel(identity, "display-name-placeholder")}
                  autoComplete="username"
                />
              </div>
              <p className="text-xs text-muted-foreground">{itemLabel(identity, "handle-hint")}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">{itemLabel(identity, "bio")}</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                placeholder={itemLabel(identity, "bio-placeholder")}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">{itemLabel(identity, "bio-hint")}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">{itemLabel(identity, "country")}</Label>
              <select
                id="country"
                value={countryCode}
                onChange={(event) => setCountryCode(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{itemLabel(identity, "country-none")}</option>
                {(countries.items ?? []).map((country) => (
                  <option key={country.id} value={country.id}>
                    {country.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">{itemLabel(identity, "country-hint")}</p>
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={status.kind === "saving"}>
                {status.kind === "saving"
                  ? itemLabel(identity, "saving")
                  : itemLabel(identity, "save")}
              </Button>
              {status.kind === "saved" && (
                <Badge variant="secondary" className="gap-1">
                  <Check className="h-3 w-3" />
                  {itemLabel(identity, "saved")}
                </Badge>
              )}
              {publicHref !== undefined && (
                <Link
                  href={publicHref}
                  className="inline-flex items-center gap-1 text-sm text-action"
                >
                  {itemLabel(links, "public-profile")}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
            {status.kind === "error" && (
              <p aria-live="polite" className="text-sm text-red-600">
                {status.message}
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{account.heading}</CardTitle>
          {account.body !== undefined && <CardDescription>{account.body}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>{itemLabel(account, "email")}</Label>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm">{email}</span>
              <Badge variant="outline">{itemLabel(account, "email-readonly")}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{itemLabel(account, "email-hint")}</p>
          </div>
          <Separator />
          <SignOutButton
            label={itemLabel(account, "sign-out")}
            pendingLabel={itemLabel(account, "signing-out")}
            errorLabel={itemLabel(identity, "error-network")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
