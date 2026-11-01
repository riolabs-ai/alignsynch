/**
 * The console's prototype population — six relationships and four templates, drawn so the admin
 * overview can be reviewed before any of it is wired to a table (#console cohort 1).
 *
 * **Why a fixture and not a read.** The overview the owner asked for shows counts of relationships,
 * seats, templates and completed work. Every one of those is a Postgres read today
 * (`lib/db/admin-instances.ts`), and a screen built against it cannot be reviewed before it is
 * built against it. So the screen is drawn over a fixture first, this one, and the numbers on it
 * are the lengths of arrays in this file. Nothing here is a copy of a real relationship, a real
 * person or a real score: the names are invented, the instants are placed against the fixture clock
 * (`content/core.ts::DEMO_NOW_ISO`), and no opinion, answer or Gap is stored at all.
 *
 * **The types live in this file, on purpose.** A `lib/db/**` import — even `import type` — would put
 * the database layer in this module's graph, and `scripts/gen-ui-registry.mjs` reads that graph to
 * decide whether a surface is `fixture` or `db`. The registry would then be *right* that the page
 * reaches Postgres and *wrong* about what the page does, which is the one thing that half of the
 * registry exists to prevent. `PrototypeRelationship` is therefore its own narrow shape: the
 * columns the screen draws, and nothing that could carry an answer.
 *
 * **Consistency is derived, never typed twice.** `countsOf()` is the only place a figure is
 * computed, `needsAttention()` is the only place a row is selected for the second band, and
 * `tests/prototype-fixture.test.ts` asserts that the four figures equal filters over these arrays —
 * so a row added here moves the counts with it instead of leaving a screen that disagrees with its
 * own data.
 */
import { dayDelta } from "../../content/core";

/* ------------------------------------------------------------------ *
 * The shapes
 * ------------------------------------------------------------------ */

/**
 * The four relationship stages, in ladder order — the same four words `content/stages.ts` authors.
 * Spelled here rather than imported because this fixture may not reach the content model's imports,
 * and `tests/prototype-fixture.test.ts` asserts the two lists are equal so neither can drift alone.
 */
export const PROTOTYPE_STAGES = ["invited", "connected", "sharing", "aligned"] as const;

export type PrototypeStage = (typeof PROTOTYPE_STAGES)[number];

/**
 * The stages that mean the sheet is **not** complete — `content/stages.ts::STAGES_BEFORE_COMPLETE`,
 * restated for the same reason the list above is. `sharing` and `aligned` describe a finished sheet:
 * both parties submitted, and the Gaps are being read.
 */
const STAGES_BEFORE_COMPLETE = [
  "invited",
  "connected",
] as const satisfies readonly PrototypeStage[];

/**
 * What a seat can be. The four words are the registry's seat vocabulary
 * (`components/admin/instance-registry.tsx`): an account, an invitation nobody has claimed, a seat
 * row with no account, and an invitation that ran out.
 */
export const SEAT_STATES = ["claimed", "invited", "unclaimed", "expired"] as const;

export type PrototypeSeatState = (typeof SEAT_STATES)[number];

/**
 * One seat. `name` is `null` for every state but `claimed`: an invitation's own name and address are
 * the invitation's, not the seat's, and a screen that printed one would be showing something the
 * real read never selects (`data/pages/admin-instances.ts` records the same rule).
 */
export interface PrototypeSeat {
  readonly state: PrototypeSeatState;
  readonly name: string | null;
}

/** One relationship, reduced to the columns the overview draws. No opinion, no score, no Gap. */
export interface PrototypeRelationship {
  readonly id: string;
  /** The spec's maintenance field (`docs/specs/maintenance-fields.md`): the pair's own name. */
  readonly name: string;
  /** `PrototypeTemplate.id` — joined in this file, checked by the fixture test. */
  readonly templateId: string;
  readonly stage: PrototypeStage;
  readonly initiator: PrototypeSeat;
  readonly counterparty: PrototypeSeat;
  /** An instant, never a rendered label: `daysIdle()` is the only thing that turns it into words. */
  readonly lastActivity: string;
}

/** One template in the library. `builtIn` is the axis the counts split on. */
export interface PrototypeTemplate {
  readonly id: string;
  readonly name: string;
  readonly builtIn: boolean;
}

/**
 * One prototype screen, as the index lists it. The words are the copy fixture's (keyed by `id`);
 * this record carries only the two facts a page needs to draw a link and a label: where the screen
 * is, and what it is standing in for.
 */
