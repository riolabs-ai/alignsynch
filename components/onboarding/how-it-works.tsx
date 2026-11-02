// template-ancestor: components/home/alignment-home.tsx   (variation: the `#questions` composition as an ordered wizard — the same heading/body pair per band, numbered, with the member's half beside the product's half, in the app shell instead of the marketing page)

import type { PageCopy } from "@/content/pages";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import Link from "next/link";

/**
 * `/how-it-works` — the console's onboarding page, drawn.
 *
 * The ancestor is the alignment front page's `#questions` band (`components/home/
 * alignment-home.tsx`): a heading, a paragraph, and a two-up grid of the same question from each
 * side. This is the same composition turned into a sequence — one band per move, numbered, and
 * each band's two halves are *what you do* against *what the product does* rather than the two
 * people's answers. That is the whole variation: the order of operations, in the console, instead
 * of a marketing band that explains the idea.
 *
 * A server component with no state and no words: every string arrives from
 * `data/pages/how-it-works.ts` (E23 holds this file at 0 literals), the six moves are resolved by
 * their ids, and the limits band is drawn as its own list because it is a different kind of
 * statement — a thing this build does not do, not a step anybody takes.
 *
 * **Why the ids are written out.** `sectionOf(copy, "step-invite")` is a literal E23 can read and
 * resolve; iterating `copy.sections` and filtering by a prefix would take every step out of that
 * gate, and a renamed band would render an empty list instead of failing the build.
 */
export function HowItWorks({ copy }: { copy: PageCopy }) {
  const labels = sectionOf(copy, "labels");
  const steps = [
    sectionOf(copy, "step-template"),
    sectionOf(copy, "step-invite"),
    sectionOf(copy, "step-answer"),
    sectionOf(copy, "step-accept"),
    sectionOf(copy, "step-report"),
    sectionOf(copy, "step-next"),
  ];
  const limits = sectionOf(copy, "limits");

  const youLabel = itemLabel(labels, "you");
  const productLabel = itemLabel(labels, "product");
  const stepLabel = itemLabel(labels, "step");

  return (
    <div className="space-y-6 pb-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold text-foreground">{copy.heading}</h1>
        {copy.subtitle && (
          <p className="max-w-3xl text-sm text-muted-foreground">{copy.subtitle}</p>
        )}
        <div className="flex flex-wrap gap-3">
          {copy.cta && (
            <Link
              href={copy.cta.href}
              className="inline-flex items-center rounded-lg bg-action px-4 py-2 text-sm font-semibold text-action-foreground transition-opacity hover:opacity-90"
            >
              {copy.cta.label}
            </Link>
          )}
          {copy.secondaryCta && (
            <Link
              href={copy.secondaryCta.href}
              className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-accent"
            >
              {copy.secondaryCta.label}
            </Link>
          )}
        </div>
      </header>

      {/*
        The sequence. `<ol>` because the order is the content: a wizard read out of order is a
        different product, and the numbers are the ordinal plus the fixture's own word for it.
      */}
      <ol className="space-y-4">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className="rounded-xl border border-border bg-card p-5 md:p-6"
            data-step={step.id}
          >
            <div className="flex items-start gap-4">
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-nav-active text-sm font-semibold text-action-foreground"
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {fillLabel(stepLabel, { number: index + 1 })}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-foreground">{step.heading}</h2>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {youLabel}
                    </p>
                    <p className="mt-1 text-sm text-foreground">{sectionBody(step)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {productLabel}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {itemLabel(step, "product")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>

      {/*
        The honest half: what this build does not do. Drawn as a headed band rather than a step,
        because a limit is not a move a reader takes, and it is the last thing on the page on
        purpose — a reader who stops after the sequence still sees it.
      */}
      <section className="rounded-xl border border-dashed border-border p-5 md:p-6">
        <h2 className="text-lg font-semibold text-foreground">{limits.heading}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{sectionBody(limits)}</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          {(limits.items ?? []).map((limit) => (
            <li key={limit.id}>{limit.label}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
