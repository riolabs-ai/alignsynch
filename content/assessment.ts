/**
 * The assessment — the second template on the shared record (`content/record.ts`).
 *
 * A quiz and an assessment are both records; neither imports the other, both import
 * the record. What this template adds is the glossary's own vocabulary:
 *
 *   Aspect     an Item: "a characteristic or attribute of the Relationship worthy of
 *              Opinions, Values, and discussion."
 *   Value      two per Aspect — a Left Value (the low/left/min end, notch 1) and a
 *              Right Value (the high/right/max end, notch 5).
 *   Opinion    four per Aspect per party, each a score 1..5: Feel, Wish, Think, Guess.
 *   Mode       two — Basic asks Feel & Wish, Advanced asks all four. An instance
 *              **records** its mode (fixed at creation, checked below), so a Basic
 *              sheet and an Advanced one can never be compared by accident.
 *
 * A template holds Aspects and has no parties. An **instance** is a template copied
 * and given parties — the glossary's Create (Template > Relationship) — so the
 * opinions live on the instance, next to the copy of the Aspects they answer.
 *
 * The eight gap *types* — Feel, Wish, Initiator and Counterparty (Basic), plus Initiator
 * Think, Initiator Guess, Counterparty Think and Counterparty Guess (Advanced) — are
 * modelled in `content/gaps.ts`, one `gapOf` call per pair; the four prediction kinds
 * compare a party's Think or Guess against the **other** party's Feel or Wish, never
 * against that other party's prediction. This file stays the shape of the content and the
 * one Gap function it shares with every other record (`gapOf` in `content/record.ts`).
 * The **Setting** (Soft/Full) is modelled below — a per-instance lens over the Gaps, and
 * never a Gap of its own. The four **relationship** stages are derived in `content/stages.ts`;
 * the specification's A–D account states are a different ladder — billing, out of scope — and
 * the Coach is not modelled anywhere yet.
 */
import { z } from "zod";
import { zId, zIsoDateTime } from "./core";
import { zItem, zScore, zScoreScale, zTemplateObject, uniqueItemIds, type Gap } from "./record";

/* ------------------------------------------------------------------ *
 * Opinion — how a party answers one Aspect
 * ------------------------------------------------------------------ */

/**
 * The four opinion kinds, in the glossary's order. The word is the opinion's name,
 * not a mode: `feel` and `wish` are what Basic Mode asks, `think` and `guess` are
 * what Advanced Mode adds.
 */
export const zOpinionKind = z.enum(["feel", "wish", "think", "guess"]);

export type OpinionKind = z.infer<typeof zOpinionKind>;

export const OPINION_KINDS = zOpinionKind.options;

/** The glossary's own four words, authored once: "Feel", "Wish", "Think", "Guess". */
export const OPINION_LABELS: Record<OpinionKind, string> = {
  feel: "Feel",
  wish: "Wish",
  think: "Think",
  guess: "Guess",
};

/**
 * Each opinion's one-line definition — the product's words beside the name, so the answer sheet
 * and the report say what a kind means instead of leaving the word bare. `feel` is how the
 * Aspect is now, `wish` how it should be, `think` how the party predicts the other feels, and
 * `guess` how the party predicts the other wishes it.
 */
export const OPINION_DEFINITIONS: Record<OpinionKind, string> = {
  feel: "how it is now",
  wish: "how it should be",
  think: "how they predict the other feels",
  guess: "how they predict the other wishes",
};

/** Basic Mode: two opinions per Aspect per party. */
export const BASIC_OPINION_KINDS = ["feel", "wish"] as const;

/**
 * Advanced Mode adds the pair. A mode is 2, so it is never one of them alone: half of
 * Advanced is not a mode, and the refinement below rejects it.
 */
export const ADVANCED_OPINION_KINDS = ["think", "guess"] as const;

/**
 * The two modes an instance is played in. A mode is the **whole** play: Basic asks Feel
 * and Wish on every Aspect, Advanced asks all four. An instance is one mode, fixed at
 * creation — half of Advanced is not a mode, and neither is a sheet that switches.
 */
export const zAssessmentMode = z.enum(["basic", "advanced"]);

