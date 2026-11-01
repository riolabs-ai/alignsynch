/**
 * data/v1/relationship-types.ts — the /v1 prototype's relationship taxonomy.
 *
 * Six relationship types, each with a name, a one-line "who it's for", a one-line "who it is
 * **not** for", and a starter set of Aspects written in the product's own language. These are
 * the public face of the prototype: `/v1/templates` (the catalogue), `/v1/templates/[type]`
 * (the decide-before-you-pay page) and `/v1/templates/[type]/demo` (a real report from
 * fixture answers) all render from this one file.
 *
 * The Aspects are typed against the **real** model (`content/assessment.ts::zAspect`, a
 * 1..5 `score` scale with two named ends), so the day a type is wired into the store the
 * shapes already match — the same rule `data/v1/fixtures.ts` follows for its templates.
 *
 * ## The aspect rule — observable, answerable from both sides, never an instrument
 *
 * Every Aspect is a question **both** parties can answer about the relationship as it is
 * today ("How much say do you each have in big decisions?"), with a Left Value (notch 1)
 * and a Right Value (notch 5). None is leading, none diagnoses, none is clinical, and none
 * invents a psychometric: there are no scores from instruments we do not run, no borrowed
 * clinical labels, no invented match score. This is a conversation aid — a way to put two
 * people's answers side by side — not an assessment instrument, and the words here stay on
 * the observable side of that line.
 *
 * Two or three types may share an Aspect (a manager-and-report pair *is* a lead-and-member
 * pair); the six sets are deliberately not six copies of one list.
 *
 * ## Price
 *
 * One relationship costs one price, in integer cents (the tree's money convention — see
 * `data/billing-plans.ts`). The **counterparty pays nothing** — the initiator pays, the other
 * person joins by link. There is no per-type price yet, so the single constant below is the
 * honest answer until pricing is a decision the owner makes.
 *
 * Imported through relative paths on purpose: `tsconfig.datacheck.json` compiles this file
 * under `module: commonjs`, and the `@/` alias is not resolved there. Nothing here is a
 * component and nothing reads a clock at render: no React, no Next, no `lib/db/**`.
 */
import { z } from "zod";
import { zAspect, type Aspect, type Opinions } from "../../content/assessment";

/* ------------------------------------------------------------------ *
 * The shape
 * ------------------------------------------------------------------ */

/** One relationship type — the catalogue card and the template page. */
export interface RelationshipType {
  /** The slug — the `[type]` route segment and the demo-answer key. */
  readonly id: string;
  /** The display name, capitalised: "Partners". */
  readonly name: string;
  /** One line on who this type is for. */
  readonly whoItsFor: string;
  /** One line on who this type is **not** for — read aloud on the template page. */
  readonly whoItsNotFor: string;
  /** The starter Aspects, 5–8 of them, each a real `Aspect`. */
  readonly aspects: readonly Aspect[];
}

export const zRelationshipType = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    whoItsFor: z.string().min(1),
    whoItsNotFor: z.string().min(1),
    aspects: z.array(zAspect).min(5).max(8),
  })
  .strict();

/** One Aspect, authored in the model's shape: a 1..5 score scale with two named ends. */
function aspect(id: string, prompt: string, leftValue: string, rightValue: string): Aspect {
  return { id, prompt, scale: { kind: "score", min: 1, max: 5 }, leftValue, rightValue };
}

/* ------------------------------------------------------------------ *
 * The six types
 * ------------------------------------------------------------------ */

