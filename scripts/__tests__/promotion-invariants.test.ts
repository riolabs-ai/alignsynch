/**
 * The promotion half of `data:check` — the collection rules a single overlay
 * cannot see (B-01 / issue #27), exercised against violating fixtures.
 *
 * Numbering: issue #27 called these E11/E12/E13, but those codes are already
 * taken on `main` (E11 card shelves, E12 one record per subject, E13 analytics
 * keys), so the promotion rules continue the set as **E14 / E15 / E16 / E28 / W6**
 * (E28 — "the slot is a place a shelf renders" — arrived with P3, when the
 * campaign was wired into the projections and a dead slot stopped being harmless;
 * it was numbered `E17` until issue #103, which collided with the media registry's
 * `E17` and moved this one to the next free code).
 *
 * Written BEFORE the checks exist: every case below is a rule from B-01 §A2
 * (window), §A3 (one prize per quiz) and §A4 (no shadow identity), plus **E30** —
 * the window must cover the fixture clock, the rule issue #110 needed: E14/E15/E16/E28
 * were all green while both overlays rendered nowhere, because the window had closed
 * 21 months before the render instant. A rule that only has a passing case is not a
 * rule, so each one is asserted against a fixture that violates it and against the
 * authored pair, which must stay clean.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { zQuiz, type Quiz } from "../../content/quiz";
import { DEMO_NOW_ISO } from "../../content/core";
import { promotions } from "../../data/promotions";
import { quizById, quizzes } from "../../data/quizzes";
import { promotionFindings } from "../data-check-promotions";

/** The Science quiz's catalog window: the fixture clock + the authored 48 h. */
const CATALOG_ENDS = "2026-10-31T12:00:00.000Z";

/** The findings one rule produced — a rule must not answer for another rule. */
const byRule = (records: readonly unknown[], rule: string) =>
  promotionFindings(records, quizzes).filter((finding) => finding.rule === rule);

/** A violating copy of the authored `explore-page/popular[1]` overlay. */
const overlay = (overrides: Record<string, unknown> = {}) => ({ ...promotions[0], ...overrides });

/** A published quiz with a `publishedAt`, which no shipped record carries. */
const datedQuiz = (overrides: Record<string, unknown> = {}): Quiz =>
  zQuiz.parse({
    kind: "quiz",
    id: "quiz-dated",
    slug: "dated",
    title: "Dated Quiz",
    summary: "A quiz with a publication instant.",
    categoryIds: ["science"],
    difficulty: "easy",
    status: "published",
    publishedAt: "2026-11-01T00:00:00.000Z",
    questions: [],
    settings: {},
    stats: { plays: 10, capacity: 100, rewardCents: 500 },
    ...overrides,
  });

const joined = (record: Record<string, unknown>, quiz: Quiz) =>
  promotionFindings([record], [...quizzes, quiz]).filter((finding) => finding.rule === "W6");

/**
 * A published quiz whose prize has no window — the `W4` shape, which the v1 data repair
 * removed from every shipped record. The prize is deliberately not the overlay's 500¢, so
 * an override against it is exactly the "differs from the catalog and nothing bounds it"
 * case E15 exists for. The overlay's `endsAt` is the only thing that can bound it.
 */
const unboundedQuiz = (): Quiz =>
  datedQuiz({
    id: "quiz-unbounded",
    slug: "unbounded",
    title: "Unbounded Quiz",
    publishedAt: undefined,
    stats: { plays: 10, capacity: 2000, rewardCents: 900 },
  });

/* ================================================================== *
 * E14 — one quiz, one record per slot, engagement only
 * ================================================================== */

