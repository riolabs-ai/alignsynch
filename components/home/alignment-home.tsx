// template-ancestor: components/ui/card.tsx   (variation: full-bleed marketing bands — a tinted hero over a two-up proof card, then hairline-separated bands on alternating ground — over the alignment brand's own record, no quiz shelves and no shadcn Card, because every band's words arrive pre-joined from one model)

import { TemplateToggle, type TemplateView } from "@/components/home/alignment-templates";
import type {
  AlignmentAspectScore,
  AlignmentCard,
  AlignmentCatalogueType,
  AlignmentHomeModel,
  AlignmentTemplate,
  AlignmentTemplateTab,
  AlignmentWorkedExample,
} from "@/lib/alignment-home";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The AlignSynch front page, drawn — the other composition of `/` (issue #143, redesigned).
 *
 * This file holds no words. Every string it prints arrives in the model
 * (`lib/alignment-home.ts`), which joins `data/pages/home-alignsynch.ts` with
 * `data/assessments.ts` and counts `data/relationship-types.ts`, and every colour arrives as
 * a token: `bg-action` / `text-action` / `border-action` are the brand's, painted onto `<html>`
 * by `lib/brand-theme.ts` from `data/brand.ts`. `data:check` E23 counts the leaf literals in
 * `components/home/**` and holds them at 0; a sentence or a label typed here is a red build.
 *
 * **The composition, and why it is this one.** The first cut of this page stacked six bands
 * inside one repeated `rounded-xl border p-6` panel, which rendered the deck's words and none of
 * its argument: a page of six identical boxes has no hero, so the reader had nothing to look at
 * while the copy asked them to picture a product. The page is now a page — a full-bleed hero on
 * a soft tint with the proof beside the promise, then bands separated by hairlines on alternating
 * ground. The rules that follow from that:
 *
 *   - **No band may reuse another band's class string.** Each `<section>` below states its own
 *     ground and its own vertical rhythm; a shared wrapper would put the six boxes back.
 *   - **The hero is two columns** — the words, and the worked-example card, which draws the
 *     featured relationship's real answers: five Aspects, both parties' Feel scores as bar
 *     groups (the initiator in the action blue, the counterparty in the accent green) and the
 *     Gap between them, computed by `gapOf()`. This is the product's proof, and it is the reason
 *     the card exists rather than a screenshot.
 *   - **No mark in the hero.** The header carries the brand; a lockup inside the page repeats it.
 *
 * The six anchor ids on the bands (`practice`, `questions`, `templates`, `families`, `seats`,
 * `boundary`) are the one thing this file does name, because an anchor target is markup rather
 * than copy (E23's `TECHNICAL_ATTRIBUTES`): the shell's AlignSynch menu links to `/#templates`
 * and `/#questions` (issue #156), and `tests/nav-brand.test.ts` holds every `/#…` href to an `id`
 * this page emits, so a band cannot be renamed out from under a link.
 *
 * The order is the argument. The page leads with the practice — the cycle of Create, Invite,
 * Run — because that is what a practitioner buys; the two questions, the templates and the
 * scope are the proof underneath it (the Gap is real, and the catalogue is finite); the seats
 * band says who the reader is on the relationship; and the last band states what the page
 * refuses to claim. Nothing here counts clients, money or praise, and the component has no shape
 * to render one: the model carries no such field.
 *
 * A server component with no state: nothing here reads a clock, a store or an env var, so the
 * prerendered markup is the whole screen and a test can read it with `renderToStaticMarkup`.
 */

/** The small brand-coloured label that opens every band. */
function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-action">{children}</p>
  );
}

/** The band's `h2`. One size, so five bands cannot invent five hierarchies. */
function BandHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mt-3 max-w-3xl text-[26px] font-bold leading-[1.15] tracking-[-0.01em] text-foreground md:text-[32px]">
      {children}
    </h2>
  );
}

/** The paragraph under a band heading. */
function BandBody({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-muted-foreground">{children}</p>
  );
}

/**
 * One party's answer to one Aspect, as `max` cells with `score` of them filled.
 *
 * `accent` picks the second party's green; the default is the brand's action blue. The pair is
 * named by `data-score-tone` — `action` / `accent`, the two tokens — which is how a structural
 * check reads the two colours apart without a screenshot. The group is `aria-hidden`: the number
 * is spoken by the row's own label instead of by ten spans.
 */
