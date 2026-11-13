/**
 * `/dashboard/relationships` — the relationships this member is a party to (#533 phase 2, #706).
 *
 * **Two reads, both keyed on the session.** `listMyRelationships` lists every relationship the
 * viewer is a party to — the ones they started and the ones they were invited into — and the card
 * derives the seat from the row (`isInitiator`); `listMyTemplates` feeds the create band's picker
 * and is the same read `/dashboard/templates` does, so the two screens cannot disagree about which
 * templates exist. Neither takes an id from the URL.
 *
 * **The way in is the header action, and it writes nothing (#913).** Starting a relationship copies
 * a template into the relationship's own record — and that copy is made by the create flow's modal
 * (`/templates/relationship/<slug>/create`), which is the one surface that writes a relationship
 * and, at stage 4, the session and the staged invitation the later stages read. This page's action
 * only chooses which template to start from; a create control here would be a second write path
 * beside the flow, and the row it wrote had nothing for stage 5 to send. Nothing on this page edits
 * Aspects — that is one click away, on the detail screen, deliberately: a list that wrote would be
 * a table with a form in every row, which is not what a list is for.
 *
 * `force-dynamic` for the reasons every console route in this tree carries it: per-request session,
 * database reads, and a `pnpm build` that must pass with no `DATABASE_URL` and no `NEON_AUTH_*`.
 */
import type { Metadata } from "next";

import { StageColumn } from "@/components/assessment-flow/stage-column";
import { RelationshipsList } from "@/components/dashboard/relationships-list";
import { dashboardRelationshipsPageCopy } from "@/data/pages/dashboard-relationships";
import { requireRole } from "@/lib/auth/require-role";
import { DatabaseUnavailableError } from "@/lib/db/client";
import {
  listMyRelationships,
  MEMBER_RELATIONSHIPS_PATH,
  type MemberRelationshipRow,
} from "@/lib/member/relationships";
import { listLibraryTemplates } from "@/lib/db/template-library";
import type { RelationshipStartTemplate } from "@/components/dashboard/relationship-create";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Relationships",
  robots: { index: false, follow: false },
};

export default async function MemberRelationshipsPage() {
  const { user } = await requireRole("member", { next: MEMBER_RELATIONSHIPS_PATH });

  let rows: readonly MemberRelationshipRow[] = [];
  let templates: readonly RelationshipStartTemplate[] = [];
  let unreadable: string | null = null;
  try {
    rows = await listMyRelationships(user.userId);
    /*
     * **The picker offers what the flow accepts, which is not only what the member owns (#913).**
     * `listMyTemplates` answered this band before, and the flow's own door is wider: stage 1 copies
     * a **published** template from the library, and the platform's built-ins are exactly what a new
     * member starts from (`pnpm flow:e2e` walks that path). A picker reading only `owner_user_id =
     * me` therefore said "You have no templates yet" to the member `assessment` offers 28 templates
     * to — the dead end this card removes. Same read as `/templates/relationship`, same refusal
     * rules as `templateCopyRefusal()`: published, with Aspects to copy.
     */
    templates = (await listLibraryTemplates(user.userId))
      .filter((template) => template.status === "published" && template.aspectCount > 0)
      .map((template) => ({ id: template.id, slug: template.slug, title: template.title }));
  } catch (error) {
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    console.error("member-relationships: the list could not be read", error);
    unreadable = error.reason;
  }

  return (
    <StageColumn>
      <RelationshipsList
        copy={dashboardRelationshipsPageCopy}
        rows={rows}
        templates={templates}
        unreadable={unreadable}
      />
    </StageColumn>
  );
}
