/**
 * `/assessment/instances/[instanceId]` — the one screen both parties share (#146).
 *
 * Three states, and the third one is the only one that draws a score:
 *
 *   awaiting_counterparty   the Initiator's invite panel (with the link when no email was
 *                          sent), the waiting band, and the Initiatior's own answer sheet
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
 * Literal-free: the words are `data/pages/assessment-instance.ts` (E23).
 */
import { AssessmentReportView } from "@/components/assessment/assessment-report";
import { AnswerForm } from "@/components/assessment-flow/answer-form";
import type { PageCopy } from "@/content/pages";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import { answersPath } from "@/lib/flow/paths";
import type { FlowScreen } from "@/lib/flow/screen";

/** The codes a `?problem=` query may carry. Anything else is ignored, not rendered. */
const PROBLEM_CODES = ["frozen", "incomplete", "not-a-party", "no-such-instance"] as const;

export type ProblemCode = (typeof PROBLEM_CODES)[number];

export function problemCodeOf(value: string | undefined): ProblemCode | undefined {
  return PROBLEM_CODES.find((code) => code === value);
}

export function AssessmentInstanceView({
  screen,
  copy,
  problem,
  inviteNotice,
}: {
  screen: FlowScreen;
  copy: PageCopy;
  problem?: ProblemCode;
  /** `sent` / `unsent` from the creation redirect; absent on a later visit. */
  inviteNotice?: "sent" | "unsent";
}) {
  const waiting = sectionOf(copy, "waiting");
  const reportBand = sectionOf(copy, "report");
  const inviteBand = sectionOf(copy, "invite");
  const problems = sectionOf(copy, "problems");
  const viewerBand = sectionOf(copy, "viewer");
  const problemLabel = problem === undefined ? undefined : itemLabel(problems, problem);
  const answered = screen.aspects.some((aspect) => aspect.own !== null);

  const names = screen.waiting.map((role) =>
    role === "initiator" ? screen.initiatorName : (screen.counterpartyName ?? ""),
  );

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {copy.heading}
        </p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{screen.title}</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{screen.summary}</p>
      </header>

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
              data-invite-state={screen.invite.claimed ? "claimed" : "unclaimed"}
              className="mb-6 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            >
              <p className="font-medium">
                {fillLabel(itemLabel(inviteBand, screen.invite.claimed ? "claimed" : "unclaimed"), {
                  counterparty: screen.invite.counterpartyName,
                })}
              </p>

              {inviteNotice === "sent" ? (
                <p className="mt-1">
                  {fillLabel(itemLabel(inviteBand, "sent"), { email: screen.invite.email })}
                </p>
              ) : null}

              {inviteNotice === "unsent" ? (
                <p className="mt-1">{itemLabel(inviteBand, "unsent")}</p>
              ) : null}

              {screen.invite.link === null ? null : (
                <p className="mt-2" data-invite-link>
                  <span className="block text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {fillLabel(itemLabel(inviteBand, "link-label"), {
                      counterparty: screen.invite.counterpartyName,
                    })}
                  </span>
                  <code className="break-all text-xs text-primary">{screen.invite.link}</code>
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
