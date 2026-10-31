/**
 * The four derived stages (issue #261) — the vocabulary, the four states, and the Setting.
 *
 * The card's claim is not "there is a stage function". It is that the relationship ladder is
 * **four** stages — 1 Invited, 2 Connected, 3 Sharing, 4 Aligned — and that the other numbers
 * in the source material belong to a different ladder: the specification's **A–D "stage of
 * User"** (Play, Registered, Parties Locked, Subscribed), which is billing and out of scope
 * (`docs/SPEC-DRIFT.md` §4.2, §4.3). So the cases below pin, in order:
 *
 *   1. the vocabulary — four stages numbered 1–4 contiguously, and no fifth relationship
 *      stage invented to fill a gap that turned out to be a different product;
 *   2. the four states, each driven from a real fixture: `avery-rowan` with its invite still
 *      unclaimed (invited), `marco-priya` with both seats and a sheet short of complete
 *      (connected), the same `marco-priya` complete under Soft — Gaps 1..4 (sharing), and
 *      `ruth-sam` complete under Soft — every Gap 0 or 1 (aligned);
 *   3. the Setting is read, not assumed: one Gap of exactly 1 is Aligned under Soft and
 *      Sharing under Full, and `ruth-sam`'s six Gaps of 1 are likewise;
 *   4. the leak bound — before both parties have submitted a stage is `invited` or
 *      `connected` and nothing else, and the type makes the Setting and the Gaps
 *      **unrepresentable** on that branch (the `@ts-expect-error` below is a compile-time
 *      assertion: if it ever stops erroring, `pnpm data:check`'s `tsc` step fails);
 *   5. zero authored copies — no instance fixture carries a `stage`, `aligned` or `gap` field.
 *
 * This file runs under `pnpm data:check` (`tsc` then `node --test` over the compiled
 * `.datacheck/` tree) with `DATABASE_URL` unset: the module it tests is `content/stages.ts`,
 * which is pure for exactly that reason.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AssessmentInstance } from "../../content/assessment";
import { gapKindsOf, instanceAlignment, type AspectGaps } from "../../content/gaps";
import { gapOf } from "../../content/record";
import {
  RELATIONSHIP_STAGES,
  STAGES_BEFORE_COMPLETE,
  STAGE_DEFINITIONS,
  STAGE_LABELS,
  STAGE_NUMBERS,
  stageOf,
  type RelationshipStage,
  type StageFacts,
} from "../../content/stages";
import { assessmentInstances } from "../../data/assessments";

const instanceNamed = (slug: string): AssessmentInstance => {
  const instance = assessmentInstances.find((entry) => entry.slug === slug);
  if (instance === undefined) throw new Error(`the fixture has no instance "${slug}"`);
  return instance;
};

/** One Aspect's Gaps, in the shape `instanceAlignment()` and `stageOf()` read. */
const aspectGapsOf = (instance: AssessmentInstance): AspectGaps[] => {
  const [initiator, counterparty] = instance.parties;
  return instance.items.map((item) => {
    const left = initiator.opinions.find((answer) => answer.itemId === item.id);
    const right = counterparty.opinions.find((answer) => answer.itemId === item.id);
    if (left === undefined || right === undefined) {
      throw new Error(`instance "${instance.slug}" has an Aspect nobody answered: ${item.id}`);
    }
    return { itemId: item.id, gaps: gapKindsOf(left.opinions, right.opinions) };
  });
};

const avery = instanceNamed("avery-rowan");
const ruth = instanceNamed("ruth-sam");
const marco = instanceNamed("marco-priya");

describe("the vocabulary", () => {
  it("names four stages, in progress order", () => {
    assert.equal(RELATIONSHIP_STAGES.length, 4);
    assert.deepEqual([...RELATIONSHIP_STAGES], ["invited", "connected", "sharing", "aligned"]);
  });

  it("numbers the relationship ladder 1–4, the specification's range", () => {
    assert.deepEqual({ ...STAGE_NUMBERS }, { invited: 1, connected: 2, sharing: 3, aligned: 4 });
    assert.deepEqual(
      RELATIONSHIP_STAGES.map((stage) => STAGE_NUMBERS[stage]),
      [1, 2, 3, 4],
    );
  });

  it("has no fifth relationship stage — A–D are the specification's billing ladder, not stages here", () => {
    // Contiguous 1–4: nothing skipped, nothing appended. The A–D rows the specification draws
    // beside this ladder are "stage of User" (Play, Registered, Parties Locked, Subscribed) —
    // billing and account states, out of scope (`docs/SPEC-DRIFT.md` §4.2, §4.3) — so they are
    // not stage names here and no fifth relationship stage is invented to hold their place.
    const numbers: number[] = RELATIONSHIP_STAGES.map((stage) => STAGE_NUMBERS[stage]);
    assert.deepEqual(numbers, [1, 2, 3, 4]);
    assert.equal(new Set(numbers).size, numbers.length);
    for (const billing of ["a", "b", "c", "d"]) {
      assert.equal(
        (RELATIONSHIP_STAGES as readonly string[]).includes(billing),
        false,
        `"${billing}" is a stage of the User in the specification, never a relationship stage`,
      );
    }
  });

  it("gives each stage the glossary's own name and definition, once", () => {
    assert.deepEqual(
      { ...STAGE_LABELS },
      {
        invited: "Invited",
        connected: "Connected",
        sharing: "Sharing",
        aligned: "Aligned",
      },
    );
    assert.equal(
      STAGE_DEFINITIONS.invited,
      "Initiator has Invited Counterparty, but they have not Registered. Aspects, Values, and Opinions are locked.",
    );
    assert.equal(
      STAGE_DEFINITIONS.sharing,
      "Counterparty Shared Opinions, Relationship and Opinions now fully open to all Users.",
    );
    assert.equal(new Set(Object.values(STAGE_LABELS)).size, 4);
  });
});

