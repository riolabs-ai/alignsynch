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
  AUDIT_TARGET_TABLES,
  type AdminAction,
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

  it("lets a member take exactly the six initiator actions, and nothing else", () => {
    // #533 phase 2 lowered five names to `member`: the member's own template and relationship
    // writes, audited through the same `act()` the staff path uses. #619 added the sixth —
    // `relationship.complete`, the payer taking the fee — because the member whose card it is must
    // be able to finish their own relationship. Every other action keeps its support-or-above
    // floor, so this list is the whole of what a non-staff seat may take — and it is pinned by
    // name, so a seventh rung being lowered is a decision somebody makes here.
    const memberFloor = ADMIN_ACTIONS.filter((action) => requirementFor(action) === "member");
    expect([...memberFloor].sort()).toEqual([
      "relationship.aspects",
      "relationship.complete",
      "relationship.create",
      "relationship.publish",
      "relationship.republish",
      "template.draft",
    ]);
    for (const action of ADMIN_ACTIONS) {
      expect(can("member", action), action).toBe(memberFloor.includes(action));
    }
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

/**
 * The five relationship operations of #503, named one by one.
 *
 * The cases above already prove that every action clears its own floor and refuses the rung below
 * it. This block is narrower on purpose: #503 is the card that introduced four of these names, and
 * its policy is easier to review as a table than as a loop — `support` may repair a marker or
 * reissue a link, and anything that ends a relationship or speaks for a person needs `admin`.
 */
describe("the #503 relationship operations", () => {
  /** `action` → the rung that clears it, and the rung that does not. The policy, in one place. */
  const OPERATIONS: readonly (readonly [AdminAction, UserRole, UserRole | null])[] = [
    ["party.unlock", "support", "member"],
    ["invite.resend", "support", "member"],
    ["invite.revoke", "admin", "support"],
    ["session.void", "admin", "support"],
    ["instance.force-close", "admin", "support"],
  ];

  it("records exactly these floors — five actions, two rungs", () => {
    for (const [action, floor] of OPERATIONS) {
      expect(requirementFor(action), `${action}'s floor`).toBe(floor);
    }
  });

  it("lets support repair a marker and a link, and nothing that ends or speaks for a party", () => {
    expect(can("support", "party.unlock")).toBe(true);
    expect(can("support", "invite.resend")).toBe(true);
    // A revoke kills a live link until somebody reissues it; a void and a force-close end a
    // relationship or write a person's agreement for them. All three are `admin`.
    expect(can("support", "invite.revoke")).toBe(false);
    expect(can("support", "session.void")).toBe(false);
    expect(can("support", "instance.force-close")).toBe(false);
  });

  it("lets admin and owner take all five, and a member none of them", () => {
    for (const [action] of OPERATIONS) {
      expect(can("admin", action), `admin may ${action}`).toBe(true);
      expect(can("owner", action), `owner may ${action}`).toBe(true);
      expect(can("member", action), `member may not ${action}`).toBe(false);
      expect(can(null, action), `nobody may ${action}`).toBe(false);
    }
  });

  it("refuses each operation one rung below its floor, and nothing higher", () => {
    for (const [action, , below] of OPERATIONS) {
      if (below === null) continue;
      expect(can(below, action), `${below} may not ${action}`).toBe(false);
    }
  });

  it("keeps revoke at admin although #503 names no rung for it", () => {
    // The recorded ambiguity: #503's bullet pairs "resend / revoke an invite" and gives rungs for
    // the other four operations only. The stricter reading is `admin`, so a later widening to
    // `support` has to change this line and cite the issue that authorises it.
    expect(requirementFor("invite.revoke")).toBe("admin");
    expect(can("support", "invite.revoke")).toBe(false);
  });
});

describe("the audit target vocabulary", () => {
  it("names the tables the five operations write, and no table a migration renamed", () => {
    // party (unlock, force-close), session (void), session_invite (resend, revoke).
    expect(AUDIT_TARGET_TABLES).toContain("party");
    expect(AUDIT_TARGET_TABLES).toContain("session");
    expect(AUDIT_TARGET_TABLES).toContain("session_invite");

    // `0013_relationship_sessions.sql` renamed both of these; a list carrying either spelling
    // would refuse the write at runtime with `unknown-target-table`, having type-checked.
    expect(AUDIT_TARGET_TABLES as readonly string[]).not.toContain("instance_invite");
    expect(AUDIT_TARGET_TABLES as readonly string[]).not.toContain("assessment_instance");
  });
});
