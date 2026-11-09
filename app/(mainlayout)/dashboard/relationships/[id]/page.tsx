// template-ancestor: components/my-quizzes/quiz-details.tsx   (variation: one relationship from draft to a live invitation — the status band, the initiator's Aspect editor, the publish panel and the one-click reissue, where the quiz detail draws stats and a play button)
/**
 * `/dashboard/relationships/[id]` — one relationship (#533 phase 2, #706).
 *
 * **A stranger's id is a 404; a Counterparty's is not.** `readMyRelationship` asks the same
 * membership question the list does — the initiator *or* a bound party seat — so the relationship a
 * Counterparty is listed in opens for them, read-only, and an id that belongs to neither answers
 * `undefined` and this page answers `notFound()` — the same 404 a URL that never existed returns.
 * The `[id]` is never used to look a row up without the session.
 *
 * **The page decides nothing the transaction will re-decide.** `aspectsEditable`, `publishable`,
 * `offersRepublish` and the trial state come from the read (`lib/member/publish-basis.ts`, gated on
 * `isInitiator` since #706), which is what the screen draws; the server actions re-ask both
 * ownership and status under a row lock before they write. A screen that hid a control which would
 * then have been allowed is a user-visible bug; a screen that offered one which is refused is the
 * documented behaviour — `not-editable`, `not-yours` and `trial-already-running` are sentences.
 *
 * **The trial band is read here, next to the invitation's state.** #533 requires the screen to say
 * plainly when a trial is running with no live invite; that combination is one value
 * (`trialRunningWithoutLiveInvite`), computed in the component from the two facts the view carries,
 * so the sentence and the badge cannot drift. It is the initiator's trial and only they are told.
 *
 * `params` is a Promise in Next 16 and is unwrapped after the gate, never before — a refusal must
 * not depend on the URL being well-formed.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RelationshipDetail } from "@/components/dashboard/relationship-detail";
import { RelationshipEditPanel } from "@/components/relationship/relationship-edit-panel";
import { dashboardRelationshipDetailPageCopy } from "@/data/pages/dashboard-relationship-detail";
import { requireRole } from "@/lib/auth/require-role";
import { DatabaseUnavailableError } from "@/lib/db/client";
import { MEMBER_RELATIONSHIPS_PATH, readMyRelationship } from "@/lib/member/relationships";
import { readRelationshipEditState } from "@/lib/member/relationship-edit";
import {
  capturePaymentMethodAction,
  completeRelationshipAction,
  editRelationshipAction,
  previewRelationshipEditAction,
  publishRelationshipAction,
  republishInviteAction,
  saveAspectsAction,
} from "../actions";

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

  /*
   * #623 — the edit surface, read beside the view rather than inside it.
   *
   * Two reads because they answer different questions: `readMyRelationship` is what the screen
   * draws, and this is what an *edit* would need (the pin's versions, the invitation's window, and
   * the per-seat answer counts that make a cost printable). A failure here is not a 404 — the page
   * still renders; the edit band is simply absent, because a relationship that cannot be edited is
   * not a relationship that cannot be read.
   */
  let editState: Awaited<ReturnType<typeof readRelationshipEditState>>;
  try {
    editState = await readRelationshipEditState({ actorUserId: user.userId, relationshipId: id });
  } catch (error) {
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    console.error("member-relationship: the edit state could not be read", error);
    editState = undefined;
  }

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
        onCapture={capturePaymentMethodAction}
        onComplete={completeRelationshipAction}
      />
      {editState === undefined || editState.closed ? null : (
        <RelationshipEditPanel
          copy={dashboardRelationshipDetailPageCopy}
          state={editState}
          onPreview={previewRelationshipEditAction}
          onEdit={editRelationshipAction}
        />
      )}
    </div>
  );
}
