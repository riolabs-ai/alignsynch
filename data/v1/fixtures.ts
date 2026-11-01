/**
 * The v1 prototype's mock universe — the templates the store seeds from, plus the
 * personas, relationships, accounts and tickets that make `/v1/**` behave like a
 * shipped app instead of a gallery of screens.
 *
 * `/v1/**` is the owner's clickable prototype of the whole product, built against an
 * in-browser store (`lib/v1/store.tsx`) rather than Postgres. This file is that store's
 * seed, typed with the **real** model (`content/assessment.ts::Assessment` and the
 * Opinion/Setting/Mode sub-schemas, via `z.infer`), so the day the prototype is wired the
 * shapes already match — the same rule `data/assessments.ts` follows for the live fixture.
 *
 * Three templates seed the library; five relationships span the corrected model — a
 * subscription per relationship (`active`, `past_due` or `lapsed`), a session that is complete
 * only when **both** parties accept (the blind rule lifts at acceptance, never at submission),
 * and a complete session's comment threads on the relationship and on single Aspects. Every
 * relationship is played in Advanced Mode — Feel, Wish, Think and Guess; five accounts and
 * three tickets seed the Service queue. A relationship's Aspects are a **copy** of the
 * template it names (never a reference), and its parties' answers are maps keyed by Aspect
 * id, which is what lets an invitation sit at `{}` without violating the real
 * `zAssessmentInstance` (which requires every party to answer every Aspect).
 *
 * Imported through relative paths on purpose: `tsconfig.datacheck.json` compiles this file
 * under `module: commonjs`, and the `@/` alias is not resolved there.
 *
 * Nothing here is a component and nothing reads a clock at render: every instant is an ISO
 * literal, the same convention the rest of `data/` follows.
 */
import { z } from "zod";
import {
  zAlignmentSetting,
  zAssessment,
  zAssessmentMode,
  zAspect,
  zOpinions,
  type Assessment,
  type Aspect,
  type Opinions,
} from "../../content/assessment";

/* ------------------------------------------------------------------ *
 * Templates — the library the editor and the relationship form read
 * ------------------------------------------------------------------ */

export const v1Templates: readonly Assessment[] = [
  {
    id: "v1-template-business",
    slug: "staff-manager",
    type: "assessment",
    status: "published",
    date: "2026-10-26T09:00:00.000Z",
    title: "Staff & Manager",
    summary:
      "Relationship Type: Business — the glossary's Staff / Manager descriptor, Realm: Office. Four Aspects of a working relationship — priorities, feedback, workload and decisions — each answered from how it feels now to how you wish it to change.",
    items: [
      {
        id: "aspect-priorities",
        prompt: "How are the week's priorities agreed?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Set for me",
        rightValue: "Agreed together",
      },
      {
        id: "aspect-feedback",
        prompt: "How is feedback on the work given?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Never said",
        rightValue: "Said directly",
      },
      {
        id: "aspect-workload",
        prompt: "How is the workload split between the two of you?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "All on me",
        rightValue: "Evenly shared",
      },
      {
        id: "aspect-decisions",
        prompt: "How are the decisions about the work made?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Manager decides",
        rightValue: "Decided together",
      },
    ],
  },
  {
    id: "v1-template-personal",
    slug: "parent-child",
    type: "assessment",
    status: "published",
    date: "2026-10-27T09:00:00.000Z",
    title: "Parent & Child",
    summary:
      "Relationship Type: Personal — the glossary's Parent / Child descriptor, Realm: Home. Four Aspects of growing together — trust, house rules, one-to-one time and privacy — each answered from how it feels now to how you wish it to change.",
    items: [
      {
        id: "aspect-trust",
        prompt: "How much do we trust each other with the hard things?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Kept hidden",
        rightValue: "Shared openly",
      },
      {
        id: "aspect-house-rules",
        prompt: "How are the rules of the house agreed?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Set for me",
        rightValue: "Agreed together",
      },
      {
        id: "aspect-one-to-one",
        prompt: "How often do we make time for just the two of us?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Rarely",
        rightValue: "Often",
      },
      {
        id: "aspect-privacy",
        prompt: "How is each of us allowed our own space?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "None",
        rightValue: "Fully respected",
      },
    ],
  },
  {
    id: "v1-template-basics",
    slug: "relationship-basics",
    type: "assessment",
    status: "published",
    date: "2026-10-24T09:00:00.000Z",
    title: "Relationship Basics",
    summary:
      "Three Aspects of a relationship — time, money and conflict — each answered from how it feels now to how you wish it to change.",
    items: [
      {
        id: "aspect-time",
        prompt: "How much time do you spend together in a normal week?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Rare",
        rightValue: "Constant",
      },
      {
        id: "aspect-money",
        prompt: "How are money and the decisions about it handled?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Kept separate",
        rightValue: "Fully shared",
      },
      {
        id: "aspect-conflict",
        prompt: "When there is a disagreement, how is it raised?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Left unsaid",
        rightValue: "Said plainly",
      },
    ],
  },
];

