/**
 * #795 — the shared record detail shell, proved on both pages that render it.
 *
 * The card's acceptance is three claims a reader can see and a test can hold:
 *
 *   1. **both detail pages render the same band component** — not two bands that look alike, the
 *      same one. The proof is byte-equality: the `<header>` of each page, with its `data-*` hooks
 *      stripped, is the same markup, because both pages hand the same record's title, roles line and
 *      summary to one `DetailBand`;
 *   2. **exactly one `<h1>` per page** — the relationship screen used to draw a page heading above a
 *      `CardTitle`, and two headings for one record is the defect the shell exists to prevent;
 *   3. **a crumb where the page asks for one** — `All templates` existed and `All relationships` did
 *      not (the artifact's F5), and the shell renders whichever the page hands it. Since #873 the
 *      relationship page hands none: it renders under the rail, and the rail is the way back, so
 *      the case now asserts the absence instead.
 *
 * Plus the two declared axes, and nothing else: the relationship's working panels sit in the
 * actions slot where the template draws “What you can do with it”, at the shell's panel heading size
 * (`text-base`, not the `text-2xl` `CardTitle` a 320 px rail cannot carry), and a template draws
 * none of them. Every assertion below is against rendered markup, because that is the thing the
 * artifact draws.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The relationship screen refreshes the band after an inline capture, so it reads the router. This
// file never presses a button; the stub exists only so a static render can reach `useRouter`.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
}));

import { RelationshipDetail } from "@/components/dashboard/relationship-detail";
import { TemplateDetail } from "@/components/assessment-flow/template-detail";
import { assessments } from "@/data/assessments";
import { dashboardRelationshipDetailPageCopy } from "@/data/pages/dashboard-relationship-detail";
import { templateDetailPageCopy } from "@/data/pages/assessment-template-detail";
import { relationshipType } from "@/data/relationship-types";
import { TEMPLATE_LIBRARY_PATH } from "@/lib/flow/paths";
import type { LibraryTemplateDetail } from "@/lib/db/template-library";
import type { MemberRelationshipView } from "@/lib/member/relationships";
import { itemLabel, sectionOf } from "@/lib/page-copy";

/** A template whose slug names a catalogue type — the band's three chips need one. */
function typeBearingRecord() {
  const found = assessments.find((entry) => relationshipType(entry.slug) !== undefined);
  if (found === undefined) throw new Error("data/assessments.ts names no catalogue type to draw");
  return found;
}

const record = typeBearingRecord();

function catalogueTypeOf(slug: string) {
  const found = relationshipType(slug);
  if (found === undefined) throw new Error(`"${slug}" names no catalogue type`);
  return found;
}

const type = catalogueTypeOf(record.slug);

/**
 * The markup as a reader sees it: tags dropped, entities decoded. A title of `Staff & Manager` is
 * `Staff &amp; Manager` in the HTML, and an apostrophe is `&#x27;`; comparing the raw string would
 * make this file assert the encoder, not the page.
 */
