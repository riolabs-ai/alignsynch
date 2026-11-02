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
 *
 * ## The richer set (issue #415)
 *
 * A seeded store that only proves the model is not yet a demo: one name on both sides, one
 * subscription state, and empty threads. This module therefore also spreads the set over
 * **named parties** (`PARTY_NAMES`), writes the **chat** the surfaces read (a relationship's
 * `comments`, its `aspectComments` and the coach's `coachComments` — the store's own records, never
 * a second message store), and returns the **social slice** `lib/v1/store.tsx` persists
 * (`notifications` + the chat read watermarks) so the bell and the conversation list open with
 * content. Nothing here is a new shape: every value is a field the real schema already has, and
 * every claim is derived from a row the store holds:
 *
 *   - **parties** — the demo seats stay populated, because `relationshipsVisibleTo` scopes by name:
 *     `Jordan` owns the first row of every Stage and `Sam` is the counterparty of the first
 *     *claimed* row of every Stage, so each persona's list spans the ladder; the rest of the set
 *     rotates over `PARTY_NAMES`, so every named person is in more than one relationship;
 *   - **subscriptions** — `active`, `past_due` and `lapsed` all appear, plus the unsubscribed
 *     `null` the checkout exists to leave. A payment row records what was paid for the period that
 *     started; nothing sums them, and no total is written anywhere;
 *   - **chat** — only on rows that support it: a relationship thread after the session completes,
 *     an Aspect thread for the discussion that a blind session explicitly allows. Every message is
 *     a comment record, so `inventedMessagesOf` finds nothing;
 *   - **notifications** — the four events the product emits, dated from a stored instant on the row
 *     they describe (`unlockedAtOf`, a comment's `at`, a failed renewal's `periodEnd`), never a
 *     synthesized one. Each is delivered to a persona that can actually open its link;
 *   - **read state** — a few threads carry an unread tail so the chat list and the bell have
 *     something to count; the rest read as already read, which is what an absent watermark means.
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
  type Persona,
  type SubscriptionPlan,
  type SubscriptionStatus,
  type V1Account,
  type V1Comment,
  type V1Relationship,
  type V1ThreadReadAt,
  type V1Ticket,
} from "@/data/v1/fixtures";
import type { V1Notification } from "@/data/v1/notifications";
import { sessionCompleteOf, unlockedAtOf } from "@/lib/v1/derive";
import { relationshipsVisibleTo } from "@/lib/v1/persona";

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
 * The key `lib/v1/store.tsx` persists its **social** slice under — the notifications with their
 * read flags, and the chat read watermarks. Same control as the flow key above: the store keeps
 * `SOCIAL_STORAGE_KEY` private, so the literal lives here and the test reads the store's source to
 * prove the two strings are one. Without that check a seeded bell would write a payload no bell
 * reads, and the failure would look like "the seed has no notifications".
 */
export const DEMO_SOCIAL_STORAGE_KEY = "alignsynch.v1.social.v1";

/* ------------------------------------------------------------------ *
 * The parties — the people the set is between
 * ------------------------------------------------------------------ */

/**
 * The named people the demo relationships are between.
 *
 * The store scopes by **name**, not by account (`relationshipsVisibleTo`): the initiator persona
 * sees the rows it is the initiator of, the counterparty the rows it was named in. So the roster
 * cannot simply spread every row over strangers — that would empty both personas' dashboards.
 * Each list keeps its anchors (the first row of every Stage is Jordan's, the first claimed row of
 * every Stage is Sam's) and the rest of the set rotates over the roster, which is what makes this a
 * directory of parties rather than one pair repeated across the set.
 *
 * `PERSONA_META` fixes the two names the personas read: Jordan (initiator) and Sam (counterparty).
 * The two pools are disjoint so a person is never their own counterparty, and every name here
 * folds to a distinct handle (`personaHandle`'s rule: lowercase, hyphen between name and surname),
 * which is what the profile cover and the avatar are drawn from.
 */
const OWNER_NAMES = ["Jordan", "Avery", "Noor"] as const;
const COUNTERPARTY_NAMES = ["Sam", "Ruth", "Iris", "Rowan", "Maya", "Theo", "Priya"] as const;