function ScoreBars({ max, score, accent }: { max: number; score: number; accent?: boolean }) {
  return (
    <span
      aria-hidden
      className="flex items-end gap-1"
      data-score-tone={accent ? "accent" : "action"}
    >
      {Array.from({ length: max }, (_, index) => index + 1).map((cell) => (
        <span
          className={cn(
            "h-5 w-2 rounded-[2px]",
            cell <= score ? (accent ? "bg-accent" : "bg-action") : "bg-foreground/10",
          )}
          key={cell}
        />
      ))}
    </span>
  );
}

/**
 * One Aspect of the worked example: the question on its own line, then the scale-and-Gap note
 * beside both answers' bars.
 *
 * **Two lines, every row**, which is the rhythm fix: the question used to share a line with the
 * bars, so the three prompts that fit in ~340px drew one-line rows and the two longer ones drew
 * two, and a card of 103 / 83 / 103 / 83 / 82-pixel rows reads as a mistake. The question now owns
 * the full card width (every one of the fixture's five prompts fits on one line there) and the
 * note owns the line under it, so the rows share a cadence without shortening a question the
 * record authored — the prompts are the template's words and this card may not paraphrase them.
 *
 * The note is the most informative text on the card — the scale's two endpoints and the Gap they
 * came to — so it is set at the page's body step (`text-[14px]`, the size of every other in-card
 * paragraph) in `text-muted-foreground` (5.34:1 on the card's white; it was `13px` at 65% ink,
 * measured 3.92:1, below AA). `data-row-note` / `data-row-question` exist so the contrast and the
 * line count are measurable in a browser rather than argued about in a comment.
 */
function AspectRow({ row }: { row: AlignmentAspectScore }) {
  return (
    <div
      className="border-b border-dashed border-border py-4 last:border-b-0"
      data-aspect-row={row.id}
    >
      {/* Two lines' worth of height below `sm`, because the card is 342px wide there and the
          prompts wrap: the one prompt that still fits on a single line would otherwise make a
          22px-shorter row than its four neighbours. From `sm` up the card is wide enough for every
          prompt to sit on one line, and the floor comes off. */}
      <p
        className="min-h-[2lh] text-[15px] font-medium leading-snug text-foreground sm:min-h-0"
        data-row-question=""
      >
        {row.label}
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-[14px] leading-snug text-muted-foreground" data-row-note="">
          {row.note}
        </p>
        <span aria-label={row.scores} className="flex shrink-0 items-center gap-4" role="img">
          <ScoreBars max={row.max} score={row.you} />
          <ScoreBars accent max={row.max} score={row.them} />
        </span>
      </div>
    </div>
  );
}

/**
 * The hero's proof card: the featured relationship, drawn from its own record.
 *
 * The header names the relationship and the mode it was answered in; the legend names the two
 * people behind the two bar colours; the rows are the instance's five Aspects; and the foot
 * states what the distance between two answers is for. A reader can check every number on it
 * against `/assessment/<slug>`, which is the point of putting it on the front page.
 */
function WorkedExampleCard({ card }: { card: AlignmentWorkedExample }) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
      data-worked-example=""
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border px-6 py-4">
        <p className="text-[14px] font-semibold text-foreground">{card.title}</p>
        {/* The mode as plain caption, not a badge: a pill in a hero invites "plan tier?" and the
            answer has to be a sentence fragment that names what it qualifies. */}
        <p className="text-[12px] font-medium text-muted-foreground">{card.mode}</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-6 pt-4 text-[13px] font-semibold text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-2 rounded-full bg-action" />
          {card.you}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-2 rounded-full bg-accent" />
          {card.them}
        </span>
      </div>
      <div className="px-6 pt-1">
        {card.rows.map((row) => (
          <AspectRow key={row.id} row={row} />
        ))}
      </div>
      <p className="border-t border-border bg-muted/40 px-6 py-4 text-[14px] leading-relaxed text-muted-foreground">
        {card.note}
      </p>
    </div>
  );
}