export const relationshipTypes: readonly RelationshipType[] = [
  {
    id: "partners",
    name: "Partners",
    whoItsFor: "A couple who want to see where they stand.",
    whoItsNotFor:
      "A couple in crisis, or anyone looking for a diagnosis rather than a conversation.",
    aspects: [
      aspect(
        "partners-money",
        "How are money and the decisions about it handled?",
        "Kept separate",
        "Fully shared",
      ),
      aspect(
        "partners-decisions",
        "How much say do you each have in big decisions?",
        "One decides",
        "Decided together",
      ),
      aspect(
        "partners-time",
        "How is time together chosen in a normal week?",
        "Fits around everything else",
        "Made a priority",
      ),
      aspect(
        "partners-conflict",
        "When you disagree, how is it raised?",
        "Left unsaid",
        "Said plainly",
      ),
      aspect(
        "partners-plans",
        "How are plans for the future made?",
        "Kept to ourselves",
        "Made together",
      ),
      aspect(
        "partners-hard-days",
        "When one of you is having a hard day, what happens?",
        "Handled alone",
        "Talked through together",
      ),
    ],
  },
  {
    id: "co-founders",
    name: "Co-founders",
    whoItsFor: "Two people building something together.",
    whoItsNotFor: "Solo founders, or a pair who need a legal document rather than a conversation.",
    aspects: [
      aspect(
        "cofounder-ownership",
        "How is ownership of the company divided?",
        "Unspoken",
        "Agreed and written down",
      ),
      aspect(
        "cofounder-direction",
        "How are the big decisions about the product made?",
        "One decides",
        "Made together",
      ),
      aspect(
        "cofounder-workload",
        "How is the work split between the two of you?",
        "All on one",
        "Evenly shared",
      ),
      aspect(
        "cofounder-disagreement",
        "When you disagree about direction, how is it resolved?",
        "Left unspoken",
        "Worked through",
      ),
      aspect(
        "cofounder-money",
        "How are money drawn and reinvested decided?",
        "One calls it",
        "Agreed together",
      ),
      aspect(
        "cofounder-visibility",
        "How much do you each know about the other's work?",
        "Little",
        "Most of it",
      ),
      aspect(
        "cofounder-exit",
        "What happens to the company if one of you leaves?",
        "Never discussed",
        "Planned in advance",
      ),
    ],
  },
  {
    id: "colleagues",
    name: "Colleagues",
    whoItsFor: "A manager and their report, or two peers.",
    whoItsNotFor:
      "Two people with no working relationship, or anyone settling a dispute through an employer.",
    aspects: [
      aspect(
        "colleague-priorities",
        "How is the work prioritized in a normal week?",
        "Set for me",
        "Agreed together",
      ),
      aspect(
        "colleague-feedback",
        "How is feedback on the work given?",
        "Never said",
        "Said directly",
      ),
      aspect(
        "colleague-workload",
        "How is the workload split between the two of you?",
        "All on one",
        "Evenly shared",
      ),
      aspect(
        "colleague-decisions",
        "How are decisions about the work made?",
        "One decides",
        "Decided together",
      ),
      aspect(
        "colleague-setbacks",
        "When something goes wrong, how is it handled?",
        "Blamed",
        "Figured out together",
      ),
      aspect(
        "colleague-goals",
        "How much do you each know about the other's goals?",
        "Little",
        "Most of it",
      ),
    ],
  },
  {
    id: "family",
    name: "Family",
    whoItsFor: "A parent and their adult child, or two siblings.",
    whoItsNotFor: "Parents of minor children, or family in a dispute that needs a counsellor.",
    aspects: [
      aspect(
        "family-rules",
        "How are the rules of the house agreed?",
        "Set for one",
        "Agreed together",
      ),
      aspect(
        "family-trust",
        "How much do you trust each other with the hard things?",
        "Kept hidden",
        "Shared openly",
      ),
      aspect(
        "family-time",
        "How often do you make time for just the two of you?",
        "Rarely",
        "Often",
      ),
      aspect(
        "family-space",
        "How is each of you allowed your own space?",
        "None",
        "Fully respected",
      ),
      aspect(
        "family-conflict",
        "When there's a disagreement, how is it raised?",
        "Left unsaid",
        "Said plainly",
      ),
      aspect(
        "family-support",
        "How are money or support between you handled?",
        "Unspoken",
        "Talked through",
      ),
    ],
  },
  {
    id: "friends",
    name: "Friends",
    whoItsFor: "A long-standing friendship.",
    whoItsNotFor: "New acquaintances, or a friendship one person has already decided to end.",
    aspects: [
      aspect(
        "friend-contact",
        "How often do you actually see or speak to each other?",
        "Rarely",
        "Often",
      ),
      aspect(
        "friend-struggles",
        "When one of you is struggling, what happens?",
        "Handled alone",
        "Shared",
      ),
      aspect(
        "friend-lives",
        "How much do you know about each other's lives right now?",
        "Little",
        "Most of it",
      ),
      aspect(
        "friend-conflict",
        "When you disagree, how is it handled?",
        "Avoided",
        "Talked through",
      ),
      aspect(
        "friend-plans",
        "How are the plans you make together kept?",
        "Dropped",
        "Followed through",
      ),
      aspect(
        "friend-effort",
        "How even is the effort in the friendship?",
        "Mostly one side",
        "Both sides",
      ),
    ],
  },
  {
    id: "team",
    name: "Team",
    whoItsFor: "A lead and a team member.",
    whoItsNotFor:
      "A whole team of more than two — and not yet the coach-and-client case, which rides on this later.",
    aspects: [
      aspect(
        "team-direction",
        "How is the member's work directed in a normal week?",
        "Told what to do",
        "Worked out together",
      ),
      aspect("team-feedback", "How is feedback on the work given?", "Never said", "Said directly"),
      aspect(
        "team-load",
        "How much does the lead know about the member's workload?",
        "Little",
        "Most of it",
      ),
      aspect(
        "team-blocks",
        "When the member hits a block, what happens?",
        "Left to figure it out",
        "Worked through together",
      ),
      aspect(
        "team-decisions",
        "How are decisions that affect the member's work made?",
        "Made without them",
        "Made together",
      ),
      aspect(
        "team-credit",
        "How is recognition or credit for the work shared?",
        "Taken by one",
        "Shared",
      ),
    ],
  },
];