export type AssessmentMode = z.infer<typeof zAssessmentMode>;

export const ASSESSMENT_MODES = zAssessmentMode.options;

/** The opinion kinds a mode asks, in the glossary's order. */
export function opinionKindsFor(mode: AssessmentMode): readonly OpinionKind[] {
  return mode === "basic" ? BASIC_OPINION_KINDS : OPINION_KINDS;
}

/** The glossary's own two words, authored once in the model: "Basic Mode" / "Advanced Mode". */
export const MODE_LABELS: Record<AssessmentMode, string> = {
  basic: "Basic Mode",
  advanced: "Advanced Mode",
};

/* ------------------------------------------------------------------ *
 * Setting — how closely the parties want to Align
 * ------------------------------------------------------------------ */

/**
 * The **Setting**, in the glossary's own words (v2-01-01h, the Setting rows):
 *
 *   Setting   Qty 2 — "How closely you want to Align." Example List: "Small Gap (1) is
 *             OK, or not." The detail row: "Box in Relationship Maintenance that changes
 *             the requirement to be In Synch." Values: Soft or Full.
 *   Soft      "Small Gap (1) OK – a satisfactory Setting."
 *             (i.e. satisfactory, casual, lenient, acceptable, & generous)
 *   Full      "No Gap OK – an exceptional Setting."
 *             (i.e. exceptional, stellar, true, & complete)
 *
 * A setting is a **lens over the Gaps, never a Gap**: it decides what counts as aligned,
 * changes no number, and is not one of the eight gap kinds. The comparison that reads it
 * lives in `content/gaps.ts` (`gapMeetsSetting`, `instanceAlignment`), so the verdict is
 * derived from the opinion rows on every read and never stored — no `aligned` column,
 * exactly as there is no `gap` column.
 */
export const zAlignmentSetting = z.enum(["soft", "full"]);

export type AlignmentSetting = z.infer<typeof zAlignmentSetting>;

export const ALIGNMENT_SETTINGS = zAlignmentSetting.options;

/** The glossary's own two words, authored once: "Soft" / "Full". */
export const SETTING_LABELS: Record<AlignmentSetting, string> = {
  soft: "Soft",
  full: "Full",
};

/** Each setting's one-line glossary definition — the words a reader is owed beside the word. */
export const SETTING_DEFINITIONS: Record<AlignmentSetting, string> = {
  soft: "Small Gap (1) OK – a satisfactory Setting.",
  full: "No Gap OK – an exceptional Setting.",
};

/**
 * The widest Gap each setting tolerates: Soft is the glossary's "Small Gap (1) OK" — a Gap
 * of 1, the yellow Small Gap, while 2..4 are the Big Gaps; Full is "No Gap OK", so only In
 * Synch (0) passes. Thresholds, never columns: a stored tolerance could drift from the
 * arithmetic, a constant cannot.
 */
export const SETTING_GAP_LIMITS: Record<AlignmentSetting, Gap> = {
  soft: 1,
  full: 0,
};

/**
 * The setting a row that predates the column is read under. The glossary names no default;
 * Soft is the least-strict reading, and the only one that cannot retroactively mark a
 * relationship unmet that its parties never agreed to play by Full. Every fixture authors
 * its setting explicitly rather than leaning on this, and so does migration 0008.
 */
export const DEFAULT_ALIGNMENT_SETTING: AlignmentSetting = "soft";

/**
 * One party's opinions for one Aspect: two to four, each a score 1..5.
 *
 * Feel and Wish are required because Basic is the floor — every instance that was
 * ever played has them. Think and Guess are optional and come together. Modelling the
 * four as four named fields rather than a tag/value list is what makes "two to four"
 * and "no duplicates" unrepresentable-otherwise instead of invariants to check.
 */
export const zOpinionsObject = z
  .object({
    feel: zScore,
    wish: zScore,
    think: zScore.optional(),
    guess: zScore.optional(),
  })
  .strict();

export const zOpinions = zOpinionsObject.superRefine((opinions, ctx) => {
  const hasThink = opinions.think !== undefined;
  const hasGuess = opinions.guess !== undefined;
  if (hasThink !== hasGuess) {
    ctx.addIssue({
      code: "custom",
      path: [hasThink ? "guess" : "think"],
      message:
        "Think and Guess come together: Advanced Mode adds the pair, so one of them alone is not a mode",
    });
  }
});

