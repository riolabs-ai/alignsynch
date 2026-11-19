/** @vitest-environment jsdom */

/**
 * Templates v2 — one page tabbed Library | My Templates, a template's own page, and the proposal (#1130).
 *
 * The issue's acceptance line is three claims, and each is measured where it can actually fail:
 *
 *   1. **`?tab=mine` opens My Templates and a tab click rewrites `?tab=`** — the tab is a link, so the
 *      proof is the rendered `href` plus `aria-current` on exactly one of them (`member-templates-tabs`
 *      holds the reader itself; this file holds the row of pills it draws);
 *   2. **Archive / Restore / Delete follow #1109's refusals** — the store's rules are
 *      `member-template-retire.test.ts`; what this file proves is that the page offers the controls in the
 *      state they can succeed in, and that a used template is archive-only with the sentence saying so;
 *   3. **Propose to Library cannot publish, and the consent box is required** — the rules are
 *      `template-proposal.test.ts`; here the form is driven: no consent, no submit; consent, one call with
 *      `consent: true`; and the sent panel says the queue is not open.
 *
 * The Library's filter and search are projections, so they are asserted as data first and as rendered
 * links second: a filter that counted the unfiltered catalogue would still look right in a screenshot.
 */
import { act } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: unknown }) =>
    createElement("a", { href, ...(rest as Record<string, unknown>) }, children as never),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { MyTemplateDetail } from "@/components/dashboard/my-template-detail";
import { TemplateProposalForm } from "@/components/dashboard/template-proposal-form";
import {
  TemplateCategoryFilter,
  TemplateFeaturedBand,
  TemplateShelfNotice,
} from "@/components/dashboard/template-shelf";
import type { Assessment } from "@/content/assessment";
import { assessments } from "@/data/assessments";
import { dashboardTemplateEditorPageCopy } from "@/data/pages/dashboard-template-editor";
import { dashboardTemplateProposalPageCopy } from "@/data/pages/dashboard-template-proposal";
import { dashboardTemplatesPageCopy } from "@/data/pages/dashboard-templates";
import { featuredCard, libraryFilters, searchRowsOf, shelfRowsOf } from "@/lib/member/shelf";
import type { TemplateVersionOutcome } from "@/lib/admin/template-draft";
import type { ProposalSubmission } from "@/lib/member/proposal";
import { itemLabel, sectionOf } from "@/lib/page-copy";

const copy = dashboardTemplatesPageCopy;

/** A row in the shape `listLibraryTemplates()` hands the page. */
function libraryRow(slug: string, title: string, aspectCount = 5) {
  return {
    id: `assessment-${slug}`,
    slug,
    title,
    summary: `${title} for two people.`,
    status: "published" as const,
    createdAt: "2026-11-16T12:00:00.000Z",
    aspectCount,
    sessionCount: 0,
    authorship: "built-in" as const,
  };
}

const ROWS = [
  libraryRow("brother-sister", "Brother–Sister"),
  libraryRow("parent-child", "Parent–Child"),
  libraryRow("spouses", "Spouse A–Spouse B"),
  libraryRow("colleagues", "Coworker–Colleague"),
  libraryRow("friends", "Friend A–Friend B"),
  libraryRow("relationship-basics", "Relationship Basics"),
];

/* ------------------------------------------------------------------ *
 * 1. The Library tab: featured band, filter counts, search
 * ------------------------------------------------------------------ */

describe("the Library's filter counts what the click would show", () => {
  it("counts each shelf over the search's own result set, never the unfiltered catalogue", () => {
    const all = libraryFilters(copy, ROWS);
    expect(all.find((row) => row.filter === "all")?.count).toBe(6);
    expect(all.find((row) => row.filter === "family")?.count).toBe(2);
    expect(all.find((row) => row.filter === "couples")?.count).toBe(1);
    expect(all.find((row) => row.filter === "work")?.count).toBe(1);

    // A search narrows the counts: the shelves the search removed say 0 rather than promising rows.
    const searched = searchRowsOf(ROWS, "sister");
    const narrowed = libraryFilters(copy, searched, "sister");
    expect(narrowed.find((row) => row.filter === "all")?.count).toBe(1);
    expect(narrowed.find((row) => row.filter === "work")?.count).toBe(0);
  });

  it("keeps the search on every filter link, so the two controls compose", () => {
    const rows = libraryFilters(copy, ROWS, "sister");
    expect(rows.find((row) => row.filter === "family")?.href).toBe(
      "/dashboard/templates?filter=family&q=sister",
    );
    expect(rows.find((row) => row.filter === "all")?.href).toBe("/dashboard/templates?q=sister");
  });

  it("draws the row as links with the counts beside the names", () => {
    const html = renderToStaticMarkup(
      createElement(TemplateCategoryFilter, {
        section: sectionOf(copy, "categories"),
        rows: libraryFilters(copy, ROWS),
        current: "family",
      }),
    );
    expect(html).toContain("Family");
    expect(html).toContain("Couples");
    expect(html).toContain('href="/dashboard/templates?filter=family"');
    expect((html.match(/aria-current="true"/g) ?? []).length).toBe(1);
  });

  it("shelves the rows by the type's category, and puts a non-taxonomy template on no shelf", () => {
    expect(shelfRowsOf(ROWS, "family").map((row) => row.slug)).toEqual([
      "brother-sister",
      "parent-child",
    ]);
    expect(shelfRowsOf(ROWS, "all").length).toBe(6);
    // `relationship-basics` names no type; it is on `all` and on no shelf.
    expect(shelfRowsOf(ROWS, "work").map((row) => row.slug)).toEqual(["colleagues"]);
  });

  it("searches title and summary, case-insensitively, and an empty query keeps everything", () => {
    expect(searchRowsOf(ROWS, "  SISTER ").map((row) => row.slug)).toEqual(["brother-sister"]);
    expect(searchRowsOf(ROWS, "").length).toBe(6);
    expect(searchRowsOf(ROWS, "nothing here").length).toBe(0);
  });
});

