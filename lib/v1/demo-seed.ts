/**
 * lib/v1/demo-seed.ts — the deterministic demo generator for the `/v1` prototype.
 *
 * A QA tool, not content. It builds **one relationship per purchasable catalogue type**, spread
 * across the four Stages, both Modes and both Settings, from a seeded PRNG written here — no
 * dependency, no clock at generation time, no `Date.now()` anywhere — so the same seed produces
 * the same Gaps on every run and a report a reviewer saw is a report they can get back.
 *
 * Four things the generator guarantees, because they are what makes a review possible:
 *
 *   - **every purchasable type appears**, read from `purchasableRelationshipTypes` at call time,
 *     so a taxonomy change moves the demo set with it instead of leaving a stale count here;
 *   - **every Stage appears**, and each for the reason it exists: `invited` is an unclaimed
 *     invite, `connected` is a claimed seat whose sheet is unaccepted (the blank sheet a
 *     first-time counterparty lands on, a half-finished sheet, and one both parties answered but
 *     never accepted — the row a report must print `—` for), `sharing` is a complete sheet with
 *     an unmet Gap, and `aligned` is a complete sheet inside its Setting. Stages are **not
 *     stored**: they fall out of the accept/submit facts, exactly as `content/stages.ts` derives
 *     them, so the demo cannot claim a stage its rows do not support;
 *   - **the Gap distribution is deliberate, not incidental**: In Synch is a seventh of every
 *     comparison rather than most of them (measured at 14.4% of 556), so a seeded report has
 *     something to read, while one relationship is In Synch on **every** Gap (the zero end,
 *     which must still render honestly) and the widest Gap (4) is present in the set;
 *   - **some rows are unscored on purpose** — `invited` and `connected` rows have not completed
 *     a session, so a surface must print `—`, never `0`, and this set proves it;
 *   - **a completed row carries the Steps its answers derive** — the completed rows store
 *     `storedStepsOf(row)`, the same helper the fixtures use, which is `content/steps.ts`'
 *     derivation (one Step per Aspect, from that Aspect's widest Gap, dated at the completion).
 *     Never a hand-written list, so the Steps panel has something to render on a fresh store
 *     instead of requiring a reviewer to play two sheets by hand.
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
  storedStepsOf,
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

/* ------------------------------------------------------------------ *
 * The plan — what each row is, before a single score is drawn
 * ------------------------------------------------------------------ */

/**
 * What a demo row has answered. The Stage is derived from these facts rather than stored, so
 * this is the only place the demo decides **what state a row is in**:
 *
 *   none       nothing answered, nothing submitted (`invited`, and `connected` at its blankest)
 *   half       the Initiator submitted, the Counterparty has not (`connected`, one side part-way)
 *   submitted  both submitted, neither accepted (`connected`, and the `—` rule's test case)
 *   scored     both submitted and both accepted (`sharing` or `aligned`, depending on the Gaps)
 */
type DemoSheet = "none" | "half" | "submitted" | "scored";

/** One slot in the plan: the Stage it must derive to, and what it has answered to get there. */
interface DemoPlanEntry {
  readonly stage: RelationshipStage;
  readonly sheet: DemoSheet;
  /** Overrides the index-derived Setting where the Stage depends on it (`aligned`). */
  readonly setting?: AlignmentSetting;
}

/**
 * The plan, one entry per catalogue slot.
 *
 * Written out rather than derived from `index % n` because the **mix** is the point: a demo set
 * of mostly-`aligned` rows is a wall of In Synch, and a set with no `connected` row never shows
 * a reviewer the state a first-time counterparty lands in. The table is the argument.
 *
 *   invited            4   an unclaimed invite, no party and no answers
 *   connected          6   two blank sheets (the state a first-time counterparty lands on),
 *                          two half-finished, two answered-but-never-accepted
 *   sharing           15   the bulk, so a report has something to read
 *   aligned            2   one Full (every Gap 0 — the In Synch end) and one Soft (every Gap 1)
 */
