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
 * The card is a link to the discussion, so the redundant CTA is **retired**, not restyled: a
 * `<button>` (or an `asChild` that has nothing to slot onto) inside an `<a>` is invalid nesting,
 * and the label never reached the DOM under 1.2.2 anyway. This file renders the real page over
 * the real fixtures and asserts what that leaves: the render succeeds, and each card's own
 * anchor is the only affordance.
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

  it("offers one affordance per card, and it is the card's own link", () => {
    const html = render();

    // The retired CTA: a bare text child under `asChild` is what 1.2.2 silently dropped and what
    // 1.5 throws over. It is gone rather than restyled — nothing comes back in its place.
    expect(html).not.toContain("View Discussion");

    // Every card still reaches its discussion, through the anchor that wraps the whole card.
    const cardLinks = html.match(/href="\/quiz\/[^"]*\/discussion"/g) ?? [];
    expect(cardLinks).toHaveLength(discussions.length);

    // And no interactive control nests inside an anchor: each card already is one, so a second
    // control there is invalid HTML the version before this migration avoided by rendering
    // nothing at all.
    expect(html).not.toMatch(/<a\b[^>]*>(?:(?!<\/a>)[\s\S])*?<button\b/);
  });
});
