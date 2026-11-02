"use client";
// template-ancestor: components/identity/member-profile.tsx   (variation: the persona's profile as one component for the in-app and the public route — cover and avatar drawn from the handle, relationship history, milestones, and the owner/coaching section, with actions hidden on the read-only surface)

import { GeneratedAvatar } from "@/components/media/generated-avatar";
import { ProfileCover } from "@/components/profile/profile-cover";
import { V1ProfileAchievements } from "@/components/v1/profile/achievements";
import { V1ProfileActivity } from "@/components/v1/profile/activity";
import { StageBadge } from "@/components/v1/v1-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/content/core";
import { PERSONA_META, seedSessions, type V1Relationship } from "@/data/v1/fixtures";
import { relationshipNameOf, stageOfRelationship } from "@/lib/v1/derive";
import { personaHandle, relationshipsVisibleTo, type DashboardPersona } from "@/lib/v1/persona";
import { memberSinceOf, profileActivityOf, profileMilestonesOf } from "@/lib/v1/profile";
import { useV1Store } from "@/lib/v1/store";
import { Settings } from "lucide-react";
import Link from "next/link";

/** A relationship row's display name, resolved the same way the overview and timeline do. */
function nameOf(rel: V1Relationship, templates: readonly { id: string; title: string }[]): string {
  const template = templates.find((candidate) => candidate.id === rel.templateId);
  return relationshipNameOf(rel, template?.title ?? rel.templateId);
}

/**
 * The relationship section a profile may carry, per #384: an initiator shows the relationships
 * they own, a counterparty shows none (they own nothing), and a coach shows their coaching
 * relationships read-only. The admin — an observer with no ownership — also shows none.
 */
function RelationshipSection({ persona }: { persona: DashboardPersona }) {
  const { relationships, templates } = useV1Store();
  const visible = relationshipsVisibleTo(persona, relationships);

  if (persona === "counterparty" || persona === "admin" || visible.length === 0) return null;

  const title = persona === "coach" ? "Coaching relationships" : "Relationships you own";
  const note =
    persona === "coach" ? "Read-only — you observe and advise, you never score." : undefined;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
        {note !== undefined && <p className="text-sm text-muted-foreground">{note}</p>}
      </CardHeader>
      <CardContent className="space-y-2">
        {visible.map((rel) => (
          <Link
            key={rel.id}
            href={`/v1/${persona}/relationships/${rel.id}`}
            className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted"
          >
            <span className="font-medium text-foreground">{nameOf(rel, templates)}</span>
            <span className="flex shrink-0 items-center gap-2">
              <StageBadge stage={stageOfRelationship(rel)} />
              <span className="text-xs text-muted-foreground">{rel.completedSessions} scored</span>
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * `V1Profile` — the single profile component both routes render (#384 §3). The in-app profile
 * (`/v1/[persona]/profile`) mounts it with `readOnly={false}` — an edit-settings action and a link
 * to the public view. The public profile (`/v1/profile/[handle]`) mounts it with
 * `readOnly={true}`, so the marketing link and the in-app profile are one component with its
 * actions hidden; there is no second implementation to drift.
 *
 * The cover and the avatar are drawn from the handle (`ProfileCover` + `GeneratedAvatar` share the
 * seed one domain over), never a shared PNG. The activity is relationship history — dated
 * `createdAt`, acceptance and session instants from the fixtures — and the milestones are the ones
 * the fixture can prove. The completed-session rows come from `seedSessions`, the same rows the
 * relationship timeline reads, so a relationship with four scored sessions prints four dates.
 */
export function V1Profile({ persona, readOnly }: { persona: DashboardPersona; readOnly: boolean }) {
  const { relationships, templates } = useV1Store();
  const meta = PERSONA_META[persona];
  const handle = personaHandle(persona);
  const fullName = meta.surname ? `${meta.name} ${meta.surname}` : meta.name;
  const memberSince = memberSinceOf(persona, relationships);
  const activity = profileActivityOf(persona, relationships, templates, seedSessions);
  const milestones = profileMilestonesOf(persona, relationships, templates);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <header className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <ProfileCover handle={handle} />
        <div className="flex flex-col gap-4 bg-action/10 px-6 pb-6 sm:flex-row sm:items-start dark:bg-action/20">
          <GeneratedAvatar
            className="-mt-11 relative z-10 shrink-0 border-4 border-background"
            name={fullName}
            seed={handle}
            size={88}
          />
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{fullName}</h1>
              <Badge variant="secondary">{meta.label}</Badge>
              {readOnly && <Badge variant="outline">Public profile</Badge>}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>@{handle}</span>
              <span aria-hidden="true">•</span>
              <span>
                {memberSince === null
                  ? "No relationships yet"
                  : `Member since ${formatDate(memberSince)}`}
              </span>
            </div>
            {!readOnly && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/v1/${persona}/settings`}>
                    <Settings className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    Edit settings
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/v1/profile/${handle}`}>View public profile</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <V1ProfileActivity activity={activity} />

      <div className="grid gap-6 lg:grid-cols-2">
        <V1ProfileAchievements milestones={milestones} />
        <RelationshipSection persona={persona} />
      </div>
    </div>
  );
}
