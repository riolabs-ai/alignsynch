// template-ancestor: components/categories/categories-how-it-works.tsx   (variation: three steps beside one real Aspect read out of the taxonomy — the band argues "a template is a set of prompts", so it shows a prompt instead of describing one)

import { TwoPartyMark } from "@/components/templates/template-art";
import type { TemplatesPageModel } from "@/lib/templates-page";
import Link from "next/link";

/**
 * The explainer under the hero: three steps, and one **real** Aspect from a real template.
 *
 * The band exists because a stranger's first question about a template is "what is actually in
 * it?". The approved artifact answers it twice: a numbered three-step summary on the left, and on
 * the right a panel showing the first question of a Staff–Manager relationship, with the two named
 * ends of its scale. Both are needed — the steps say what happens, the panel says what a template
 * *is* (a prompt two people answer, not a report or a diagnosis).
 *
 * **The panel is not copy.** Its template name, its ordinal, its prompt and both ends of its scale
 * come from `data/relationship-types.ts` through `lib/templates-page.ts`, which throws if the
 * exemplar type or Aspect has gone. Nothing here can quote a question the product no longer asks,
 * and the ordinal is the Aspect's real position (the artifact prints "1 of 6" beside what is
 * really the third of six — the data wins, and the PR says so).
 *
 * **Empty rings, no filled answer.** The scale is drawn as five numbered circles with the two ends
 * named, never as a bar with a value on it: a filled scale on a marketing page reads as a score,
 * and the product's whole promise is that neither party sees an answer until both have given one.
 *
 * Holds no words: every string arrives on the model (E23, budget 0).
 */
export function HowItWorksPreview({
  how,
  mark,
}: {
  how: TemplatesPageModel["how"];
  /** The two-party mark's `src` — the footer line's cue. */
  mark: string;
}) {
  return (
    <section
      className="scroll-mt-[calc(var(--site-header-height)+0.75rem)] border-b border-border bg-background"
      data-templates-how=""
      id="how-it-works"
    >
      <div className="marketing-container grid items-center gap-8 py-10 md:py-11 lg:grid-cols-[minmax(0,1.08fr)_minmax(20.5rem,0.92fr)] lg:gap-16">
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-[0.075em] text-action uppercase">
            {how.eyebrow}
          </p>
          {how.heading !== undefined && (
            <h2 className="mt-2 max-w-[540px] text-[clamp(1.5625rem,3vw,2.125rem)] leading-[1.16] font-bold tracking-[-0.035em] text-foreground">
              {how.heading}
            </h2>
          )}
          <p className="mt-2.5 max-w-[590px] text-[13px] leading-[1.55] text-muted-foreground">
            {how.body}
          </p>
          {/* One column, except in the 620–800 band where the artifact draws them 3-up because
              the copy and the example have already stacked: a single stacked list there is three
              56-pixel rows of whitespace beside nothing. A range query, not two max-width ones, so
              the order of the two rules cannot decide the layout. */}
          <ol className="mt-4 mb-4 grid grid-cols-1 gap-0 min-[620px]:max-[800px]:grid-cols-3 min-[620px]:max-[800px]:gap-x-3.5">
            {how.steps.map((step) => (
              <li
                className="flex items-start gap-3 border-t border-border py-2.5"
                key={step.number}
              >
                <span
                  aria-hidden="true"
                  className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-accent/15 text-[10px] font-bold text-action"
                >
                  {step.number}
                </span>
                <span className="min-w-0">
                  <strong className="block text-[12px] font-bold text-foreground">
                    {step.title}
                  </strong>
                  <span className="mt-0.5 block text-[11px] leading-[1.4] text-muted-foreground">
                    {step.body}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <Link
            className="inline-flex h-11 items-center gap-1.5 rounded-sm text-[12px] font-bold text-action underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2"
            href={how.more.href}
          >
            {how.more.label}
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        <aside
          aria-label={how.example.position}
          className="w-full min-w-0 rounded border border-border border-l-[3px] border-l-accent bg-card px-5 pt-[18px] pb-0"
          data-templates-example=""
        >
          <div className="mb-3 flex items-center justify-between gap-3 text-[10px] font-bold tracking-[0.06em] text-muted-foreground uppercase">
            <span>{how.example.kicker}</span>
            <span>{how.example.position}</span>
          </div>
          <p className="mb-3.5 max-w-[26rem] text-[15px] leading-[1.4] font-semibold text-foreground">
            {how.example.prompt}
          </p>
          <div className="mb-1.5 flex justify-between gap-4 text-[10px] text-muted-foreground">
            <span>{how.example.left}</span>
            <span className="text-right">{how.example.right}</span>
          </div>
          <div
            aria-label={how.example.scaleLabel}
            role="img"
            className="flex items-center justify-between gap-2"
          >
            {["1", "2", "3", "4", "5"].map((notch) => (
              <span
                className="grid h-[25px] w-[25px] shrink-0 place-items-center rounded-full border border-foreground/25 text-[10px] font-bold text-action first:border-action/50 first:bg-accent/15 last:border-action/50 last:bg-accent/15"
                key={notch}
              >
                {notch}
              </span>
            ))}
          </div>
          <div className="mt-4 -mx-5 flex items-center gap-2 border-t border-border px-5 py-[9px] text-[11px] font-semibold text-muted-foreground">
            <TwoPartyMark className="block h-auto w-[32px] shrink-0" src={mark} />
            <span>{how.example.foot}</span>
          </div>
        </aside>
      </div>
    </section>
  );
}

export default HowItWorksPreview;
