/**
 * template-ancestor: components/assessment-flow/instance-view.tsx   (variation: one band above the screen for the visit a submit created — the thank-you, the wait and the way back into the sheet)
 *
 * The confirmation state a Counterparty (or Initiator) lands on after submitting (#t_0aa81144).
 *
 * The submit endpoint used to answer with a bare 303 to the instance screen. The person had just
 * answered every Aspect and was handed a form again — or, on a session that had moved on, a wait —
 * with no sentence saying the answers were saved, what the other party still had to do, or how to
 * change a score. `POST …/answers` now redirects to `submittedPath()`, and this band is what that
 * address renders.
 *
 * Four rules:
 *
 *   it is a state, not a route      `?submitted=1` on the instance screen, because the read is the
 *                                   same `readFlowScreen()` — a second page module would be a
 *                                   second read of the same rows
 *   it only speaks while blind      the parent draws it only when `screen.report === null`. Once
 *                                   both parties have accepted, the report is the answer and a
 *                                   "nothing is shown yet" sentence would be a lie
 *   the words are the fixture's     `data/pages/assessment-instance.ts` section `submitted` (E23);
 *                                   `{other}` is the *other party's* name from the record
 *   it never says "waiting for you"  the viewer has just submitted; the sentence is about the
 *                                   other party, and `answered` counts are not drawn here because
 *                                   the blind rule keeps them out of the projection this screen
 *                                   already has
 *
 * A server component: a few links and no interaction. Since #617 the first of them is the
 * acceptance step itself (`acceptPath()`), because this band is the one screen a party reaches
 * immediately after answering their last Aspect — and until it linked there, nothing did.
 */
import type { PageCopy } from "@/content/pages";
import { answerSheetPath, instancePath } from "@/lib/flow/paths";
import { fillLabel, itemBody, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import Link from "next/link";

export function SubmissionConfirmation({
  copy,
  instanceRecordId,
  otherName,
  acceptHref,
}: {
  copy: PageCopy;
  instanceRecordId: string;
  /** The other party's name, from the instance's own rows — never a clock-derived label. */
  otherName: string;
  /**
   * The acceptance step, or `null` when there is nothing to accept yet (#617).
   *
   * The band is drawn on the visit a submit created, so the viewer has just answered every
   * Aspect — but `null` is still the honest default: a caller that has not read the seat's own
   * facts draws no link rather than a control that posts to a refusal. The instance screen decides,
   * from `screen.viewerAnswered` and `screen.viewerAccepted`, which is the same pair
   * `readFlowScreen` fills from `party.accepted_at`.
   */
  acceptHref: string | null;
}) {
  const band = sectionOf(copy, "submitted");
  const values = { other: otherName };

  return (
    <section
      data-submitted-confirmation=""
      aria-labelledby="submitted-heading"
      className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900"
    >
      <h2 id="submitted-heading" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        {band.heading}
      </h2>
      <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">
        {fillLabel(sectionBody(band), values)}
      </p>

      <div className="mt-4 space-y-3 text-sm">
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-100">
            {itemLabel(band, "waiting")}
          </p>
          <p className="text-gray-700 dark:text-gray-200">
            {fillLabel(itemBody(band, "waiting"), values)}
          </p>
        </div>
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-100">
            {itemLabel(band, "change")}
          </p>
          <p className="text-gray-700 dark:text-gray-200">{itemBody(band, "change")}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {/* #617 — the way to the acceptance step. Before this, the band offered the sheet and the
            session and nothing else, and no surface in the tree linked to `/accept`, so a party who
            had answered everything had no route to the step that completes the session. */}
        {acceptHref === null ? null : (
          <Link
            href={acceptHref}
            data-accept-link="true"
            className="rounded-md bg-action px-4 py-2 text-sm font-semibold text-action-foreground hover:bg-action-hover"
          >
            {itemLabel(band, "accept-link")}
          </Link>
        )}
        <Link
          href={answerSheetPath(instanceRecordId)}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800"
        >
          {itemLabel(band, "change-link")}
        </Link>
        <Link
          href={instancePath(instanceRecordId)}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800"
        >
          {itemLabel(band, "session-link")}
        </Link>
      </div>
    </section>
  );
}