export interface PrototypeScreen {
  readonly id: string;
  /** The prototype route that renders today. */
  readonly href: string;
  /** The wired route this screen becomes. Not built yet — see `docs/PROTOTYPE-CONSOLE.md`. */
  readonly eventualRoute: string;
}

/* ------------------------------------------------------------------ *
 * The records
 * ------------------------------------------------------------------ */

/**
 * Four templates: three the platform ships and one an account authored. The authored one is used by
 * an aligned relationship, so no template in this library is a row nobody can open.
 */
export const prototypeTemplates: readonly PrototypeTemplate[] = [
  { id: "core-values", name: "Core Values", builtIn: true },
  { id: "working-styles", name: "Working Styles", builtIn: true },
  { id: "team-charter", name: "Team Charter", builtIn: true },
  { id: "values-refresh", name: "Our Values Refresh", builtIn: false },
];

/**
 * Six relationships across the four stages: two invited, two connected, one sharing, one aligned.
 *
 * The seat states are chosen so the ladder and the seats agree — `invited` means the counterparty
 * has not claimed, `connected` and past it mean both seats are accounts — because a screen that
 * contradicted the model would be a defect the reviewer inherits rather than one they find.
 *
 * The instants are days before `DEMO_NOW_ISO` (2026-10-29), never after it: three rows are quiet
 * enough to need attention (11, 6 and 9 days) and three are recent.
 */
export const prototypeRelationships: readonly PrototypeRelationship[] = [
  {
    id: "ada-rowan",
    name: "Ada & Rowan",
    templateId: "core-values",
    stage: "invited",
    initiator: { state: "claimed", name: "Ada Whitfield" },
    counterparty: { state: "expired", name: null },
    lastActivity: "2026-10-18T09:20:00.000Z",
  },
  {
    id: "blake-sam",
    name: "Blake & Sam",
    templateId: "working-styles",
    stage: "invited",
    initiator: { state: "claimed", name: "Blake Osei" },
    counterparty: { state: "unclaimed", name: null },
    lastActivity: "2026-10-23T16:05:00.000Z",
  },
  {
    id: "cleo-dev",
    name: "Cleo & Dev",
    templateId: "core-values",
    stage: "connected",
    initiator: { state: "claimed", name: "Cleo Marsh" },
    counterparty: { state: "claimed", name: "Dev Raman" },
    lastActivity: "2026-10-20T11:40:00.000Z",
  },
  {
    id: "rowan-wren",
    name: "Rowan & Wren",
    templateId: "team-charter",
    stage: "connected",
    initiator: { state: "claimed", name: "Rowan Pike" },
    counterparty: { state: "claimed", name: "Wren Achebe" },
    lastActivity: "2026-10-28T08:15:00.000Z",
  },
  {
    id: "sam-ash",
    name: "Sam & Ash",
    templateId: "working-styles",
    stage: "sharing",
    initiator: { state: "claimed", name: "Sam Otieno" },
    counterparty: { state: "claimed", name: "Ash Delacroix" },
    lastActivity: "2026-10-27T14:50:00.000Z",
  },
  {
    id: "dev-iris",
    name: "Dev & Iris",
    templateId: "values-refresh",
    stage: "aligned",
    initiator: { state: "claimed", name: "Dev Raman" },
    counterparty: { state: "claimed", name: "Iris Kaur" },
    lastActivity: "2026-10-28T19:30:00.000Z",
  },
];

/**
 * The screens that exist today. One entry per prototype route, and a route that does not render is
 * not listed here — the index is the answer to "what can I look at", not to "what is planned".
 *
 * Cohorts 2 and 4 append their entries (`/prototype/relationships`, `/prototype/admin/gaps`) and the
 * index picks them up without a component change.
 */
export const prototypeScreens: readonly PrototypeScreen[] = [
  { id: "admin", href: "/prototype/admin", eventualRoute: "/admin" },
];

/* ------------------------------------------------------------------ *
 * The derivations
 * ------------------------------------------------------------------ */

/** How long a relationship may sit still before the overview names it. A week, stated once. */
export const STALE_DAYS = 7;

/** Whole days between a relationship's last activity and the fixture clock. */
export function daysIdle(lastActivity: string): number {
  return dayDelta(lastActivity);
}

/** The seat states that mean somebody is waiting on an invitation: nobody claimed it, or it died. */
const AWAITING_INVITATION = ["unclaimed", "expired"] as const;

