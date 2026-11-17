/**
 * template-ancestor: components/assessment-flow/stage-rail.tsx   (variation: the rail is a sticky aside — a gauge above it, one row per stage carrying its status word, a dashed Align preview that is not a stage, and the relationship summary beneath)
 *
 * The v2 wizard's rail — the aside beside a stage card.
 *
 * **Words arrive resolved.** Every label, status word and note is a prop: the rail never assembles
 * a sentence, so a rename lands in one fixture and not in five screens. That is E23's rule as much
 * as it is good sense — a component that types "In Progress" is a page-copy literal.
 *
 * **The sixth row is not a cell.** `Align` is not a stage of the flow (`docs/specs/flow-stages.md`):
 * it is where completion lands, so it is drawn dashed, after the five, carrying no
 * `data-step-cell` and no `aria-current`. A row that could take a step number would be a stage.
 *
 * **Only a reached stage links back.** `href` is present on a `done` step and nowhere else; a
 * caller that hands one to a later step would be handing a link to a screen the person cannot
 * finish, which is why the anchor is drawn from `state === "done" && href` rather than from
 * `href` alone.
 *
 * **The gauge reads the current step.** `steps` is the one statement of which stage the person is
 * on, so the arc above is driven from the row that carries `state === "current"` rather than from a
 * second number that could disagree with it.
 *
 * A server component: a rail is a list of words, so it ships no JavaScript of its own.
 */
import { StageGauge } from "./stage-gauge";

export interface WizardRailStep {
  /** 1..5. */
  readonly step: number;
  /** "Details" … "Invite". */
  readonly label: string;
  readonly state: "done" | "current" | "up-next" | "later";
  /** "Done" | "In Progress" | "Up Next" | "Later". */
  readonly statusLabel: string;
  /** Present ONLY on a reached ("done") step. */
  readonly href?: string;
}

export interface WizardRailSummaryRow {
  readonly label: string;
  readonly value: string;
}

/** The badge's classes per state — a token per state, never a palette step. */
const BADGE_CLASS: Record<WizardRailStep["state"], string> = {
  done: "border-action bg-action text-action-foreground",
  current: "border-deep-calm bg-deep-calm text-white",
  "up-next": "border-line bg-background text-muted-foreground",
  later: "border-line bg-background text-muted-foreground",
};

/** One row's box, identical whether it renders as a link (reached) or as plain text. */
const ROW_CLASS = "flex items-center gap-3 rounded-md py-1";

export function WizardRail({
  label,
  steps,
  count,
  name,
  alignNote,
  alignPreviewLabel,
  alignPreviewNote,
  summaryHeading,
  summary,
}: {
  /** The nav's accessible name, e.g. "Setup progress". */
  label: string;
  steps: readonly WizardRailStep[];
  /** "Stage 3 of 5". */
  count: string;
  /** "Aspects". */
  name: string;
  /** Passed straight to `StageGauge`. */
  alignNote: string;
  /** The word for the dashed sixth row, e.g. "Align". */
  alignPreviewLabel: string;
  /** e.g. "Starts when Elena joins". */
  alignPreviewNote: string;
  /** "Your Relationship". */
  summaryHeading: string;
  summary: readonly WizardRailSummaryRow[];
}) {
  const current = steps.find((entry) => entry.state === "current")?.step ?? 1;

  return (
    <>
      <section
        className="rounded-lg border border-status-line bg-status p-4"
        data-wizard-rail={current}
      >
        <StageGauge step={current} count={count} name={name} alignNote={alignNote} />
        <nav aria-label={label} className="mt-3 border-t border-status-line pt-3">
          <ol className="space-y-0.5">
            {steps.map((entry) => {
              const ariaCurrent = entry.state === "current" ? "step" : undefined;
              const body = (
                <>
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${BADGE_CLASS[entry.state]}`}
                  >
                    {entry.step}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{entry.label}</span>
                    <span
                      className={
                        entry.state === "current"
                          ? "block text-xs text-deep-calm"
                          : "block text-xs text-muted-foreground"
                      }
                      data-step-status={entry.step}
                    >
                      {entry.statusLabel}
                    </span>
                  </span>
                </>
              );
              return (
                <li key={entry.step}>
                  {entry.state === "done" && entry.href !== undefined ? (
                    <a
                      href={entry.href}
                      className={ROW_CLASS}
                      data-step-cell={entry.step}
                      data-step-state={entry.state}
                      aria-current={ariaCurrent}
                    >
                      {body}
                    </a>
                  ) : (
                    <span
                      className={ROW_CLASS}
                      data-step-cell={entry.step}
                      data-step-state={entry.state}
                      aria-current={ariaCurrent}
                    >
                      {body}
                    </span>
                  )}
                </li>
              );
            })}
            <li className="mt-1 border-t border-dashed pt-3" data-align-preview="true">
              <span className="flex items-center gap-3 rounded-md py-1">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-deep-calm text-xs font-semibold text-deep-calm">
                  6
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">
                    {alignPreviewLabel}
                  </span>
                  <span className="block text-xs text-muted-foreground">{alignPreviewNote}</span>
                </span>
              </span>
            </li>
          </ol>
        </nav>
      </section>
      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold text-primary">{summaryHeading}</h2>
        <dl className="mt-1 divide-y">
          {summary.map((row) => (
            <div key={row.label} className="py-2">
              <dt className="text-xs text-muted-foreground">{row.label}</dt>
              <dd className="mt-0.5 break-words text-sm font-medium text-foreground">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