export type Opinions = z.infer<typeof zOpinionsObject>;

/** The kinds this party answered, in the glossary's order. Length is 2..4. */
export function opinionKindsOf(opinions: Opinions): OpinionKind[] {
  return OPINION_KINDS.filter((kind) => opinions[kind] !== undefined);
}

/* ------------------------------------------------------------------ *
 * Aspect — an Item with two named ends
 * ------------------------------------------------------------------ */

/**
 * An Aspect — an Item in an assessment: `content/record.ts`'s item, with the fixed
 * 1..5 band as its scale and the two Values naming that band's ends.
 *
 * `leftValue` is notch 1 and `rightValue` is notch 5, exactly as the glossary defines
 * them ("low, left, min" / "high, right, max"), so a score's direction is never
 * ambiguous: 1 is the Left Value, 5 is the Right Value, 3 is the middle.
 */
export const zAspect = zItem
  .extend({
    scale: zScoreScale,
    leftValue: z.string().min(1),
    rightValue: z.string().min(1),
  })
  .strict();

export type Aspect = z.infer<typeof zAspect>;

/* ------------------------------------------------------------------ *
 * Template — the assessment
 * ------------------------------------------------------------------ */

export const zAssessmentObject = zTemplateObject
  .extend({
    type: z.literal("assessment"),
    /** At least one Aspect: a template with no Aspects says nothing to either party. */
    items: z.array(zAspect).min(1),
  })
  .strict();

/** A template: Aspects, no parties. Same item-id rule as every other record. */
export const zAssessment = zAssessmentObject.superRefine(uniqueItemIds);

export type Assessment = z.infer<typeof zAssessmentObject>;

/* ------------------------------------------------------------------ *
 * Instance — a template copied and given parties
 * ------------------------------------------------------------------ */

export const zPartyRole = z.enum(["initiator", "counterparty"]);

export type PartyRole = z.infer<typeof zPartyRole>;

/** One party's opinions on one Aspect of the instance. */
export const zAspectOpinions = z
  .object({
    /** The Aspect's id — an Aspect is this template's Item. */
    itemId: zId,
    opinions: zOpinions,
  })
  .strict();

export type AspectOpinions = z.infer<typeof zAspectOpinions>;

export const zParty = z
  .object({
    role: zPartyRole,
    name: z.string().min(1),
    /**
     * When this seat submitted its answers — the Initiator's or the Counterparty's own instant,
     * never the instance's. Absent means "we do not know when", which is every row written before
     * `db/migrations/0011_console_columns.sql` and every seat that has not answered yet.
     *
     * It is **not** the status. Whether a seat has answered is read from its `opinion` rows
     * (`instanceStatusOf()`); this column adds the one fact those rows cannot carry — *when* — and
     * a surface that draws it must treat absent as "not recorded", not as "not answered".
     */
    submittedAt: zIsoDateTime.optional(),
    /**
     * When this seat **accepted** the session — the completion hinge (#R2), or absent for "not
     * accepted yet".
     *
     * The same rule `submittedAt` follows, one column over: an instant, never a status. Whether a
     * seat has accepted is read from this column by `instanceStatusOf()`, and whether the sheet is
     * frozen is read from it per party — `complete` is derived from it and the opinion rows
     * together, and there is no `accepted` boolean anywhere to disagree with them.
     */
    acceptedAt: zIsoDateTime.optional(),
    /** One entry per Aspect of the instance, in the instance's own order. */
    opinions: z.array(zAspectOpinions).min(1),
  })
  .strict();

export type Party = z.infer<typeof zParty>;

/**
 * How long a relationship's own name may be. A label a person writes, not a paragraph: the limit
 * is authored here once and mirrored by the CHECK on `session.name`
 * (`db/migrations/0011_console_columns.sql`), so the database cannot store a name the model would
 * reject.
 */
export const INSTANCE_NAME_MAX = 120;

