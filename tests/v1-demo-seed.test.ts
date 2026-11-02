/**
 * The demo generator is only useful if it is **provable**, so this file pins the four claims the
 * card makes rather than describing them:
 *
 *   1. the same seed produces an identical set, so a report is reproducible;
 *   2. every generated row parses against the real schema (`zV1Relationship`), so the demo set
 *      cannot drift from the model the app reads;
 *   3. the set covers every purchasable catalogue type and all four Stages, with both Modes and
 *      both Settings somewhere in it;
 *   4. both ends of the Gap range are reachable per Mode — an Aspect at 0 (In Synch) and one at
 *      the maximum (4) — and some rows are deliberately unscored, so a surface must print `—`.
 *
 * The factories beside this file are pinned the same way: `makeRelationship` parses, and a
 * malformed override throws instead of producing a fixture that would fail somewhere else.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { zOpinions, type AssessmentMode } from "@/content/assessment";
import { RELATIONSHIP_STAGES } from "@/content/stages";
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
import { makeAnswerSheet, makeRelationship } from "./helpers/v1-factories";

/** Every Gap value one Aspect carries, as numbers. */
function gapValues(rel: V1Relationship, itemId: string) {
  const aspect = allAspectGaps(rel).find((entry) => entry.itemId === itemId);
  return (Object.values(aspect?.gaps ?? {}) as number[]).map(Number);
}

/** The scored rows only: an unscored row has no Gaps to spread. */
function scored(relationships: readonly V1Relationship[]): readonly V1Relationship[] {
  return relationships.filter((rel) => verdictOf(rel) !== null);
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
});

describe("the test factories produce schema-valid objects", () => {
  it("makeRelationship parses against zV1Relationship", () => {
    expect(zV1Relationship.safeParse(makeRelationship()).success).toBe(true);
    expect(zV1Relationship.safeParse(makeRelationship({ mode: "advanced" })).success).toBe(true);
    console.log("factory row:", JSON.stringify(makeRelationship({ id: "rel-printed" })));
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