/** The ids, in catalogue order — the `[type]` segments and `generateStaticParams` keys. */
export const RELATIONSHIP_TYPE_IDS = relationshipTypes.map((type) => type.id);

/** The type, or `undefined` when a segment names no type. Never a default. */
export function relationshipType(id: string): RelationshipType | undefined {
  return relationshipTypes.find((type) => type.id === id);
}

/**
 * One relationship costs one price — the initiator pays this, the counterparty pays nothing.
 * Integer cents, the tree's money convention: `999` is `$9.99`, the Basic plan's monthly price.
 * Uniform until per-type pricing is a decision rather than a guess.
 */
export const RELATIONSHIP_PRICE_CENTS = 999;

/* ------------------------------------------------------------------ *
 * Demo answers — one completed sheet per type, rendered by /demo
 * ------------------------------------------------------------------ */

/** The two parties' answers to one type's Aspects, keyed by Aspect id. */
export interface TypeDemoAnswers {
  /** The Initiator's answers — shown as "You" in the demo report. */
  readonly you: Readonly<Record<string, Opinions>>;
  /** The Counterparty's answers — shown as "Them" in the demo report. */
  readonly them: Readonly<Record<string, Opinions>>;
}

/**
 * One completed Advanced-Mode sheet per type. Every Aspect is answered Feel, Wish, Think and
 * Guess by both parties, so the demo renders the full eight-kind report — the same shape a
 * finished live session has. The numbers are authored to read like two people who really
 * answered, not to score anything: some Aspects are In Synch, some show a Small Gap, and at
 * least one per type shows a Gap wide enough to be "not yet aligned".
 */
