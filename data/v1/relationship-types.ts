/**
 * data/v1/relationship-types.ts — the /v1 prototype's relationship taxonomy.
 *
 * The owner supplied a 29-row catalogue (issue #385, preserved verbatim at
 * `docs/RELATIONSHIP-TYPES-SOURCE.md`). This file is the **normalised** form of it: every row
 * is a typed record, the three source typos are corrected, the `purchasable` field is real,
 * and each of the 26 purchasable types carries its Aspects exactly as the issue wrote them.
 * Three rows — the dating set — are kept with `purchasable: false` and no Aspects, because
 * "no dating" is a product decision the owner made explicitly; a type is excluded by a field,
 * not by deletion, so flipping `purchasable` is the whole change if the owner ever wants them.
 *
 * A seventh type, `co-founders`, is **kept** even though it has no source row: it ships today,
 * the owner added it separately, and the reconciliation in §4 of the issue says to keep it.
 *
 * The record shape is `id` (the stable slug/key), `name`, `shortName`, `realm`, `roles`
 * (initiator + counterparty), `descriptor` (the "who it is for / who it is **not** for" pair),
 * `aspects`, `price` and `purchasable`.
 *
 * ## The aspect rule — observable, answerable from both sides, never an instrument
 *
 * Every Aspect is a question **both** parties can answer about the relationship as it is
 * today, on a 1–5 scale with two named ends (Left Value = notch 1, Right Value = notch 5).
 * None is leading, none diagnoses, none is clinical, and none invents a psychometric: there
 * are no scores from instruments we do not run, no borrowed clinical labels, no invented
 * match score. This is a conversation aid — a way to put two people's answers side by side —
 * not an assessment instrument. The words here stay on the observable side of that line.
 *
 * Types may share an Aspect (every parent–child variant asks `time`, every friendship asks
 * `support`); the sets are deliberately not copies of one list.
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

/** The seven realms, in the order the catalogue groups them. */
export const REALMS = [
  "Office",
  "Business",
  "Property",
  "School",
  "Medical",
  "Home",
  "Social",
] as const;

export type Realm = (typeof REALMS)[number];

/** The two roles a relationship is between — two named ends, never one judge of the other. */
export interface RelationshipRoles {
  readonly initiator: string;
  readonly counterparty: string;
}

/** The "who it is for / who it is **not** for" pair, written with the type. */
export interface RelationshipDescriptor {
  readonly whoItsFor: string;
  readonly whoItsNotFor: string;
}

/** One relationship type — the catalogue card, the template page and the shop picker. */
export interface RelationshipType {
  /** The slug — the `[type]` route segment and the demo-answer key. */
  readonly id: string;
  /** The full name, as §1 of #385 writes it: "Staff–Manager". */
  readonly name: string;
  /** The short name, as §1 writes it: "Coworkers". */
  readonly shortName: string;
  /** The realm the catalogue groups by — a real field, never inferred from prose. */
  readonly realm: Realm;
  /** The two roles, initiator first. */
  readonly roles: RelationshipRoles;
  /** Who it is for and who it is not for, written with the type. */
  readonly descriptor: RelationshipDescriptor;
  /** The Aspects — 5–10 for a purchasable type, none for the excluded dating rows. */
  readonly aspects: readonly Aspect[];
  /** One relationship's price, integer cents. */
  readonly price: number;
  /** Whether this type is for sale. `false` for the dating set, a field not a deletion. */
  readonly purchasable: boolean;
}

export const zRelationshipType = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    shortName: z.string().min(1),
    realm: z.enum(REALMS),
    roles: z.object({ initiator: z.string().min(1), counterparty: z.string().min(1) }).strict(),
    descriptor: z
      .object({ whoItsFor: z.string().min(1), whoItsNotFor: z.string().min(1) })
      .strict(),
    aspects: z.array(zAspect).max(10),
    price: z.number().int().positive(),
    purchasable: z.boolean(),
  })
  .strict();

/** One Aspect, authored in the model's shape: a 1..5 score scale with two named ends. */
function aspect(id: string, prompt: string, leftValue: string, rightValue: string): Aspect {
  return { id, prompt, scale: { kind: "score", min: 1, max: 5 }, leftValue, rightValue };
}

/**
 * One relationship costs one price — the initiator pays this, the counterparty pays nothing.
 * Integer cents, the tree's money convention: `999` is `$9.99`, the Basic plan's monthly price.
 * Uniform until per-type pricing is a decision rather than a guess.
 */
export const RELATIONSHIP_PRICE_CENTS = 999;

/* ------------------------------------------------------------------ *
 * The taxonomy — 29 source rows plus the kept co-founders
 * ------------------------------------------------------------------ */

