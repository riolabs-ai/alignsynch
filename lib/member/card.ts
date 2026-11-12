/**
 * The one member card — a projection, the way `catalogueCard` is one (#795 F2).
 *
 * **Two shelves, one type.** `/dashboard/templates` lists templates and `/assessment/instances`
 * lists relationships, and until this module existed each built its own card: the template shelf
 * resolved its words in `lib/member/shelf.ts` while the relationship list assembled `N of M`, a
 * percentage and `toFixed(1)` **inside the render** (`my-instances.tsx`). A derived figure in JSX
 * is invisible to every check the repo has — `E22` fires on a rendered literal, `E23` counts copy,
 * and neither can see `${completed} of ${opened}` — so the arithmetic could drift, or be rounded
 * two ways on two surfaces, with nothing red. It lives here now: a component prints what a card
 * hands it and computes nothing.
 *
 * **What a card says is decided before the component gets it.** `MemberCard` is the shared shape
 * both shelves consume — identity, chips, the one facts line, and the actions — plus the
 * `relationship` half, which is the axis the two record types genuinely differ on (a template has
 * no stage, no second party and nothing paid). A template card carries `relationship: null`; a
 * relationship card carries it filled.
 *
 * **The nulls are deliberate, and they are not all one axis.** Keeping one type means each shelf's
 * card has to answer for the other's fields: a relationship card reports `summary: null` because a
 * summary under the title is the template card's expression (the relationship's line there is the
 * other party), and a template card reports `relationship: null` for the mirror reason. The `meta`
 * line is **not** one of those nulls: both cards end in the same one-line facts row, built here,
 * which is what replaced the relationship list's four metric tiles (#795 F4). That is a real cost — a third shelf
 * adopting this type is the moment to split it into a discriminated `kind` rather than widen it a
 * second time — and the two narrowings below are where the cost is paid: `RelationshipShelfCard`
 * and `TemplateShelfCard` each pin the fields their own shelf renders, so a component cannot be
 * handed a card that would draw an empty line.
 *
 * **Absent is not zero.** `alignment === null` is a relationship nobody has scored, and it prints
 * `CARD_ABSENT` — never `0`, and never `0.0`. The counts are different facts: `0 of 1` sessions is
 * a cycle that has not closed, and it is a figure.
 *
 * No React, no database: a node test drives the builder without a browser, and the page stays the
 * only module that reads a session.
 */
import { MODE_LABELS } from "@/content/assessment";
import { DEMO_NOW_ISO, formatDate, formatRelative } from "@/content/core";
import type { PageCopy } from "@/content/pages";
import { STAGE_LABELS } from "@/content/stages";
import type { RelationshipCard } from "@/lib/db/assessments";
import { instancePath } from "@/lib/flow/paths";
import type { FlowStage } from "@/lib/flow/stage";
import type { InviteDisplayState } from "@/lib/flow/invite-state";
import type { MyInstanceState, UnlockMark } from "@/lib/flow/state";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";

/**
 * The one glyph an absent figure is drawn as.
 *
 * Not `0`, and not an empty cell: a metric that has no value and a metric whose value is zero are
 * different facts, and only one of them can be true of a relationship nobody has scored.
 */
export const CARD_ABSENT = "—";

/**
 * The card's chrome — one frame, one cover, one title, one meta line, shared by both shelves.
 *
 * **The class strings live here because there is one card.** Before this module owned them, each
 * shelf held its own copy of the frame and the title, and the "same frame, same padding" claim in
 * the artifact was a sentence in a comment with nothing enforcing it — the same drift the chip
 * primitive closed (#808). Two consumers, one constant: a card that changes here changes on both
 * shelves, and a component cannot quietly grow a second look.
 *
 * **What is *not* here is the axis.** `CARD_COVER` is the slot's geometry only (the 104 px band and
 * its hairline) because the fill is the declared difference: a template paints
 * `mutedGradientFor(slug)` and draws its monogram, a relationship paints the muted wash and draws
 * its stage word. `CARD_COVER_WORD` is the type both of those words share.
 */
export const CARD_FRAME =
  "flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900";

/** The 104 px cover slot, geometry only — the fill is the axis, and the caller paints it. */
export const CARD_COVER =
  "flex h-[104px] items-center justify-center border-b border-gray-200 dark:border-gray-700";

/**
 * The one word in the cover: the template's monogram, the relationship's stage.
 *
 * Ink at ~34%, not white: the wash behind it is an 86%-lightness tint, and the artifact measured
 * that white type on it is invisible — the same derivation `lib/category-gradient.ts` documents.
 */
export const CARD_COVER_WORD =
  "text-3xl font-bold tracking-[0.06em] text-gray-900/[.34] dark:text-gray-100/[.34]";

/** The card's one title link — the same two-line clamp on both shelves. */
export const CARD_TITLE =
  "line-clamp-2 text-lg font-semibold text-gray-900 hover:text-action hover:underline dark:text-gray-100";

/** The one facts line: the segments `meta` carries, separated by a hairline, never a tile grid. */
export const CARD_META =
  "flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400";

