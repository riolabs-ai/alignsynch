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

import { StageColumn } from "@/components/assessment-flow/stage-column";
import { RelationshipDetail } from "@/components/dashboard/relationship-detail";
import { RelationshipAspectsNote } from "@/components/dashboard/relationship-aspects-note";
import { RelationshipEditDialog } from "@/components/dashboard/relationship-edit-dialog";
import { RelationshipEditPanel } from "@/components/relationship/relationship-edit-panel";
import {
  dashboardRelationshipDetailPageCopy,
  RELATIONSHIP_EDIT_SECTION,
} from "@/data/pages/dashboard-relationship-detail";
import { requireRole } from "@/lib/auth/require-role";
import { DatabaseUnavailableError } from "@/lib/db/client";
import { readMemberAlignments } from "@/lib/db/member-alignments";
import { type AlignmentSummary, alignmentSummaryOf } from "@/lib/member/alignment-summary";
import { membershipPrice } from "@/lib/billing/payment-view";
import { MEMBER_RELATIONSHIPS_PATH, readMyRelationship } from "@/lib/member/relationships";
import { readRelationshipEditState } from "@/lib/member/relationship-edit";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";
import { TEMPLATE_LIBRARY_PATH } from "@/lib/flow/paths";
import {
  abandonRelationshipAction,
  cancelInviteAction,
  claimExtensionAction,
  completeRelationshipAction,
  editRelationshipAction,
  forkRelationshipTemplateAction,
  leaveRelationshipAction,
  previewRelationshipEditAction,
  publishRelationshipAction,
  republishInviteAction,
  requestRemovalAction,
  resendInviteAction,
  saveAspectsAction,
} from "../actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Relationship",
  robots: { index: false, follow: false },
};