export const relationshipTypes: readonly RelationshipType[] = [
  /* ------------------------------------------------ Office */
  {
    id: "staff-manager",
    name: "Staff–Manager",
    shortName: "Staff–Manager",
    realm: "Office",
    roles: { initiator: "Staff", counterparty: "Manager" },
    descriptor: {
      whoItsFor:
        "A staff member and their manager, checking how the working relationship actually works.",
      whoItsNotFor:
        "Anyone in a dispute that should go through HR, or looking for a performance review rather than a conversation.",
    },
    price: RELATIONSHIP_PRICE_CENTS,
    purchasable: true,
    aspects: [
      aspect(
        "say-in-decisions",
        "How much say does each of you have in decisions that affect the work?",
        "Manager decides alone",
        "Staff decides alone",
      ),
      aspect(
        "feedback-flow",
        "When feedback happens, how freely does it move both ways?",
        "Only manager to staff",
        "Both give and take it",
      ),
      aspect(
        "clarity-of-expectations",
        "How clearly are expectations about the job spelled out right now?",
        "Nothing written or agreed",
        "Explicit and current",
      ),
      aspect(
        "workload-reality",
        "How close is the stated workload to what is actually being carried?",
        "Very far apart",
        "Matches",
      ),
      aspect(
        "credit",
        "When work goes well, how is credit shared?",
        "All with the manager",
        "Shared as each contributed",
      ),
      aspect(
        "escalation",
        "If something goes wrong, how safe is it to raise it early?",
        "Unsafe — better to hide it",
        "Safe and routine",
      ),
    ],
  },
  {
    id: "colleagues",
    name: "Coworker–Colleague",
    shortName: "Coworkers",
    realm: "Office",
    roles: { initiator: "Coworker", counterparty: "Colleague" },
    descriptor: {
      whoItsFor: "Two coworkers who share work and want the handovers and the credit to feel fair.",
      whoItsNotFor:
        "Two people with no shared work, or anyone settling a dispute through an employer.",
    },
    price: RELATIONSHIP_PRICE_CENTS,
    purchasable: true,
    aspects: [
      aspect(
        "handoffs",
        "How well do work handovers between you actually work?",
        "Things get dropped",
        "Nothing dropped",
      ),
      aspect(
        "shared-context",
        "How much do you each know about what the other is working on?",
        "Nothing",
        "Current picture on both sides",
      ),
      aspect(
        "credit",
        "When a shared result lands, how is credit handled?",
        "One name on it",
        "Both named",
      ),
      aspect(
        "conflict",
        "When you disagree about how to do something, how does it get resolved?",
        "Avoided or escalated",
        "Talked through directly",
      ),
      aspect(
        "reliability",
        "How reliably do the commitments you make to each other hold?",
        "Frequently slip",
        "Held as agreed",
      ),
    ],
  },
  {
    id: "business-partners",
    name: "Business Partner A–Business Partner B",
    shortName: "Business Partners",
    realm: "Office",
    roles: { initiator: "Business Partner A", counterparty: "Business Partner B" },
    descriptor: {
      whoItsFor: "Two business partners who want the split of decisions and money out in the open.",
      whoItsNotFor:
        "A pair who need a legal agreement rather than a conversation, or a partnership already dissolving.",
    },
    price: RELATIONSHIP_PRICE_CENTS,
    purchasable: true,
    aspects: [
      aspect(
        "decision-rights",
        "How clearly are decision rights split between you?",
        "Unclear, re-litigated",
        "Written and respected",
      ),
      aspect(
        "money-picture",
        "How much does each of you know about the business's actual money position?",
        "One holds it all",
        "Both see the same numbers",
      ),
      aspect(
        "contribution",
        "How fairly does the effort each of you puts in compare to what each expected?",
        "Very uneven",
        "As expected on both sides",
      ),
      aspect(
        "disagreement",
        "When you disagree about the business, what happens?",
        "Stalls or simmers",
        "Resolved with a rule",
      ),
      aspect(
        "exit",
        "How clear is what happens if one of you wants out?",
        "Never discussed",
        "Documented and understood",
      ),
      aspect(
        "risk-appetite",
        "How aligned are your appetites for risk right now?",
        "Opposite",
        "Aligned",
      ),
    ],
  },
  {
    id: "project-manager-member",
    name: "Project Manager–Team Member",
    shortName: "Project Manager–Team Member",
    realm: "Office",
    roles: { initiator: "Project Manager", counterparty: "Team Member" },
    descriptor: {
      whoItsFor: "A project manager and a team member on the same project.",
      whoItsNotFor:
        "A whole team of more than two, or anyone looking to document performance rather than talk.",
    },
    price: RELATIONSHIP_PRICE_CENTS,
    purchasable: true,
    aspects: [
      aspect(
        "plan-vs-reality",
        "How close is the plan to what can actually be delivered?",
        "Fantasy",
        "Realistic",
      ),
      aspect(
        "priorities",
        "How clear is which work comes first?",
        "Everything is urgent",
        "Ordered and agreed",
      ),
      aspect(
        "blockers",
        "When something blocks the work, how fast does it get raised and cleared?",
        "Weeks, or never",
        "Same day",
      ),
      aspect(
        "autonomy",
        "How much latitude does each of you have over how the work is done?",
        "None",
        "Full, within the goal",
      ),
      aspect(
        "status-honesty",
        "How honest is the status each of you reports?",
        "Green until it fails",
        "Accurate even when bad",
      ),
    ],
  },
  {
    id: "team",
    name: "Project Teammate A–Project Teammate B",
    shortName: "Project Teammates",
    realm: "Office",
    roles: { initiator: "Project Teammate A", counterparty: "Project Teammate B" },
    descriptor: {
      whoItsFor: "Two teammates on the same project whose work meets in the middle.",
      whoItsNotFor:
        "A lead and a report — that is project-manager-member — or a whole team of more than two.",
    },
    price: RELATIONSHIP_PRICE_CENTS,
    purchasable: true,
    aspects: [
      aspect(
        "interfaces",
        "How well-defined is the boundary where your work meets?",
        "Vague",
        "Explicit",
      ),
      aspect(
        "interruptions",
        "How much are your own priorities disrupted by each other?",
        "Constantly",
        "Rarely",
      ),
      aspect(
        "quality-bar",
        "How close is the standard each of you holds to the other's?",
        "Far apart",
        "Same bar",
      ),
      aspect(
        "credit",
        "When the project lands, how is credit shared?",
        "Unequal",
        "As contributed",
      ),
      aspect(
        "repair",
        "When one of you drops something, how is it handled?",
        "Blamed",
        "Fixed and learned from",
      ),
    ],
  },

  /* ------------------------------------------------ Business */
  {
    id: "customer-vendor-product",
    name: "Customer–Vendor Product",
    shortName: "Customer–Vendor Product",
    realm: "Business",
    roles: { initiator: "Customer", counterparty: "Vendor Product" },
    descriptor: {
      whoItsFor:
        "A customer and a product vendor checking whether the product delivers what was bought.",
      whoItsNotFor:
        "A one-off purchase with no ongoing relationship, or a legal dispute over a contract.",
    },
    price: RELATIONSHIP_PRICE_CENTS,
    purchasable: true,
    aspects: [
      aspect(
        "expectation-fit",
        "How close is what the product does to what the customer expected?",
        "Far off",
        "As expected",
      ),
      aspect(
        "support-access",
        "When something goes wrong, how reachable is real help?",
        "No path",
        "Direct and answered",
      ),
      aspect(
        "price-value",
        "How does the price compare to the value each side thinks it delivers?",
        "Mismatched",
        "Fair on both sides",
      ),
      aspect(
        "roadmap-influence",
        "How much can the customer influence what gets built next?",
        "No channel",
        "Directly and visibly",
      ),
      aspect(
        "renewal-intent",
        "How likely is each of you to continue the arrangement?",
        "Looking for an exit",
        "Renewing without debate",
      ),
    ],
  },
  {
    id: "customer-vendor-services",
    name: "Customer–Vendor Services",
    shortName: "Customer–Vendor Service",
    realm: "Business",
    roles: { initiator: "Customer", counterparty: "Vendor Services" },
    descriptor: {
      whoItsFor:
        "A customer and a services vendor checking whether the engagement is working on both sides.",
      whoItsNotFor:
        "A finished engagement with nothing ongoing, or a disagreement headed for a lawyer.",
    },
    price: RELATIONSHIP_PRICE_CENTS,
    purchasable: true,
    aspects: [
      aspect(
        "scope-clarity",
        "How clearly is the scope of the work written down?",
        "Nothing in writing",
        "Explicit and current",
      ),
      aspect(
        "delivery-reliability",
        "How reliably are the committed dates met?",
        "Routinely missed",
        "Met",
      ),
      aspect(
        "change-handling",
        "When the customer wants something added, how does that get handled?",
        "Ad hoc, resentfully",
        "A stated process",
      ),
      aspect(
        "communication-cadence",
        "How predictable are the updates each side gets?",
        "Silence until asked",
        "Regular and expected",
      ),
      aspect(
        "payment-terms",
        "How well do the payment terms match what each side expected?",
        "Contested",
        "Clear and met",
      ),
    ],
  },
  {
    id: "investor-entrepreneur",
    name: "Investor–SponsorEntrepreneur",
    shortName: "Investor–SponsorEntrepreneur",
    realm: "Business",
    roles: { initiator: "Investor", counterparty: "SponsorEntrepreneur" },
    descriptor: {
      whoItsFor:
        "An investor and a founder who want the reporting and the decision rights to feel honest.",
      whoItsNotFor:
        "A purely transactional funding round, or anyone looking for an audit rather than a conversation.",
    },
    price: RELATIONSHIP_PRICE_CENTS,
    purchasable: true,
    aspects: [
      aspect(
        "reporting",
        "How predictable and honest is the reporting the investor gets?",
        "Rare or polished",
        "Regular and candid",
      ),
      aspect(
        "involvement",
        "How well does the investor's involvement match what the founder wants?",
        "Too much or none",
        "As wanted",
      ),
      aspect(
        "bad-news",
        "How quickly does bad news travel between you?",
        "Late or hidden",
        "Immediately",
      ),
      aspect("horizon", "How aligned are your time horizons?", "Opposite", "Same"),
      aspect(
        "decision-authority",
        "How clear is who decides what?",
        "Overlapping",
        "Split and respected",
      ),
      aspect(
        "terms-fit",
        "How well do the agreed terms match what both understood at the time?",
        "Contested",
        "Understood the same",
      ),
    ],
  },
  {
    id: "co-founders",
    name: "Co-founders",
    shortName: "Co-founders",
    realm: "Business",
    roles: { initiator: "Co-founder A", counterparty: "Co-founder B" },
    descriptor: {
      whoItsFor: "Two people building something together.",
      whoItsNotFor:
        "Solo founders, or a pair who need a legal document rather than a conversation.",
    },
    price: RELATIONSHIP_PRICE_CENTS,
    purchasable: true,
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

  /* ------------------------------------------------ Property */
  {
    id: "hoa-board-owner",
    name: "HOA Board Member–Owner",
    shortName: "HOA Board Member–Owner",
    realm: "Property",
    roles: { initiator: "HOA Board Member", counterparty: "Owner" },
    descriptor: {
      whoItsFor:
        "An HOA board member and an owner checking whether the property is being run fairly.",
      whoItsNotFor: "A formal dispute that belongs with the association's own process or a lawyer.",
    },
    price: RELATIONSHIP_PRICE_CENTS,
    purchasable: true,
    aspects: [
      aspect(
        "fee-transparency",
        "How clear is what the fees are spent on?",
        "Opaque",
        "Itemised and explained",
      ),
      aspect(
        "rule-clarity",
        "How clear are the rules that apply to owners?",
        "Word of mouth",
        "Written and accessible",
      ),
      aspect(
        "voice",
        "How much can an owner influence a board decision?",
        "None",
        "A real channel",
      ),
      aspect(
        "responsiveness",
        "How quickly does the board respond to an owner's issue?",
        "Never",
        "Promptly",
      ),
      aspect(
        "enforcement-fairness",
        "How consistently are rules applied across owners?",
        "Selectively",
        "The same for all",
      ),
      aspect(
        "maintenance-reality",
        "How does the state of shared property compare to what owners were told?",
        "Much worse",
        "As described",
      ),
    ],
  },

  /* ------------------------------------------------ School */
  {
    id: "parent-teacher",
    name: "Parent–Teacher",
    shortName: "Parent–Teacher",
    realm: "School",
    roles: { initiator: "Parent", counterparty: "Teacher" },
    descriptor: {
      whoItsFor: "A parent and a teacher who want the picture of the child to match on both sides.",
      whoItsNotFor:
        "A formal complaint, or anyone expecting the school to make a decision through this conversation.",
    },
    price: RELATIONSHIP_PRICE_CENTS,
    purchasable: true,
    aspects: [
      aspect(
        "progress-visibility",
        "How clear a picture does the parent have of how the child is doing?",
        "Nothing until reports",
        "Current and specific",
      ),
      aspect(
        "contact",
        "How easy is it for either of you to raise something?",
        "Only at set events",
        "When it matters",
      ),
      aspect(
        "support-at-home",
        "How well does what happens at home match what the classroom needs?",
        "Unconnected",
        "Consistent",
      ),
      aspect(
        "expectations",
        "How aligned are your expectations of the child?",
        "Far apart",
        "Shared",
      ),
      aspect(
        "concern-handling",
        "When there is a concern, how is it raised?",
        "Late or through others",
        "Early and direct",
      ),
    ],
  },
  {
    id: "teacher-student",
    name: "Teacher–Student",
    shortName: "Teacher–Student",
    realm: "School",
    roles: { initiator: "Teacher", counterparty: "Student" },
    descriptor: {
      whoItsFor: "A teacher and a student checking whether the teaching is landing.",
      whoItsNotFor: "A grade appeal or a disciplinary matter — those go through the school.",
    },
    price: RELATIONSHIP_PRICE_CENTS,
    purchasable: true,
    aspects: [
      aspect(
        "expectation-clarity",
        "How clear is what is expected of the student, week to week?",
        "Guessed",
        "Explicit",
      ),
      aspect(
        "feedback-usefulness",
        "How useful is the feedback each of you gets?",
        "Generic",
        "Specific and actionable",
      ),
      aspect(
        "ask-safety",
        "How safe is it for the student to say they do not understand?",
        "Risky",
        "Normal",
      ),
      aspect(
        "pace-fit",
        "How well does the pace match what the student can actually absorb?",
        "Far off",
        "Matches",
      ),
      aspect(
        "effort-recognition",
        "How much is genuine effort noticed?",
        "Invisible",
        "Recognised",
      ),
    ],
  },

  /* ------------------------------------------------ Medical */
  {
    id: "patient-caregiver",
    name: "Patient–Caregiver",
    shortName: "Patient–Caregiver",
    realm: "Medical",
    roles: { initiator: "Patient", counterparty: "Caregiver" },
    descriptor: {
      whoItsFor:
        "A patient and a caregiver who want the care and the load to feel shared and respected.",
      whoItsNotFor:
        "Medical advice, a diagnosis, or anything a clinician should decide — this is about the relationship, not the treatment.",
    },
    price: RELATIONSHIP_PRICE_CENTS,
    purchasable: true,
    aspects: [
      aspect(
        "say-in-care",
        "How much say does the patient have in decisions about their own care?",
        "None",
        "Fully",
      ),
      aspect(
        "information",
        "How well informed does each of you feel about what is happening?",
        "In the dark",
        "Told and explained",
      ),
      aspect("load", "How fairly is the day-to-day load distributed?", "All on one", "Balanced"),
      aspect(
        "privacy",
        "How well does the current arrangement respect what the patient wants kept private?",
        "Overstepped",
        "Respected",
      ),
      aspect("rest", "How much real relief does each of you get?", "None", "Enough"),
      aspect(
        "outside-help",
        "How able are you to bring in help when it is needed?",
        "Not at all",
        "Easily",
      ),
    ],
  },

  /* ------------------------------------------------ Home */
  {
    id: "spouses",
    name: "Spouse A–Spouse B",
    shortName: "Spouses",
    realm: "Home",
    roles: { initiator: "Spouse A", counterparty: "Spouse B" },
    descriptor: {
      whoItsFor: "Two spouses who want to see where they stand on the everyday stuff.",
      whoItsNotFor:
        "A couple in crisis, or anyone looking for a diagnosis rather than a conversation.",
    },
    price: RELATIONSHIP_PRICE_CENTS,
    purchasable: true,
    aspects: [
      aspect(
        "household-load",
        "How fairly is the everyday work of the household split?",
        "All on one",
        "Balanced",
      ),
      aspect(
        "money-decisions",
        "How much say does each of you have over money decisions?",
        "One holds it",
        "Shared",
      ),
      aspect(
        "time-together",
        "How does the time you actually spend together compare to what each wants?",
        "Far short",
        "As wanted",
      ),
      aspect(
        "conflict-repair",
        "When you argue, how well do you get back to normal?",
        "Simmers for days",
        "Repaired quickly",
      ),
      aspect(
        "outside-relationships",
        "How comfortable is each of you with the other's friendships and family time?",
        "Resented",
        "Supported",
      ),
      aspect(
        "future-picture",
        "How aligned are your pictures of the next few years?",
        "Opposite",
        "Same",
      ),
    ],
  },
  {
    id: "parent-child",
    name: "Parent–Child",
    shortName: "Parent–Child",
    realm: "Home",
    roles: { initiator: "Parent", counterparty: "Child" },
    descriptor: {
      whoItsFor: "A parent and their adult child, checking how the relationship is working now.",
      whoItsNotFor: "Parents of minor children, or a family in a dispute that needs a counsellor.",
    },
    price: RELATIONSHIP_PRICE_CENTS,
    purchasable: true,
    aspects: [
      aspect(
        "voice",
        "How much does the child's view change what happens?",
        "Never asked",
        "Genuinely weighed",
      ),
      aspect(
        "rules-consistency",
        "How consistent are the rules from day to day?",
        "Change by mood",
        "Steady",
      ),
      aspect("trust", "How much does each of you trust the other's word?", "Not much", "Fully"),
      aspect(
        "time",
        "How does the time you spend compare to what each wants?",
        "Far short",
        "Enough",
      ),
      aspect(
        "independence",
        "How well does the amount of independence given match what is needed now?",
        "Too much or too little",
        "About right",
      ),
      aspect(
        "repair",
        "After a blow-up, how does it get back to normal?",
        "Left to cool",
        "Talked through",
      ),
    ],
  },
  {
    id: "father-son",
    name: "Father–Son",
    shortName: "Father–Son",
    realm: "Home",
    roles: { initiator: "Father", counterparty: "Son" },
    descriptor: {
      whoItsFor: "A father and his son, at an age where both are adults.",
      whoItsNotFor:
        "A father and a minor son, or a relationship in crisis that needs a counsellor.",
    },
    price: RELATIONSHIP_PRICE_CENTS,
    purchasable: true,
    aspects: [
      aspect(
        "being-heard",
        "How much does the son's view change what the father does?",
        "Not at all",
        "Genuinely",
      ),
      aspect(
        "expectations",
        "How well do the father's expectations match what the son wants for himself?",
        "Imposed",
        "Shared",
      ),
      aspect(
        "time",
        "How does the time you spend compare to what each wants?",
        "Far short",
        "Enough",
      ),
      aspect("advice", "How is advice received when it is offered?", "As criticism", "As help"),
      aspect(
        "pride",
        "How clearly does each of you know the other is proud of them?",
        "Assumed",
        "Said",
      ),
    ],
  },
  {
    id: "father-daughter",
    name: "Father–Daughter",
    shortName: "Father–Daughter",
    realm: "Home",
    roles: { initiator: "Father", counterparty: "Daughter" },
    descriptor: {
      whoItsFor: "A father and his daughter, at an age where both are adults.",
      whoItsNotFor:
        "A father and a minor daughter, or a relationship in crisis that needs a counsellor.",
    },
    price: RELATIONSHIP_PRICE_CENTS,
    purchasable: true,
    aspects: [
      aspect(
        "being-heard",
        "How much does the daughter's view change what the father does?",
        "Not at all",
        "Genuinely",
      ),
      aspect(
        "protection-space",
        "How well does the care taken match the independence wanted?",
        "Over-protective",
        "About right",
      ),
      aspect(
        "time",
        "How does the time you spend compare to what each wants?",
        "Far short",
        "Enough",
      ),
      aspect("trust", "How much does each trust the other's judgement?", "Not much", "Fully"),
      aspect(
        "pride",
        "How clearly does each of you know the other is proud of them?",
        "Assumed",
        "Said",
      ),
    ],
  },
  {
    id: "mother-son",
    name: "Mother–Son",
    shortName: "Mother–Son",
    realm: "Home",
    roles: { initiator: "Mother", counterparty: "Son" },
    descriptor: {
      whoItsFor: "A mother and her son, at an age where both are adults.",
      whoItsNotFor:
        "A mother and a minor son, or a relationship in crisis that needs a counsellor.",
    },
    price: RELATIONSHIP_PRICE_CENTS,
    purchasable: true,
    aspects: [
      aspect(
        "being-heard",
        "How much does the son's view change what the mother does?",
        "Not at all",
        "Genuinely",
      ),
      aspect(
        "independence",
        "How well does the room given match what is needed now?",
        "Too much or too little",
        "About right",
      ),
      aspect(
        "time",
        "How does the time you spend compare to what each wants?",
        "Far short",
        "Enough",
      ),
      aspect("worry", "How does the mother's worry land with the son?", "As control", "As care"),
      aspect(
        "pride",
        "How clearly does each of you know the other is proud of them?",
        "Assumed",
        "Said",
      ),
    ],
  },
  {
    id: "mother-daughter",
    name: "Mother–Daughter",
    shortName: "Mother–Daughter",
    realm: "Home",
    roles: { initiator: "Mother", counterparty: "Daughter" },
    descriptor: {
      whoItsFor: "A mother and her daughter, at an age where both are adults.",
      whoItsNotFor:
        "A mother and a minor daughter, or a relationship in crisis that needs a counsellor.",
    },
    price: RELATIONSHIP_PRICE_CENTS,
    purchasable: true,
    aspects: [
      aspect(
        "being-heard",
        "How much does the daughter's view change what the mother does?",
        "Not at all",
        "Genuinely",
      ),
      aspect("advice", "How is advice received when it is offered?", "As criticism", "As help"),
      aspect(
        "time",
        "How does the time you spend compare to what each wants?",
        "Far short",
        "Enough",
      ),
      aspect(
        "boundaries",
        "How well are the boundaries between your lives respected?",
        "Overstepped",
        "Respected",
      ),
      aspect(
        "pride",
        "How clearly does each of you know the other is proud of them?",
        "Assumed",
        "Said",
      ),
    ],
  },
  {
    id: "siblings",
    name: "Sibling A–Sibling B",
    shortName: "Siblings",
    realm: "Home",
    roles: { initiator: "Sibling A", counterparty: "Sibling B" },
    descriptor: {
      whoItsFor: "Two adult siblings who want the old questions to feel settled.",
      whoItsNotFor: "Siblings in a dispute over an estate or a guardianship — that needs a lawyer.",
    },
    price: RELATIONSHIP_PRICE_CENTS,
    purchasable: true,
    aspects: [
      aspect(
        "contact",
        "How does how often you are in touch compare to what each wants?",
        "Far short",
        "As wanted",
      ),
      aspect(
        "fairness-history",
        "How settled do old questions of fairness feel now?",
        "Still raw",
        "Settled",
      ),
      aspect(
        "support",
        "When one of you needs something, how reliably does the other show up?",
        "Rarely",
        "Always",
      ),
      aspect(
        "parents",
        "How well do you handle decisions about your parents together?",
        "Avoided or fought",
        "Shared and agreed",
      ),
      aspect(
        "comparison",
        "How much does comparison between you affect how you treat each other?",
        "Constantly",
        "Not at all",
      ),
    ],
  },
  {
    id: "brother-sister",
    name: "Brother–Sister",
    shortName: "Brother–Sister",
    realm: "Home",
    roles: { initiator: "Brother", counterparty: "Sister" },
    descriptor: {
      whoItsFor:
        "A brother and a sister who want to treat each other as adults, not as their old roles.",
      whoItsNotFor: "A brother and sister in a dispute that needs a lawyer or a counsellor.",
    },
    price: RELATIONSHIP_PRICE_CENTS,
    purchasable: true,
    aspects: [
      aspect(
        "contact",
        "How does how often you are in touch compare to what each wants?",
        "Far short",
        "As wanted",
      ),
      aspect(
        "assumptions",
        "How much do old roles still decide how you treat each other?",
        "Entirely",
        "Not at all",
      ),
      aspect(
        "support",
        "When one of you needs something, how reliably does the other show up?",
        "Rarely",
        "Always",
      ),
      aspect(
        "parents",
        "How well do you handle decisions about your parents together?",
        "Avoided or fought",
        "Shared and agreed",
      ),
      aspect(
        "respect",
        "How much does each of you feel respected by the other?",
        "Not much",
        "Fully",
      ),
    ],
  },
  {
    id: "sisters",
    name: "Sister A–Sister B",
    shortName: "Sisters",
    realm: "Home",
    roles: { initiator: "Sister A", counterparty: "Sister B" },
    descriptor: {
      whoItsFor: "Two sisters who want the closeness without the comparison.",
      whoItsNotFor: "Sisters in a dispute that needs a lawyer or a counsellor.",
    },
    price: RELATIONSHIP_PRICE_CENTS,
    purchasable: true,
    aspects: [
      aspect(
        "contact",
        "How does how often you are in touch compare to what each wants?",
        "Far short",
        "As wanted",
      ),
      aspect(
        "comparison",
        "How much does comparison between you affect how you treat each other?",
        "Constantly",
        "Not at all",
      ),
      aspect(
        "support",
        "When one of you needs something, how reliably does the other show up?",
        "Rarely",
        "Always",
      ),
      aspect(
        "secrets",
        "How much does each of you keep to yourselves that the other would want to know?",
        "A lot",
        "Openly shared",
      ),
      aspect(
        "parents",
        "How well do you handle decisions about your parents together?",
        "Avoided or fought",
        "Shared and agreed",
      ),
    ],
  },
  {
    id: "brothers",
    name: "Brother A–Brother B",
    shortName: "Brothers",
    realm: "Home",
    roles: { initiator: "Brother A", counterparty: "Brother B" },
    descriptor: {
      whoItsFor: "Two brothers who want to talk plainly without the competition.",
      whoItsNotFor: "Brothers in a dispute that needs a lawyer or a counsellor.",
    },
    price: RELATIONSHIP_PRICE_CENTS,
    purchasable: true,
    aspects: [
      aspect(
        "contact",
        "How does how often you are in touch compare to what each wants?",
        "Far short",
        "As wanted",
      ),
      aspect(
        "competition",
        "How much does competition between you colour how you treat each other?",
        "Constantly",
        "Not at all",
      ),
      aspect(
        "support",
        "When one of you needs something, how reliably does the other show up?",
        "Rarely",
        "Always",
      ),
      aspect(
        "straight-talk",
        "How directly can you say a hard thing to each other?",
        "Never",
        "Plainly",
      ),
      aspect(
        "parents",
        "How well do you handle decisions about your parents together?",
        "Avoided or fought",
        "Shared and agreed",
      ),
    ],
  },

  /* ------------------------------------------------ Social (non-dating) */
  {
    id: "friends",
    name: "Friend A–Friend B",
    shortName: "Friends",
    realm: "Social",
    roles: { initiator: "Friend A", counterparty: "Friend B" },
    descriptor: {
      whoItsFor: "A long-standing friendship, checking whether the effort still flows both ways.",
      whoItsNotFor: "New acquaintances, or a friendship one person has already decided to end.",
    },
    price: RELATIONSHIP_PRICE_CENTS,
    purchasable: true,
    aspects: [
      aspect(
        "contact",
        "How does how often you are in touch compare to what each wants?",
        "Far short",
        "As wanted",
      ),
      aspect("reciprocity", "How evenly does effort flow between you?", "All one way", "Even"),
      aspect("honesty", "How honestly can you tell each other a hard thing?", "Never", "Plainly"),
      aspect(
        "support",
        "When one of you is in trouble, how reliably does the other show up?",
        "Rarely",
        "Always",
      ),
      aspect(
        "respect-boundaries",
        "How well does each of you respect what the other does not want to talk about?",
        "Overstepped",
        "Respected",
      ),
    ],
  },
  {
    id: "guy-friends",
    name: "Guy Friend A–Guy Friend B",
    shortName: "Guy Friends",
    realm: "Social",
    roles: { initiator: "Guy Friend A", counterparty: "Guy Friend B" },
    descriptor: {
      whoItsFor: "Two male friends who want the support and the straight talk to feel even.",
      whoItsNotFor: "New acquaintances, or a friendship one person has already decided to end.",
    },
    price: RELATIONSHIP_PRICE_CENTS,
    purchasable: true,
    aspects: [
      aspect(
        "contact",
        "How does how often you are in touch compare to what each wants?",
        "Far short",
        "As wanted",
      ),
      aspect(
        "openness",
        "How much of what is actually going on does each of you share?",
        "Nothing real",
        "Openly",
      ),
      aspect(
        "support",
        "When one of you is in trouble, how reliably does the other show up?",
        "Rarely",
        "Always",
      ),
      aspect(
        "initiative",
        "How evenly is the effort to organise things split?",
        "All one way",
        "Even",
      ),
      aspect(
        "straight-talk",
        "How directly can you say a hard thing to each other?",
        "Never",
        "Plainly",
      ),
    ],
  },
  {
    id: "gal-friends",
    name: "Gal Friend A–Gal Friend B",
    shortName: "Gal Friends",
    realm: "Social",
    roles: { initiator: "Gal Friend A", counterparty: "Gal Friend B" },
    descriptor: {
      whoItsFor: "Two female friends who want the trust and the honesty to feel even.",
      whoItsNotFor: "New acquaintances, or a friendship one person has already decided to end.",
    },
    price: RELATIONSHIP_PRICE_CENTS,
    purchasable: true,
    aspects: [
      aspect(
        "contact",
        "How does how often you are in touch compare to what each wants?",
        "Far short",
        "As wanted",
      ),
      aspect(
        "trust",
        "How much does each of you trust the other with what matters?",
        "Not much",
        "Fully",
      ),
      aspect(
        "support",
        "When one of you is in trouble, how reliably does the other show up?",
        "Rarely",
        "Always",
      ),
      aspect("honesty", "How honestly can you tell each other a hard thing?", "Never", "Plainly"),
      aspect(
        "jealousy",
        "How much does comparison between you affect how you treat each other?",
        "A lot",
        "Not at all",
      ),
    ],
  },
  {
    id: "guy-friend-gal-friend",
    name: "Guy Friend–Gal Friend",
    shortName: "GuyFriend–GalFriend",
    realm: "Social",
    roles: { initiator: "Guy Friend", counterparty: "Gal Friend" },
    descriptor: {
      whoItsFor: "A male and a female friend who want the assumptions out in the open.",
      whoItsNotFor: "New acquaintances, or a friendship one person has already decided to end.",
    },
    price: RELATIONSHIP_PRICE_CENTS,
    purchasable: true,
    aspects: [
      aspect(
        "contact",
        "How does how often you are in touch compare to what each wants?",
        "Far short",
        "As wanted",
      ),
      aspect(
        "assumptions",
        "How much do assumptions about the friendship shape how you treat each other?",
        "A lot",
        "Not at all",
      ),
      aspect(
        "respect-boundaries",
        "How well does each of you respect what the other does not want to talk about?",
        "Overstepped",
        "Respected",
      ),
      aspect(
        "support",
        "When one of you is in trouble, how reliably does the other show up?",
        "Rarely",
        "Always",
      ),
      aspect("honesty", "How honestly can you tell each other a hard thing?", "Never", "Plainly"),
    ],
  },

  /* ------------------------------------------------ Excluded — the dating set, kept as records */
  {
    id: "girlfriend-boyfriend",
    name: "Girlfriend–Boyfriend",
    shortName: "Girlfriend–Boyfriend",
    realm: "Social",
    roles: { initiator: "Girlfriend", counterparty: "Boyfriend" },
    descriptor: {
      whoItsFor: "A girlfriend and a boyfriend checking where they stand.",
      whoItsNotFor: "Not offered — dating is outside this product, by the owner's instruction.",
    },
    aspects: [],
    price: RELATIONSHIP_PRICE_CENTS,
    purchasable: false,
  },
  {
    id: "dating",
    name: "Date A–Date B",
    shortName: "Dating",
    realm: "Social",
    roles: { initiator: "Date A", counterparty: "Date B" },
    descriptor: {
      whoItsFor: "Two people who are dating.",
      whoItsNotFor: "Not offered — dating is outside this product, by the owner's instruction.",
    },
    aspects: [],
    price: RELATIONSHIP_PRICE_CENTS,
    purchasable: false,
  },
  {
    id: "committed-significant-others",
    name: "Committed Significant Other A–B",
    shortName: "Committed Significant Others",
    realm: "Social",
    roles: { initiator: "CSO A", counterparty: "CSO B" },
    descriptor: {
      whoItsFor: "Two committed significant others.",
      whoItsNotFor: "Not offered — dating is outside this product, by the owner's instruction.",
    },
    aspects: [],
    price: RELATIONSHIP_PRICE_CENTS,
    purchasable: false,
  },
];

/* ------------------------------------------------------------------ *
 * The purchasable gate — one source for the catalogue, the shop and the review list
 * ------------------------------------------------------------------ */

/**
 * Types that are **never** for sale, whatever a flag says. The dating set is a product
 * exclusion, so the gate is not just `purchasable` — a dating row that somehow flips its
 * flag to `true` still cannot reach the catalogue, the shop or the review list.
 */
export const EXCLUDED_TYPE_IDS: readonly string[] = [
  "girlfriend-boyfriend",
  "dating",
  "committed-significant-others",
];

/** Is this type allowed in the catalogue, the shop and the review list? */
export function isPurchasable(type: RelationshipType): boolean {
  return type.purchasable && !EXCLUDED_TYPE_IDS.includes(type.id);
}

/** The types the catalogue, the shop picker and the review list draw from. */
export const purchasableRelationshipTypes: readonly RelationshipType[] =
  relationshipTypes.filter(isPurchasable);

/** The type by id, or `undefined` when a segment names no type. Never a default. */
export function relationshipType(id: string): RelationshipType | undefined {
  return relationshipTypes.find((type) => type.id === id);
}

/** The purchasable type by id — the `[type]` route resolves only what may be shown. */
export function purchasableRelationshipType(id: string): RelationshipType | undefined {
  return purchasableRelationshipTypes.find((type) => type.id === id);
}

/** One realm's purchasable types, in catalogue order. */
export interface RealmGroup {
  readonly realm: Realm;
  readonly types: readonly RelationshipType[];
}

/**
 * The purchasable types grouped by realm, in the order `REALMS` declares. The catalogue
 * and the shop's type picker both render this — one grouping, not two.
 */
export function purchasableTypesByRealm(): readonly RealmGroup[] {
  return REALMS.map((realm) => ({
    realm,
    types: purchasableRelationshipTypes.filter((type) => type.realm === realm),
  })).filter((group) => group.types.length > 0);
}

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
 * One completed Advanced-Mode sheet per type. Only `co-founders` keeps a demo today: its
 * Aspects are unchanged from before this taxonomy, so its answers still match. Every other
 * type's Aspects are new (#385), and the issue does not author demo answers — a type with no
 * sheet renders the demo page's "no example yet" state rather than a fabricated report.
 */
export const demoAnswersByType: Readonly<Record<string, TypeDemoAnswers>> = {
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
};

/** The demo answers for one type, or `undefined` when the type has no demo yet. */
export function demoAnswersFor(typeId: string): TypeDemoAnswers | undefined {
  return demoAnswersByType[typeId];
}

/* ------------------------------------------------------------------ *
 * Validate at import — a typo in the taxonomy or a drifted gate is a red build
 * ------------------------------------------------------------------ */

/** The taxonomy itself, each record a strict `RelationshipType`. */
export const validRelationshipTypes: readonly RelationshipType[] = z
  .array(zRelationshipType)
  .parse(relationshipTypes);

/** Every record carries a `purchasable` field and a descriptor free of placeholders. */
for (const type of validRelationshipTypes) {
  if (type.purchasable !== true && type.purchasable !== false) {
    throw new Error(`relationship-types: "${type.id}" has no purchasable field`);
  }
  if (/placeholder|\[.*tbd.*\]/i.test(type.descriptor.whoItsFor + type.descriptor.whoItsNotFor)) {
    throw new Error(`relationship-types: "${type.id}" descriptor still carries a placeholder`);
  }
}

/** A purchasable type asks 5–10 Aspects; an excluded one asks none. */
for (const type of validRelationshipTypes) {
  const count = type.aspects.length;
  if (type.purchasable && (count < 5 || count > 10)) {
    throw new Error(
      `relationship-types: purchasable type "${type.id}" has ${count} Aspects (5–10 required)`,
    );
  }
  if (!type.purchasable && count !== 0) {
    throw new Error(
      `relationship-types: excluded type "${type.id}" has ${count} Aspects (an excluded type carries none)`,
    );
  }
}

/** No two records share an id — the reconciliation renames, it never duplicates. */
{
  const ids = validRelationshipTypes.map((type) => type.id);
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`relationship-types: duplicate id "${id}"`);
    seen.add(id);
  }
}

/** The gate excludes the dating set even if a flag were flipped — the negative case, enforced. */
for (const id of EXCLUDED_TYPE_IDS) {
  const type = relationshipType(id);
  if (type === undefined) throw new Error(`relationship-types: excluded id "${id}" has no record`);
  if (isPurchasable(type)) {
    throw new Error(`relationship-types: excluded type "${id}" slipped past the gate`);
  }
}

/** A type that has a demo is answered, by both parties, on exactly the Aspects it names. */
for (const type of validRelationshipTypes) {
  const demo = demoAnswersByType[type.id];
  if (demo === undefined) continue;
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