/** The template records, validated the same way data:check validates `data/assessments.ts`. */
export const seedTemplates: readonly Assessment[] = z.array(zAssessment).parse(v1Templates);

/* ------------------------------------------------------------------ *
 * Personas
 * ------------------------------------------------------------------ */

export const zPersona = z.enum([
  "visitor",
  "initiator",
  "counterparty",
  "coach",
  "admin",
  "service",
]);

export type Persona = z.infer<typeof zPersona>;

/** The six personas, in the order the picker draws them. */
export const PERSONAS = zPersona.options;

export interface PersonaMeta {
  /** The persona's id — the value `v1_persona` stores. */
  readonly id: Persona;
  /** The role word the picker and the persona bar render. */
  readonly label: string;
  /** The display name used when this persona is a party in a relationship. */
  readonly name: string;
  /** One line describing what this persona can do, for the picker card. */
  readonly blurb: string;
  /** Where the picker sends this persona after it is chosen. */
  readonly landing: string;
}

export const PERSONA_META: Readonly<Record<Persona, PersonaMeta>> = {
  visitor: {
    id: "visitor",
    label: "Visitor",
    name: "Visitor",
    blurb: "Read the marketing pages, then start a relationship as the Initiator.",
    landing: "/v1",
  },
  initiator: {
    id: "initiator",
    label: "Initiator",
    name: "Jordan",
    blurb: "Author templates, create relationships, invite the counterparty, read the report.",
    landing: "/v1/initiator",
  },
  counterparty: {
    id: "counterparty",
    label: "Counterparty",
    name: "Sam",
    blurb: "Claim the invitation, answer the same Aspects from your side, read the report.",
    landing: "/v1/counterparty",
  },
  coach: {
    id: "coach",
    label: "Coach",
    name: "Riley",
    blurb: "Observe shared relationships and leave advice — no scoring, no answering.",
    landing: "/v1/coach",
  },
  admin: {
    id: "admin",
    label: "Admin",
    name: "Admin",
    blurb: "Inspect every relationship, every template, and the gap aggregates.",
    landing: "/v1/admin",
  },
  service: {
    id: "service",
    label: "Service",
    name: "Service",
    blurb: "Work the support queue: invitations, accounts and stuck relationships.",
    landing: "/v1/service",
  },
};

/* ------------------------------------------------------------------ *
 * The relationship — the real sub-schemas around partial answers
 * ------------------------------------------------------------------ */

const zCoachComment = z
  .object({
    id: z.string().min(1),
    /** A persona id, or "coach" for the seeded advice. */
    author: z.string().min(1),
    body: z.string().min(1),
    at: z.string().min(1),
  })
  .strict();

/**
 * The two subscription plans a relationship can be started on. The word is the prototype's
 * own: the Initiator subscribes monthly or quarterly, per relationship, and the Counterparty
 * pays nothing, ever.
 */
export const zSubscriptionPlan = z.enum(["monthly", "quarterly"]);

export type SubscriptionPlan = z.infer<typeof zSubscriptionPlan>;

export const SUBSCRIPTION_PLANS = zSubscriptionPlan.options;

/**
 * The three states a subscription can be in. `active` is good standing; `past_due` is a
 * payment that did not clear; `lapsed` is ended and blocks new sessions but keeps every
 * response and the history readable.
 */
export const zSubscriptionStatus = z.enum(["active", "past_due", "lapsed"]);

