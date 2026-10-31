/**
 * The generator is a template pick, and these are the four ways it could lie again (#287).
 *
 *   * it reads the difficulty the form asked for instead of ignoring it;
 *   * it reads the count, and where the library cannot fill the count it returns the templates
 *     that exist and reports the cap instead of inventing rows;
 *   * it retitles each row with the topic, so the draft is about what was typed;
 *   * the records it returns are editor-shaped — `toDraft` opens them, which is what "the draft
 *     is editable" means without a browser.
 *
 * The shuffle is injected, so every assertion is about a fixed order rather than "one of twenty".
 */
import { composeDraft, DRAFT_COUNTS } from "@/components/create/quiz-generator-templates";
import { toDraft } from "@/components/create/quiz-draft";
import { zQuiz } from "@/content/quiz";
import { mockQuizzes } from "@/data/mock-quizzes";
import { describe, expect, it } from "vitest";

/** A fixed "random" that walks 0, 0.01, 0.02 … — deterministic, and not a constant. */
const counting = () => {
  let n = 0;
  return () => {
    n += 1;
    return (n % 100) / 100;
  };
};

const templatesAt = (difficulty: string) => mockQuizzes.filter((q) => q.difficulty === difficulty);

describe("composeDraft", () => {
  it("returns only templates of the requested difficulty", () => {
    for (const difficulty of ["easy", "medium", "hard"]) {
      const { quizzes } = composeDraft(mockQuizzes, {
        topic: "World History",
        difficulty,
        count: 20,
        random: counting(),
      });
      expect(quizzes.length).toBeGreaterThan(0);
      for (const quiz of quizzes) expect(quiz.difficulty).toBe(difficulty);
    }
  });

  it("returns the count that was asked for when the library can fill it", () => {
    const { quizzes } = composeDraft(mockQuizzes, {
      topic: "World History",
      difficulty: "medium",
      count: 2,
      random: counting(),
    });
    expect(quizzes).toHaveLength(2);
  });

  it("stops at the templates that exist and says how many that is", () => {
    const hard = templatesAt("hard");
    const { quizzes, available } = composeDraft(mockQuizzes, {
      topic: "World History",
      difficulty: "hard",
      count: 20,
      random: counting(),
    });
    expect(quizzes).toHaveLength(hard.length);
    expect(available).toBe(hard.length);
    // No row is repeated to reach the requested count.
    expect(new Set(quizzes.map((q) => q.title)).size).toBe(quizzes.length);
  });

  it("retitles each row with the topic and keeps the template's questions", () => {
    const topic = "  Space Exploration  ";
    const { quizzes } = composeDraft(mockQuizzes, {
      topic,
      difficulty: "easy",
      count: 1,
      random: counting(),
    });
    const [draft] = quizzes;
    const template = mockQuizzes.find((q) => draft.title === `Space Exploration - ${q.title}`);

    expect(draft.title.startsWith("Space Exploration - ")).toBe(true);
    expect(template).toBeDefined();
    expect(draft.questions).toEqual(template?.questions);
    expect(draft.tags).toContain("space exploration");
    expect(draft.settings.timeLimitSeconds).toBe(0);
  });

  it("builds an editor-shaped record: toDraft opens it with the topic in the title", () => {
    const { quizzes } = composeDraft(mockQuizzes, {
      topic: "Space Exploration",
      difficulty: "medium",
      count: 1,
      random: counting(),
    });
    const [form] = quizzes.map((quiz, index) => toDraft(quiz, index));

    expect(form.title).toContain("Space Exploration");
    expect(form.questions.length).toBe(quizzes[0].questions.length);
    expect(form.questions[0].text).toBe(quizzes[0].questions[0].prompt);
  });

  it("builds records the content model accepts, not just objects shaped like one", () => {
    const { quizzes } = composeDraft(mockQuizzes, {
      topic: "Space Exploration",
      difficulty: "medium",
      count: 3,
      random: counting(),
    });
    expect(quizzes.length).toBe(3);
    for (const quiz of quizzes) expect(() => zQuiz.parse(quiz)).not.toThrow();
  });

  it("builds nothing from an empty topic", () => {
    const { quizzes } = composeDraft(mockQuizzes, {
      topic: "   ",
      difficulty: "medium",
      count: 5,
      random: counting(),
    });
    expect(quizzes).toEqual([]);
  });

  it("builds nothing for a count of zero or less", () => {
    for (const count of [0, -5]) {
      const { quizzes } = composeDraft(mockQuizzes, {
        topic: "World History",
        difficulty: "medium",
        count,
        random: counting(),
      });
      expect(quizzes).toEqual([]);
    }
  });

  it("never mutates the template library", () => {
    const before = mockQuizzes.map((q) => q.id);
    composeDraft(mockQuizzes, {
      topic: "World History",
      difficulty: "hard",
      count: 20,
      random: counting(),
    });
    expect(mockQuizzes.map((q) => q.id)).toEqual(before);
  });

  it("offers counts the library can actually serve", () => {
    expect(DRAFT_COUNTS).toEqual([5, 10, 15, 20]);
    expect(Math.max(...DRAFT_COUNTS)).toBeLessThanOrEqual(mockQuizzes.length);
  });
});
