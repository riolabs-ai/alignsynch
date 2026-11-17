// template-ancestor: components/templates/templates-page.tsx   (variation: bundle 02's public catalogue — hero with a worked example, the filterable shelf, How It Works, the questions, the closing band)

import { CatalogueBrowser } from "@/components/marketing/catalogue-browser";
import type {
  CatalogueBandModel,
  CatalogueBandsModel,
  CatalogueCardModel,
  CatalogueExampleModel,
  CatalogueGroupModel,
  CatalogueHeroModel,
  CataloguePlanBannerModel,
  CatalogueQuestionModel,
  CatalogueStepModel,
} from "@/lib/relationship-catalogue";
import { CATALOGUE_ANCHOR, HOW_ANCHOR } from "@/lib/relationship-catalogue";
import { PRICING_PATH } from "@/lib/flow/paths";
import Link from "next/link";

/**
 * `/relationship-templates` — the public catalogue, drawn as bundle 02 draws it (#1127).
 *
 * The bands, in the bundle's order:
 *
 *  1. **the plan step banner** — only for a reader who chose a plan on `/pricing`; it says which
 *     plan is saved and offers the one way back (`Change Plan`), because the plan is *not* bought
 *     here and a reader who changed their mind must not have to find `/pricing` themselves;
 *  2. **the hero** — the promise, its three billing ticks, the two actions, and a **worked example**
 *     drawn on the locked 1–5 scale from a real authored demo sheet;
 *  3. **the shelf** — the category chips, the search, and one card per template. This is the one
 *     client island (`CatalogueBrowser`) and it only narrows markup that is already in the HTML;
 *  4. **How It Works** — four steps, anchored at `#how`, which is where the header's row points;
 *  5. **the questions** — five disclosures, `<details>` so a reader without JavaScript can open
 *     them;
 *  6. **the closing band** — the last action, plus the quiet way to the price.
 *
 * **The testimonials band is absent on purpose** — see `data/pages/relationship-catalogue.ts`: the
 * issue marks those quotes as placeholders that must not ship.
 *
 * **Nothing here is a literal.** Every string arrives on `hero` / `band` / `bands` / the cards and
 * steps, resolved by `lib/relationship-catalogue.ts` from the fixture and the taxonomy (E23 budget
 * 0 on `components/marketing/**`). The anchors are the module's constants, so the header, this view
 * and the in-page actions cannot disagree about where `#catalog` is.
 */
