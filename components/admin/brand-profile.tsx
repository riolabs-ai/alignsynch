/**
 * template-ancestor: components/legal/legal-page.tsx   (variation: a long-form reference document whose five bands are card grids and a closing call to action, instead of one continuous prose column)
 *
 * The brand and audience profile, rendered (`/admin/brand`, #906).
 *
 * **The page is the document.** Same eleven sections, same order, same words as
 * `docs/specs/spec-design-page-rel-templates-v2/brand-profile/brand-and-audience-profile.html`;
 * `admin-brand/README.md` §2 is the clone contract and §6 is the token mapping. Every string arrives
 * as a resolved id from `data/pages/admin-brand.ts` — this file has a copy budget of **0**, so the
 * first sentence typed here is a red build. Nothing is restyled per section: the mockup's hex
 * palette collapses into the app's roles (`text-foreground`, `text-muted-foreground`, `bg-muted`,
 * `border-border`, `text-action` / `bg-action`), which is what makes the page repaint with the
 * brand instead of carrying one brand's colours.
 *
 * **Read-only, structurally.** No form, no input, no server action and no edit affordance: the words
 * are the canon, and the place to change them is the canon. That is why the props are one `PageCopy`
 * and nothing else.
 *
 * **Six declared divergences, all named in the spec rather than invented here** (§6): the hero's
 * gradient is a flat `bg-muted` (a gradient is a token-layer decision and `scripts/brand-classes.mjs`
 * fails a `bg-gradient-*` in a component); the two-tone eyebrow rule and the connector's gradient are
 * flat `bg-action` / a `border-action/40` border; sub-12px type steps are the app's smallest token
 * (12px) where the mockup sets 8–10; the graphite band is `bg-foreground text-background`; the
 * mockup's `box-shadow` is not copied — a `Card` is `rounded-lg border bg-card` and elevation is a
 * border (`docs/specs/ux-reference-patterns.md` rule 3); and the mockup's own sticky header and
 * private strip are the shell's, not this page's.
 */
import Link from "next/link";

import { Card } from "@/components/ui/card";
import type { PageCopy, PageCopySection } from "@/content/pages";
import {
  itemBody,
  itemLabel,
  itemValue,
  pageItemOf,
  sectionBody,
  sectionOf,
} from "@/lib/page-copy";

/** A band's `h2`, or a loud failure — a band that draws without its heading is the bug. */
function bandHeading(section: PageCopySection): string {
  if (section.heading === undefined) {
    throw new Error(`PageCopy: section "${section.id}" has no heading to draw`);
  }
  return section.heading;
}

/** A small caps label — the mockup's eyebrow, at the app's smallest type step. */
function Eyebrow({ children }: { children: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-action">{children}</p>
  );
}

/** One participant seat in the hero figure: a name, a private chip, and the aspect both answer. */
function ParticipantSeat({ name, note, owner }: { name: string; note: string; owner: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">{name}</span>
        <span className="rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {note}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{owner}</p>
      <div aria-hidden="true" className="mt-3 flex items-center gap-1.5">
        <span className="h-1.5 flex-1 rounded-full bg-muted" />
        <span className="h-1.5 flex-1 rounded-full bg-muted" />
        <span className="h-1.5 flex-1 rounded-full bg-action" />
        <span className="h-1.5 flex-1 rounded-full bg-muted" />
        <span className="h-1.5 flex-1 rounded-full bg-muted" />
      </div>
    </div>
  );
}