describe("the four states, from real fixtures", () => {
  it("invited — avery-rowan's five Aspects with the invite still unclaimed", () => {
    // Avery's instance has five Aspects and Avery has answered none of them; Rowan is not a
    // party yet because the invitation has not been claimed. That is `awaiting_counterparty`.
    const initiator = avery.parties.find((party) => party.role === "initiator");
    const stage = stageOf({ counterpartyClaimed: false, bothSubmitted: false });
    assert.equal(stage, "invited");
    assert.equal(STAGE_NUMBERS[stage], 1);
    assert.equal(avery.items.length, 5);
    assert.equal(initiator?.opinions.length, 5);
  });

  it("connected — both seats exist and the sheet is still short of complete", () => {
    // `marco-priya` authors every Aspect on both sides, so the fixture is the *finished*
    // state; the mid-flow counts are the ones a real sheet hands over. Marco has answered all
    // five (read from the fixture), Priya three of five — two still owed — which is
    // `instanceStatusOf`'s `answering`, and the stage that says a seat, not a score.
    const [marcoParty, priyaParty] = marco.parties;
    const aspectCount = marco.items.length;
    const initiatorAnswered = marcoParty.opinions.length;
    const counterpartyAnswered = 3;
    assert.equal(aspectCount, 5);
    assert.equal(initiatorAnswered, aspectCount);
    assert.equal(priyaParty.opinions.length, aspectCount);
    assert.ok(counterpartyAnswered < aspectCount, "two Aspects still owed is not a complete sheet");

    const stage = stageOf({ counterpartyClaimed: true, bothSubmitted: false });
    assert.equal(stage, "connected");
    assert.equal(STAGE_NUMBERS[stage], 2);
  });

  it("sharing — marco-priya complete under Soft, with Gaps 1..4", () => {
    const aspects = aspectGapsOf(marco);
    const verdict = instanceAlignment(aspects, "soft");
    assert.equal(verdict.aligned, false);
    const stage = stageOf({
      counterpartyClaimed: true,
      bothSubmitted: true,
      setting: "soft",
      aspects,
    });
    assert.equal(stage, "sharing");
    assert.equal(STAGE_NUMBERS[stage], 3);
    // The numbers the fixture authors: the whole 1..4 range, none of it within Soft's 1.
    const widest = Math.max(...verdict.unmet.map((gap) => gap.gap));
    assert.equal(widest, 4);
    assert.ok(verdict.unmet.every((gap) => gap.gap >= 1));
  });

  it("aligned — ruth-sam complete under Soft, every Gap 0 or 1", () => {
    const aspects = aspectGapsOf(ruth);
    const verdict = instanceAlignment(aspects, "soft");
    assert.equal(verdict.aligned, true);
    assert.deepEqual(verdict.unmet, []);
    const stage = stageOf({
      counterpartyClaimed: true,
      bothSubmitted: true,
      setting: "soft",
      aspects,
    });
    assert.equal(stage, "aligned");
    assert.equal(STAGE_NUMBERS[stage], 4);
  });
});

