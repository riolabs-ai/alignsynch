/**
 * template-ancestor: components/assessment-flow/stage-rail.tsx   (variation: the five stages are drawn as an arc rather than a band, and the sixth "Align" stage hangs off the image as a dashed preview)
 *
 * The v2 setup gauge — the arc above the wizard rail.
 *
 * **Five segments, and the state is the caller's number.** `step` says which stage the person is
 * on; a segment before it is `done`, the segment on it is `current`, and everything after it is
 * `later`. The gauge decides no state of its own, and it draws no stage names: the count, the name
 * and the Align note arrive already resolved, so a rename happens in a fixture and not here.
 *
 * **The sixth arc is not drawn.** `Align` is not a stage of the flow (`docs/specs/flow-stages.md`),
 * so the image carries five segments and no sixth; the dashed preview lives in the rail beside it.
 *
 * A server component: an arc is geometry and words, so it ships no JavaScript of its own.
 */

type GaugeState = "done" | "current" | "later";

/** The five segment paths, in stage order. The geometry is the prototype's; it is not derived. */
const SEGMENTS: readonly { readonly step: number; readonly d: string }[] = [
  { step: 1, d: "M 28.04 97.49 A 72 72 0 0 1 40.31 59.74" },
  { step: 2, d: "M 43.26 55.67 A 72 72 0 0 1 75.37 32.34" },
  { step: 3, d: "M 80.15 30.79 A 72 72 0 0 1 119.85 30.79" },
  { step: 4, d: "M 124.63 32.34 A 72 72 0 0 1 156.74 55.67" },
  { step: 5, d: "M 159.69 59.74 A 72 72 0 0 1 171.96 97.49" },
];

/** The numeral positions, one per segment, matching the prototype's baseline. */
const NUMERALS: readonly { readonly step: number; readonly x: number; readonly y: number }[] = [
  { step: 1, x: 52.4, y: 88.5 },
  { step: 2, x: 70.6, y: 63.5 },
  { step: 3, x: 100.0, y: 54.0 },
  { step: 4, x: 129.4, y: 63.5 },
  { step: 5, x: 147.6, y: 88.5 },
];

/** A segment's class per state — the token, never a palette step. */
const SEGMENT_CLASS: Record<GaugeState, string> = {
  done: "stroke-action",
  current: "stroke-deep-calm",
  later: "stroke-line",
};

function gaugeState(step: number, current: number): GaugeState {
  if (step < current) return "done";
  if (step === current) return "current";
  return "later";
}

export function StageGauge({
  step,
  count,
  name,
  alignNote,
}: {
  /** 1..5 — which stage is current. */
  step: number;
  /** Already-resolved "Stage 3 of 5". */
  count: string;
  /** Already-resolved "Aspects". */
  name: string;
  /** Already-resolved "Stage 6 Align starts when Elena joins". */
  alignNote: string;
}) {
  return (
    <div className="flex flex-col items-center" data-stage-gauge={step}>
      <svg viewBox="0 0 200 108" role="img" aria-label={`${count}, ${name}. ${alignNote}`}>
        <path
          d="M 10.00 100.00 A 90 90 0 0 1 190.00 100.00"
          fill="none"
          strokeWidth={2}
          strokeDasharray="4 6"
          className="stroke-deep-calm"
        />
        {SEGMENTS.map((segment) => (
          <path
            key={segment.step}
            d={segment.d}
            fill="none"
            strokeWidth={14}
            data-gauge-segment={segment.step}
            data-gauge-state={gaugeState(segment.step, step)}
            className={SEGMENT_CLASS[gaugeState(segment.step, step)]}
          />
        ))}
        {NUMERALS.map((numeral) => {
          const isCurrent = numeral.step === step;
          return (
            <text
              key={numeral.step}
              x={numeral.x}
              y={numeral.y}
              textAnchor="middle"
              fontSize={11}
              data-gauge-numeral={numeral.step}
              fontWeight={isCurrent ? 700 : 600}
              className={isCurrent ? "fill-primary" : "fill-muted-foreground"}
            >
              {numeral.step}
            </text>
          );
        })}
      </svg>
      <div className="-mt-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {count}
        </p>
        <p className="text-xl font-bold leading-tight text-primary">{name}</p>
      </div>
    </div>
  );
}
