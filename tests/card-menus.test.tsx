/** @vitest-environment jsdom */

/**
 * The card menus (#1134) — which rows a kebab offers, on which card, for which state and seat.
 *
 * The issue's acceptance line is four claims and this file measures the three that are not the
 * gate:
 *
 *   1. **Save a Copy creates a My Template and opens it** — the writer is `clonePublic`
 *      (`member-template-retire` / the store's own suite hold the write); what is asserted here is
 *      that the row exists on a Library card, names `save-copy`, and that the copy lands on
 *      `?tab=mine&new=<id>` — the address the bundle's own toast links to.
 *   2. **Each card menu lists only the actions for its state and role** — the four relationship
 *      states and the two tabs of the Templates shelf, as data, because the rows are a projection
 *      (`lib/member/card-menu.ts`) and a screenshot cannot tell a filtered list from an unfiltered
 *      one.
 *   3. **The menus are keyboard-operable (`dropdown-menu` primitive)** — the rendered proof is the
 *      trigger: a `button` with an accessible name, inside the primitive that owns arrow keys and
 *      Escape.
 *
 * The fourth claim — the Counterparty fork — shipped with #785 and is pinned by
 * `tests/relationship-fork*.test.ts`; this card only had to not break it, and the last case here
 * asserts the card's menu never offers a template write, so it cannot become a second fork door.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: unknown }) =>
    createElement("a", { href, ...(rest as Record<string, unknown>) }, children as never),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { RelationshipCard } from "@/components/dashboard/relationship-card";
import { TemplateShelf, type TemplateShelfMenu } from "@/components/dashboard/template-shelf";
import {
  cardViewOf,
  type RelationshipCardWords,
} from "@/components/dashboard/relationship-card-model";
import { cardWordsOf } from "@/components/dashboard/relationships-list";
import { dashboardRelationshipsPageCopy } from "@/data/pages/dashboard-relationships";
import { dashboardTemplatesPageCopy } from "@/data/pages/dashboard-templates";
import type { RelationshipCardView } from "@/components/dashboard/relationship-card";
import { relationshipMenuOf, templateMenuOf } from "@/lib/member/card-menu";
import type { RelationshipMenuWords } from "@/lib/member/card-menu";
import type { LibraryRow } from "@/lib/member/library";
import {
  refusalsOf,
  relationshipMenuNotices,
  relationshipMenuWords,
  templateMenuNotices,
  templateMenuWords,
} from "@/lib/member/menu-copy";
import { catalogueCard, mineCard } from "@/lib/member/shelf";
import type { LibraryTemplate } from "@/lib/flow/template-library";

const templateCopy = dashboardTemplatesPageCopy;
const relationshipCopy = dashboardRelationshipsPageCopy;

function libraryRow(slug: string, title: string, aspectCount = 5): LibraryTemplate {
  return {
    id: `assessment-${slug}`,
    slug,
    title,
    summary: `${title} in a sentence.`,
    status: "published",
    createdAt: "2026-01-05T09:00:00.000Z",
    aspectCount,
    instanceCount: 3,
    authorship: "built-in",
  };
}

function ownedRow(id: string, title: string): LibraryRow {
  return {
    id,
    slug: title.toLowerCase().replace(/\s+/g, "-"),
    title,
    summary: `${title} in a sentence.`,
    status: "draft",
    aspectCount: 5,
    relationshipCount: 1,
  };
}

/** The menu a page would hand the shelf; the writers throw if a test ever invokes one. */
const templateMenu: TemplateShelfMenu = {
  words: templateMenuWords(templateCopy),
  notices: templateMenuNotices(templateCopy),
  ...(() => {
    const copy = refusalsOf(
      templateCopy.sections?.find((section) => section.id === "refusals") ?? {
        id: "refusals",
        items: [],
      },
      "failed",
    );
    return { refusals: copy.refusals, fallbackRefusal: copy.fallback };
  })(),
  writes: {
    "save-copy": async () => ({ ok: true, id: "assessment-copy" }),
    duplicate: async () => ({ ok: true, id: "assessment-copy" }),
    archive: async () => ({ ok: true }),
  },
  landNewAt: "/dashboard/templates?tab=mine&new=",
};

