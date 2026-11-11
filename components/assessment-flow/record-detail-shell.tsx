/**
 * template-ancestor: components/marketing/marketing-landing.tsx   (variation: the landing's one-column band plus the 320 px decision-aside lifted out as the record detail shell both detail pages render)
 *
 * The shared record detail shell (#795, card t_7fb6b908) — `docs/mockups/one-card-one-detail-v2.html`
 * §4/§5, approved on option A.
 *
 * **One shell, and the order is the spec.** Identity band → facts → content → actions. The band
 * carries the group chip, the realm, the type, **exactly one `<h1>`**, the roles line and the
 * summary; the facts card is the two-column `<dl>` in the 320 px aside; the actions slot is
 * whatever the record type does next; the content column holds the sections the record is *about*.
 * A screen that reorders those four, or draws a second `<h1>`, is the defect this file exists to
 * make impossible: both detail pages render this component, so neither can drift alone.
 *
 * **Two declared axes, and nothing else may vary.** The artifact approves (1) the cover slot —
 * a template's muted wash plus monogram against a relationship's stage word, which is a *card*
 * difference drawn by `template-card.tsx` and `relationship-cards.tsx`, not by this file — and
 * (2) the working panels, which exist on the relationship only (Edit, Publish, Complete in the
 * actions slot where the template draws “What you can do with it”). Everything else is identical:
 * the band, the facts card, the back link, the section order, the page column.
 *
 * **It emits no copy of its own.** Every string here arrives as a prop, resolved by the page from
 * its own fixture. Two reasons, and both are load-bearing: E23's copy ratchet counts a literal in
 * a route's import closure, and this module is in the closure of *both* routes with different
 * fixtures — a sentence written here would belong to neither page's fixture and could only be
 * checked against one. So the band takes `groupLabel` / `rolesLine` / `summary` already resolved,
 * and the caller keeps owning its words.
 *
 * **The band's `data-*` hooks are one set per scope, and the template keeps its old names.** §6 of
 * the artifact requires `data-template-detail-*` to survive the move, so a template mount emits
 * both `data-record-band` (the shared name, which is how a suite asserts *the same band* on both
 * pages) and its legacy stem. New surfaces get the `data-record-*` set only.
 */
import { Chip } from "@/components/ui/badge";
import type { RelationshipType } from "@/data/relationship-types";
import type { ReactNode } from "react";

/** The record types this shell draws. It is the scope of the band's `data-*` hooks. */
export type RecordScope = "template" | "relationship";

/** The card the 320 px aside and every content section use — one radius, one border, one padding. */
export const DETAIL_CARD = "rounded-lg border border-border bg-card p-6";

/** A section's or a fact's supporting sentence. */
export const DETAIL_MUTED = "text-sm text-muted-foreground";

/** The small caps label a fact or a descriptor pair is titled with. */
export const DETAIL_FACT_LABEL = "text-xs uppercase tracking-wide text-muted-foreground";

/**
 * The band's hook names, per scope.
 *
 * `data-record-band` is on both — that is the one attribute a suite reads to prove the *same*
 * component drew both pages. The chip names are per scope so the template's existing
 * `data-template-detail-*` contract (artifact §6, decision 6) survives the move while the
 * relationship's new band does not invent a third stem.
 */
const BAND_HOOKS: Readonly<
  Record<
    RecordScope,
    {
      readonly band: Record<string, string>;
      readonly group: string;
      readonly realm: string;
      readonly type: string;
    }
  >
> = {
  template: {
    band: { "data-record-band": "template", "data-template-detail-band": "true" },
    group: "data-template-detail-group",
    realm: "data-template-detail-realm",
    type: "data-template-detail-short-name",
  },
  relationship: {
    band: { "data-record-band": "relationship", "data-relationship-detail-band": "true" },
    group: "data-record-group",
    realm: "data-record-realm",
    type: "data-record-type",
  },
};

/**
 * The identity band: three chips, one `<h1>`, the roles line, the summary.
 *
 * A template and a relationship draw this identically — the artifact's §1 lists the band under
 * “not axes”. `type` is optional because a record's slug may name no catalogue type; the chips
 * then do not render and the caller decides what its roles line says instead.
 */
