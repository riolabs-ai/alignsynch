import { GeneratedAvatar } from "@/components/media/generated-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/content/core";
import type { PublicProfile } from "@/content/identity";
import type { PageCopy } from "@/content/pages";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";
import { Pencil } from "lucide-react";
import Link from "next/link";

/**
 * A **member's** `/profile/<handle>` — a row of `user_profile`, not a fixture (issue #164).
 *
 * The component takes `PublicProfile`, which is the type with `userId` already dropped, so the
 * stranger's view cannot accidentally be handed the join key to the auth table. The owner's two
 * extras — the "this is you" band and the edit affordance — are rendered from a **separate**
 * section of the fixture only when `isOwner`, and `isOwner` is decided on the server from the
 * session (`content/identity.ts::isOwner`), never from a query parameter or a client store.
 *
 * A server component: it renders text and a link, and the only reason it is inside a client
 * boundary at all is that its page is dynamic anyway.
 */
export function MemberProfile({
  copy,
  profile,
  isOwner,
}: {
  copy: PageCopy;
  profile: PublicProfile;
  isOwner: boolean;
}) {
  const member = sectionOf(copy, "member");
  const owner = sectionOf(copy, "owner");
  const stranger = sectionOf(copy, "stranger");

  return (
    <div className="container mx-auto max-w-3xl space-y-6 py-6">
      <header className="flex flex-col gap-4 rounded-xl bg-gradient-to-r from-purple-100 to-blue-100 p-6 sm:flex-row sm:items-center dark:from-purple-950/30 dark:to-blue-950/30">
        <GeneratedAvatar name={profile.displayName} seed={profile.handle} size={88} />
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{profile.displayName}</h1>
            {isOwner && <Badge variant="secondary">{itemLabel(owner, "owner-note")}</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>
              {itemLabel(member, "handle-label")}: {itemLabel(member, "handle-prefix")}
              {profile.handle}
            </span>
            <span>
              {fillLabel(itemLabel(member, "joined-label"), {
                date: formatDate(profile.joinedAt),
              })}
            </span>
            {profile.country !== undefined && <span>{profile.country}</span>}
          </div>
        </div>
      </header>

      {profile.bio === undefined ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{itemLabel(member, "bio-empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <p className="whitespace-pre-line text-sm leading-relaxed">{profile.bio}</p>
          </CardContent>
        </Card>
      )}

      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle>{owner.heading}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {owner.body !== undefined && (
              <p className="text-sm text-muted-foreground">{owner.body}</p>
            )}
            {owner.cta !== undefined && (
              <Button asChild size="sm">
                <Link href={owner.cta.href}>
                  <Pencil className="mr-2 h-3 w-3" />
                  {owner.cta.label}
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {!isOwner && (
        <p className="text-xs text-muted-foreground">{itemLabel(stranger, "stranger-note")}</p>
      )}
    </div>
  );
}
