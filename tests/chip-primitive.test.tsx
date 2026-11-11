/**
 * One chip, one geometry (#795, card t_252f94e3).
 *
 * The audit (#795 F3) found one concept — "a small label about a record" — drawn by three
 * primitives at three radii: `rounded-md` `CHIP` in the console library card, `rounded-full`
 * `CHIP`/`CHIP_TEMPLATE` on the shelves, and shadcn's `Badge` on the relationship detail. The
 * approved artifact (`docs/mockups/one-card-one-detail-v2.html`, §1) decides it: **one
 * primitive, `rounded-full`, four tones**, and the tone is the variant while the radius never is.
 *
 * Four claims, each one a test:
 *
 *   1. the four tones share **one** geometry — the base string is `rounded-full`, `text-xs`, one
 *      padding — and differ only in ink, fill and border;
 *   2. **no surface declares a chip of its own**: every file that draws one imports the primitive
 *      and carries no `const CHIP` constant, which is what stops a fifth definition appearing the
 *      next time someone needs a label;
 *   3. the two card surfaces **render** through it — the markup the shelf and the relationship
 *      list actually emit is the primitive's class list, tone for tone;
 *   4. the detail band renders through it too, and it is the band tone, because a neutral chip on
 *      the graphite band would be light-on-dark text with a light border.
 *
 * The `data-*` hooks are untouched by the move and are asserted here anyway: a chip that loses
 * its handle silently breaks someone else's suite, and `#795` names that as the way this refactor
 * would fail.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

import { TemplateDetail } from "@/components/assessment-flow/template-detail";
import { RelationshipCards } from "@/components/dashboard/relationship-cards";
import { TemplateShelf } from "@/components/dashboard/template-shelf";
import { badgeVariants, Chip } from "@/components/ui/badge";
import { assessments } from "@/data/assessments";
import { templateDetailPageCopy } from "@/data/pages/assessment-template-detail";
import { dashboardRelationshipsPageCopy } from "@/data/pages/dashboard-relationships";
import { dashboardTemplatesPageCopy } from "@/data/pages/dashboard-templates";
import type { LibraryTemplateDetail } from "@/lib/db/template-library";
import type { LibraryTemplate } from "@/lib/flow/template-library";
import { catalogueCard } from "@/lib/member/shelf";
import type { MemberRelationshipRow } from "@/lib/member/relationships";
import { cn } from "@/lib/utils";

const TONES = ["neutral", "tint", "soft", "band"] as const;

/** One rendered chip, as the markup a browser would receive. */
function chipMarkup(variant?: (typeof TONES)[number], props: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(createElement(Chip, { variant, ...props }, "Label"));
}

/** The class list the primitive emits for a tone — the string a surface must carry. */
function toneClasses(variant: (typeof TONES)[number]): string {
  return cn(badgeVariants({ variant }));
}

/**
 * The files that draw a chip about a record. Six surfaces from the audit, plus the dashboard's
 * own relationship list and the two flow screens that carried the same `rounded-md` constant.
 */
const CHIP_SURFACES = [
  "components/dashboard/template-shelf.tsx",
  "components/dashboard/relationship-cards.tsx",
  "components/dashboard/relationship-detail.tsx",
  "components/assessment-flow/my-instances.tsx",
  "components/assessment-flow/template-detail.tsx",
  "components/assessment-flow/template-card.tsx",
  "components/assessment-flow/report-view.tsx",
  "components/assessment-flow/alignment-view.tsx",
  "components/templates/template-card.tsx",
] as const;

const ROOT = join(import.meta.dirname, "..");

function source(file: string): string {
  return readFileSync(join(ROOT, file), "utf8");
}

/** One catalogue template, in the shape `listLibraryTemplates()` hands the shelf. */
const templateRow: LibraryTemplate = (() => {
  const record = assessments.find((row) => row.slug === "staff-manager");
  if (record === undefined) throw new Error("the fixture has no staff-manager template");
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    summary: record.summary,
    status: "published",
    createdAt: record.date,
    aspectCount: record.items.length,
    instanceCount: 0,
    authorship: "built-in",
  };
})();

/** One relationship, in the shape `listMyRelationships()` hands the list. */
const relationshipRow: MemberRelationshipRow = {
  id: "relationship-member-abc123",
  status: "active",
  viewerRole: "initiator",
  isInitiator: true,
  templateId: "member-config-abc123",
  title: "Son Basics",
  summary: "What we want to ask each other every month.",
  createdAt: "2026-11-01T12:00:00.000Z",
  publishedAt: "2026-11-02T12:00:00.000Z",
  sessionRecordId: "member-session-abc123",
  aspectCount: 6,
  invite: null,
  counterpartyName: "Junior",
  initiatorName: "Avery",
  view: "invite-claimed",
  membership: { state: "lapsed", reason: null, endedAt: null, writable: false },
};

/** The template detail page's read, built from the fixture record. */
const detail: LibraryTemplateDetail = (() => {
  const record = assessments.find((row) => row.id === templateRow.id);
  if (record === undefined) throw new Error("the fixture has no staff-manager record");
  return {
    template: templateRow,
    aspects: record.items.map((item, index) => ({
      id: item.id,
      position: index,
      prompt: item.prompt,
      leftValue: item.leftValue,
      rightValue: item.rightValue,
    })),
  };
})();