/** Every named person the demo names, in a fixed order — the openers are the two demo seats. */
const PARTY_NAMES: readonly string[] = [...new Set([...OWNER_NAMES, ...COUNTERPARTY_NAMES])];

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
 *
 * The table is one pass over the catalogue (`DEMO_TYPE_COUNT` entries), and `planFor` cycles it —
 * so a set of `types × DEMO_ROWS_PER_TYPE` rows plays this exact mix once per copy instead of
 * re-weighting toward the top of the table.
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

/** An ISO instant `minutes` after another instant — a message that follows the event it answers. */
function after(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * 60_000).toISOString();
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

/* ------------------------------------------------------------------ *
 * Who the row is between
 * ------------------------------------------------------------------ */

/** The two names on one row: the initiator's, and the counterparty's (null while unclaimed). */
interface PartyPair {
  readonly owner: string;
  readonly counterparty: string | null;
}

/**
 * The names for every slot, in catalogue order — `DEMO_ROWS_PER_TYPE` passes over the catalogue.
 *
 * Two rules, both there so a persona's dashboard is populated rather than merely present:
 *
 *   - the **first** slot of each Stage is owned by `Jordan` and, when claimed, named `Sam` — the
 *     two names `PERSONA_META` gives the initiator and counterparty personas. That is what keeps
 *     every Stage reachable on both lists without storing a Stage anywhere;
 *   - every other slot rotates over the roster, one name per claimed row, so each named person is
 *     in more than one relationship and the set reads as a directory rather than one pair.
 *
 * Owners rotate on odd/even index rather than on the claim count so an unclaimed row still has an
 * initiator (it always does — a seat exists before the invitation is claimed).
 */
function partyPairs(count: number): PartyPair[] {
  const anchors = new Set<string>();
  let claimedPosition = 0;
  const pairs: PartyPair[] = [];
  for (let index = 0; index < count; index += 1) {
    const stage = planFor(index).stage;
    const claimed = stage !== "invited";
    const anchor = !anchors.has(stage);
    anchors.add(stage);
    // Which copy of this type the slot is, and where in the catalogue it sits — the two numbers
    // that keep a type's second row from restating its first. The rotation below is phased per
    // copy (`slot % 3 === copy % 3`), so the rows the demo's own initiator owns are a different
    // third of the catalogue in each copy: without that phase, a type whose first row is an
    // unclaimed invite would get a second one from the same person, with no counterparty to tell
    // the two apart in a list.
    const copy = Math.floor(index / DEMO_TYPE_COUNT);
    const slot = index % DEMO_TYPE_COUNT;
    // `anchor || slot % 3 === copy % 3` is a grouped condition, not a chained ternary: the first row
    // of each Stage and the copy's own third belong to the demo's initiator.
    const owner = anchor || slot % 3 === copy % 3 ? OWNER_NAMES[0] : OWNER_NAMES[1 + (index % 2)];
    let counterparty: string | null = null;
    if (claimed) {
      counterparty = anchor
        ? COUNTERPARTY_NAMES[0]
        : COUNTERPARTY_NAMES[claimedPosition % COUNTERPARTY_NAMES.length];
      claimedPosition += 1;
    }
    pairs.push({ owner, counterparty });
  }
  return pairs;
}

/* ------------------------------------------------------------------ *
 * The subscription — what was paid, and the state it is in
 * ------------------------------------------------------------------ */

/** The days one paid period covers, per plan — the price's own period, not a rounded guess. */
const PLAN_PERIOD_DAYS: Readonly<Record<SubscriptionPlan, number>> = {
  monthly: 30,
  quarterly: 90,
};

/**
 * Which state a slot's subscription is in, or `null` for the unsubscribed row.
 *
 * All four states a surface can print are reachable, because a demo with one state hides the
 * interesting case: `past_due` is the renewal that did not clear, and `lapsed` is the one that
 * blocks a new session (the store says so, `requestNewSession`). The unsubscribed `null` stays
 * too — it is the state the checkout exists to leave, and a shop with no unsubscribed row cannot
 * show its own primary action.
 */
function subscriptionStatusFor(index: number): SubscriptionStatus | null {
  if (index % 7 === 6) return null;
  if (index % 11 === 3) return "past_due";
  if (index % 13 === 5) return "lapsed";
  return "active";
}

