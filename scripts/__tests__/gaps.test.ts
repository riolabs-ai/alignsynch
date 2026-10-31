/**
 * The eight Gaps (issue #219) — the pairs, the arithmetic, and the fixtures.
 *
 * The card's claim is not "there is a gap function"; it is that the glossary names **eight
 * gap kinds** and that four of them are a prediction measured against an *actual*, not a
 * same-kind difference. So the cases below pin, in order:
 *
 *   1. the vocabulary — eight kinds, four Basic then four Advanced, one label each;
 *   2. the pairs — literally `I.think vs C.feel` for the Initiator Think Gap, and the
 *      negative case: **no** kind compares `I.think` with `C.think`;
 *   3. the arithmetic — for every kind and every pair of scores 1..5, the kind's value is
 *      `gapOf()` of exactly the two scores its pair names, and nothing throws;
 *   4. the fixtures — all eight numbers on every Aspect of `noor-iris` (hand-computed,
 *      quoted below), four numbers and four absences on the Basic instances;
 *   5. the property the glossary implies — swapping the two parties is an involution on
 *      the kinds: Feel/Wish are unchanged, and each party's prediction kind becomes the
 *      other party's.
 *
 * This file runs under `pnpm data:check` (`node --test` over the compiled `.datacheck/`
 * tree) with `DATABASE_URL` unset and no React, no Next and no database import: the module
 * it tests is `content/gaps.ts`, which is pure for exactly that reason.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  AssessmentInstance,
  OpinionKind,
  Opinions,
  PartyRole,
} from "../../content/assessment";
import {
  ADVANCED_GAP_KINDS,
  BASIC_GAP_KINDS,
  GAP_KINDS,
  GAP_KIND_LABELS,
  GAP_KIND_SOURCES,
  gapKindsIn,
  gapKindsOf,
  type GapKind,
  type GapSource,
} from "../../content/gaps";
import { gapOf, type Gap, type Score } from "../../content/record";
import { assessmentInstances } from "../../data/assessments";

const instanceNamed = (slug: string): AssessmentInstance => {
  const instance = assessmentInstances.find((entry) => entry.slug === slug);
  if (instance === undefined) throw new Error(`the fixture has no instance "${slug}"`);
  return instance;
};

/** One party's stored answers on one Aspect. */
const opinionsOf = (instance: AssessmentInstance, role: PartyRole, itemId: string): Opinions => {
  const party = instance.parties.find((candidate) => candidate.role === role);
  if (party === undefined) throw new Error(`${instance.slug} has no ${role}`);
  const answer = party.opinions.find((candidate) => candidate.itemId === itemId);
  if (answer === undefined) throw new Error(`${party.name} answers no Aspect "${itemId}"`);
  return answer.opinions;
};

const gapsFor = (instance: AssessmentInstance, itemId: string) =>
  gapKindsOf(
    opinionsOf(instance, "initiator", itemId),
    opinionsOf(instance, "counterparty", itemId),
  );

/** Every score at 3, then the two scores a kind compares — the sweep's starting point. */
const opinionsWith = (party: PartyRole, sides: Array<[GapSource["left"], Score]>): Opinions => {
  const scores: Record<OpinionKind, Score> = { feel: 3, wish: 3, think: 3, guess: 3 };
  for (const [side, score] of sides) {
    if (side.party === party) scores[side.opinion] = score;
  }
  return scores;
};

describe("the vocabulary", () => {
  it("names eight kinds: the four Basic ones, then the four the Advanced pair adds", () => {
    assert.equal(GAP_KINDS.length, 8);
    assert.deepEqual([...BASIC_GAP_KINDS, ...ADVANCED_GAP_KINDS], [...GAP_KINDS]);
    assert.deepEqual([...BASIC_GAP_KINDS], ["feel", "wish", "initiator", "counterparty"]);
    assert.deepEqual(
      [...ADVANCED_GAP_KINDS],
      ["initiator-think", "initiator-guess", "counterparty-think", "counterparty-guess"],
    );
  });

  it("gives each kind the glossary's own name, once", () => {
    assert.deepEqual(Object.keys(GAP_KIND_LABELS).sort(), [...GAP_KINDS].sort());
    assert.equal(GAP_KIND_LABELS["initiator-think"], "Initiator Think Gap");
    assert.equal(GAP_KIND_LABELS["counterparty-guess"], "Counterparty Guess Gap");
    assert.equal(new Set(Object.values(GAP_KIND_LABELS)).size, 8);
  });
});