export const demoAnswersByType: Readonly<Record<string, TypeDemoAnswers>> = {
  partners: {
    you: {
      "partners-money": { feel: 2, wish: 4, think: 3, guess: 4 },
      "partners-decisions": { feel: 3, wish: 5, think: 4, guess: 3 },
      "partners-time": { feel: 2, wish: 4, think: 2, guess: 4 },
      "partners-conflict": { feel: 2, wish: 4, think: 2, guess: 4 },
      "partners-plans": { feel: 4, wish: 4, think: 4, guess: 4 },
      "partners-hard-days": { feel: 4, wish: 5, think: 4, guess: 5 },
    },
    them: {
      "partners-money": { feel: 4, wish: 4, think: 4, guess: 3 },
      "partners-decisions": { feel: 2, wish: 3, think: 2, guess: 4 },
      "partners-time": { feel: 3, wish: 3, think: 2, guess: 3 },
      "partners-conflict": { feel: 1, wish: 3, think: 1, guess: 4 },
      "partners-plans": { feel: 4, wish: 5, think: 3, guess: 5 },
      "partners-hard-days": { feel: 4, wish: 5, think: 4, guess: 5 },
    },
  },
  "co-founders": {
    you: {
      "cofounder-ownership": { feel: 3, wish: 5, think: 3, guess: 4 },
      "cofounder-direction": { feel: 3, wish: 4, think: 4, guess: 3 },
      "cofounder-workload": { feel: 2, wish: 4, think: 3, guess: 4 },
      "cofounder-disagreement": { feel: 3, wish: 5, think: 3, guess: 4 },
      "cofounder-money": { feel: 2, wish: 4, think: 2, guess: 4 },
      "cofounder-visibility": { feel: 4, wish: 4, think: 4, guess: 4 },
      "cofounder-exit": { feel: 1, wish: 4, think: 2, guess: 3 },
    },
    them: {
      "cofounder-ownership": { feel: 4, wish: 4, think: 4, guess: 3 },
      "cofounder-direction": { feel: 2, wish: 4, think: 2, guess: 4 },
      "cofounder-workload": { feel: 4, wish: 4, think: 4, guess: 3 },
      "cofounder-disagreement": { feel: 2, wish: 4, think: 1, guess: 4 },
      "cofounder-money": { feel: 3, wish: 4, think: 3, guess: 4 },
      "cofounder-visibility": { feel: 3, wish: 5, think: 3, guess: 4 },
      "cofounder-exit": { feel: 2, wish: 3, think: 2, guess: 4 },
    },
  },
  colleagues: {
    you: {
      "colleague-priorities": { feel: 2, wish: 4, think: 3, guess: 4 },
      "colleague-feedback": { feel: 3, wish: 4, think: 3, guess: 4 },
      "colleague-workload": { feel: 4, wish: 4, think: 4, guess: 4 },
      "colleague-decisions": { feel: 2, wish: 4, think: 3, guess: 4 },
      "colleague-setbacks": { feel: 3, wish: 5, think: 3, guess: 4 },
      "colleague-goals": { feel: 2, wish: 4, think: 3, guess: 3 },
    },
    them: {
      "colleague-priorities": { feel: 4, wish: 4, think: 3, guess: 4 },
      "colleague-feedback": { feel: 4, wish: 4, think: 4, guess: 4 },
      "colleague-workload": { feel: 3, wish: 4, think: 3, guess: 4 },
      "colleague-decisions": { feel: 4, wish: 4, think: 4, guess: 3 },
      "colleague-setbacks": { feel: 4, wish: 5, think: 4, guess: 4 },
      "colleague-goals": { feel: 3, wish: 4, think: 3, guess: 4 },
    },
  },
  family: {
    you: {
      "family-rules": { feel: 2, wish: 3, think: 3, guess: 2 },
      "family-trust": { feel: 4, wish: 5, think: 4, guess: 5 },
      "family-time": { feel: 2, wish: 3, think: 2, guess: 3 },
      "family-space": { feel: 3, wish: 4, think: 3, guess: 4 },
      "family-conflict": { feel: 3, wish: 4, think: 3, guess: 4 },
      "family-support": { feel: 3, wish: 4, think: 3, guess: 4 },
    },
    them: {
      "family-rules": { feel: 3, wish: 4, think: 3, guess: 4 },
      "family-trust": { feel: 4, wish: 5, think: 4, guess: 5 },
      "family-time": { feel: 2, wish: 3, think: 2, guess: 3 },
      "family-space": { feel: 3, wish: 4, think: 3, guess: 4 },
      "family-conflict": { feel: 2, wish: 4, think: 2, guess: 4 },
      "family-support": { feel: 4, wish: 4, think: 3, guess: 4 },
    },
  },
  friends: {
    you: {
      "friend-contact": { feel: 2, wish: 4, think: 3, guess: 4 },
      "friend-struggles": { feel: 3, wish: 5, think: 3, guess: 4 },
      "friend-lives": { feel: 3, wish: 4, think: 3, guess: 4 },
      "friend-conflict": { feel: 2, wish: 4, think: 2, guess: 4 },
      "friend-plans": { feel: 3, wish: 4, think: 3, guess: 4 },
      "friend-effort": { feel: 2, wish: 4, think: 3, guess: 4 },
    },
    them: {
      "friend-contact": { feel: 3, wish: 3, think: 3, guess: 3 },
      "friend-struggles": { feel: 4, wish: 4, think: 4, guess: 4 },
      "friend-lives": { feel: 4, wish: 4, think: 4, guess: 3 },
      "friend-conflict": { feel: 1, wish: 3, think: 1, guess: 4 },
      "friend-plans": { feel: 4, wish: 4, think: 4, guess: 4 },
      "friend-effort": { feel: 4, wish: 4, think: 3, guess: 4 },
    },
  },
  team: {
    you: {
      "team-direction": { feel: 2, wish: 4, think: 3, guess: 4 },
      "team-feedback": { feel: 3, wish: 4, think: 3, guess: 4 },
      "team-load": { feel: 2, wish: 4, think: 2, guess: 4 },
      "team-blocks": { feel: 3, wish: 5, think: 3, guess: 4 },
      "team-decisions": { feel: 2, wish: 4, think: 2, guess: 4 },
      "team-credit": { feel: 3, wish: 4, think: 3, guess: 4 },
    },
    them: {
      "team-direction": { feel: 3, wish: 4, think: 3, guess: 4 },
      "team-feedback": { feel: 4, wish: 4, think: 4, guess: 4 },
      "team-load": { feel: 3, wish: 4, think: 3, guess: 4 },
      "team-blocks": { feel: 4, wish: 5, think: 4, guess: 4 },
      "team-decisions": { feel: 4, wish: 4, think: 3, guess: 4 },
      "team-credit": { feel: 4, wish: 4, think: 4, guess: 4 },
    },
  },
};