/**
 * The chip that carries `attribute` — the **last** element with it.
 *
 * Last, not first, because a card stamps the same handle on its own `<li>` (`data-relationship-
 * status` is both the card's and the chip's), and the label is the innermost element that says
 * it. An attribute only the chip carries matches once either way.
 */
function elementWith(html: string, attribute: string): string {
  const matches = [...html.matchAll(new RegExp(`<[a-z]+[^>]*\\b${attribute}[^>]*>`, "g"))];
  const last = matches.at(-1);
  if (last === undefined) throw new Error(`the render drew no element carrying ${attribute}`);
  return last[0];
}

describe("one primitive, one geometry", () => {
  it("rounds every tone with the same radius, and it is `rounded-full`", () => {
    for (const tone of TONES) {
      const markup = chipMarkup(tone);
      expect(markup, `${tone} is the primitive's radius`).toContain("rounded-full");
      expect(markup, `${tone} is not the retired radius`).not.toContain("rounded-md");
      expect(markup, `${tone} is one type step`).toContain("text-xs");
    }
  });

  it("draws a label, not a control: no tone hovers", () => {
    for (const tone of TONES) {
      expect(chipMarkup(tone), `${tone} must not carry a hover`).not.toContain("hover:");
    }
  });

  it("keeps the four tones distinguishable, and tone is the only difference", () => {
    expect(chipMarkup("neutral")).toContain("border-gray-300");
    expect(chipMarkup("neutral")).toContain("bg-white");
    expect(chipMarkup("neutral")).toContain("font-medium");

    expect(chipMarkup("tint")).toContain("border-action/45");
    expect(chipMarkup("tint")).toContain("bg-action/5");
    expect(chipMarkup("tint")).toContain("text-action");

    expect(chipMarkup("soft")).toContain("bg-secondary");
    expect(chipMarkup("soft")).toContain("text-secondary-foreground");

    // The band tone is the shipped band chip's pair, at the primitive's radius.
    expect(chipMarkup("band")).toContain("border-background/30");
    expect(chipMarkup("band")).toContain("text-background/80");
    // The band draws one step tighter, as the artifact's §4 band does.
    expect(chipMarkup("band")).toContain("px-2 ");
    expect(chipMarkup("band")).not.toContain("px-2.5");
  });

  it("defaults to the neutral tone, so a fact chip needs no variant at all", () => {
    expect(chipMarkup()).toBe(chipMarkup("neutral"));
  });

  it("renders the caller's tag, because the library card's chips are `<dd>` rows", () => {
    expect(chipMarkup("neutral", { as: "dd" })).toMatch(/^<dd /);
    expect(chipMarkup("neutral")).toMatch(/^<span /);
  });

  it("lets a caller's class win, which is how the catalogue eyebrow keeps its type step", () => {
    const markup = chipMarkup("soft", { className: "text-[11px] uppercase" });
    expect(markup).toContain("text-[11px]");
    expect(markup).not.toMatch(/\btext-xs\b/);
  });
});

describe("no surface declares a chip of its own", () => {
  for (const file of CHIP_SURFACES) {
    it(`${file} draws it through components/ui/badge`, () => {
      const text = source(file);
      expect(text, "the primitive is imported").toMatch(
        /import \{[^}]*\bChip\b[^}]*\} from "@\/components\/ui\/badge"/,
      );
      // The retired shape: a local class constant named CHIP. `CHIP_SURFACES` itself is the
      // thing that would grow a sixth entry if someone added one back.
      expect(text, "no local chip constant").not.toMatch(/\bconst CHIP\b/);
      expect(text, "no rounded-md chip literal").not.toMatch(
        /rounded-md border border-(border|background\/30)[^"]*px-2 py-0\.5/,
      );
    });
  }
});

describe("the surfaces render through it", () => {
  it("the template shelf draws the template mark tinted and its facts neutral", () => {
    const html = renderToStaticMarkup(
      createElement(TemplateShelf, {
        cards: [catalogueCard(dashboardTemplatesPageCopy, templateRow)],
      }),
    );
    expect(html).toContain(toneClasses("tint"));
    expect(html).toContain(toneClasses("neutral"));
    expect(html).not.toContain("rounded-md border border-border px-2");
  });

  it("the relationship list card does too, and keeps every data-* hook", () => {
    const html = renderToStaticMarkup(
      createElement(RelationshipCards, {
        copy: dashboardRelationshipsPageCopy,
        rows: [relationshipRow],
        unreadable: null,
      }),
    );
    expect(html).toContain(toneClasses("tint"));
    expect(html).toContain(toneClasses("neutral"));
    // The card stamps `data-relationship-status` on the `<li>`; the three below are on the chips.
    expect(html).toContain('data-relationship-status="active"');
    for (const hook of ["data-viewer-role", "data-invite-view", "data-membership-state"]) {
      expect(elementWith(html, hook), hook).toContain("rounded-full");
    }
  });

  it("the detail band draws the band tone, and keeps its three hooks", () => {
    const html = renderToStaticMarkup(
      createElement(TemplateDetail, { copy: templateDetailPageCopy, detail }),
    );
    expect(html).toContain(toneClasses("band"));
    for (const hook of [
      "data-template-detail-group",
      "data-template-detail-realm",
      "data-template-detail-short-name",
    ]) {
      const chip = elementWith(html, hook);
      expect(chip, hook).toContain("rounded-full");
      expect(chip, hook).toContain("border-background/30");
    }
    expect(html).not.toContain("rounded-md border border-background/30");
  });
});