/**
 * The one subscription each demo relationship may carry, mocked and never charged: one payment
 * for the period it **started** — the amount the plan costs, in integer cents. That payment record
 * is what was paid; nothing here totals the history, and no field states a lifetime figure.
 *
 * The dates are chosen from the state rather than the other way round, so the state is true of
 * the dates: an `active` row started inside its current period and ends in the future, a
 * `past_due` one is a few days past its renewal, and a `lapsed` one ended ten days ago.
 */
function subscriptionFor(index: number): V1Relationship["subscription"] {
  const status = subscriptionStatusFor(index);
  if (status === null) return null;

  const plan: SubscriptionPlan = index % 2 === 0 ? "monthly" : "quarterly";
  const periodHours = PLAN_PERIOD_DAYS[plan] * 24;
  // Hours before the demo clock that the paid period began.
  const startedHoursAgo =
    status === "active"
      ? 24 * (10 + (index % 5)) + index
      : status === "past_due"
        ? periodHours + 24 * 3 + index
        : periodHours + 24 * 10 + index;

  const startedAt = at(-startedHoursAgo);
  return {
    plan,
    status,
    periodEnd: at(-startedHoursAgo + periodHours),
    startedAt,
    payments: [
      {
        id: `pay-demo-${index + 1}`,
        plan,
        amountCents: plan === "monthly" ? RELATIONSHIP_PRICE_CENTS : RELATIONSHIP_PRICE_CENTS * 3,
        paidAt: startedAt,
      },
    ],
  };
}

/* ------------------------------------------------------------------ *
 * The chat — comment records, because that is the only message shape
 * ------------------------------------------------------------------ */

/**
 * The lines two people exchange after a session. A fixed, rotated set rather than free prose: the
 * point of seeded chat is that the thread renders with content, and a rotation keeps the bodies
 * stable under the same seed without pretending to be a transcript of a real conversation.
 *
 * The words are deliberately about the report and the next conversation — never about a score
 * value, so a message can never leak what the other party answered.
 */
const THREAD_LINES = [
  "The report is up. The priorities Aspect is the one I want to talk about first.",
  "Same read on my side — I think we were answering two slightly different questions.",
  "That helps. Let's take one of the Steps to Saturday and leave the rest for now.",
  "Works for me. I have added it to the calendar so it does not get pushed again.",
  "Thank you for doing this properly. It reads fair, which is what I wanted from it.",
] as const;

/** The coach's note on a shared row — advice, dated after the session it comments on. */
const COACH_NOTE =
  "You each picked a different Aspect as the urgent one. Before the next session, agree which " +
  "one you are actually working on, so the Steps do not compete.";

/** One message record, authored by a party the schema allows. */
function commentAt(
  id: string,
  author: "initiator" | "counterparty",
  body: string,
  at_: string,
): V1Comment {
  return { id, author, body, at: at_ };
}

/**
 * The chat one row carries.
 *
 * Gated by what the row supports, not by what would look busy:
 *
 *   - **the relationship thread** opens when the session completes (`comments`, in the schema's own
 *     words), so only a completed row carries one — three messages, alternating authors, dated
 *     after the instant the report unlocked;
 *   - **an Aspect thread** is the discussion a *blind* session explicitly allows, so a completed
 *     row and one connected row carry one too: two messages on the row's first Aspect;
 *   - **the coach's note** lands only on a row actually shared with the coach, and only on the
 *     relationship thread (the store refuses an Aspect note from a coach).
 *
 * Every instant here is derived from the row's own acceptance instant or the demo clock, never from
 * the run.
 */