/** The demo answers for one type, or `undefined` when the type has no demo yet. */
export function demoAnswersFor(typeId: string): TypeDemoAnswers | undefined {
  return demoAnswersByType[typeId];
}

/* ------------------------------------------------------------------ *
 * Validate at import — a typo in the taxonomy or the demo is a red build
 * ------------------------------------------------------------------ */

/** The taxonomy itself: six types, each a strict `RelationshipType`. */
export const validRelationshipTypes: readonly RelationshipType[] = z
  .array(zRelationshipType)
  .parse(relationshipTypes);

/** Every type has a demo, and both parties answer exactly the Aspects the type names. */
for (const type of validRelationshipTypes) {
  const demo = demoAnswersByType[type.id];
  if (demo === undefined) {
    throw new Error(`relationship-types: no demo answers authored for "${type.id}"`);
  }
  const expected = type.aspects.map((item) => item.id).sort();
  for (const party of ["you", "them"] as const) {
    const keys = Object.keys(demo[party]).sort();
    if (JSON.stringify(keys) !== JSON.stringify(expected)) {
      throw new Error(
        `relationship-types: "${type.id}" "${party}" demo answers ${keys.join(
          ", ",
        )} do not match its Aspects ${expected.join(", ")}`,
      );
    }
  }
}