export type SubscriptionStatus = z.infer<typeof zSubscriptionStatus>;

export const SUBSCRIPTION_STATUSES = zSubscriptionStatus.options;

/**
 * One subscription — there is only ever one per relationship in the prototype, mocked and
 * never charged. `periodEnd` is an ISO instant, the same convention as every other date here.
 */
const zSubscription = z
  .object({
    plan: zSubscriptionPlan,
    status: zSubscriptionStatus,
    periodEnd: z.string().min(1),
    startedAt: z.string().min(1),
  })
  .strict();

export type V1Subscription = z.infer<typeof zSubscription>;

/**
 * One comment a party writes on the relationship or on a single Aspect. `author` is the
 * role, never a name — the name is the relationship's own field, so a rename follows the
 * party and not every comment.
 */
const zComment = z
  .object({
    id: z.string().min(1),
    author: z.enum(["initiator", "counterparty"]),
    body: z.string().min(1),
    at: z.string().min(1),
  })
  .strict();

export type V1Comment = z.infer<typeof zComment>;

/**
 * A completed session, archived when a new one is requested — the answers the report was
 * built from and the two acceptance instants, so history stays readable after the current
 * sheet resets. `completedAt` is the later of the two acceptance instants: the moment the
 * blind rule lifted.
 */
const zSessionRecord = z
  .object({
    id: z.string().min(1),
    initiatorAnswers: z.record(z.string(), zOpinions),
    counterpartyAnswers: z.record(z.string(), zOpinions),
    initiatorAcceptedAt: z.string().min(1),
    counterpartyAcceptedAt: z.string().min(1),
    completedAt: z.string().min(1),
  })
  .strict();

export type V1SessionRecord = z.infer<typeof zSessionRecord>;

/**
 * One relationship through its whole life. The parties' answers are maps keyed by the Aspect id
 * they answer, which is what lets an invite sit at `{}` without violating the real instance
 * schema; the stage is derived from the two `*Submitted` flags and the copies of the Aspects.
 */
export const zV1Relationship = z
  .object({
    id: z.string().min(1),
    /** The template this relationship copies; `items` below must be that template's Aspects. */
    templateId: z.string().min(1),
    /** The relationship's own name, when it has one; absent means "use the template title". */
    name: z.string().min(1).optional(),
    items: z.array(zAspect).min(1),
    mode: zAssessmentMode,
    setting: zAlignmentSetting,
    initiatorName: z.string().min(1),
    /** Null until the invite is claimed; that is the whole difference between `invited` and the rest. */
    counterpartyName: z.string().min(1).nullable(),
    initiatorAnswers: z.record(z.string(), zOpinions),
    counterpartyAnswers: z.record(z.string(), zOpinions),
    initiatorSubmitted: z.boolean(),
    counterpartySubmitted: z.boolean(),
    /**
     * Acceptance is recorded per party and is the closing event of a session: a session is
     * complete only when both parties have accepted, and the blind rule lifts at that instant —
     * never at submission alone.
     */
    initiatorAccepted: z.boolean(),
    counterpartyAccepted: z.boolean(),
    /** When each party accepted, or null before they do — the acceptance record's timestamps. */
    initiatorAcceptedAt: z.string().min(1).nullable(),
    counterpartyAcceptedAt: z.string().min(1).nullable(),
    /** The claimable invite. Null before the first send; re-invite rotates it and the old one dies. */
    inviteToken: z.string().min(1).nullable(),
    /** Whether the Coach persona can see this relationship (read-only). */
    sharedWithCoach: z.boolean(),
    coachComments: z.array(zCoachComment),
    /** The parties' thread on the relationship as a whole, open only after a session completes. */
    comments: z.array(zComment),
    /** A thread per Aspect, keyed by Aspect id, open only after a session completes. */
    aspectComments: z.record(z.string(), z.array(zComment)),
    /** Sessions opened for this relationship, for the Manage dashboard's completion figure. */
    openedSessions: z.number().int().min(0),
    /** Sessions completed, for the same figure. */
    completedSessions: z.number().int().min(0),
    /** The one subscription, or null before the Initiator has subscribed. */
    subscription: zSubscription.nullable(),
    /** Completed sessions, archived newest-last, so history stays readable across a reset. */
    history: z.array(zSessionRecord),
    /** The instant of the last completed session, or null before the first. */
    lastSessionAt: z.string().min(1).nullable(),
    createdAt: z.string().min(1),
  })
  .strict();