function awaitsInvitation(seat: PrototypeSeat): boolean {
  return (AWAITING_INVITATION as readonly PrototypeSeatState[]).includes(seat.state);
}

/**
 * Every seat with an unclaimed or expired invitation, across both parties — a **list** rather than a
 * count, so the figure on the screen is its length and there is no second rule that could disagree
 * with the rows.
 */
export function awaitingInvitationSeats(
  relationships: readonly PrototypeRelationship[],
): readonly { readonly relationshipId: string; readonly seat: PrototypeSeat }[] {
  const found: { relationshipId: string; seat: PrototypeSeat }[] = [];
  for (const relationship of relationships) {
    for (const seat of [relationship.initiator, relationship.counterparty]) {
      if (awaitsInvitation(seat)) found.push({ relationshipId: relationship.id, seat });
    }
  }
  return found;
}

/** A relationship whose sheet is finished: both parties submitted (Sharing or Aligned). */
export function isComplete(relationship: PrototypeRelationship): boolean {
  return !(STAGES_BEFORE_COMPLETE as readonly PrototypeStage[]).includes(relationship.stage);
}

/**
 * Does this row belong in the "needs attention" band? Two reasons, and both are facts about the
 * row: an invitation nobody claimed or one that expired, and a relationship that has not moved for
 * `STALE_DAYS`. Nothing here reads an opinion — an operator triaging a stalled pair does not need
 * either party's answers, and this fixture has none to give.
 */
export function needsAttention(relationship: PrototypeRelationship): boolean {
  const seats = [relationship.initiator, relationship.counterparty];
  return seats.some(awaitsInvitation) || daysIdle(relationship.lastActivity) >= STALE_DAYS;
}

/**
 * The rows the second band draws: the attention set, quietest first. Sorted here rather than in the
 * component so the screenshot and any future test read the same order.
 */
export function attentionRows(
  relationships: readonly PrototypeRelationship[],
): readonly PrototypeRelationship[] {
  return relationships
    .filter(needsAttention)
    .slice()
    .sort((left, right) => daysIdle(right.lastActivity) - daysIdle(left.lastActivity));
}

/** The four figures the overview draws, and the two splits behind two of them. */
export interface PrototypeCounts {
  /** Every relationship in the fixture — the population the stage split is over. */
  readonly relationships: number;
  readonly byStage: Readonly<Record<PrototypeStage, number>>;
  /** Seats whose invitation is unclaimed or expired (`awaitingInvitationSeats().length`). */
  readonly awaitingInvitation: number;
  readonly templates: number;
  readonly builtInTemplates: number;
  readonly authoredTemplates: number;
  /** Finished sheets: Sharing and Aligned. */
  readonly complete: number;
}

/**
 * The only place a figure on the overview is computed. Every value is a length or a filter over the
 * two arrays above; there is no percentage, no average, no composite and no authored number, which
 * is what "counts of the fixture rows" has to mean if a reviewer is to check it in one place.
 */
export function countsOf(
  relationships: readonly PrototypeRelationship[],
  templates: readonly PrototypeTemplate[],
): PrototypeCounts {
  const byStage: Record<PrototypeStage, number> = {
    invited: 0,
    connected: 0,
    sharing: 0,
    aligned: 0,
  };
  for (const relationship of relationships) byStage[relationship.stage] += 1;

  const builtIn = templates.filter((template) => template.builtIn).length;

  return {
    relationships: relationships.length,
    byStage,
    awaitingInvitation: awaitingInvitationSeats(relationships).length,
    templates: templates.length,
    builtInTemplates: builtIn,
    authoredTemplates: templates.length - builtIn,
    complete: relationships.filter(isComplete).length,
  };
}

/** The figures the `/prototype/admin` screen renders. */
export const prototypeCounts: PrototypeCounts = countsOf(
  prototypeRelationships,
  prototypeTemplates,
);

/** The rows `/prototype/admin`'s second band renders. */
export const prototypeAttentionRows: readonly PrototypeRelationship[] =
  attentionRows(prototypeRelationships);

/** A template by id, for the table's join. Throws instead of rendering a blank cell. */
export function templateById(id: string): PrototypeTemplate {
  const template = prototypeTemplates.find((candidate) => candidate.id === id);
  if (!template) {
    throw new Error(
      `data/prototypes/console.ts: relationship names template "${id}", which the library does not carry`,
    );
  }
  return template;
}
