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
 *   Mode       two — Basic adds Feel & Wish, Advanced adds Think & Guess. The schema
 *              *allows* four; it does not compute one from another, and it does not
 *              remember which mode an instance was played in.
 *
 * A template holds Aspects and has no parties. An **instance** is a template copied
 * and given parties — the glossary's Create (Template > Relationship) — so the
 * opinions live on the instance, next to the copy of the Aspects they answer.
 *
 * The eight gap *types* (Feel Gap, Wish Gap, Initiator Gap, Counterparty Gap, and the
 * two Advanced ones), the Soft/Full setting, the six stages and the Coach are not
 * modelled here: this file is the shape of the content and the one Gap function it
 * shares with every other record (`gapOf` in `content/record.ts`).
 */
import { z } from "zod";
import { zId } from "./core";
import { zItem, zScore, zScoreScale, zTemplateObject, uniqueItemIds } from "./record";

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
        `instance "${instance.id}" names template "${instance.templateId}", which is not a record in data/assessments.ts`,
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
