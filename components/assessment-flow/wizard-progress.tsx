/**
 * template-ancestor: components/assessment-flow/wizard-steps.tsx   (variation: the band above the fold on a narrow screen — one line of resolved words and five plain bars, with no cells and no links)
 *
 * The v2 wizard's progress line, below `lg` only.
 *
 * The rail beside the stage card is the full picture; on a phone it is off-canvas, so this is the
 * one line that says where the person is. It carries no words of its own: the count, the name and
 * the Align note arrive resolved, exactly as the rail takes them, so the two cannot disagree.
 *
 * The bars are `aria-hidden` on purpose. A screen reader would hear five decorative spans; the
 * sentence above them already says the same thing, and it says it as words.
 *
 * A server component: it ships no JavaScript of its own.
 */

export function WizardProgress({
  step,
  count,
  name,
  alignNote,
}: {
  /** 1..5 — which stage is current. */
  step: number;
  /** "Stage 3 of 5". */
  count: string;
  /** "Aspects". */
  name: string;
  /** "Stage 6 Align starts when Elena joins". */
  alignNote: string;
}) {
  return (
    <div className="space-y-2 lg:hidden" data-wizard-progress="true">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
        <p className="font-semibold uppercase tracking-wider text-deep-calm">
          {count} · {name}
        </p>
        <p className="text-muted-foreground">{alignNote}</p>
      </div>
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            data-progress-bar={n}
            data-progress-state={n < step ? "done" : n === step ? "current" : "later"}
            className={`h-1.5 flex-1 rounded-full ${
              n < step ? "bg-action" : n === step ? "bg-deep-calm" : "bg-line"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
