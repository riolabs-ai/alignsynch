/**
 * The demo generator is only useful if it is **provable**, so this file pins the claims the
 * cards make rather than describing them:
 *
 *   1. the same seed produces an identical set, so a report is reproducible;
 *   2. every generated row parses against the real schema (`zV1Relationship`), so the demo set
 *      cannot drift from the model the app reads;
 *   3. the set covers every purchasable catalogue type and all four Stages — the Stage **derived**
 *      from the accept/submit flags, never a stored label — with both Modes and both Settings
 *      somewhere in it;
 *   4. the Gap distribution is deliberate: In Synch is 10–20% of every comparison rather than
 *      most of them, one relationship is In Synch on **every** Gap, and the widest Gap (4) is in
 *      the set — plus some rows are deliberately unscored, so a surface must print `—`;
 *   5. a completed row stores the Steps its own answers derive, so the Steps panel renders on a
 *      fresh store instead of needing two sheets played by hand.
 *
 * The factories beside this file are pinned the same way: `makeRelationship` parses, and a
 * malformed override throws instead of producing a fixture that would fail somewhere else.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { zOpinions, type AssessmentMode } from "@/content/assessment";
import { RELATIONSHIP_STAGES, type RelationshipStage } from "@/content/stages";
import { deriveSteps } from "@/content/steps";
import {
  zV1Account,
  zV1Relationship,
  zV1Ticket,
  SEED_VERSION,
  type V1Relationship,
} from "@/data/v1/fixtures";
import { purchasableRelationshipTypes } from "@/data/v1/relationship-types";
import {
  allAspectGaps,
  bothSubmittedOf,
  cardMetricsOf,
  flagCountsOfRelationship,
  sessionCompleteOf,
  stageOfRelationship,
  verdictOf,
} from "@/lib/v1/derive";
import {
  DEMO_FLOW_STORAGE_KEY,
  DEMO_SEED,
  demoRng,
  demoRelationships,
  demoSeed,
  demoSeedJson,
  installDemoSeed,
} from "@/lib/v1/demo-seed";
import {
  makeAnswerSheet,
  makeCompletedRelationship,
  makeRelationship,
} from "./helpers/v1-factories";

/** Every Gap value one Aspect carries, as numbers. */
function gapValues(rel: V1Relationship, itemId: string) {
  const aspect = allAspectGaps(rel).find((entry) => entry.itemId === itemId);
  return (Object.values(aspect?.gaps ?? {}) as number[]).map(Number);
}

/** The Steps a row's own answers derive — the rule `storedStepsOf` stores, restated by hand. */
function deriveOf(rel: V1Relationship) {
  return deriveSteps({
    relationshipId: rel.id,
    items: rel.items,
    initiatorAnswers: rel.initiatorAnswers,
    counterpartyAnswers: rel.counterpartyAnswers,
    createdAt: rel.lastSessionAt ?? rel.createdAt,
  });
}

/** The scored rows only: an unscored row has no Gaps to spread. */
function scored(relationships: readonly V1Relationship[]): readonly V1Relationship[] {
  return relationships.filter((rel) => verdictOf(rel) !== null);
}

/** Every Gap magnitude one row carries, as numbers — all eight kinds, both Modes. */
function magnitudesOf(rel: V1Relationship): number[] {
  return allAspectGaps(rel).flatMap((aspect) => Object.values(aspect.gaps).map(Number));
}

/** Every Gap magnitude in the seeded set, in row order. */
function allMagnitudes(relationships: readonly V1Relationship[]): number[] {
  return relationships.flatMap(magnitudesOf);
}