export type V1Relationship = z.infer<typeof zV1Relationship>;

/** A support/ops account — the Service persona's "accounts" queue. */
export const zV1Account = z
  .object({
    id: z.string().min(1),
    persona: zPersona,
    name: z.string().min(1),
    email: z.string().min(1),
    state: z.enum(["active", "trial", "stuck"]),
  })
  .strict();

export type V1Account = z.infer<typeof zV1Account>;

/** A support ticket — the Service persona's queue. */
export const zV1Ticket = z
  .object({
    id: z.string().min(1),
    kind: z.enum(["invitation", "account", "stuck"]),
    subject: z.string().min(1),
    status: z.enum(["open", "resolved"]),
    relationshipId: z.string().min(1).nullable(),
    accountId: z.string().min(1).nullable(),
  })
  .strict();

export type V1Ticket = z.infer<typeof zV1Ticket>;

/* ------------------------------------------------------------------ *
 * Seed relationships — one per stage the report can be in
 * ------------------------------------------------------------------ */

/** The Aspects of one template, copied — a relationship holds its own copy, never a reference. */
function aspectCopy(templateId: string): Aspect[] {
  const template = v1Templates.find((candidate) => candidate.id === templateId);
  if (template === undefined) {
    throw new Error(`fixtures: relationship names template "${templateId}", which is not a record`);
  }
  return template.items.map((item) => ({ ...item, scale: { ...item.scale } }));
}

/** The Answers maps the seeded instances use, keyed by Aspect id. */
type AnswerMap = Record<string, Opinions>;

/** Relationship Basics answered the way Avery and Rowan did: a Feel Gap of 3 on the first
 * Aspect, and predictions that miss each other on Conflict. */
const averyAnswers: AnswerMap = {
  "aspect-time": { feel: 2, wish: 5, think: 4, guess: 4 },
  "aspect-money": { feel: 4, wish: 4, think: 4, guess: 4 },
  "aspect-conflict": { feel: 3, wish: 5, think: 4, guess: 3 },
};

const rowanAnswers: AnswerMap = {
  "aspect-time": { feel: 5, wish: 3, think: 3, guess: 4 },
  "aspect-money": { feel: 4, wish: 4, think: 4, guess: 4 },
  "aspect-conflict": { feel: 2, wish: 3, think: 1, guess: 5 },
};

/** Staff & Manager answered the way Marco did — the initiator side, used for the blind case. */
const marcoAnswers: AnswerMap = {
  "aspect-priorities": { feel: 2, wish: 5, think: 4, guess: 3 },
  "aspect-feedback": { feel: 3, wish: 4, think: 3, guess: 4 },
  "aspect-workload": { feel: 5, wish: 3, think: 3, guess: 4 },
  "aspect-decisions": { feel: 1, wish: 5, think: 2, guess: 5 },
};

/** Parent & Child answered by Ruth and Sam — every Gap is 0, predictions included, so it is
 * aligned. */
const ruthAnswers: AnswerMap = {
  "aspect-trust": { feel: 4, wish: 5, think: 4, guess: 5 },
  "aspect-house-rules": { feel: 3, wish: 3, think: 3, guess: 3 },
  "aspect-one-to-one": { feel: 2, wish: 3, think: 2, guess: 3 },
  "aspect-privacy": { feel: 3, wish: 4, think: 3, guess: 4 },
};

const samAnswers: AnswerMap = {
  "aspect-trust": { feel: 4, wish: 5, think: 4, guess: 5 },
  "aspect-house-rules": { feel: 3, wish: 3, think: 3, guess: 3 },
  "aspect-one-to-one": { feel: 2, wish: 3, think: 2, guess: 3 },
  "aspect-privacy": { feel: 3, wish: 4, think: 3, guess: 4 },
};

