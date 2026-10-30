/**
 * A form post's fields → the `Map` the submission parser expects (#146).
 *
 * The field name is `${kind}:${itemId}` (`components/assessment-flow/answer-form.tsx`), and
 * the only kinds accepted are `BASIC_OPINION_KINDS` — `feel` and `wish`. A post naming
 * `think:aspect-money` is refused rather than ignored: this version does not collect
 * Advanced Mode, and a field nobody reads is the kind of silent success the freeze rule
 * exists to prevent.
 *
 * Pure and free of `Request`: a route handler passes `FormData`, a test passes a `Map`.
 */
import { BASIC_OPINION_KINDS } from "@/content/assessment";
import type { RawAnswer } from "@/lib/flow/state";

export interface ParsedForm {
  readonly answers: Map<string, RawAnswer>;
  readonly problems: string[];
}

export function answersFrom(form: FormData): ParsedForm {
  const answers = new Map<string, MutableAnswer>();
  const problems: string[] = [];

  for (const [key, value] of form.entries()) {
    if (typeof value !== "string") {
      problems.push(`${key}: a file where a score belongs`);
      continue;
    }
    const separator = key.indexOf(":");
    if (separator === -1) continue; // another field of the form (a CSRF-ish token, a button name)
    const kind = key.slice(0, separator);
    const itemId = key.slice(separator + 1);
    if (!(BASIC_OPINION_KINDS as readonly string[]).includes(kind)) {
      problems.push(`${key}: "${kind}" is not a Basic Mode opinion kind`);
      continue;
    }
    const entry = answers.get(itemId) ?? {};
    entry[kind as "feel" | "wish"] = value;
    answers.set(itemId, entry);
  }

  return { answers: answers as Map<string, RawAnswer>, problems };
}

type MutableAnswer = { feel?: string; wish?: string };
