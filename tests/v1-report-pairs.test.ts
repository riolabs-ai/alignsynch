/**
 * The V1 report's comparison table — every Gap prints the two Opinions it subtracts.
 *
 * The defect this file exists to keep buried: the rebuilt report showed a "Widest gap 3" with no
 * pair behind it, so a reader was handed a number about two people and no way to see which two
 * answers produced it. The report now draws, per Aspect, both parties' Opinions and one row per
 * Gap kind naming the party, the opinion and the value on each side (`content/gaps.ts::GAP_KIND_SOURCES`
 * is the one table of pairs; the component reads it rather than restating it).
 *
 * Four facts, all asserted against the real `data/v1/fixtures.ts` seeds through
 * `renderToStaticMarkup`, which is the markup the screen draws:
 *
 *   1. **mechanism** — every row's text carries both sides, named by party, with that party's
 *      own value, and the row's `data-gap-number` equals `gapKindsOf` — never a number that
 *      names no pair;
 *   2. **Basic is four kinds** — `rel-aligned` draws Feel, Wish, Initiator and Counterparty per
 *      Aspect, in glossary order, and no prediction row anywhere;
 *   3. **Advanced is eight** — `rel-advanced` adds the four prediction kinds, and each one pairs
 *      the predicting party's Think/Guess against the **other** party's Feel/Wish;
 *   4. **blind before scoring** — `rel-sharing-unmet` has both parties submitted but neither
 *      accepted, and the report shows the gate with no Aspect card, no table and no value.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OPINION_LABELS } from "@/content/assessment";
import {
  GAP_KIND_SOURCES,
  gapKindsIn,
  gapKindsOf,
  type GapKind,
  type GapSourceSide,
} from "@/content/gaps";
import type { V1Relationship } from "@/data/v1/fixtures";
import { seedRelationships } from "@/data/v1/fixtures";
import { aspectGapsOf, sessionCompleteOf } from "@/lib/v1/derive";
import { ReportBody } from "@/components/v1/report-body";

/** One seeded relationship by id — the same rows the prototype reads. */
function relationship(id: string): V1Relationship {
  const found = seedRelationships.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`the fixtures have no relationship "${id}"`);
  return found;
}

const render = (rel: V1Relationship): string =>
  renderToStaticMarkup(createElement(ReportBody, { rel, templateTitle: "Sample" }));

/** The per-Aspect cards, keyed by Aspect id, so a row is read against its own Aspect's answers. */
function cardsOf(html: string): Map<string, string> {
  const cards = new Map<string, string>();
  for (const chunk of html.split('<section data-aspect="').slice(1)) {
    const id = chunk.slice(0, chunk.indexOf('"'));
    cards.set(id, chunk.slice(0, chunk.indexOf("</section>")));
  }
  return cards;
}

interface RenderedRow {
  readonly kind: GapKind;
  /** The row's visible text, tags stripped — what a reader is handed. */
  readonly text: string;
  /** `data-gap-number`, the value the row prints. */
  readonly gap: string;
}

function rowsOf(card: string): RenderedRow[] {
  return [...card.matchAll(/<tr data-gap-kind="([a-z-]+)"[^>]*>([\s\S]*?)<\/tr>/g)].map(
    (match) => ({
      kind: match[1] as GapKind,
      text: match[2]
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
      gap: /data-gap-number="(\d)"/.exec(match[2])?.[1] ?? "missing",
    }),
  );
}

/** One side of a Gap as the report words it: the party's name, the opinion, their value. */
function named(side: GapSourceSide, rel: V1Relationship, itemId: string): string {
  const answers =
    side.party === "initiator" ? rel.initiatorAnswers[itemId] : rel.counterpartyAnswers[itemId];
  const name = side.party === "initiator" ? rel.initiatorName : (rel.counterpartyName ?? "");
  return `${name} ${OPINION_LABELS[side.opinion]} ${answers?.[side.opinion]}`;
}

