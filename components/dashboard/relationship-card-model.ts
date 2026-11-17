/**
 * One relationship, as the v2 card draws it — the projection both member screens share (#1129).
 *
 * **Every word is passed in.** This module decides the *state*, the *bar* and the *action's
 * destination*; it decides no sentence, so it can be reached from `/dashboard` and from
 * `/dashboard/relationships` without either surface's fixture being asked for the other's words
 * (`scripts/copy-refs.ts` validates a shared file against the fixture of every surface that
 * reaches it — a hard-coded `itemLabel` here would be a permanent failure on one of the two).
 *
 * **The four card states are the owner's words, not the seven lifecycle values.** A relationship's
 * `status` is `draft | pending | published | active | complete | void | expired`
 * (`lib/relationship/status.ts`) and the card draws one chip from exactly four words —
 * `lib/member/start.ts::cardStateOf` is the single mapping. This module reads its result and never
 * compares a lifecycle value inline.
 *
 * **The action follows the state, and the destination is always a real surface:**
 *
 *   live     `open`        outline  the relationship's own screen
 *   waiting  `open`        outline  the same screen, which is where the invite is handled
 *   draft    `continue`    solid    the create flow's own door for this template
 *   paused   `add-card`    solid    the relationship, whose band carries the card capture until
 *                                   bundle 08's standalone Payment page lands (#1132)
 *
 * A **paused** relationship keeps its mini bar and relabels it (`read-only`); a card with no
 * answers carries `noResults` — the dashed sentence — rather than a bar of zeroes, because a bar of
 * zeroes describes an alignment nobody computed.
 */
import { createRelationshipPath, relationshipPath } from "@/lib/flow/paths";
import type { AlignmentSummary } from "@/lib/member/alignment-summary";
import type { MemberRelationshipRow } from "@/lib/member/relationships";
import { cardStateOf } from "@/lib/member/start";
import { fillLabel } from "@/lib/page-copy";
import type { AspectMark, RelationshipCardLabels, RelationshipCardView } from "./relationship-card";

/** The words a card needs beyond its own chrome: the sentences each state says instead of a bar. */
export interface RelationshipCardWords extends RelationshipCardLabels {
  /** `Waiting on Invite` — the invite has gone out and nobody has joined yet. */
  readonly waitingNext: string;
  /** `Draft` — configured, not sent. */
  readonly draftNext: string;
  /** `Paused` — the trial lapsed; nothing is lost, nothing moves. */
  readonly pausedNext: string;
  /** `Continue Setup` — the draft action. */
  readonly continueLabel: string;
  /** `Add a Card` — the paused action. */
  readonly addCardLabel: string;
}

/** The relationship's own name: what stage 1 named it, else the template it was copied from. */
export function titleOf(row: MemberRelationshipRow): string {
  return row.relationshipTitle ?? row.title;
}

/** The other person, as this row's viewer sees them. */
export function partyOf(row: MemberRelationshipRow): string | null {
  return row.viewerRole === "initiator" ? row.counterpartyName : row.initiatorName;
}

/** One Aspect's mark for the mini bar, from the verdict word its Setting produced. */
function markOf(status: "in-synch" | "small-gap-ok" | "small-gap-tight" | "gap"): AspectMark {
  if (status === "in-synch") return "in-synch";
  if (status === "gap") return "gap";
  return "small-gap";
}

/** Fill `{name}` / `{prompt}` through the one helper the rest of the tree uses. */
const fill = fillLabel;

/** One relationship, as the shared card draws it. `null` for a closed (`void`) row. */
export function cardViewOf(
  row: MemberRelationshipRow,
  summary: AlignmentSummary | null,
  words: RelationshipCardWords,
): RelationshipCardView | null {
  const state = cardStateOf(row);
  if (state === null) return null;

  const name = partyOf(row);
  const marks: AspectMark[] = summary === null ? [] : summary.aspects.map((a) => markOf(a.status));

  const nextLine =
    summary !== null && summary.nextStep !== null
      ? fill(words.next, { prompt: summary.nextStep.prompt })
      : state === "waiting"
        ? fill(words.waitingNext, { name: name ?? "" })
        : state === "draft"
          ? words.draftNext
          : state === "paused"
            ? words.pausedNext
            : words.noResults;

  const action =
    state === "draft"
      ? { label: words.continueLabel, href: createRelationshipPath(row.templateSlug), solid: true }
      : state === "paused"
        ? { label: words.addCardLabel, href: relationshipPath(row.id), solid: true }
        : { label: words.open, href: relationshipPath(row.id), solid: false };

  return {
    relationshipId: row.id,
    href: relationshipPath(row.id),
    title: titleOf(row),
    partyName: name,
    templateTitle: row.title,
    state,
    nextLine,
    actionLabel: action.label,
    actionHref: action.href,
    actionSolid: action.solid,
    summary: summary === null ? null : { aligned: summary.aligned, total: summary.total, marks },
    /* A paused relationship keeps its bar and relabels it; nothing else is read-only here. */
    readOnly: state === "paused",
  };
}
