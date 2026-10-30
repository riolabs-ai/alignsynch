/**
 * The question pool a repaired record draws from.
 *
 * `data/mock-quizzes.ts` holds the 20 **quiz-generator templates** the bulk generator
 * (`scripts/gen-fixtures.mjs`) was derived from: five questions each, one template per
 * quiz category. A published record that never carried questions takes a template's set
 * instead of a set written for it — the questions are authored fixtures every gate
 * already validates, not prose invented to silence `W1`.
 *
 * The draw is deterministic and needs no clock and no randomness:
 *
 *   - candidates are the templates that share a category with the record, in
 *     `mock-quizzes.ts` order (`variant` picks among them, so two records in one
 *     category do not read identically; a category the templates do not cover — a
 *     browse card is the only place that happens — falls back to the whole pool). A
 *     category the templates cover **once** (general knowledge) necessarily yields the
 *     same five questions for every record in it: there is no second set to draw from,
 *     and writing one is the prose this module exists to avoid;
 *   - question ids are re-minted as `<quiz-id>-q<n>` (content/quiz.ts, design rule 6) so
 *     the collection stays unique under E3 — the template's own ids would collide with
 *     the template;
 *   - option ids and `correctOptionId` are carried verbatim. The key is an option id, not
 *     an index (D4), so re-minting the question id cannot re-point the answer.
 */
import type { Question } from "../content/quiz";
import { mockQuizzes } from "./mock-quizzes";

/** The templates that can answer for a record in `categoryIds`. */
function templatesFor(categoryIds: readonly string[]) {
  const matching = mockQuizzes.filter((quiz) =>
    quiz.categoryIds.some((id) => categoryIds.includes(id)),
  );
  return matching.length > 0 ? matching : mockQuizzes;
}

/**
 * The template's full question set for `quizId`, re-minted under that id.
 * `variant` selects the template when a category has more than one.
 */
export function templateQuestions(
  quizId: string,
  categoryIds: readonly string[],
  variant = 0,
): Question[] {
  const pool = templatesFor(categoryIds);
  const template = pool[variant % pool.length];
  return template.questions.map((question, index) => ({
    id: `${quizId}-q${index + 1}`,
    prompt: question.prompt,
    options: question.options.map((option) => ({ id: option.id, text: option.text })),
    correctOptionId: question.correctOptionId,
    ...(question.explanation !== undefined ? { explanation: question.explanation } : {}),
    ...(question.media !== undefined ? { media: question.media } : {}),
  }));
}