const PLAN: readonly DemoPlanEntry[] = [
  { stage: "invited", sheet: "none" },
  { stage: "connected", sheet: "none" },
  { stage: "sharing", sheet: "scored" },
  { stage: "sharing", sheet: "scored" },
  { stage: "sharing", sheet: "scored" },
  { stage: "aligned", sheet: "scored", setting: "full" },
  { stage: "connected", sheet: "submitted" },
  { stage: "invited", sheet: "none" },
  { stage: "sharing", sheet: "scored" },
  { stage: "sharing", sheet: "scored" },
  { stage: "connected", sheet: "half" },
  { stage: "sharing", sheet: "scored" },
  { stage: "sharing", sheet: "scored" },
  { stage: "aligned", sheet: "scored", setting: "soft" },
  { stage: "sharing", sheet: "scored" },
  { stage: "connected", sheet: "none" },
  { stage: "sharing", sheet: "scored" },
  { stage: "invited", sheet: "none" },
  { stage: "sharing", sheet: "scored" },
  { stage: "sharing", sheet: "scored" },
  { stage: "connected", sheet: "submitted" },
  { stage: "sharing", sheet: "scored" },
  { stage: "sharing", sheet: "scored" },
  { stage: "invited", sheet: "none" },
  { stage: "sharing", sheet: "scored" },
  { stage: "connected", sheet: "half" },
  { stage: "sharing", sheet: "scored" },
];

/**
 * The share of a scored row's **Aspects** that are wholly In Synch — every one of the eight Gap
 * kinds at 0. Counted in Aspects rather than Gaps so the density is the same in both Modes: a
 * Basic Aspect carries four kinds and an Advanced one eight, so one In Synch Aspect out of five
 * is 20% of a Basic sheet and 20% of an Advanced one.
 *
 * Deliberately low. A set where most comparisons are 0 cannot answer "does the report read well
 * when there is something to see", which is the only question a seeded demo is asked.
 */
const INSYNCH_SHARE = 0.1;

/**
 * The magnitudes a gapped Aspect's cross-party and prediction Gaps take, walked per row so the
 * set spreads across the whole 1..4 band — the widest Gap (4) included, in both Modes.
 */
const MAGNITUDE_PLAN = [4, 3, 2, 1] as const;

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
 * Aspects — every Gap is placed, never left to coincidence
 * ------------------------------------------------------------------ */

/** One Aspect's two sheets, both parties' opinions keyed by opinion kind. */
interface AspectSheets {
  readonly initiator: Opinions;
  readonly counterparty: Opinions;
}

/**
 * An Aspect in which **every Gap is exactly `magnitude`**.
 *
 * The construction is the reason the demo's histogram is a property of the plan instead of a
 * roll of the dice. With the Initiator at `x` for Feel and `x + m` for Wish, and the
 * Counterparty mirrored, all four Basic kinds land on `m` — cross-party Feel and Wish by
 * construction, and each party's own Feel-against-Wish because the two are `m` apart — and each
 * prediction is `m` from what the other party actually answered. `m = 0` is the In Synch
 * Aspect: every one of the eight kinds at 0.
 *
 * The free score (`x`) still comes from the row's stream, so the *scores* vary between rows and
 * seeds while the *Gaps* stay on plan — which is what makes the distribution assertable.
 */
function uniformAspect(magnitude: number, mode: AssessmentMode, rng: () => number): AspectSheets {
  // 1..(5 - magnitude): every score stays on the model's 1..5 band, both ends included.
  const x = 1 + Math.floor(rng() * (5 - magnitude));
  const initiator: Opinions =
    mode === "basic"
      ? { feel: x, wish: x + magnitude }
      : { feel: x, wish: x + magnitude, think: x, guess: x + magnitude };
  const counterparty: Opinions =
    mode === "basic"
      ? { feel: x + magnitude, wish: x }
      : { feel: x + magnitude, wish: x, think: x + magnitude, guess: x };
  return { initiator, counterparty };
}

/**
 * An Aspect whose cross-party and prediction Gaps are exactly `primary` and whose two
 * own-party Gaps (each party's Feel against their own Wish) are exactly `own`. Both are at
 * least 1, so the Aspect carries **no zero** — the alternative to `uniformAspect`'s deliberate
 * In Synch, and the reason a gapped sheet reads as varied rather than as one number repeated.
 *
 * `primary + own` must leave room on the 1..5 band; `gappedSheet` only ever passes pairs that
 * do, and the assertion is the free score's own range.
 */