/** Parent & Child answered by Noor and Iris in Advanced Mode — all eight kinds are measured. */
const noorAnswers: AnswerMap = {
  "aspect-trust": { feel: 5, wish: 5, think: 4, guess: 5 },
  "aspect-house-rules": { feel: 2, wish: 4, think: 3, guess: 1 },
  "aspect-one-to-one": { feel: 1, wish: 4, think: 2, guess: 3 },
  "aspect-privacy": { feel: 3, wish: 2, think: 2, guess: 4 },
};

const irisAnswers: AnswerMap = {
  "aspect-trust": { feel: 4, wish: 3, think: 5, guess: 2 },
  "aspect-house-rules": { feel: 5, wish: 2, think: 4, guess: 3 },
  "aspect-one-to-one": { feel: 3, wish: 1, think: 4, guess: 1 },
  "aspect-privacy": { feel: 4, wish: 5, think: 3, guess: 5 },
};

const seedRelationshipRows: readonly V1Relationship[] = [
  {
    id: "rel-invited",
    templateId: "v1-template-basics",
    items: aspectCopy("v1-template-basics"),
    mode: "advanced",
    setting: "soft",
    initiatorName: "Jordan",
    counterpartyName: null,
    initiatorAnswers: {},
    counterpartyAnswers: {},
    initiatorSubmitted: false,
    counterpartySubmitted: false,
    initiatorAccepted: false,
    counterpartyAccepted: false,
    initiatorAcceptedAt: null,
    counterpartyAcceptedAt: null,
    inviteToken: "inv-7f3a91c2",
    sharedWithCoach: false,
    coachComments: [],
    comments: [],
    aspectComments: {},
    openedSessions: 0,
    completedSessions: 0,
    subscription: {
      plan: "monthly",
      status: "active",
      periodEnd: "2026-11-30T09:00:00.000Z",
      startedAt: "2026-10-30T09:00:00.000Z",
    },
    history: [],
    lastSessionAt: null,
    createdAt: "2026-10-30T09:00:00.000Z",
  },
  {
    id: "rel-connected-blind",
    templateId: "v1-template-business",
    items: aspectCopy("v1-template-business"),
    mode: "advanced",
    setting: "soft",
    initiatorName: "Jordan",
    counterpartyName: "Sam",
    initiatorAnswers: marcoAnswers,
    counterpartyAnswers: {},
    initiatorSubmitted: true,
    counterpartySubmitted: false,
    initiatorAccepted: false,
    counterpartyAccepted: false,
    initiatorAcceptedAt: null,
    counterpartyAcceptedAt: null,
    inviteToken: "inv-9c2b04e1",
    sharedWithCoach: false,
    coachComments: [],
    comments: [],
    aspectComments: {},
    openedSessions: 1,
    completedSessions: 0,
    subscription: {
      plan: "monthly",
      status: "active",
      periodEnd: "2026-11-30T11:30:00.000Z",
      startedAt: "2026-10-30T11:30:00.000Z",
    },
    history: [],
    lastSessionAt: null,
    createdAt: "2026-10-30T11:30:00.000Z",
  },
  {
    id: "rel-sharing-unmet",
    templateId: "v1-template-basics",
    name: "Avery & Rowan",
    items: aspectCopy("v1-template-basics"),
    mode: "advanced",
    setting: "soft",
    initiatorName: "Avery",
    counterpartyName: "Rowan",
    initiatorAnswers: averyAnswers,
    counterpartyAnswers: rowanAnswers,
    initiatorSubmitted: true,
    counterpartySubmitted: true,
    // Both parties submitted, but neither has accepted — the session is not complete and the
    // blind rule still holds: this is the corrected model's proof that submission alone lifts
    // nothing.
    initiatorAccepted: false,
    counterpartyAccepted: false,
    initiatorAcceptedAt: null,
    counterpartyAcceptedAt: null,
    inviteToken: "inv-5d41a8f0",
    sharedWithCoach: true,
    coachComments: [
      {
        id: "cmt-1",
        author: "coach",
        body: "You read 'conflict' from opposite ends. Before the next conversation, agree what 'said plainly' would look like to each of you.",
        at: "2026-10-30T12:00:00.000Z",
      },
    ],
    comments: [],
    aspectComments: {},
    openedSessions: 1,
    completedSessions: 0,
    subscription: {
      plan: "quarterly",
      status: "past_due",
      periodEnd: "2026-11-28T18:00:00.000Z",
      startedAt: "2026-10-28T18:00:00.000Z",
    },
    history: [],
    lastSessionAt: null,
    createdAt: "2026-10-28T18:30:00.000Z",
  },
  {
    id: "rel-aligned",
    templateId: "v1-template-personal",
    name: "Ruth & Sam",
    items: aspectCopy("v1-template-personal"),
    mode: "advanced",
    setting: "soft",
    initiatorName: "Ruth",
    counterpartyName: "Sam",
    initiatorAnswers: ruthAnswers,
    counterpartyAnswers: samAnswers,
    initiatorSubmitted: true,
    counterpartySubmitted: true,
    initiatorAccepted: true,
    counterpartyAccepted: true,
    initiatorAcceptedAt: "2026-10-29T09:55:00.000Z",
    counterpartyAcceptedAt: "2026-10-29T10:00:00.000Z",
    inviteToken: "inv-2b8c17d4",
    sharedWithCoach: true,
    coachComments: [],
    comments: [
      {
        id: "cmt-rel-1",
        author: "counterparty",
        body: "Thank you for sitting down for this. I want to keep the one-to-one time we agreed on.",
        at: "2026-10-29T10:20:00.000Z",
      },
      {
        id: "cmt-rel-2",
        author: "initiator",
        body: "Me too — let's put it on the calendar for every Saturday morning.",
        at: "2026-10-29T10:35:00.000Z",
      },
    ],
    aspectComments: {
      "aspect-trust": [
        {
          id: "cmt-trust-1",
          author: "initiator",
          body: "The trust one surprised me — I did not expect us to be this close on it.",
          at: "2026-10-29T10:40:00.000Z",
        },
      ],
      "aspect-one-to-one": [
        {
          id: "cmt-one-1",
          author: "counterparty",
          body: "This is the one I most want to change.",
          at: "2026-10-29T10:42:00.000Z",
        },
      ],
    },
    openedSessions: 2,
    completedSessions: 2,
    subscription: {
      plan: "quarterly",
      status: "active",
      periodEnd: "2026-11-28T18:45:00.000Z",
      startedAt: "2026-10-28T18:45:00.000Z",
    },
    history: [],
    lastSessionAt: "2026-10-29T10:00:00.000Z",
    createdAt: "2026-10-28T19:00:00.000Z",
  },
  {
    id: "rel-advanced",
    templateId: "v1-template-personal",
    name: "Noor & Iris",
    items: aspectCopy("v1-template-personal"),
    mode: "advanced",
    setting: "full",
    initiatorName: "Noor",
    counterpartyName: "Iris",
    initiatorAnswers: noorAnswers,
    counterpartyAnswers: irisAnswers,
    initiatorSubmitted: true,
    counterpartySubmitted: true,
    initiatorAccepted: true,
    counterpartyAccepted: true,
    initiatorAcceptedAt: "2026-10-25T15:00:00.000Z",
    counterpartyAcceptedAt: "2026-10-25T15:10:00.000Z",
    inviteToken: "inv-8e0f22b5",
    sharedWithCoach: false,
    coachComments: [],
    comments: [],
    aspectComments: {},
    openedSessions: 4,
    completedSessions: 4,
    subscription: {
      plan: "monthly",
      status: "lapsed",
      periodEnd: "2026-10-28T09:00:00.000Z",
      startedAt: "2026-09-28T09:00:00.000Z",
    },
    history: [],
    lastSessionAt: "2026-10-30T15:00:00.000Z",
    createdAt: "2026-10-29T09:45:00.000Z",
  },
];