describe("E14 — a promotion joins to one quiz, once per slot, engagement-only", () => {
  it("passes the authored pair and reports nothing at all", () => {
    assert.deepEqual(promotionFindings(promotions, quizzes), []);
  });

  it("reports a quizId that names no quiz", () => {
    const findings = byRule([overlay({ quizId: "quiz-does-not-exist" })], "E14");
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /quiz-does-not-exist/);
  });

  it("reports a second campaign on the same (quizId, slot)", () => {
    const findings = byRule(
      [...promotions, overlay({ id: "promo-science-quiz-space-exploration-3" })],
      "E14",
    );
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /explore-page\/popular\[1\]/);
    assert.match(findings[0].message, /two campaigns|already/);
  });

  it("rejects a content key at parse time — `title` is unrepresentable", () => {
    const findings = byRule([overlay({ title: "Shadow Title" })], "E14");
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /title/);
    assert.match(findings[0].message, /engagement-only/);
  });

  it("rejects every content key, not only the one the card named", () => {
    for (const key of ["slug", "summary", "categoryIds", "questions", "author", "cover"]) {
      const findings = byRule([overlay({ [key]: "x" })], "E14");
      assert.equal(findings.length, 1, `${key} must be rejected`);
      assert.match(findings[0].message, new RegExp(key));
    }
  });

  it("rejects `labelOverride` — the field was deleted, not deprecated (A4)", () => {
    const findings = byRule([overlay({ labelOverride: "Space Quiz" })], "E14");
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /labelOverride/);
  });

  it("reports a record that oversubscribes its own seats", () => {
    const findings = byRule([overlay({ plays: 3000, capacity: 2500 })], "E14");
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /capacity|plays/);
  });
});

/* ================================================================== *
 * E15 — the window is valid and the prize is bounded
 * ================================================================== */

describe("E15 — window validity and a bounded prize", () => {
  it("passes the authored pair: $7.50 is legal only because the catalog window bounds it", () => {
    assert.deepEqual(byRule(promotions, "E15"), []);
    const science = quizById("quiz-science-quiz-space-exploration");
    assert.equal(science?.stats.rewardCents, 1000);
    assert.equal(science?.stats.limitedTimeEndsAt, "2026-10-31T12:00:00.000Z");
  });

  it("reports an endsAt that is not after startsAt", () => {
    const findings = byRule([overlay({ endsAt: "2025-01-01T00:00:00.000Z" })], "E15");
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /after startsAt/);
  });

  it("reports a reward override with no bound at all", () => {
    // A prize with no window is the shape the v1 data repair removed from every shipped
    // record, so the rule is proven the way the other negative cases are: a copy of the
    // catalog record with the window taken away.
    const findings = promotionFindings(
      [
        overlay({
          id: "promo-unbounded",
          quizId: "quiz-unbounded",
          slot: "explore-page/popular[0]",
          plays: 1872,
          capacity: 2000,
          rewardCents: 500,
        }),
      ],
      [...quizzes, unboundedQuiz()],
    ).filter((finding) => finding.rule === "E15");
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /endsAt|window/);
  });

  it("accepts the same override once it names an endsAt", () => {
    const bounded = overlay({
      id: "promo-unbounded",
      quizId: "quiz-unbounded",
      slot: "explore-page/popular[0]",
      plays: 1872,
      capacity: 2000,
      rewardCents: 500,
      endsAt: "2026-10-30T00:00:00.000Z",
    });
    const findings = promotionFindings([bounded], [...quizzes, unboundedQuiz()]).filter(
      (finding) => finding.rule === "E15",
    );
    assert.deepEqual(findings, []);
  });

  it("reports a $0.00 prize — 0 is the absence of a prize, not a prize", () => {
    const findings = byRule([overlay({ rewardCents: 0 })], "E15");
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /prize|positive/);
  });

  it("reports an endsAt that extends past the catalog window", () => {
    const findings = byRule([overlay({ endsAt: "2026-11-05T00:00:00.000Z" })], "E15");
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /shorten|extend|catalog window/);
  });
});

/* ================================================================== *
 * E16 — concurrent campaigns of one quiz agree field-wise
 * ================================================================== */

