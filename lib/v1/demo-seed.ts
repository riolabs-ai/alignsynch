/**
 * lib/v1/demo-seed.ts — the deterministic demo generator for the `/v1` prototype.
 *
 * A QA tool, not content. It builds **one relationship per purchasable catalogue type**, spread
 * across the four Stages, both Modes and both Settings, from a seeded PRNG written here — no
 * dependency, no clock at generation time, no `Date.now()` anywhere — so the same seed produces
 * the same Gaps on every run and a report a reviewer saw is a report they can get back.
 *
 * Three things the generator guarantees, because they are what makes a review possible:
 *
 *   - **every purchasable type appears**, read from `purchasableRelationshipTypes` at call time,
 *     so a taxonomy change moves the demo set with it instead of leaving a stale count here;
 *   - **both ends of the Gap range are exercised per Mode**: in any scored sheet, Aspect 0 is
 *     In Synch on all eight kinds and Aspect 1 carries the widest Gap (4), so a screen that
 *     renders 0 and a screen that renders 4 are both reachable from one seed;
 *   - **some rows are unscored on purpose** — `invited` and `connected` rows have never completed
 *     a session, so a surface must print `—`, never `0`, and this set proves it.
 *
 * `demoSeed()` returns the flow slice in the exact shape `lib/v1/store.tsx` persists
 * (`version`, `relationships`, `accounts`, `tickets`) under the key that store reads. Nothing
 * here writes storage: `installDemoSeed()` takes the `localStorage` it is handed, so the module
 * stays runnable under plain Node in a test.
 *
 * The accounts are `seedAccounts`, imported rather than invented: a persona account is how the
 * prototype signs in, not demo content, and a second copy here would be a second identity system.
 * The two tickets are derived from the demo rows themselves so every `relationshipId` resolves.
 */
import type { AlignmentSetting, AssessmentMode, Opinions } from "@/content/assessment";
import { DEMO_NOW_ISO } from "@/content/core";
import type { RelationshipStage } from "@/content/stages";
import {
  RELATIONSHIP_PRICE_CENTS,
  purchasableRelationshipTypes,
  type RelationshipType,
} from "@/data/v1/relationship-types";
import {
  SEED_VERSION,
  seedAccounts,
  type V1Account,
  type V1Relationship,
  type V1Ticket,
} from "@/data/v1/fixtures";

/* ------------------------------------------------------------------ *
 * Constants the store owns
 * ------------------------------------------------------------------ */

/**
 * The key `lib/v1/store.tsx` persists the flow slice under. That module keeps its
 * `FLOW_STORAGE_KEY` private, so the literal is repeated here and
 * `tests/v1-demo-seed.test.ts` reads `store.tsx` to prove the two are the same string — a
 * session that writes a payload nobody reads is the one failure this control cannot show you.
 */
export const DEMO_FLOW_STORAGE_KEY = "alignsynch.v1.relationships.v1";

/** The default seed. Any integer works; this one is the demo clock's own date. */
export const DEMO_SEED = 20261029;

/**
 * The Stages, in the order the demo set walks them. The length (7) and the Mode period (2) are
 * coprime, so every Stage reaches both Modes — a plan of length 4 would put `sharing` on one
 * Mode only, and the widest Gap would then exist in half the demo set.
 */
const STAGE_PLAN: readonly RelationshipStage[] = [
  "invited",
  "connected",
  "sharing",
  "aligned",
  "sharing",
  "aligned",
  "connected",
];

/**
 * The per-Aspect Gap plan for a scored-but-unmet sheet: In Synch, then the widest Gap, then the
 * three between. Aspect 0 is therefore always all-zero and Aspect 1 always reaches 4, whichever
 * Mode the row plays — the two ends are structural, not luck.
 */
const GAP_PLAN = [0, 4, 1, 3, 2] as const;

/* ------------------------------------------------------------------ *
 * The seeded PRNG — mulberry32, written out so there is nothing to install
 * ------------------------------------------------------------------ */

/**
 * A deterministic `() => [0, 1)` from a 32-bit seed. The same seed yields the same stream on
 * every engine: only `Math.imul`, shifts and `>>>` are used, no floating-point accumulation.
 */
export function demoRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The demo clock every instant is derived from — a constant, never `Date.now()`. */
const DEMO_CLOCK_MS = Date.parse(DEMO_NOW_ISO);
const HOUR_MS = 3_600_000;