export const seedRelationships: readonly V1Relationship[] = z
  .array(zV1Relationship)
  .parse(seedRelationshipRows);

/* ------------------------------------------------------------------ *
 * Session history — the timeline's rows
 * ------------------------------------------------------------------ */

/**
 * One completed session in a relationship's history. The two parties' answers, keyed by
 * Aspect id exactly as the relationship's own maps are, so the timeline derives the
 * verdict, the widest Gap and the trend with the **same** arithmetic the report uses —
 * never stored, never authored as a number (`content/gaps.ts` owns the arithmetic, and a
 * stored Gap would be a second copy of it, exactly the defect the Gap-as-column rule
 * forbids).
 *
 * The store does not persist these: a `V1Relationship` holds only the latest answers, and
 * changing that shape is out of scope for this card. These rows are the fixture the
 * timeline reads to give a relationship a **past** — the newest row of each completed
 * relationship reuses the same answer maps the relationship's current answers hold, so the
 * timeline's newest row and the report always agree.
 */
export const zV1Session = z
  .object({
    id: z.string().min(1),
    relationshipId: z.string().min(1),
    /** The instant both parties submitted — the session's date on the timeline. */
    completedAt: z.string().min(1),
    initiatorAnswers: z.record(z.string(), zOpinions),
    counterpartyAnswers: z.record(z.string(), zOpinions),
  })
  .strict();

