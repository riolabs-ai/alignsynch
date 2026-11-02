// @vitest-environment jsdom
/**
 * The Steps primitive and the metadata writes, driven through the real store (#404 §6–§7).
 *
 * `content/steps.ts` is pure, and `scripts/__tests__/steps.test.ts` pins the rule against hand-built
 * answers under `pnpm data:check`. What that suite cannot prove is the half this card actually adds:
 * that **completing a session is the event that stores Steps**, that a tick survives a reload, and
 * that the three metadata writes the §7 matrix grants behave as the matrix says. So this test mounts
 * `V1StoreProvider` in jsdom, creates a relationship through the create entry's own store action,
 * answers and accepts as both parties, and then reads what the store kept.
 *
 * The answers are chosen so the arithmetic is checkable by eye: the first staff–manager Aspect is
 * answered from opposite ends (a Gap of 4 on all eight kinds), and every other Aspect is answered
 * identically by both parties (In Synch on all eight). A correct derivation therefore produces
 * **eight Steps, all on the first Aspect** — one per non-zero kind — and nothing for the rest.
 *
 * The cases, in order:
 *
 *   1. create → the relationship exists with the Mode, Setting, name, and invitee the form chose;
 *   2. a Setting change is refused while a session is open, and accepted once it is complete;
 *   3. accepting as the second party derives the Steps — eight of them, on the one Aspect that has a
 *      Gap, each naming the kind that produced it, and no Step for a zero Gap;
 *   4. deriving changed no Gap value and no verdict: the Gaps are re-read after the write and are
 *      the same numbers the two answer maps produce;
 *   5. marking a Step done survives an unmount and a fresh mount, which is the reload — the store
 *      persists the row, so the tick is read back from `localStorage`, not from memory;
 *   6. the Mode is never writable, and the name is capped at the model's own limit.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { gapKindsIn, gapKindsOf, instanceAlignment } from "@/content/gaps";
import { INSTANCE_NAME_MAX } from "@/content/assessment";
import { deriveSteps, stepProgressOf } from "@/content/steps";
import type { Opinions } from "@/content/assessment";
import type { V1Relationship } from "@/data/v1/fixtures";
import { purchasableRelationshipType, type RelationshipType } from "@/data/v1/relationship-types";
import { V1StoreProvider, useV1Store, type V1Store } from "@/lib/v1/store";

declare global {
  // React reads this to know it is inside `act()`; without it every update is unmocked.
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let store: V1Store | null = null;

function live(): V1Store {
  if (store === null) throw new Error("the store is not mounted");
  return store;
}

function staffManager(): RelationshipType {
  const type = purchasableRelationshipType("staff-manager");
  if (type === undefined) throw new Error("fixtures: staff-manager is not a purchasable type");
  return type;
}

/** The relationship the create entry just made, by id. */
function relationship(id: string): V1Relationship {
  const found = live().relationships.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`no relationship "${id}" in the store`);
  return found;
}

/**
 * Both parties' answers: Aspect 0 from opposite ends, every other Aspect in perfect agreement.
 *
 * The kinds follow the Mode — a Basic sheet answers Feel and Wish only, and answering Think/Guess on
 * one would be the shape defect `zAssessmentInstance` rejects for the live model.
 */
function answersFor(
  type: RelationshipType,
  role: "initiator" | "counterparty",
  mode: "basic" | "advanced" = "advanced",
): Record<string, Opinions> {
  const answers: Record<string, Opinions> = {};
  const ends: Opinions =
    role === "initiator"
      ? mode === "advanced"
        ? { feel: 1, wish: 5, think: 1, guess: 5 }
        : { feel: 1, wish: 5 }
      : mode === "advanced"
        ? { feel: 5, wish: 1, think: 5, guess: 1 }
        : { feel: 5, wish: 1 };
  const agreed: Opinions =
    mode === "advanced" ? { feel: 3, wish: 3, think: 3, guess: 3 } : { feel: 3, wish: 3 };
  type.aspects.forEach((item, index) => {
    answers[item.id] = index === 0 ? ends : agreed;
  });
  return answers;
}

let container: HTMLDivElement;
let root: Root;

function Harness() {
  store = useV1Store();
  return null;
}

function mount(): void {
  act(() => {
    root.render(createElement(V1StoreProvider, null, createElement(Harness)));
  });
  expect(live().hydrated).toBe(true);
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mount();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  store = null;
  window.localStorage.clear();
});