describe("the Templates card menu (#1134, bundle 06)", () => {
  it("offers a Library card the two rows the artifact draws, with its own create door", () => {
    const card = catalogueCard(templateCopy, libraryRow("brother-sister", "Brother–Sister"));
    const entries = templateMenuOf(templateMenuWords(templateCopy), "library", {
      id: card.id,
      detailHref: card.detail.href,
      createHref: card.create?.href ?? null,
    });

    expect(entries.map((entry) => entry.id)).toEqual(["create", "save-copy"]);
    expect(entries[0]?.label).toBe("Create Relationship");
    expect(entries[0]?.href).toBe(card.create?.href);
    expect(entries[1]?.label).toBe("Save a Copy");
    /* A copy is a write, not a destination: the page's `clonePublic` is what runs. */
    expect(entries[1]?.write).toBe("save-copy");
    expect(entries[1]?.href).toBeUndefined();
  });

  it("offers a My Template the three rows that act on a row you own", () => {
    const card = mineCard(templateCopy, ownedRow("abc123", "Our Version"));
    const entries = templateMenuOf(templateMenuWords(templateCopy), "mine", {
      id: card.id,
      detailHref: card.detail.href,
      createHref: card.create?.href ?? null,
    });

    expect(entries.map((entry) => entry.id)).toEqual(["edit", "duplicate", "archive"]);
    /* Edit opens the editor the template's own page carries (`?edit=1`, #1130). */
    expect(entries[0]?.href).toBe(`${card.detail.href}?edit=1`);
    expect(entries[1]?.write).toBe("duplicate");
    expect(entries[2]?.write).toBe("archive");
  });

  it("puts no Delete on any card the shelf draws", () => {
    const rows = [
      ...templateMenuOf(templateMenuWords(templateCopy), "library", {
        id: "assessment-brother-sister",
        detailHref: "/dashboard/templates/x",
        createHref: "/templates/relationship/x/create",
      }),
      ...templateMenuOf(templateMenuWords(templateCopy), "mine", {
        id: "x",
        detailHref: "/dashboard/templates/x",
        createHref: "/templates/relationship/x/create",
      }),
    ];
    expect(rows.some((entry) => /delete/i.test(entry.label))).toBe(false);
    expect(rows.some((entry) => entry.id === "delete")).toBe(false);
  });

  it("renders the trigger the dropdown-menu primitive gives its keyboard handling", () => {
    const cards = [
      catalogueCard(templateCopy, libraryRow("brother-sister", "Brother–Sister")),
      catalogueCard(templateCopy, libraryRow("partners", "Partners")),
    ];
    const html = renderToStaticMarkup(
      createElement(TemplateShelf, { cards, tab: "library", menu: templateMenu }),
    );
    expect(html).toContain('aria-label="More actions for Brother–Sister"');
    expect(html).toContain('aria-haspopup="menu"');
    /* One trigger per card, and no trigger when the page mounts no menu. */
    expect(html.match(/data-card-menu-trigger="true"/g)?.length).toBe(2);
    const bare = renderToStaticMarkup(createElement(TemplateShelf, { cards, tab: "library" }));
    expect(bare).not.toContain("data-card-menu-trigger");
  });
});

