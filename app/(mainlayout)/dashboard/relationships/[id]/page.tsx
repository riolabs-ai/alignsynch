// template-ancestor: components/my-quizzes/quiz-details.tsx   (variation: one relationship from draft to a live invitation — the status band, the initiator's Aspect editor, the publish panel and the one-click reissue, where the quiz detail draws stats and a play button)
/**
 * `/dashboard/relationships/[id]` — one relationship, the initiator's screen (#533 phase 2).
 *
 * **A stranger's id is a 404.** `readMyRelationship` filters `initiator_user_id = $1` as well as the
 * id, so another member's relationship answers `undefined` and this page answers `notFound()` — the
 * same 404 a URL that never existed returns. The `[id]` is never used to look a row up without the
 * session.
 *
 * **The page decides nothing the transaction will re-decide.** `aspectsEditable` and the trial state
 * come from the read (`lib/member/publish-basis.ts`), which is what the editor draws; the server
 * actions re-ask both under a row lock before they write. A screen that hid a control which would
 * then have been allowed is a user-visible bug; a screen that offered one which is refused is the
 * documented behaviour — `not-editable`, `not-yours` and `trial-already-running` are sentences.
 *
 * **The trial band is read here, next to the invitation's state.** #533 requires the screen to say
 * plainly when a trial is running with no live invite; that combination is one value
 * (`trialRunningWithoutLiveInvite`), computed in the component from the two facts the view carries,
 * so the sentence and the badge cannot drift.
 *
 * `params` is a Promise in Next 16 and is unwrapped after the gate, never before — a refusal must
 * not depend on the URL being well-formed.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RelationshipDetail } from "@/components/dashboard/relationship-detail";
import { dashboardRelationshipDetailPageCopy } from "@/data/pages/dashboard-relationship-detail";
import { requireRole } from "@/lib/auth/require-role";
import { DatabaseUnavailableError } from "@/lib/db/client";
import { MEMBER_RELATIONSHIPS_PATH, readMyRelationship } from "@/lib/member/relationships";
import { publishRelationshipAction, republishInviteAction, saveAspectsAction } from "../actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Relationship",
  robots: { index: false, follow: false },
};

export default async function MemberRelationshipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requireRole("member", { next: MEMBER_RELATIONSHIPS_PATH });
  const { id } = await params;

  let view: Awaited<ReturnType<typeof readMyRelationship>>;
  try {
    view = await readMyRelationship(user.userId, id);
  } catch (error) {
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    console.error("member-relationship: the relationship could not be read", error);
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">{dashboardRelationshipDetailPageCopy.heading}</h1>
        <p data-relationship-unreadable className="text-sm text-muted-foreground">
          {dashboardRelationshipDetailPageCopy.sections?.find(
            (section) => section.id === "unreadable",
          )?.body ?? ""}
        </p>
      </div>
    );
  }
  if (view === undefined) notFound();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {dashboardRelationshipDetailPageCopy.heading}
        </p>
        <h1 className="text-2xl font-semibold">{view.title}</h1>
        {dashboardRelationshipDetailPageCopy.subtitle === undefined ? null : (
          <p className="max-w-3xl text-sm text-muted-foreground">
            {dashboardRelationshipDetailPageCopy.subtitle}
          </p>
        )}
      </header>
      <RelationshipDetail
        copy={dashboardRelationshipDetailPageCopy}
        relationship={view}
        onSaveAspects={saveAspectsAction}
        onPublish={publishRelationshipAction}
        onRepublish={republishInviteAction}
      />
    </div>
  );
}
