/**
 * `/dashboard/relationships` — the relationships this member is a party to (#533 phase 2, #706).
 *
 * **Two reads, both keyed on the session.** `listMyRelationships` lists every relationship the
 * viewer is a party to — the ones they started and the ones they were invited into — and the card
 * derives the seat from the row (`isInitiator`); `listMyTemplates` feeds the create band's picker
 * and is the same read `/dashboard/templates` does, so the two screens cannot disagree about which
 * templates exist. Neither takes an id from the URL.
 *
 * **The create band is the one write, and it opens from the header (#841 part 2).** Starting a
 * relationship copies a template into the relationship's own record; the copy is what makes the
 * detail screen's editor safe to use, and the band's copy says so. Nothing on this page edits
 * Aspects — that is one click away, on the detail screen, deliberately: a list that wrote would be
 * a table with a form in every row, which is not what a list is for. The band lives behind the
 * header's `Start a relationship` action rather than above the list, which is the shape
 * `components/my-quizzes/my-quizzes.tsx` ships and the approved artifact draws.
 *
 * `force-dynamic` for the reasons every console route in this tree carries it: per-request session,
 * database reads, and a `pnpm build` that must pass with no `DATABASE_URL` and no `NEON_AUTH_*`.
 */
import type { Metadata } from "next";

import { RelationshipsList } from "@/components/dashboard/relationships-list";
import { dashboardRelationshipsPageCopy } from "@/data/pages/dashboard-relationships";
import { requireRole } from "@/lib/auth/require-role";
import { DatabaseUnavailableError } from "@/lib/db/client";
import {
  listMyRelationships,
  MEMBER_RELATIONSHIPS_PATH,
  type MemberRelationshipRow,
} from "@/lib/member/relationships";
import { listMyTemplates, type MemberTemplateRow } from "@/lib/member/templates";
import { createRelationshipAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Relationships",
  robots: { index: false, follow: false },
};

export default async function MemberRelationshipsPage() {
  const { user } = await requireRole("member", { next: MEMBER_RELATIONSHIPS_PATH });

  let rows: readonly MemberRelationshipRow[] = [];
  let templates: readonly MemberTemplateRow[] = [];
  let unreadable: string | null = null;
  try {
    rows = await listMyRelationships(user.userId);
    templates = await listMyTemplates(user.userId);
  } catch (error) {
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    console.error("member-relationships: the list could not be read", error);
    unreadable = error.reason;
  }

  return (
    <RelationshipsList
      copy={dashboardRelationshipsPageCopy}
      rows={rows}
      templates={templates}
      onCreate={createRelationshipAction}
      unreadable={unreadable}
    />
  );
}