/** The instance's own name — optional, and NULL in the database means "unnamed" (below). */
export const zInstanceName = z.string().trim().min(1).max(INSTANCE_NAME_MAX);

/* ------------------------------------------------------------------ *
 * The seeded lifecycle — what a demo dataset's relationship row says
 * ------------------------------------------------------------------ */

/**
 * The seven words a relationship's lifecycle is stored under (#533), mirrored from
 * `lib/relationship/status.ts::RELATIONSHIP_STATUSES` and from the CHECK in
 * `db/migrations/0030_relationship_lifecycle.sql`.
 *
 * It is declared here, not imported, because `content/` is the bottom layer: `pnpm data:check`
 * compiles this file with `tsconfig.datacheck.json` and runs it under plain node, and the model
 * must not reach up into the app to name its own vocabulary. `tests/demo-dataset-coverage.test.ts`
 * asserts this list and the lib's are the same seven words in the same order, so the copy cannot
 * drift — the same mirror-and-test pattern `LAPSE_REASONS` uses against its CHECK.
 */
export const zRelationshipLifecycleStatus = z.enum([
  "draft",
  "pending",
  "published",
  "active",
  "complete",
  "void",
  "expired",
]);

export const RELATIONSHIP_LIFECYCLE_STATUSES = zRelationshipLifecycleStatus.options;

export type RelationshipLifecycleStatus = z.infer<typeof zRelationshipLifecycleStatus>;

/** The three reasons a relationship lapsed, mirroring `lib/relationship/membership.ts`. */
export const zRelationshipLapseReason = z.enum([
  "trial-ended",
  "payment-failed",
  "subscription-canceled",
]);

export const RELATIONSHIP_LAPSE_REASONS = zRelationshipLapseReason.options;

/** The two purchasable tiers a relationship is bought on (`data/billing-plans.ts`). */
export const zRelationshipPlan = z.enum(["basic", "principal"]);

/**
 * How much of the sheet has happened.
 *
 * The model requires **both** parties to answer every Aspect (`zAssessmentInstance`'s refinement),
 * because an instance is a copy of a template and a half-answered copy is not one. A *seeded*
 * relationship is not the whole sheet though: a `pending` invitation has nobody in the second seat
 * yet, and a `published` one may have one side in and the other still deciding. So the lifecycle
 * says how much of the sheet the seed writes, and the fixture keeps the full answer sheet the
 * relationship will hold once both people have filled it in.
 */
export const zAnsweredSides = z.enum(["none", "initiator", "both"]);

/**
 * **The seeded lifecycle of a demo instance** — the `relationship` row's own facts, authored
 * beside the answers they belong to.
 *
 * Nothing here is a second copy of a fact the rows already imply: the seed *writes* rows from this
 * block, so it is the source, and `pnpm db:verify` (V21, V31) compares what the rows then derive
 * back against it. Absent means the historic default — a finished demo session, `complete`, which is
 * what every instance authored before this block existed is.
 *
 * The seam between the two halves is deliberate and documented in `seededLifecycleOf`:
 *
 *   - the **answers** are the whole sheet (the model's shape, both parties, every Aspect);
 *   - the **lifecycle** says how much of that sheet, and which lifecycle state, a demo carries.
 *
 * `instants` are day offsets from the instance's own `date` (which is the relationship's
 * `created_at`), never wall-clock reads: a seed has to be byte-identical on a second run, and
 * `data:check` rejects a fixture that reads a clock.
 */