describe("E16 — one quiz advertises one set of numbers", () => {
  it("passes the authored pair: 2/2 slots agree", () => {
    assert.equal(promotions.length, 2);
    assert.equal(new Set(promotions.map((record) => record.quizId)).size, 1);
    assert.deepEqual(byRule(promotions, "E16"), []);
  });

  it("reports two concurrent campaigns that disagree on the prize", () => {
    const findings = byRule(
      [promotions[0], overlay({ ...promotions[1], rewardCents: 800 })],
      "E16",
    );
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /rewardCents/);
    assert.match(findings[0].message, /750/);
    assert.match(findings[0].message, /800/);
  });

  it("reports disagreement on the seat numbers", () => {
    const findings = byRule([promotions[0], overlay({ ...promotions[1], capacity: 2400 })], "E16");
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /capacity/);
  });

  it("allows sequential campaigns of one quiz to differ — only concurrency is a promise", () => {
    const first = overlay({ endsAt: "2026-10-30T00:00:00.000Z" });
    const second = overlay({
      ...promotions[1],
      startsAt: "2026-10-30T00:00:00.000Z",
      rewardCents: 800,
    });
    assert.deepEqual(byRule([first, second], "E16"), []);
  });

  it("ignores campaigns of different quizzes", () => {
    const other = overlay({
      id: "promo-geography",
      quizId: "quiz-world-geography-challenge-capitals-landmarks",
      slot: "explore-page/popular[0]",
      plays: 1872,
      capacity: 2000,
      rewardCents: 500,
      endsAt: "2026-10-30T00:00:00.000Z",
    });
    assert.deepEqual(byRule([promotions[0], other], "E16"), []);
  });
});

/* ================================================================== *
 * E28 — the slot is a place a shelf actually renders
 * ================================================================== */

describe("E28 — a campaign on a slot nobody renders never runs", () => {
  it("passes the authored pair: both slots resolve to their quiz", () => {
    assert.deepEqual(byRule(promotions, "E28"), []);
  });

  it("reports a slot group no shelf produces", () => {
    const findings = byRule([overlay({ slot: "explore-page/populr[1]" })], "E28");
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /populr/);
    assert.match(findings[0].message, /never runs/);
  });

  it("reports a position the shelf does not have", () => {
    // explorePopular renders 3 cards; position 3 is the fourth.
    const findings = byRule([overlay({ slot: "explore-page/popular[3]" })], "E28");
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /explorePopular/);
    assert.match(findings[0].message, /3 card/);
  });

  it("reports a real slot whose position renders a different quiz — the silent no-op", () => {
    // The worst case: the slot exists, the quiz exists, the campaign simply never
    // applies because curation puts another quiz at that position.
    const findings = byRule(
      [
        overlay({
          id: "promo-geography-wrong-slot",
          quizId: "quiz-world-geography-challenge-capitals-landmarks",
          slot: "explore-page/popular[1]",
          plays: 1872,
          capacity: 2000,
          rewardCents: 500,
        }),
      ],
      "E28",
    );
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /renders "quiz-science-quiz-space-exploration"/);
    assert.match(findings[0].message, /never run/);
  });

  it("reports a non-canonical index — `[01]` is not the slot a shelf produces", () => {
    const findings = byRule([overlay({ slot: "explore-page/popular[01]" })], "E28");
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /never runs/);
  });

  it("is an error, not a warning — a campaign that cannot run fails the build", () => {
    const findings = promotionFindings([overlay({ slot: "nowhere[0]" })], quizzes).filter(
      (finding) => finding.rule === "E28",
    );
    assert.deepEqual(
      findings.map((finding) => finding.severity),
      ["error"],
    );
  });
});

/* ================================================================== *
 * E30 — the window has to cover the fixture clock
 * ================================================================== */

