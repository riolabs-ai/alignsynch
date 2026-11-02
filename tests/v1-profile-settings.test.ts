/**
 * #384 — the profile and settings card's guarantees, as assertions rather than prose.
 *
 * Three things this card must not silently lose:
 *
 *  1. **The initiator-only section really is initiator-only** — the section list comes from one
 *     function, and that function is what the tab strip renders and what this test asserts.
 *  2. **A counterparty's settings render path names no money word.** The acceptance greps it; so
 *     does this test, over the exact files that path mounts. The initiator-only module is not in
 *     the list, because a counterparty's page never mounts it — `settingsSectionsFor` has no
 *     `subscription` row for them.
 *  3. **The profile's activity and milestones are derived, not authored.** Every row's instant is
 *     a field a fixture record carries, the two relationship fixtures read differently, and a
 *     persona who has earned nothing gets no badge rather than a greyed-out one.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { seedRelationships, seedSessions, v1Templates } from "@/data/v1/fixtures";
import { DASHBOARD_PERSONAS, personaFromHandle, personaHandle } from "@/lib/v1/persona";
import { profileActivityOf, profileMilestonesOf } from "@/lib/v1/profile";
import {
  SETTINGS_SECTIONS,
  SUBSCRIPTION_SECTION,
  settingsSectionsFor,
  sharedNotificationEventsFor,
} from "@/lib/v1/settings";
import { PAYER_NOTIFICATION_EVENTS } from "@/components/v1/subscription/subscription-settings";

const repoRoot = join(__dirname, "..");

function read(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

/* ------------------------------------------------------------------ *
 * Settings sections
 * ------------------------------------------------------------------ */

describe("settings sections are persona-scoped", () => {
  it("gives the initiator the subscription section and nobody else", () => {
    for (const persona of DASHBOARD_PERSONAS) {
      const sections = settingsSectionsFor(persona);
      if (persona === "initiator") {
        expect(sections).toContain(SUBSCRIPTION_SECTION);
        expect(sections).toEqual([...SETTINGS_SECTIONS, SUBSCRIPTION_SECTION]);
      } else {
        expect(sections).not.toContain(SUBSCRIPTION_SECTION);
        expect(sections).toEqual([...SETTINGS_SECTIONS]);
      }
    }
  });
});

/* ------------------------------------------------------------------ *
 * The notification vocabulary
 * ------------------------------------------------------------------ */

describe("notifications are the four events the product emits", () => {
  const idsFor = (persona: (typeof DASHBOARD_PERSONAS)[number]) => {
    const shared = sharedNotificationEventsFor(persona).map((event) => event.id);
    return persona === "initiator"
      ? [...shared, ...PAYER_NOTIFICATION_EVENTS.map((event) => event.id)]
      : shared;
  };

  it("shows the initiator all four events, the payer's last", () => {
    expect(idsFor("initiator")).toEqual([
      "inviteAccepted",
      "sessionScored",
      "newComment",
      "paymentFailed",
    ]);
  });

  it("offers no event the flow cannot produce", () => {
    const catalogue = new Set<string>();
    for (const persona of DASHBOARD_PERSONAS) {
      for (const id of idsFor(persona)) catalogue.add(id);
    }
    expect([...catalogue].sort()).toEqual([
      "inviteAccepted",
      "newComment",
      "paymentFailed",
      "sessionScored",
    ]);
  });

  it("offers the counterparty no invitation event — they send none", () => {
    expect(idsFor("counterparty")).not.toContain("inviteAccepted");
  });
});

/* ------------------------------------------------------------------ *
 * The counterparty's render path carries no money word
 * ------------------------------------------------------------------ */

