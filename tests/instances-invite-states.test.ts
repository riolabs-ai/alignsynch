/**
 * Every `InviteDisplayState` has a label on the relationships list.
 *
 * This is the guard for a production 500 (`/assessment/instances`, 2026-11-02): the list row
 * renders `itemLabel(inviteCopy, instance.inviteState)`, the fixture still carried an older
 * design's names (`not-sent` / `pending` / `expired` / `accepted`), and the first row with a
 * live unclaimed invitation threw `PageCopy: section "invite" has no item "unclaimed"` — at
 * render time, in production, for every viewer.
 *
 * The failure mode is worth naming: a copy fixture and a union type that are supposed to agree,
 * with nothing asserting that they do. `typecheck` cannot see it (the id is a string), the
 * database cannot see it (the state is computed), and the gate builds no page with a row in
 * that state. So the assertion lives here, against the union itself — add a state to
 * `INVITE_STATES` and this fails until the fixture grows the label.
 */
import { describe, expect, it } from "vitest";

import { myInstancesPageCopy } from "@/data/pages/assessment-instances";
import { INVITE_STATES } from "@/lib/flow/invite-state";
import { itemLabel, sectionOf } from "@/lib/page-copy";

describe("the relationships list — invite state labels", () => {
  const inviteCopy = sectionOf(myInstancesPageCopy, "invite");

  it("has an item for every state the row can render", () => {
    const missing = INVITE_STATES.filter((state) => {
      try {
        itemLabel(inviteCopy, state);
        return false;
      } catch {
        return true;
      }
    });

    // Named, not counted: "1 missing" would pass with the wrong one missing.
    expect(missing, `no label for invite state(s): ${missing.join(", ")}`).toEqual([]);
  });

  it("carries no item the code can no longer produce", () => {
    const known = new Set<string>(INVITE_STATES);
    const stale = (inviteCopy.items ?? []).map((item) => item.id).filter((id) => !known.has(id));

    // A leftover name is how the fixture drifted in the first place: it looked complete.
    expect(stale, `stale invite item(s): ${stale.join(", ")}`).toEqual([]);
  });

  it("renders a real sentence, not an id, for each state", () => {
    for (const state of INVITE_STATES) {
      const label = itemLabel(inviteCopy, state);
      expect(label.length, `${state} has an empty label`).toBeGreaterThan(0);
      expect(label, `${state} leaked its id as the label`).not.toBe(state);
    }
  });
});
