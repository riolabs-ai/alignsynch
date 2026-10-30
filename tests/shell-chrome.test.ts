/**
 * The rest of the shell's chrome is the brand's, not the quiz product's (issue #156 follow-up).
 *
 * #156 made the sidebar, the footer and the search palette brand-aware. Three pieces of
 * persistent chrome were still the quiz product's on `BRAND=alignsynch`, and all three are
 * *fixtures* rather than routes, so none of them could be found by following a link:
 *
 *   1. the header's wallet chip, which linked the quiz dashboard's wallet tab;
 *   2. the messages drawer's five sample conversations and the notifications drawer's badges;
 *   3. the `/search` page's hard-coded "Quizzes" / "Categories" tab labels.
 *
 * The claims below are the ones a fixture edit can break without a red typecheck:
 *
 *   - a brand's drawer content is decided in one place (`recentMessagesFor` /
 *     `notificationsFor`), the quiz build still gets the shipped rows, and the alignment
 *     build gets none rather than a second invented set;
 *   - the `/search` tab strip lists only groups the index can fill, so the alignment build has
 *     no "Quizzes" tab at all — not a tab that filters zero rows;
 *   - every tab id either brand renders resolves to a label in that brand's fixture section,
 *     which is the join E23 cannot see (the id is a variable in the component, so the gate
 *     cannot read it out of the source).
 *
 * "The brand's drawer content" is asserted through the selectors, not by rendering the header:
 * `Header` is a client component that reads the sidebar context and `usePathname`, and what
 * this file is about is which fixture rows a brand chooses. The built page is what proves the
 * header renders them — see the card's status table.
 */
import { describe, expect, it } from "vitest";

import { notifications, notificationsFor } from "@/data/notifications";
import { recentMessages, recentMessagesFor } from "@/data/chat-data";
import { brand } from "@/data/brand";
import { shellPageCopy } from "@/data/pages/shell";
import { searchIndex, searchIndexFor } from "@/data/searchdata";
import { PLATFORM_VIEWER, seesQuizProduct, viewerWith } from "@/lib/nav";
import { itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import {
  SEARCH_TAB_IDS,
  footerCopyFor,
  searchTabIds,
  searchTabsFor,
  type SearchTabId,
} from "@/lib/shell-copy";

/** The label a brand's tab section carries for an id — throws when the fixture dropped it. */
function tabLabel(brand: "quizhub" | "alignsynch", id: SearchTabId): string {
  return itemLabel(searchTabsFor(shellPageCopy, brand), id);
}

describe("the drawers show the brand's records", () => {
  it("keeps the quiz build's messages exactly as shipped", () => {
    expect(recentMessagesFor("quizhub")).toBe(recentMessages);
    expect(recentMessages.length).toBeGreaterThan(0);
    // The rows the card named: the alignment build rendered these over an alignment page.
    expect(recentMessages.map((message) => message.content)).toContain(
      "Hey, are you ready for the quiz tournament?",
    );
  });

  it("gives the alignment build no conversation at all", () => {
    expect(recentMessagesFor("alignsynch")).toEqual([]);
  });

  it("keeps the quiz build's notifications exactly as shipped", () => {
    expect(notificationsFor("quizhub")).toBe(notifications);
    expect(notifications.map((notification) => notification.title)).toContain("Quiz Reward");
  });

  it("gives the alignment build no notification — and so no unread badge", () => {
    const rows = notificationsFor("alignsynch");
    expect(rows).toEqual([]);
    expect(rows.filter((notification) => !notification.read)).toEqual([]);
  });

  it("words the empty drawers in the shell fixture, not in the component", () => {
    const messages = sectionOf(shellPageCopy, "messages");
    expect(itemLabel(messages, "empty-title").length).toBeGreaterThan(0);
    expect(itemLabel(messages, "empty-body").length).toBeGreaterThan(0);
    // The notifications drawer's empty state is the one it always had.
    const notificationsCopy = sectionOf(shellPageCopy, "notifications");
    expect(itemLabel(notificationsCopy, "empty-title").length).toBeGreaterThan(0);
    expect(itemLabel(notificationsCopy, "empty-body").length).toBeGreaterThan(0);
  });
});

describe("the quiz product's chrome is the quiz brand's, and an addition on the alignment brand", () => {
  it("renders for every viewer on the quiz brand — the brand is the product", () => {
    expect(seesQuizProduct("quizhub", PLATFORM_VIEWER)).toBe(true);
    expect(seesQuizProduct("quizhub", viewerWith("quiz-surfaces"))).toBe(true);
  });

  it("is withheld from the alignment build's platform viewer", () => {
    expect(seesQuizProduct("alignsynch", PLATFORM_VIEWER)).toBe(false);
  });

  it("comes back for a viewer carrying the capability", () => {
    expect(seesQuizProduct("alignsynch", viewerWith("quiz-surfaces"))).toBe(true);
  });
});

describe("the /search tab strip lists the groups the index can fill", () => {
  it("keeps every tab on the quiz build — its index holds all four groups", () => {
    expect(searchTabIds(searchIndexFor("quizhub", PLATFORM_VIEWER))).toEqual([
      "all",
      "quizzes",
      "categories",
      "creators",
      "pages",
    ]);
    expect(searchTabIds(searchIndex)).toEqual([...SEARCH_TAB_IDS]);
  });

  it("leaves the alignment build the two tabs its index has records for", () => {
    const index = searchIndexFor("alignsynch", PLATFORM_VIEWER);
    expect(index.quizzes).toEqual([]);
    expect(index.categories).toEqual([]);
    expect(index.creators).toEqual([]);
    expect(index.pages.length).toBeGreaterThan(0);
    expect(searchTabIds(index)).toEqual(["all", "pages"]);
  });

  it("does not name a quiz, a category or a creator in the alignment build's tabs", () => {
    const labels = searchTabIds(searchIndexFor("alignsynch", PLATFORM_VIEWER)).map((id) =>
      tabLabel("alignsynch", id),
    );
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(label).not.toMatch(/quiz|categor|creator/i);
    }
    expect(labels.join(" ")).toMatch(/assessment/i);
  });

  it("labels the quiz build's tabs with the words the page used to spell", () => {
    // The page's five triggers before this card, modulo the count placeholder.
    const words = SEARCH_TAB_IDS.map((id) => tabLabel("quizhub", id).replace(" ({count})", ""));
    expect(words).toEqual(["All Results", "Quizzes", "Categories", "Creators", "Pages"]);
  });

  it("resolves a label for every tab either brand can render", () => {
    // The join E23 cannot make: the component asks for the id a variable holds, so a fixture
    // that dropped `pages` would only fail at runtime. This is that failure, at test time.
    for (const brand of ["quizhub", "alignsynch"] as const) {
      const index = searchIndexFor(brand, PLATFORM_VIEWER);
      const ids = searchTabIds(index);
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) {
        expect(tabLabel(brand, id).length).toBeGreaterThan(0);
      }
    }
  });

  it("gives the elevated alignment viewer the quiz tabs back with the quiz rows", () => {
    const index = searchIndexFor("alignsynch", viewerWith("quiz-surfaces"));
    expect(searchTabIds(index)).toEqual([...SEARCH_TAB_IDS]);
  });
});

