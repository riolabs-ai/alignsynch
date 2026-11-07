/**
 * The window and its budget, as two numbers — and the reason they are not in `guard.ts`.
 *
 * A limit has two readers on opposite sides of a boundary. The server counts a client's recent
 * submissions; a **client component** has to say *why* a person cannot submit a second time, so
 * it renders the same window and the same budget. `guard.ts` is where the rules live, and a
 * module a browser may import must not hold a rule that grows a Node builtin behind it — the
 * support inbox's form is exactly that reader, and `data:check` E34 fails a `"use client"` entry
 * that reaches `node:crypto`.
 *
 * So the numbers live in a module with **no imports at all**. `guard.ts` re-exports them, because
 * it is where a reader looking for "the form's rules" starts; there is one definition, here.
 */

/** The window the limit counts over: ten minutes. */
export const CONTACT_RATE_WINDOW_MS = 10 * 60 * 1_000;

/** How many messages one client, or one address, may send inside the window. */
export const CONTACT_RATE_MAX = 5;

/**
 * The auth proxy's window and budget — a different trade from the contact form's.
 *
 * Five attempts a minute on the **credential paths only**. A person mistypes a password twice, not
 * five times in a minute, and a credential-stuffing run is thousands; the window is short so a
 * shared office address is not locked out for tea. It is deliberately the same budget as the demo
 * PIN (`lib/auth/demo-pin.ts`), which is the only other door in this app that can be knocked on.
 */
export const AUTH_RATE_WINDOW_MS = 60 * 1_000;

/** How many sign-in, sign-up or password-reset attempts one client may make inside the window. */
export const AUTH_RATE_MAX = 5;
