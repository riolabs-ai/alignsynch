// template-ancestor: components/ui/progress.tsx   (variation: three segments and one word, driven by the value in the field beside it)

/**
 * The password strength meter the sign-up step draws under the password field.
 *
 * **Advisory by construction.** It is handed the value the person is typing and renders a level;
 * it has no submit, no disabled state and no callback, so there is nothing here that could refuse
 * a password the server accepts. The server's floor is `PASSWORD_MIN_LENGTH` — imported by
 * `lib/auth/password-strength.ts`, never retyped — and the meter's two guidance lines are the same
 * two facts that score (`longEnough`, `variedEnough`), so the word and the lines cannot disagree.
 *
 * **Live, because the value is a prop.** The register view keeps the password in state, so every
 * keystroke re-renders this component with a new value: no effect, no timer, no ref. An empty
 * field renders nothing at all — a meter at "weak" before anyone has typed is a verdict on nobody.
 *
 * The words are `data/pages/register.ts`'s `strength` band, the numbers are
 * `lib/auth/reset-token.ts`, and the only literals here are class names (which the copy ratchet
 * E23 does not count, and the brand rule allows because they are status hues and tokens, not a
 * palette step).
 */
import type { PageCopy } from "@/content/pages";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/reset-token";
import {
  PASSWORD_STRENGTHS,
  passwordFactsOf,
  passwordStrengthSegments,
  passwordStrengthOf,
  type PasswordStrength,
} from "@/lib/auth/password-strength";
import { Check, Circle } from "lucide-react";

/** The fill for each level: a status hue, which both brands share on purpose. */
const FILL: Record<PasswordStrength, string> = {
  weak: "bg-red-500",
  fair: "bg-amber-500",
  strong: "bg-green-500",
};

/**
 * The two guidance lines, in the order they are shown, with the fact each one reads.
 *
 * `rule-length` carries `{min}` from the server's constant, so raising the floor is one edit in
 * `lib/auth/reset-token.ts` and this line follows.
 */
const RULES = [
  { id: "rule-length", met: (facts: ReturnType<typeof passwordFactsOf>) => facts.longEnough },
  { id: "rule-classes", met: (facts: ReturnType<typeof passwordFactsOf>) => facts.variedEnough },
] as const;

export function PasswordStrengthMeter({
  value,
  copy,
}: {
  /** The password field's current value — the whole input to this component. */
  value: string;
  /** The route's copy; this reads its `strength` band. */
  copy: PageCopy;
}) {
  const strength = passwordStrengthOf(value);
  // Nothing typed: no meter, no word, no guidance. `null` is "not judged yet", not "weak".
  if (strength === null) return null;

  const band = sectionOf(copy, "strength");
  const facts = passwordFactsOf(value);
  const filled = passwordStrengthSegments(strength);
  const values = { min: String(PASSWORD_MIN_LENGTH) };

  return (
    <div data-password-strength={strength} data-password-length={facts.length} className="mt-2">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1" aria-hidden="true">
          {PASSWORD_STRENGTHS.map((level, index) => (
            <span
              key={level}
              className={`h-1.5 flex-1 rounded-full ${
                index < filled ? FILL[strength] : "bg-gray-200 dark:bg-gray-700"
              }`}
            />
          ))}
        </div>
        {/*
          The one live region: a person typing hears the level change without the meter being a
          second form element. It reads its word from the fixture — no sentence is written here.
        */}
        <span aria-live="polite" className="text-xs font-medium text-gray-600 dark:text-gray-300">
          {itemLabel(band, strength)}
        </span>
      </div>
      <ul className="mt-1 space-y-0.5 text-xs text-gray-500 dark:text-gray-400">
        {RULES.map((rule) => {
          const met = rule.met(facts);
          const Mark = met ? Check : Circle;
          return (
            <li
              key={rule.id}
              data-rule={rule.id}
              data-met={met ? "true" : "false"}
              className="flex items-center gap-1"
            >
              <Mark className="h-3 w-3" aria-hidden="true" />
              {fillLabel(itemLabel(band, rule.id), values)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