describe("a counterparty's settings render path names no money word", () => {
  /**
   * Every module the counterparty's settings page mounts, derived from the tree rather than
   * listed by hand: the whole `components/v1/settings/` family (the shell and its five section
   * modules), the page that renders it, and the two pure modules those files get their words
   * from. The initiator-only billing module lives in `components/v1/subscription/` and is
   * deliberately outside this list — `settingsSectionsFor("counterparty")` has no `subscription`
   * row, and `settings-view.tsx` holds no static edge into that directory at all (asserted below),
   * so a counterparty's graph never reaches it.
   */
  const SETTINGS_FAMILY = readdirSync(join(repoRoot, "components/v1/settings"))
    .filter((file) => file.endsWith(".tsx") || file.endsWith(".ts"))
    .sort()
    .map((file) => `components/v1/settings/${file}`);

  const COUNTERPARTY_RENDER_PATH = [
    "app/(prototype)/v1/[persona]/settings/page.tsx",
    ...SETTINGS_FAMILY,
    "lib/v1/settings.ts",
    "lib/v1/profile.ts",
  ];

  it("walks the shell and its five sections, so the guard cannot pass by reading nothing", () => {
    for (const section of [
      "account-settings",
      "appearance-settings",
      "connected-accounts",
      "notification-settings",
      "privacy-settings",
      "settings-view",
    ]) {
      expect(COUNTERPARTY_RENDER_PATH).toContain(`components/v1/settings/${section}.tsx`);
    }
  });

  it("has zero hits for billing, payment or invoice", () => {
    const hits: string[] = [];
    for (const path of COUNTERPARTY_RENDER_PATH) {
      const source = read(path);
      if (/billing|payment|invoice/i.test(source)) hits.push(path);
    }
    expect(hits, `files: ${COUNTERPARTY_RENDER_PATH.length}`).toEqual([]);
  });

  it("reaches the initiator-only modules through import() only, never a static edge", () => {
    const source = read("components/v1/settings/settings-view.tsx");
    const staticSpecifiers = [...source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]);
    expect(staticSpecifiers.filter((specifier) => specifier.includes("/subscription/"))).toEqual(
      [],
    );

    const lazySpecifiers = [...source.matchAll(/import\("([^"]+)"\)/g)].map((match) => match[1]);
    expect(lazySpecifiers).toEqual([
      "@/components/v1/subscription/subscription-settings",
      "@/components/v1/subscription/payer-notifications",
    ]);
  });

  it("keeps the words in the initiator-only module, so the guard is real", () => {
    expect(read("components/v1/subscription/subscription-settings.tsx")).toMatch(/billing/i);
    expect(read("components/v1/subscription/payer-notifications.tsx")).toMatch(
      /PAYER_NOTIFICATION_EVENTS/,
    );
  });
});

/* ------------------------------------------------------------------ *
 * Profile activity — relationship history, from the record
 * ------------------------------------------------------------------ */