describe("the pairs, quoted from the glossary", () => {
  const pairs = GAP_KIND_SOURCES.map(
    (source) =>
      `${source.kind}: ${source.left.party}.${source.left.opinion} vs ${source.right.party}.${source.right.opinion}`,
  );

  it("subtracts the pair each kind's definition names", () => {
    assert.deepEqual(pairs, [
      "feel: initiator.feel vs counterparty.feel",
      "wish: initiator.wish vs counterparty.wish",
      "initiator: initiator.feel vs initiator.wish",
      "counterparty: counterparty.feel vs counterparty.wish",
      "initiator-think: initiator.think vs counterparty.feel",
      "initiator-guess: initiator.guess vs counterparty.wish",
      "counterparty-think: counterparty.think vs initiator.feel",
      "counterparty-guess: counterparty.guess vs initiator.wish",
    ]);
  });

  it("is not a same-kind difference: no prediction kind compares two parties' Think or two Guess scores", () => {
    for (const kind of ADVANCED_GAP_KINDS) {
      const source = GAP_KIND_SOURCES.find((candidate) => candidate.kind === kind);
      if (source === undefined) throw new Error(`no source for ${kind}`);
      assert.notEqual(
        source.left.opinion,
        source.right.opinion,
        `${kind} compares two ${source.left.opinion} scores — a same-kind difference the glossary never defines`,
      );
    }
    // The Basic cross-party kinds are same-kind by definition ("Parties Feel Different"),
    // and the two change kinds are one party's Feel against their own Wish.
    assert.deepEqual(
      GAP_KIND_SOURCES.filter((source) => source.left.party === source.right.party).map(
        (source) => source.kind,
      ),
      ["initiator", "counterparty"],
    );
  });

  it("has one source per kind, in GAP_KINDS order", () => {
    assert.deepEqual(
      GAP_KIND_SOURCES.map((source) => source.kind),
      [...GAP_KINDS],
    );
  });
});

describe("the arithmetic", () => {
  it("is gapOf() over the pair, for every kind and every pair of scores 1..5", () => {
    for (const source of GAP_KIND_SOURCES) {
      for (let leftScore = 1; leftScore <= 5; leftScore += 1) {
        for (let rightScore = 1; rightScore <= 5; rightScore += 1) {
          const gaps = gapKindsOf(
            opinionsWith("initiator", [
              [source.left, leftScore],
              [source.right, rightScore],
            ]),
            opinionsWith("counterparty", [
              [source.left, leftScore],
              [source.right, rightScore],
            ]),
          );
          assert.equal(
            gaps[source.kind],
            gapOf(leftScore, rightScore),
            `${source.kind} at ${leftScore} vs ${rightScore}`,
          );
        }
      }
    }
  });

  it("never throws: a prediction nobody gave is absent, not a number", () => {
    const basic: Opinions = { feel: 1, wish: 5 };
    const otherBasic: Opinions = { feel: 5, wish: 1 };
    const advanced: Opinions = { feel: 2, wish: 4, think: 3, guess: 1 };

    const cases: Array<[Opinions, Opinions]> = [
      [basic, otherBasic],
      [otherBasic, basic],
      [advanced, basic],
      [basic, advanced],
      [advanced, advanced],
    ];
    for (const [initiator, counterparty] of cases) {
      assert.doesNotThrow(() => gapKindsOf(initiator, counterparty));
    }

    // A prediction kind needs the predictor's Think/Guess and the other party's
    // Feel/Wish — the *actual* is required on every instance, the prediction is not. So a
    // half-Advanced pair measures the party who predicted and not the one who did not.
    assert.deepEqual(gapKindsIn(gapKindsOf(advanced, basic)), [
      ...BASIC_GAP_KINDS,
      "initiator-think",
      "initiator-guess",
    ]);
    assert.deepEqual(gapKindsIn(gapKindsOf(basic, advanced)), [
      ...BASIC_GAP_KINDS,
      "counterparty-think",
      "counterparty-guess",
    ]);
    // Both sides Advanced → all eight; neither → only the four.
    assert.deepEqual(gapKindsIn(gapKindsOf(advanced, advanced)), [...GAP_KINDS]);
    assert.deepEqual(gapKindsIn(gapKindsOf(basic, otherBasic)), [...BASIC_GAP_KINDS]);
  });

  it("is symmetric in the subtraction but not in the pair: swapping parties swaps the prediction kinds", () => {
    const noor = instanceNamed("noor-iris");
    const itemId = "aspect-check-ins";
    const forward = gapsFor(noor, itemId);
    const swapped = gapKindsOf(
      opinionsOf(noor, "counterparty", itemId),
      opinionsOf(noor, "initiator", itemId),
    );

    assert.equal(forward.feel, swapped.feel);
    assert.equal(forward.wish, swapped.wish);
    assert.equal(forward.initiator, swapped.counterparty);
    assert.equal(forward.counterparty, swapped.initiator);
    assert.equal(forward["initiator-think"], swapped["counterparty-think"]);
    assert.equal(forward["counterparty-think"], swapped["initiator-think"]);
    assert.equal(forward["initiator-guess"], swapped["counterparty-guess"]);
    assert.equal(forward["counterparty-guess"], swapped["initiator-guess"]);
  });
});

