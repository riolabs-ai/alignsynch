/**
 * template-ancestor: components/assessment-flow/sent-state.tsx   (variation: the same single-outcome status card, with two actions where that screen draws a timeline and a next-step list)
 *
 * `CreateFailedState` — the create-failed screen (#1226).
 *
 * The browser outcome of `POST /assessment/new` when the create's transaction throws: a person who
 * pressed the create stage's own button used to get `{"code":"create-failed","sqlstate":"42703",
 * "message":"column …"}` printed in the browser window, because the endpoint answered every
 * unnameable throw as JSON (#1205). The JSON is still the answer for a `curl`, a QA walk and any
 * other non-browser caller — they read the body, and it is how the 2026-11-18 empty-500 incident was
 * diagnosed. A browser form post is the case this screen covers.
 *
 * **The drawn state, not a generic error.** `create-failed.html` in the v2 bundle
 * (`docs/specs/v2-bundles/04-create-failed-screen-1226/`) draws one status card: an icon chip, the
 * heading, one sentence, and two actions. That is the whole screen, and this component is it —
 * nothing is added to explain the failure, because there is nothing a reader can do with the cause.
 *
 * **The cause stays in the log.** `console.error("create-failed", sqlstate, message)` is unchanged
 * and is the one place the SQLSTATE and the driver's sentence live. None of it is drawn here and
 * none of it travels in the address: the query carries the template's slug at most, which is a
 * handle the person's own URL already named.
 *
 * **Status is an icon plus a word (the locked rule).** The icon chip is `bg-status-chip` with
 * `text-deep` ink and the word is the heading beside it — the artifact's own pair, so the rule is
 * kept by the drawing rather than by a badge invented for this screen.
 *
 * **Two actions, in the artifact's order.** `Try Again` is the primary: it returns to the create
 * stage that failed (`createCommitPath()`), where the draft is still in the cookie, so the person
 * re-reads the review card and presses Create again. A browser that lost the draft has nothing to
 * review, and that stage sends it to Details (stage 1) on its own — the same door the artifact's
 * `?stage=1` link names. `Back to Dashboard` is the plain way out. Both are real controls, not a
 * sentence with a link in it.
 *
 * **Calm, never red.** The card is the `status` purpose family (soft cyan ground, `status-line`
 * edge), which is what this deployment-level failure is: the person did nothing wrong. Read
 * failure is not a person's error, and no red appears anywhere on this surface.
 *
 * Literal-free: every word is `data/pages/assessment-create-failed.ts` (E23 holds this file's
 * budget at 0), and the two destinations arrive as props.
 */
import Link from "next/link";
import { Target } from "lucide-react";
import type { PageCopy } from "@/content/pages";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import { Button } from "@/components/ui/button";

/** The heading's own id, so the card is the labelled region (an id is a handle, not copy). */
const TITLE_ID = "create-failed-title";

export function CreateFailedState({
  copy,
  retryHref,
  dashboardHref,
}: {
  copy: PageCopy;
  /** The create flow, at the stage the failed post came from — or the library when none is named. */
  retryHref: string;
  /** The dashboard, which is where a person who does not want to retry goes. */
  dashboardHref: string;
}) {
  const actions = sectionOf(copy, "actions");

  return (
    <section
      data-tone="status"
      aria-labelledby={TITLE_ID}
      className="rounded-lg border border-status-line bg-status text-card-foreground"
    >
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:gap-4 lg:p-6">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-md bg-status-chip text-deep lg:size-8"
          aria-hidden="true"
        >
          <Target className="size-5 shrink-0 lg:size-4" />
        </span>
        <div className="min-w-0 space-y-3">
          <h1 id={TITLE_ID} className="text-2xl font-bold tracking-tight text-primary">
            {copy.heading}
          </h1>
          <p className="text-base text-foreground">{copy.subtitle}</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {/*
             * `h-11 px-4` is the artifact's own button box (`h-11 px-4 py-2 lg:h-10`): the
             * `size="lg"` height is the 44px touch target the drawing keeps at every width, and
             * `px-4` overrides that size's `px-8` so the pair reads as the artifact's. The repo's
             * `Button` has no responsive height, so the lg breakpoint's 40px is the one dimension
             * this build does not reproduce.
             */}
            <Button asChild size="lg" className="px-4">
              <Link href={retryHref}>{itemLabel(actions, "retry")}</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="px-4">
              <Link href={dashboardHref}>{itemLabel(actions, "dashboard")}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