/** An ISO instant `hours` after the demo clock; negative is before it. */
function at(hours: number): string {
  return new Date(DEMO_CLOCK_MS + hours * HOUR_MS).toISOString();
}

/* ------------------------------------------------------------------ *
 * Scores and opinions
 * ------------------------------------------------------------------ */

/** A score on the model's 1..5 band. */
function score(rng: () => number): number {
  return 1 + Math.floor(rng() * 5);
}

/**
 * A pair of scores exactly `gap` apart, both on 1..5: the floor is drawn from the values that
 * leave room for the gap, so |right - left| === gap for every gap 0..4.
 */
function pairWithGap(gap: number, rng: () => number): readonly [number, number] {
  const floor = 1 + Math.floor(rng() * (5 - gap));
  return rng() < 0.5 ? [floor, floor + gap] : [floor + gap, floor];
}

/**
 * A score exactly `gap` away from `anchor`, or the anchor itself when neither direction fits on
 * the 1..5 band. Used for the four prediction kinds, where the other party's answer is the thing
 * being predicted rather than a value this side owns.
 */
function offsetScore(anchor: number, gap: number, rng: () => number): number {
  const candidates: number[] = [];
  if (anchor + gap <= 5) candidates.push(anchor + gap);
  if (anchor - gap >= 1) candidates.push(anchor - gap);
  if (candidates.length === 0) return anchor;
  return candidates[Math.floor(rng() * candidates.length)];
}

/** One Aspect's two sheets, both parties' opinions keyed by opinion kind. */
interface AspectSheets {
  readonly initiator: Opinions;
  readonly counterparty: Opinions;
}

/**
 * An Aspect every party answered the same way and where Feel equals Wish: **all eight Gaps are
 * 0**, which is the In Synch end a report has to be able to render.
 */
function inSynchAspect(mode: AssessmentMode, rng: () => number): AspectSheets {
  const value = score(rng);
  const sheet: Opinions =
    mode === "basic"
      ? { feel: value, wish: value }
      : { feel: value, wish: value, think: value, guess: value };
  return { initiator: sheet, counterparty: { ...sheet } };
}

/**
 * An Aspect inside the Setting's tolerance: both parties answer identically (so every
 * cross-party and prediction Gap is 0) and Feel/Wish differ by no more than the Setting allows
 * (so each party's own Gap meets it too). Soft tolerates 1, Full tolerates only 0.
 */
function withinSettingAspect(
  mode: AssessmentMode,
  setting: AlignmentSetting,
  rng: () => number,
): AspectSheets {
  const limit = setting === "full" ? 0 : 1;
  const feel = 1 + Math.floor(rng() * (5 - limit));
  const wish = limit === 0 ? feel : feel + (rng() < 0.5 ? 1 : 0);
  const sheet: Opinions =
    mode === "basic" ? { feel, wish } : { feel, wish, think: feel, guess: wish };
  return { initiator: sheet, counterparty: { ...sheet } };
}

/**
 * An Aspect whose Feel pair and Wish pair each differ by exactly `magnitude`, with the four
 * prediction kinds offset from what the other party actually answered. `magnitude` 0 is
 * `inSynchAspect`'s job, so this is only called for 1..4.
 */
function gappedAspect(magnitude: number, mode: AssessmentMode, rng: () => number): AspectSheets {
  const [initiatorFeel, counterpartyFeel] = pairWithGap(magnitude, rng);
  const [initiatorWish, counterpartyWish] = pairWithGap(magnitude, rng);
  const initiator: Opinions =
    mode === "basic"
      ? { feel: initiatorFeel, wish: initiatorWish }
      : {
          feel: initiatorFeel,
          wish: initiatorWish,
          think: offsetScore(counterpartyFeel, magnitude, rng),
          guess: offsetScore(counterpartyWish, magnitude, rng),
        };
  const counterparty: Opinions =
    mode === "basic"
      ? { feel: counterpartyFeel, wish: counterpartyWish }
      : {
          feel: counterpartyFeel,
          wish: counterpartyWish,
          think: offsetScore(initiatorFeel, magnitude, rng),
          guess: offsetScore(initiatorWish, magnitude, rng),
        };
  return { initiator, counterparty };
}

/** Both parties' answers to every Aspect of a relationship, keyed by Aspect id. */
interface Sheet {
  readonly initiator: Readonly<Record<string, Opinions>>;
  readonly counterparty: Readonly<Record<string, Opinions>>;
}

