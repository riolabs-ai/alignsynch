"use client";

// template-ancestor: components/dashboard/start-page.tsx   (variation: the v2 settings page — the same page-header band and section cards, over four forms that each own one action)

/**
 * `/settings`, the editable half (issue #164), drawn in the v2 visual system (#1136).
 *
 * One form per section, one action each:
 *
 *   Profile   `POST /api/profile` — the fields `content/identity.ts` holds, and the address it does
 *             not (read-only, inside the same card, where bundle 11 draws it)
 *   Password  the session-authorised set/changing grant (`lib/auth/reset-set.ts`)
 *   Session   `endSession()` — the same step the rail's row and the account menu run
 *   Delete    `deleteAccountAction`, behind the typed phrase (#278)
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
 * The band above the sections is bundle 11's: an eyebrow with the settings glyph and the person's
 * own name, the H1 "Account Settings", and one purpose line.
 */
import { DeleteAccountCard } from "@/components/identity/delete-account-card";
import { PasswordCard } from "@/components/identity/password-card";
import { SessionCard } from "@/components/identity/session-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { FormSurface } from "@/components/ui/form-surface";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PublicProfile } from "@/content/identity";
import type { PageCopy } from "@/content/pages";
import type { BrandId } from "@/data/brand";
import type { DeleteAccountOutcome } from "@/app/(mainlayout)/settings/delete-account-actions";
import type { ResetSetOutcome } from "@/lib/auth/reset-token";
import { loginPathFor } from "@/lib/auth/paths";
import { fillLabel, itemLabel, itemOf, sectionOf } from "@/lib/page-copy";
import { Check, ExternalLink, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

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
  /**
   * Whether the account already has a password, read on the server from `neon_auth.account`
   * (`lib/db/password-reset.ts::accountHasPassword`). A Google-only account answers `false`, and
   * the password card then offers to set one (#password-reset).
   */
  hasPassword: boolean;
  /** The signed-in set-password action, wired by the page. Never an auth client call. */
  savePassword: (input: { password: string; confirmation: string }) => Promise<ResetSetOutcome>;
  /**
   * The signed-in delete-account action (#278). Server-side by construction: it re-resolves the
   * session and re-checks the typed phrase, so this component holds no authority of its own.
   */
  deleteAccount: (confirmation: string) => Promise<DeleteAccountOutcome>;
  /** This build's id — the session card's sign-out landing is a function of it. */
  brandId: BrandId;
}

export function SettingsView({
  copy,
  email,
  signedInName,
  profile,
  hasPassword,
  savePassword,
  deleteAccount,
  brandId,
}: SettingsViewProps) {
  const router = useRouter();
  const eyebrow = sectionOf(copy, "eyebrow");
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
    <div className="w-full max-w-3xl space-y-4">
      {/*
        The band is the v2 page header (`docs/specs/v2-bundles/11-…/settings.html`): the three-stop
        stripe, then an eyebrow carrying the settings glyph and the person's own name, the H1 and
        one purpose line. Same markup as `components/dashboard/start-page.tsx`, which is this
        template's ancestor — a settings page that measured its own header would be a second band.
      */}
      <section
        className="overflow-hidden rounded-lg border bg-card"
        aria-labelledby="settings-heading"
      >
        <div className="flex h-1" aria-hidden="true">
          <span className="flex-1 bg-action" />
          <span className="w-1/4 bg-deep/60" />
          <span className="w-1/6 bg-accent/50" />
        </div>
        <div className="p-5 lg:p-6">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-deep">
            <SlidersHorizontal aria-hidden="true" className="size-4 shrink-0" />
            <span>
              {fillLabel(itemLabel(eyebrow, "name"), {
                name: profile?.displayName ?? signedInName,
              })}
            </span>
          </p>
          <h1
            id="settings-heading"
            className="mt-2 text-2xl font-bold tracking-tight text-primary xxl:text-3xl"
          >
            {copy.heading}
          </h1>
          {copy.subtitle !== undefined && (
            <p className="mt-1 text-base text-foreground">{copy.subtitle}</p>
          )}
        </div>
      </section>

      <FormSurface>
        <CardHeader>
          <h2 id="settings-profile" className="text-base font-semibold text-primary">
            {identity.heading}
          </h2>
          {identity.body !== undefined && <CardDescription>{identity.body}</CardDescription>}
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-4">
            {/*
              Two columns from `sm` up, as the bundle measures Profile: the display name beside the
              profile URL, then the address across both. The avatar moved out of the form (it was a
              64px disc repeating the name the field already holds) — the band above names the
              person, and the menu names them on every other page.
            */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="display-name">{itemLabel(identity, "display-name")}</Label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder={itemLabel(identity, "display-name-placeholder")}
                  autoComplete="name"
                />
                <p className="text-xs text-muted-foreground">
                  {itemLabel(identity, "display-name-hint")}
                </p>
              </div>

              <div className="space-y-1.5">
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
                <p className="text-xs text-muted-foreground">
                  {itemLabel(identity, "handle-hint")}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
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

            <div className="space-y-1.5">
              <Label htmlFor="country">{itemLabel(identity, "country")}</Label>
              <select
                id="country"
                value={countryCode}
                onChange={(event) => setCountryCode(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

            {/*
              The address, where bundle 11 draws it — inside Profile, across the grid — and
              read-only, because it belongs to Neon's managed sign-in and the app never writes it.
              A disabled input would be announced as a control; this is a value with its own note,
              which is what it actually is.
            */}
            <div className="space-y-1.5">
              <Label htmlFor="email-readonly">{itemLabel(account, "email")}</Label>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  id="email-readonly"
                  className="flex h-10 min-w-0 flex-1 items-center truncate rounded-md border border-input bg-mist px-3 font-mono text-sm"
                >
                  {email}
                </span>
                <Badge variant="outline">{itemLabel(account, "email-readonly")}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{itemLabel(account, "email-hint")}</p>
              <p className="text-xs text-muted-foreground">{itemLabel(account, "email-contact")}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t pt-4">
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
              <p aria-live="polite" className="flex items-center gap-2 text-sm text-foreground">
                <X aria-hidden="true" className="size-4 shrink-0" />
                {status.message}
              </p>
            )}
          </form>
        </CardContent>
      </FormSurface>

      <PasswordCard copy={copy} hasPassword={hasPassword} save={savePassword} />

      <SessionCard copy={copy} name={signedInName} brandId={brandId} />

      <DeleteAccountCard copy={copy} remove={deleteAccount} />
    </div>
  );
}