function chatFor(
  index: number,
  items: V1Relationship["items"],
  unlockedAt: string | null,
  claimed: boolean,
  sharedWithCoach: boolean,
): Pick<V1Relationship, "comments" | "aspectComments" | "coachComments"> {
  const comments: V1Comment[] = [];
  const aspectComments: Record<string, V1Comment[]> = {};
  const coachComments: V1Relationship["coachComments"] = [];

  if (unlockedAt !== null) {
    const first: "initiator" | "counterparty" = index % 2 === 0 ? "initiator" : "counterparty";
    const second = first === "initiator" ? "counterparty" : "initiator";
    const bodies = [0, 1, 2].map((offset) => THREAD_LINES[(index + offset) % THREAD_LINES.length]);
    // The offsets stay under the hour the acceptance instant is at most from the clock, so the
    // newest message is always in the past — a thread dated after `DEMO_NOW_ISO` would render as a
    // message from the future.
    comments.push(
      commentAt(`cmt-demo-${index + 1}-1`, first, bodies[0], after(unlockedAt, 12)),
      commentAt(`cmt-demo-${index + 1}-2`, second, bodies[1], after(unlockedAt, 24)),
      commentAt(`cmt-demo-${index + 1}-3`, first, bodies[2], after(unlockedAt, 36)),
    );
  }

  // A blind row may still discuss the Aspect — the rule is that no *answer* may appear there, and
  // a comment record has no field an answer could occupy (`chat.ts` states the same rule). It still
  // takes two parties: an unclaimed invite has nobody to reply, so an invited row carries nothing.
  const aspectTarget = items[0];
  if (claimed && aspectTarget !== undefined && (unlockedAt !== null || index % 4 === 1)) {
    const anchor = unlockedAt ?? at(-(index % 9) - 1);
    aspectComments[aspectTarget.id] = [
      commentAt(
        `cmt-demo-${index + 1}-a1`,
        "initiator",
        "On this one I would rather agree the process first than the outcome. How does it look from your side?",
        after(anchor, 6),
      ),
      commentAt(
        `cmt-demo-${index + 1}-a2`,
        "counterparty",
        "Same instinct, different detail — let's talk it through before we answer it again.",
        after(anchor, 18),
      ),
    ];
  }

  if (sharedWithCoach && unlockedAt !== null) {
    coachComments.push({
      id: `cmt-demo-${index + 1}-coach`,
      author: "coach",
      body: COACH_NOTE,
      at: after(unlockedAt, 45),
    });
  }

  return { comments, aspectComments, coachComments };
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
  copy: number,
  party: PartyPair,
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

  const id = copy === 0 ? `rel-demo-${type.id}` : `rel-demo-${type.id}-${copy + 1}`;
  const initiatorAcceptedAt = complete ? at(-(index % 9) - 2) : null;
  const counterpartyAcceptedAt = complete ? at(-(index % 9) - 1) : null;
  const claimed = stage !== "invited";
  // A third of the set is shared with the coach, because the coach persona's whole dashboard — its
  // list, its chat and its profile history — is exactly `relationshipsVisibleTo("coach")`. Sharing
  // five rows would leave that seat with one scoreable relationship and an empty conversation list.
  const sharedWithCoach = index % 3 === 0;

  // The chat is the store's own comment records, gated by what this row supports: a relationship
  // thread once the session completes, an Aspect thread where a blind session may discuss one,
  // and the coach's note only on a row actually shared with the coach.
  const chat = chatFor(index, items, counterpartyAcceptedAt, claimed, sharedWithCoach);

  // The row's last write is its newest child record, because a message and an acceptance are both
  // writes. The plain offset below is the floor; on a row past the ninth the session instant is
  // later than it, and a row whose last message is newer than its "last modified" would be a record
  // that contradicts itself on the admin registry's own column. ISO-8601 UTC instants compare
  // chronologically as strings, which is the same property `unlockedAtOf` relies on.
  let lastWriteAt = at(-(index + 1));
  for (const instant of [
    ...(counterpartyAcceptedAt === null ? [] : [counterpartyAcceptedAt]),
    ...chat.comments.map((comment) => comment.at),
    ...Object.values(chat.aspectComments)
      .flat()
      .map((comment) => comment.at),
    ...chat.coachComments.map((comment) => comment.at),
  ]) {
    if (instant > lastWriteAt) lastWriteAt = instant;
  }

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
    initiatorName: party.owner,
    counterpartyName: party.counterparty,
    initiatorAnswers: answersInitiator ? sheet.initiator : {},
    counterpartyAnswers: answersBoth ? sheet.counterparty : {},
    initiatorSubmitted,
    counterpartySubmitted,
    initiatorAccepted: complete,
    counterpartyAccepted: complete,
    initiatorAcceptedAt,
    counterpartyAcceptedAt,
    inviteToken: copy === 0 ? `inv-demo-${type.id}` : `inv-demo-${type.id}-${copy + 1}`,
    // Every eighth invite has lapsed against the demo clock; the rest have three days left. Both
    // invite states a list can print are reachable without waiting for a clock to move.
    inviteExpiresAt: stage === "invited" ? (index % 8 === 0 ? at(-48) : at(72)) : null,
    archivedAt: null,
    sharedWithCoach,
    ...chat,
    openedSessions: claimed ? 1 : 0,
    completedSessions: complete ? 1 : 0,
    subscription: subscriptionFor(index),
    history: [],
    lastSessionAt: complete ? counterpartyAcceptedAt : null,
    createdAt: at(-24 * (index + 12)),
    modifiedAt: lastWriteAt,
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

/**
 * How many demo relationships each purchasable type carries.
 *
 * The set used to be one row per type — 27 rows, a limit the /v1 dev panel asserted in its own
 * copy. A demo list of 27 rows is a list you scroll, not a list you search: the admin console and
 * the initiator's own list both read as a single screen of data.
 *
 * Two rows per type is the smallest count that stops reading as one-per-type, and it is the
 * cheapest count that keeps the **plan's** mix exact: `PLAN` holds 27 entries, so cycling it over
 * `types × 2` plays every entry twice and the Stage mix (4 / 6 / 15 / 2) doubles rather than
 * skewing. A count that is not a multiple of the plan would silently re-weight the set toward the
 * front of the table — more invites and blanks, fewer scored rows.
 *
 * The first copy of every type keeps the row id it always had (`rel-demo-<type>`), so a link or a
 * test naming one seeded row still resolves; the extra copies take `-2`. Nothing else about a row
 * is derived from this number: the plan, the parties, the subscription state and the chat are all
 * indexed, so the additional rows fall out of the same rules.
 */
export const DEMO_ROWS_PER_TYPE = 2;

/** The catalogue's purchasable types — what the dev panel's sentence counts against. */
export const DEMO_TYPE_COUNT = purchasableRelationshipTypes.length;

/** How many relationships `demoRelationships()` returns, and what the seed writes. */
export const DEMO_ROW_COUNT = DEMO_TYPE_COUNT * DEMO_ROWS_PER_TYPE;

/** Every purchasable type's demo relationships, in catalogue order, `DEMO_ROWS_PER_TYPE` each. */
export function demoRelationships(seed: number = DEMO_SEED): readonly V1Relationship[] {
  // Catalogue order, repeated — so the first pass over the types is the set the demo has always
  // had, row for row, and the additional copies follow it rather than interleaving with it.
  const slots: {
    readonly index: number;
    readonly copy: number;
    readonly type: RelationshipType;
  }[] = [];
  for (let index = 0; index < DEMO_ROW_COUNT; index += 1) {
    const type = purchasableRelationshipTypes[index % DEMO_TYPE_COUNT];
    if (type === undefined) continue;
    slots.push({ index, copy: Math.floor(index / DEMO_TYPE_COUNT), type });
  }

  const inSynch = inSynchCounts(slots.map((slot) => slot.type.aspects.length));
  const parties = partyPairs(slots.length);
  return slots.map((slot, position) =>
    demoRelationship(
      slot.type,
      slot.index,
      slot.copy,
      parties[position] ?? { owner: OWNER_NAMES[0], counterparty: null },
      inSynch[position] ?? 0,
      demoRng(seed + slot.index * 7919),
    ),
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

/* ------------------------------------------------------------------ *
 * The people — one account per named party
 * ------------------------------------------------------------------ */

/**
 * One account per named person the set is between, for the whole roster.
 *
 * `seedAccounts` stays first and unchanged, and that order is load-bearing: those are the
 * prototype's **sign-in** identities, and `components/v1/settings/settings-view.tsx` resolves a
 * persona's own address with a `find`, so the account a persona signs in as must stay the first
 * match. What is added here is the other half of the Service queue — the members a real store
 * would hold, one per person a relationship in this set names. The account queue is the only
 * directory surface the prototype has, and a queue of five rows next to twenty-seven relationships
 * would read as a data bug rather than a demo.
 *
 * Every field is derived, none authored: `persona` is the role the person holds in the set (they
 * initiate, or they were invited), the address follows the fixture's `@example.com` convention,
 * `state` is `active` because the seeder has no evidence for any other state, and `lastSignInAt`
 * is the most recent write on a relationship they are party to — the only activity instant the
 * store carries.
 */
export function demoAccounts(relationships: readonly V1Relationship[]): readonly V1Account[] {
  const known = new Set(seedAccounts.map((account) => account.name));
  const accounts: V1Account[] = [];
  for (const name of PARTY_NAMES) {
    if (known.has(name)) continue;
    const partyTo = relationships.filter(
      (rel) => rel.initiatorName === name || rel.counterpartyName === name,
    );
    const earliest = partyTo[0];
    if (earliest === undefined) continue;
    let lastSignInAt = earliest.modifiedAt;
    for (const rel of partyTo) {
      if (rel.modifiedAt > lastSignInAt) lastSignInAt = rel.modifiedAt;
    }
    accounts.push({
      id: `account-demo-${name.toLowerCase()}`,
      persona: partyTo.some((rel) => rel.initiatorName === name) ? "initiator" : "counterparty",
      name,
      email: `${name.toLowerCase()}@example.com`,
      state: "active",
      lastSignInAt,
    });
  }
  return accounts;
}

/* ------------------------------------------------------------------ *
 * The social slice — the notifications and the chat read watermarks
 * ------------------------------------------------------------------ */

/** The four personas a notification can be delivered to — the same four `zV1Notification` allows. */
const NOTIFIED_PERSONAS = ["initiator", "counterparty", "coach", "admin"] as const;

type NotifiedPersona = (typeof NOTIFIED_PERSONAS)[number];

/**
 * How many notifications of **each event type** one persona's bell lists.
 *
 * A seeded bell has to show every kind of event the set can prove — an invite accepted, a session
 * scored, a reply, a payment that failed — because one kind repeated sixty times proves only that
 * the array is long. So the cap is per type and the mix is the point: the newest couple of each
 * kind, merged newest-first. That is also why the cap is not "the newest N rows", which on this set
 * would be a wall of `invite_accepted` (the claim instant is the row's last write) and would drop
 * every `payment_failed` (whose instant is a renewal that failed three days ago).
 */
const NOTIFICATIONS_PER_TYPE = 2;

/** The display name a relationship goes by: its own, else the type it copies. */
function displayNameOf(rel: V1Relationship): string {
  return rel.name ?? rel.templateId;
}

/** The /v1 destination a notification opens, per persona — the routes that actually exist. */
function notificationLink(
  persona: NotifiedPersona,
  rel: V1Relationship,
  kind: "relationship" | "chat",
): string {
  // The admin console nests its detail pages under `/v1/admin/console`, unlike the three
  // dashboards — a link that assumed the shared shape would 404 for the one persona that reads
  // every relationship.
  if (persona === "admin") {
    return kind === "chat"
      ? `/v1/admin/chat/${rel.id}`
      : `/v1/admin/console/relationships/${rel.id}`;
  }
  return kind === "chat"
    ? `/v1/${persona}/chat/${rel.id}`
    : `/v1/${persona}/relationships/${rel.id}`;
}

/**
 * Every notification this set can honestly emit, newest-first per persona and capped.
 *
 * The four types are the product's whole vocabulary (`data/v1/notifications.ts`), and each one is
 * dated from an instant the row actually stores rather than from a synthesized time:
 *
 *   - `session_scored` — the instant the report unlocked, `unlockedAtOf`;
 *   - `new_comment` — the comment's own `at`, delivered to the party who did not write it;
 *   - `payment_failed` — the failed renewal's `periodEnd`;
 *   - `invite_accepted` — the row's last write, because the store keeps no separate claim instant
 *     and inventing one would be inventing history.
 *
 * A candidate is only delivered to a persona that can **open** its link (`relationshipsVisibleTo`),
 * so no seeded notification leads to a relationship the reader cannot see. Nothing is emitted for
 * a row that has not earned it: no comment means no `new_comment`, and a subscription that is not
 * `past_due` means no `payment_failed`.
 */
function notificationCandidates(relationships: readonly V1Relationship[]): V1Notification[] {
  const visible = new Map<NotifiedPersona, ReadonlySet<string>>();
  for (const persona of NOTIFIED_PERSONAS) {
    visible.set(
      persona,
      new Set(relationshipsVisibleTo(persona, relationships).map((rel) => rel.id)),
    );
  }

  const candidates: V1Notification[] = [];
  const emit = (
    persona: NotifiedPersona,
    rel: V1Relationship,
    row: Omit<V1Notification, "id" | "persona" | "read" | "link">,
    kind: "relationship" | "chat",
  ) => {
    if (!visible.get(persona)?.has(rel.id)) return;
    candidates.push({
      id: `v1n-demo-${persona}-${rel.id}-${row.type}`,
      persona,
      link: notificationLink(persona, rel, kind),
      read: false,
      ...row,
    });
  };

  for (const rel of relationships) {
    const name = displayNameOf(rel);
    const counterparty = rel.counterpartyName;

    if (counterparty !== null) {
      // A claimed seat is an invite that was accepted; the row's last write is the claim.
      for (const persona of ["initiator", "admin"] as const) {
        emit(
          persona,
          rel,
          {
            type: "invite_accepted",
            title: "Invitation accepted",
            body:
              persona === "initiator"
                ? `${counterparty} accepted your invitation to ${name}.`
                : `${counterparty} accepted ${rel.initiatorName}'s invitation to ${name}.`,
            createdAt: rel.modifiedAt,
          },
          "relationship",
        );
      }
    }

    const unlockedAt = unlockedAtOf(rel);
    if (unlockedAt !== null && sessionCompleteOf(rel)) {
      for (const persona of ["initiator", "counterparty", "coach"] as const) {
        emit(
          persona,
          rel,
          {
            type: "session_scored",
            title: "Session scored",
            body:
              persona === "initiator"
                ? `Your session with ${counterparty ?? "the counterparty"} on ${name} is ready to review.`
                : persona === "counterparty"
                  ? `Your session with ${rel.initiatorName} on ${name} is ready to review.`
                  : `${rel.initiatorName} & ${counterparty ?? "their counterparty"}'s session on ${name} is scored and shared with you.`,
            createdAt: unlockedAt,
          },
          "relationship",
        );
      }
    }

    const lastComment = rel.comments[rel.comments.length - 1];
    if (lastComment !== undefined) {
      const recipient = lastComment.author === "initiator" ? "counterparty" : "initiator";
      const authorName = lastComment.author === "initiator" ? rel.initiatorName : counterparty;
      for (const persona of [recipient, "coach"] as const) {
        emit(
          persona,
          rel,
          {
            type: "new_comment",
            title: "New comment",
            body: `${authorName ?? "The other party"} replied on ${name}.`,
            createdAt: lastComment.at,
          },
          "chat",
        );
      }
    }

    const subscription = rel.subscription;
    if (subscription !== null && subscription.status === "past_due") {
      for (const persona of ["initiator", "admin"] as const) {
        emit(
          persona,
          rel,
          {
            type: "payment_failed",
            title: "Payment failed",
            body:
              persona === "initiator"
                ? `Your ${subscription.plan} payment for ${name} did not go through.`
                : `A subscription payment failed (${rel.initiatorName} & ${counterparty ?? "—"}, ${subscription.plan}).`,
            createdAt: subscription.periodEnd,
          },
          "relationship",
        );
      }
    }
  }

  return candidates;
}

/**
 * The seeded notifications: for each persona, the newest `NOTIFICATIONS_PER_TYPE` of every event
 * kind it can be delivered, merged newest-first.
 *
 * Read state is part of the seed for the same reason it is in the fixtures: a fresh store must
 * open with a believable mix, so the newer half of each persona's list is unread and the older half
 * is already read. The order is total (instant, then id) so two rows sharing an instant cannot swap
 * between runs and break the byte-identical seed.
 */
export function demoNotifications(
  relationships: readonly V1Relationship[],
): readonly V1Notification[] {
  const byPersona = new Map<NotifiedPersona, V1Notification[]>();
  for (const candidate of notificationCandidates(relationships)) {
    const bucket = byPersona.get(candidate.persona) ?? [];
    bucket.push(candidate);
    byPersona.set(candidate.persona, bucket);
  }

  const rows: V1Notification[] = [];
  for (const persona of NOTIFIED_PERSONAS) {
    const byType = new Map<V1Notification["type"], V1Notification[]>();
    for (const candidate of byPersona.get(persona) ?? []) {
      const bucket = byType.get(candidate.type) ?? [];
      bucket.push(candidate);
      byType.set(candidate.type, bucket);
    }

    const kept = [...byType.values()].flatMap((bucket) =>
      bucket
        .slice()
        .sort((a, b) =>
          a.createdAt === b.createdAt
            ? a.id.localeCompare(b.id)
            : b.createdAt.localeCompare(a.createdAt),
        )
        .slice(0, NOTIFICATIONS_PER_TYPE),
    );

    kept
      .sort((a, b) =>
        a.createdAt === b.createdAt
          ? a.id.localeCompare(b.id)
          : b.createdAt.localeCompare(a.createdAt),
      )
      .forEach((row, index) => {
        rows.push({ ...row, read: index >= kept.length / 2 });
      });
  }
  return rows;
}

/**
 * The chat read watermarks: per persona, the thread id to the instant they last read it.
 *
 * An absent watermark means "already read" (`unreadCountOf`), so the seed lists a thread at its
 * **last** message for most rows and at its **first** for every third thread a persona has
 * comments on — which leaves the later messages, all written by the other party, counted as
 * unread. That is the state a person returns to: a couple of threads with something waiting, the
 * rest read. The choice is counted per persona, so a seat that can see only a handful of rows (the
 * coach) still opens with an unread thread rather than a list of everything read. Every watermark
 * is a message's own instant, so the read state can never sit after a message that does not exist.
 */
export function demoThreadReadAt(relationships: readonly V1Relationship[]): V1ThreadReadAt {
  const readAt: Record<Persona, Record<string, string>> = {
    visitor: {},
    service: {},
    initiator: {},
    counterparty: {},
    coach: {},
    admin: {},
  };
  const seen = new Map<Persona, number>();

  for (const rel of relationships) {
    const first = rel.comments[0];
    const last = rel.comments[rel.comments.length - 1];
    if (first === undefined || last === undefined) continue;
    for (const persona of ["initiator", "counterparty", "coach"] as const) {
      if (relationshipsVisibleTo(persona, [rel]).length === 0) continue;
      const position = seen.get(persona) ?? 0;
      seen.set(persona, position + 1);
      readAt[persona][rel.id] = position % 3 === 0 ? first.at : last.at;
    }
  }

  return readAt;
}

/** The social slice exactly as `lib/v1/store.tsx` persists it. */
export interface PersistedDemoSocial {
  readonly version: number;
  readonly notifications: readonly V1Notification[];
  readonly threadReadAt: V1ThreadReadAt;
}

/**
 * The complete social slice for `seed`: the bell's rows and the chat's read watermarks.
 * Deterministic for the same reason the flow slice is.
 */
export function demoSocialSeed(seed: number = DEMO_SEED): PersistedDemoSocial {
  const relationships = demoRelationships(seed);
  return {
    version: SEED_VERSION,
    notifications: demoNotifications(relationships),
    threadReadAt: demoThreadReadAt(relationships),
  };
}

/** `demoSocialSeed()` serialised — the exact string the control writes under the social key. */
export function demoSocialJson(seed: number = DEMO_SEED): string {
  return JSON.stringify(demoSocialSeed(seed));
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
    accounts: [...seedAccounts, ...demoAccounts(relationships)],
    tickets: demoTickets(relationships),
  };
}

/** `demoSeed()` serialised — the exact string the control writes under the flow key. */
export function demoSeedJson(seed: number = DEMO_SEED): string {
  return JSON.stringify(demoSeed(seed));
}

/**
 * Write the demo store into the `storage` it is handed and report how many relationships were
 * written. The caller reloads: the store reads these keys once, on hydration, so a live context
 * would otherwise keep the rows it already has.
 *
 * Two keys, because the store persists two slices: the flow (relationships, accounts, tickets) and
 * the social slice (notifications + read watermarks). A seeder that wrote only the first would
 * leave the bell on the fixture's nine rows and the chat with no read state — the exact gap this
 * module exists to close.
 *
 * Returns the relationship count rather than the payload so the control has something true to say
 * without re-deriving it.
 */
export function installDemoSeed(
  storage: Pick<Storage, "setItem">,
  seed: number = DEMO_SEED,
): number {
  const payload = demoSeed(seed);
  storage.setItem(DEMO_FLOW_STORAGE_KEY, JSON.stringify(payload));
  storage.setItem(DEMO_SOCIAL_STORAGE_KEY, demoSocialJson(seed));
  return payload.relationships.length;
}