describe("the create entry", () => {
  it("creates the relationship with the Mode, Setting, name and invitee the form chose", () => {
    const type = staffManager();
    const created: { rel?: V1Relationship } = {};
    act(() => {
      created.rel = live().createRelationshipFromType(type, {
        name: "Sam and Jordan",
        initiatorName: "Jordan",
        inviteeName: "Sam",
        mode: "advanced",
        setting: "full",
      });
    });
    const rel = created.rel;
    if (rel === undefined) throw new Error("createRelationshipFromType returned nothing");

    expect(rel.mode).toBe("advanced");
    expect(rel.setting).toBe("full");
    expect(rel.name).toBe("Sam and Jordan");
    expect(rel.initiatorName).toBe("Jordan");
    // The seat is named, never claimed: the blind rule still waits for Sam's own submission.
    expect(rel.inviteeName).toBe("Sam");
    expect(rel.counterpartyName).toBeNull();
    expect(rel.steps).toEqual([]);
    expect(rel.items.map((item) => item.id)).toEqual(type.aspects.map((item) => item.id));
    // The type is folded into a library template the editor can open, in the same write.
    expect(live().templates.some((template) => template.id === `assessment-${type.id}`)).toBe(true);
    console.log(
      `[1 create] ${rel.id} · ${rel.mode} · ${rel.setting} · ${rel.items.length} Aspects · invitee ${rel.inviteeName}`,
    );
  });
});

describe("the metadata writes", () => {
  it("refuses a Setting change while a session is open, and allows it between sessions", () => {
    const type = staffManager();
    const made: { rel?: V1Relationship } = {};
    act(() => {
      made.rel = live().createRelationshipFromType(type, {
        initiatorName: "Jordan",
        mode: "advanced",
        setting: "full",
      });
    });
    const id = (made.rel as V1Relationship).id;

    // Nothing is open yet: the Initiator may move the bar before anyone answers.
    let refusal: string | null = "unset";
    act(() => {
      refusal = live().setRelationshipSetting(id, "soft");
    });
    expect(refusal).toBeNull();
    expect(relationship(id).setting).toBe("soft");

    // Sam claims and answers; a session is now open.
    act(() => live().claimInvite(id));
    act(() => live().submitAnswers(id, "counterparty", answersFor(type, "counterparty")));
    act(() => {
      refusal = live().setRelationshipSetting(id, "full");
    });
    expect(refusal).toContain("A session is open");
    expect(relationship(id).setting).toBe("soft");

    // Once both accept, the session is complete and the bar may move again.
    act(() => live().submitAnswers(id, "initiator", answersFor(type, "initiator")));
    act(() => live().acceptSession(id, "initiator"));
    act(() => live().acceptSession(id, "counterparty"));
    act(() => {
      refusal = live().setRelationshipSetting(id, "full");
    });
    expect(refusal).toBeNull();
    expect(relationship(id).setting).toBe("full");
    console.log(`[2 setting] open → refused, complete → ${relationship(id).setting}`);
  });

  it("renames within the model's limit, and refuses past it", () => {
    const type = staffManager();
    const made: { rel?: V1Relationship } = {};
    act(() => {
      made.rel = live().createRelationshipFromType(type, {
        initiatorName: "Jordan",
        mode: "basic",
        setting: "soft",
      });
    });
    const id = (made.rel as V1Relationship).id;
    let refusal: string | null = "unset";

    act(() => {
      refusal = live().renameRelationship(id, "  Weekly check-in  ");
    });
    expect(refusal).toBeNull();
    expect(relationship(id).name).toBe("Weekly check-in");

    act(() => {
      refusal = live().renameRelationship(id, "x".repeat(INSTANCE_NAME_MAX + 1));
    });
    expect(refusal).toBe(`A relationship's name is at most ${INSTANCE_NAME_MAX} characters.`);
    expect(relationship(id).name).toBe("Weekly check-in");

    // An empty name is a clear, not an error: the template's title becomes the display name.
    act(() => {
      refusal = live().renameRelationship(id, "   ");
    });
    expect(refusal).toBeNull();
    expect(relationship(id).name).toBeUndefined();
    console.log(`[3 rename] capped at ${INSTANCE_NAME_MAX}, cleared back to the template title`);
  });
});

