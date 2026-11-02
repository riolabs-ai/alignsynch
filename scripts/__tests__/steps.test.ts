/**
 * The Steps for Improving the Relationship (issue #404, §7) — the derivation and the merge.
 *
 * The card's claim is narrow and has to be pinned exactly, so the cases below assert it in this
 * order:
 *
 *   1. **one Step per Aspect per non-zero Gap kind** — four Gaps of 3 on an answered Aspect, four
 *      Steps; the ids name the relationship, the Aspect and the kind;
 *   2. **a zero Gap produces no Step** — an Aspect both parties answered identically yields
 *      nothing at all, because In Synch is not a thing to go and do;
 *   3. **an absent kind produces no Step** — a Basic sheet has no Think/Guess, so no prediction
 *      Step may appear for a question nobody was asked;
 *   4. **Steps are additive** — deriving does not move a Gap or the verdict, asserted by
 *      computing both over the same answers before and after;
 *   5. **the merge never rewrites a recorded Step** — a later session adds what is new and leaves
 *      the words and the `done` tick of the row it already holds;
 *   6. **the fixtures agree with the rule** — `rel-aligned` (Basic, the six Gaps of 1), a
 *      relationship with no completed session, and the Advanced pair, checked against their own
 *      stored rows.
 *
 * This file runs under `pnpm data:check` (`node --test` over the compiled `.datacheck/` tree),
 * with `DATABASE_URL` unset and no React, no Next and no database import — `content/steps.ts` is
 * pure for exactly that reason, and this suite is the proof of it.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Aspect, Opinions } from "../../content/assessment";
import {
  ADVANCED_GAP_KINDS,
  GAP_KIND_LABELS,
  gapKindsIn,
  gapKindsOf,
  instanceAlignment,
  type AspectGaps,
  type GapKind,
} from "../../content/gaps";
import {
  deriveSteps,
  stepIdOf,
  stepProgressOf,
  stepsForAspect,
  stepsToAdd,
  withStepStatus,
  type Step,
} from "../../content/steps";
import { seedRelationships } from "../../data/v1/fixtures";

/* ------------------------------------------------------------------ *
 * Two hand-built Aspects, so the arithmetic below can be checked by eye
 * ------------------------------------------------------------------ */

function aspect(id: string, prompt: string): Aspect {
  return {
    id,
    prompt,
    scale: { kind: "score", min: 1, max: 5 },
    leftValue: "Left end",
    rightValue: "Right end",
  };
}

/** A question the two parties answered three Gaps apart in every Basic direction. */
const DIVIDED = aspect("aspect-divided", "How are the week's priorities agreed?");

/** A question they answered identically — In Synch on all four Basic kinds. */
const SHARED = aspect("aspect-shared", "How is time off arranged?");

const initiatorAnswers: Record<string, Opinions> = {
  [DIVIDED.id]: { feel: 2, wish: 5 },
  [SHARED.id]: { feel: 4, wish: 4 },
};

const counterpartyAnswers: Record<string, Opinions> = {
  [DIVIDED.id]: { feel: 5, wish: 2 },
  [SHARED.id]: { feel: 4, wish: 4 },
};

function derive(items: readonly Aspect[] = [DIVIDED, SHARED]): Step[] {
  return deriveSteps({
    relationshipId: "rel-test",
    items,
    initiatorAnswers,
    counterpartyAnswers,
    createdAt: "2026-11-01T12:00:00.000Z",
  });
}

/* ------------------------------------------------------------------ *
 * 1 + 2 — one Step per Aspect per non-zero Gap kind, and none for a zero
 * ------------------------------------------------------------------ */