describe("the demo seed is deterministic", () => {
  it("returns byte-identical JSON for the same seed, twice", () => {
    expect(demoSeedJson()).toBe(demoSeedJson());
    expect(demoSeedJson(7)).toBe(demoSeedJson(7));
    console.log("seeded rows:", demoSeed().relationships.length, "seed:", DEMO_SEED);
  });

  it("moves the Gaps when the seed changes", () => {
    const a = demoSeed(7).relationships.map((rel) => rel.initiatorAnswers);
    const b = demoSeed(8).relationships.map((rel) => rel.initiatorAnswers);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("draws the same PRNG stream from the same seed", () => {
    const first = Array.from({ length: 5 }, demoRng(42));
    const second = Array.from({ length: 5 }, demoRng(42));
    expect(second).toEqual(first);
    expect(first.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it("stamps every instant from the demo clock, never from the run", () => {
    const first = demoSeed();
    const second = demoSeed();
    expect(first.relationships.map((rel) => rel.modifiedAt)).toEqual(
      second.relationships.map((rel) => rel.modifiedAt),
    );
  });
});

describe("the payload is the store's shape", () => {
  it("carries the store version, and the flow slice parses against the real schemas", () => {
    const payload = demoSeed();
    expect(payload.version).toBe(SEED_VERSION);
    expect(zV1Relationship.array().safeParse(payload.relationships).success).toBe(true);
    expect(zV1Account.array().safeParse(payload.accounts).success).toBe(true);
    expect(zV1Ticket.array().safeParse(payload.tickets).success).toBe(true);
  });

  it("writes under the key lib/v1/store.tsx reads", () => {
    // `FLOW_STORAGE_KEY` is module-private in the store, so the literal is repeated in the
    // generator. This reads the store's own source to prove the two strings are one.
    const storePath = fileURLToPath(new URL("../lib/v1/store.tsx", import.meta.url));
    const source = readFileSync(storePath, "utf8");
    expect(source).toContain(`const FLOW_STORAGE_KEY = "${DEMO_FLOW_STORAGE_KEY}"`);
  });

  it("installs into the storage it is handed and reports the count", () => {
    const written = new Map<string, string>();
    const count = installDemoSeed({ setItem: (key, value) => void written.set(key, value) });
    expect(count).toBe(purchasableRelationshipTypes.length);
    const raw = written.get(DEMO_FLOW_STORAGE_KEY);
    expect(raw).toBeDefined();
    expect(JSON.parse(raw ?? "{}").relationships).toHaveLength(count);
  });
});

describe("the set covers the catalogue and the ladder", () => {
  const relationships = demoRelationships();

  it("has one relationship for every purchasable type", () => {
    const templateIds = new Set(relationships.map((rel) => rel.templateId));
    for (const type of purchasableRelationshipTypes) {
      expect(templateIds.has(`assessment-${type.id}`)).toBe(true);
    }
    expect(relationships).toHaveLength(purchasableRelationshipTypes.length);
    console.log(
      "types covered:",
      purchasableRelationshipTypes.length,
      "—",
      purchasableRelationshipTypes.map((type) => type.id).join(", "),
    );
  });

  it("reaches all four Stages", () => {
    const stages = new Set(relationships.map((rel) => stageOfRelationship(rel)));
    expect([...stages].sort()).toEqual([...RELATIONSHIP_STAGES].sort());
    console.log("stages:", [...stages].join(", "));
  });

  it("plays both Modes and both Settings, scored and unscored", () => {
    const modes = new Set(relationships.map((rel) => rel.mode));
    const settings = new Set(relationships.map((rel) => rel.setting));
    expect([...modes].sort()).toEqual(["advanced", "basic"]);
    expect([...settings].sort()).toEqual(["full", "soft"]);
    expect(scored(relationships).length).toBeGreaterThan(0);
    expect(scored(relationships).length).toBeLessThan(relationships.length);
  });

  it("keeps a full but unaccepted sheet unscored, so the list prints — with answers present", () => {
    // The em-dash rule, stated as the list reads it: `cardMetricsOf().averageAlignment` is null
    // until the session is complete, and `components/v1/relationships-list.tsx` prints `—` for
    // null. One row here has every Aspect answered by both parties and still must show `—`.
    const unscored = relationships.filter((rel) => cardMetricsOf(rel).averageAlignment === null);
    expect(unscored.length).toBeGreaterThan(0);
    const answeredButNotAccepted = unscored.filter(
      (rel) => bothSubmittedOf(rel) && !sessionCompleteOf(rel),
    );
    expect(answeredButNotAccepted.length).toBeGreaterThan(0);
    for (const rel of unscored) {
      expect(flagCountsOfRelationship(rel)).toBeNull();
      expect(verdictOf(rel)).toBeNull();
    }
    console.log(
      "unscored rows:",
      unscored.length,
      "· full sheets awaiting acceptance:",
      answeredButNotAccepted.length,
    );
  });
});

describe("both ends of the Gap range are reachable per Mode", () => {
  const relationships = scored(demoRelationships());

  for (const mode of ["basic", "advanced"] as readonly AssessmentMode[]) {
    it(`${mode}: one Aspect at Gap 0 and one at the maximum`, () => {
      const rows = relationships.filter((rel) => rel.mode === mode);
      expect(rows.length).toBeGreaterThan(0);

      const aspects = rows.flatMap((rel) =>
        rel.items.map((item) => {
          const values = gapValues(rel, item.id);
          return { rel, item, values, max: Math.max(...values), measured: values.length };
        }),
      );

      const inSynch = aspects.filter(
        (aspect) => aspect.measured > 0 && aspect.values.every((value) => value === 0),
      );
      const widest = aspects.filter((aspect) => aspect.max === 4);

      expect(inSynch.length).toBeGreaterThan(0);
      expect(widest.length).toBeGreaterThan(0);
      console.log(
        mode,
        "— In Synch Aspects:",
        inSynch.length,
        "· widest-Gap Aspects:",
        widest.length,
        "· sample:",
        `${widest[0].rel.name}/${widest[0].item.id} max ${widest[0].max}`,
      );
    });
  }

  it("spreads magnitudes across the whole 0..4 range", () => {
    const magnitudes = new Set<number>();
    for (const rel of relationships) {
      for (const item of rel.items) {
        for (const value of gapValues(rel, item.id)) magnitudes.add(value);
      }
    }
    expect([...magnitudes].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
  });

  // The row shape gained two required fields (#404): `inviteeName`, which only the create entry
  // writes, and `steps`, which is derived at completion and then stored. A generated row has to
  // say the same thing the fixtures say — no seat named, and exactly the Steps its own answers
  // produce — or the demo set is a state the store itself cannot reach.
  it("stores the Steps each completed row derives, and names no seat", () => {
    let completed = 0;
    for (const rel of relationships) {
      expect(rel.inviteeName).toBeNull();
      const complete = rel.initiatorAccepted && rel.counterpartyAccepted;
      if (complete) completed += 1;
      expect(rel.steps).toEqual(complete ? deriveOf(rel) : []);
    }
    // A set where nothing completed would satisfy the loop above for the wrong reason.
    expect(completed).toBeGreaterThan(0);
    console.log("completed rows carrying Steps:", completed, "of", relationships.length);
  });
});

describe("the seeded distribution is deliberate", () => {
  const relationships = demoRelationships();
  const magnitudes = allMagnitudes(relationships);

  it("derives all four Stages from the accept/submit flags", () => {
    // The Stage is never a field on the row; this reads it exactly as the app does, so a plan
    // that claims `connected` while every row has accepted cannot pass.
    const counts = new Map<RelationshipStage, number>();
    for (const rel of relationships) {
      const stage = stageOfRelationship(rel);
      counts.set(stage, (counts.get(stage) ?? 0) + 1);
    }
    for (const stage of RELATIONSHIP_STAGES) {
      expect(counts.get(stage) ?? 0, `no ${stage} relationship in the seed`).toBeGreaterThan(0);
    }

    // The state a first-time counterparty lands in: the invite is claimed and the answer sheet
    // is blank, so the row must render `—` rather than a score of 0.
    const blankConnected = relationships.filter(
      (rel) =>
        stageOfRelationship(rel) === "connected" &&
        !rel.initiatorSubmitted &&
        !rel.counterpartySubmitted,
    );
    expect(blankConnected.length).toBeGreaterThan(0);

    console.log(
      "stages:",
      RELATIONSHIP_STAGES.map((stage) => `${stage} ${counts.get(stage) ?? 0}`).join(" · "),
    );
  });

  it("keeps In Synch to 10–20% of every comparison", () => {
    expect(magnitudes.length).toBeGreaterThan(0);
    const zeros = magnitudes.filter((value) => value === 0).length;
    const zeroFraction = zeros / magnitudes.length;

    // A set where most comparisons are 0 cannot answer "does the report read well when there is
    // something to see"; a set with no zeros never renders the In Synch path at all.
    expect(zeroFraction).toBeGreaterThanOrEqual(0.1);
    expect(zeroFraction).toBeLessThanOrEqual(0.2);

    const histogram = [0, 1, 2, 3, 4].map(
      (value) => `${value}: ${magnitudes.filter((m) => m === value).length}`,
    );
    console.log(
      "gaps:",
      `${magnitudes.length} comparisons · zeros ${zeros} (${(zeroFraction * 100).toFixed(1)}%) ·`,
      histogram.join(" "),
    );
  });

  it("keeps both ends of the range: one relationship In Synch throughout, and 4s present", () => {
    const entirelyInSynch = relationships.filter((rel) => {
      const values = magnitudesOf(rel);
      return values.length > 0 && values.every((value) => value === 0);
    });
    expect(entirelyInSynch.length).toBeGreaterThan(0);
    expect(Math.max(...magnitudes)).toBe(4);
    console.log(
      "fully In Synch:",
      entirelyInSynch.map((rel) => `${rel.name} (${rel.mode}, ${rel.setting})`).join(", "),
    );
  });
});

describe("a completed relationship stores the Steps its answers derive", () => {
  const relationships = demoRelationships();
  const completed = relationships.filter(
    (rel) => rel.initiatorAccepted && rel.counterpartyAccepted,
  );

  it("gives a reviewer a completed relationship whose Steps panel is not empty", () => {
    // `components/v1/steps-panel.tsx` renders nothing when `rel.steps` is empty, so the demo set
    // is only reviewable if at least one *completed* row carries Steps. A row that is In Synch on
    // every Gap derives none by design — the panel needs a gapped one, and every sharing row is.
    const withSteps = completed.filter((rel) => rel.steps.length > 0);
    expect(withSteps.length).toBeGreaterThan(0);

    for (const rel of completed) {
      // One Step per Aspect is the rule (`content/steps.ts`), so the rows can never outnumber
      // them, and a Step always names an Aspect the relationship still holds.
      expect(rel.steps.length).toBeLessThanOrEqual(rel.items.length);
      const aspectIds = new Set(rel.items.map((item) => item.id));
      for (const step of rel.steps) {
        expect(aspectIds.has(step.aspectId)).toBe(true);
        expect(step.status).toBe("open");
        expect(step.derivedFrom.length).toBeGreaterThan(0);
        expect(step.suggestedText).toBeDefined();
      }
    }

    const headline = withSteps[0];
    // The row a reviewer is told to open holds the derivation over its own answers — not a list
    // this generator typed, and not a count that could drift from the rule.
    expect(headline.steps).toEqual(deriveOf(headline));
    console.log(
      "steps:",
      `${withSteps.length} of ${completed.length} completed rows carry Steps · open`,
      `${headline.id} (${headline.name}) — ${headline.steps.length} Steps:`,
      headline.steps.map((step) => `${step.aspectId} ← ${step.derivedFrom.join("+")}`).join(", "),
    );
  });
});

describe("the test factories produce schema-valid objects", () => {
  it("makeRelationship parses against zV1Relationship", () => {
    expect(zV1Relationship.safeParse(makeRelationship()).success).toBe(true);
    expect(zV1Relationship.safeParse(makeRelationship({ mode: "advanced" })).success).toBe(true);
    console.log("factory row:", JSON.stringify(makeRelationship({ id: "rel-printed" })));
  });

  // The two constructors this repo has for a relationship both have to carry the shape the model
  // requires: `steps` is a stored plan, so a completed row is built with the Steps its own answers
  // derive, and an unstarted one is built with none.
  it("a completed factory row carries the Steps its answers derive", () => {
    // Even two identical sheets carry a Gap — `wish` and `feel` differ inside one answer — so a
    // completed row always derives at least one Step, and the factory stores it.
    const completed = makeCompletedRelationship();
    expect(completed.steps.length).toBeGreaterThan(0);
    expect(completed.steps).toEqual(deriveOf(completed));

    // A wide Gap on one Aspect changes the plan, and the factory follows it.
    const aspectId = makeRelationship().items[0].id;
    const gapped = makeCompletedRelationship({
      mode: "advanced",
      initiatorAnswers: makeAnswerSheet({ [aspectId]: { feel: 1 } }, { mode: "advanced" }),
      counterpartyAnswers: makeAnswerSheet({ [aspectId]: { feel: 5 } }, { mode: "advanced" }),
    });
    expect(gapped.steps).toEqual(deriveOf(gapped));
    expect(zV1Relationship.safeParse(gapped).success).toBe(true);

    // An unstarted row has agreed nothing, so it holds no plan.
    expect(makeRelationship().steps).toEqual([]);
  });

  it("makeAnswerSheet answers every Aspect and parses against zOpinions", () => {
    const rel = makeRelationship();
    const sheet = makeAnswerSheet();
    expect(Object.keys(sheet).sort()).toEqual(rel.items.map((item) => item.id).sort());
    for (const opinions of Object.values(sheet)) {
      expect(zOpinions.safeParse(opinions).success).toBe(true);
    }
  });

  it("rejects a malformed override instead of producing a bad fixture", () => {
    expect(() => makeRelationship({ mode: "expert" as never })).toThrow();
    expect(() => makeRelationship({ items: [] })).toThrow();
    expect(() => makeAnswerSheet({ "aspect-priorities": { feel: 6 } })).toThrow();
  });
});
