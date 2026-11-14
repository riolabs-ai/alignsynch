/**
 * `/relationship-types/[slug]/demo` — the one worked example, proved against the projection it
 * draws.
 *
 * The route's job is narrow and this file holds it to exactly that:
 *
 *   1. **it is the type's own report** — every Aspect the type carries is a row, the title and
 *      summary are the type's words, and both seats are named "You" and "Them";
 *   2. **it goes through the live projection** — the numbers are `assessmentReport()`'s, i.e.
 *      `gapKindsOf` over the two demo sheets, not a second copy typed for a marketing page, and
 *      an Advanced sheet draws all eight kinds on every row;
 *   3. **a type with no example is a 404** — an unknown id, a type that is not for sale and a
 *      purchasable type whose sheet has not been authored all answer `undefined`, which the page
 *      turns into `notFound()`;
 *   4. **the CTA is a public route** — `/register`, because the page is a marketing route and a
 *      create form behind a session is a sign-in wall;
 *   5. **the box under it prices the plan, never the relationship** — no per-relationship figure is
 *      rendered, the plan-at-completion claim is stated, and the one way to a price is `/pricing`
 *      (#805, and the move that brought this page into `(marketing)`).
 *
 * The starter check is `docs/V1-RETIREMENT.md`'s demo row: the surface was `/v1/...` and marked
 * **release** for launch criterion 5, so it moved here rather than being deleted.
 */
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

/**
 * The page under test resolves the request's session for its own action (#979), and
 * `@/lib/auth/session` reaches Neon's SDK — whose entry imports `next/headers`, which a plain node
 * process cannot resolve. The answer here is the signed-out one, the viewer this file's assertions
 * are written against (`VISITOR`); the member's half is `tests/catalogue-start-session.test.ts`.
 */
vi.mock("@/lib/auth/session", () => ({ currentUserIfConfigured: async () => null }));

import DemoPage, { generateMetadata } from "@/app/(marketing)/relationship-types/[slug]/demo/page";
import { formatCurrency } from "@/content/core";
import { GAP_KINDS, gapKindsIn, gapKindsOf } from "@/content/gaps";
import {
  RELATIONSHIP_PRICE_CENTS,
  demoAnswersByType,
  demoAnswersFor,
  purchasableRelationshipTypes,
  purchasableRelationshipType,
} from "@/data/relationship-types";
import { assessmentDemo } from "@/lib/assessment-demo";
import {
  PRICING_PATH,
  createRelationshipPath,
  relationshipTypeDemoPath,
  relationshipTypePath,
} from "@/lib/flow/paths";
import { START_PATH, startPathFor } from "@/lib/template-catalogue";
import { visitorOf } from "@/lib/start-path";

/** Every case here is the worked example as a **visitor** reads it; the member's half is
 *  `tests/catalogue-start-session.test.ts` (#979). */
const VISITOR = visitorOf("alignsynch");

/** The two types with an authored sheet — the demo's whole reachable set today. */
const DEMO_IDS = Object.keys(demoAnswersByType) as readonly string[];