describe("the derivation", () => {
  it("emits one Step per Aspect per non-zero Gap kind", () => {
    const steps = derive();
    // DIVIDED: feel |2−5| = 3, wish |5−2| = 3, initiator |2−5| = 3, counterparty |5−2| = 3.
    const divided = stepsForAspect(steps, DIVIDED.id);
    assert.equal(divided.length, 4, "four non-zero Basic Gaps → four Steps");
    assert.deepEqual(
      divided.map((step) => step.derivedFrom),
      [["feel"], ["wish"], ["initiator"], ["counterparty"]],
      "each Step names exactly the kind that produced it, in GAP_KINDS order",
    );
    for (const step of divided) {
      assert.equal(step.relationshipId, "rel-test");
      assert.equal(step.aspectId, DIVIDED.id);
      assert.equal(step.status, "open", "a freshly derived Step is open");
      assert.equal(step.createdAt, "2026-11-01T12:00:00.000Z");
      assert.equal(step.id, stepIdOf("rel-test", DIVIDED.id, step.derivedFrom[0]));
      assert.match(step.text, /^How are the week's priorities agreed\? — /);
      assert.match(step.text, /Gap of 3/, "the Step states the distance it came from");
    }
    assert.match(divided[0].text, new RegExp(GAP_KIND_LABELS.feel));
  });

  it("produces no Step for a zero Gap", () => {
    const steps = derive();
    assert.equal(
      stepsForAspect(steps, SHARED.id).length,
      0,
      "a fully In Synch Aspect is not a to-do list, it is nothing to do",
    );
    // …and nothing about the absent ones leaks into the other Aspect's rows.
    assert.equal(steps.length, 4);
    assert.ok(
      steps.every((step) => step.aspectId !== SHARED.id),
      "no Step may name the aligned Aspect",
    );
  });

  it("produces no Step for a Gap kind the Mode never asked", () => {
    const basic = derive();
    assert.ok(
      basic.every(
        (step) => !(ADVANCED_GAP_KINDS as readonly GapKind[]).includes(step.derivedFrom[0]),
      ),
      "a Basic sheet has four kinds and no prediction to measure",
    );

    // The same two parties, answered again in Advanced Mode: the prediction kinds are present and
    // now produce Steps of their own — the derivation follows the answers, not a hard-coded four.
    const advancedInitiator: Record<string, Opinions> = {
      [DIVIDED.id]: { feel: 2, wish: 5, think: 1, guess: 5 },
    };
    const advancedCounterparty: Record<string, Opinions> = {
      [DIVIDED.id]: { feel: 5, wish: 2, think: 5, guess: 1 },
    };
    const advanced = deriveSteps({
      relationshipId: "rel-test",
      items: [DIVIDED],
      initiatorAnswers: advancedInitiator,
      counterpartyAnswers: advancedCounterparty,
      createdAt: "2026-11-01T12:00:00.000Z",
    });
    const kinds = advanced.map((step) => step.derivedFrom[0]);
    assert.equal(advanced.length, 8, "eight present non-zero kinds → eight Steps");
    for (const kind of ADVANCED_GAP_KINDS) {
      assert.ok(kinds.includes(kind), `the Advanced pair adds a Step for "${kind}"`);
    }
  });

  it("produces no Step for an Aspect either party left unanswered", () => {
    const steps = deriveSteps({
      relationshipId: "rel-test",
      items: [DIVIDED, SHARED],
      initiatorAnswers,
      // The counterparty has not answered DIVIDED at all.
      counterpartyAnswers: { [SHARED.id]: { feel: 4, wish: 4 } },
      createdAt: "2026-11-01T12:00:00.000Z",
    });
    assert.deepEqual(steps, [], "an unanswered Aspect has no Gaps, so it has no Steps");
  });
});

/* ------------------------------------------------------------------ *
 * 3 — additive: no Gap and no verdict moves
 * ------------------------------------------------------------------ */

describe("Steps are additive", () => {
  it("leaves every Gap value and the verdict exactly as the report computes them", () => {
    const before: AspectGaps[] = [DIVIDED, SHARED].map((item) => ({
      itemId: item.id,
      gaps: gapKindsOf(initiatorAnswers[item.id], counterpartyAnswers[item.id]),
    }));
    const verdictBefore = instanceAlignment(before, "soft");

    const steps = derive();
    assert.ok(steps.length > 0, "the derivation actually ran");

    const after: AspectGaps[] = [DIVIDED, SHARED].map((item) => ({
      itemId: item.id,
      gaps: gapKindsOf(initiatorAnswers[item.id], counterpartyAnswers[item.id]),
    }));
    const verdictAfter = instanceAlignment(after, "full");

    assert.deepEqual(after, before, "the Gaps are the same numbers after deriving");
    assert.deepEqual(
      { unmet: verdictAfter.unmet, aligned: verdictAfter.aligned },
      { unmet: verdictBefore.unmet, aligned: verdictBefore.aligned },
      "the verdict re-derives identically — Soft tolerates what Full does not, and neither moved",
    );
    assert.equal(verdictBefore.aligned, false, "three-wide Gaps are unmet under Soft too");
  });
});

/* ------------------------------------------------------------------ *
 * 4 — the merge and the tick
 * ------------------------------------------------------------------ */

describe("storing progress", () => {
  it("adds only what is new, and never rewrites a recorded Step", () => {
    const first = derive();
    const ticked = withStepStatus(first, first[0].id, "done");
    assert.equal(ticked[0].status, "done");
    assert.equal(ticked.length, first.length);

    // A later session derives the same four Steps for DIVIDED plus two new ones for SHARED (the
    // counterparty's wish moved). Only the new Steps may be added.
    const laterCounterparty: Record<string, Opinions> = {
      [DIVIDED.id]: { feel: 5, wish: 2 },
      [SHARED.id]: { feel: 4, wish: 5 },
    };
    const derivedLater = deriveSteps({
      relationshipId: "rel-test",
      items: [DIVIDED, SHARED],
      initiatorAnswers,
      counterpartyAnswers: laterCounterparty,
      createdAt: "2026-12-01T12:00:00.000Z",
    });
    const added = stepsToAdd(ticked, derivedLater);
    assert.deepEqual(
      added.map((step) => `${step.aspectId}:${step.derivedFrom[0]}`),
      [`${SHARED.id}:wish`, `${SHARED.id}:counterparty`],
      "the Wish Gap and the counterparty's own Feel-against-Wish Gap are the two that opened",
    );
    assert.equal(added[0].createdAt, "2026-12-01T12:00:00.000Z");

    // The stored row keeps the words and the tick it was given, not the later session's.
    const stored = ticked[0];
    assert.equal(stored.status, "done");
    assert.equal(stored.text, first[0].text);
  });

  it("counts progress and moves a Step both ways", () => {
    const steps = derive();
    assert.deepEqual(stepProgressOf(steps), { total: 4, done: 0 });
    const done = withStepStatus(steps, steps[0].id, "done");
    assert.deepEqual(stepProgressOf(done), { total: 4, done: 1 });
    const undone = withStepStatus(done, steps[0].id, "open");
    assert.deepEqual(stepProgressOf(undone), { total: 4, done: 0 });
    // An unknown id is not a write: the array comes back by identity.
    assert.equal(withStepStatus(steps, "step-not-here", "done"), steps);
  });
});

/* ------------------------------------------------------------------ *
 * 5 — the fixtures agree with the rule
 * ------------------------------------------------------------------ */

describe("the seeded relationships", () => {
  const byId = (id: string) => {
    const found = seedRelationships.find((rel) => rel.id === id);
    if (found === undefined) throw new Error(`fixtures: no relationship "${id}"`);
    return found;
  };

  it("stores exactly the Steps its own answers derive", () => {
    for (const rel of seedRelationships) {
      const derived = deriveSteps({
        relationshipId: rel.id,
        items: [...rel.items],
        initiatorAnswers: rel.initiatorAnswers,
        counterpartyAnswers: rel.counterpartyAnswers,
        createdAt: rel.lastSessionAt ?? rel.createdAt,
      });
      const complete = rel.initiatorAccepted && rel.counterpartyAccepted;
      assert.deepEqual(
        rel.steps.map((step) => step.id),
        (complete ? derived : []).map((step) => step.id),
        `"${rel.id}": stored Steps ${complete ? "equal" : "are empty on an incomplete session from"} the derivation`,
      );
      for (const step of rel.steps) {
        const kind = step.derivedFrom[0] as GapKind;
        const gaps = gapKindsOf(
          rel.initiatorAnswers[step.aspectId],
          rel.counterpartyAnswers[step.aspectId],
        );
        const gap = gaps[kind];
        assert.ok(
          gap !== undefined && gap > 0,
          `"${rel.id}" stores a Step for a zero or absent Gap`,
        );
        assert.match(step.text, new RegExp(`${GAP_KIND_LABELS[kind]} of ${gap}`));
      }
    }
  });

  it("gives the aligned pair six open Steps — the six Gaps of 1, and nothing on the aligned Aspect", () => {
    const aligned = byId("rel-aligned");
    assert.equal(aligned.steps.length, 6);
    assert.equal(stepProgressOf(aligned.steps).done, 0);
    assert.equal(
      stepsForAspect(aligned.steps, "aspect-house-rules").length,
      0,
      "every party answered house-rules identically — nothing to do there",
    );
    const gaps = gapKindsOf(
      aligned.initiatorAnswers["aspect-house-rules"],
      aligned.counterpartyAnswers["aspect-house-rules"],
    );
    assert.deepEqual(
      gapKindsIn(gaps).map((kind) => gaps[kind]),
      [0, 0, 0, 0],
    );
  });

  it("gives an Advanced relationship the prediction Steps it earned", () => {
    const advanced = byId("rel-advanced");
    const kinds = new Set(advanced.steps.map((step) => step.derivedFrom[0]));
    assert.ok(advanced.steps.length > 0);
    assert.ok(kinds.has("initiator-think") || kinds.has("counterparty-guess"));
  });

  it("leaves a session that is not complete with no Steps", () => {
    // Submitted but not accepted: the blind rule still holds and nothing has been agreed.
    assert.deepEqual(byId("rel-sharing-unmet").steps, []);
    assert.deepEqual(byId("rel-invited").steps, []);
  });
});