describe("E30 — a campaign that is never live renders nowhere (issue #110)", () => {
  it("passes the authored pair: both windows are open at the fixture clock", () => {
    assert.deepEqual(byRule(promotions, "E30"), []);
    const science = quizById("quiz-science-quiz-space-exploration");
    assert.ok(science !== undefined);
    for (const promotion of promotions) {
      assert.ok(Date.parse(promotion.startsAt) <= Date.parse(DEMO_NOW_ISO), promotion.id);
      assert.ok(Date.parse(CATALOG_ENDS) > Date.parse(DEMO_NOW_ISO), promotion.id);
    }
  });

  it("reports a window that closed before the fixture clock", () => {
    // The shape #110 shipped: a campaign authored against the 2025 capture instant,
    // bounded by a catalog window that had ended 21 months before the demo present.
    const stale = overlay({
      startsAt: "2025-01-01T00:00:00.000Z",
      endsAt: "2025-01-02T00:00:00.000Z",
    });
    const findings = byRule([stale], "E30");
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /closed at 2025-01-02T00:00:00\.000Z/);
    assert.match(findings[0].message, new RegExp(DEMO_NOW_ISO.replaceAll(".", "\\.")));
    assert.match(findings[0].message, /dead data|never runs|catalog/);
  });

  it("is bounded by the catalog window, not by the absent endsAt", () => {
    // The authored overlay carries no `endsAt`, so the catalog's window is what closes
    // it. Moving that window back is enough to make a live campaign dead — which is
    // exactly how #110 happened, and why the check reads the derived bound.
    const science = quizById("quiz-science-quiz-space-exploration");
    if (science === undefined) throw new Error("the Science quiz should be a record");
    const staleCatalog: Quiz = {
      ...science,
      stats: { ...science.stats, limitedTimeEndsAt: "2025-01-03T00:00:00.000Z" },
    };
    const findings = promotionFindings(
      [overlay({ id: "promo-stale" })],
      quizzes.map((quiz) => (quiz.id === staleCatalog.id ? staleCatalog : quiz)),
    ).filter((finding) => finding.rule === "E30");
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /closed at 2025-01-03T00:00:00\.000Z/);
  });

  it("reports a campaign that starts after the fixture clock", () => {
    const findings = byRule([overlay({ startsAt: "2027-01-01T00:00:00.000Z" })], "E30");
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /after the fixture clock/);
  });

  it("is an error, not a warning — a campaign that cannot run fails the build", () => {
    const findings = byRule([overlay({ startsAt: "2027-01-01T00:00:00.000Z" })], "E30");
    assert.deepEqual(
      findings.map((finding) => finding.severity),
      ["error"],
    );
  });
});

/* ================================================================== *
 * W6 — a campaign staged outside the quiz's published life is a warning
 * ================================================================== */

describe("W6 — staging is allowed, silently applying is not", () => {
  it("does not warn for the authored pair (published, no publishedAt)", () => {
    assert.deepEqual(byRule(promotions, "W6"), []);
  });

  it("warns when the campaign targets a draft", () => {
    // No prize override here: a draft record has no catalog reward to be bounded by,
    // so an override would (correctly) be an E15 error as well as a W6 warning.
    const findings = byRule(
      [
        overlay({
          id: "promo-draft",
          quizId: "quiz-1",
          slot: "home[0]",
          rewardCents: undefined,
        }),
      ],
      "W6",
    );
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /draft|not published/);
  });

  it("warns when the campaign starts before the quiz was published", () => {
    const findings = joined(overlay({ id: "promo-dated", quizId: "quiz-dated" }), datedQuiz());
    assert.equal(findings.length, 1);
    assert.match(findings[0].message, /publishedAt|before/);
  });

  it("stays silent once the campaign starts after publication", () => {
    const findings = joined(
      overlay({ id: "promo-dated", quizId: "quiz-dated", startsAt: "2026-11-02T00:00:00.000Z" }),
      datedQuiz(),
    );
    assert.deepEqual(findings, []);
  });

  it("is a warning, not an error — it never fails the build", () => {
    // Staged against a *shelved* quiz made draft, so E28 stays silent (the slot does
    // render it) and W6 is the only finding: warn severity, build stays green.
    const science = quizById("quiz-science-quiz-space-exploration");
    if (science === undefined) throw new Error("the Science quiz should be a record");
    const shelvedDraft: Quiz = { ...science, status: "draft" };
    const findings = promotionFindings(
      [overlay({ id: "promo-draft", quizId: shelvedDraft.id, rewardCents: undefined })],
      quizzes.map((quiz) => (quiz.id === shelvedDraft.id ? shelvedDraft : quiz)),
    );
    assert.deepEqual(
      findings.map((finding) => [finding.rule, finding.severity]),
      [["W6", "warn"]],
    );
  });
});