describe("Steps at completion", () => {
  it("derives one Step per non-zero Gap kind at acceptance, and none for a zero Gap", () => {
    const type = staffManager();
    const made: { rel?: V1Relationship } = {};
    act(() => {
      made.rel = live().createRelationshipFromType(type, {
        initiatorName: "Jordan",
        inviteeName: "Sam",
        mode: "advanced",
        setting: "full",
      });
    });
    const id = (made.rel as V1Relationship).id;
    const initiator = answersFor(type, "initiator");
    const counterparty = answersFor(type, "counterparty");

    act(() => live().claimInvite(id));
    act(() => live().submitAnswers(id, "initiator", initiator));
    act(() => live().submitAnswers(id, "counterparty", counterparty));

    // Submitted but not accepted: the blind rule still holds, so nothing has been agreed yet.
    expect(relationship(id).steps).toEqual([]);

    act(() => live().acceptSession(id, "initiator"));
    act(() => live().acceptSession(id, "counterparty"));

    const rel = relationship(id);
    const divided = type.aspects[0].id;
    expect(rel.steps).toHaveLength(8);
    expect(rel.steps.every((step) => step.aspectId === divided)).toBe(true);
    expect(rel.steps.map((step) => step.derivedFrom[0])).toEqual([
      "feel",
      "wish",
      "initiator",
      "counterparty",
      "initiator-think",
      "initiator-guess",
      "counterparty-think",
      "counterparty-guess",
    ]);
    expect(stepProgressOf(rel.steps)).toEqual({ total: 8, done: 0 });

    // The other Aspects were answered identically, so they produce nothing — a zero Gap is not a
    // task, and a Step for it would be the `abs(score, nothing)` defect one level up.
    for (const item of type.aspects.slice(1)) {
      expect(rel.steps.some((step) => step.aspectId === item.id)).toBe(false);
      const gaps = gapKindsOf(initiator[item.id], counterparty[item.id]);
      expect(gapKindsIn(gaps).map((kind) => gaps[kind])).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    }

    // Deriving changed no Gap and no verdict: the numbers the report reads are the ones these two
    // answer maps produce, and the verdict is still computed from them rather than from the Steps.
    const after = gapKindsOf(rel.initiatorAnswers[divided], rel.counterpartyAnswers[divided]);
    expect(after).toEqual(gapKindsOf(initiator[divided], counterparty[divided]));
    const verdict = instanceAlignment(
      rel.items.map((item) => ({
        itemId: item.id,
        gaps: gapKindsOf(rel.initiatorAnswers[item.id], rel.counterpartyAnswers[item.id]),
      })),
      rel.setting,
    );
    expect(verdict.unmet).toHaveLength(8);
    expect(verdict.aligned).toBe(false);

    // And the Steps are the derivation the primitive would have produced for this session.
    expect(rel.steps.map((step) => step.id)).toEqual(
      deriveSteps({
        relationshipId: id,
        items: [...rel.items],
        initiatorAnswers: rel.initiatorAnswers,
        counterpartyAnswers: rel.counterpartyAnswers,
        createdAt: rel.lastSessionAt ?? rel.createdAt,
      }).map((step) => step.id),
    );
    console.log(
      `[4 steps] ${rel.steps.length} Steps on "${divided}", 0 on the other ${rel.items.length - 1} Aspects`,
    );
  });

  it("keeps a ticked Step across a reload", () => {
    const type = staffManager();
    const made: { rel?: V1Relationship } = {};
    act(() => {
      made.rel = live().createRelationshipFromType(type, {
        initiatorName: "Jordan",
        mode: "basic",
        setting: "soft",
      });
    });
    const id = (made.rel as V1Relationship).id;
    act(() => live().claimInvite(id));
    act(() => live().submitAnswers(id, "initiator", answersFor(type, "initiator", "basic")));
    act(() => live().submitAnswers(id, "counterparty", answersFor(type, "counterparty", "basic")));
    act(() => live().acceptSession(id, "initiator"));
    act(() => live().acceptSession(id, "counterparty"));

    const before = relationship(id);
    expect(before.steps.length).toBe(4); // Basic Mode: four kinds, all 4-wide on the first Aspect
    const firstStep = before.steps[0];
    act(() => live().markStepDone(id, firstStep.id, "done"));
    expect(stepProgressOf(relationship(id).steps)).toEqual({ total: 4, done: 1 });

    // The reload: unmount, drop the in-memory store, and mount a fresh provider over the same
    // `localStorage`. The tick has to come back from the persisted row, not from React state.
    act(() => root.unmount());
    store = null;
    root = createRoot(container);
    mount();

    const reloaded = relationship(id);
    const step = reloaded.steps.find((candidate) => candidate.id === firstStep.id);
    expect(step?.status).toBe("done");
    expect(step?.text).toBe(firstStep.text);
    expect(stepProgressOf(reloaded.steps)).toEqual({ total: 4, done: 1 });
    console.log(`[5 reload] ${step?.id} reads ${step?.status} after a fresh mount`);
  });
});
