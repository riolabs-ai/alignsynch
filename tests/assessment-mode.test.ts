/**
 * The mode — the schema and the vocabulary (#213).
 *
 * The gap this closes: `zOpinionKind` always allowed four opinions, but only Feel and Wish
 * were ever asked, so "Advanced Mode" looked present in the product and was not. These cases
 * pin the three claims that make it real:
 *
 *   the vocabulary   two modes, and `opinionKindsFor()` asks 2 or 4 in the glossary's order;
 *   the schema       an instance whose mode and opinion rows disagree does not parse — the
 *                    mixed state is unrepresentable, not merely unwritten;
 *   the fixtures     every seeded instance names its mode, and only the Advanced one carries
 *                    Think and Guess.
 *
 * The negative cases spread the **real** fixtures and change one thing, the way
 * `scripts/__tests__/record-model.test.ts` does: a mutated copy that still parses would mean
 * the refinement is decoration.
 */
import { describe, expect, it } from "vitest";
import {
  MODE_LABELS,
  opinionKindsFor,
  zAssessmentInstance,
  zAssessmentMode,
} from "@/content/assessment";
import { assessmentInstances } from "@/data/assessments";

/** The Advanced fixture: five Aspects, four opinions each, on both sides. */
const advanced = assessmentInstances.find((instance) => instance.slug === "noor-iris");
/** The Basic feature example. */
const basic = assessmentInstances.find((instance) => instance.slug === "avery-rowan");

if (advanced === undefined || basic === undefined) {
  throw new Error("the Noor/Iris and Avery/Rowan fixtures are this file's subject");
}

describe("the vocabulary", () => {
  it("defines exactly two modes, basic and advanced", () => {
    expect(zAssessmentMode.options).toEqual(["basic", "advanced"]);
    expect(zAssessmentMode.safeParse("basic").success).toBe(true);
    expect(zAssessmentMode.safeParse("advanced").success).toBe(true);
    expect(zAssessmentMode.safeParse("in-between").success).toBe(false);
    expect(zAssessmentMode.safeParse("Advanced").success).toBe(false);
  });

  it("asks Feel and Wish in Basic, and the four kinds in the glossary's order in Advanced", () => {
    expect(opinionKindsFor("basic")).toEqual(["feel", "wish"]);
    expect(opinionKindsFor("advanced")).toEqual(["feel", "wish", "think", "guess"]);
  });

  it("carries the glossary's own labels for both modes", () => {
    expect(MODE_LABELS).toEqual({ basic: "Basic Mode", advanced: "Advanced Mode" });
  });
});

describe("the instance's mode is a parse-time fact", () => {
  it("accepts the Advanced fixture, whose Think and Guess are on every Aspect", () => {
    expect(zAssessmentInstance.safeParse(advanced).success).toBe(true);
    for (const party of advanced.parties) {
      for (const answer of party.opinions) {
        expect(answer.opinions.think, `${party.name} ${answer.itemId}`).toBeDefined();
        expect(answer.opinions.guess, `${party.name} ${answer.itemId}`).toBeDefined();
      }
    }
  });

  it("accepts the Basic fixture, which carries no Think or Guess anywhere", () => {
    expect(zAssessmentInstance.safeParse(basic).success).toBe(true);
    for (const party of basic.parties) {
      for (const answer of party.opinions) {
        expect(answer.opinions.think, `${party.name} ${answer.itemId}`).toBeUndefined();
        expect(answer.opinions.guess, `${party.name} ${answer.itemId}`).toBeUndefined();
      }
    }
  });

  it("rejects a Basic instance whose party answers Think and Guess, naming the party and Aspect", () => {
    const mixed = {
      ...basic,
      parties: [
        {
          ...basic.parties[0],
          opinions: basic.parties[0].opinions.map((answer, index) =>
            index === 0
              ? { ...answer, opinions: { ...answer.opinions, think: 3, guess: 4 } }
              : answer,
          ),
        },
        basic.parties[1],
      ] as typeof basic.parties,
    };

    const parsed = zAssessmentInstance.safeParse(mixed);
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const message = parsed.error.issues.map((issue) => issue.message).join(" ");
    expect(message).toContain("Avery");
    expect(message).toContain("aspect-time-together");
    expect(message).toContain("Basic Mode");
    expect(parsed.error.issues[0]?.path).toEqual(["parties", 0, "opinions", 0, "opinions"]);
  });

  it("rejects an Advanced instance whose party skips Think and Guess on one Aspect", () => {
    const short = {
      ...advanced,
      parties: [
        {
          ...advanced.parties[0],
          opinions: advanced.parties[0].opinions.map((answer, index) =>
            index === 2
              ? { ...answer, opinions: { feel: answer.opinions.feel, wish: answer.opinions.wish } }
              : answer,
          ),
        },
        advanced.parties[1],
      ] as typeof advanced.parties,
    };

    const parsed = zAssessmentInstance.safeParse(short);
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const message = parsed.error.issues.map((issue) => issue.message).join(" ");
    expect(message).toContain("aspect-trust");
    expect(message).toContain("Advanced Mode");
    expect(message).toContain("Think and Guess are owed on every Aspect");
  });

  it("rejects a mode the model does not define", () => {
    const parsed = zAssessmentInstance.safeParse({ ...basic, mode: "half" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.path.join(".") === "mode")).toBe(true);
    }
  });
});

describe("the fixtures name their mode", () => {
  it("gives every seeded instance exactly one mode, authored rather than defaulted", () => {
    const modes = assessmentInstances.map((instance) => [instance.slug, instance.mode]);
    expect(modes).toEqual([
      ["avery-rowan", "basic"],
      ["ruth-sam", "basic"],
      ["marco-priya", "basic"],
      ["noor-iris", "advanced"],
    ]);
  });

  it("keeps exactly one Advanced demonstration, and it is noor-iris", () => {
    const advancedOnes = assessmentInstances.filter((instance) => instance.mode === "advanced");
    expect(advancedOnes.map((instance) => instance.slug)).toEqual(["noor-iris"]);
  });
});