/**
 * One step of the practice cycle.
 *
 * A cell of one shared panel, not a card of its own: the band is a single numbered run — 01, 02,
 * 03 divided by hairlines — because three independently bordered boxes read as three unrelated
 * features, which is exactly what the first cut of this page was rejected for. The numeral is
 * computed from the item's index, so it cannot drift from the order the fixture lists.
 */
function PracticeStep({ card, index }: { card: AlignmentCard; index: number }) {
  return (
    <article className="flex flex-col p-6 md:p-8" data-practice-step={card.id}>
      <span
        aria-hidden
        className="text-[13px] font-extrabold tabular-nums tracking-[0.16em] text-action"
      >
        {String(index + 1).padStart(2, "0")}
      </span>
      <h3 className="mt-4 text-[18px] font-bold text-foreground">{card.label}</h3>
      <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{card.body}</p>
    </article>
  );
}

export function AlignmentHomeView({ model }: { model: AlignmentHomeModel }) {
  return (
    <div>
      {/*
        The hero: words on the left, the product's proof on the right, over one soft tint that
        belongs to the token layer (`app/globals.css`) rather than to this file.
      */}
      <section className="home-hero-ground border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-6 py-14 md:py-16 lg:py-20">
          {/* Vertically centred against the card, not top-aligned: the proof is the taller
              column, and a text stack pinned to its top leaves a dead band of ground under the
              fineprint that reads as a page still being filled in. */}
          <div className="grid gap-12 lg:grid-cols-[minmax(0,0.98fr)_minmax(0,1.02fr)] lg:items-center lg:gap-12">
            <div className="max-w-xl">
              {model.hero.eyebrow && <Eyebrow>{model.hero.eyebrow}</Eyebrow>}
              <h1 className="mt-5 text-[2.75rem] font-extrabold leading-[1.06] tracking-[-0.02em] text-foreground md:text-5xl">
                {model.hero.heading}
              </h1>
              {model.hero.subtitle && (
                <p className="mt-5 text-[19px] leading-relaxed text-muted-foreground">
                  {model.hero.subtitle}
                </p>
              )}
              {/* The primary is the hero's one confident element: the action token at the next
                  step up in size, with a resting shadow and a visible focus ring. The risk-reducer
                  sits under the pair rather than inside the button, so the action stays one word
                  and the objection is answered in a sentence. */}
              <div className="mt-7 flex flex-wrap items-center gap-3">
                {model.hero.primary && (
                  <Link
                    className="inline-flex w-full items-center justify-center rounded-lg bg-action px-6 py-3.5 text-[16px] font-bold text-action-foreground shadow-sm transition-colors hover:bg-action/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 sm:w-auto"
                    href={model.hero.primary.href}
                  >
                    {model.hero.primary.label}
                  </Link>
                )}
                {model.hero.secondary && (
                  <Link
                    className="inline-flex w-full items-center justify-center rounded-lg border border-border px-5 py-3 text-[15px] font-bold text-action transition-colors hover:bg-muted sm:w-auto"
                    href={model.hero.secondary.href}
                  >
                    {model.hero.secondary.label}
                  </Link>
                )}
              </div>
              {model.hero.reassurance && (
                <p
                  className="mt-3 text-[14px] font-medium text-foreground/80"
                  data-measure="hero-reassurance"
                >
                  {model.hero.reassurance}
                </p>
              )}
              {model.hero.fineprint && (
                <p
                  className="mt-3 max-w-lg text-[13px] leading-relaxed text-muted-foreground"
                  data-measure="hero-fineprint"
                >
                  {model.hero.fineprint}
                </p>
              )}
            </div>
            <WorkedExampleCard card={model.workedExample} />
          </div>
        </div>
      </section>

      {/* The cycle a practice runs: create once, invite both sides, run the session. */}
      <section
        className="scroll-mt-24 border-b border-border bg-background py-16 md:py-20"
        id="practice"
      >
        <div className="mx-auto w-full max-w-6xl px-6">
          {model.practice.eyebrow && <Eyebrow>{model.practice.eyebrow}</Eyebrow>}
          {model.practice.heading && <BandHeading>{model.practice.heading}</BandHeading>}
          {model.practice.body && <BandBody>{model.practice.body}</BandBody>}
          <div className="mt-10 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card md:grid md:grid-cols-3 md:divide-x md:divide-y-0">
            {model.practice.items.map((step, index) => (
              <PracticeStep card={step} index={index} key={step.id} />
            ))}
          </div>
        </div>
      </section>

      {/* The `#questions` band: "How it works" in the shell's nav points here. */}
      <section
        className="scroll-mt-24 border-b border-border bg-muted py-16 md:py-20"
        id="questions"
      >
        <div className="mx-auto w-full max-w-6xl px-6">
          {model.questions.eyebrow && <Eyebrow>{model.questions.eyebrow}</Eyebrow>}
          {model.questions.heading && <BandHeading>{model.questions.heading}</BandHeading>}
          {model.questions.body && <BandBody>{model.questions.body}</BandBody>}
          {/*
            One panel, two rows: the pairing is the argument ("the same question, answered
            twice"), so YOU and THEY are column heads once and each question pair sits on the
            same grid underneath. Two separately bordered cards said "two features" instead.
          */}
          <div className="mt-10 overflow-hidden rounded-2xl border border-border bg-card">
            <div className="hidden border-b border-border bg-muted/60 px-7 py-3 sm:grid sm:grid-cols-2 sm:gap-8">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                {model.sides.you}
              </p>
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                {model.sides.them}
              </p>
            </div>
            {model.questions.items.map((question) => (
              <article
                className="border-b border-border px-7 py-6 last:border-b-0"
                key={question.you}
              >
                <div className="grid gap-5 sm:grid-cols-2 sm:gap-8">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground sm:hidden">
                      {model.sides.you}
                    </p>
                    <p className="mt-1 text-[17px] font-semibold leading-snug text-foreground sm:mt-0">
                      {question.you}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground sm:hidden">
                      {model.sides.them}
                    </p>
                    <p className="mt-1 text-[17px] font-semibold leading-snug text-foreground sm:mt-0">
                      {question.them}
                    </p>
                  </div>
                </div>
                {/* The row's caption is a full-bleed strip inside the card, not a paragraph in a
                    column: the note explains the two answers *together* (subtract one from the
                    other), so a note sized to the left column made the THEY side look empty and
                    a note merely widened still read as the left column's footnote. */}
                <p className="-mx-7 -mb-6 mt-5 border-t border-border bg-muted/40 px-7 py-4 text-[13px] leading-relaxed text-foreground/65">
                  {question.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* The `#templates` band: "Templates" in the shell's nav points here. */}
      <section
        className="scroll-mt-24 border-b border-border bg-background py-16 md:py-24"
        id="templates"
      >
        <div className="mx-auto w-full max-w-6xl px-6">
          {model.templates.eyebrow && <Eyebrow>{model.templates.eyebrow}</Eyebrow>}
          {model.templates.heading && <BandHeading>{model.templates.heading}</BandHeading>}
          {model.templates.body && <BandBody>{model.templates.body}</BandBody>}
          <TemplateToggle views={templateViews(model)} />
        </div>
      </section>

      {/*
        The scope band. The heading and the realm counts are the fixture's numbers, counted by
        `lib/alignment-home.ts` — nothing here could round one or add a "+": the component has no
        string to add and no arithmetic of its own.
      */}
      <section
        className="scroll-mt-24 border-b border-border bg-muted/70 py-16 md:py-20"
        id="families"
      >
        <div className="mx-auto w-full max-w-6xl px-6">
          {/*
            Two columns, not a three-across grid with an empty third slot: the realm ledger on the
            left and the two families it is made of on the right. The counts are the fixture's own
            (`relationshipScope()`), so the ledger cannot disagree with the heading above it.
          */}
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start lg:gap-14">
            <div>
              {model.families.eyebrow && <Eyebrow>{model.families.eyebrow}</Eyebrow>}
              {model.families.heading && <BandHeading>{model.families.heading}</BandHeading>}
              {model.families.body && <BandBody>{model.families.body}</BandBody>}
              <dl className="mt-8 grid grid-cols-2 gap-x-8 border-t border-border">
                {model.families.scope.byRealm.map((realm) => (
                  <div
                    className="flex items-baseline justify-between gap-3 border-b border-border py-2.5"
                    key={realm.realm}
                  >
                    <dt className="text-[13px] font-semibold text-foreground">{realm.realm}</dt>
                    <dd className="text-[13px] font-semibold tabular-nums text-muted-foreground">
                      {realm.count}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            {/*
              One panel of family rows, not two small cards side by side: the fixture backs each
              family with a single Relationship Type, and two half-width cards wrapped every line
              ("Staff /" then "Manager") while leaving the rest of the card empty. A row per family
              is the honest shape of what the data holds, and it is the same shared-panel pattern
              the practice band uses.
            */}
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              {model.families.items.map((family) => (
                <article
                  className="border-b border-border p-6 last:border-b-0 md:p-7"
                  data-family={family.name}
                  key={family.name}
                >
                  <h3 className="text-[17px] font-bold text-foreground">{family.name}</h3>
                  <ul className="mt-4 divide-y divide-border border-t border-border">
                    {family.types.map((type: AlignmentTemplate) => (
                      <li
                        className="flex flex-col gap-1 py-3.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-x-4"
                        key={type.id}
                      >
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold leading-snug text-foreground">
                            {type.type}
                          </p>
                          <p className="mt-0.5 text-[12px] text-muted-foreground">
                            {type.title} · {type.aspects}
                          </p>
                        </div>
                        {type.link && (
                          <Link
                            className="shrink-0 text-[13px] font-semibold text-action hover:underline"
                            href={type.link.href}
                          >
                            {type.link.label}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* The three seats on a relationship. The coach is the reader's, so it carries the accent. */}
      <section
        className="scroll-mt-24 border-b border-border bg-background py-14 md:py-20"
        id="seats"
      >
        <div className="mx-auto w-full max-w-6xl px-6">
          {model.seats.eyebrow && <Eyebrow>{model.seats.eyebrow}</Eyebrow>}
          {model.seats.heading && <BandHeading>{model.seats.heading}</BandHeading>}
          {model.seats.body && <BandBody>{model.seats.body}</BandBody>}
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {model.seats.items.map((seat: AlignmentCard) => (
              <article
                className={cn(
                  "rounded-lg border border-border border-l-4 bg-card p-5",
                  seat.emphasis
                    ? "border-l-accent bg-accent/[0.06] ring-1 ring-inset ring-accent/20"
                    : "border-l-action",
                )}
                data-seat={seat.id}
                key={seat.id}
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                  {seat.label}
                </p>
                <p className="mt-2 max-w-[34ch] text-[14px] leading-relaxed text-foreground">
                  {seat.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/*
        What the page refuses to claim. Two columns inside the same grid the bands use — the claim
        on the left, the limit on the right — so the honesty is a stated pair rather than a
        full-bleed strip with an empty half.
      */}
      <section className="scroll-mt-24 bg-muted py-12 md:py-14" id="boundary">
        <div className="mx-auto grid w-full max-w-6xl gap-4 px-6 lg:grid-cols-[minmax(0,0.36fr)_minmax(0,0.64fr)] lg:items-baseline lg:gap-12">
          {model.boundary.heading && (
            <h2 className="text-[17px] font-bold tracking-tight text-foreground">
              {model.boundary.heading}
            </h2>
          )}
          {model.boundary.body && (
            <p className="max-w-2xl text-[14px] leading-relaxed text-foreground/70">
              {model.boundary.body}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * One template of the library view: its title, the Relationship Type it carries, how many
 * Aspects it asks, the create route, and — when a relationship has answered it — the instance
 * that holds the answers. A template nobody answered carries the note instead of the link.
 */
function TemplateCard({ template, useLabel }: { template: AlignmentTemplate; useLabel: string }) {
  return (
    <li
      className="flex flex-col rounded-xl border border-border bg-card p-5"
      data-template={template.slug}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[17px] font-bold text-foreground">{template.title}</h3>
          {template.type && (
            <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.04em] text-accent-foreground">
              {template.type}
            </span>
          )}
        </div>
        <p className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          {template.aspects}
        </p>
      </div>
      <div className="mt-5 space-y-2">
        <Link
          className="inline-flex text-[13px] font-semibold text-action hover:underline"
          href={template.create}
        >
          {useLabel}
        </Link>
        {template.link ? (
          <p>
            <Link
              className="text-[13px] font-medium text-muted-foreground hover:text-action"
              href={template.link.href}
            >
              {template.link.label}
            </Link>
          </p>
        ) : (
          template.note && (
            <div>
              <p className="text-[13px] font-semibold text-muted-foreground">
                {template.note.label}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                {template.note.body}
              </p>
            </div>
          )
        )}
      </div>
    </li>
  );
}

/**
 * The catalogue view: one card per purchasable Relationship Type.
 *
 * The card is a projection of `components/v1/relationship-type-card.tsx` — the same name, the
 * same two roles, the same "how many Aspects, what it costs" pair — with two variations this
 * surface needs and that one must not grow: a **realm** line (the catalogue groups by it) and an
 * action row of exactly two public links, because a visitor on `/` cannot start a relationship
 * from a button that needs a session.
 */
function CatalogueGrid({
  items,
  actions,
}: {
  items: readonly AlignmentCatalogueType[];
  actions: { readonly use: string; readonly example: string };
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((type) => (
        <article
          className="flex flex-col rounded-xl border border-border bg-card p-5"
          data-catalogue-type={type.id}
          key={type.id}
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-[15px] font-bold text-foreground">{type.name}</h3>
            <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
              {type.realm}
            </span>
          </div>
          <p className="mt-1 text-[12px] font-medium text-muted-foreground">{type.roles}</p>
          <p className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground">
            <span>{type.aspects}</span>
            <span aria-hidden className="h-1 w-1 rounded-full bg-border" />
            <span className="font-semibold text-foreground">{type.price}</span>
          </p>
          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4">
            <Link
              className="text-[13px] font-semibold text-action hover:underline"
              href={type.href}
            >
              {actions.use}
            </Link>
            {type.example && (
              <Link
                className="text-[13px] font-medium text-muted-foreground hover:text-action"
                href={type.example}
              >
                {actions.example}
              </Link>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

/** The library view: the templates this deployment has already built. */
function LibraryGrid({
  items,
  actions,
}: {
  items: readonly AlignmentTemplate[];
  actions: { readonly use: string; readonly example: string };
}) {
  return (
    <ul className="grid gap-5 md:grid-cols-2">
      {items.map((template) => (
        <TemplateCard key={template.id} template={template} useLabel={actions.use} />
      ))}
    </ul>
  );
}

/**
 * The third view, and it is a door rather than a list.
 *
 * `/` is a public page: it is prerendered, it is served to anyone, and a relationship belongs to
 * the person who bought it. So this panel renders a sentence and one link — the console route
 * that decides who may see the list — and never a row, a name, or a count. The alternative
 * (reading the database here) would put `lib/db/**` in a public route's graph for a list the
 * majority of visitors may not read; `data:check` E34 exists for exactly that crossing.
 */
function MinePanel({ mine }: { mine: AlignmentHomeModel["templates"]["mine"] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6" data-template-mine="">
      <p className="max-w-2xl text-[14px] leading-relaxed text-muted-foreground">{mine.body}</p>
      <Link
        className="mt-5 inline-flex items-center rounded-lg border border-border px-4 py-2.5 text-[14px] font-semibold text-action transition-colors hover:bg-muted"
        href={mine.link.href}
      >
        {mine.link.label}
      </Link>
    </div>
  );
}

/**
 * The three views in the fixture's tab order, with every panel built here — on the server.
 *
 * The toggle owns the state and the labels; this function owns the content. That is why the
 * browser receives markup it can switch between rather than a fixture to draw cards from: the
 * catalogue, the library and the door are rendered once, in this process, and the only thing
 * that crosses into the client bundle is the tabs primitive.
 */
function templateViews(model: AlignmentHomeModel): TemplateView[] {
  const { tabs, actions, catalogue, library, mine } = model.templates;
  const panels: Record<AlignmentTemplateTab["value"], ReactNode> = {
    catalogue: <CatalogueGrid actions={actions} items={catalogue} />,
    library: <LibraryGrid actions={actions} items={library} />,
    mine: <MinePanel mine={mine} />,
  };
  return tabs.map((tab) => ({ value: tab.value, label: tab.label, panel: panels[tab.value] }));
}

export default AlignmentHomeView;
