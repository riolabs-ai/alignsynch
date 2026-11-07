/**
 * `/quiz-discussions` renders — the render-side half of the Radix Slot 1.5 migration.
 *
 * `@radix-ui/react-slot` 1.5 stopped tolerating a slot whose child is not exactly one React
 * element. `Button asChild` with a **text** child used to render nothing at all (1.2.2's
 * `SlotClone` returned `null` for a single non-element child), so the label simply disappeared;
 * 1.5 throws `Slot failed to slot onto its children` instead — at *request* time, in a component
 * the build never executes. `tests/parity/**` renders this route for its boundary answer only
 * (the surface is quiz-only), so it reported the throw but never the label, and nothing in the
 * gate would have caught the silent version before the bump.
 *
 * The card is a link to the discussion; "View Discussion" is its affordance, not a second
 * control, so it is a styled `<span>` — not a `<button>` inside an `<a>` and not an `asChild`
 * that has nothing to slot onto. This file renders the real page over the real fixtures and
 * asserts both halves: the render succeeds, and the label is inside an element.
 */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

import { QuizDiscussionsPage } from "@/components/quiz/quiz-discussion-page";
import { selectQuizDiscussions } from "@/content/quiz-result";
import { quizComments } from "@/data/quiz-comments";
import { quizResults } from "@/data/quiz-results";
import { quizzes } from "@/data/quizzes";

const discussions = selectQuizDiscussions(quizzes, quizResults, quizComments);

function render(): string {
  return renderToStaticMarkup(createElement(QuizDiscussionsPage, { discussions }));
}

describe("/quiz-discussions", () => {
  it("renders the feed from the real fixtures", () => {
    expect(discussions.length).toBeGreaterThan(0);
    const html = render();
    expect(html).toContain("Quiz Discussions");
  });

  it("draws every discussion card's affordance as text inside an element", () => {
    const html = render();

    // The label is what 1.2.2 silently dropped and what 1.5 throws over: an `asChild` with a
    // bare text child has nothing to slot onto. It has to be in the markup, in an element.
    expect(html).toMatch(/<span[^>]*>View Discussion<\/span>/);

    // One affordance per card, and none of them a second interactive control: each card is
    // already an `<a>`, and a `<button>` inside it is invalid nesting the version before this
    // migration quietly avoided by rendering nothing.
    const cards = html.match(/hover:bg-muted\/50/g) ?? [];
    const labels = html.match(/>View Discussion</g) ?? [];
    expect(labels).toHaveLength(cards.length);
    expect(html).not.toMatch(/<a\b[^>]*>(?:(?!<\/a>)[\s\S])*?<button\b/);
  });
});
