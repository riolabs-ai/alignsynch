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
 *      padding — and each paints exactly its own ink, fill and border, with the artifact's own
 *      literals read off the artifact rather than retyped;
 *   2. **no surface declares a chip of its own**: the audited files import the primitive and carry
 *      no `const CHIP`, and a scan of every `.ts`/`.tsx` under `components/` and `app/` proves the
 *      constant is gone from the tree — the hand-written list alone missed one on the first pass;
 *   3. three surfaces **render** through it — the template shelf, the relationship list card and
 *      the template detail band — with their `data-*` hooks and the tone each datum carries;
 *   4. the band is the `onBand` tone, because a neutral chip on the graphite band would be
 *      light-on-dark text with a light border.
 *
 * What it does not render is `relationship-detail.tsx` and `instance-view.tsx` — two client
 * surfaces behind server actions and a whole session screen. Their chips are proved by claim 2
 * (the source) and by their own suites, which assert the hooks this file checks by name.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

import { TemplateDetail } from "@/components/assessment-flow/template-detail";
import { AssessmentsList } from "@/components/dashboard/assessments-list";
import { RelationshipCards } from "@/components/dashboard/relationship-cards";
import { TemplateShelf } from "@/components/dashboard/template-shelf";
import { badgeVariants, Chip } from "@/components/ui/badge";
import { assessments } from "@/data/assessments";
import { templateDetailPageCopy } from "@/data/pages/assessment-template-detail";
import { assessmentsPageCopy } from "@/data/pages/assessments";
import { dashboardRelationshipsPageCopy } from "@/data/pages/dashboard-relationships";
import { dashboardTemplatesPageCopy } from "@/data/pages/dashboard-templates";
import type { RelationshipCard } from "@/lib/db/assessments";
import type { LibraryTemplateDetail } from "@/lib/db/template-library";
import type { LibraryTemplate } from "@/lib/flow/template-library";
import { catalogueCard } from "@/lib/member/shelf";
import type { MemberRelationshipRow } from "@/lib/member/relationships";
import { cn } from "@/lib/utils";

const TONES = ["neutral", "tint", "soft", "onBand"] as const;

/** One rendered chip, as the markup a browser would receive. */
function chipMarkup(variant?: (typeof TONES)[number], props: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(createElement(Chip, { variant, ...props }, "Label"));
}

/** A rendered chip's classes, as a sorted list. */
function classesOf(markup: string): string[] {
  return (/class="([^"]*)"/.exec(markup)?.[1] ?? "").split(" ").sort();
}

