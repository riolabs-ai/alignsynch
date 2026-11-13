// template-ancestor: components/home/as2-how-it-works.tsx   (variation: the closing flow band — three steps between "pick a template" and "read the report", stated as facts and not as a promise, because the thing a stranger cannot tell from a shelf of cards is what happens after they pick one)

import type { TemplatesPageModel } from "@/lib/templates-page";

/**
 * The compact journey after the catalogue: what happens once a template is chosen.
 *
 * Three steps, and one rule the words must keep (`IMPLEMENTATION-PROMPT.md`, § Flow clarity and
 * privacy): the second person's answers are **not** visible before both have accepted. The band
 * says so in the third step, and it does not add a fourth seat — no practitioner, no coach, no
 * "expert review" — because a catalogue that quietly adds a third opinion to a two-person product
 * is selling a different product.
 *
 * No score, no composite, no clinical language: the report is named as an artefact the two people
 * read together, which is what the product actually produces.
 *
 * Holds no words: heading, body and all three steps arrive on the model (E23, budget 0).
 */
export function TemplateJourney({ journey }: { journey: TemplatesPageModel["journey"] }) {
  return (
    <section
      aria-labelledby="templates-journey-title"
      className="border-t border-border bg-muted/40"
    >
      <div className="marketing-container py-10 md:py-12">
        <div className="max-w-[42rem]">
          {journey.heading !== undefined && (
            <h2
              className="text-[clamp(1.375rem,2.4vw,1.75rem)] leading-[1.2] font-bold tracking-[-0.03em] text-foreground"
              id="templates-journey-title"
            >
              {journey.heading}
            </h2>
          )}
          <p className="mt-2 text-[13px] leading-[1.55] text-muted-foreground">{journey.body}</p>
        </div>
        <ol className="mt-6 grid gap-3 md:grid-cols-3 md:gap-4" data-templates-journey="">
          {journey.steps.map((step) => (
            <li
              className="min-w-0 rounded border border-border bg-background px-4 py-3.5"
              key={step.number}
            >
              <span
                aria-hidden="true"
                className="text-[10px] font-bold tracking-[0.08em] text-action"
              >
                {step.number}
              </span>
              <strong className="mt-1 block text-[13px] font-bold text-foreground">
                {step.title}
              </strong>
              <span className="mt-1 block text-[11px] leading-[1.45] text-muted-foreground">
                {step.body}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export default TemplateJourney;