/** The action row: where both cards' links sit, under the same hairline. */
export const CARD_ACTIONS =
  "mt-auto flex flex-wrap items-center gap-2 border-t border-gray-200 px-4 py-3 dark:border-gray-700";

/**
 * Everything only a relationship card can say. `null` on a template card.
 *
 * The `data-*` values are here rather than derived in the component for the same reason the words
 * are: the row's handles and the row's figures come from one read, and a component that has to
 * reach back into the row for one of them is a component that can print a number the projection
 * did not decide.
 */
export interface RelationshipMemberCard {
  readonly relationshipId: string;
  /** The latest session — the card's link target, and the `data-instance` hook. */
  readonly instanceRecordId: string;
  readonly stage: FlowStage;
  readonly stageLabel: string;
  readonly state: MyInstanceState;
  readonly unlock: UnlockMark;
  /** The template this relationship was copied from — the card's first chip. */
  readonly templateTitle: string;
  /** `With · Rowan`, from the seat the read resolved for this request. */
  readonly party: string;
  readonly mode: string;
  /** The latest session's invitation, or `null` when the read did not hand one. */
  readonly invite: { readonly state: InviteDisplayState; readonly label: string } | null;
  /** The row's own sentence: `You have both accepted — the Gap is open`, or who is still to answer. */
  readonly sentence: string;
  /** The #252 line, on a complete row this reader has not opened since; `null` otherwise. */
  readonly marker: string | null;
  /** `Paid` — the statement, or `null` for "nothing to state" (drawn `—`); `null` for other seats. */
  readonly paid: { readonly label: string; readonly statement: string | null } | null;
  /** `Last session 2 days ago` — a pure function of the row's instant, never a clock. */
  readonly lastSession: string;
}

/**
 * One card, in the shape both shelves draw it.
 *
 * `create` and `relationship` are `null` rather than absent keys: the component's branch is
 * "is there a second action / is this a relationship", and an optional field would let a card
 * that should offer one render nothing at all.
 */
export interface MemberCard {
  readonly id: string;
  /** The gradient's seed — the record's slug, the same field `gradientFor()` hashes. */
  readonly slug: string;
  readonly title: string;
  /**
   * The one-line description under the title. `null` on a relationship card: the line under its
   * title is the other party (`relationship.party`), not a summary of the record.
   */
  readonly summary: string | null;
  readonly chips: readonly string[];
  /**
   * The one facts line, and it is the same line on both shelves (#795 F4).
   *
   * A relationship card fills it (`3 of 4 sessions`, `Avg alignment 2.4`, `5 Aspects`) instead of
   * drawing a four-tile grid, and every segment's arithmetic happened here — the component prints
   * the segments and joins nothing. `meta: []` is a card with nothing to count, which is not a
   * state either builder produces today.
   */
  readonly meta: readonly string[];
  readonly detail: { readonly href: string; readonly label: string };
  readonly create: { readonly href: string; readonly label: string } | null;
  readonly relationship: RelationshipMemberCard | null;
}

/**
 * A card that is known to be a relationship — what `relationshipCard()` returns.
 *
 * A narrowing of `MemberCard`, not a second projection: the shared shape is still the contract the
 * shelf prints, and this only says the one nullable part is filled.
 */
export type RelationshipShelfCard = MemberCard & { readonly relationship: RelationshipMemberCard };

/**
 * A card a template shelf can draw — what `catalogueCard()` and `mineCard()` return.
 *
 * The mirror of `RelationshipShelfCard`, and the reason the base type is not simply widened: the
 * shelf prints `summary` into a paragraph and always offers a `create` action, so a card that
 * fills neither would render an empty line and a dead action. Narrowing the two fields here means
 * the type refuses that card instead of the screen showing it.
 */
export type TemplateShelfCard = MemberCard & {
  readonly summary: string;
  readonly create: { readonly href: string; readonly label: string };
};

/** The fixture clock's instant, as milliseconds — the label is pure over the instant it read. */
const FIXTURE_CLOCK_MS = Date.parse(DEMO_NOW_ISO);

/**
 * The label a row's instant is drawn with — a pure function of the instant, never a clock.
 *
 * An instant past the fixture clock is the one thing `formatRelative` cannot say ("in 3 days"
 * is not a history), so it is drawn as a date instead.
 */
export function sessionLabelOf(iso: string): string {
  return Date.parse(iso) > FIXTURE_CLOCK_MS ? formatDate(iso) : formatRelative(iso);
}

/**
 * The other side of the card, from the seat the read resolved for this request.
 *
 * Which name is "the other one" is the session's fact, not the row's: the same relationship
 * renders as two different cards to its two parties, and neither card ever names its own reader
 * as the other person. A coach is neither, so they read both names in the direction the
 * relationship was created in.
 */
function otherNameOf(row: RelationshipCard, copy: PageCopy): string {
  const unnamed = itemLabel(sectionOf(copy, "row"), "unnamed-party");
  if (row.viewerRole === "counterparty") return row.initiatorName ?? unnamed;
  if (row.viewerRole === "initiator") return row.counterpartyName ?? unnamed;
  return `${row.initiatorName ?? unnamed} → ${row.counterpartyName ?? unnamed}`;
}

