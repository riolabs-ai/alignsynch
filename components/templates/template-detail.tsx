// template-ancestor: components/marketing/relationship-catalogue.tsx   (variation: one template's public page — the breadcrumb, the page-header card with its rule strip and badges, Who It's For, the numbered Aspects on the locked scale, and the aside with the start, trial and How It Works panels)

import { CarriedPlanLink } from "@/components/marketing/carried-plan-link";
import type { TemplateDetailModel } from "@/lib/template-detail";
import Link from "next/link";
import { Suspense } from "react";

/**
 * `/relationship-templates/[slug]` — one template, drawn as bundle 02 draws it (#1127).
 *
 * The pre-v2 page was a hero with a realm chip, two descriptor cards, a flat list of Aspect rows
 * and a one-line action strip that printed the plan chip. The artifact draws it as a **page**:
 *
 *   1. a breadcrumb, because this page is one row of the catalogue above it;
 *   2. a page-header card — the kicker, the name, the type's own "who it's for" sentence, three
 *      badges and the two actions, under a rule strip in the brand's three tints;
 *   3. the body in two cards: **Who It's For** (with the "not for" sentence at the same weight)
 *      and **the Aspects**, every one numbered, drawn on the locked 1–5 scale with both ends named;
 *   4. the sticky aside: the start panel, addressed to the Counterparty's own role; the **trial**
 *      panel (what starts free, what follows, who never pays); and **How It Works**;
 *   5. the closing band, which repeats the one action where the reader finishes.
 *
 * **Holds no words and no figure.** Every string arrives in the model
 * (`lib/template-detail.ts`), which joins `data/pages/templates-detail.ts` with
 * `data/relationship-types.ts` and the plan catalogue. E23 attributes this directory to that
 * fixture at a budget of 0, and `tests/template-detail.test.ts` asserts this file's leaf literals
 * are empty — so a sentence typed here is a red build.
 *
 * No band reads a clock, a store or a session, and the page module prerenders every slug. The one
 * browser-read fact is the plan a reader chose on `/pricing`, which `CarriedPlanLink` appends to
 * the start action without making the page request-time.
 */