describe("the fixtures", () => {
  /**
   * The Basic feature example, hand-computed from `data/assessments.ts`:
   *
   *   Aspect                 I.feel I.wish  C.feel C.wish   Feel Wish Init Cpart
   *   aspect-time-together       2      5       5      3        3    2    3     2
   *   aspect-housework           3      4       2      3        1    1    1     1
   *   aspect-money               4      4       4      4        0    0    0     0
   *   aspect-conflict            3      5       2      3        1    2    2     1
   *   aspect-affection           4      4       3      4        1    0    0     1
   */
  it("gives a Basic instance four kinds and no prediction to measure", () => {
    const avery = instanceNamed("avery-rowan");
    assert.equal(avery.mode, "basic");

    const expected: Record<string, [Gap, Gap, Gap, Gap]> = {
      "aspect-time-together": [3, 2, 3, 2],
      "aspect-housework": [1, 1, 1, 1],
      "aspect-money": [0, 0, 0, 0],
      "aspect-conflict": [1, 2, 2, 1],
      "aspect-affection": [1, 0, 0, 1],
    };

    for (const item of avery.items) {
      const gaps = gapsFor(avery, item.id);
      assert.deepEqual(gapKindsIn(gaps), [...BASIC_GAP_KINDS], `${item.id} kinds`);
      assert.deepEqual(
        [gaps.feel, gaps.wish, gaps.initiator, gaps.counterparty],
        expected[item.id],
        `${item.id}: feel/wish/initiator/counterparty`,
      );
      for (const kind of ADVANCED_GAP_KINDS) {
        assert.equal(gaps[kind], undefined, `${item.id} has no ${kind}: ${avery.mode}`);
      }
    }
  });

  it("gives every Basic fixture in the collection four kinds, and marco-priya exactly that", () => {
    const marco = instanceNamed("marco-priya");
    for (const instance of assessmentInstances) {
      if (instance.mode !== "basic") continue;
      for (const item of instance.items) {
        const gaps = gapsFor(instance, item.id);
        assert.deepEqual(gapKindsIn(gaps), [...BASIC_GAP_KINDS], `${instance.slug} ${item.id}`);
      }
    }
    assert.equal(gapKindsIn(gapsFor(marco, "aspect-work-priorities")).length, 4);
  });

  /**
   * The Advanced fixture, hand-computed from `data/assessments.ts`. Eight numbers per
   * Aspect — the four Basic kinds, then the four prediction kinds. The last two columns
   * are the same-kind differences the app used to print: they are here to show they are
   * **not** the glossary's kinds, and to prove the two disagree on every Aspect.
   *
   *   Aspect                  feel wish init cpart I-think I-guess C-think C-guess | I.T−C.T  I.G−C.G
   *   aspect-check-ins           1    2    2     1       0       1       0       1 |      1        2
   *   aspect-house-rules         3    2    2     3       2       1       2       1 |      1        2
   *   aspect-trust               1    2    0     1       0       2       0       3 |      1        3
   *   aspect-one-to-one          2    3    3     2       1       2       3       3 |      2        2
   *   aspect-privacy             1    3    1     1       2       1       0       3 |      1        1
   */
  it("gives the Advanced fixture all eight kinds on every Aspect, and the numbers are these", () => {
    const noor = instanceNamed("noor-iris");
    assert.equal(noor.mode, "advanced");

    const expected: Record<string, Record<GapKind, Gap>> = {
      "aspect-check-ins": {
        feel: 1,
        wish: 2,
        initiator: 2,
        counterparty: 1,
        "initiator-think": 0,
        "initiator-guess": 1,
        "counterparty-think": 0,
        "counterparty-guess": 1,
      },
      "aspect-house-rules": {
        feel: 3,
        wish: 2,
        initiator: 2,
        counterparty: 3,
        "initiator-think": 2,
        "initiator-guess": 1,
        "counterparty-think": 2,
        "counterparty-guess": 1,
      },
      "aspect-trust": {
        feel: 1,
        wish: 2,
        initiator: 0,
        counterparty: 1,
        "initiator-think": 0,
        "initiator-guess": 2,
        "counterparty-think": 0,
        "counterparty-guess": 3,
      },
      "aspect-one-to-one": {
        feel: 2,
        wish: 3,
        initiator: 3,
        counterparty: 2,
        "initiator-think": 1,
        "initiator-guess": 2,
        "counterparty-think": 3,
        "counterparty-guess": 3,
      },
      "aspect-privacy": {
        feel: 1,
        wish: 3,
        initiator: 1,
        counterparty: 1,
        "initiator-think": 2,
        "initiator-guess": 1,
        "counterparty-think": 0,
        "counterparty-guess": 3,
      },
    };
    assert.deepEqual(Object.keys(expected).sort(), noor.items.map((item) => item.id).sort());

    for (const item of noor.items) {
      const gaps = gapsFor(noor, item.id);
      assert.deepEqual(gapKindsIn(gaps), [...GAP_KINDS], `${item.id}: eight kinds`);
      assert.deepEqual({ ...gaps }, expected[item.id], `${item.id}: ${JSON.stringify(gaps)}`);
    }
  });

  /**
   * The prediction pair, stated the way the card asks for it: the two scores, the kind
   * they make, and the same-kind difference that is a different number.
   */
  it("measures a prediction against the other party's actual, not against their prediction", () => {
    const noor = instanceNamed("noor-iris");
    const itemId = "aspect-privacy";
    const initiator = opinionsOf(noor, "initiator", itemId);
    const counterparty = opinionsOf(noor, "counterparty", itemId);

    /** The Advanced fixture answers Think on both sides of every Aspect. */
    const think = (opinions: Opinions, who: string): Score => {
      const score = opinions.think;
      if (score === undefined) throw new Error(`${who} has no Think on ${itemId}`);
      return score;
    };

    // Counterparty Thought Initiator Felt Different: Iris thought 3, Noor felt 3 → 0.
    assert.equal(think(counterparty, "Iris"), 3);
    assert.equal(initiator.feel, 3);
    assert.equal(gapsFor(noor, itemId)["counterparty-think"], 0);

    // The same-kind difference — Iris's thought against Noor's thought — is 1, a number
    // the glossary never defines. The two answers are not interchangeable.
    assert.equal(think(initiator, "Noor"), 2);
    const sameKindThink = gapOf(think(counterparty, "Iris"), think(initiator, "Noor"));
    assert.equal(sameKindThink, 1);
    assert.notEqual(gapsFor(noor, itemId)["counterparty-think"], sameKindThink);

    // And the Initiator Think Gap on another Aspect: Noor thought 4, Iris felt 4 → 0,
    // while Noor's thought against Iris's thought (3) is 1.
    const checkIns = opinionsOf(noor, "initiator", "aspect-check-ins");
    const checkInsOther = opinionsOf(noor, "counterparty", "aspect-check-ins");
    assert.equal(checkInsOther.feel, 4);
    assert.equal(think(checkIns, "Noor"), 4);
    assert.equal(think(checkInsOther, "Iris"), 3);
    assert.equal(gapsFor(noor, "aspect-check-ins")["initiator-think"], 0);
    assert.notEqual(
      gapsFor(noor, "aspect-check-ins")["initiator-think"],
      gapOf(think(checkIns, "Noor"), think(checkInsOther, "Iris")),
    );
  });

  it("never reports a prediction kind on a Basic instance, whatever the caller asks", () => {
    const avery = instanceNamed("avery-rowan");
    for (const item of avery.items) {
      const gaps = gapsFor(avery, item.id);
      for (const kind of ADVANCED_GAP_KINDS) assert.equal(gaps[kind], undefined);
    }
  });
});