describe("the worked example is one type's report, through the live projection", () => {
  it("has a sheet for exactly the ids the catalogue can link", () => {
    expect(DEMO_IDS.length).toBeGreaterThan(0);
    for (const id of DEMO_IDS) {
      expect(demoAnswersFor(id), `${id} is in demoAnswersByType without a sheet`).toBeDefined();
      expect(purchasableRelationshipType(id), `${id} is demoed but not for sale`).toBeDefined();
    }
  });

  it("draws one row per Aspect, titled by the type, with the two demo seats", () => {
    for (const id of DEMO_IDS) {
      const demo = assessmentDemo(id, VISITOR);
      if (demo === undefined) throw new Error(`no demo for "${id}"`);
      const type = purchasableRelationshipType(id);
      if (type === undefined) throw new Error(`no type for "${id}"`);

      expect(demo.type.id).toBe(id);
      expect(demo.report.title).toBe(type.name);
      expect(demo.report.summary).toBe(type.descriptor.whoItsFor);
      expect(demo.report.rows.map((row) => row.itemId)).toEqual(
        type.aspects.map((aspect) => aspect.id),
      );
      expect(demo.report.mode).toBe("advanced");
      expect(demo.report.setting).toBe("soft");
      expect(demo.report.rows.every((row) => row.left.name === "You")).toBe(true);
      expect(demo.report.rows.every((row) => row.right.name === "Them")).toBe(true);
    }
  });

  it("computes every Gap from the two sheets instead of storing one", () => {
    for (const id of DEMO_IDS) {
      const demo = assessmentDemo(id, VISITOR);
      if (demo === undefined) throw new Error(`no demo for "${id}"`);
      const type = purchasableRelationshipType(id);
      if (type === undefined) throw new Error(`no type for "${id}"`);
      const sheet = demoAnswersFor(id);
      if (sheet === undefined) throw new Error(`no sheet for "${id}"`);

      for (const row of demo.report.rows) {
        const expected = gapKindsOf(sheet.you[row.itemId], sheet.them[row.itemId]);
        expect(row.gaps, `"${id}" ${row.itemId}`).toEqual(expected);
        // Advanced Mode answers all four Opinions, so every row is all eight kinds.
        expect(gapKindsIn(row.gaps)).toEqual([...GAP_KINDS]);
      }
    }
  });

  it("points the Start CTA at the public gate, carrying this type's create step", () => {
    for (const id of DEMO_IDS) {
      const demo = assessmentDemo(id, VISITOR);
      if (demo === undefined) throw new Error(`no demo for "${id}"`);
      // The example is a `(marketing)` page, so `/register` is the honest action — the account is
      // created **first**, and since #867 the gate is told which template the reader chose, so the
      // sign-up lands on that template's stage 1 rather than on the brand's landing page.
      expect(demo.startPath).toBe(startPathFor(id, VISITOR));
      expect(demo.startPath.startsWith(`${START_PATH}?next=`)).toBe(true);
      expect(new URL(demo.startPath, "http://x").searchParams.get("next")).toBe(
        createRelationshipPath(id),
      );
      expect(demo.startPath.startsWith("/v1/")).toBe(false);
      // Never the in-app create address on its own: that is what the gate resolves to, not what a
      // signed-out reader is handed.
      expect(demo.startPath).not.toBe(createRelationshipPath(id));
    }
  });
});