export type V1Session = z.infer<typeof zV1Session>;

/**
 * The three earlier Noor & Iris sessions. The fourth — the newest — is the relationship's
 * current answers (`noorAnswers` / `irisAnswers` above), so the timeline's newest row and
 * the report read the same numbers. Each earlier map is authored further apart, so the
 * trend the timeline computes is a closing one, never a number pasted into a sentence.
 */
const noorSession1: AnswerMap = {
  "aspect-trust": { feel: 1, wish: 5, think: 2, guess: 5 },
  "aspect-house-rules": { feel: 1, wish: 5, think: 2, guess: 5 },
  "aspect-one-to-one": { feel: 1, wish: 4, think: 1, guess: 4 },
  "aspect-privacy": { feel: 2, wish: 5, think: 2, guess: 5 },
};

const irisSession1: AnswerMap = {
  "aspect-trust": { feel: 5, wish: 1, think: 4, guess: 2 },
  "aspect-house-rules": { feel: 5, wish: 2, think: 4, guess: 2 },
  "aspect-one-to-one": { feel: 5, wish: 2, think: 5, guess: 1 },
  "aspect-privacy": { feel: 5, wish: 1, think: 4, guess: 1 },
};

const noorSession2: AnswerMap = {
  "aspect-trust": { feel: 2, wish: 5, think: 2, guess: 5 },
  "aspect-house-rules": { feel: 2, wish: 5, think: 3, guess: 4 },
  "aspect-one-to-one": { feel: 1, wish: 4, think: 2, guess: 4 },
  "aspect-privacy": { feel: 2, wish: 4, think: 2, guess: 4 },
};

const irisSession2: AnswerMap = {
  "aspect-trust": { feel: 5, wish: 2, think: 4, guess: 2 },
  "aspect-house-rules": { feel: 5, wish: 3, think: 4, guess: 2 },
  "aspect-one-to-one": { feel: 4, wish: 2, think: 4, guess: 2 },
  "aspect-privacy": { feel: 5, wish: 2, think: 4, guess: 1 },
};

const noorSession3: AnswerMap = {
  "aspect-trust": { feel: 2, wish: 5, think: 3, guess: 5 },
  "aspect-house-rules": { feel: 2, wish: 5, think: 3, guess: 4 },
  "aspect-one-to-one": { feel: 1, wish: 4, think: 2, guess: 3 },
  "aspect-privacy": { feel: 3, wish: 3, think: 2, guess: 4 },
};

const irisSession3: AnswerMap = {
  "aspect-trust": { feel: 5, wish: 3, think: 5, guess: 2 },
  "aspect-house-rules": { feel: 5, wish: 2, think: 4, guess: 3 },
  "aspect-one-to-one": { feel: 4, wish: 2, think: 4, guess: 1 },
  "aspect-privacy": { feel: 4, wish: 4, think: 3, guess: 4 },
};

