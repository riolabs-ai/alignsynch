/**
 * The quiz EDITOR's working shape.
 *
 * An authoring form is not a content record: it holds half-typed text, a radio
 * index for the answer key and a per-quiz settings bag that the form mutates
 * field by field. Keeping that shape local to the editor (instead of reaching
 * into `@/types/quiz`, which was one half of drift D1) is what lets the content
 * model stay strict.
 *
 * The boundary is `toDraft()`: one direction, from the model into the form. The
 * save path is not wired to the model yet — that is an authoring-API task, and
 * inventing a `fromDraft()` that guesses a category id would put the guess in
 * the data layer.
 */
import type { Quiz } from "@/content/quiz";

export interface QuestionDraft {
  id: number;
  text: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface QuizSettingsDraft {
  timeLimit: number;
  randomizeQuestions: boolean;
  showExplanations: boolean;
  passingScore: number;
  visibility: string;
  allowRetakes: boolean;
  questionTimer: number;
}

export interface QuizDraft {
  id: number;
  title: string;
  description: string;
  difficulty: string;
  tags: string[];
  questions: QuestionDraft[];
  settings: QuizSettingsDraft;
}

/** Model -> form. `index` is only the form's row key; the record id is preserved by the caller. */
export function toDraft(quiz: Quiz, index = 0): QuizDraft {
  return {
    id: index + 1,
    title: quiz.title,
    description: quiz.summary,
    difficulty: quiz.difficulty,
    tags: [...quiz.tags],
    questions: quiz.questions.map((question, questionIndex) => ({
      id: questionIndex + 1,
      text: question.prompt,
      options: question.options.map((option) => option.text),
      correctAnswer: Math.max(
        0,
        question.options.findIndex((option) => option.id === question.correctOptionId),
      ),
      explanation: question.explanation ?? "",
    })),
    settings: {
      timeLimit: Math.round(quiz.settings.timeLimitSeconds / 60),
      randomizeQuestions: quiz.settings.shuffleQuestions,
      showExplanations: quiz.settings.showExplanations,
      passingScore: quiz.settings.passingScore,
      visibility: quiz.settings.visibility,
      allowRetakes: quiz.settings.allowRetakes,
      questionTimer: quiz.settings.questionTimerSeconds,
    },
  };
}