describe("a type with no example is a 404, not a fabricated report", () => {
  it("answers undefined for an unknown id", () => {
    expect(assessmentDemo("no-such-type", VISITOR)).toBeUndefined();
  });

  it("answers undefined for a type whose sheet is still unwritten", () => {
    const withoutDemo = purchasableRelationshipTypes.find(
      (type) => demoAnswersFor(type.id) === undefined,
    );
    if (withoutDemo === undefined) throw new Error("every purchasable type carries a sheet now");
    expect(assessmentDemo(withoutDemo.id, VISITOR)).toBeUndefined();
  });

  it("turns that into notFound() on the page", async () => {
    await expect(DemoPage({ params: Promise.resolve({ slug: "no-such-type" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    await expect(
      generateMetadata({ params: Promise.resolve({ slug: "no-such-type" }) }),
    ).resolves.toEqual({ title: "Example Not Found" });
  });
});

describe("the page draws the label and the report", () => {
  it("renders the type's finished report under an Example label", async () => {
    const type = "staff-manager";
    const demo = assessmentDemo(type, VISITOR);
    if (demo === undefined) throw new Error(`no demo for "${type}"`);

    const html = renderToStaticMarkup(await DemoPage({ params: Promise.resolve({ slug: type }) }));

    expect(html).toContain("Example");
    expect(html).toContain(demo.report.title);
    expect(html).toContain(demo.report.summary);
    expect(html).toContain("You");
    expect(html).toContain("Them");
    // The report's own rows, not a marketing summary of them.
    expect(html).toContain("data-gap-kind");
    expect(html).toContain(`href="${demo.startPath}"`);
    expect(html).not.toContain("/v1");
  });

  it("sits one segment below the type's own public page, and links no app-shell route", async () => {
    const type = "staff-manager";
    const demo = assessmentDemo(type, VISITOR);
    if (demo === undefined) throw new Error(`no demo for "${type}"`);

    const html = renderToStaticMarkup(await DemoPage({ params: Promise.resolve({ slug: type }) }));

    // The address is the catalogue's, one level under the type page …
    expect(relationshipTypeDemoPath(type)).toBe(`/relationship-types/${type}/demo`);
    expect(html).not.toContain("/assessment/demo");
    // … the breadcrumb back is the type itself, not the signed-in library …
    expect(html).toContain(`href="${relationshipTypePath(type)}"`);
    expect(html).not.toContain('href="/templates/');
    // … and the page is the public one: no sidebar, no shelf column of its own.
    expect(html).not.toContain("data-tour");
  });

  it("titles the tab and the description from the report", async () => {
    const demo = assessmentDemo("co-founders", VISITOR);
    if (demo === undefined) throw new Error("no demo for co-founders");
    await expect(
      generateMetadata({ params: Promise.resolve({ slug: "co-founders" }) }),
    ).resolves.toEqual({
      title: `${demo.report.title} — example report`,
      description: demo.report.summary,
    });
  });
});

describe("the box under the report prices the plan, never the relationship (#805)", () => {
  /** The route's own words, as a server render produces them — the only reading a crawler gets. */
  async function boxOf(type: string): Promise<string> {
    return renderToStaticMarkup(await DemoPage({ params: Promise.resolve({ slug: type }) }));
  }

  it("renders no per-relationship amount on any demo", async () => {
    for (const id of DEMO_IDS) {
      const html = await boxOf(id);
      // This page printed "One relationship costs $9.99" until #805: the per-relationship model
      // #619 retired, and a figure here is a promise the completion step does not honour.
      expect(html, `"${id}" still quotes the relationship's price`).not.toContain(
        formatCurrency(RELATIONSHIP_PRICE_CENTS),
      );
      expect(html, `"${id}" still prices a relationship`).not.toContain("per relationship");
    }
  });

  it("says when the plan is chosen, and that the other person pays nothing", async () => {
    const html = await boxOf("staff-manager");
    // The claim, not the figure: one plan, chosen at completion, and the counterparty's seat is
    // free — the shipped statement the template detail's `no-money` item makes in full.
    expect(html).toContain(
      "Creating a relationship is free. Your plan decides how many you can hold at once",
    );
    expect(html).toContain("chosen when a relationship is ready to complete");
    expect(html).toContain("The other person joins by link and pays nothing.");
  });

  it("hands the reader the pricing page as the one place a price is named", async () => {
    const html = await boxOf("staff-manager");
    // `/pricing` is a public route and so is this page now, both under `(marketing)`: the link is
    // ordinary in-tree navigation, so it stays in the tab the reader is in. (`LeavingLink` is for
    // a dashboard → public departure; nothing on this route leaves the app.)
    expect(html).toContain(`href="${PRICING_PATH}"`);
    expect(html).not.toContain('target="_blank"');
  });

  it("reads no per-relationship figure at all, not merely prints none", () => {
    // A render proves today's output; the source scan proves the next edit cannot reintroduce the
    // read. The docblock names `RELATIONSHIP_PRICE_CENTS` as provenance for why it is *not* used
    // (the same shape `tests/member-templates-tabs.test.ts` scans `lib/member/shelf.ts` with), so
    // the scan is for a read: an import of the constant, a formatter call, or the type's field.
    const source = readFileSync(
      new URL("../app/(marketing)/relationship-types/[slug]/demo/page.tsx", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(/import[^;]*RELATIONSHIP_PRICE_CENTS/);
    expect(source).not.toContain("formatCurrency");
    expect(source).not.toContain("type.price");
  });
});