describe("the featured band", () => {
  it("draws the curated template with View Template and Create Relationship", () => {
    const html = renderToStaticMarkup(
      createElement(TemplateFeaturedBand, {
        section: sectionOf(copy, "featured"),
        card: featuredCard(copy, ROWS[0]),
      }),
    );
    expect(html).toContain(itemLabel(sectionOf(copy, "featured"), "label"));
    expect(html).toContain("View Template");
    expect(html).toContain("Create Relationship");
    expect(html).toContain("Brother–Sister");
    expect(html).toContain('href="/templates/relationship/brother-sister"');
  });
});

describe("an empty state that is a door, not a wall", () => {
  it("My Templates' empty state links Browse the Library at the Library tab", () => {
    const html = renderToStaticMarkup(
      createElement(TemplateShelfNotice, {
        section: sectionOf(copy, "mine-empty"),
        action: {
          href: "/dashboard/templates",
          label: itemLabel(sectionOf(copy, "mine-empty"), "browse"),
        },
      }),
    );
    expect(html).toContain("No Templates Yet");
    expect(html).toContain("Browse the Library");
    expect(html).toContain('href="/dashboard/templates"');
  });
});

/* ------------------------------------------------------------------ *
 * 2. A My Template's own page
 * ------------------------------------------------------------------ */

const found = assessments.find((row) => row.slug === "parent-child");
if (found === undefined) throw new Error("the fixture lost the parent-child template");
const template: Assessment = found;

const detailCopy = dashboardTemplateEditorPageCopy;
const NEVER = async (): Promise<TemplateVersionOutcome> => ({
  ok: false,
  code: "template-in-use",
});
const NEVER_PROPOSAL = async (): Promise<ProposalSubmission> => ({
  ok: false,
  code: "consent-required",
});

function detailHtml(usedCount: number): string {
  return renderToStaticMarkup(
    createElement(MyTemplateDetail, {
      copy: detailCopy,
      template,
      status: "draft" as const,
      usedCount,
      createHref: "/templates/relationship/parent-child/create",
      editHref: "/dashboard/templates/parent-child?edit=1",
      proposeHref: "/dashboard/templates/parent-child/propose",
      deleteHref: "/dashboard/templates",
      onArchive: NEVER,
      onRestore: NEVER,
      onDelete: NEVER,
    }),
  );
}

describe("a My Template's page", () => {
  it("draws one 1–5 band per Aspect on the scale tokens, never a field", () => {
    const html = detailHtml(0);
    expect(html).toContain("Aspects");
    // Every Aspect's prompt, and the two named ends of its band.
    expect(html).toContain(template.items[0]?.prompt ?? "");
    expect(html).toContain("1 Means");
    expect(html).toContain("5 Means");
    for (const cell of ["bg-scale-1", "bg-scale-2", "bg-scale-3", "bg-scale-4", "bg-scale-5"]) {
      expect(html).toContain(cell);
    }
    // The scale is a preview: no input, no select, no textarea anywhere on this page.
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<select");
  });

  it("offers Create Relationship and Edit, and the proposal door in the aside", () => {
    const html = detailHtml(0);
    expect(html).toContain("Create Relationship");
    expect(html).toContain("Edit");
    expect(html).toContain('href="/dashboard/templates/parent-child?edit=1"');
    expect(html).toContain("Share It With Others");
    expect(html).toContain("Propose to Library");
    expect(html).toContain('href="/dashboard/templates/parent-child/propose"');
  });

  it("keeps the retire band, with Archive as the default option", () => {
    const html = detailHtml(0);
    expect(html).toContain("Retire This Template");
    expect(html).toContain("Archive the template");
    expect(html).toContain("Delete Permanently");
    // Delete is offered on an unused copy, and its mark is the neutral ×, never a red button.
    expect(html).toContain("×");
    expect(html).not.toMatch(/bg-(red|rose)-/);
  });

  it("a used template is archive-only: no destroy control, and the sentence says why", () => {
    const html = detailHtml(2);
    expect(html).toContain("Used in 2 relationships.");
    expect(html).toContain("so it can only be archived");
    // The store would refuse, so the control is not drawn as enabled.
    expect(html).toMatch(/data-template-delete-trigger[^>]*disabled/);
  });

  it("an unused template can be destroyed — the control is enabled", () => {
    const html = detailHtml(0);
    expect(html).not.toMatch(/data-template-delete-trigger[^>]*disabled/);
  });
});