/**
 * `1 of 2` — sessions completed of sessions opened.
 *
 * A relationship with no session opened has no ratio, so it says `—`: `0 of 0` would be a
 * division that never happened dressed as a figure.
 */
function sessionsValue(row: RelationshipCard): string {
  return row.sessionsOpened === 0
    ? CARD_ABSENT
    : `${row.sessionsCompleted} of ${row.sessionsOpened}`;
}

/** `2.4` — the mean Gap, to one decimal; `—` until a session is complete and scored. */
function alignmentValue(row: RelationshipCard): string {
  return row.alignment === null ? CARD_ABSENT : row.alignment.toFixed(1);
}

/**
 * The card's one meta line — the same row the template card prints, built here (#795 F4).
 *
 * The artifact approved option A: the relationship's four metric tiles **are** this line, drawn
 * `3 of 4 Sessions`, `Avg alignment 2.4`, `5 Aspects` instead of a 2×2 grid of labelled boxes. Every
 * figure is still derived in this module and nowhere else, and the segments are strings a component
 * can only print — joining them with a hairline is markup, not arithmetic.
 *
 * **What the line carries, and why.** The ratio is the artifact's first segment; the alignment says
 * `No scored session yet` rather than `—` where the tiles used to hang that sentence under a dash,
 * because a bare dash in a run of words reads as a typo. The completion percentage the tiles also
 * drew is **gone**: `3 of 4` already states it, and two ways of saying one count is how the two
 * surfaces drifted before. The Aspect count stays — it is the count the template card's line also
 * opens with, and dropping it would be a fact the approved drawing keeps.
 */
function metaOf(row: RelationshipCard, copy: PageCopy): readonly string[] {
  const metric = sectionOf(copy, "metric");
  return [
    `${sessionsValue(row)} ${itemLabel(metric, "sessions")}`,
    row.alignment === null
      ? itemLabel(metric, "unscored")
      : `${itemLabel(metric, "alignment")} ${alignmentValue(row)}`,
    `${row.aspectCount} ${itemLabel(metric, "aspects")}`,
  ];
}

/**
 * What was paid — the Initiator's card only, and no total anywhere.
 *
 * `paid: null` on the row is "this is not your fact": every other seat is handed nothing, so the
 * block is absent rather than blanked. `statement: null` inside it is the different fact that the
 * Initiator has paid nothing yet, drawn `—` — one relationship is one purchase, and there is no
 * second payment to sum.
 */
function paidOf(
  row: RelationshipCard,
  copy: PageCopy,
): { readonly label: string; readonly statement: string | null } | null {
  if (row.paid === null) return null;
  const paidCopy = sectionOf(copy, "paid");
  const label = itemLabel(paidCopy, "label");
  if (row.paid.plan === null && row.paid.purchasedAt === null) return { label, statement: null };
  return {
    label,
    statement: fillLabel(itemLabel(paidCopy, "statement"), {
      plan: row.paid.plan ?? itemLabel(paidCopy, "nothing"),
      date: row.paid.purchasedAt === null ? CARD_ABSENT : formatDate(row.paid.purchasedAt),
    }),
  };
}

/**
 * A relationship card: what this list says about one relationship, from one seat.
 *
 * Every word is the fixture's (`data/pages/assessment-instances.ts`) and every figure is derived
 * from the row, so the component that draws it holds neither. Returned narrowed — the shelf has
 * already established that this card *is* a relationship, and a `| null` it would have to assert
 * away at the call site buys nothing.
 */
export function relationshipCard(copy: PageCopy, row: RelationshipCard): RelationshipShelfCard {
  const card = sectionOf(copy, "card");
  const states = sectionOf(copy, "state");
  const other = otherNameOf(row, copy);
  const invite =
    row.inviteState === null
      ? null
      : {
          state: row.inviteState,
          label: itemLabel(sectionOf(copy, "invite"), row.inviteState),
        };
  return {
    id: row.instanceRecordId,
    slug: row.slug,
    title: row.name,
    summary: null,
    chips: [row.templateTitle],

    meta: metaOf(row, copy),
    detail: { href: instancePath(row.instanceRecordId), label: itemLabel(card, "view") },
    create: null,
    relationship: {
      relationshipId: row.relationshipId,
      instanceRecordId: row.instanceRecordId,
      stage: row.stage,
      stageLabel: STAGE_LABELS[row.stage],
      state: row.state,
      unlock: row.unlock,
      templateTitle: row.templateTitle,
      party: `${itemLabel(card, "with")} · ${
        row.counterpartyName === null && row.viewerRole !== "counterparty"
          ? itemLabel(card, "not-claimed")
          : other
      }`,
      mode: MODE_LABELS[row.mode],
      invite,
      sentence: fillLabel(itemLabel(states, row.state), { name: other }),
      marker: row.unlock === "unseen" ? itemLabel(sectionOf(copy, "marker"), "unseen") : null,
      paid: paidOf(row, copy),
      lastSession: fillLabel(itemLabel(card, "last-session"), {
        when: sessionLabelOf(row.lastSessionAt),
      }),
    },
  };
}