/** A sheet whose Nth Aspect carries `GAP_PLAN[N % 5]` — the full 0..4 spread, both ends first. */
function gappedSheet(
  items: readonly { readonly id: string }[],
  mode: AssessmentMode,
  rng: () => number,
): Sheet {
  const initiator: Record<string, Opinions> = {};
  const counterparty: Record<string, Opinions> = {};
  items.forEach((item, index) => {
    const magnitude = GAP_PLAN[index % GAP_PLAN.length];
    const sheets = magnitude === 0 ? inSynchAspect(mode, rng) : gappedAspect(magnitude, mode, rng);
    initiator[item.id] = sheets.initiator;
    counterparty[item.id] = sheets.counterparty;
  });
  return { initiator, counterparty };
}

/** A sheet every Gap of which meets the Setting — the `aligned` end of the ladder. */
function alignedSheet(
  items: readonly { readonly id: string }[],
  mode: AssessmentMode,
  setting: AlignmentSetting,
  rng: () => number,
): Sheet {
  const initiator: Record<string, Opinions> = {};
  const counterparty: Record<string, Opinions> = {};
  for (const item of items) {
    const sheets = withinSettingAspect(mode, setting, rng);
    initiator[item.id] = sheets.initiator;
    counterparty[item.id] = sheets.counterparty;
  }
  return { initiator, counterparty };
}

/* ------------------------------------------------------------------ *
 * One relationship
 * ------------------------------------------------------------------ */

/** The Aspects a relationship copies from its catalogue type — the type's own, never shared. */
function aspectsOf(type: RelationshipType): V1Relationship["items"] {
  return type.aspects.map((aspect) => ({ ...aspect, scale: { ...aspect.scale } }));
}

/**
 * The one subscription each demo relationship may carry, mocked and never charged: one payment
 * for the period it started, the amount the plan costs. `null` is the unsubscribed state the
 * shop's checkout exists to leave.
 */
function subscriptionFor(index: number): V1Relationship["subscription"] {
  if (index % 7 === 6) return null;
  const plan = index % 2 === 0 ? "monthly" : "quarterly";
  const amountCents = plan === "monthly" ? RELATIONSHIP_PRICE_CENTS : RELATIONSHIP_PRICE_CENTS * 3;
  return {
    plan,
    status: index % 13 === 0 ? "past_due" : "active",
    periodEnd: at(24 * 30 - index),
    startedAt: at(-24 * 30 - index),
    payments: [
      {
        id: `pay-demo-${index + 1}`,
        plan,
        amountCents,
        paidAt: at(-24 * 30 - index),
      },
    ],
  };
}

/**
 * One demo relationship for one catalogue type.
 *
 * The Stage is not stored and is not set: it falls out of the facts below, exactly as
 * `content/stages.ts` derives it — an unclaimed invite is `invited`, a claimed sheet that has not
 * been accepted is `connected`, and an accepted sheet is `sharing` or `aligned` depending on
 * whether its Gaps meet the Setting.
 */
