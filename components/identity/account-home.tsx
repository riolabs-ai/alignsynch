// template-ancestor: components/ui/card.tsx   (variation: the identity header — avatar, name and subtitle — then the person's cards beneath it)

import { SignOutButton } from "@/components/identity/sign-out-button";
import { GeneratedAvatar } from "@/components/media/generated-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PublicProfile } from "@/content/identity";
import type { PageCopy } from "@/content/pages";
import { fillLabel, itemLabel, pageItemOf, sectionOf } from "@/lib/page-copy";
import { ExternalLink, Settings } from "lucide-react";
import Link from "next/link";

/**
 * `/dashboard/user` — the signed-in person's account home (issue #164).
 *
 * It replaced five tabs of fixtures (a wallet with a balance, an earnings chart, an affiliate
 * funnel, six quizzes, a settings panel) that were all about somebody else. What is left is what
 * the app can actually say: who you are, what your public URL is, and three honest empty states
 * whose copy says "nothing here yet" rather than a number nobody measured.
 *
 * A server component: the only interactive thing on the page is `SignOutButton`, and everything
 * else is text the session already produced. No `"use client"` for that reason — a page that
 * ships its own identity as a hydration payload is a page that can disagree with the server about
 * who is signed in.
 */
export function AccountHome({
  copy,
  name,
  email,
  profile,
}: {
  copy: PageCopy;
  /** The auth user's name, the fallback display name before a profile exists. */
  name: string;
  email: string;
  /** Their saved profile, or `null` before the first save on `/settings`. */
  profile: PublicProfile | null;
}) {
  const identity = sectionOf(copy, "identity");
  const quizzes = sectionOf(copy, "quizzes");
  const wallet = sectionOf(copy, "wallet");
  const activity = sectionOf(copy, "activity");

  const displayName = profile?.displayName ?? name;
  const handle = profile?.handle;
  const publicHref = handle === undefined ? undefined : `/profile/${handle}`;

  return (
    <div className="container mx-auto max-w-4xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <GeneratedAvatar name={displayName} seed={handle ?? email} size={72} />
        <div className="space-y-1">
          <h1 className="text-3xl font-bold">{fillLabel(copy.heading, { name: displayName })}</h1>
          {copy.subtitle !== undefined && <p className="text-muted-foreground">{copy.subtitle}</p>}
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{identity.heading}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">
                {itemLabel(identity, "email-label")}
              </div>
              <div className="font-mono text-sm">{email}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">
                {itemLabel(identity, "handle-label")}
              </div>
              {handle === undefined ? (
                <Badge variant="outline">{itemLabel(identity, "no-handle")}</Badge>
              ) : (
                <Link href={`/profile/${handle}`} className="text-sm text-action">
                  {itemLabel(identity, "handle-prefix")}
                  {handle}
                </Link>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/settings">
                <Settings className="mr-2 h-4 w-4" />
                {handle === undefined
                  ? itemLabel(identity, "set-up-profile")
                  : itemLabel(identity, "account-settings")}
              </Link>
            </Button>
            {publicHref !== undefined && (
              <Button asChild variant="ghost">
                <Link href={publicHref}>
                  {itemLabel(identity, "view-profile")}
                  <ExternalLink className="ml-2 h-3 w-3" />
                </Link>
              </Button>
            )}
          </div>

          <SignOutButton
            label={itemLabel(identity, "sign-out")}
            pendingLabel={itemLabel(identity, "signing-out")}
            errorLabel={pageItemOf(copy, "error-network").label}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{quizzes.heading}</CardTitle>
            {quizzes.body !== undefined && <CardDescription>{quizzes.body}</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{itemLabel(quizzes, "empty")}</p>
            {quizzes.cta !== undefined && (
              <Button asChild size="sm">
                <Link href={quizzes.cta.href}>{quizzes.cta.label}</Link>
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{wallet.heading}</CardTitle>
            {wallet.body !== undefined && <CardDescription>{wallet.body}</CardDescription>}
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{itemLabel(wallet, "empty")}</p>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2">
          <CardHeader>
            <CardTitle>{activity.heading}</CardTitle>
            {activity.body !== undefined && <CardDescription>{activity.body}</CardDescription>}
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{itemLabel(activity, "empty")}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
