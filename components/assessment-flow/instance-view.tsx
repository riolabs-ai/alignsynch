/**
 * `/assessment/instances/[instanceId]` — the one screen both parties share (#146).
 *
 * Three states, and the third one is the only one that draws a score:
 *
 *   awaiting_counterparty   the Initiator's invite panel (with the link whenever no email
 *                          carried it, and one sentence for whether the mailer was absent,
 *                          refused, or accepted), the waiting band, and the Initiatior's own
 *                          answer sheet
 *   answering               the same sheet, with the other party's answers absent — not
 *                          hidden, absent (`FlowScreen.report` is `null` and the view model
 *                          has no field to carry them)
 *   complete                the existing `AssessmentReportView`, which every Gap in it
 *                          computes through `gapOf()` from the two scores beside it
 *
 * A refusal (`?problem=frozen` and friends) is rendered here too, for the one case that is
 * a redirect; the submit endpoint itself answers 409/403 with `problem-page.tsx`, so an
 * edit after the freeze is an error status and not a page that looks like a success.
 *
 * **Which party this is, is on the screen.** The band under the header names the viewer and
 * the role their answers are recorded under, on every visit and in every state (#202) — a
 * session that finds itself answering as somebody else has no way to notice otherwise, and
 * that silence is what made a link click able to corrupt a whole instance's Gap.
 *
 * **Which mode this is, is on the screen too** (#213): a badge under the title names the mode
 * the instance was played in (`data-mode` for a test), because a reader looking at a report
 * has to be able to tell a two-score sheet from a four-score one. The mode is a fact about
 * the instance, so it is drawn, not chosen — there is no control here that changes it.
 *
 * **The invitation panel draws its state, not a flag** (#266). `screen.invite.state` is
 * `unclaimed`, `expired` or `claimed`, derived at read time from `expires_at` and `claimed_at`
 * (`lib/flow/invite-state.ts`); each state has its own sentence and its own tone, and the
 * deadline is filled into the two that are not `claimed`. The link is drawn only for
 * `unclaimed` — the store withholds it otherwise, so this panel cannot offer a copy control for
 * a URL the claim path would refuse.
 *
 * **One stage sentence, and never a bar** (#274). `lib/flow/stage.ts` maps the derived status
 * onto Invited / Connected / Sharing, and the sentence above the bands names the stage and who
 * acts next. There is no progress display here at all — no bar, no dots, no percentage — for the
 * reasons `docs/specs/ux-stages.md` records: the transitions are the other party's actions (and
 * one of them is nobody's), an invitation can expire, and "Aligned" is Setting-relative
 * arithmetic on the finished Gap, so it is drawn only by the report's verdict band and never as
 * a step on this screen.
 *
 * Literal-free: the words are `data/pages/assessment-instance.ts` (E23), except the two mode
 * names, which are the glossary's own vocabulary authored once in `content/assessment.ts`
 * (`MODE_LABELS`) — the same way the report component carries "Aspect" and "Gap".
 */
import { AssessmentReportView } from "@/components/assessment/assessment-report";
import { AnswerForm } from "@/components/assessment-flow/answer-form";
import { InviteLink } from "@/components/assessment-flow/invite-link";
import { MODE_LABELS } from "@/content/assessment";
import { formatDate } from "@/content/core";
import type { PageCopy } from "@/content/pages";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import { answersPath } from "@/lib/flow/paths";
import type { InviteDisplayState } from "@/lib/flow/invite-state";
import type { FlowScreen } from "@/lib/flow/screen";
import { relationshipStage, stageCopyId } from "@/lib/flow/stage";

/** The codes a `?invite=` query may carry. Anything else is ignored, not rendered. */
const INVITE_NOTICES = ["sent", "unset", "failed"] as const;

/**
 * `sent` / `unset` / `failed` — the creation redirect's own fact (#220).
 *
 * Three, not two: `unset` is a deployment with no mailer, `failed` a send that was attempted
 * and refused, and the screen says something different for each. A value this build does not
 * know renders nothing at all, rather than a guess at which of the two it was.
 */
export type InviteNotice = (typeof INVITE_NOTICES)[number];

export function inviteNoticeOf(value: string | undefined): InviteNotice | undefined {
  return INVITE_NOTICES.find((notice) => notice === value);
}

/** The codes a `?problem=` query may carry. Anything else is ignored, not rendered. */
const PROBLEM_CODES = ["frozen", "incomplete", "not-a-party", "no-such-instance"] as const;

export type ProblemCode = (typeof PROBLEM_CODES)[number];

export function problemCodeOf(value: string | undefined): ProblemCode | undefined {
  return PROBLEM_CODES.find((code) => code === value);
}

/**
 * The invitation panel's tone, one per state — the "at a glance" half of #266.
 *
 * The sentence already says which state it is; the panel's colour is what a reader catches
 * before they read it. `unclaimed` is the neutral panel this band has always been, `claimed` is
 * the emerald the report band uses for a thing that is done, and `expired` is red because it is
 * news the Initiator has to act on (start again by other means). The three hues are status
 * colours, which the brand rule deliberately leaves alone; no palette step and no gradient.
 */
