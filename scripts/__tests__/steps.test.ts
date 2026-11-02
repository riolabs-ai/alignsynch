/**
 * The Steps for Improving the Relationship (issue #404, §7) — the derivation, the schema and the
 * merge.
 *
 * The owner bounded the primitive on PR #406, so the claims this suite pins are:
 *
 *   1. **one Step per Aspect**, sourced from that Aspect's **widest** Gap kind — six Aspects yield
 *      at most six Steps, not one per measured direction;
 *   2. **the tie rule is deterministic** — two equally wide kinds resolve to the earlier one in
 *      `GAP_KINDS` order, which `widestGapOf` states once and this suite pins both directly and
 *      through a derivation;
 *   3. **a zero Gap produces no Step**, and an absent kind (Basic, or an unanswered Aspect) can
 *      never be the widest;
 *   4. **the sentence is a default** — `suggestedText` holds what the product proposed, `text`
 *      starts equal to it and is editable, and an authored Step is the one row with no kind and no
 *      suggestion (which `zStep` says out loud, in both directions);
 *   5. **`closed` is history** — a stored Step whose Gap has since fallen to 0 closes, is kept, is
 *      never counted as outstanding, and is never resurrected as open by a later derivation;
 *   6. **Steps are additive** — deriving does not move a Gap or the verdict, asserted by computing
 *      both over the same answers before and after;
 *   7. **the fixtures agree with the rule** — `rel-aligned`, `rel-advanced`, an incomplete session,
 *      and every stored row checked against its own answers.
 *
 * This file runs under `pnpm data:check` (`node --test` over the compiled `.datacheck/` tree), with
 * `DATABASE_URL` unset and no React, no Next and no database import — `content/steps.ts` is pure for
 * exactly that reason, and this suite is the proof of it.
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
  AUTHORED_STEP_LABEL,
  STEP_STATUS_LABELS,
  authoredStepOf,
  closeSteps,
  deriveSteps,
  stepIdOf,
  stepProgressOf,
  stepsForAspect,
  stepsToAdd,
  widestGapOf,
  withStepStatus,
  withStepText,
  zStep,
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

/** The same two answers on DIVIDED, but agreeing everywhere this time. */
const agreedAnswers: Record<string, Opinions> = {
  [DIVIDED.id]: { feel: 4, wish: 4 },
  [SHARED.id]: { feel: 4, wish: 4 },
};

function derive(
  items: readonly Aspect[] = [DIVIDED, SHARED],
  answers: {
    initiator?: Record<string, Opinions>;
    counterparty?: Record<string, Opinions>;
    createdAt?: string;
  } = {},
): Step[] {
  return deriveSteps({
    relationshipId: "rel-test",
    items,
    initiatorAnswers: answers.initiator ?? initiatorAnswers,
    counterpartyAnswers: answers.counterparty ?? counterpartyAnswers,
    createdAt: answers.createdAt ?? "2026-11-01T12:00:00.000Z",
  });
}

/* ------------------------------------------------------------------ *
 * 1 + 2 + 3 — one per Aspect, the widest kind, the tie rule, and none for a zero
 * ------------------------------------------------------------------ */

