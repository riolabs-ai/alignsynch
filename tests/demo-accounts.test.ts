/**
 * The panel's three buttons map to the three seeded addresses (#183, part 2).
 *
 * The point of pinning the mapping is that it is the one place a label, an address and a role
 * meet, and `scripts/db-seed.mjs` writes the other side of the contract. A rename in one file
 * that is not a rename in the other would be a panel whose third button signs in as nobody —
 * and the failure would only appear against a seeded branch.
 *
 * The domain is checked too: `0005_demo_account.sql` pins it with a CHECK, so an address here
 * outside `@demo.alignsynch.test` is a mapping the database would refuse to hold.
 */
import { describe, expect, it } from "vitest";

import {
  DEMO_ACCOUNT_EMAILS,
  DEMO_ACCOUNT_ROLES,
  DEMO_INSTANCE_ID,
  DEMO_PANEL_LABELS,
  DEMO_PANEL_ROLES,
  demoPanelRoleOf,
  destinationFor,
} from "@/lib/auth/demo-accounts";

describe("the demo panel's buttons", () => {
  it("has exactly the three the card names", () => {
    expect([...DEMO_PANEL_ROLES]).toEqual(["initiator", "counterparty", "admin"]);
    expect(DEMO_PANEL_ROLES.map((role) => DEMO_PANEL_LABELS[role])).toEqual([
      "Initiator",
      "Counterparty",
      "Admin",
    ]);
  });

  it("names the addresses db:seed creates, all on the pinned domain", () => {
    expect(DEMO_ACCOUNT_EMAILS).toEqual({
      initiator: "initiator@demo.alignsynch.test",
      counterparty: "counterparty@demo.alignsynch.test",
      admin: "admin@demo.alignsynch.test",
    });
    for (const email of Object.values(DEMO_ACCOUNT_EMAILS)) {
      expect(email.endsWith("@demo.alignsynch.test")).toBe(true);
    }
  });

  it("signs in two members and one admin", () => {
    expect(DEMO_ACCOUNT_ROLES).toEqual({
      initiator: "member",
      counterparty: "member",
      admin: "admin",
    });
  });

  it("rejects anything that is not one of the three", () => {
    for (const value of ["Initator", "", "INFERRED", "member", null, undefined]) {
      expect(demoPanelRoleOf(value)).toBeUndefined();
    }
    for (const role of DEMO_PANEL_ROLES) {
      expect(demoPanelRoleOf(role)).toBe(role);
    }
  });

  it("lands the two parties on the shared instance and the admin on the admin check", () => {
    expect(destinationFor("initiator")).toBe(`/assessment/instances/${DEMO_INSTANCE_ID}`);
    expect(destinationFor("counterparty")).toBe(`/assessment/instances/${DEMO_INSTANCE_ID}`);
    // The admin answers no instance, so there is nothing blind for it to read.
    expect(destinationFor("admin")).toBe("/demo/admin");
  });
});