export function BrandProfile({ copy }: { copy: PageCopy }) {
  const positioning = sectionOf(copy, "positioning");
  const audiences = sectionOf(copy, "audiences");
  const workflow = sectionOf(copy, "workflow");
  const profileCopy = sectionOf(copy, "profile-copy");
  const closing = sectionOf(copy, "closing");

  const seat = pageItemOf(copy, "figure-private").label;
  const aspect = pageItemOf(copy, "figure-aspect").label;

  return (
    <div className="space-y-10">
      {/*
        Blocks 1–5 — one section, because the mockup draws the hero and the story band as one
        `#positioning` region and every block in that region carries that anchor. The section is the
        hero's jump target, so an in-page link to it lands on the `h1`.
      */}
      <section id="positioning" className="scroll-mt-24 space-y-8">
        <div className="rounded-lg border bg-muted p-6 xl:p-8">
          {copy.eyebrow === undefined ? null : <Eyebrow>{copy.eyebrow}</Eyebrow>}
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            {copy.heading}
          </h1>
          {copy.subtitle === undefined ? null : (
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">
              {copy.subtitle}
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {copy.cta === undefined ? null : (
              <Link
                href={copy.cta.href}
                className="inline-flex h-11 items-center rounded-md bg-action px-5 text-sm font-semibold text-action-foreground hover:bg-action-hover"
              >
                {copy.cta.label}
              </Link>
            )}
            {/*
              The mockup's second hero action is an in-page jump to the audience band. A `PageCopy`
              href must be a root-relative path (E23 refuses a fragment), so the label is a page item
              and the fragment is this anchor — the band's own id is one line below in this file, and
              `tests/admin-brand.test.tsx` proves the two agree.
            */}
            <a
              href="#audiences"
              className="inline-flex h-11 items-center rounded-md px-3 text-sm font-medium text-action hover:bg-action/10"
            >
              {pageItemOf(copy, "hero-secondary").label}
            </a>
          </div>

          {/* The brand-promise strip — block 1's one-line promise. */}
          <div className="mt-6 flex items-start gap-3 rounded-md border bg-card p-4">
            <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-action" />
            <p className="text-sm leading-6 text-muted-foreground">
              <span className="font-semibold text-foreground">
                {pageItemOf(copy, "promise-label").label}
              </span>{" "}
              {pageItemOf(copy, "promise-body").label}
            </p>
          </div>

          {/* The two-seat figure: the privacy story drawn, not described. */}
          <figure className="mt-6 rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {pageItemOf(copy, "figure-seats").label}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium text-foreground">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-green-500" />
                {pageItemOf(copy, "figure-status").label}
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <ParticipantSeat
                name={pageItemOf(copy, "figure-participant-a").label}
                note={seat}
                owner={aspect}
              />
              <ParticipantSeat
                name={pageItemOf(copy, "figure-participant-b").label}
                note={seat}
                owner={aspect}
              />
            </div>
            <div aria-hidden="true" className="my-3 h-px bg-border" />
            <div className="flex flex-wrap items-start gap-3 rounded-md border border-action/40 bg-background p-3">
              <span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 rounded-full bg-action" />
              <p className="text-sm leading-6 text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {pageItemOf(copy, "figure-status").label}
                </span>{" "}
                {pageItemOf(copy, "figure-report-body").label}
              </p>
            </div>
            <figcaption className="mt-3 text-xs leading-5 text-muted-foreground">
              {pageItemOf(copy, "figure-caption").label}
            </figcaption>
          </figure>
        </div>

        {/* Block 2 — the story, and blocks 3–5 — the three value cards. */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div>
            <Eyebrow>{itemLabel(positioning, "eyebrow")}</Eyebrow>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {bandHeading(positioning)}
            </h2>
          </div>
          <div className="space-y-4">
            <p className="text-sm leading-7 text-muted-foreground">
              {itemLabel(positioning, "story-1")}
            </p>
            <p className="text-sm leading-7 text-muted-foreground">
              {itemLabel(positioning, "story-2")}
            </p>
            <p className="text-sm leading-7 text-muted-foreground">
              {itemLabel(positioning, "story-3")}
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {itemValue(positioning, "value-business")}
            </p>
            <h3 className="mt-2 text-base font-semibold text-foreground">
              {itemLabel(positioning, "value-business")}
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {itemBody(positioning, "value-business")}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {itemValue(positioning, "value-personal")}
            </p>
            <h3 className="mt-2 text-base font-semibold text-foreground">
              {itemLabel(positioning, "value-personal")}
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {itemBody(positioning, "value-personal")}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {itemValue(positioning, "value-shared")}
            </p>
            <h3 className="mt-2 text-base font-semibold text-foreground">
              {itemLabel(positioning, "value-shared")}
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {itemBody(positioning, "value-shared")}
            </p>
          </Card>
        </div>
      </section>

      {/* Blocks 6–8 — who it is for. */}
      <section id="audiences" className="scroll-mt-24 space-y-4">
        <Eyebrow>{itemLabel(audiences, "eyebrow")}</Eyebrow>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {bandHeading(audiences)}
        </h2>
        <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
          {sectionBody(audiences)}
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-action">
              {itemValue(audiences, "card-business")}
            </p>
            <h3 className="mt-2 text-base font-semibold text-foreground">
              {itemLabel(audiences, "card-business")}
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {itemBody(audiences, "card-business")}
            </p>
            <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
              {itemLabel(audiences, "card-business-examples")}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-action">
              {itemValue(audiences, "card-personal")}
            </p>
            <h3 className="mt-2 text-base font-semibold text-foreground">
              {itemLabel(audiences, "card-personal")}
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {itemBody(audiences, "card-personal")}
            </p>
            <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
              {itemLabel(audiences, "card-personal-examples")}
            </p>
          </Card>
        </div>
        <div className="flex items-start gap-3 rounded-md border bg-muted p-4">
          <span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 rounded-full bg-action" />
          <p className="text-sm leading-6 text-muted-foreground">
            <span className="font-semibold text-foreground">
              {itemLabel(audiences, "counselor")}
            </span>{" "}
            {itemBody(audiences, "counselor")}
          </p>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          <span className="font-semibold text-foreground">
            {itemLabel(audiences, "participant")}
          </span>{" "}
          {itemBody(audiences, "participant")}
        </p>
      </section>

      {/* Block 9 — how it works, four numbered steps. */}
      <section id="workflow" className="scroll-mt-24 space-y-4">
        <Eyebrow>{itemLabel(workflow, "eyebrow")}</Eyebrow>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {bandHeading(workflow)}
        </h2>
        <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{sectionBody(workflow)}</p>
        <ol className="space-y-3">
          <li className="flex items-start gap-4 rounded-md border bg-card p-4">
            <span className="text-xs font-semibold text-muted-foreground">
              {itemValue(workflow, "step-1")}
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {itemLabel(workflow, "step-1")}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {itemBody(workflow, "step-1")}
              </p>
            </div>
          </li>
          <li className="flex items-start gap-4 rounded-md border bg-card p-4">
            <span className="text-xs font-semibold text-muted-foreground">
              {itemValue(workflow, "step-2")}
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {itemLabel(workflow, "step-2")}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {itemBody(workflow, "step-2")}
              </p>
            </div>
          </li>
          <li className="flex items-start gap-4 rounded-md border bg-card p-4">
            <span className="text-xs font-semibold text-muted-foreground">
              {itemValue(workflow, "step-3")}
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {itemLabel(workflow, "step-3")}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {itemBody(workflow, "step-3")}
              </p>
            </div>
          </li>
          <li className="flex items-start gap-4 rounded-md border bg-card p-4">
            <span className="text-xs font-semibold text-muted-foreground">
              {itemValue(workflow, "step-4")}
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {itemLabel(workflow, "step-4")}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {itemBody(workflow, "step-4")}
              </p>
            </div>
          </li>
        </ol>
      </section>

      {/* Block 10 — the three reusable descriptions. */}
      <section id="profile-copy" className="scroll-mt-24 space-y-4">
        <Eyebrow>{itemLabel(profileCopy, "eyebrow")}</Eyebrow>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {bandHeading(profileCopy)}
        </h2>
        <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
          {sectionBody(profileCopy)}
        </p>
        <div className="space-y-3">
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {itemLabel(profileCopy, "card-short")}
              </span>
              <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                {itemValue(profileCopy, "card-short")}
              </span>
            </div>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              {itemBody(profileCopy, "card-short")}
            </p>
          </Card>
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {itemLabel(profileCopy, "card-company")}
              </span>
              <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                {itemValue(profileCopy, "card-company")}
              </span>
            </div>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              {itemBody(profileCopy, "card-company")}
            </p>
          </Card>
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {itemLabel(profileCopy, "card-app")}
              </span>
              <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                {itemValue(profileCopy, "card-app")}
              </span>
            </div>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              {itemBody(profileCopy, "card-app")}
            </p>
          </Card>
        </div>
      </section>

      {/* Block 11 — the closing action, on the graphite band. */}
      <section
        id="closing"
        className="scroll-mt-24 rounded-lg bg-foreground px-6 py-8 text-background"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-background/70">
          {itemLabel(closing, "eyebrow")}
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          {bandHeading(closing)}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-background/80">
          {sectionBody(closing)}
        </p>
        {closing.cta === undefined ? null : (
          <Link
            href={closing.cta.href}
            className="mt-6 inline-flex h-11 items-center rounded-md bg-background px-5 text-sm font-semibold text-foreground hover:bg-background/90"
          >
            {closing.cta.label}
          </Link>
        )}
      </section>
    </div>
  );
}