export function DetailBand({
  scope,
  type,
  title,
  summary,
  groupLabel,
  rolesLine,
}: {
  scope: RecordScope;
  type: RelationshipType | undefined;
  title: string;
  summary: string;
  /** The group's own word for its chip (`Business` / `Personal`), resolved from the page's copy. */
  groupLabel: string;
  /** The two seats in one line (`Staff / Manager`), resolved from the page's copy. */
  rolesLine: string | undefined;
}) {
  const hooks = BAND_HOOKS[scope];
  const typeId = type?.id ?? "none";
  return (
    <header
      {...hooks.band}
      data-record-band-type={typeId}
      {...(scope === "template" ? { "data-template-detail-type": typeId } : {})}
      className="rounded-lg bg-foreground px-6 py-6 text-background"
    >
      {type === undefined ? null : (
        <p className="flex flex-wrap items-center gap-2">
          <Chip variant="onBand" {...{ [hooks.group]: groupLabel }}>
            {groupLabel}
          </Chip>
          <Chip variant="onBand" {...{ [hooks.realm]: type.realm }}>
            {type.realm}
          </Chip>
          <Chip variant="onBand" {...{ [hooks.type]: type.id }}>
            {type.shortName}
          </Chip>
        </p>
      )}
      <h1 className="mt-2 text-3xl font-bold">{title}</h1>
      {rolesLine === undefined || rolesLine === "" ? null : (
        <p className="mt-2 text-sm text-background/80">{rolesLine}</p>
      )}
      {summary === "" ? null : <p className="mt-3 text-sm text-background/80">{summary}</p>}
    </header>
  );
}

/** One row of the facts card. `figure` is the numeric step; everything else is prose or a chip. */
export interface DetailFact {
  readonly id: string;
  readonly label: string;
  readonly value: ReactNode;
  readonly figure?: boolean;
  /** `data-*` hooks on the `<dd>` — a fact a suite reads by name. */
  readonly hooks?: Record<string, string>;
}

/**
 * The facts card — the template's four figures and the relationship's four facts, one anatomy.
 *
 * A cell is a label and a value; `figure` is the numeric step the template's counts use, and
 * everything else is prose or a chip (the relationship's `State` is the chip). The `footnote` is
 * where a card says the one thing that is not a fact/value pair: which seat the reader holds, or who
 * wrote the record. It sits inside the same card, under the `<dl>`, so the card keeps a single frame
 * on both pages.
 */
export function DetailFacts({
  facts,
  footnote,
  hooks,
}: {
  facts: readonly DetailFact[];
  footnote?: ReactNode;
  hooks?: Record<string, string>;
}) {
  return (
    <section className={`space-y-3 ${DETAIL_CARD}`} {...hooks}>
      <dl className="grid grid-cols-2 gap-3">
        {facts.map((fact) => (
          <div key={fact.id}>
            <dt className={DETAIL_FACT_LABEL}>{fact.label}</dt>
            <dd
              {...fact.hooks}
              className={
                fact.figure === true
                  ? "text-lg font-semibold tabular-nums text-foreground"
                  : DETAIL_MUTED
              }
            >
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
      {footnote}
    </section>
  );
}

/**
 * One working panel in the actions slot, at the shell's heading size.
 *
 * The artifact's only type step that moves: a 24 px `CardTitle` in a 320 px rail is what made the
 * two pages read as two products, so a panel title is `text-base font-semibold` — the size the
 * template's “What you can do with it” has always drawn.
 */
export function DetailPanel({
  title,
  children,
  hooks,
}: {
  /** Optional: a fixture section may declare no heading, and an empty `<h2>` is not a heading. */
  title?: string;
  children: ReactNode;
  hooks?: Record<string, string>;
}) {
  return (
    <section className={`space-y-2 ${DETAIL_CARD}`} {...hooks}>
      {title === undefined ? null : (
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
      )}
      {children}
    </section>
  );
}

/**
 * One content section: a 20 px heading, an optional supporting sentence, then whatever the section
 * draws (the Aspect list, the descriptor pair, the shape of the record).
 *
 * `framed` puts the section on the shared card; the Aspect list is deliberately unframed so its
 * rows are the cards, which is how both pages draw it.
 */
export function DetailSection({
  title,
  body,
  children,
  framed = false,
  hooks,
}: {
  /** Optional: a fixture section may declare no heading, and an empty `<h2>` is not a heading. */
  title?: string;
  body?: string;
  children?: ReactNode;
  framed?: boolean;
  hooks?: Record<string, string>;
}) {
  return (
    <section className={framed ? `space-y-2 ${DETAIL_CARD}` : undefined} {...hooks}>
      {title === undefined ? null : (
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      )}
      {body === undefined ? null : <p className={`mt-2 ${DETAIL_MUTED}`}>{body}</p>}
      {children}
    </section>
  );
}

/**
 * The shell: back link, band, then the 320 px aside (facts, actions) beside the content column.
 *
 * The back link is not decoration and not optional — the artifact's F5 finding was that the
 * relationship page had no way back to its own list while the template page had had one all along.
 * Both pages now hand one in, and the label is the page's own words (`All templates`,
 * `All relationships`).
 */
export function RecordDetailShell({
  scope,
  back,
  band,
  facts,
  actions,
  children,
}: {
  scope: RecordScope;
  back: { readonly href: string; readonly label: string };
  band: ReactNode;
  facts: ReactNode;
  /** The working panels. Absent on a template, whose actions slot is the one “What you can do” card. */
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <nav aria-label={back.label} className="mb-3">
        <a
          className="text-sm font-medium text-action hover:underline"
          href={back.href}
          data-record-back={scope}
        >
          {back.label}
        </a>
      </nav>

      {band}

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          {facts}
          {actions}
        </aside>

        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </>
  );
}