/** Only the classes that paint ink, fill or a border — what a tone is allowed to decide. */
function paintOf(variant: (typeof TONES)[number]): string[] {
  return (
    classesOf(chipMarkup(variant))
      .filter((token) => /^(dark:)?(text|bg|border)-(?!0$|transparent$)/.test(token))
      // `border` alone is a width, not a colour; `border-l`/`border-t` etc. are sides.
      .filter((token) => !/^(dark:)?border(-[xtblr])?$/.test(token))
      // `text-xs` and friends are the type step, which every tone shares — not paint.
      .filter((token) => !/^(dark:)?text-(xs|sm|base|lg|xl|\d?xl|\[)/.test(token))
  );
}

/** The class list the primitive emits for a tone — the string a surface must carry. */
function toneClasses(variant: (typeof TONES)[number]): string {
  return cn(badgeVariants({ variant }));
}

/**
 * The audited surfaces, by file: the issue's six, plus the dashboard's own relationship list and
 * the flow screens that carried the same chip literal. `instance-view.tsx` is here because it
 * held a byte-identical copy of the shelf's `neutral` chip under its own `data-stage-badge`, and
 * a file list that skipped it is exactly how a fifth definition survives a refactor.
 */
const CHIP_SURFACES = [
  "components/dashboard/template-shelf.tsx",
  "components/dashboard/relationship-cards.tsx",
  "components/dashboard/relationship-detail.tsx",
  "components/dashboard/assessments-list.tsx",
  "components/assessment-flow/instance-view.tsx",
  /**
   * #795 — the band's three chips left `template-detail.tsx` for the shared shell, so the surface
   * that draws them is now `record-detail-shell.tsx`. Both detail pages render it, which is the
   * point: a file list that kept naming the template page would audit a file that no longer holds
   * a chip and skip the one both surfaces actually use.
   */
  "components/assessment-flow/record-detail-shell.tsx",
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
  templateSlug: "member-config-abc123",
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

/** The stage the relationship's session has reached, as the card draws it. */
const myInstanceRow: RelationshipCard = {
  relationshipId: relationshipRow.id,
  instanceRecordId: "member-session-abc123",
  slug: "staff-manager",
  name: "Son Basics",
  templateTitle: "Staff & Manager",
  mode: "basic",
  viewerRole: "initiator",
  initiatorName: "Avery",
  counterpartyName: "Junior",
  stage: "sharing",
  state: "awaiting-other",
  unlock: "seen",
  inviteState: "claimed",
  aspectCount: 6,
  sessionsOpened: 1,
  sessionsCompleted: 1,
  alignment: 2.4,
  paid: null,
  lastSessionAt: "2026-11-05T12:00:00.000Z",
};

/**
 * The opening tag of the element that carries `attribute` — the chip, found by its own hook.
 *
 * Last match, because a card stamps the card-level handle (`data-relationship-status`) on its
 * own `<li>` as well, and the label is the innermost element that carries it.
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

  it("paints each tone with exactly its own ink, fill and border", () => {
    /**
     * Exact sets, not "contains": a tone that quietly added a second ink, a fill of its own or a
     * palette step would pass a `toContain` and fail here. This is the assertion that keeps a
     * fifth tone from arriving as an extra class on an existing one.
     */
    expect(paintOf("neutral")).toEqual([
      "bg-white",
      "border-gray-300",
      "dark:bg-gray-900",
      "dark:border-gray-600",
      "dark:text-gray-200",
      "text-gray-700",
    ]);
    expect(paintOf("tint")).toEqual(["bg-action/5", "border-action/45", "text-action"]);
    expect(paintOf("soft")).toEqual(["bg-secondary", "text-card-foreground"]);
    expect(paintOf("onBand")).toEqual(["border-background/30", "text-background/80"]);
  });

  it("keeps the weight and the padding the shipped chips had", () => {
    expect(chipMarkup("neutral")).toContain("font-medium");
    expect(chipMarkup("tint")).toContain("font-medium");
    expect(chipMarkup("soft")).toContain("font-semibold");

    // The band draws one step tighter, as the artifact's §4 band does; `cn`'s merge is what
    // drops the base `px-2.5` rather than the cascade deciding it.
    expect(classesOf(chipMarkup("onBand"))).toContain("px-2");
    expect(classesOf(chipMarkup("onBand"))).not.toContain("px-2.5");
    expect(chipMarkup("onBand")).toContain("font-normal");
  });

  it("defaults to the neutral tone, so a fact chip needs no variant at all", () => {
    expect(chipMarkup()).toBe(chipMarkup("neutral"));
  });

  it("draws the approved artifact's four tone literals, token for token", () => {
    /**
     * The contract, read from the file the owner approved rather than from a copy of it (§1,
     * "The chip, one primitive, four tones"). Every class the artifact writes on a chip must be
     * on the rendered one — the primitive may add the base string's own furniture, it may never
     * repaint a tone's ink, fill, border or type step.
     */
    const artifact = readFileSync(join(ROOT, "docs/mockups/one-card-one-detail-v2.html"), "utf8");
    const drawn = [
      ...artifact.matchAll(/<span class="(inline-flex items-center rounded-full[^"]*)"/g),
    ]
      .map((match) => match[1].split(" "))
      // The three band chips (§1's graphite swatch) repeat one literal: keep it once.
      .filter(
        (tokens, index, all) =>
          all.findIndex((other) => other.join(" ") === tokens.join(" ")) === index,
      );

    expect(drawn.length, "four tones are drawn in §1").toBe(4);

    for (const tone of TONES) {
      const rendered = classesOf(chipMarkup(tone));
      const source = drawn.find((tokens) => tokens.every((token) => rendered.includes(token)));
      expect(source, `${tone} matches a drawn tone`).toBeDefined();
    }
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
      expect(text, "no local chip constant").not.toMatch(/\bconst CHIP\b/);
      expect(text, "no rounded-md chip literal").not.toMatch(
        /rounded-md border border-(border|background\/30)[^"]*px-2 py-0\.5/,
      );
    });
  }

  it("and neither does any other component: the constant is gone from the tree", () => {
    /**
     * The list above is the audited surfaces and it is hand-written, which is precisely how
     * `instance-view.tsx` kept a byte-identical copy through the first pass. This is the
     * self-maintaining half, in three shapes, because each one was a real escape:
     *
     *   - a shared constant — `CHIP`, `CHIP_TEMPLATE`, any `CHIP_*` — may not exist anywhere
     *     under `components/` or `app/`; the primitive is its only home;
     *   - the retired *neutral literal* may not be pasted into a component either, which is what
     *     an inlined copy looks like (`instance-view.tsx`'s stage badge was exactly this);
     *   - and the same for the retired band literal, which is where the detail header's chips
     *     came from before the band tone existed.
     */
    const sources = ["components", "app"].flatMap((dir) =>
      readdirSync(join(ROOT, dir), { recursive: true, encoding: "utf8" })
        .filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"))
        .map((name) => join(dir, name)),
    );

    expect(sources.length, "the walk found the tree").toBeGreaterThan(300);
    expect(
      sources
        // The primitive is where the one class list lives; `CHIP_TAG`/`CHIP_TONES` are its API.
        .filter((file) => file !== "components/ui/badge.tsx")
        .filter((file) => /\bconst CHIP(\b|_)/.test(source(file))),
    ).toEqual([]);
    expect(
      sources.filter((file) =>
        /border-gray-300 bg-white px-2\.5 py-0\.5 text-xs font-medium/.test(source(file)),
      ),
    ).toEqual([]);
    expect(
      sources.filter((file) =>
        /rounded-md border border-background\/30 px-2 py-0\.5 text-xs/.test(source(file)),
      ),
    ).toEqual([]);
  });
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

  it("My Assessments draws the template mark and the state tinted, the invitation soft", () => {
    const html = renderToStaticMarkup(
      createElement(AssessmentsList, {
        copy: assessmentsPageCopy,
        rows: [myInstanceRow],
        unreadable: null,
      }),
    );
    // The one sentence this refactor exists to establish: the template mark and the state are
    // the brand tint, so reverting either to `neutral` fails here and not in six months.
    expect(elementWith(html, "data-assessment-state-badge"), "state").toContain(
      toneClasses("tint"),
    );
    expect(html, "template mark").toContain(toneClasses("tint"));
    expect(elementWith(html, "data-assessment-invite"), "invitation").toContain(
      toneClasses("soft"),
    );
    expect(html, "mode is a fact").toContain(toneClasses("neutral"));
  });

  it("the relationship list card does too, and keeps every data-* hook", () => {
    const html = renderToStaticMarkup(
      createElement(RelationshipCards, {
        copy: dashboardRelationshipsPageCopy,
        rows: [relationshipRow],
        unreadable: null,
      }),
    );
    // The template mark is the brand tint; a state is soft; the facts stay neutral.
    expect(html).toContain(toneClasses("tint"));
    expect(html).toContain(toneClasses("soft"));
    expect(html).toContain(toneClasses("neutral"));
    // The card stamps `data-relationship-status` on the `<li>`; the three below are on the chips.
    expect(html).toContain('data-relationship-status="active"');
    for (const hook of ["data-invite-view", "data-membership-state"]) {
      expect(elementWith(html, hook), hook).toContain(toneClasses("soft"));
    }
    expect(elementWith(html, "data-viewer-role")).toContain(toneClasses("neutral"));
  });

  it("the detail band draws the on-band tone, and keeps its three hooks", () => {
    const html = renderToStaticMarkup(
      createElement(TemplateDetail, { copy: templateDetailPageCopy, detail }),
    );
    expect(html).toContain(toneClasses("onBand"));
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