function twoTierAspect(
  primary: number,
  own: number,
  mode: AssessmentMode,
  rng: () => number,
): AspectSheets {
  const x = 1 + Math.floor(rng() * (5 - primary - own));
  const initiator: Opinions =
    mode === "basic"
      ? { feel: x, wish: x + own }
      : { feel: x, wish: x + own, think: x, guess: x + own };
  const counterparty: Opinions =
    mode === "basic"
      ? { feel: x + primary, wish: x + own + primary }
      : {
          feel: x + primary,
          wish: x + own + primary,
          think: x + primary,
          guess: x + own + primary,
        };
  return { initiator, counterparty };
}

/** Both parties' answers to every Aspect of a relationship, keyed by Aspect id. */
interface Sheet {
  readonly initiator: Readonly<Record<string, Opinions>>;
  readonly counterparty: Readonly<Record<string, Opinions>>;
}

/** The empty sheet an unclaimed or unanswered row carries. */
const EMPTY_SHEET: Sheet = { initiator: {}, counterparty: {} };

/**
 * A scored row's sheet: `inSynchCount` of its Aspects are In Synch (every Gap 0) and the rest
 * carry a `primary` Gap drawn from `MAGNITUDE_PLAN` and an `own` Gap of 1..3.
 *
 * The In Synch Aspects are spread through the row rather than stacked at the front, so a report
 * shows them where a reader would look for them instead of in one block.
 */
function gappedSheet(
  items: readonly { readonly id: string }[],
  mode: AssessmentMode,
  rowIndex: number,
  inSynchCount: number,
  rng: () => number,
): Sheet {
  const total = items.length;
  const inSynch = new Set<number>();
  for (let slot = 0; slot < inSynchCount; slot += 1) {
    inSynch.add(Math.min(total - 1, Math.floor(((slot + 1) * total) / (inSynchCount + 1))));
  }

  const initiator: Record<string, Opinions> = {};
  const counterparty: Record<string, Opinions> = {};
  items.forEach((item, aspectIndex) => {
    let sheets: AspectSheets;
    if (inSynch.has(aspectIndex)) {
      sheets = uniformAspect(0, mode, rng);
    } else {
      const primary = MAGNITUDE_PLAN[(aspectIndex + rowIndex) % MAGNITUDE_PLAN.length];
      // The widest Gap pins both score pairs to 1-and-5, so the only non-zero own Gap it can
      // carry is 4 itself: the Aspect is uniform rather than two-tier.
      if (primary === 4) {
        sheets = uniformAspect(primary, mode, rng);
      } else {
        // 1..(4 - primary), never 0: a gapped Aspect contributes no zero, and `primary + own`
        // always leaves a free score on the model's 1..5 band.
        const own = 1 + ((aspectIndex + rowIndex) % (4 - primary));
        sheets = twoTierAspect(primary, own, mode, rng);
      }
    }
    initiator[item.id] = sheets.initiator;
    counterparty[item.id] = sheets.counterparty;
  });
  return { initiator, counterparty };
}

/**
 * A sheet in which **every** Aspect's every Gap is `magnitude` — the two `aligned` ends: 0 is
 * the Full Setting's In Synch relationship, 1 is the Soft Setting's, where every Gap meets the
 * tolerance and nothing is In Synch.
 */
function flatSheet(
  items: readonly { readonly id: string }[],
  mode: AssessmentMode,
  magnitude: number,
  rng: () => number,
): Sheet {
  const initiator: Record<string, Opinions> = {};
  const counterparty: Record<string, Opinions> = {};
  for (const item of items) {
    const sheets = uniformAspect(magnitude, mode, rng);
    initiator[item.id] = sheets.initiator;
    counterparty[item.id] = sheets.counterparty;
  }
  return { initiator, counterparty };
}

/* ------------------------------------------------------------------ *
 * The plan derived from an index
 * ------------------------------------------------------------------ */

/** The plan entry for a catalogue slot, cycled when the catalogue outgrows the table. */
function planFor(index: number): DemoPlanEntry {
  return PLAN[index % PLAN.length];
}

/** The Mode a slot plays: alternating, so both Modes run through every Stage. */
function modeFor(index: number): AssessmentMode {
  return index % 2 === 0 ? "basic" : "advanced";
}

/**
 * The Setting a slot plays. The plan names one for the `aligned` rows, because their Stage
 * depends on it (a Full row cannot be aligned with a Gap of 1, and a Soft row must not be
 * mistaken for In Synch); every other row takes the index rotation, so both Settings run
 * through the scored set.
 */