export function TemplateDetail({ model }: { model: TemplateDetailModel }) {
  return (
    <div className="bg-background" data-template-detail={model.slug}>
      <div className="bg-mist">
        <div className="mx-auto w-full max-w-content px-4 py-6 lg:px-6">
          <nav className="mb-4">
            <ol className="flex items-center gap-1.5 text-sm">
              <li>
                <Link
                  className="text-muted-foreground hover:text-primary hover:underline"
                  href={model.crumb.root.href}
                >
                  {model.crumb.root.label}
                </Link>
              </li>
              <li aria-hidden="true" className="text-muted-foreground">
                <ChevronGlyph />
              </li>
              <li aria-current="page" className="font-medium text-foreground">
                {model.crumb.current}
              </li>
            </ol>
          </nav>

          <div className="space-y-4">
            <section className="overflow-hidden rounded-lg border bg-card" data-template-hero>
              <div className="flex h-1" aria-hidden="true">
                <span className="flex-1 bg-action" />
                <span className="w-1/4 bg-deep/60" />
                <span className="w-1/6 bg-accent/50" />
              </div>
              <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-end lg:justify-between lg:p-6">
                <div className="min-w-0 space-y-2">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-deep">
                    <TemplateGlyph />
                    {model.kicker}
                  </p>
                  <h1 className="text-2xl font-bold tracking-tight text-primary">{model.name}</h1>
                  <p className="text-base text-foreground">{model.descriptor.forBody}</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Badge>{model.realm}</Badge>
                    <Badge>{model.aspectsBadge}</Badge>
                    <Badge>{model.roles}</Badge>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <StartAction model={model} />
                  <Link
                    className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-6 text-sm font-medium text-primary transition-colors hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-10"
                    href={model.back.href}
                  >
                    {model.back.label}
                  </Link>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
              <div className="min-w-0 space-y-4">
                <section className="rounded-lg border bg-card p-4 lg:p-5">
                  <h2 className="text-base font-semibold tracking-tight text-primary">
                    {model.descriptor.forHeading}
                  </h2>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm leading-relaxed text-foreground">
                        {model.descriptor.forBody}
                      </p>
                    </div>
                    <div className="rounded-md border border-status-line bg-status p-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-deep">
                        {model.descriptor.notForHeading}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-foreground">
                        {model.descriptor.notForBody}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="rounded-lg border bg-card p-4 lg:p-5" data-template-aspects>
                  <h2 className="text-base font-semibold tracking-tight text-primary">
                    {model.aspects.heading}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">{model.aspects.body}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-status-line bg-status px-3 py-2 text-sm">
                    <span className="font-medium text-foreground">{model.aspects.legend.lead}</span>
                    <span className="flex flex-wrap gap-1.5">
                      <Badge>{model.aspects.legend.feel}</Badge>
                      <Badge>{model.aspects.legend.wish}</Badge>
                    </span>
                  </div>

                  <ol className="mt-3 divide-y rounded-lg border">
                    {model.aspects.rows.map((row) => (
                      <li
                        className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-center md:gap-6"
                        data-template-aspect={row.id}
                        key={row.id}
                      >
                        <div className="flex gap-3">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-mist text-xs font-semibold text-primary">
                            {row.ordinal}
                          </span>
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-foreground">{row.prompt}</h3>
                          </div>
                        </div>
                        <div>
                          <div className="grid h-5 grid-cols-5 overflow-hidden rounded-md ring-1 ring-inset ring-foreground/10">
                            {SCALE_FILLS.map((fill, index) => (
                              <span
                                className={`flex items-center justify-center ${fill} text-xs font-medium leading-none text-foreground`}
                                key={fill}
                              >
                                {index + 1}
                              </span>
                            ))}
                          </div>
                          <div className="mt-1 flex justify-between gap-2 text-xs text-muted-foreground">
                            <span>{fillScale(model.aspects.scaleLeft, row.left)}</span>
                            <span className="text-right">
                              {fillScale(model.aspects.scaleRight, row.right)}
                            </span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              </div>

              <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
                <section className="rounded-lg border bg-card p-4">
                  <h2 className="text-base font-semibold text-primary">
                    {model.startPanel.heading}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">{model.startPanel.body}</p>
                  <div className="mt-3">
                    <StartAction block model={model} />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{model.startPanel.note}</p>
                  {model.example === undefined ? null : (
                    <Link
                      className="mt-2 inline-block text-xs font-semibold text-action hover:underline"
                      href={model.example.href}
                    >
                      {model.example.label}
                    </Link>
                  )}
                </section>

                <section
                  className="rounded-lg border border-billing-line bg-billing p-4"
                  data-template-trial
                >
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <CardGlyph />
                    {model.trial.heading}
                  </h2>
                  <ul className="mt-2 space-y-1.5 text-sm text-foreground">
                    {model.trial.items.map((item) => (
                      <li className="flex items-start gap-2" key={item}>
                        <CheckGlyph />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="rounded-lg border border-status-line bg-status p-4">
                  <h2 className="text-sm font-semibold text-primary">{model.how.heading}</h2>
                  <ol className="mt-3 space-y-3">
                    {model.how.steps.map((step) => (
                      <li className="flex gap-3" key={step.id}>
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-mist px-1.5 text-xs font-semibold text-primary">
                          {step.ordinal}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">{step.label}</p>
                          <p className="text-sm text-muted-foreground">{step.body}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              </aside>
            </div>

            <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
              <p className="text-base font-semibold text-primary">{model.closing.heading}</p>
              <StartAction model={model} />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The five scale fills, spelled out rather than composed: Tailwind's extractor reads literal class
 * names, so `bg-scale-${n}` would ship no CSS for four of the five cells.
 */
const SCALE_FILLS = ["bg-scale-1", "bg-scale-2", "bg-scale-3", "bg-scale-4", "bg-scale-5"] as const;

/** One end of the scale, framed by the fixture (`"1 · {left}"`), filled from the record. */
function fillScale(frame: string, end: string): string {
  return frame.replace("{left}", end).replace("{right}", end);
}

/**
 * **The page's one action, drawn twice — header and closing band — and never two doors.**
 *
 * Both copies carry the plan a reader chose on `/pricing` (#1127), which is appended in the
 * browser so this page stays prerendered. `Suspense` is what lets `CarriedPlanLink` read the query
 * without a request-time render: the fallback is the same control, without the carry.
 */
function StartAction({ model, block = false }: { model: TemplateDetailModel; block?: boolean }) {
  const className = `inline-flex h-11 items-center justify-center rounded-md bg-action px-6 text-sm font-medium text-action-foreground transition-colors hover:bg-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-10${block ? " w-full" : ""}`;
  return (
    <Suspense
      fallback={
        <Link className={className} href={model.start.href}>
          {model.start.label}
        </Link>
      }
    >
      <CarriedPlanLink
        className={className}
        href={model.start.href.split("?")[0] ?? model.start.href}
        data-template-start={model.slug}
      >
        {model.start.label}
      </CarriedPlanLink>
    </Suspense>
  );
}

/** A pill: the header's three badges and the Aspects legend's two. */
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-line bg-background px-2.5 py-0.5 text-xs font-medium text-foreground">
      {children}
    </span>
  );
}

/** The breadcrumb's separator. */
function ChevronGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

/** The kicker's mark. */
function TemplateGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="m16 6 4 14" />
      <path d="M12 6v14" />
      <path d="M8 8v12" />
      <path d="M4 4v16" />
    </svg>
  );
}

/** The trial panel's mark — a card, because that is what the panel is about. */
function CardGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0 text-billing-ink"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <rect height="14" rx="2" width="20" x="2" y="5" />
      <path d="M2 10h20" />
    </svg>
  );
}

/** The tick the trial panel's lines share. */
function CheckGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="mt-0.5 size-4 shrink-0 text-billing-ink"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default TemplateDetail;
