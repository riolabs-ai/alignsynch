/**
 * The template-authoring rules, without a form or a database (#255).
 *
 * `lib/flow/template-draft.ts` is the whole of "may this be saved", and every claim below is one of
 * the issue's acceptance lines:
 *
 *   * a draft is saved with its Aspects **in authored order** and trimmed — the order is what both
 *     parties answer in, so it is the thing a test has to pin;
 *   * blank rows are not Aspects (the form draws eight and a person fills in five);
 *   * a partial row is refused, naming the Aspect the reader can count down to;
 *   * two questions that differ only by case or spacing are one question written twice;
 *   * a template with no Aspects, or more than eight, is refused.
 *
 * The codes are asserted rather than the sentences: the words a person reads are the page-copy
 * fixture's (`data/pages/assessment-template-new.ts`), and this module's job is to choose the right
 * one. A test that pinned English here would fail on a copy edit that is not a defect.
 */
import { describe, expect, it } from "vitest";
import { MAX_ASPECTS, readTemplateDraft } from "@/lib/flow/template-draft";

/** A row as the form posts it: three raw strings, each of which the draft trims. */
const row = (prompt: string, leftValue: string, rightValue: string) => ({
  prompt,
  leftValue,
  rightValue,
});

describe("readTemplateDraft", () => {
  it("keeps the Aspects in authored order and trims every field", () => {
    const result = readTemplateDraft({
      title: "  How we talk about money  ",
      rows: [
        row("  We share what we spend  ", " Never ", " Always "),
        row("We agree on a budget", "Never", "Always"),
        row("We talk about debt", "Openly", "Never"),
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.title).toBe("How we talk about money");
    expect(result.draft.aspects).toEqual([
      { prompt: "We share what we spend", leftValue: "Never", rightValue: "Always" },
      { prompt: "We agree on a budget", leftValue: "Never", rightValue: "Always" },
      { prompt: "We talk about debt", leftValue: "Openly", rightValue: "Never" },
    ]);
  });

  it("skips a row nobody touched and does not number around it", () => {
    const result = readTemplateDraft({
      title: "Savings",
      rows: [
        row("We save every month", "Never", "Always"),
        row("", "", ""),
        row("We have a plan for emergencies", "No", "Yes"),
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.aspects).toHaveLength(2);
    expect(result.draft.aspects[1]?.prompt).toBe("We have a plan for emergencies");
  });

  it("refuses a template with no Aspects at all", () => {
    const result = readTemplateDraft({
      title: "Empty",
      rows: [row("", "", ""), row("   ", " ", "")],
    });
    expect(result).toEqual({ ok: false, code: "no-aspects" });
  });

  it("refuses a template with no title", () => {
    const result = readTemplateDraft({
      title: "   ",
      rows: [row("We save every month", "Never", "Always")],
    });
    expect(result).toEqual({ ok: false, code: "no-title" });
  });

  it("refuses an Aspect missing a Value, naming the Aspect a reader would count to", () => {
    const result = readTemplateDraft({
      title: "Partly filled",
      rows: [
        row("We save every month", "Never", "Always"),
        row("", "", ""),
        row("We pay bills on time", "Late", ""),
      ],
    });
    expect(result).toEqual({ ok: false, code: "missing-value", aspectNumber: 2 });
  });

  it("refuses an Aspect with Values but no question", () => {
    const result = readTemplateDraft({
      title: "No question",
      rows: [row("", "Never", "Always")],
    });
    expect(result).toEqual({ ok: false, code: "missing-question", aspectNumber: 1 });
  });

  it("refuses two Aspects that ask the same question, across case and spacing", () => {
    const result = readTemplateDraft({
      title: "Asked twice",
      rows: [
        row("We talk about money", "Never", "Always"),
        row("  we  TALK about money ", "Rarely", "Often"),
      ],
    });
    expect(result).toEqual({ ok: false, code: "duplicate-prompt", aspectNumber: 2 });
  });

  it("accepts two questions that differ by punctuation — they are not the same question", () => {
    const result = readTemplateDraft({
      title: "Two questions",
      rows: [row("Do we save?", "Never", "Always"), row("Do we save!", "Never", "Always")],
    });
    expect(result.ok).toBe(true);
  });

  it(`holds exactly ${MAX_ASPECTS} Aspects and refuses the ${MAX_ASPECTS + 1}th`, () => {
    const rows = (count: number) =>
      Array.from({ length: count }, (_, index) => row(`Aspect ${index + 1}`, "Low", "High"));

    const atLimit = readTemplateDraft({ title: "Eight", rows: rows(MAX_ASPECTS) });
    expect(atLimit.ok).toBe(true);
    if (atLimit.ok) expect(atLimit.draft.aspects).toHaveLength(MAX_ASPECTS);

    expect(readTemplateDraft({ title: "Nine", rows: rows(MAX_ASPECTS + 1) })).toEqual({
      ok: false,
      code: "too-many-aspects",
    });
  });
});