describe("the derivation", () => {
  it("emits exactly one Step per Aspect, from that Aspect's widest Gap kind", () => {
    const steps = derive();
    // DIVIDED: feel |2−5| = 3, wish |5−2| = 3, initiator |2−5| = 3, counterparty |5−2| = 3.
    // Four equally wide kinds, so the tie rule picks `feel` — first in GAP_KINDS order.
    assert.equal(steps.length, 1, "one Step for the one Aspect that has a Gap");
    const step = steps[0];
    assert.equal(step.aspectId, DIVIDED.id);
    assert.deepEqual(step.derivedFrom, ["feel"], "a tie resolves to the earliest kind");
    assert.equal(step.relationshipId, "rel-test");
    assert.equal(step.status, "open", "a freshly derived Step is open");
    assert.equal(step.createdAt, "2026-11-01T12:00:00.000Z");
    assert.equal(step.id, stepIdOf("rel-test", DIVIDED.id));
    assert.match(step.text, /^How are the week's priorities agreed\? — /);
    assert.match(step.text, /Gap of 3/, "the Step states the distance it came from");
    assert.match(step.text, new RegExp(GAP_KIND_LABELS.feel));
    // The suggestion is kept beside the editable text, and the text starts as it.
    assert.equal(step.suggestedText, step.text, "text initialises to the suggestion");
  });

  it("picks the widest kind, not the first non-zero one", () => {
    // feel 1 · wish 3 · initiator 2 · counterparty 0 — the widest is wish even though feel comes
    // first in GAP_KINDS order.
    assert.deepEqual(widestGapOf({ feel: 1, wish: 3, initiator: 2, counterparty: 0 }), {
      kind: "wish",
      gap: 3,
    });
    // …and through a real pair of answers: |1−4| = 3 feel, |5−2| = 3 wish, |1−5| = 4 initiator.
    const steps = deriveSteps({
      relationshipId: "rel-test",
      items: [DIVIDED],
      initiatorAnswers: { [DIVIDED.id]: { feel: 1, wish: 5 } },
      counterpartyAnswers: { [DIVIDED.id]: { feel: 4, wish: 2 } },
      createdAt: "2026-11-01T12:00:00.000Z",
    });
    assert.deepEqual(steps[0].derivedFrom, ["initiator"]);
    assert.match(steps[0].text, /Initiator Gap of 4/);
  });

  it("resolves a tie by GAP_KINDS order, in both directions", () => {
    // Feel and Wish both 2: feel is earlier.
    assert.deepEqual(widestGapOf({ feel: 2, wish: 2, initiator: 2, counterparty: 2 }), {
      kind: "feel",
      gap: 2,
    });
    // Feel is 0, so the tie is between wish and initiator: wish is earlier.
    assert.deepEqual(widestGapOf({ feel: 0, wish: 3, initiator: 3 }), {
      kind: "wish",
      gap: 3,
    });
    // Prediction kinds sit after the four Basic ones, so they lose a tie against them…
    assert.deepEqual(
      widestGapOf({
        feel: 2,
        wish: 2,
        initiator: 0,
        counterparty: 0,
        "initiator-think": 2,
        "counterparty-guess": 2,
      }),
      { kind: "feel", gap: 2 },
    );
    // …and among themselves the glossary's order decides.
    assert.deepEqual(widestGapOf({ "initiator-think": 4, "counterparty-guess": 4 }), {
      kind: "initiator-think",
      gap: 4,
    });
    // Nothing to name: every kind is 0 or absent.
    assert.equal(widestGapOf({ feel: 0, wish: 0 }), null);
    assert.equal(widestGapOf({}), null);
  });

  it("never emits more Steps than the relationship has Aspects", () => {
    const six = Array.from({ length: 6 }, (_, index) =>
      aspect(`aspect-${index + 1}`, `Question ${index + 1}?`),
    );
    // Every Aspect answered from opposite ends in Advanced Mode: all eight kinds are 4-wide.
    const ends = (feel: number, wish: number, think: number, guess: number) =>
      Object.fromEntries(six.map((item) => [item.id, { feel, wish, think, guess }]));
    const steps = derive(six, {
      initiator: ends(1, 5, 1, 5),
      counterparty: ends(5, 1, 5, 1),
    });
    assert.equal(steps.length, 6, "six Aspects, six Steps — not forty-eight");
    assert.equal(new Set(steps.map((step) => step.aspectId)).size, 6);
    assert.ok(steps.every((step) => step.derivedFrom.length === 1));
    assert.ok(steps.every((step) => step.derivedFrom[0] === "feel"));
  });

  it("produces no Step for a zero Gap", () => {
    const steps = derive();
    assert.equal(
      stepsForAspect(steps, SHARED.id).length,
      0,
      "a fully In Synch Aspect is not a to-do list, it is nothing to do",
    );
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
    // can now be the widest — |I.think − C.feel| = |1 − 5| = 4 and |C.guess − I.wish| = |1 − 5| = 4
    // tie, and `initiator-think` comes first.
    const advanced = deriveSteps({
      relationshipId: "rel-test",
      items: [DIVIDED],
      initiatorAnswers: { [DIVIDED.id]: { feel: 2, wish: 5, think: 1, guess: 5 } },
      counterpartyAnswers: { [DIVIDED.id]: { feel: 5, wish: 2, think: 5, guess: 1 } },
      createdAt: "2026-11-01T12:00:00.000Z",
    });
    assert.equal(advanced.length, 1);
    assert.deepEqual(advanced[0].derivedFrom, ["initiator-think"]);
    assert.match(advanced[0].text, /Initiator Think Gap of 4/);
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
 * 4 — the schema: a suggestion iff a Gap kind
 * ------------------------------------------------------------------ */

describe("the Step schema", () => {
  it("accepts a derived Step and an authored Step, and states the difference both ways", () => {
    const derived = derive()[0];
    assert.equal(zStep.safeParse(derived).success, true);

    const authored = authoredStepOf({
      relationshipId: "rel-test",
      aspectId: DIVIDED.id,
      text: "  Book a standing ten minutes before the week starts.  ",
      existing: derive(),
      createdAt: "2026-11-02T09:00:00.000Z",
    });
    assert.equal(authored.text, "Book a standing ten minutes before the week starts.");
    assert.deepEqual(authored.derivedFrom, [], "an authored Step names no kind");
    assert.equal(authored.suggestedText, undefined, "and carries no suggestion");
    assert.equal(authored.status, "open");
    assert.equal(authored.id, `${stepIdOf("rel-test", DIVIDED.id)}-own-1`);
    assert.equal(zStep.safeParse(authored).success, true);

    // A second authored Step on the same Aspect is a second row, not an overwrite.
    const second = authoredStepOf({
      relationshipId: "rel-test",
      aspectId: DIVIDED.id,
      text: "Agree who chairs it.",
      existing: [...derive(), authored],
      createdAt: "2026-11-02T09:05:00.000Z",
    });
    assert.equal(second.id, `${stepIdOf("rel-test", DIVIDED.id)}-own-2`);

    // The three rows the schema must refuse: a derived Step with no suggestion, an authored Step
    // that keeps one, and an authored Step that names a kind.
    assert.equal(zStep.safeParse({ ...derived, suggestedText: undefined }).success, false);
    assert.equal(zStep.safeParse({ ...authored, suggestedText: "something" }).success, false);
    assert.equal(zStep.safeParse({ ...authored, derivedFrom: ["feel"] }).success, false);
  });

  it("labels the three states and the authored provenance", () => {
    assert.deepEqual(STEP_STATUS_LABELS, { open: "Open", done: "Done", closed: "Closed" });
    assert.equal(AUTHORED_STEP_LABEL, "Your own Step");
  });
});

/* ------------------------------------------------------------------ *
 * 5 — additive: no Gap and no verdict moves
 * ------------------------------------------------------------------ */

describe("Steps are additive", () => {
  it("leaves every Gap value and the verdict exactly as the report computes them", () => {
    const gapsOf = (): AspectGaps[] =>
      [DIVIDED, SHARED].map((item) => ({
        itemId: item.id,
        gaps: gapKindsOf(initiatorAnswers[item.id], counterpartyAnswers[item.id]),
      }));

    // Snapshots taken *before* the derivation: the answers themselves, not just the Gaps.
    const snapshot = (answers: Record<string, Opinions>): Record<string, Opinions> =>
      Object.fromEntries(Object.entries(answers).map(([id, opinions]) => [id, { ...opinions }]));
    const initiatorBefore = snapshot(initiatorAnswers);
    const counterpartyBefore = snapshot(counterpartyAnswers);
    const gapsBefore = gapsOf();
    // Both Settings before and after, compared like for like. Comparing Soft-before against
    // Full-after would still pass if a Step had shifted a Gap, because the two Settings tolerate
    // different distances — so the same Setting is used on both sides.
    const softBefore = instanceAlignment(gapsBefore, "soft");
    const fullBefore = instanceAlignment(gapsBefore, "full");

    const steps = derive();
    assert.ok(steps.length > 0, "the derivation actually ran");

    const gapsAfter = gapsOf();
    const softAfter = instanceAlignment(gapsAfter, "soft");
    const fullAfter = instanceAlignment(gapsAfter, "full");

    // The derivation read the answers and wrote nothing: the maps are untouched, so the Gaps are
    // recomputed from exactly the same inputs.
    assert.deepEqual(initiatorAnswers, initiatorBefore, "deriving mutated no initiator opinion");
    assert.deepEqual(
      counterpartyAnswers,
      counterpartyBefore,
      "deriving mutated no counterparty opinion",
    );
    assert.deepEqual(gapsAfter, gapsBefore, "the Gaps are the same numbers after deriving");

    for (const [label, before, after] of [
      ["Soft", softBefore, softAfter],
      ["Full", fullBefore, fullAfter],
    ] as const) {
      assert.deepEqual(
        { unmet: after.unmet, aligned: after.aligned },
        { unmet: before.unmet, aligned: before.aligned },
        `the verdict re-derives identically under ${label}`,
      );
    }
    assert.equal(softBefore.aligned, false, "three-wide Gaps are unmet under Soft too");
  });
});

/* ------------------------------------------------------------------ *
 * 6 — the merge, the tick, the rewrite and the closed row
 * ------------------------------------------------------------------ */

describe("storing progress", () => {
  it("adds only what is new, and never rewrites a recorded Step", () => {
    const first = derive();
    const ticked = withStepStatus(first, first[0].id, "done");
    assert.equal(ticked[0].status, "done");
    assert.equal(ticked.length, first.length);

    // A later session: the counterparty's wish moved on SHARED, so that Aspect now has a Gap and
    // earns its one Step. DIVIDED is answered the same way, so its Step already exists.
    const laterCounterparty: Record<string, Opinions> = {
      [DIVIDED.id]: { feel: 5, wish: 2 },
      [SHARED.id]: { feel: 4, wish: 5 },
    };
    const derivedLater = derive([DIVIDED, SHARED], { counterparty: laterCounterparty });
    const added = stepsToAdd(ticked, derivedLater);
    assert.deepEqual(
      added.map((step) => step.aspectId),
      [SHARED.id],
      "the only new Step is the one on the Aspect that just opened",
    );
    assert.equal(derivedLater.length, 2, "one Step per Aspect, so DIVIDED did not duplicate");

    // The stored row keeps the words and the tick it was given, not the later session's.
    const stored = ticked[0];
    assert.equal(stored.status, "done");
    assert.equal(stored.text, first[0].text);
  });

  it("closes a stored Step whose Gap has fallen to 0, and never resurrects it", () => {
    const first = derive();
    const later = derive([DIVIDED, SHARED], {
      initiator: agreedAnswers,
      counterparty: agreedAnswers,
      createdAt: "2026-12-01T12:00:00.000Z",
    });
    assert.deepEqual(later, [], "both parties now agree on every Aspect");

    const closed = closeSteps(first, {
      relationshipId: "rel-test",
      items: [DIVIDED, SHARED],
      initiatorAnswers: agreedAnswers,
      counterpartyAnswers: agreedAnswers,
      createdAt: "2026-12-01T12:00:00.000Z",
    });
    assert.notEqual(closed, first, "closing is a write");
    assert.equal(closed[0].status, "closed");
    // History keeps everything else: the words agreed, the suggestion, the instant.
    assert.equal(closed[0].text, first[0].text);
    assert.equal(closed[0].suggestedText, first[0].suggestedText);
    assert.equal(closed[0].createdAt, first[0].createdAt);

    // A later re-derivation finds the Step by its per-Aspect id and adds nothing: the closed row
    // stays closed even though the Gap is wide again.
    const reopenedGap = derive();
    assert.deepEqual(stepsToAdd(closed, reopenedGap), [], "a closed Step is not resurrected");
    assert.equal(closed[0].status, "closed");
    // …and a party's tick cannot reopen it either.
    assert.equal(withStepStatus(closed, closed[0].id, "done"), closed);
    // Nor can a reword pretend it is still live.
    assert.equal(withStepText(closed, closed[0].id, "Something else"), closed);
  });

  it("closes only open, derived Steps on Aspects that were actually measured", () => {
    const first = derive();
    const authored = authoredStepOf({
      relationshipId: "rel-test",
      aspectId: DIVIDED.id,
      text: "Ask once a month whether this is still working.",
      existing: first,
      createdAt: "2026-11-02T09:00:00.000Z",
    });
    const doneFirst = withStepStatus(first, first[0].id, "done");
    const input = {
      relationshipId: "rel-test",
      items: [DIVIDED, SHARED],
      initiatorAnswers: agreedAnswers,
      counterpartyAnswers: agreedAnswers,
      createdAt: "2026-12-01T12:00:00.000Z",
    };

    // A done Step keeps its tick: the work happened, and closing it would read as a regression.
    assert.equal(closeSteps(doneFirst, input), doneFirst);
    // An authored Step came from no Gap, so no Gap falling to 0 closes it.
    const withAuthored = closeSteps([...first, authored], input);
    assert.equal(withAuthored.find((step) => step.id === authored.id)?.status, "open");
    // A Step on an Aspect that is no longer on the sheet is absent, not 0: it stays as it was.
    assert.equal(closeSteps(first, { ...input, items: [SHARED] }), first);
    // A Step on an Aspect nobody answered this session is unknown, not 0: it stays as it was.
    assert.equal(
      closeSteps(first, { ...input, counterpartyAnswers: agreedAnswers, items: [] }),
      first,
    );
    // Nothing to close: the same array comes back, so a completion that closes nothing is not a write.
    assert.equal(closeSteps(first, { ...input, initiatorAnswers, counterpartyAnswers }), first);
  });

  it("closes the met Gap and adds the newly opened one in the same completion", () => {
    const first = derive();
    const laterInitiator: Record<string, Opinions> = {
      [DIVIDED.id]: { feel: 4, wish: 4 },
      [SHARED.id]: { feel: 1, wish: 3 },
    };
    const laterCounterparty: Record<string, Opinions> = {
      [DIVIDED.id]: { feel: 4, wish: 4 },
      [SHARED.id]: { feel: 5, wish: 3 },
    };
    const input = {
      relationshipId: "rel-test",
      items: [DIVIDED, SHARED],
      initiatorAnswers: laterInitiator,
      counterpartyAnswers: laterCounterparty,
      createdAt: "2026-12-01T12:00:00.000Z",
    };
    const closed = closeSteps(first, input);
    const steps = [...closed, ...stepsToAdd(closed, deriveSteps(input))];
    assert.equal(steps.length, 2, "one closed, one new");
    assert.equal(steps[0].status, "closed");
    assert.equal(steps[0].aspectId, DIVIDED.id);
    assert.equal(steps[1].status, "open");
    assert.equal(steps[1].aspectId, SHARED.id);
    // |1−5| = 4 feel, |3−3| = 0 wish, and 2 on each party's own Feel-against-Wish: feel is widest.
    assert.deepEqual(steps[1].derivedFrom, ["feel"]);
  });

  it("rewords the text and leaves the suggestion alone", () => {
    const steps = derive();
    const reworded = withStepText(
      steps,
      steps[0].id,
      "  Agree the week's three priorities on Monday.  ",
    );
    assert.equal(reworded[0].text, "Agree the week's three priorities on Monday.");
    assert.equal(
      reworded[0].suggestedText,
      steps[0].suggestedText,
      "the sentence the product proposed is kept",
    );
    // No-ops come back by identity: nothing to save, nothing to bump.
    assert.equal(withStepText(reworded, steps[0].id, "   "), reworded);
    assert.equal(withStepText(reworded, steps[0].id, reworded[0].text), reworded);
    assert.equal(withStepText(reworded, "step-not-here", "Anything"), reworded);
  });

  it("counts progress, keeps closed rows out of the denominator, and moves a Step both ways", () => {
    const steps = derive();
    assert.deepEqual(stepProgressOf(steps), { total: 1, done: 0, closed: 0, active: 1 });
    const done = withStepStatus(steps, steps[0].id, "done");
    assert.deepEqual(stepProgressOf(done), { total: 1, done: 1, closed: 0, active: 1 });
    const undone = withStepStatus(done, steps[0].id, "open");
    assert.deepEqual(stepProgressOf(undone), { total: 1, done: 0, closed: 0, active: 1 });
    // An unknown id is not a write: the array comes back by identity.
    assert.equal(withStepStatus(steps, "step-not-here", "done"), steps);

    const closed = closeSteps(steps, {
      relationshipId: "rel-test",
      items: [DIVIDED],
      initiatorAnswers: agreedAnswers,
      counterpartyAnswers: agreedAnswers,
      createdAt: "2026-12-01T12:00:00.000Z",
    });
    assert.deepEqual(
      stepProgressOf(closed),
      { total: 1, done: 0, closed: 1, active: 0 },
      "a closed Step is history, not outstanding work",
    );
  });
});

/* ------------------------------------------------------------------ *
 * 7 — the fixtures agree with the rule
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
      assert.ok(
        rel.steps.length <= rel.items.length,
        `"${rel.id}" holds more Steps than Aspects — the bound is one per Aspect`,
      );
      for (const step of rel.steps) {
        const kind = step.derivedFrom[0] as GapKind;
        assert.equal(step.derivedFrom.length, 1, `"${rel.id}" stores a Step with no source kind`);
        const gaps = gapKindsOf(
          rel.initiatorAnswers[step.aspectId],
          rel.counterpartyAnswers[step.aspectId],
        );
        const gap = gaps[kind];
        assert.ok(gap !== undefined && gap > 0, `"${rel.id}" stores a Step for a zero Gap`);
        assert.equal(
          gap,
          Math.max(...gapKindsIn(gaps).map((other) => gaps[other] ?? 0)),
          `"${rel.id}" stores a Step for a kind that is not the widest on its Aspect`,
        );
        assert.match(step.text, new RegExp(`${GAP_KIND_LABELS[kind]} of ${gap}`));
        // No fixture has been reworded: the text is still the model's suggestion.
        assert.equal(step.suggestedText, step.text, `"${rel.id}" stores a Step with no suggestion`);
      }
    }
  });

  it("gives the aligned pair three Steps — the ties resolve to the glossary's order", () => {
    const aligned = byId("rel-aligned");
    assert.deepEqual(
      aligned.steps.map((step) => `${step.aspectId}:${step.derivedFrom[0]}`),
      ["aspect-trust:wish", "aspect-one-to-one:initiator", "aspect-privacy:initiator"],
      "every Gap here is 1, so each Aspect's earliest widest kind wins",
    );
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

  it("gives an Advanced relationship one Step per Aspect, widest kind each", () => {
    const advanced = byId("rel-advanced");
    assert.deepEqual(
      advanced.steps.map((step) => step.derivedFrom[0]),
      ["feel", "feel", "wish", "wish"],
      "the widest kind per Aspect, with the 4-wide ties on trust resolving to feel",
    );
    const kinds = new Set(advanced.steps.map((step) => step.derivedFrom[0]));
    assert.ok(kinds.has("feel") && kinds.has("wish"));
  });

  it("leaves a session that is not complete with no Steps", () => {
    // Submitted but not accepted: the blind rule still holds and nothing has been agreed.
    assert.deepEqual(byId("rel-sharing-unmet").steps, []);
    assert.deepEqual(byId("rel-invited").steps, []);
  });
});