export default async function MemberRelationshipPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  /** #1121 — `?from=extend` only. Every other fact on this page is read, never passed in. */
  searchParams?: Promise<{ from?: string | string[] }>;
}) {
  const { user } = await requireRole("member", { next: MEMBER_RELATIONSHIPS_PATH });
  const { id } = await params;
  const query = searchParams === undefined ? {} : await searchParams;
  const queryFrom = Array.isArray(query.from) ? query.from[0] : query.from;

  let view: Awaited<ReturnType<typeof readMyRelationship>>;
  try {
    view = await readMyRelationship(user.userId, id);
  } catch (error) {
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    console.error("member-relationship: the relationship could not be read", error);
    return (
      <StageColumn>
        <div className="space-y-6">
          <h1 className="text-2xl font-semibold">{dashboardRelationshipDetailPageCopy.heading}</h1>
          <p data-relationship-unreadable className="text-sm text-muted-foreground">
            {dashboardRelationshipDetailPageCopy.sections?.find(
              (section) => section.id === "unreadable",
            )?.body ?? ""}
          </p>
        </div>
      </StageColumn>
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

  const editSection = sectionOf(dashboardRelationshipDetailPageCopy, RELATIONSHIP_EDIT_SECTION);

  /*
   * The v2 rectification — **the At a Glance tally.** `readMemberAlignments()` answers every
   * relationship this account is a party to whose two sheets both exist; the summary the card may
   * print is the one keyed by the round *this* page is about. The arithmetic is
   * `alignmentSummaryOf()` over `content/gaps.ts`, the same function the Start page's bar and the
   * Align screen call, so three screens cannot print three counts about one relationship.
   *
   * A failure here is not a 404 and not a zero: the page still renders and the card draws no tally,
   * because "0 of 5 Aspects Aligned" over answers nobody read would be the invention this screen's
   * docstrings exist to refuse.
   */
  let alignment: AlignmentSummary | null = null;
  if (view.sessionRecordId !== null) {
    try {
      const alignments = await readMemberAlignments(user.userId);
      const row = alignments.find(
        (candidate) => candidate.sessionRecordId === view.sessionRecordId,
      );
      alignment = row === undefined ? null : alignmentSummaryOf(row.setting, row.answers);
    } catch (error) {
      if (!(error instanceof DatabaseUnavailableError)) throw error;
      console.error("member-relationship: the alignment could not be read", error);
    }
  }

  return (
    <StageColumn>
      <div className="space-y-6">
        {/*
        #795 — the page draws no heading of its own. The identity band the shell renders owns the
        screen's one `<h1>` (the record's own title), so the kicker and the `text-2xl` title that
        used to sit above the card are gone: two headings for one record is the defect the shared
        shell exists to prevent, and the artifact draws the band in that position.
      */}
        <RelationshipDetail
          copy={dashboardRelationshipDetailPageCopy}
          relationship={view}
          /*
            #1124 — **the Settings tab's two values.** Read from the same edit state the panel
            trigger uses (#623), so the tab and the editor cannot disagree about what the
            relationship is configured with. `undefined` when the read could not answer — the
            tab then says who owns these rather than printing two defaults nobody chose.
          */
          settings={
            editState === undefined
              ? undefined
              : { mode: editState.mode, setting: editState.setting }
          }
          /* The At a Glance card's tally, the round it is about, and the price after the trial:
             three server facts this component cannot read for itself (E34). */
          alignment={alignment}
          round={
            view.round === null || view.round === undefined || view.roundStartedAt == null
              ? null
              : { ordinal: view.round, startedAt: view.roundStartedAt }
          }
          planPrice={membershipPrice()}
          /*
            #923 — **a trigger, not a column.** The panel used to arrive here as `editPanel` and
            render inline in the 320 px actions rail, so the detail and its editor described the
            same relationship side by side. Now the rail carries one control and the panel is
            mounted only while that control's dialog/sheet is open. The panel itself is unchanged:
            same component, same fields, same `variant="panel"`.
          */
          editTrigger={
            editState === undefined || editState.closed ? undefined : (
              <RelationshipEditDialog
                label={itemLabel(editSection, "open")}
                title={editSection.heading ?? ""}
                panel={
                  <RelationshipEditPanel
                    copy={dashboardRelationshipDetailPageCopy}
                    state={editState}
                    /*
                      #975 D12 — **the dialog names the Aspects; the page owns their editing.**

                      The inventory found the inverse of the owner's duplicate-aspects complaint:
                      #935 took the stacked Aspect forms out of this panel, and with them every
                      mention of the Aspects — so the dialog that says "everything here is written
                      to the relationship itself" was silent about the one section the page edits.
                      It stays silent *about writing them* (#935's decision: a second editor in the
                      modal would draw the drag list over the list it duplicates); it is no longer
                      silent about their existence. The note is a pointer, and `aspectsEditable`
                      picks its sentence and its verb: a published relationship's Aspects are fixed,
                      so the note says so and the door offers a view rather than an edit (#706).
                    */
                    note={
                      <RelationshipAspectsNote
                        heading={itemLabel(editSection, "aspects")}
                        note={fillLabel(
                          itemLabel(
                            editSection,
                            view.aspectsEditable ? "aspects-note" : "aspects-note-locked",
                          ),
                          { count: view.template.items.length },
                        )}
                        door={itemLabel(
                          editSection,
                          view.aspectsEditable ? "aspects-open" : "aspects-view",
                        )}
                      />
                    }
                    variant="panel"
                    onPreview={previewRelationshipEditAction}
                    onEdit={editRelationshipAction}
                  />
                }
              />
            )
          }
          onSaveAspects={saveAspectsAction}
          onPublish={publishRelationshipAction}
          onRepublish={republishInviteAction}
          onComplete={completeRelationshipAction}
          onFork={forkRelationshipTemplateAction}
          onClaimExtension={claimExtensionAction}
          /*
            #1135 — the five ending verbs. Every one is a server action passed in (E34), and each
            re-asks the seat inside its own transaction; `view.hygiene` is only what decides which of
            them this render draws.
          */
          onCancelInvite={cancelInviteAction}
          onResendInvite={resendInviteAction}
          onAbandon={abandonRelationshipAction}
          onLeave={leaveRelationshipAction}
          onRequestRemoval={requestRemovalAction}
          /*
            #1121 — `?from=extend` is the one query string this screen keeps, and it is an arrival
            rather than a state: the banner says a week was just added, and every state on the page
            is derived from rows. Next 16 hands `searchParams` as a Promise, unwrapped after the
            gate so a refusal never depends on the URL being well-formed.
          */
          arrival={queryFrom === "extend" ? "extend" : null}
          /*
            #785 — where a forked copy lands. Passed rather than imported inside the component:
            `TEMPLATE_LIBRARY_PATH` is exported by `lib/flow/paths.ts` (no database), and the
            `?view=mine` tab is the one the copy is under — a fork is the caller's, so the library's
            "Mine" tab is the honest destination and not the catalogue.
          */
          templatesHref={`${TEMPLATE_LIBRARY_PATH}?view=mine`}
        />
      </div>
    </StageColumn>
  );
}
