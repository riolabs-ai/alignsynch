/**
 * template-ancestor: components/assessment-flow/create-relationship.tsx   (variation: the last stage is two decisions side by side — the payment walk on the left and the send on the right — and one of them is a form post, the other a plain link out of the flow)
 *
 * **Stage 5 — Invite** (#825).
 *
 * The stage where the relationship either goes out or does not. Stage 4 already wrote it as a
 * `draft` with a signed-in Initiator, so nothing is created here; two acts are offered and the
 * difference between them is the whole stage:
 *
 *   Send and Continue   posts `POST …/instances/[id]/send`, which reissues the token, moves the
 *                       relationship `draft → published` and sends the one email. The confirmation
 *                       it lands on is unnumbered — it is proof the invitation left, not a stage.
 *   Continue as Draft   a link to the dashboard, where the draft is under My relationships. Nothing
 *                       is sent and nothing is charged.
 *
 * **One primary control.** The foot's advance is the send, and the aside carries the second act and
 * the sentences that make the choice safe: nothing is sent until Send is pressed, and keeping it as
 * a draft costs nothing. The artifact draws two buttons on this screen; the send is the foot's
 * (`docs/specs/flow-stages.md` → *The foot is one shape on stages 1–5*), so the card carries the
 * other one.
 *
 * Every reader-visible word is `data/pages/assessment-create.ts` (`invite`, `foot`) — E23 counts
 * what a component writes and this one writes none.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import type { PageCopy } from "@/content/pages";
import type { CreateDraft } from "@/lib/flow/create-draft";
import { OVERVIEW_PATH, sendInvitationPath } from "@/lib/flow/paths";
import { itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import { StageFoot } from "./stage-foot";

const CARD =
  "space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900";
const CARD_ACTION = "space-y-3 rounded-lg border border-action bg-white p-4 dark:bg-gray-900";
const HEADING = "text-lg font-semibold text-gray-900 dark:text-gray-100";
const SMALL = "text-xs text-gray-600 dark:text-gray-300";
const SECONDARY =
  "inline-flex h-11 w-full items-center justify-center rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800";

export function StageInvite({
  copy,
  draft,
  instanceRecordId,
  walk,
  backHref,
  cancelHref,
  cancelLabel,
  advanceClasses,
  sendFormId,
}: {
  copy: PageCopy;
  draft: CreateDraft;
  /** The relationship stage 4 wrote — the send posts to its own address. */
  instanceRecordId: string;
  /** The payment walk, built by the page so this stage owns the layout and not the state. */
  walk: ReactNode;
  backHref: string;
  cancelHref: string;
  cancelLabel: string;
  advanceClasses: string;
  /** The send form's id — the foot's advance submits it from outside the form. */
  sendFormId: string;
}) {
  const invite = sectionOf(copy, "invite");
  const draftFact = sectionOf(copy, "review");

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        {walk}

        <aside className="space-y-5">
          <form
            id={sendFormId}
            action={sendInvitationPath(instanceRecordId)}
            method="post"
            aria-labelledby="create-invite-heading"
            data-create-send="true"
            className={CARD}
          >
            <h2 id="create-invite-heading" className={HEADING}>
              {itemLabel(invite, "cta-heading")}
            </h2>
            <p className={SMALL}>{itemLabel(invite, "cta-body")}</p>
            <Link href={OVERVIEW_PATH} className={SECONDARY} data-create-keep-draft="true">
              {itemLabel(invite, "draft")}
            </Link>
          </form>

          {/* The two sentences that make "keep it as a draft" safe to choose. The first names what
              is already true (the relationship exists), the second what has not happened (no email
              has gone out). Neither is a warning: the artifact's copy is reassuring on purpose. */}
          <section aria-labelledby="create-invite-note-heading" className={CARD_ACTION}>
            <h2 id="create-invite-note-heading" className={HEADING}>
              {itemLabel(invite, "note-heading")}
            </h2>
            <p className={SMALL}>{itemLabel(invite, "reassure")}</p>
            <p className={SMALL}>{itemLabel(invite, "draft-help")}</p>
            <p className={SMALL}>
              {itemLabel(invite, "sent-to")} {draft.email.trim() || itemLabel(draftFact, "none")}
            </p>
          </section>
        </aside>
      </div>

      <StageFoot
        backHref={backHref}
        backLabel={itemLabel(invite, "back")}
        cancelHref={cancelHref}
        cancelLabel={cancelLabel}
        advance={
          <button type="submit" form={sendFormId} className={advanceClasses}>
            {itemLabel(invite, "submit")}
          </button>
        }
      />
    </>
  );
}