export const zSeededLifecycle = z
  .object({
    status: zRelationshipLifecycleStatus,
    /** The tier the relationship was bought on. Absent for a relationship nobody was charged for. */
    plan: zRelationshipPlan.optional(),
    /** How much of the fixture's answer sheet the seed writes. Defaults per status (below). */
    answers: zAnsweredSides.optional(),
    /** Why an operator voided it — a sentence a person wrote (`relationship.void_reason`). */
    voidReason: z.string().min(1).max(240).optional(),
    /** Why it lapsed; required for `expired` (the CHECK in `0032_relationship_lapse.sql`). */
    lapseReason: zRelationshipLapseReason.optional(),
    /** Days after `date` the relationship was published. Default: 0 — published on creation. */
    publishedAfterDays: z.number().int().min(0).max(365).optional(),
    /** Days after publish that it completed. Default: 1. */
    completedAfterDays: z.number().int().min(0).max(365).optional(),
    /** Days after `date` that it lapsed. Default: 7. */
    expiredAfterDays: z.number().int().min(0).max(365).optional(),
  })
  .strict()
  .superRefine((lifecycle, ctx) => {
    if (lifecycle.status === "void" && lifecycle.voidReason === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["voidReason"],
        message:
          "a void relationship carries the reason it was closed — `void_reason` is what support wrote",
      });
    }
    if (lifecycle.status === "expired" && lifecycle.lapseReason === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["lapseReason"],
        message:
          "an expired relationship carries its lapse reason — trial-ended, payment-failed or subscription-canceled",
      });
    }
    if (lifecycle.status !== "expired" && lifecycle.lapseReason !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["lapseReason"],
        message: `a "${lifecycle.status}" relationship has not lapsed, so it carries no lapse reason`,
      });
    }
    if (lifecycle.status !== "void" && lifecycle.voidReason !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["voidReason"],
        message: `a "${lifecycle.status}" relationship was not voided, so it carries no void reason`,
      });
    }
  });

export type SeededLifecycle = z.infer<typeof zSeededLifecycle>;

/**
 * **The lifecycle a seeded instance carries, with every unstated fact filled in by its status.**
 *
 * One derivation, three readers: `scripts/db-seed.mjs` writes rows from it, `scripts/db-verify.mjs`
 * compares the rows back to it, and `tests/demo-dataset-coverage.test.ts` counts it. Without a
 * single home the three would drift the first time a status was added — which is exactly what the
 * coverage test exists to prevent.
 *
 * The table, and why each row is the only coherent set of rows for that word (each line is also
 * what `instanceStatusOf()`, `inviteStateOf()` and V5/V6 ask for):
 *
 *   draft      one seat (the initiator's own), no invitation, no answers, never published. Stages
 *              1–3 of the create flow are a cookie (`lib/flow/create-draft.ts`), and stage 4's
 *              account is what writes this row (`docs/specs/flow-stages.md`).
 *   pending    one seat, the invitation **sent and unclaimed**, no answers. Stage 5's send.
 *   published  both seats (the claim put the counterparty in theirs), the invitation claimed, and
 *              `answers` decides whether one side or both have filled their sheet in. Nobody has
 *              accepted, which is why this is not `active`.
 *   active     both seats, claimed, both answered, both accepted, a plan — the live relationship,
 *              and the only status whose screen needs an entitling subscription.
 *   complete   as `active`, plus `completed_at` — the subscription finished.
 *   void       both seats, claimed, published, one side's answers, `void_reason`, never completed.
 *   expired    both seats, claimed, published, one side's answers, `expired_at` and `lapse_reason`,
 *              never accepted (the trial ran out before anybody accepted).
 */
export interface DerivedLifecycle {
  readonly status: RelationshipLifecycleStatus;
  readonly plan: "basic" | "principal" | null;
  readonly invite: "none" | "sent" | "claimed";
  readonly seats: "initiator" | "both";
  readonly answers: "none" | "initiator" | "both";
  readonly accepted: "none" | "both";
  readonly publishedAt: string | null;
  readonly completedAt: string | null;
  readonly expiredAt: string | null;
  readonly voidReason: string | null;
  readonly lapseReason: string | null;
}

