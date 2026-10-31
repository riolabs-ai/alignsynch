/**
 * What the generator actually does, in one pure function.
 *
 * There is no model here: the "generator" picks rows out of `data/mock-quizzes` — the twenty
 * template records the library ships — filters them by the difficulty the form asked for, takes
 * as many as the count asks for, and retitles each one with the topic a person typed. The
 * difficulty and the count are read here, which is the point: before this module the form
 * collected both and discarded them, and every run returned five rows whatever the controls said.
 *
 * Kept out of the component for two reasons. It is the half of the feature a test can pin without
 * a browser, and the shuffle is injected (`random`) so a test fixes the order instead of asserting
 * "one of the twenty".
 */
import type { Quiz } from "@/content/quiz";

/** The counts the form offers, in the order it offers them. */
export const DRAFT_COUNTS = [5, 10, 15, 20] as const;

export interface DraftRequest {
  /** The topic a person typed. Trimmed; an empty topic builds nothing. */
  readonly topic: string;
  /** One of `DIFFICULTIES` (`easy` | `medium` | `hard`). Templates of another difficulty are not candidates. */
  readonly difficulty: string;
  /** How many drafts to build. Capped by how many templates the requested difficulty has. */
  readonly count: number;
  /** Injected so a test can fix the shuffle; the page passes `Math.random`. */
  readonly random?: () => number;
}

export interface DraftResult {
  readonly quizzes: Quiz[];
  /** How many templates in the library carry the requested difficulty — the cap on `quizzes`. */
  readonly available: number;
}

/** Fisher–Yates over a copy: the input array is a fixture and must not be reordered. */
function shuffle<T>(rows: readonly T[], random: () => number): T[] {
  const out = [...rows];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const swap = out[i];
    out[i] = out[j];
    out[j] = swap;
  }
  return out;
}

/**
 * Compose a draft from the template library.
 *
 * The result is a list of `Quiz` records the editor already knows how to open (`toDraft`), so a
 * draft is editable exactly like an authored quiz. Each row keeps its template's questions,
 * summary, categories and settings; only the identity, the title, the tags and the timer change.
 */
export function composeDraft(templates: readonly Quiz[], request: DraftRequest): DraftResult {
  const topic = request.topic.trim();
  const candidates = templates.filter((quiz) => quiz.difficulty === request.difficulty);
  const available = candidates.length;

  if (!topic || request.count <= 0) return { quizzes: [], available };

  const take = Math.min(request.count, available);
  const quizzes = shuffle(candidates, request.random ?? Math.random)
    .slice(0, take)
    .map((quiz, index) => ({
      ...quiz,
      id: `quiz-generated-${index + 1}`,
      slug: `generated-${index + 1}`,
      title: `${topic} - ${quiz.title}`,
      tags: [...quiz.tags, topic.toLowerCase()],
      // The draft is the chosen topic wearing a template's body, so it keeps that template's
      // own settings; only the timer is reset.
      settings: { ...quiz.settings, timeLimitSeconds: 0 },
    }));

  return { quizzes, available };
}
