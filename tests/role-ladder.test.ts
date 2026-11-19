/**
 * The stakeholder rung and the spec-reader set (#1252) — the two role rules the project spec's spine
 * rests on, driven with no database, no session and no clock.
 *
 * Three claims, in the order the bundle states them:
 *
 *   - **AS-01 — the ladder.** `stakeholder` sits *between* `member` and `support`, so every existing
 *     `roleAdmits("support" | "admin", …)` call still refuses it. That is the whole reason the rung
 *     goes there rather than above `support`: a reviewer's seat must not inherit a support seat's
 *     powers by ranking above it, and this file proves **every** action in `ACTION_REQUIREMENTS`
 *     refuses a stakeholder — not a sample of them, because a floor added later is the one a sample
 *     would miss.
 *   - **AS-02 — the capability.** `spec-read` is granted to an explicit set
 *     (`stakeholder`, `admin`, `owner`), never by rung, which is the only way `support` — one rung
 *     **above** stakeholder — can be excluded. The stakeholder carries no `admin-console`.
 *   - **AS-04 — the landing.** A stakeholder with nothing asked for lands on `/admin/spec`; admin
 *     and everyone else keep the brand's own page; a safe `next` wins; an unsafe one is dropped.
 *
 * The gate's *runtime* half (the 404 byte-for-byte, the `/login?next=` redirect) is
 * `tests/require-role.test.ts`; the rail's half is `tests/nav-menu.test.ts`. This file is the policy.
 */
import { describe, expect, it } from "vitest";

import { readsSpec, roleAdmits, roleRank, SPEC_READERS, USER_ROLES } from "@/content/role-ladder";
import { ACTION_REQUIREMENTS, ADMIN_ACTIONS, can } from "@/lib/admin/roles";
import { ADMIN_SPEC_PATH, adminSpecGroupPath } from "@/lib/admin/spec-paths";
import { NAV_CAPABILITIES, navViewer } from "@/lib/nav";
import { AFTER_SIGN_IN, signInLanding } from "@/lib/auth/paths";

describe("AS-01 — the ladder, with a stakeholder between member and support", () => {
  it("is the five rungs, lowest first", () => {
    expect(USER_ROLES).toEqual(["member", "stakeholder", "support", "admin", "owner"]);
  });

  /**
   * The bundle's own two lines, and the reason the rung is where it is: a stakeholder is a member's
   * better, and **nobody at support or above inherits the seat** — a member is admitted to the
   * stakeholder *surface*, and a stakeholder is not admitted to the support or admin ones.
   */
  it("admits a member to the stakeholder rung, and refuses support and admin", () => {
    // `roleAdmits(needed, viewer)`: the rung asked for comes first. A stakeholder clears the member
    // floor and does not clear support's or admin's — the bundle's own two lines.
    expect(roleAdmits("member", "stakeholder")).toBe(true);
    expect(roleAdmits("support", "stakeholder")).toBe(false);
    expect(roleAdmits("admin", "stakeholder")).toBe(false);
  });

  it("keeps every existing floor exactly where it was", () => {
    // #501's comparisons, unchanged by the insert: the rung went *below* support, so nothing that
    // gated on support, admin or owner moved.
    expect(roleAdmits("support", "support")).toBe(true);
    // An admin clears the support floor, and a support seat does not clear the admin one.
    expect(roleAdmits("support", "admin")).toBe(true);
    expect(roleAdmits("admin", "support")).toBe(false);
    expect(roleAdmits("admin", "admin")).toBe(true);
    // An owner clears the admin floor; an admin does not clear the owner's.
    expect(roleAdmits("admin", "owner")).toBe(true);
    expect(roleAdmits("owner", "admin")).toBe(false);
    expect(roleRank("support")).toBe(roleRank("stakeholder") + 1);
    expect(roleRank("stakeholder")).toBe(roleRank("member") + 1);
  });

  /**
   * **The card's MUST NOT, as a test.** A stakeholder inherits no admin action — every one of the
   * actions in the table, iterated rather than listed here, so an action added in a later card is
   * covered the moment it lands in `ACTION_REQUIREMENTS`. Eight of those rows are `member`-floored
   * (a member's own template draft and relationships), which is why the refusal is the seat's own
   * rule in `can()` rather than a consequence of the rank comparison.
   */
  it("gives a stakeholder no admin action at all", () => {
    expect(ADMIN_ACTIONS.length).toBeGreaterThan(0);
    for (const action of ADMIN_ACTIONS) {
      expect(can("stakeholder", action), `stakeholder may take "${action}"`).toBe(false);
    }
    // …and the floors themselves did not move down to meet the new rung.
    for (const action of ADMIN_ACTIONS) {
      expect(USER_ROLES).toContain(ACTION_REQUIREMENTS[action]);
    }
  });
});

