/**
 * `lib/relationship/edit.ts` (#623) — the field census and the invalidation arithmetic, over values.
 *
 * The write path is one transaction and therefore a bad place to discover that a cost is computed
 * wrongly: a person either loses answers they were not told about, or is asked to confirm a cost
 * that is not real. So every branch below — the four codes, the two severities, the per-seat
 * sentence data and the "nothing changed" answer — is pinned here, with no database.
 */
import { describe, expect, it } from "vitest";

import {
  EDITABLE_FIELDS,
  blockedOf,
  fieldOf,
  invalidationsOf,
  isNoChange,
  pinDiff,
  refusalFor,
  statedOf,
  type AnswerTally,
  type EditAspect,
  type EditSnapshot,
} from "@/lib/relationship/edit";

const ASPECT_A: EditAspect = {
  id: "a1",
  prompt: "How we talk",
  leftValue: "Closed",
  rightValue: "Open",
};
const ASPECT_B: EditAspect = {
  id: "a2",
  prompt: "Chores",
  leftValue: "Mine",
  rightValue: "Shared",
};
const ASPECT_C: EditAspect = {
  id: "a3",
  prompt: "Money",
  leftValue: "Careful",
  rightValue: "Generous",
};

function snapshot(overrides: Partial<EditSnapshot> = {}): EditSnapshot {
  return {
    title: "Avery & Rowan",
    summary: "Two sheets",
    mode: "basic",
    setting: "soft",
    aspects: [ASPECT_A, ASPECT_B],
    ...overrides,
  };
}

/** Two seats, two answers each on `a1`, one answer on `a2` — the shape the owner's sentence uses. */
const ANSWERS: AnswerTally[] = [
  { aspectId: "a1", role: "initiator", name: "Avery", answers: 1 },
  { aspectId: "a1", role: "counterparty", name: "Rowan", answers: 1 },
  { aspectId: "a2", role: "initiator", name: "Avery", answers: 1 },
];

describe("the field census", () => {
  it("names the five columns the issue measured as writerless, each with a policy", () => {
    for (const id of [
      "template_version_id",
      "completed_at",
      "void_reason",
      "expired_at",
      "lapse_reason",
    ]) {
      // The census keys two of them by their column name under another field id; the point of the
      // case is that the *column* is in the table, so the columns are what is searched.
      const found = EDITABLE_FIELDS.some((field) => field.writes.includes(`relationship.${id}`));
      expect(found, id).toBe(true);
    }
  });

  it("never offers a hand-set state column", () => {
    for (const id of ["completed_at", "expired_at", "void_reason", "lapse_reason", "status"]) {
      const field = fieldOf(id);
      expect(field, id).toBeDefined();
      expect(field?.policy.kind, id).toBe("locked");
    }
  });

  it("lets the pin move only as a stated cost", () => {
    expect(fieldOf("version-pin")?.policy.kind).toBe("stated-cost");
    expect(fieldOf("version-pin")?.writes).toContain("relationship.template_version_id");
  });

  it("locks mode and setting to the session's immutability", () => {
    expect(fieldOf("mode")?.policy).toEqual({
      kind: "locked",
      reason: "session-immutable",
    });
    expect(fieldOf("setting")?.policy).toEqual({
      kind: "locked",
      reason: "session-immutable",
    });
  });
});

