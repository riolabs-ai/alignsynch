/**
 * `/quiz/<id>/play` plays the quiz the URL names.
 *
 * The route used to play `data/currentQuiz.ts` for every id: `quiz-play.tsx`
 * imported the one "playable" record at module scope and ignored the route param,
 * so `/quiz/quiz-world-geography-challenge/play` asked for world geography and
 * got world history. The repaired questions (t_d517c10a, #124) showed on the
 * detail card and never here.
 *
 * These cases render the page component itself — the server component unwraps
 * `params`, resolves the record and hands the play surface its questions — so the
 * assertion is about the route's own wiring, not about a helper it might call.
 * `renderToStaticMarkup` is enough: nothing here needs a DOM, and the play surface
 * renders its first question on the first pass (no client fetch to wait for).
 *
 * `next/navigation` is mocked **only** for `useRouter` (the play surface's exit
 * button); `notFound` is the real function, so the 404 cases assert the digest
 * Next actually throws (`NEXT_HTTP_ERROR_FALLBACK;404`) rather than a stand-in.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import QuizPlayPage from "@/app/(mainlayout)/quiz/[id]/play/page";
import { quizById } from "@/data/quizzes";

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
}));

vi.mock("next/navigation", async () => {
  const actual = await vi.importActual<typeof import("next/navigation")>("next/navigation");
  return { ...actual, useRouter: () => router };
});

/** What Next's `notFound()` throws, i.e. the 404 the route must produce. */
const NOT_FOUND_DIGEST = "NEXT_HTTP_ERROR_FALLBACK;404";

async function renderRoute(id: string): Promise<string> {
  const element = await QuizPlayPage({ params: Promise.resolve({ id }) });
  return renderToStaticMarkup(element);
}

describe("/quiz/[id]/play", () => {
  it("plays the quiz the URL names", async () => {
    const quiz = quizById("quiz-world-geography-challenge");
    expect(quiz).toBeDefined();
    const firstQuestion = quiz?.questions[0];
    expect(firstQuestion).toBeDefined();

    const html = await renderRoute("quiz-world-geography-challenge");

    expect(html).toContain(firstQuestion?.prompt);
    expect(html).toContain(quiz?.title);
    expect(html).toContain(firstQuestion?.options[0].text);
    expect(html).toContain(`Question 1 of ${quiz?.questions.length}`);
  });

  it("no longer plays the current quiz for a different id", async () => {
    const fallback = quizById("quiz-ultimate-world-history-trivia");
    expect(fallback).toBeDefined();

    const html = await renderRoute("quiz-world-geography-challenge");

    // The old route rendered this record for every id; it must not appear at all.
    expect(html).not.toContain(fallback?.title);
    expect(html).not.toContain(fallback?.questions[0].prompt);
  });

  it("is not-found for an unknown id", async () => {
    await expect(renderRoute("quiz-does-not-exist")).rejects.toMatchObject({
      digest: NOT_FOUND_DIGEST,
    });
  });

  it("is not-found for a matching id that has no questions, rather than playing another quiz", async () => {
    const empty = quizById("quiz-math-puzzles-and-problems");
    expect(empty?.questions).toHaveLength(0);

    await expect(renderRoute("quiz-math-puzzles-and-problems")).rejects.toMatchObject({
      digest: NOT_FOUND_DIGEST,
    });
  });
});