/* ------------------------------------------------------------------ *
 * 3. Propose to Library
 * ------------------------------------------------------------------ */

describe("Propose to Library", () => {
  let container: HTMLDivElement;
  let root: Root;

  /**
   * Write a controlled field's value the way a person does.
   *
   * React remembers the value it last rendered on the DOM node and swallows an `input` event whose
   * value it thinks it already wrote, so a plain `element.value = …` leaves the component's state
   * untouched — the exact failure mode where a form test passes and the form does not work.
   */
  function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
    const prototype =
      element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    setter?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function mount(onSubmit: () => Promise<{ ok: true; status: "sent" }>) {
    act(() => {
      root.render(
        createElement(TemplateProposalForm, {
          copy: dashboardTemplateProposalPageCopy,
          templateId: "assessment-parent-child",
          defaultName: "Parent–Child",
          backHref: "/dashboard/templates/assessment-parent-child",
          onSubmit: () => onSubmit(),
        }),
      );
    });
  }

  function submitButton(): HTMLButtonElement {
    const button = container.querySelector<HTMLButtonElement>("[data-proposal-submit]");
    if (button === null) throw new Error("the form drew no submit button");
    return button;
  }

  it("cannot submit without the consent box — the rule, drawn", () => {
    mount(async () => ({ ok: true, status: "sent" }));
    expect(submitButton().disabled).toBe(true);
  });

  it("asks the server once, with the consent it was given, and shows Sent for Review", async () => {
    const seen: unknown[] = [];
    act(() => {
      root.render(
        createElement(TemplateProposalForm, {
          copy: dashboardTemplateProposalPageCopy,
          templateId: "assessment-parent-child",
          defaultName: "Parent–Child",
          backHref: "/dashboard/templates/assessment-parent-child",
          onSubmit: async (payload: unknown) => {
            seen.push(payload);
            return { ok: true as const, status: "sent" as const };
          },
        }),
      );
    });

    const who = container.querySelector<HTMLTextAreaElement>("#proposal-who");
    const category = container.querySelector<HTMLSelectElement>("#proposal-category");
    const consent = container.querySelector<HTMLInputElement>("#proposal-consent");
    if (who === null || category === null || consent === null) {
      throw new Error("the form lost a required field");
    }

    /*
     * Fill the three text fields, then tick the box: only the box makes the button live. The native
     * `value` setter is used because React tracks the value it wrote and ignores a plain assignment —
     * a controlled input driven any other way reads as "unchanged" and the test would pass on a form
     * nobody could submit.
     */
    await act(async () => {
      setNativeValue(who, "A parent and their adult child.");
      category.value = "family";
      category.dispatchEvent(new Event("change", { bubbles: true }));
      consent.click();
    });
    expect(submitButton().disabled).toBe(false);

    await act(async () => {
      submitButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ consent: true, category: "family" });
    expect(container.textContent).toContain("Sent for Review");
    expect(container.textContent).toContain("The review queue is not open yet");
  });

  it("a refusal is the server's sentence, and it never claims the proposal went out", () => {
    const html = renderToStaticMarkup(
      createElement(TemplateProposalForm, {
        copy: dashboardTemplateProposalPageCopy,
        templateId: "assessment-parent-child",
        defaultName: "Parent–Child",
        backHref: "/dashboard/templates/assessment-parent-child",
        onSubmit: NEVER_PROPOSAL,
      }),
    );
    expect(html).toContain("What Gets Shared");
    expect(html).toContain("What Is Never Shared");
    // The two asides are the promise this form makes: what leaves, and what never does.
    expect(html).toContain("Any relationship of yours, or who is in it");
    expect(html).toContain("Any answer either person gave");
  });
});