/** `date` (the fixture instant) shifted by whole days, as an ISO instant. Pure arithmetic. */
function daysAfter(date: string, days: number): string {
  return new Date(new Date(date).getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * The honest default for an instance that carries no `lifecycle` block: **a finished demo session**.
 *
 * That is what every instance authored before #1079 is, and what `db:seed` wrote for it before the
 * block existed (`sealed ? "complete" : "published"`). It stays the default so the model does not
 * require a lifecycle on an instance that only describes content.
 */
const COMPLETE_BY_DEFAULT = "complete" as const;

export function seededLifecycleOf(instance: {
  readonly date: string;
  readonly lifecycle?: SeededLifecycle | undefined;
}): DerivedLifecycle {
  const authored = instance.lifecycle;
  const status = authored?.status ?? COMPLETE_BY_DEFAULT;
  const publishedAt = daysAfter(instance.date, authored?.publishedAfterDays ?? 0);
  const completedAt = daysAfter(instance.date, authored?.completedAfterDays ?? 1);
  const expiredAt = daysAfter(instance.date, authored?.expiredAfterDays ?? 7);

  switch (status) {
    case "draft":
      return {
        status,
        plan: null,
        invite: "none",
        seats: "initiator",
        answers: "none",
        accepted: "none",
        publishedAt: null,
        completedAt: null,
        expiredAt: null,
        voidReason: null,
        lapseReason: null,
      };
    case "pending":
      return {
        status,
        plan: null,
        invite: "sent",
        seats: "initiator",
        answers: "none",
        accepted: "none",
        publishedAt,
        completedAt: null,
        expiredAt: null,
        voidReason: null,
        lapseReason: null,
      };
    case "published":
      return {
        status,
        plan: authored?.plan ?? null,
        invite: "claimed",
        seats: "both",
        answers: authored?.answers ?? "both",
        accepted: "none",
        publishedAt,
        completedAt: null,
        expiredAt: null,
        voidReason: null,
        lapseReason: null,
      };
    case "active":
      return {
        status,
        plan: authored?.plan ?? "basic",
        invite: "claimed",
        seats: "both",
        answers: "both",
        accepted: "both",
        publishedAt,
        completedAt: null,
        expiredAt: null,
        voidReason: null,
        lapseReason: null,
      };
    case "complete":
      return {
        status,
        plan: authored?.plan ?? "basic",
        invite: "claimed",
        seats: "both",
        answers: "both",
        accepted: "both",
        publishedAt,
        completedAt,
        expiredAt: null,
        voidReason: null,
        lapseReason: null,
      };
    case "void":
      return {
        status,
        plan: authored?.plan ?? null,
        invite: "claimed",
        seats: "both",
        answers: authored?.answers ?? "initiator",
        accepted: "none",
        publishedAt,
        completedAt: null,
        expiredAt: null,
        voidReason: authored?.voidReason ?? null,
        lapseReason: null,
      };
    case "expired":
      return {
        status,
        plan: authored?.plan ?? "basic",
        invite: "claimed",
        seats: "both",
        answers: authored?.answers ?? "initiator",
        accepted: "none",
        publishedAt,
        completedAt: null,
        expiredAt,
        voidReason: null,
        lapseReason: authored?.lapseReason ?? null,
      };
  }
}

/**
 * **The session state a lifecycle implies** (#1100b): a `draft` session or a live one.
 *
 * The seat decides it, and nothing else — `seats: "initiator"` is a relationship whose Counterparty
 * has not joined (`draft` and `pending`: the invitation may be in the post, but nobody accepted it),
 * `seats: "both"` is one where they have. That is the same fact `scripts/db-verify.mjs` V33 reads
 * back from the `party` rows and `lib/flow/store.ts::claimInvite` writes, so the seeded branch and
 * the product cannot disagree about which sessions are live.
 *
 * It is deliberately **not** `accepted`. Acceptance (`party.accepted_at`, #R2) is a later act on a
 * session that is already live: a `published` relationship has both seats and a sheet in progress,
 * and hiding it as a draft would delete the demo's most important screen — "sent, being answered".
 *
 * Pure, like the rest of this module: one derivation, three readers (the seed writes it, V33
 * compares the rows back to it, `tests/demo-dataset-coverage.test.ts` counts it).
 */
export function sessionStateOf(lifecycle: DerivedLifecycle): "draft" | "active" {
  return lifecycle.seats === "both" ? "active" : "draft";
}

/**
 * How many `party` and `opinion` rows one instance writes (#1079, #1083).
 *
 * A bundle authors the **whole sheet** — both parties, every Aspect — and the lifecycle decides how
 * much of it a demo carries: `seats` says whether the counterparty has taken theirs yet, and
 * `answers` says whose sheet was filled in. So counting the bundle's authored arrays over-counts
 * what a seed installs, and by a lot: the demo bundle authors 62 parties / 310 opinions and the
 * seed writes 56 / 205. That gap is not drift, and `scripts/demo-reset.mjs` reporting it as one is
 * how a successful seed came to be reported as a failed reset.
 *
 * One home: `scripts/db-seed.mjs` writes these rows by the same two predicates, and this reads
 * them from `seededLifecycleOf()` — the single derivation the seed, `db:verify` (V21/V31) and the
 * dataset tests all share. Pure: no clock, no database.
 */
export function seededRowTotals(instance: {
  readonly date: string;
  readonly lifecycle?: SeededLifecycle | undefined;
  readonly parties: readonly {
    readonly role: string;
    readonly opinions: readonly unknown[];
  }[];
}): { parties: number; opinions: number } {
  const lifecycle = seededLifecycleOf(instance);
  let parties = 0;
  let opinions = 0;
  for (const party of instance.parties) {
    if (lifecycle.seats !== "both" && party.role !== "initiator") continue;
    parties += 1;
    const answered =
      lifecycle.answers === "both" ||
      (lifecycle.answers === "initiator" && party.role === "initiator");
    if (answered) opinions += party.opinions.length;
  }
  return { parties, opinions };
}

export const zAssessmentInstanceObject = zTemplateObject
  .extend({
    type: z.literal("assessment"),
    /** The template this instance is a copy of. Resolved by `data:check` E31. */
    templateId: zId,
    /**
     * The relationship's own name, when it has one. Absent means **unnamed**, and every surface
     * falls back to the template title — two instances of one template were otherwise two
     * identical rows, because the title a list rendered was always the template's.
     *
     * Optional rather than defaulted on purpose: a stored copy of the template title would be a
     * second authored copy of a fact the template already holds, would stop tracking the title it
     * copied, and could not be told apart from a name a person chose. `instanceNameOf()` is the
     * one place the fallback lives.
     */
    name: zInstanceName.optional(),
    /** The copy. Equal to the template's Aspects; E31 fails a copy that drifted. */
    items: z.array(zAspect).min(1),
    /**
     * Which mode the instance is played in — decided when it is created and never
     * changed. The refinement below makes `basic ⇔ Think/Guess absent` true by
     * construction, which is what a report needs before it draws a Gap.
     */
    mode: zAssessmentMode,
    /**
     * The Setting this instance is aligned under — a lens over the Gaps, not a Gap and not
     * a stored verdict. Soft tolerates a Small Gap (1) and Full tolerates none
     * (`content/gaps.ts::gapMeetsSetting`). Required rather than optional, exactly as `mode`
     * is: every instance *is* played under one setting, and "Soft ⇔ the author forgot" is the
     * silent comparison a default would hide.
     */
    setting: zAlignmentSetting,
    /**
     * **The relationship's seeded lifecycle**, when this instance is a demo dataset row rather than
     * a piece of content. Absent means `complete` (`seededLifecycleOf` below), which is what every
     * instance authored before #1079 is and what `db:seed` writes for it.
     *
     * Optional, and it must stay optional: `lib/db/rows.ts::assessmentInstanceFromRows` builds an
     * instance from database rows and parses it through this schema, and those rows carry their
     * lifecycle in the `relationship` table, not in the instance's own content.
     */
    lifecycle: zSeededLifecycle.optional(),
    /** Two parties: the glossary's Initiator and Counterparty, one each. */
    parties: z.tuple([zParty, zParty]),
  })
  .strict();

export const zAssessmentInstance = zAssessmentInstanceObject
  .superRefine(uniqueItemIds)
  .superRefine((instance, ctx) => {
    const roles = instance.parties.map((party) => party.role);
    if (new Set(roles).size !== roles.length) {
      ctx.addIssue({
        code: "custom",
        path: ["parties"],
        message: `the two parties must be one initiator and one counterparty (have: ${roles.join(", ")})`,
      });
    }

    instance.parties.forEach((party, partyIndex) => {
      const answered = party.opinions.map((entry) => entry.itemId);
      answered.forEach((itemId, index) => {
        if (answered.indexOf(itemId) !== index) {
          ctx.addIssue({
            code: "custom",
            path: ["parties", partyIndex, "opinions", index, "itemId"],
            message: `party "${party.name}" answers Aspect "${itemId}" twice`,
          });
        }
        if (!instance.items.some((item) => item.id === itemId)) {
          ctx.addIssue({
            code: "custom",
            path: ["parties", partyIndex, "opinions", index, "itemId"],
            message: `party "${party.name}" answers Aspect "${itemId}", which this instance does not hold`,
          });
        }
      });
      for (const item of instance.items) {
        if (!answered.includes(item.id)) {
          ctx.addIssue({
            code: "custom",
            path: ["parties", partyIndex, "opinions"],
            message: `party "${party.name}" does not answer Aspect "${item.id}" — every Aspect is answered by both parties`,
          });
        }
      }
    });

    // An instance is ONE mode: Basic means Think and Guess are absent everywhere,
    // Advanced means they are answered everywhere. `zOpinions` already rejects a
    // think-without-guess pair, so checking `think` alone decides it. This is the
    // schema half of "a report never silently compares a Basic answer with an
    // Advanced one" — the value is a column, and the mixed state is unrepresentable.
    instance.parties.forEach((party, partyIndex) => {
      party.opinions.forEach((entry, opinionIndex) => {
        if (instance.mode === "basic" && entry.opinions.think !== undefined) {
          ctx.addIssue({
            code: "custom",
            path: ["parties", partyIndex, "opinions", opinionIndex, "opinions"],
            message: `party "${party.name}" answers Aspect "${entry.itemId}" in Advanced (Think/Guess), but this instance is ${MODE_LABELS.basic}`,
          });
        }
        if (instance.mode === "advanced" && entry.opinions.think === undefined) {
          ctx.addIssue({
            code: "custom",
            path: ["parties", partyIndex, "opinions", opinionIndex, "opinions"],
            message: `party "${party.name}" answers Aspect "${entry.itemId}" with only Feel/Wish, but this instance is ${MODE_LABELS.advanced} — Think and Guess are owed on every Aspect`,
          });
        }
      });
    });
  });

export type AssessmentInstance = z.infer<typeof zAssessmentInstanceObject>;

/**
 * The name a surface renders for a relationship: its own when it has one, the template's title
 * when it does not.
 *
 * This is the **only** place the fallback lives, so every list that draws a relationship — today
 * `my-instances.tsx`, tomorrow the console's registry — answers "what is this one called" the same
 * way, and no view has to remember that `name` is optional. It takes the narrow shape rather than
 * a whole instance so a row projection can call it without building one.
 *
 * The template title is passed in rather than read here: an instance carries the id of the
 * template it copies (`templateId`) and not the template's words, for the same reason the copy of
 * the Aspects is not a title — the row that holds the words is the template's.
 */
export function instanceNameOf(
  instance: { readonly name?: string | undefined },
  templateTitle: string,
): string {
  return instance.name ?? templateTitle;
}

/**
 * The collection rule one instance cannot see (E31 in `data:check`): the template it
 * names exists, and its Aspects **are** that template's Aspects. A copy that drifted
 * is not a copy, and the parties are answering Aspects nobody else holds.
 *
 * Pure over its arguments so the negative cases can violate it without a filesystem,
 * the same split as `scripts/ui-refs.ts` and `scripts/mode-invariants.ts`.
 */
export function instanceTemplateProblems(
  templates: readonly Assessment[],
  instances: readonly AssessmentInstance[],
): string[] {
  const byId = new Map(templates.map((template) => [template.id, template]));
  const problems: string[] = [];
  for (const instance of instances) {
    const template = byId.get(instance.templateId);
    if (template === undefined) {
      problems.push(
        `instance "${instance.id}" names template "${instance.templateId}", which is not a record in this collection`,
      );
      continue;
    }
    const templateIds = template.items.map((item) => item.id);
    const copyIds = instance.items.map((item) => item.id);
    if (templateIds.join("\u0000") !== copyIds.join("\u0000")) {
      problems.push(
        `instance "${instance.id}" is a copy of "${template.id}" but its Aspects are [${copyIds.join(", ")}], the template's are [${templateIds.join(", ")}]`,
      );
    }
  }
  return problems;
}
