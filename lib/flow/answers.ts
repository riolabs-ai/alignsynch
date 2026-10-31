/**
 * A form post's fields → the `Map` the submission parser expects (#146, #213).
 *
 * The field name is `${kind}:${itemId}` (`components/assessment-flow/answer-form.tsx`), and
 * the kinds accepted are the ones the **instance's mode** defines — `feel` and `wish` for
 * Basic, all four for Advanced (`opinionKindsFor()`). The list is an argument rather than an
 * import because the mode is a property of the row, not of this parser: the route reads it
 * from the store first and passes it in, and the store re-reads it under the submit's lock.
 *
 * A post naming a kind the mode does not ask — `think:aspect-money` against a Basic instance
 * — is **refused**, never ignored: a field nobody reads is the kind of silent success the
 * freeze rule exists to prevent.
 *
 * Pure and free of `Request`: a route handler passes `FormData`, a test passes a `Map`.
 */
import type { OpinionKind } from "@/content/assessment";
import type { RawAnswer } from "@/lib/flow/state";

export interface ParsedForm {
  readonly answers: Map<string, RawAnswer>;
  readonly problems: string[];
}

export function answersFrom(form: FormData, kinds: readonly OpinionKind[]): ParsedForm {
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
    if (!(kinds as readonly string[]).includes(kind)) {
      problems.push(`${key}: "${kind}" is not an opinion kind this instance's mode asks`);
      continue;
    }
    const entry = answers.get(itemId) ?? {};
    entry[kind as OpinionKind] = value;
    answers.set(itemId, entry);
  }

  return { answers: answers as Map<string, RawAnswer>, problems };
}

type MutableAnswer = { feel?: string; wish?: string; think?: string; guess?: string };
