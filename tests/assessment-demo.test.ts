/**
 * `/assessment/demo/[type]` — the one worked example, proved against the projection it draws.
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
 *   4. **the CTA is a route that exists** — the type's live template record's create step, with
 *      the library as the fallback the catalogue card uses;
 *   5. **the box under it prices the plan, never the relationship** — no per-relationship figure is
 *      rendered, the plan-at-completion claim is stated, and the one way to a price leaves the app
 *      in a new tab (#805).
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

import DemoPage, { generateMetadata } from "@/app/(mainlayout)/assessment/demo/[type]/page";
import { formatCurrency } from "@/content/core";
import { GAP_KINDS, gapKindsIn, gapKindsOf } from "@/content/gaps";
import { assessments } from "@/data/assessments";
import {
  RELATIONSHIP_PRICE_CENTS,
  demoAnswersByType,
  demoAnswersFor,
  purchasableRelationshipTypes,
  purchasableRelationshipType,
} from "@/data/relationship-types";
import { assessmentDemo } from "@/lib/assessment-demo";
import { PRICING_PATH, createRelationshipPath } from "@/lib/flow/paths";

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
      const demo = assessmentDemo(id);
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
      const demo = assessmentDemo(id);
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

  it("points the Start CTA at the type's own record, never at /v1", () => {
    for (const id of DEMO_IDS) {
      const demo = assessmentDemo(id);
      if (demo === undefined) throw new Error(`no demo for "${id}"`);
      const record = assessments.find((entry) => entry.slug === id);
      if (record === undefined) throw new Error(`no template record for "${id}"`);
      expect(demo.startPath).toBe(createRelationshipPath(record.id));
      expect(demo.startPath.startsWith("/v1/")).toBe(false);
    }
  });
});

describe("a type with no example is a 404, not a fabricated report", () => {
  it("answers undefined for an unknown id", () => {
    expect(assessmentDemo("no-such-type")).toBeUndefined();
  });

  it("answers undefined for a type whose sheet is still unwritten", () => {
    const withoutDemo = purchasableRelationshipTypes.find(
      (type) => demoAnswersFor(type.id) === undefined,
    );
    if (withoutDemo === undefined) throw new Error("every purchasable type carries a sheet now");
    expect(assessmentDemo(withoutDemo.id)).toBeUndefined();
  });

  it("turns that into notFound() on the page", async () => {
    await expect(DemoPage({ params: Promise.resolve({ type: "no-such-type" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    await expect(
      generateMetadata({ params: Promise.resolve({ type: "no-such-type" }) }),
    ).resolves.toEqual({ title: "Example Not Found" });
  });
});

describe("the page draws the label and the report", () => {
  it("renders the type's finished report under an Example label", async () => {
    const type = "staff-manager";
    const demo = assessmentDemo(type);
    if (demo === undefined) throw new Error(`no demo for "${type}"`);

    const html = renderToStaticMarkup(await DemoPage({ params: Promise.resolve({ type }) }));

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

  it("titles the tab and the description from the report", async () => {
    const demo = assessmentDemo("co-founders");
    if (demo === undefined) throw new Error("no demo for co-founders");
    await expect(
      generateMetadata({ params: Promise.resolve({ type: "co-founders" }) }),
    ).resolves.toEqual({
      title: `${demo.report.title} — example report`,
      description: demo.report.summary,
    });
  });
});

describe("the box under the report prices the plan, never the relationship (#805)", () => {
  /** The route's own words, as a server render produces them — the only reading a crawler gets. */
  async function boxOf(type: string): Promise<string> {
    return renderToStaticMarkup(await DemoPage({ params: Promise.resolve({ type }) }));
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
    // `/pricing` is a public route and this page sits behind the app shell, so the departure is a
    // new tab that says so (`LeavingLink`) — E39, and the report survives the click.
    expect(html).toContain(`href="${PRICING_PATH}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("opens in a new tab");
  });

  it("reads no per-relationship figure at all, not merely prints none", () => {
    // A render proves today's output; the source scan proves the next edit cannot reintroduce the
    // read. The docblock names `RELATIONSHIP_PRICE_CENTS` as provenance for why it is *not* used
    // (the same shape `tests/member-templates-tabs.test.ts` scans `lib/member/shelf.ts` with), so
    // the scan is for a read: an import of the constant, a formatter call, or the type's field.
    const source = readFileSync(
      new URL("../app/(mainlayout)/assessment/demo/[type]/page.tsx", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(/import[^;]*RELATIONSHIP_PRICE_CENTS/);
    expect(source).not.toContain("formatCurrency");
    expect(source).not.toContain("type.price");
  });
});