const INVITE_TONES: Record<InviteDisplayState, string> = {
  unclaimed:
    "border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200",
  expired:
    "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
  claimed:
    "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
};

export function AssessmentInstanceView({
  screen,
  copy,
  problem,
  inviteNotice,
}: {
  screen: FlowScreen;
  copy: PageCopy;
  problem?: ProblemCode;
  /** `sent` / `unset` / `failed` from the creation redirect; absent on a later visit. */
  inviteNotice?: InviteNotice;
}) {
  const waiting = sectionOf(copy, "waiting");
  const reportBand = sectionOf(copy, "report");
  const inviteBand = sectionOf(copy, "invite");
  const problems = sectionOf(copy, "problems");
  const viewerBand = sectionOf(copy, "viewer");
  const stageBand = sectionOf(copy, "stage");
  const problemLabel = problem === undefined ? undefined : itemLabel(problems, problem);
  const answered = screen.aspects.some((aspect) => aspect.own !== null);

  const names = screen.waiting.map((role) =>
    role === "initiator" ? screen.initiatorName : (screen.counterpartyName ?? ""),
  );

  // #274 — the stage, derived from the same status the bands below are drawn from, and the
  // sentence that names it. `stageCopyId` picks the expired-invite row from the invitation's
  // own derived state; `connected-unknown` covers the degenerate copy with no names to list, so
  // the sentence can never read "Connected —  still to answer."
  const stage = relationshipStage(screen.status);
  const stageId =
    stage === "connected" && names.length === 0
      ? "connected-unknown"
      : stageCopyId(stage, screen.invite?.state ?? null);
  const counterpartyName = screen.invite?.counterpartyName ?? screen.counterpartyName ?? "";
  const stageSentence = fillLabel(itemLabel(stageBand, stageId), {
    counterparty: counterpartyName,
    names: names.join(", "),
  });

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {copy.heading}
        </p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{screen.title}</h1>
        <p
          data-mode={screen.mode}
          className="mt-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
        >
          {MODE_LABELS[screen.mode]}
        </p>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{screen.summary}</p>
      </header>

      <p data-stage={stage} className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
        {stageSentence}
      </p>

      <p
        data-answering-as={screen.viewer.role}
        className="mb-6 rounded-lg border border-gray-200 bg-white p-3 text-sm font-medium text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
      >
        {fillLabel(itemLabel(viewerBand, screen.viewer.role), { name: screen.viewer.name })}
      </p>

      {problemLabel === undefined ? null : (
        <p
          role="alert"
          className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
        >
          {problemLabel}
        </p>
      )}

      {screen.report === null ? (
        <>
          {screen.invite === null ? null : (
            <section
              data-invite-state={screen.invite.state}
              className={`mb-6 rounded-lg border p-4 text-sm ${INVITE_TONES[screen.invite.state]}`}
            >
              <p className="font-medium">
                {fillLabel(itemLabel(inviteBand, screen.invite.state), {
                  counterparty: screen.invite.counterpartyName,
                  date: formatDate(screen.invite.expiresAt),
                })}
              </p>

              {inviteNotice === undefined ? null : (
                <p className="mt-1" data-invite-notice={inviteNotice}>
                  {inviteNotice === "sent"
                    ? fillLabel(itemLabel(inviteBand, "sent"), { email: screen.invite.email })
                    : itemLabel(inviteBand, inviteNotice)}
                </p>
              )}

              {/* The link is drawn wherever it exists, whatever the email did — a broken
                  mailer must never make the invitation unshareable (#220). The copy control
                  beside it is #257: the link stays text a reader can select, and the button
                  only saves them the mouse work. */}
              {screen.invite.link === null ? null : (
                <p className="mt-2" data-invite-link>
                  <span className="block text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {fillLabel(itemLabel(inviteBand, "link-label"), {
                      counterparty: screen.invite.counterpartyName,
                    })}
                  </span>
                  <InviteLink
                    link={screen.invite.link}
                    copy={inviteBand}
                    counterpartyName={screen.invite.counterpartyName}
                  />
                </p>
              )}
            </section>
          )}

          <section
            data-waiting-on={screen.waiting.join(",")}
            className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
          >
            <h2 className="font-semibold">{waiting.heading}</h2>
            <p className="mt-1">{sectionBody(waiting)}</p>
            <p className="mt-2 font-medium">
              {fillLabel(itemLabel(waiting, "waiting-for"), { names: names.join(", ") })}
            </p>
          </section>

          <AnswerForm
            copy={copy}
            aspects={screen.aspects}
            action={answersPath(screen.instanceRecordId)}
            hasAnswers={answered}
            mode={screen.mode}
          />
        </>
      ) : (
        <>
          <section className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            <h2 className="font-semibold">{reportBand.heading}</h2>
            <p className="mt-1">{sectionBody(reportBand)}</p>
          </section>
          <AssessmentReportView report={screen.report} />
        </>
      )}
    </div>
  );
}