describe("the footer's three brand-owned bands", () => {
  /**
   * The failure this pins (issue #188, stage S3): the footer is chrome on every page, and three
   * of its sentences are product vocabulary — the blurb under the wordmark, the street line, the
   * newsletter pitch. They were shared strings, so `BRAND=alignsynch` printed "quizzes", "quiz
   * creators", "quiz tips" and "123 Quiz Street" in the footer of every page it served.
   *
   * `footerCopyFor` is the join E23 cannot make: it resolves the section id from a variable, so
   * the gate sees the six literals at the `sectionOf` calls but cannot see *which brand* gets
   * which. A mapped id that went missing, or a section that carried the wrong brand's words,
   * would be a runtime throw or a shipped defect. These are those failures, at test time.
   */
  const footer = (brandId: "quizhub" | "alignsynch") => footerCopyFor(shellPageCopy, brandId);

  it("resolves all three bands for both brands and hands back the section, not a copy", () => {
    for (const brandId of ["quizhub", "alignsynch"] as const) {
      const bands = footer(brandId);
      for (const band of [bands.brand, bands.contact, bands.newsletter]) {
        expect(band.id.length).toBeGreaterThan(0);
      }
      expect(bands.brand.id).toBe(
        brandId === "quizhub" ? "footer-brand" : "footer-brand-alignsynch",
      );
    }
  });

  it("declares the same item ids on both brands' contact and newsletter bands", () => {
    // The footer resolves one set of ids whichever section the brand chose, exactly as the two
    // `search` sections do — so a variant that renamed an id is a throw, not a blank row.
    const ids = (band: { items?: { id: string }[] }) => (band.items ?? []).map((item) => item.id);
    expect(ids(footer("alignsynch").contact)).toEqual(ids(footer("quizhub").contact));
    expect(ids(footer("alignsynch").newsletter)).toEqual(ids(footer("quizhub").newsletter));
  });

  it("keeps the quiz build on the words it shipped, typo corrected", () => {
    const words = footer("quizhub");
    expect(sectionBody(words.brand)).toContain("quiz creators");
    expect(itemLabel(words.contact, "address")).toContain("Quiz Street");
    expect(sectionBody(words.newsletter)).toContain("quiz tips");
    // #188 fixed the spelling on both brands; it is the one string that moved on this build.
    const account = sectionOf(shellPageCopy, "account");
    expect(itemLabel(account, "quizzes")).toBe("My Quizzes");
    expect(itemLabel(account, "quizzes-hint")).toBe("Your created quizzes");
  });

  it("prints no quiz vocabulary on the alignment build", () => {
    const words = footer("alignsynch");
    const text = [
      sectionBody(words.brand),
      sectionBody(words.newsletter),
      // The mailbox is the record's, not the fixture's: `quizhub@riolabs.ai` contains the word
      // and is asserted as an address in its own case below. Matching it here would make the
      // test a statement about the ambient record rather than about the alignment copy.
      ...(words.contact.items ?? [])
        .filter((item) => item.id !== "email")
        .map((item) => item.label),
      words.contact.heading ?? "",
      words.newsletter.heading ?? "",
    ].join("\n");
    expect(text).not.toMatch(/quiz/i);
    expect(text.length).toBeGreaterThan(0);
  });

  it("prints the record's support address in both brands' contact bands", () => {
    for (const brandId of ["quizhub", "alignsynch"] as const) {
      expect(itemLabel(footer(brandId).contact, "email")).toBe(brand.supportEmail);
    }
  });
});
