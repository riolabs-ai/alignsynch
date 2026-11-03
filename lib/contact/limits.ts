/**
 * The contact form's rate limit, as two numbers — and the reason they are not in
 * `lib/contact/validation.ts`.
 *
 * The limit has two readers on opposite sides of a boundary. `validation.ts` uses it to answer
 * "has this client spent its budget", and it grows the whole parser in front of it — zod-free, but
 * reachable from `emailLooksDeliverable` in `lib/flow/resend.ts`, which reaches
 * `lib/flow/tokens.ts`, which imports `node:crypto`. The support inbox (#506) has to say **why** a
 * person could not submit a second time, so a client component renders the same window and the
 * same budget: importing them from `validation.ts` would drag `node:crypto` into the browser graph
 * and `data:check` E34 fails on exactly that crossing.
 *
 * So the two numbers live in a module with no imports at all, and both sides read them from here.
 * `validation.ts` re-exports them, because it is where a reader looking for "the form's rules"
 * starts and where every existing caller already points; the constants are defined once.
 */

/** The window the limit counts over: ten minutes. */
export const CONTACT_RATE_WINDOW_MS = 10 * 60 * 1_000;

/** How many messages one client, or one address, may send inside the window. */
export const CONTACT_RATE_MAX = 5;