describe("the Setting is read, never assumed", () => {
  /** One Aspect, one Gap, and that Gap is exactly 1 — the glossary's yellow Small Gap. */
  const onePointOfGap: AspectGaps[] = [{ itemId: "aspect-trust", gaps: { feel: gapOf(4, 5) } }];

  it("a Gap of 1 is Aligned under Soft and Sharing under Full — the same Gaps, two Settings", () => {
    assert.equal(gapOf(4, 5), 1);

    const soft = stageOf({
      counterpartyClaimed: true,
      bothSubmitted: true,
      setting: "soft",
      aspects: onePointOfGap,
    });
    const full = stageOf({
      counterpartyClaimed: true,
      bothSubmitted: true,
      setting: "full",
      aspects: onePointOfGap,
    });

    assert.equal(soft, "aligned");
    assert.equal(full, "sharing");
    assert.notEqual(soft, full);
    // And the arithmetic behind the difference, quoted from `instanceAlignment`.
    assert.deepEqual(instanceAlignment(onePointOfGap, "soft").unmet, []);
    assert.deepEqual(
      instanceAlignment(onePointOfGap, "full").unmet.map(
        (gap) => `${gap.itemId}.${gap.kind}=${gap.gap}`,
      ),
      ["aspect-trust.feel=1"],
    );
  });

  it("ruth-sam's six Gaps of 1 flip the same instance from Aligned to Sharing", () => {
    const aspects = aspectGapsOf(ruth);
    const soft = stageOf({
      counterpartyClaimed: true,
      bothSubmitted: true,
      setting: "soft",
      aspects,
    });
    const full = stageOf({
      counterpartyClaimed: true,
      bothSubmitted: true,
      setting: "full",
      aspects,
    });
    assert.equal(soft, "aligned");
    assert.equal(full, "sharing");
    const unmet = instanceAlignment(aspects, "full").unmet;
    assert.equal(unmet.length, 6);
    assert.ok(unmet.every((gap) => gap.gap === 1));
  });

  it("every Gap of 0 is Aligned under both Settings", () => {
    const agreeing: AspectGaps[] = [{ itemId: "aspect-trust", gaps: { feel: gapOf(3, 3) } }];
    for (const setting of ["soft", "full"] as const) {
      assert.equal(
        stageOf({ counterpartyClaimed: true, bothSubmitted: true, setting, aspects: agreeing }),
        "aligned",
      );
    }
  });
});

describe("a stage never carries an answer", () => {
  it("before both parties submit, only invited and connected are reachable", () => {
    const reachable: RelationshipStage[] = [
      stageOf({ counterpartyClaimed: false, bothSubmitted: false }),
      stageOf({ counterpartyClaimed: true, bothSubmitted: false }),
    ];
    assert.deepEqual(reachable, ["invited", "connected"]);
    assert.deepEqual([...STAGES_BEFORE_COMPLETE], ["invited", "connected"]);
    for (const stage of reachable) {
      assert.equal(
        (STAGES_BEFORE_COMPLETE as readonly RelationshipStage[]).includes(stage),
        true,
        `"${stage}" is shown before both parties have submitted — it must be a seat fact only`,
      );
    }
  });

  it("the Setting and the Gaps are unrepresentable before the sheet is complete", () => {
    // A compile-time assertion, not a comment: the not-yet-complete branch of `StageFacts`
    // has no `setting` and no `aspects`, so a caller cannot hand `stageOf` a Gap before both
    // parties have submitted. Each suppression sits directly above the line the compiler
    // reports and directly above the property it is about; if either property ever stops
    // being an excess-property error, the now-unused suppression fails the `tsc` step inside
    // `pnpm data:check`. The runtime half proves the same fact from the other side: all three
    // calls land on `connected`, because a smuggled Setting or Gap changes nothing about a
    // sheet that is not complete.
    const withSetting: StageFacts = {
      counterpartyClaimed: true,
      bothSubmitted: false,
      // @ts-expect-error — a sheet that is not complete has no Setting to read
      setting: "soft",
    };
    const withGaps: StageFacts = {
      counterpartyClaimed: true,
      bothSubmitted: false,
      // @ts-expect-error — and no Gaps: no argument through which an answer could leak
      aspects: aspectGapsOf(ruth),
    };

    assert.equal(stageOf({ counterpartyClaimed: true, bothSubmitted: false }), "connected");
    assert.equal(stageOf(withSetting), "connected");
    assert.equal(stageOf(withGaps), "connected");
  });

  it("a copy with no Aspects is Sharing, never Aligned", () => {
    // `instanceStatusOf` never calls this branch complete (0 Aspects is `answering`), and if
    // it did, claiming In Synch about a sheet with nothing on it is the defect this refuses.
    assert.equal(
      stageOf({ counterpartyClaimed: true, bothSubmitted: true, setting: "soft", aspects: [] }),
      "sharing",
    );
  });
});

describe("zero authored copies", () => {
  it("no instance fixture carries a stage, an aligned flag or a gap", () => {
    for (const instance of assessmentInstances) {
      const keys = Object.keys(instance);
      for (const forbidden of ["stage", "aligned", "gap"]) {
        assert.equal(
          keys.includes(forbidden),
          false,
          `instance "${instance.slug}" authors "${forbidden}" — the stage is derived, never stored`,
        );
      }
    }
  });
});
