/**
 * The locked report's one control leads to the **sheet**, never to the endpoint that writes it.
 *
 * `RelationshipReport` draws two different pages off one `screen`: the report when
 * `screen.report !== null`, and — before the second acceptance — the gate. The gate used to point
 * its "continue" CTA at `answersPath()`, which is `/assessment/instances/<id>/answers`: the
 * POST-only route handler the live sheet's form submits to (`app/.../answers/route.ts` exports
 * `POST` and nothing else, because Next refuses a `page.tsx` and a `route.ts` in one segment —
 * that split is why the sheet lives at `/answer`, singular). An `<a>` issues a **GET**, so the one
 * button a party is told to press to finish their own sheet answered **405**.
 *
 * The fix is one call — `answerSheetPath()` — and this file is what keeps it fixed. Three things,
 * in the order a reader needs them:
 *
 *   1. **the gate's CTA is a link to the sheet** — the anchor carrying `data-report-continue` has
 *      `href="…/answer"`, and the markup carries no anchor to `…/answers` at all;
 *   2. **the gate still says what it promised** — heading, own progress, the no-leak sentence and
 *      the CTA's label are rendered, because a nav fix must not quietly cost the page its words;
 *   3. **why `/answers` cannot be the target** — read off the route module itself: it exports
 *      `POST` and no `GET`, and the sibling `answer/page.tsx` is the page that exists. That is the
 *      invariant the href depends on, so it is asserted beside the href rather than in a comment.
 *
 * "Renders" means `renderToStaticMarkup` over a hand-built `FlowScreen` with `report: null` — the
 * gate needs no database and no session, which is the whole point of `screen.report === null`
 * being the lock. `pnpm parity` does not cover this route (its `/assessment/avery-rowan` pair is
 * the v1 `[slug]` report, a different page module), so this is the file that pins the markup.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RelationshipReport } from "@/components/assessment-flow/report-view";
import { SCORE_MAX, SCORE_MIN } from "@/content/record";
import { relationshipReportPageCopy } from "@/data/pages/assessment-relationship-report";
import { answerSheetPath, answersPath, instancePath } from "@/lib/flow/paths";
import type { FlowScreen } from "@/lib/flow/screen";

/** The instance the fixture names — any id would do; a real-looking one keeps the URLs legible. */
const INSTANCE_ID = "instance-report-gate";

/** Every `href` in a rendered tree, in document order. */
function hrefsOf(html: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
}

/** The opening `<a>` tag that carries one attribute, or a thrown error naming the miss. */
function anchorWith(html: string, attribute: string): string {
  const match = html.match(new RegExp(`<a [^>]*${attribute}[^>]*>`));
  if (match === null) throw new Error(`no anchor carrying ${attribute}`);
  return match[0];
}

/** The `href` of that anchor. */
function hrefOf(html: string, attribute: string): string {
  const href = anchorWith(html, attribute).match(/href="([^"]*)"/);
  if (href === null) throw new Error(`the anchor carrying ${attribute} has no href`);
  return href[1];
}

/**
 * The locked screen: an unfinished sheet, a claimed counterparty, nothing accepted, no report.
 *
 * `own: null` on every Aspect is what makes it a *party's* unfinished sheet rather than an empty
 * one — the gate's progress line counts the answered Aspects off this array, so a fixture with
 * rows would render a different sentence than the one asserted below.
 */
function lockedScreen(): FlowScreen {
  return {
    instanceRecordId: INSTANCE_ID,
    relationshipId: "relationship-report-gate",
    slug: "relationship-basics-instance-report-gate",
    title: "Relationship Basics",
    summary: "An instance between two people.",
    status: "answering",
    mode: "basic",
    setting: "soft",
    viewer: { role: "initiator", name: "Avery" },
    aspects: [
      {
        itemId: "feel",
        prompt: "How do you feel about this?",
        leftValue: "Not at all",
        rightValue: "Completely",
        min: SCORE_MIN,
        max: SCORE_MAX,
        own: null,
      },
      {
        itemId: "wish",
        prompt: "What do you wish for?",
        leftValue: "Nothing",
        rightValue: "Everything",
        min: SCORE_MIN,
        max: SCORE_MAX,
        own: null,
      },
    ],
    initiatorName: "Avery",
    counterpartyName: "Rowan",
    seats: [
      { role: "initiator", name: "Avery", answered: 0, acceptedAt: null },
      { role: "counterparty", name: "Rowan", answered: 0, acceptedAt: null },
    ],
    viewerAnswered: 0,
    viewerAccepted: false,
    waiting: ["initiator", "counterparty"],
    invite: null,
    report: null,
  };
}

function renderGate(): string {
  return renderToStaticMarkup(
    createElement(RelationshipReport, {
      screen: lockedScreen(),
      copy: relationshipReportPageCopy,
    }),
  );
}

describe("the locked report's continue CTA", () => {
  it("links to the sheet page, not to the POST-only endpoint", () => {
    const html = renderGate();
    const sheet = answerSheetPath(INSTANCE_ID);

    expect(sheet).toBe(`${instancePath(INSTANCE_ID)}/answer`);
    expect(hrefOf(html, 'data-report-continue="true"')).toBe(sheet);
    expect(hrefsOf(html)).toContain(sheet);
  });

  it("draws no anchor to /answers anywhere on the page", () => {
    const html = renderGate();

    expect(hrefsOf(html).filter((href) => href.endsWith("/answers"))).toEqual([]);
    // The label differs from the sheet's own address by one letter, so the loose form is checked
    // too: a `…/answers` written as a bare string, an `action` on a stray form, or a href built by
    // hand rather than by `answersPath()` would all slip past the exact comparison above.
    expect(html).not.toMatch(/href="[^"]*\/answers[^"]*"/);
    expect(html).not.toContain(`href="${answersPath(INSTANCE_ID)}"`);
  });

  it("keeps the gate's words and its one control", () => {
    const html = renderGate();
    const gate = relationshipReportPageCopy.sections?.find((section) => section.id === "gate");
    if (gate?.heading === undefined) throw new Error("no gate section with a heading");

    expect(html).toContain('data-report-gated="true"');
    expect(html).toContain(gate.heading);
    expect(html).toContain("You have answered 0 of 2 Aspects.");
    expect(html).toContain("Answer your Aspects");
    // The back link is the other destination on this page and it stays the relationship itself.
    expect(hrefsOf(html)).toContain(instancePath(INSTANCE_ID));
    // Two destinations, one of them the sheet: a third would mean the gate grew a control the
    // card never asked for, and that control would need its own link assertion.
    expect(hrefsOf(html)).toHaveLength(2);
  });
});

describe("why the CTA cannot point at /answers", () => {
  const flowDir = "app/(mainlayout)/assessment/instances/[instanceId]";

  it("is a POST-only route handler: no GET export to answer a browser", () => {
    const source = readFileSync(join(process.cwd(), flowDir, "answers/route.ts"), "utf8");

    expect(source).toMatch(/export async function POST/);
    expect(source).not.toMatch(/export (?:async )?function GET/);
    expect(source).not.toMatch(/export const GET/);
  });

  it("has a sibling answer page, which is what answerSheetPath() addresses", () => {
    const page = join(process.cwd(), flowDir, "answer/page.tsx");

    expect(existsSync(page)).toBe(true);
    expect(readFileSync(page, "utf8")).toMatch(/export default async function/);
  });
});
