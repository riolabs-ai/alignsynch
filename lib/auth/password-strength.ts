/**
 * How strong a typed password looks — three words, and it is **advice, never a gate**.
 *
 * The server decides what a password may be (`lib/auth/reset-token.ts::PASSWORD_MIN_LENGTH` and
 * the provider's ceiling): this module only says what the person is holding, so the register form
 * can tell them before they submit instead of after. Nothing here returns "refused": a meter that
 * could block would be a second password policy in a client bundle, and the two would drift — the
 * one the server enforces is the only one that matters.
 *
 * Three levels rather than a score out of four or a percentage: `weak`, `fair`, `strong` are the
 * words a person can act on, and a number out of 100 invites tuning the number instead of the
 * password. The thresholds are deliberately modest — this is a sign-up form, not a vault — so a
 * long phrase reads strong on length alone and a short password with a capital, a digit and a
 * symbol reads strong on variety alone.
 *
 * The rules it checks are the two the form shows: enough characters, and more than one character
 * class. Both are computed from the value, in one pass, so the meter and its guidance can never
 * disagree about the same string.
 *
 * Pure: no clock, no fixture, no brand. `tests/password-strength.test.tsx` types three values
 * through the real view and reads the three states back.
 */
import { PASSWORD_MIN_LENGTH } from "./reset-token";

/** The three levels, weakest first. The order is the meter's fill order. */
export const PASSWORD_STRENGTHS = ["weak", "fair", "strong"] as const;

export type PasswordStrength = (typeof PASSWORD_STRENGTHS)[number];

/** What the value is, as two booleans the form draws guidance for — plus the raw counts. */
export type PasswordFacts = {
  /** Characters typed. Counted by code point, so an emoji is one character and not two. */
  readonly length: number;
  /** At least `PASSWORD_MIN_LENGTH` — the server's own floor, imported rather than retyped. */
  readonly longEnough: boolean;
  /** How many of lower-case, upper-case, digit and symbol appear at least once. `0`–`4`. */
  readonly classes: number;
  /** More than one class — the second guidance line, and half of the strength score. */
  readonly variedEnough: boolean;
};

/**
 * The facts about one typed value.
 *
 * The four class patterns are tested, not counted per character: one capital in a long password is
 * still variety, and the rule a reader can act on is "use more than one kind of character".
 */
export function passwordFactsOf(value: string): PasswordFacts {
  const characters = [...value];
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) =>
    pattern.test(value),
  ).length;
  return {
    length: characters.length,
    longEnough: characters.length >= PASSWORD_MIN_LENGTH,
    classes,
    variedEnough: classes >= 2,
  };
}

/**
 * The level, or `null` for an empty field.
 *
 * `null` is not `weak`: an empty password has not been judged yet, and a meter sitting at "weak"
 * the moment the step opens is a verdict on somebody who has not typed anything.
 *
 * Two points at most for length (12 characters and over) and two for variety (three classes and
 * over); `3` is strong, `1`–`2` is fair, `0` is weak. Measured on the three values the card names:
 * `abc` → weak, `abcdefgh` → fair (long enough, one class), `Abcdef1!` → strong.
 */
export function passwordStrengthOf(value: string): PasswordStrength | null {
  if (value === "") return null;
  const facts = passwordFactsOf(value);
  const lengthPoints = facts.length >= 12 ? 2 : facts.longEnough ? 1 : 0;
  const classPoints = facts.classes >= 3 ? 2 : facts.classes >= 2 ? 1 : 0;
  const score = lengthPoints + classPoints;
  if (score >= 3) return "strong";
  if (score >= 1) return "fair";
  return "weak";
}

/** How many of the meter's three segments are filled for a level. `0` when nothing is typed. */
export function passwordStrengthSegments(strength: PasswordStrength | null): number {
  if (strength === null) return 0;
  return PASSWORD_STRENGTHS.indexOf(strength) + 1;
}