describe("AS-02 — spec-read is an explicit set, never a rung", () => {
  it("is the three roles the bundle names, in ladder order", () => {
    expect(SPEC_READERS).toEqual(["stakeholder", "admin", "owner"]);
    // …and a reader set is not the ladder above a rung: support outranks stakeholder and is absent.
    expect(SPEC_READERS).not.toContain("support");
  });

  it("grants the capability to those three and to nobody else", () => {
    const READERS = USER_ROLES.filter((role) => readsSpec(role));
    expect(READERS).toEqual(["stakeholder", "admin", "owner"]);
    expect(readsSpec(null)).toBe(false);

    for (const role of USER_ROLES) {
      expect(navViewer(role).capabilities.has("spec-read"), `${role} and spec-read`).toBe(
        READERS.includes(role),
      );
    }
  });

  it("gives a stakeholder no admin-console, and support no spec-read", () => {
    expect(navViewer("stakeholder").capabilities.has("admin-console")).toBe(false);
    expect(navViewer("stakeholder").capabilities.has("spec-read")).toBe(true);
    expect(navViewer("support").capabilities.has("spec-read")).toBe(false);
    // The capability vocabulary itself is closed, so the document cannot name a fourth.
    expect([...NAV_CAPABILITIES]).toEqual(["quiz-surfaces", "admin-console", "spec-read"]);
  });
});

describe("AS-04 — where a sign-in lands, per role", () => {
  const ALIGNSYNCH_DESTINATION = "/dashboard";

  it("lands a stakeholder on the spec when nothing was asked for", () => {
    expect(ADMIN_SPEC_PATH).toBe("/admin/spec");
    expect(signInLanding("stakeholder", ALIGNSYNCH_DESTINATION, ALIGNSYNCH_DESTINATION)).toBe(
      ADMIN_SPEC_PATH,
    );
  });

  it("keeps admin, owner, support and member on the brand's own page", () => {
    for (const role of ["admin", "owner", "support", "member", null] as const) {
      expect(
        signInLanding(role, ALIGNSYNCH_DESTINATION, ALIGNSYNCH_DESTINATION),
        `${String(role)} was moved off the brand landing`,
      ).toBe(ALIGNSYNCH_DESTINATION);
    }
  });

  it("lets a safe next win, for every role", () => {
    const group = adminSpecGroupPath("07-billing");
    expect(group).toBe("/admin/spec/07-billing");
    for (const role of USER_ROLES) {
      expect(signInLanding(role, group, ALIGNSYNCH_DESTINATION)).toBe(group);
      expect(signInLanding(role, "/settings?tab=account", ALIGNSYNCH_DESTINATION)).toBe(
        "/settings?tab=account",
      );
    }
  });

  it("keeps the QuizHub landing untouched, for everyone who is not a stakeholder", () => {
    // The rule is per *role*, not per brand: the quiz brand's destination is still the answer for
    // every other seat, and only the new rung moves.
    expect(AFTER_SIGN_IN).toBe("/dashboard/user");
    for (const role of ["admin", "owner", "support", "member", null] as const) {
      expect(signInLanding(role, AFTER_SIGN_IN, AFTER_SIGN_IN)).toBe(AFTER_SIGN_IN);
    }
  });
});
