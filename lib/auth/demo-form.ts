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
 * The field a role button carries the page it was asked to return to (#1187).
 *
 * A sign-in is a round trip, and `?next=` is the half of it the browser brought with it: a
 * signed-out POST to the create flow's stage 4 answers `303 → /login?next=<commit page>`, and a
 * button that ignores the value signs the person in and drops them somewhere else. The value is
 * **not** trusted here — it is whatever a client posted — so the action re-validates it
 * (`lib/auth/next-path.ts::signInDestination`) against the role's own destination before it is
 * used, exactly as `startGoogleSignIn` does for the same reason.
 */
export const DEMO_NEXT_FIELD = "next";

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

/**
 * What a **role button** answers (#218).
 *
 * The roles live on `/login` now, behind the unlock cookie, so their form is a different question
 * from the PIN's: there is no PIN field and no rate-limit branch (an unlock is already signed and
 * cannot be guessed), and the only refusals are about the sign-in itself — an unlock that no
 * longer verifies, a `demo_account` row that was never seeded, or an auth server that refused.
 * The sentence is still the server's (`lib/auth/demo-failure.ts`), never a literal in the button.
 *
 * No `ok` branch, for the same reason `DemoFormState` has none: a successful sign-in redirects,
 * so a state the browser could render as "signed in" would be a second answer to one question.
 */
export interface DemoRoleState {
  readonly status: "idle" | "rejected";
  readonly message: string;
}

export const INITIAL_DEMO_ROLE_STATE: DemoRoleState = { status: "idle", message: "" };

/**
 * A server action as the client component sees it. Written as a type here so the button module
 * never imports the `"use server"` file: the page passes the real action down as a prop, and a
 * client module that imported it directly would be a second place the action is wired.
 */
export type DemoRoleAction = (prev: DemoRoleState, formData: FormData) => Promise<DemoRoleState>;

/** The PIN gate's action, same construction. */
export type DemoGateAction = (prev: DemoFormState, formData: FormData) => Promise<DemoFormState>;

/**
 * What `/login` renders for the demo — decided on the server (`lib/auth/demo-surface.ts`) and
 * handed down as a prop, never fetched by a client component.
 *
 * `off` carries nothing because there is nothing to render; `roles` carries the action so the
 * three buttons are server-wired without the view naming the server module.
 */
export type DemoViewProps =
  | { readonly kind: "off" }
  | { readonly kind: "entry" }
  | {
      readonly kind: "roles";
      readonly action: DemoRoleAction;
      /**
       * The page the buttons must return to (#1187) — the raw `?next=` `/login` was opened with,
       * or `""` when it was opened with none. It rides each button's form as a hidden field
       * because a server action sees only what the form posted, and the action **re-validates**
       * it (`signInDestination`) before using it: absent or unsafe, the role's own destination
       * (`destinationFor(role)`) is the fallback.
       */
      readonly next: string;
    };