function textOf(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** One template, as the library read hands it to the page. */
const detail: LibraryTemplateDetail = {
  template: {
    id: record.id,
    slug: record.slug,
    title: record.title,
    summary: record.summary,
    status: "published",
    createdAt: "2026-10-26T09:00:00.000Z",
    aspectCount: record.items.length,
    instanceCount: 2,
    authorship: "built-in",
  },
  aspects: record.items.map((item, index) => ({
    id: item.id,
    position: index + 1,
    prompt: item.prompt,
    leftValue: item.leftValue,
    rightValue: item.rightValue,
  })),
};

/** The same record as a relationship: the initiator's draft, with no method on file. */
function relationshipView(overrides: Partial<MemberRelationshipView> = {}): MemberRelationshipView {
  return {
    id: "relationship-detail-shell",
    status: "draft",
    viewerRole: "initiator",
    isInitiator: true,
    templateId: record.id,
    templateSlug: record.slug,
    title: record.title,
    summary: record.summary,
    createdAt: "2026-11-01T00:00:00.000Z",
    publishedAt: null,
    sessionRecordId: null,
    aspectCount: record.items.length,
    invite: null,
    counterpartyName: null,
    initiatorName: "Avery",
    view: "not-published",
    membership: { state: "open", reason: null, endedAt: null, writable: true },
    template: record,
    aspectsEditable: true,
    publishable: true,
    hasMembership: false,
    completion: null,
    offersRepublish: false,
    trialWithoutLiveInvite: false,
    closed: false,
    trial: "none",
    trialEndsAt: null,
    lapseSentence: null,
    inviteLinkAvailable: false,
    /* #785 — the fork is not this file's subject; `tests/relationship-fork.test.tsx` drives it. */
    canForkTemplate: false,
    ...overrides,
  };
}

function templateHtml(): string {
  return renderToStaticMarkup(
    createElement(TemplateDetail, { copy: templateDetailPageCopy, detail }),
  );
}

function relationshipHtml(view: MemberRelationshipView = relationshipView()): string {
  const noop = async () => ({ ok: true as const }) as never;
  return renderToStaticMarkup(
    createElement(RelationshipDetail, {
      copy: dashboardRelationshipDetailPageCopy,
      relationship: view,
      onSaveAspects: noop,
      onPublish: noop,
      onRepublish: noop,
      onComplete: noop,
      onFork: noop,
      templatesHref: "/templates/relationship?view=mine",
    }),
  );
}

/** The identity band, whole. Both pages draw one, and it is the same element. */
function bandOf(html: string): string {
  const start = html.indexOf("<header");
  const end = html.indexOf("</header>");
  if (start === -1 || end === -1) throw new Error("the page drew no identity band");
  return html.slice(start, end + "</header>".length);
}

/** The same markup with every `data-*` hook removed — what the artifact draws, not what a suite reads. */
function bandPaint(html: string): string {
  return bandOf(html)
    .replace(/data-[a-z-]+="[^"]*"/g, "")
    .replace(/\s+/g, " ");
}

function countOf(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

describe("one band, one h1, and the crumb each page asks for", () => {
  it("draws the same band component on both pages", () => {
    const template = templateHtml();
    const relationship = relationshipHtml();
    expect(template).toContain('data-record-band="template"');
    expect(relationship).toContain('data-record-band="relationship"');
    /*
     * Byte-equal apart from the hooks: one component, one record, one paint.
     *
     * The relationship below names **nobody** in its seats — a draft nobody has joined yet — which
     * is the case where the two pages hand the identical values. #975 D9 gave the relationship's
     * roles line the people holding its seats (`Avery — Staff / Manager`), and `tests/
     * relationship-detail-identity.test.tsx` proves that line and the heading that carries it; this
     * case keeps proving the claim it was written for, that there is one band and not two that
     * look alike.
     */
    const seatless = relationshipHtml(
      relationshipView({ initiatorName: null, counterpartyName: null }),
    );
    expect(bandPaint(seatless)).toBe(bandPaint(template));
  });

  it("differs from the template's band in the roles line alone once a seat is named", () => {
    // #975 D9 — the one value that differs, and nothing else in the band moves with it.
    const named = bandPaint(relationshipHtml());
    const seatless = bandPaint(relationshipHtml(relationshipView({ initiatorName: null })));
    expect(named.replace("Avery — ", "")).toBe(seatless);
  });

  it("prints the group, the realm and the type, then the title, the roles and the summary", () => {
    const band = textOf(bandPaint(relationshipHtml()));
    const order = [
      type.shortName,
      record.title,
      `${type.roles.initiator} / ${type.roles.counterparty}`,
      record.summary,
    ];
    let at = -1;
    for (const needle of order) {
      const found = band.indexOf(needle, at + 1);
      expect(found, `"${needle}" is missing from the band, or out of order`).toBeGreaterThan(at);
      at = found;
    }
    expect(band).toContain(type.realm);
  });

  it("draws exactly one <h1> on each page", () => {
    expect(countOf(templateHtml(), "<h1")).toBe(1);
    expect(countOf(relationshipHtml(), "<h1")).toBe(1);
  });

  it("gives the template its crumb, and the relationship none — the rail is its way back (#873)", () => {
    const back = itemLabel(sectionOf(templateDetailPageCopy, "back"), "all");
    expect(templateHtml()).toContain(`data-record-back="template"`);
    expect(templateHtml()).toContain(`href="${TEMPLATE_LIBRARY_PATH}"`);
    expect(templateHtml()).toContain(`>${back}<`);

    // The relationship detail renders under the shell's rail, so a second "All relationships"
    // control above the title is the redundancy #873 struck out. The shell draws no `<nav>` when
    // no crumb is handed in — not a hidden one.
    const relationship = relationshipHtml();
    expect(relationship).not.toContain("data-record-back");
    expect(relationship).not.toContain('aria-label="All relationships"');
  });
});

describe("the shell's order — band, facts, actions, content", () => {
  it("puts the facts and the actions in the aside and the content after them, on both pages", () => {
    const template = templateHtml();
    const templateFacts = template.indexOf("data-template-detail-facts");
    for (const marker of ["data-template-detail-aspects", "data-template-detail-shape"]) {
      expect(
        template.indexOf(marker),
        `the template's ${marker} is not after its facts`,
      ).toBeGreaterThan(templateFacts);
    }

    const relationship = relationshipHtml();
    const relationshipFacts = relationship.indexOf("data-relationship-facts");
    for (const marker of ["data-relationship-aspects", "data-relationship-view"]) {
      expect(
        relationship.indexOf(marker),
        `the relationship's ${marker} is not after its facts`,
      ).toBeGreaterThan(relationshipFacts);
    }
  });

  it("opens with the band — the template after its crumb, the relationship without one", () => {
    const template = templateHtml();
    const templateBack = template.indexOf('data-record-back="template"');
    expect(templateBack, "template: no crumb").toBeGreaterThan(-1);
    expect(template.indexOf('data-record-band="template"')).toBeGreaterThan(templateBack);

    // #873 — the relationship's first element is the band: no crumb above it.
    const relationship = relationshipHtml();
    expect(relationship.indexOf('data-record-band="relationship"')).toBeLessThan(
      relationship.indexOf("<aside"),
    );

    for (const [page, html] of [
      ["template", template],
      ["relationship", relationship],
    ] as const) {
      const band = html.indexOf(`data-record-band="${page}"`);
      const aside = html.indexOf("<aside");
      const content = html.indexOf('<div class="min-w-0 space-y-6">');
      expect(band, `${page}: no band`).toBeGreaterThan(-1);
      expect(aside, `${page}: no aside`).toBeGreaterThan(band);
      expect(content, `${page}: no content column`).toBeGreaterThan(aside);
    }
  });

  it("draws the relationship's working panels above the content, in the actions slot", () => {
    const html = relationshipHtml();
    const facts = html.indexOf("data-relationship-facts");
    const gate = html.indexOf('data-publish-gate="membership-required"');
    const where = html.indexOf("data-relationship-view");
    expect(facts).toBeGreaterThan(-1);
    expect(gate).toBeGreaterThan(facts);
    expect(where).toBeGreaterThan(gate);
  });
});

describe("the two declared axes, and nothing else", () => {
  it("draws no working panel on a template", () => {
    const html = templateHtml();
    expect(html).not.toContain("data-publish-gate");
    expect(html).not.toContain("data-completion-gate");
    expect(html).not.toContain("data-relationship-edit");
    expect(html).toContain('data-template-detail-cta="create"');
  });

  it("draws the relationship's panels at the shell's panel heading, never a text-2xl title", () => {
    const html = relationshipHtml();
    expect(html).toContain('data-publish-gate="membership-required"');
    // The one type step the artifact moves: a 320 px rail cannot carry a `CardTitle`.
    expect(html).not.toContain("text-2xl");
    expect(html).toContain('<h2 class="text-base font-semibold text-foreground">');
  });

  it("keeps every hook the existing suites read", () => {
    const relationship = relationshipHtml();
    for (const hook of [
      "data-relationship-facts",
      'data-relationship-status="draft"',
      'data-relationship-invite="not-published"',
      'data-viewer-role="initiator"',
      'data-relationship-view="not-published"',
    ]) {
      expect(relationship, `the shell dropped ${hook}`).toContain(hook);
    }

    const template = templateHtml();
    for (const hook of [
      "data-template-detail-band",
      "data-template-detail-facts",
      "data-template-detail-actions",
      'data-template-detail-status="published"',
      "data-template-detail-authorship",
    ]) {
      expect(template, `the shell dropped ${hook}`).toContain(hook);
    }
  });
});

describe("the Aspects column", () => {
  it("shows the frozen list to a viewer who may not edit", () => {
    const html = relationshipHtml(relationshipView({ aspectsEditable: false }));
    expect(html).not.toContain("data-aspect-list");
    expect(html).toContain("data-relationship-aspect=");
    const text = textOf(html);
    for (const item of record.items) {
      expect(text, `the frozen list dropped "${item.prompt}"`).toContain(item.prompt);
    }
  });

  it("shows the editor while the relationship is editable", () => {
    const html = relationshipHtml();
    expect(html).toContain('data-aspect-list="true"');
    expect(html).not.toContain("data-relationship-aspect=");
  });
});
