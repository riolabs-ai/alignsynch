/**
 * template-ancestor: components/assessment-flow/create-relationship.tsx   (variation: the stage's left column is the app's own sign-in form rather than a set of fields this flow owns, and the right column is the review card instead of a payment walk)
 *
 * **Stage 4 — Account** (#825).
 *
 * The stage exists so the relationship has an Initiator when its row is written: pressing the
 * advance form posts the template and writes the relationship as a `draft`, which is what
 * `docs/specs/flow-stages.md` → *Stage 4, Account* promises. It is the flow's only screen that is
 * about the person rather than about the relationship, so it is the only one whose left column is
 * not a form this flow owns.
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
import type { CreateDraft } from "@/lib/flow/create-draft";
import { CREATE_INSTANCE_PATH } from "@/lib/flow/paths";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import { RelationshipReview } from "./relationship-review";
import { StageFoot } from "./stage-foot";

const CARD =
  "space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900";

export function StageAccount({
  copy,
  draft,
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
  draft: CreateDraft;
  /** The template as the review prints it, and the id the create form posts. */
  template: { readonly recordId: string; readonly title: string; readonly aspectCount: number };
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
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        {/*
         * The card is the account form, not a second copy of the stage's title (#777). The stage
         * header above already draws this section's `heading` and `body` — once, as the approved
         * reference draws them — so repeating them here put "Create your account" and its sentence
         * on screen twice, one above the other. The region is labelled by the stage heading
         * instead, which is what a screen reader was being told anyway.
         */}
        <section aria-labelledby="create-stage-heading" data-create-account="true" className={CARD}>
          {account}
        </section>

        <aside className="space-y-5">
          <RelationshipReview
            copy={copy}
            draft={draft}
            template={{ title: template.title, aspectCount: template.aspectCount }}
          />
        </aside>
      </div>

      {/* The conversion: a plain form posting to the create endpoint with `draft=1`, so the row is
          written and nothing goes out (#825). It is a hidden form because the act belongs in the
          foot — one advancing control per stage, the same shape as the four stages around it. It is
          absent on the re-entered state, where the advance is a link. */}
      {advanceHref === undefined ? (
        <form
          id={commitFormId}
          action={CREATE_INSTANCE_PATH}
          method="post"
          data-create-draft="true"
        >
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