/** Every completed session, oldest-to-newest within a relationship. */
const seedSessionRows: readonly V1Session[] = [
  // Avery & Rowan — one completed session, the relationship's current answers.
  {
    id: "sess-avery-rowan-1",
    relationshipId: "rel-sharing-unmet",
    completedAt: "2026-10-30T12:00:00.000Z",
    initiatorAnswers: averyAnswers,
    counterpartyAnswers: rowanAnswers,
  },
  // Ruth & Sam — two aligned sessions (the comparison is "held at 0.2").
  {
    id: "sess-ruth-sam-1",
    relationshipId: "rel-aligned",
    completedAt: "2026-10-28T20:00:00.000Z",
    initiatorAnswers: ruthAnswers,
    counterpartyAnswers: samAnswers,
  },
  {
    id: "sess-ruth-sam-2",
    relationshipId: "rel-aligned",
    completedAt: "2026-10-29T10:00:00.000Z",
    initiatorAnswers: ruthAnswers,
    counterpartyAnswers: samAnswers,
  },
  // Noor & Iris — four sessions, closing; the newest is the relationship's current answers.
  {
    id: "sess-noor-iris-1",
    relationshipId: "rel-advanced",
    completedAt: "2026-10-29T10:00:00.000Z",
    initiatorAnswers: noorSession1,
    counterpartyAnswers: irisSession1,
  },
  {
    id: "sess-noor-iris-2",
    relationshipId: "rel-advanced",
    completedAt: "2026-10-29T18:00:00.000Z",
    initiatorAnswers: noorSession2,
    counterpartyAnswers: irisSession2,
  },
  {
    id: "sess-noor-iris-3",
    relationshipId: "rel-advanced",
    completedAt: "2026-10-30T09:00:00.000Z",
    initiatorAnswers: noorSession3,
    counterpartyAnswers: irisSession3,
  },
  {
    id: "sess-noor-iris-4",
    relationshipId: "rel-advanced",
    completedAt: "2026-10-30T15:00:00.000Z",
    initiatorAnswers: noorAnswers,
    counterpartyAnswers: irisAnswers,
  },
];

export const seedSessions: readonly V1Session[] = z.array(zV1Session).parse(seedSessionRows);

/* ------------------------------------------------------------------ *
 * Seed accounts and tickets — the Service persona's queue
 * ------------------------------------------------------------------ */

const seedAccountRows: readonly V1Account[] = [
  {
    id: "account-initiator",
    persona: "initiator",
    name: "Jordan",
    email: "jordan@example.com",
    state: "active",
  },
  {
    id: "account-counterparty",
    persona: "counterparty",
    name: "Sam",
    email: "sam@example.com",
    state: "active",
  },
  {
    id: "account-coach",
    persona: "coach",
    name: "Riley",
    email: "riley@example.com",
    state: "trial",
  },
  {
    id: "account-admin",
    persona: "admin",
    name: "Admin",
    email: "admin@example.com",
    state: "active",
  },
  {
    id: "account-service",
    persona: "service",
    name: "Service",
    email: "service@example.com",
    state: "active",
  },
];

export const seedAccounts: readonly V1Account[] = z.array(zV1Account).parse(seedAccountRows);

const seedTicketRows: readonly V1Ticket[] = [
  {
    id: "ticket-invite",
    kind: "invitation",
    subject: "Invite to Sam expired before they could claim it",
    status: "open",
    relationshipId: "rel-invited",
    accountId: null,
  },
  {
    id: "ticket-account",
    kind: "account",
    subject: "Coach account sees none of the relationships shared with it",
    status: "open",
    relationshipId: null,
    accountId: "account-coach",
  },
  {
    id: "ticket-stuck",
    kind: "stuck",
    subject: "Staff & Manager relationship stuck in Connected for four days",
    status: "open",
    relationshipId: "rel-connected-blind",
    accountId: null,
  },
];

export const seedTickets: readonly V1Ticket[] = z.array(zV1Ticket).parse(seedTicketRows);

/* ------------------------------------------------------------------ *
 * The seed state the store boots from
 * ------------------------------------------------------------------ */

export interface V1SeedState {
  readonly version: number;
  readonly persona: Persona;
  readonly templates: readonly Assessment[];
  readonly relationships: readonly V1Relationship[];
  readonly accounts: readonly V1Account[];
  readonly tickets: readonly V1Ticket[];
}

/** Bump to invalidate a persisted store that predates a shape change. */
export const SEED_VERSION = 2;

export function buildSeedState(): V1SeedState {
  return {
    version: SEED_VERSION,
    persona: "visitor",
    templates: v1Templates,
    relationships: seedRelationships,
    accounts: seedAccounts,
    tickets: seedTickets,
  };
}