describe("the relationship card menu (#1134, bundle 05)", () => {
  const words = relationshipMenuWords(relationshipCopy);

  const facts = (state: "live" | "waiting" | "draft" | "paused", isInitiator = true) => ({
    state,
    isInitiator,
    href: "/dashboard/relationships/r1",
    actionHref:
      state === "draft" ? "/templates/relationship/x/create" : "/dashboard/relationships/r1",
    instanceRecordId: state === "waiting" ? "session-1" : null,
  });

  it("draws the four states' rows, and only those", () => {
    expect(relationshipMenuOf(words, facts("live")).map((entry) => entry.id)).toEqual([
      "open",
      "leave",
    ]);
    expect(relationshipMenuOf(words, facts("waiting")).map((entry) => entry.id)).toEqual([
      "open",
      "resend",
      "cancel-invite",
    ]);
    expect(relationshipMenuOf(words, facts("draft")).map((entry) => entry.id)).toEqual([
      "open",
      "continue",
      "abandon",
    ]);
    expect(relationshipMenuOf(words, facts("paused")).map((entry) => entry.id)).toEqual([
      "open",
      "add-card",
      "leave",
    ]);
  });

  it("uses the artifact's words — Leave Relationship, never Remove Counterparty", () => {
    const labels = relationshipMenuOf(words, facts("live")).map((entry) => entry.label);
    expect(labels).toEqual(["Open", "Leave Relationship"]);
    expect(labels.join(" ")).not.toMatch(/remove/i);
  });

  it("keeps Add a Card for the Initiator, and the Counterparty keeps every other row", () => {
    const initiator = relationshipMenuOf(words, facts("paused", true)).map((entry) => entry.id);
    const counterparty = relationshipMenuOf(words, facts("paused", false)).map((entry) => entry.id);
    expect(initiator).toContain("add-card");
    expect(counterparty).not.toContain("add-card");
    /* The Counterparty can still leave: `active → complete` is their one lifecycle edge (#1135). */
    expect(counterparty).toEqual(["open", "leave"]);
  });

  it("confirms the three destructive rows and leaves the rest immediate", () => {
    const confirms = (state: "live" | "waiting" | "draft" | "paused") =>
      relationshipMenuOf(words, facts(state))
        .filter((entry) => entry.confirm !== undefined)
        .map((entry) => entry.id);
    expect(confirms("live")).toEqual(["leave"]);
    expect(confirms("waiting")).toEqual(["cancel-invite"]);
    expect(confirms("draft")).toEqual(["abandon"]);
    expect(confirms("paused")).toEqual(["leave"]);
    /* The words are the bundle's own modal, verbatim. */
    const leave = relationshipMenuOf(words, facts("live")).find((entry) => entry.id === "leave");
    expect(leave?.confirm).toEqual({
      title: "Leave This Relationship?",
      body: "Stage 6 closes for you and {name}. Answers and the discussion stay readable. Nothing is deleted.",
      confirm: "Leave Relationship",
      cancel: "Stay",
    });
  });

  it("draws no Copy Invite Link on a card, because a read never carries a token", () => {
    /* A token is minted once and never stored (#220), so the row could copy nothing — the copy
       control lives on the relationship's own screen, where the link has just been minted. */
    const all = (["live", "waiting", "draft", "paused"] as const).flatMap((state) =>
      relationshipMenuOf(words, facts(state)).map((entry) => entry.id),
    );
    expect(all).not.toContain("copy-link");
    expect(all).not.toContain("request-removal");
  });

  it("renders the kebab on the card only when the page hands one in", () => {
    const row = {
      id: "r1",
      title: "Staying Close",
      relationshipTitle: "Staying Close Through Busy Seasons",
      viewerRole: "initiator" as const,
      status: "active",
      templateSlug: "brother-sister",
      sessionRecordId: "session-1",
      initiatorName: "Marcus",
      counterpartyName: "Elena",
      createdAt: "2026-01-05T09:00:00.000Z",
      /* The read's remaining fields are not drawn by the card; the projection reads the four above. */
    } as unknown as Parameters<typeof cardViewOf>[0];
    const cardWords = cardWordsOf(relationshipCopy) as RelationshipCardWords &
      RelationshipMenuWords;
    const view = cardViewOf(row, null, cardWords) as RelationshipCardView;

    const menu = {
      label: "More actions for Staying Close Through Busy Seasons",
      entries: relationshipMenuOf(cardWords, {
        state: view.state,
        isInitiator: true,
        href: view.href,
        actionHref: view.actionHref,
        instanceRecordId: row.sessionRecordId,
      }),
      payload: { relationshipId: row.id, instanceRecordId: row.sessionRecordId ?? undefined },
      title: view.title,
      otherParty: "Elena",
      notices: relationshipMenuNotices(relationshipCopy),
      refusals: refusalsOf(
        relationshipCopy.sections?.find((section) => section.id === "menu-refusals") ?? {
          id: "menu-refusals",
          items: [],
        },
        "failed",
      ).refusals,
      fallbackRefusal: "That did not go through.",
      writes: { leave: async () => ({ ok: true }) },
    };

    const withMenu = renderToStaticMarkup(
      createElement(RelationshipCard, { view, labels: cardWords, menu }),
    );
    expect(withMenu).toContain('aria-label="More actions for Staying Close Through Busy Seasons"');
    expect(withMenu).toContain('aria-haspopup="menu"');

    const without = renderToStaticMarkup(
      createElement(RelationshipCard, { view, labels: cardWords }),
    );
    expect(without).not.toContain("data-card-menu-trigger");
  });
});

describe("the fixture is the words", () => {
  it("resolves every section the two menus read", () => {
    expect(templateMenuWords(templateCopy).saveCopy).toBe("Save a Copy");
    expect(templateMenuWords(templateCopy).more).toBe("More actions for {title}");
    expect(templateMenuNotices(templateCopy)["save-copy"]).toBe("Saved {title} to My Templates");
    expect(relationshipMenuWords(relationshipCopy).leave).toBe("Leave Relationship");
    expect(relationshipMenuNotices(relationshipCopy).leave).toBe("You left. Stage 6 is closed.");
  });
});
