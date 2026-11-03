/**
 * The admin ladder and the action gate (#501), driven with no database, no session and no clock.
 *
 * Two claims, and they are the ones `lib/admin/act.ts` relies on before it writes anything:
 *
 *   1. **The ladder is an order.** Every rung passes every gate below it, and `owner` passes the
 *      `admin` gate without a call site naming it — #183 answered that question with equality,
 *      and #501 retires equality in favour of rank.
 *   2. **The action table is exhaustive and its floors hold.** Each action is asserted against the
 *      rung that just clears it and the rung that does not, so a floor that moved one way or the
 *      other fails here rather than in a 404 an operator has to reproduce.
 */
import { describe, expect, it } from "vitest";

import { roleAdmits, roleRank, USER_ROLES, type UserRole, zUserRole } from "@/content/identity";
import {
  ACTION_REQUIREMENTS,
  ADMIN_ACTIONS,
  atLeast,
  can,
  isAdminAction,
  requirementFor,
  ROLE_LADDER,
} from "@/lib/admin/roles";

/** The rung one below `role`, or `null` for the bottom one. The failure side of every case. */
function rungBelow(role: UserRole): UserRole | null {
  const index = roleRank(role);
  return index === 0 ? null : (USER_ROLES[index - 1] as UserRole);
}

describe("the role ladder", () => {
  it("is member < support < admin < owner, in that order", () => {
    expect(ROLE_LADDER).toEqual(["member", "support", "admin", "owner"]);
    expect(USER_ROLES.map((role) => roleRank(role))).toEqual([0, 1, 2, 3]);
  });

  it("admits an equal or higher rung on a surface gate, and never a lower one", () => {
    for (const needed of USER_ROLES) {
      for (const viewer of USER_ROLES) {
        expect(roleAdmits(needed, viewer), `${viewer} vs ${needed}`).toBe(
          roleRank(viewer) >= roleRank(needed),
        );
      }
    }
  });

  it("admits an owner where an admin is required — the widening #501 makes", () => {
    expect(roleAdmits("admin", "owner")).toBe(true);
    expect(roleAdmits("admin", "support")).toBe(false);
    expect(roleAdmits("owner", "owner")).toBe(true);
  });

  it("treats nobody signed in as below every rung", () => {
    for (const needed of USER_ROLES) expect(roleAdmits(needed, null)).toBe(false);
    for (const action of ADMIN_ACTIONS) expect(can(null, action)).toBe(false);
  });

  it("parses the four rungs and refuses a role that is not one", () => {
    for (const role of USER_ROLES) expect(zUserRole.safeParse(role).success).toBe(true);
    expect(zUserRole.safeParse("superuser").success).toBe(false);
  });
});

describe("can()", () => {
  it("clears each action at its floor and refuses it one rung below", () => {
    for (const action of ADMIN_ACTIONS) {
      const floor = requirementFor(action);
      expect(can(floor, action), `${floor} may ${action}`).toBe(true);
      const below = rungBelow(floor);
      if (below !== null) expect(can(below, action), `${below} may not ${action}`).toBe(false);
    }
  });

  it("refuses support the one action this card's test names: a role change", () => {
    expect(can("support", "role.change")).toBe(false);
    expect(can("admin", "role.change")).toBe(true);
    expect(requirementFor("role.change")).toBe("admin");
  });

  it("lets an admin do everything a support seat may do, and nothing an owner alone may", () => {
    for (const action of ADMIN_ACTIONS) {
      if (requirementFor(action) === "owner") {
        expect(can("admin", action), `admin must not ${action}`).toBe(false);
      } else {
        expect(can("admin", action), `admin should ${action}`).toBe(true);
      }
    }
  });

  it("keeps the ownership transfer above every other rung, and known", () => {
    expect(requirementFor("owner.transfer")).toBe("owner");
    expect(can("owner", "owner.transfer")).toBe(true);
    expect(can("admin", "owner.transfer")).toBe(false);
  });

  it("refuses a member every action, because every floor is support or above", () => {
    for (const action of ADMIN_ACTIONS) expect(can("member", action)).toBe(false);
  });

  it("has a floor for every action in the catalogue and no orphan floor", () => {
    expect(Object.keys(ACTION_REQUIREMENTS).sort()).toEqual([...ADMIN_ACTIONS].sort());
    for (const action of ADMIN_ACTIONS) {
      expect(ROLE_LADDER).toContain(requirementFor(action));
    }
  });

  it("recognises only catalogue names as actions", () => {
    for (const action of ADMIN_ACTIONS) expect(isAdminAction(action)).toBe(true);
    expect(isAdminAction("role.promote")).toBe(false);
    expect(isAdminAction("")).toBe(false);
  });
});

describe("atLeast()", () => {
  it("is the bare ladder comparison, for callers with no action in hand", () => {
    expect(atLeast("owner", "admin")).toBe(true);
    expect(atLeast("support", "admin")).toBe(false);
    expect(atLeast(null, "member")).toBe(false);
  });
});
