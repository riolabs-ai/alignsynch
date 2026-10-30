/**
 * The panel's form contract — field names and the shape a submission answers (#183, part 2).
 *
 * A separate module from `app/(auth)/demo/actions.ts` for one mechanical reason: a `"use
 * server"` file may export **only** async functions, so the initial state and the field names
 * a client component needs cannot live beside the action. They are also not secrets — a field
 * name is in the markup already — so nothing here weakens the "no credential reaches the
 * browser" rule.
 */

/** The input name the PIN is posted under. */
export const DEMO_PIN_FIELD = "pin";

/** The submit button's name: its value is which of the three accounts to sign in as. */
export const DEMO_ROLE_FIELD = "as";

/**
 * What a submission answers.
 *
 * `idle` is the panel before anything was submitted; `rejected` carries the sentence for the cause
 * the server identified (`lib/auth/demo-failure.ts`: a wrong PIN or unknown role, a missing
 * `demo_account` row, or a refused sign-in — #216); `limited` is the rate limit, which says "too
 * many attempts" and nothing about the PIN. There is deliberately no `ok` branch: a successful
 * sign-in redirects, so a state the browser could render as "signed in" would be a second answer
 * to the same question.
 */
export interface DemoFormState {
  readonly status: "idle" | "rejected" | "limited";
  readonly message: string;
}

export const INITIAL_DEMO_FORM_STATE: DemoFormState = { status: "idle", message: "" };