export function RelationshipCatalogue({
  hero,
  example,
  band,
  bands,
  cards,
  groups,
  steps,
  questions,
  banner,
}: {
  hero: CatalogueHeroModel;
  example?: CatalogueExampleModel;
  band: CatalogueBandModel;
  bands: CatalogueBandsModel;
  cards: readonly CatalogueCardModel[];
  groups: readonly CatalogueGroupModel[];
  steps: readonly CatalogueStepModel[];
  questions: readonly CatalogueQuestionModel[];
  banner?: CataloguePlanBannerModel;
}) {
  return (
    <div className="bg-background">
      {banner === undefined ? null : (
        <div className="border-b border-billing-line bg-billing" role="status" data-plan-banner>
          <div className="mx-auto flex w-full max-w-content flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-6">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-foreground">
              <span className="inline-flex items-center gap-1.5 font-semibold text-billing-ink">
                <CheckGlyph />
                {banner.step}
              </span>
              <span>{banner.body}</span>
            </p>
            <Link
              className="text-sm font-medium text-primary underline underline-offset-4"
              href={PRICING_PATH}
            >
              {banner.change}
            </Link>
          </div>
        </div>
      )}

      <section className="border-b bg-mist" aria-labelledby="hero-title">
        <div className="mx-auto grid w-full max-w-content items-center gap-8 px-4 py-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:px-6 lg:py-14">
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-deep">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
              {hero.eyebrow}
            </p>
            <h1
              className="text-3xl font-bold tracking-tight text-primary lg:text-4xl"
              id="hero-title"
            >
              {hero.heading}
            </h1>
            <p className="max-w-xl text-base text-foreground">{hero.subtitle}</p>
            <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-foreground">
              {hero.ticks.map((tick) => (
                <li className="flex items-start gap-2" key={tick}>
                  <CheckGlyph />
                  <span>{tick}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2 pt-1 sm:flex-row">
              <Link
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-action px-6 text-sm font-medium text-action-foreground transition-colors hover:bg-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-10"
                href={CATALOGUE_ANCHOR}
              >
                {hero.browse}
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
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </Link>
              <Link
                className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-6 text-sm font-medium text-primary transition-colors hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-10"
                href={hero.popularHref}
              >
                {hero.popular}
              </Link>
            </div>
          </div>

          {example === undefined ? null : <ExampleCard example={example} />}
        </div>
      </section>

      <section aria-labelledby="catalog-title" className="scroll-mt-20" id="catalog">
        <div className="mx-auto w-full max-w-content px-4 py-10 lg:px-6">
          <div className="sr-only">
            <h2 id="catalog-title">{band.heading}</h2>
          </div>
          <CatalogueBrowser band={band} cards={cards} groups={groups} />
        </div>
      </section>

      <section
        aria-labelledby="how-title"
        className="scroll-mt-20 border-y border-status-line bg-status"
        id="how"
      >
        <div className="mx-auto w-full max-w-content space-y-6 px-4 py-10 lg:px-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-primary" id="how-title">
              {bands.howHeading}
            </h2>
            <p className="mt-1 text-base text-foreground">{bands.howBody}</p>
          </div>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <li className="rounded-lg border border-status-line bg-background p-4" key={step.id}>
                <p className="text-xs font-semibold uppercase tracking-wider text-deep">
                  {step.ordinal}
                </p>
                <h3 className="mt-3 text-base font-semibold text-primary">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="questions-title">
        <div className="mx-auto max-w-3xl space-y-4 px-4 py-10 lg:px-6">
          <h2 className="text-2xl font-bold tracking-tight text-primary" id="questions-title">
            {bands.questionsHeading}
          </h2>
          <div className="space-y-2">
            {questions.map((question) => (
              <details className="group rounded-lg border bg-card" key={question.id}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-base font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  {question.question}
                  <svg
                    aria-hidden="true"
                    className="size-4 shrink-0 transition-transform group-open:rotate-180"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </summary>
                <p className="px-4 pb-4 text-sm text-foreground">{question.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="closing-title" className="pb-12">
        <div className="mx-auto w-full max-w-content px-4 lg:px-6">
          <div className="flex flex-col items-start gap-4 rounded-lg bg-action p-6 text-action-foreground md:flex-row md:items-center md:justify-between lg:p-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight" id="closing-title">
                {bands.closingHeading}
              </h2>
              <p className="mt-1 text-base text-action-foreground/85">{bands.closingBody}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                className="inline-flex h-11 items-center justify-center rounded-md border border-white/40 bg-background px-6 text-sm font-medium text-primary transition-colors hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-10"
                href={CATALOGUE_ANCHOR}
              >
                {bands.closingBrowse}
              </Link>
              <Link
                className="inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium text-action-foreground underline underline-offset-4 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                href={PRICING_PATH}
              >
                {bands.closingPricing}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * The five scale fills, spelled out rather than composed: Tailwind's extractor reads literal class
 * names, so `bg-scale-${n}` would ship no CSS for four of the five cells.
 */
const SCALE_FILLS = ["bg-scale-1", "bg-scale-2", "bg-scale-3", "bg-scale-4", "bg-scale-5"] as const;

/** The check the hero's ticks and the banner share — one glyph, so they read as one set. */
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

/**
 * The hero's worked example: one Aspect, the locked 1–5 scale with its two named ends, both
 * parties' wish answers and the Gap between them.
 *
 * The numbers are the fixture's authored demo sheet (`lib/relationship-catalogue.ts` picks the
 * widest Gap), never a marketing invention: a visitor who starts a relationship will meet the same
 * scale, the same Aspect wording and the same Gap arithmetic.
 */
function ExampleCard({ example }: { example: CatalogueExampleModel }) {
  return (
    <div aria-label={example.kicker} className="rounded-lg border bg-card p-4" role="group">
      <p className="text-xs font-semibold uppercase tracking-wider text-deep">{example.kicker}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{example.aspect}</p>
      <div className="mt-2 grid h-6 grid-cols-5 overflow-hidden rounded-md ring-1 ring-inset ring-foreground/10">
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
        <span>{`1 · ${example.left}`}</span>
        <span className="text-right">{`5 · ${example.right}`}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-initiator-solid" />
          {`${example.initiator.name} wishes ${example.initiator.value}`}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-counterparty-solid" />
          {`${example.counterparty.name} wishes ${example.counterparty.value}`}
        </span>
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-gap-mark bg-gap-tint px-2.5 py-0.5 text-xs font-semibold text-gap">
          {example.gap}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{example.nextStep}</p>
    </div>
  );
}
