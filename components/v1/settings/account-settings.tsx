// template-ancestor: components/settings/profile-settings.tsx   (variation: the account panel as read-only identity — the persona's avatar, name, handle, email and member-since, none of it an editable form)
import { GeneratedAvatar } from "@/components/media/generated-avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/content/core";
import { PERSONA_META } from "@/data/v1/fixtures";
import type { DashboardPersona } from "@/lib/v1/persona";

/**
 * The account section — the persona's identity, stated read-only. The name, handle and email are
 * fixture facts (`PERSONA_META` and the seed accounts); the member-since is the earliest
 * relationship date the store carries. Nothing here is editable because the persona is a fixture,
 * not a session the prototype can change.
 */
export function AccountSettings({
  persona,
  handle,
  email,
  memberSince,
}: {
  persona: DashboardPersona;
  handle: string;
  email: string;
  memberSince: string | null;
}) {
  const meta = PERSONA_META[persona];
  const fullName = meta.surname ? `${meta.name} ${meta.surname}` : meta.name;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>Who you are signed in as.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <GeneratedAvatar name={fullName} seed={handle} size={64} />
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium">{fullName}</p>
              <Badge variant="secondary">{meta.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">@{handle}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="font-mono text-sm">{email}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Member since</p>
            <p className="text-sm">{memberSince === null ? "—" : formatDate(memberSince)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