function demoRelationship(
  type: RelationshipType,
  index: number,
  rng: () => number,
): V1Relationship {
  const stage = STAGE_PLAN[index % STAGE_PLAN.length];
  const mode: AssessmentMode = index % 2 === 0 ? "basic" : "advanced";
  const setting: AlignmentSetting = index % 3 === 0 ? "soft" : "full";
  const items = aspectsOf(type);
  const complete = stage === "sharing" || stage === "aligned";

  // An invited row has no counterparty and no answers at all — the sheet is locked, so there is
  // nothing to fabricate. A connected row has a party and, on every third one, a full sheet that
  // has not been accepted: the row a surface must render `—` for even though every Aspect is
  // answered.
  const answersEmpty: Sheet = { initiator: {}, counterparty: {} };
  let sheet: Sheet = answersEmpty;
  if (stage === "aligned") {
    sheet = alignedSheet(items, mode, setting, rng);
  } else if (stage === "sharing" || (stage === "connected" && index % 3 === 1)) {
    sheet = gappedSheet(items, mode, rng);
  } else if (stage === "connected" && index % 3 === 0) {
    const half = gappedSheet(items, mode, rng);
    sheet = { initiator: half.initiator, counterparty: {} };
  }

  const initiatorSubmitted = complete || (stage === "connected" && index % 3 !== 2);
  const counterpartySubmitted = complete || (stage === "connected" && index % 3 === 1);

  const initiatorAcceptedAt = complete ? at(-(index % 9) - 2) : null;
  const counterpartyAcceptedAt = complete ? at(-(index % 9) - 1) : null;
  const claimed = stage !== "invited";

  return {
    id: `rel-demo-${type.id}`,
    // The id the store's own `templateFromType` clones a catalogue type under, so a type the
    // initiator has actually cloned and this demo row agree on what they are.
    templateId: `assessment-${type.id}`,
    name: type.name,
    items,
    deletedAspects: [],
    mode,
    setting,
    initiatorName: "Jordan",
    counterpartyName: claimed ? "Sam" : null,
    initiatorAnswers: initiatorSubmitted ? sheet.initiator : {},
    counterpartyAnswers: counterpartySubmitted ? sheet.counterparty : {},
    initiatorSubmitted,
    counterpartySubmitted,
    initiatorAccepted: complete,
    counterpartyAccepted: complete,
    initiatorAcceptedAt,
    counterpartyAcceptedAt,
    inviteToken: `inv-demo-${type.id}`,
    // Every eighth invite has lapsed against the demo clock; the rest have three days left. Both
    // invite states a list can print are reachable without waiting for a clock to move.
    inviteExpiresAt: stage === "invited" ? (index % 8 === 0 ? at(-48) : at(72)) : null,
    archivedAt: null,
    sharedWithCoach: index % 5 === 0,
    coachComments: [],
    comments: [],
    aspectComments: {},
    openedSessions: claimed ? 1 : 0,
    completedSessions: complete ? 1 : 0,
    subscription: subscriptionFor(index),
    history: [],
    lastSessionAt: complete ? counterpartyAcceptedAt : null,
    createdAt: at(-24 * (index + 12)),
    modifiedAt: at(-(index + 1)),
  };
}

/* ------------------------------------------------------------------ *
 * The payload
 * ------------------------------------------------------------------ */

/** The flow slice exactly as `lib/v1/store.tsx` persists it. */
export interface PersistedDemoFlow {
  readonly version: number;
  readonly relationships: readonly V1Relationship[];
  readonly accounts: readonly V1Account[];
  readonly tickets: readonly V1Ticket[];
}

/** Every purchasable type's demo relationship, in catalogue order. */
export function demoRelationships(seed: number = DEMO_SEED): readonly V1Relationship[] {
  return purchasableRelationshipTypes.map((type, index) =>
    demoRelationship(type, index, demoRng(seed + index * 7919)),
  );
}

/**
 * The two tickets, derived from the demo rows so both `relationshipId`s resolve: a lapsed
 * invitation for the Service queue and one relationship waiting on its counterparty.
 */
function demoTickets(relationships: readonly V1Relationship[]): readonly V1Ticket[] {
  const invited = relationships.find((rel) => rel.counterpartyName === null);
  const waiting = relationships.find(
    (rel) => rel.counterpartyName !== null && !rel.counterpartySubmitted,
  );
  return [
    {
      id: "ticket-demo-invitation",
      kind: "invitation",
      subject: "Demo seat: the invitation has not been claimed",
      status: "open",
      relationshipId: invited?.id ?? null,
      accountId: null,
    },
    {
      id: "ticket-demo-stuck",
      kind: "stuck",
      subject: "Demo seat: the counterparty has not answered",
      status: "open",
      relationshipId: waiting?.id ?? null,
      accountId: null,
    },
  ];
}

/**
 * The complete store payload: the flow slice for `seed`. Deterministic — the same seed returns
 * the same JSON, byte for byte, which is what makes a printed report reproducible.
 */
export function demoSeed(seed: number = DEMO_SEED): PersistedDemoFlow {
  const relationships = demoRelationships(seed);
  return {
    version: SEED_VERSION,
    relationships,
    accounts: seedAccounts,
    tickets: demoTickets(relationships),
  };
}

/** `demoSeed()` serialised — the exact string the control writes under the flow key. */
export function demoSeedJson(seed: number = DEMO_SEED): string {
  return JSON.stringify(demoSeed(seed));
}

/**
 * Write the demo flow into the store `storage` belongs to and report how many relationships were
 * written. The caller reloads: the store reads this key once, on hydration, so a live context
 * would otherwise keep the rows it already has.
 *
 * Returns the count rather than the payload so the control has something true to say without
 * re-deriving it.
 */
export function installDemoSeed(
  storage: Pick<Storage, "setItem">,
  seed: number = DEMO_SEED,
): number {
  const payload = demoSeed(seed);
  storage.setItem(DEMO_FLOW_STORAGE_KEY, JSON.stringify(payload));
  return payload.relationships.length;
}
