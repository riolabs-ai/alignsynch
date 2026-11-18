/**
 * template-ancestor: components/assessment-flow/create-relationship.tsx   (variation: the stage is one column — the app's own sign-in form — because the relationship's shape is drawn once, in the wizard rail beside it)
 *
 * **Stage 4 — Account** (#825). **Account only (#1123).**
 *
 * The stage exists so the relationship has an Initiator when its row is written: pressing the
 * advance form posts the template and writes the relationship as a `draft`, which is what
 * `docs/specs/flow-stages.md` → *Stage 4, Account* promises. It is the flow's only screen that is
 * about the person rather than about the relationship, so it is the only one whose column is not a
 * form this flow owns.
 *
 * **The review card is gone, and the v2 rail is why.** Until #1123 this stage drew a second column
 * of the six facts stages 1–3 had decided. The v2 bundle draws each stage as one card beside a
 * live "Your Relationship" summary, so those facts are already on screen at every width they can
 * be read at — a second copy inside the stage would be the same card twice, and the bundle's
 * Stage 4 is the account and nothing else.
 *
 * **The account form is the app's, never a second copy.** `account` is a node the page builds —
 * `components/auth/login-view.tsx` with `layout="embedded"` when nobody is signed in, and a
 * confirmation when somebody is, because the sign-in round trip returns here and the stage has to be
 * able to say so (#824, and the 2026-11-12 decision behind it). This component never draws fields:
 * a password input here would be a second implementation of sign-in that could drift from `/login`.
 *
 * **Nothing is sent from here.** The form below writes a draft; stage 5 decides whether the
 * invitation goes out, which is the whole reason the two decisions were split.
 *
 * Every reader-visible word is `data/pages/assessment-create.ts` (`account`, `foot`) through
 * `sectionOf`/`itemLabel` — E23 counts what a component writes and this one writes none.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import type { PageCopy } from "@/content/pages";
import { CREATE_SESSION_PATH, CREATE_STAGE_HEADING_ID } from "@/lib/flow/paths";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import { StageFoot } from "./stage-foot";

export function StageAccount({
  copy,
  template,
  account,
  backHref,
  cancelHref,
  cancelLabel,
  advanceClasses,
  commitFormId,
  advanceHref,
}: {
  copy: PageCopy;
  /** The template the create form posts — its record id is all the write needs. */
  template: { readonly recordId: string };
  /**
   * The account column: the embedded sign-in form, or the signed-in confirmation. `null` on the
   * re-entered state (a browser that already wrote the draft), where there is nothing left to ask.
   */
  account: ReactNode;
  backHref: string;
  cancelHref: string;
  cancelLabel: string;
  advanceClasses: string;
  /** The create form's id — the foot's advance submits it from outside the form. */
  commitFormId: string;
  /**
   * The advance as a **link** instead of a submit (#825).
   *
   * The one state that needs it: a browser that comes back to this stage after the draft was
   * written — stage 5's `Back` — has nothing to create a second time. The stage then draws the same
   * review and confirmation and offers the way forward, instead of a form that would write a second
   * relationship for one template.
   */
  advanceHref?: string;
}) {
  const section = sectionOf(copy, "account");

  return (
    <>
      <section aria-labelledby={CREATE_STAGE_HEADING_ID} data-create-account="true">
        {account}
      </section>

      {/* The conversion: a plain form posting to the create endpoint with `draft=1`, so the row is
          written and nothing goes out (#825). It is a hidden form because the act belongs in the
          foot — one advancing control per stage, the same shape as the four stages around it. It is
          absent on the re-entered state, where the advance is a link. */}
      {advanceHref === undefined ? (
        <form id={commitFormId} action={CREATE_SESSION_PATH} method="post" data-create-draft="true">
          <input type="hidden" name="templateRecordId" value={template.recordId} />
          <input type="hidden" name="draft" value="1" />
        </form>
      ) : null}

      <StageFoot
        backHref={backHref}
        backLabel={itemLabel(section, "back")}
        cancelHref={cancelHref}
        cancelLabel={cancelLabel}
        advance={
          advanceHref === undefined ? (
            <button type="submit" form={commitFormId} className={advanceClasses}>
              {itemLabel(section, "submit")}
            </button>
          ) : (
            <Link href={advanceHref} className={advanceClasses} data-create-next="invite">
              {itemLabel(section, "submit")}
            </Link>
          )
        }
      />
    </>
  );
}