describe("every Gap in the V1 report names the two opinions it compares", () => {
  it("prints both sides of every row, with the gap `gapKindsOf` computes", () => {
    const rel = relationship("rel-aligned");
    const cards = cardsOf(render(rel));
    expect(cards.size).toBe(rel.items.length);

    for (const item of rel.items) {
      const card = cards.get(item.id);
      if (card === undefined) throw new Error(`no card rendered for ${item.id}`);
      const gaps = aspectGapsOf(rel, item.id);
      const rows = rowsOf(card);
      expect(rows.map((row) => row.kind)).toEqual(gapKindsIn(gaps));

      for (const row of rows) {
        const source = GAP_KIND_SOURCES.find((candidate) => candidate.kind === row.kind);
        if (source === undefined) throw new Error(`no source for ${row.kind}`);
        expect(row.text).toContain(named(source.left, rel, item.id));
        expect(row.text).toContain(named(source.right, rel, item.id));
        expect(row.gap).toBe(String(gaps[row.kind]));
      }
    }
  });

  it("draws the four Basic kinds and no prediction, on a Basic relationship", () => {
    const html = render(relationship("rel-aligned"));
    const firstCard = [...cardsOf(html).values()][0];
    expect(firstCard).toContain("Feelings and Wishes Differ");
    expect(firstCard).toContain("Desires To Change");
    expect(firstCard).not.toContain("Prediction Gaps and Analysis");
    expect(html).not.toContain("Think Gap");
    expect(html).not.toContain("Guess Gap");
  });

  it("pairs a prediction against the other party's actual, on an Advanced relationship", () => {
    const rel = relationship("rel-advanced");
    const html = render(rel);
    const predictions: readonly { kind: GapKind; predictor: "initiator" | "counterparty" }[] = [
      { kind: "initiator-think", predictor: "initiator" },
      { kind: "initiator-guess", predictor: "initiator" },
      { kind: "counterparty-think", predictor: "counterparty" },
      { kind: "counterparty-guess", predictor: "counterparty" },
    ];

    for (const item of rel.items) {
      const card = cardsOf(html).get(item.id);
      if (card === undefined) throw new Error(`no card rendered for ${item.id}`);
      const rows = rowsOf(card);
      expect(rows).toHaveLength(8);
      expect(card).toContain("Prediction Gaps and Analysis");

      for (const { kind, predictor } of predictions) {
        const source = GAP_KIND_SOURCES.find((candidate) => candidate.kind === kind);
        if (source === undefined) throw new Error(`no source for ${kind}`);
        // The prediction belongs to one party and is measured against the other's actual answer.
        expect(source.left.party).toBe(predictor);
        expect(source.right.party).not.toBe(predictor);
        const row = rows.find((candidate) => candidate.kind === kind);
        if (row === undefined) throw new Error(`no row for ${kind}`);
        expect(row.text).toContain(named(source.left, rel, item.id));
        expect(row.text).toContain(named(source.right, rel, item.id));
      }
    }
  });

  it("gates an unscored relationship: no card, no table, no value", () => {
    const rel = relationship("rel-sharing-unmet");
    // The premise: both parties submitted, neither accepted — the blind rule is still in force.
    expect(sessionCompleteOf(rel)).toBe(false);
    const html = render(rel);

    expect(html).toContain("Report locked");
    expect(html).not.toContain("data-aspect=");
    expect(html).not.toContain("data-gap-kind");
    expect(html).not.toContain("<table");
    expect(html).not.toMatch(/Feel [1-5]/);
    expect(html).not.toMatch(/Wish [1-5]/);
  });
});

describe("the gap kinds the fixtures imply are the kinds the report draws", () => {
  it("measures eight kinds per Aspect in Advanced Mode", () => {
    const rel = relationship("rel-advanced");
    for (const item of rel.items) {
      const gaps = gapKindsOf(rel.initiatorAnswers[item.id], rel.counterpartyAnswers[item.id]);
      expect(gapKindsIn(gaps)).toHaveLength(8);
    }
  });
});