function settingFor(index: number): AlignmentSetting {
  return planFor(index).setting ?? (index % 3 === 0 ? "soft" : "full");
}

/**
 * How many of each row's Aspects are In Synch.
 *
 * A fractional accumulator walks the scored Aspects in catalogue order at `INSYNCH_SHARE`, so
 * the zero density is a property of the plan rather than of a particular row — and a catalogue
 * that grows or shrinks moves the count with it instead of drifting the histogram. The one row
 * the plan marks Full-and-aligned is In Synch on **every** Aspect by definition: it *is* the
 * zero end of the range, so it is not subject to the share.
 */
function inSynchCounts(aspectCounts: readonly number[]): number[] {
  const counts = aspectCounts.map(() => 0);
  let carry = 0;
  aspectCounts.forEach((aspectCount, index) => {
    if (planFor(index).sheet !== "scored") return;
    carry += aspectCount * INSYNCH_SHARE;
    counts[index] = Math.floor(carry);
    carry -= counts[index];
  });
  aspectCounts.forEach((aspectCount, index) => {
    const plan = planFor(index);
    if (plan.stage === "aligned" && settingFor(index) === "full") {
      counts[index] = aspectCount;
    }
  });
  return counts;
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
 * `content/stages.ts` derives it — an unclaimed invite is `invited`, a claimed seat without both
 * acceptances is `connected`, and an accepted sheet is `sharing` or `aligned` depending on
 * whether its Gaps meet the Setting.
 */
function demoRelationship(
  type: RelationshipType,
  index: number,
  inSynchCount: number,
  rng: () => number,
): V1Relationship {
  const plan = planFor(index);
  const mode = modeFor(index);
  const setting = settingFor(index);
  const items = aspectsOf(type);

  const stage = plan.stage;
  const scored = plan.sheet === "scored";
  const answersBoth = plan.sheet === "submitted" || scored;
  const answersInitiator = answersBoth || plan.sheet === "half";

  // The sheet itself: a scored row is Either flat (the two `aligned` ends) or gapped with the
  // planned In Synch Aspects. The unanswered rows carry nothing — there is no sheet to fabricate,
  // which is what makes `—` the honest render for them.
  let sheet: Sheet = EMPTY_SHEET;
  if (scored) {
    sheet =
      stage === "aligned"
        ? flatSheet(items, mode, setting === "soft" ? 1 : 0, rng)
        : gappedSheet(items, mode, index, inSynchCount, rng);
  } else if (answersBoth) {
    sheet = gappedSheet(items, mode, index, inSynchCount, rng);
  } else if (answersInitiator) {
    // A half-finished row: the Initiator's side exists, the Counterparty's does not. No Aspect
    // has two answers, so no Gap is measurable — the row must render as part-way, never scored.
    const half = gappedSheet(items, mode, index, inSynchCount, rng);
    sheet = { initiator: half.initiator, counterparty: {} };
  }

  const initiatorSubmitted = answersInitiator;
  const counterpartySubmitted = answersBoth;
  const complete = scored;

  const id = `rel-demo-${type.id}`;
  const initiatorAcceptedAt = complete ? at(-(index % 9) - 2) : null;
  const counterpartyAcceptedAt = complete ? at(-(index % 9) - 1) : null;
  const claimed = stage !== "invited";

  const row: Omit<V1Relationship, "steps" | "inviteeName"> = {
    id,
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
    initiatorAnswers: answersInitiator ? sheet.initiator : {},
    counterpartyAnswers: answersBoth ? sheet.counterparty : {},
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

  return {
    ...row,
    // No generated row came through the create entry, so no demo relationship carries a seat named
    // at creation — the same statement `data/v1/fixtures.ts` makes about its own seed rows.
    inviteeName: null,
    // A Step is derived at completion and then stored, so a completed demo row holds exactly the
    // rows its own answers produce; an invited or connected one holds none. The rule is
    // `storedStepsOf`, which the fixtures use too — one derivation, not two.
    steps: storedStepsOf(row),
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
  const inSynch = inSynchCounts(purchasableRelationshipTypes.map((type) => type.aspects.length));
  return purchasableRelationshipTypes.map((type, index) =>
    demoRelationship(type, index, inSynch[index], demoRng(seed + index * 7919)),
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