describe("the profile activity feed is relationship history", () => {
  const adminFeed = profileActivityOf("admin", seedRelationships, v1Templates, seedSessions);
  const rowsFor = (relationshipId: string) =>
    adminFeed.events.filter((event) => event.relationshipId === relationshipId);

  it("reads rel-advanced and rel-connected-blind differently, from their own fields", () => {
    const advanced = rowsFor("rel-advanced");
    const blind = rowsFor("rel-connected-blind");

    // Four scored sessions, dated by the session fixture; the blind relationship has none.
    expect(advanced.filter((event) => event.kind === "scored")).toHaveLength(4);
    expect(blind.filter((event) => event.kind === "scored")).toHaveLength(0);

    // Two acceptances against none.
    expect(advanced.filter((event) => event.kind === "accepted")).toHaveLength(2);
    expect(blind.filter((event) => event.kind === "accepted")).toHaveLength(0);

    // Both were created and both carry an invite; the labels name the right people.
    expect(advanced[0]?.relationshipName).toBe("Noor & Iris");
    expect(blind[0]?.relationshipName).toBe("Staff & Manager");
    expect(blind.some((event) => event.text === "Jordan invited Sam to Staff & Manager")).toBe(
      true,
    );
    expect(advanced.some((event) => event.text.includes("Noor invited Iris"))).toBe(true);
  });

  it("dates every row from a field the record carries", () => {
    const advanced = seedRelationships.find((rel) => rel.id === "rel-advanced");
    const blind = seedRelationships.find((rel) => rel.id === "rel-connected-blind");
    const sessionInstants = new Set(
      seedSessions
        .filter((session) => session.relationshipId === "rel-advanced")
        .map((session) => session.completedAt),
    );

    for (const event of rowsFor("rel-advanced")) {
      const allowed = new Set(
        [
          advanced?.createdAt,
          advanced?.initiatorAcceptedAt,
          advanced?.counterpartyAcceptedAt,
          advanced?.lastSessionAt,
          ...sessionInstants,
        ].filter((value): value is string => typeof value === "string"),
      );
      expect(allowed.has(event.at), `${event.text} @ ${event.at}`).toBe(true);
    }
    for (const event of rowsFor("rel-connected-blind")) {
      const allowed = new Set(
        [
          blind?.createdAt,
          blind?.initiatorAcceptedAt,
          blind?.counterpartyAcceptedAt,
          blind?.lastSessionAt,
        ].filter((value): value is string => typeof value === "string"),
      );
      expect(allowed.has(event.at), `${event.text} @ ${event.at}`).toBe(true);
    }
  });

  it("counts only what the visible relationships hold", () => {
    const sam = profileActivityOf("counterparty", seedRelationships, v1Templates, seedSessions);
    expect(sam.summary.relationshipCount).toBe(2);
    expect(sam.summary.sessionsAnswered).toBe(1);
    expect(sam.summary.sessionsScored).toBe(2);

    const coach = profileActivityOf("coach", seedRelationships, v1Templates, seedSessions);
    expect(coach.summary.sessionsAnswered).toBe(0);
    expect(coach.summary.sessionsScored).toBe(2);
  });
});

/* ------------------------------------------------------------------ *
 * Milestones — earned, never implied
 * ------------------------------------------------------------------ */

describe("milestones are earned from the fixture's own counts", () => {
  const milestonesFor = (persona: (typeof DASHBOARD_PERSONAS)[number]) =>
    profileMilestonesOf(persona, seedRelationships, v1Templates).map((milestone) => milestone.id);

  it("gives the counterparty the two their fixture proves, and the coach only the coaching one", () => {
    expect(milestonesFor("counterparty")).toEqual(["first-scored", "coach-joined"]);
    expect(milestonesFor("coach")).toEqual(["coach-joined"]);
  });

  it("invents nothing for a persona who has scored nothing, or for the observer", () => {
    expect(milestonesFor("initiator")).toEqual([]);
    expect(milestonesFor("admin")).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * One profile component, two routes
 * ------------------------------------------------------------------ */

describe("the public profile is the in-app profile with actions hidden", () => {
  it("mounts the same component, with readOnly on the public route", () => {
    const inApp = read("app/(prototype)/v1/[persona]/profile/page.tsx");
    const publicRoute = read("app/(prototype)/v1/profile/[handle]/page.tsx");

    for (const source of [inApp, publicRoute]) {
      expect(source).toContain('from "@/components/v1/profile/member-profile"');
    }
    expect(inApp).toContain("readOnly={false}");
    expect(publicRoute).toContain("readOnly");
    expect(publicRoute).not.toContain("readOnly={false}");
  });

  it("resolves a handle to exactly one persona", () => {
    const handles = DASHBOARD_PERSONAS.map((persona) => personaHandle(persona));
    expect(new Set(handles).size).toBe(DASHBOARD_PERSONAS.length);
    for (const persona of DASHBOARD_PERSONAS) {
      expect(personaFromHandle(personaHandle(persona))).toBe(persona);
    }
    expect(personaFromHandle("nobody")).toBeNull();
  });

  it("links the marketing surface to it, so the public route is reachable", () => {
    const picker = read("components/v1/persona-picker.tsx");
    expect(picker).toContain("/v1/profile/");
    expect(picker).toContain('personaHandle("initiator")');
  });
});