describe("invalidationsOf", () => {
  it("states a removal's real cost per seat, never a value", () => {
    const [cost] = invalidationsOf({
      before: snapshot(),
      after: snapshot({ aspects: [ASPECT_A] }),
      answers: [{ aspectId: "a2", role: "initiator", name: "Avery", answers: 2 }],
      sessionExists: true,
    });
    expect(cost?.code).toBe("discards-answers");
    expect(cost?.severity).toBe("stated");
    expect(cost?.aspectId).toBe("a2");
    expect(cost?.total).toBe(2);
    expect(cost?.seats).toEqual([{ role: "initiator", name: "Avery", answers: 2 }]);
  });

  it("sums both seats when both answered the Aspect", () => {
    const [cost] = invalidationsOf({
      before: snapshot(),
      after: snapshot({ aspects: [ASPECT_B] }),
      answers: ANSWERS.slice(0, 2),
      sessionExists: true,
    });
    expect(cost?.total).toBe(2);
    expect(cost?.seats.map((seat) => seat.name)).toEqual(["Avery", "Rowan"]);
  });

  it("charges nothing for removing an Aspect nobody answered", () => {
    expect(
      invalidationsOf({
        before: snapshot(),
        after: snapshot({ aspects: [ASPECT_B] }),
        answers: [],
        sessionExists: true,
      }),
    ).toEqual([]);
  });

  it("states a rewording on an answered Aspect", () => {
    const reworded = { ...ASPECT_A, prompt: "How we actually talk" };
    const [cost] = invalidationsOf({
      before: snapshot(),
      after: snapshot({ aspects: [reworded, ASPECT_B] }),
      answers: ANSWERS.slice(0, 2),
      sessionExists: true,
    });
    expect(cost?.code).toBe("rewrites-question");
    expect(cost?.total).toBe(2);
  });

  it("blocks a new Aspect on a sheet that exists, and allows it while nothing does", () => {
    const added = snapshot({ aspects: [ASPECT_A, ASPECT_B, ASPECT_C] });
    const blocked = invalidationsOf({
      before: snapshot(),
      after: added,
      answers: ANSWERS,
      sessionExists: true,
    });
    expect(blockedOf(blocked)?.code).toBe("adds-question");
    expect(refusalFor(blockedOf(blocked)!)).toBe("answers-sealed");

    const draft = invalidationsOf({
      before: snapshot(),
      after: added,
      answers: [],
      sessionExists: false,
    });
    expect(blockedOf(draft)).toBeUndefined();
    expect(statedOf(draft).map((cost) => cost.code)).toEqual(["adds-question"]);
  });

  it("blocks a mode or Setting move once the session exists — V18's rule, not a preference", () => {
    const moved = invalidationsOf({
      before: snapshot(),
      after: snapshot({ mode: "advanced", setting: "full" }),
      answers: [],
      sessionExists: true,
    });
    expect(moved.map((cost) => cost.code)).toEqual(["changes-mode", "changes-setting"]);
    expect(refusalFor(moved[0]!)).toBe("mode-fixed");
  });

  it("says nothing about mode or setting when no session exists yet", () => {
    expect(
      invalidationsOf({
        before: snapshot(),
        after: snapshot({ mode: "advanced", setting: "full" }),
        answers: [],
        sessionExists: false,
      }),
    ).toEqual([]);
  });

  it("orders the discards before the rewordings — most expensive first", () => {
    const reworded = { ...ASPECT_A, leftValue: "Shut" };
    const costs = invalidationsOf({
      before: snapshot({ aspects: [ASPECT_A, ASPECT_B, ASPECT_C] }),
      after: snapshot({ aspects: [reworded] }),
      answers: [
        { aspectId: "a1", role: "initiator", name: "Avery", answers: 1 },
        { aspectId: "a2", role: "counterparty", name: "Rowan", answers: 1 },
        { aspectId: "a3", role: "initiator", name: "Avery", answers: 1 },
      ],
      sessionExists: true,
    });
    expect(costs.map((cost) => cost.code)).toEqual([
      "discards-answers",
      "discards-answers",
      "rewrites-question",
    ]);
    expect(costs.map((cost) => cost.aspectId)).toEqual(["a2", "a3", "a1"]);
  });
});

describe("isNoChange and pinDiff", () => {
  it("sees a rename, a reorder and an untouched form", () => {
    expect(isNoChange(snapshot(), snapshot())).toBe(true);
    expect(isNoChange(snapshot(), snapshot({ title: "Other" }))).toBe(false);
    expect(isNoChange(snapshot(), snapshot({ aspects: [ASPECT_B, ASPECT_A] }))).toBe(false);
    expect(isNoChange(snapshot(), snapshot({ aspects: [ASPECT_A] }))).toBe(false);
  });

  it("returns what a pin move adds and removes", () => {
    const diff = pinDiff([ASPECT_A, ASPECT_B], [ASPECT_A, ASPECT_C]);
    expect(diff.added.map((aspect) => aspect.id)).toEqual(["a3"]);
    expect(diff.removed.map((aspect) => aspect.id)).toEqual(["a2"]);
  });
});
