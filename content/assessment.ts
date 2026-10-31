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
 * never a Gap of its own. The four stages the source defines are derived in
 * `content/stages.ts`; stages 4–6 are not defined by that source and are not modelled here,
 * and the Coach is not modelled anywhere yet.
 */
import { z } from "zod";
import { zId } from "./core";
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
      code: z.ZodIssueCode.custom,
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
    /** One entry per Aspect of the instance, in the instance's own order. */
    opinions: z.array(zAspectOpinions).min(1),
  })
  .strict();

export type Party = z.infer<typeof zParty>;

export const zAssessmentInstanceObject = zTemplateObject
  .extend({
    type: z.literal("assessment"),
    /** The template this instance is a copy of. Resolved by `data:check` E31. */
    templateId: zId,
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
        code: z.ZodIssueCode.custom,
        path: ["parties"],
        message: `the two parties must be one initiator and one counterparty (have: ${roles.join(", ")})`,
      });
    }

    instance.parties.forEach((party, partyIndex) => {
      const answered = party.opinions.map((entry) => entry.itemId);
      answered.forEach((itemId, index) => {
        if (answered.indexOf(itemId) !== index) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["parties", partyIndex, "opinions", index, "itemId"],
            message: `party "${party.name}" answers Aspect "${itemId}" twice`,
          });
        }
        if (!instance.items.some((item) => item.id === itemId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["parties", partyIndex, "opinions", index, "itemId"],
            message: `party "${party.name}" answers Aspect "${itemId}", which this instance does not hold`,
          });
        }
      });
      for (const item of instance.items) {
        if (!answered.includes(item.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
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
            code: z.ZodIssueCode.custom,
            path: ["parties", partyIndex, "opinions", opinionIndex, "opinions"],
            message: `party "${party.name}" answers Aspect "${entry.itemId}" in Advanced (Think/Guess), but this instance is ${MODE_LABELS.basic}`,
          });
        }
        if (instance.mode === "advanced" && entry.opinions.think === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["parties", partyIndex, "opinions", opinionIndex, "opinions"],
            message: `party "${party.name}" answers Aspect "${entry.itemId}" with only Feel/Wish, but this instance is ${MODE_LABELS.advanced} — Think and Guess are owed on every Aspect`,
          });
        }
      });
    });
  });

export type AssessmentInstance = z.infer<typeof zAssessmentInstanceObject>;

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
