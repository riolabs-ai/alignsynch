/**
 * The comp band's request and result, as values (#505).
 *
 * A `"use server"` module may export only async functions, so the shape the form posts and the
 * shape the screen draws live here — the same split `lib/admin/repairs.ts` records for the five
 * relationship repairs. Nothing in this file imports `pg`, `next` or a component: it is the
 * vocabulary the server action and the client band share, and both sides `import type`.
 */

/** One comp, as the band posts it. Every field is a string from a form; the server parses them. */
export interface GrantFormInput {
  readonly relationshipId: string;
  /** The tier to grant. Refused unless `data/billing-plans.ts` authors it. */
  readonly planId: string;
  /** `comp` or `extend` — `GRANT_KINDS` in `lib/admin/billing-control.ts`. */
  readonly kind: string;
  /** `month` or `year` — `BILLING_INTERVALS`. */
  readonly interval: string;
  /** The first instant the granted tier covers, as the date input sent it. */
  readonly periodStart: string;
  /** Required: the audit row's reason, at least `REASON_MIN_LENGTH` characters. */
  readonly reason: string;
}

/**
 * What the band is told.
 *
 * `ok: false` carries a **code**, never a sentence: the words are `data/pages/admin-billing.ts`'s
 * (`refusals`), so a refusal the server words one way and the screen words another cannot happen.
 * The codes are `ActRefused.reason` and `GrantRefused.reason` verbatim, plus `signed-out` and
 * `failed` — and no code is invented for a database failure, which is rethrown rather than
 * flattened into a message that would claim nothing happened.
 */
export type GrantFormResult =
  | {
      readonly ok: true;
      /** The audit action name, so the screen can say what was recorded. */
      readonly action: "plan.comp";
      readonly grantId: string;
      readonly periodStart: string;
      readonly periodEnd: string;
    }
  | {
      readonly ok: false;
      readonly code:
        | "signed-out"
        | "role-too-low"
        | "reason-too-short"
        | "unknown-action"
        | "unknown-target-table"
        | "no-such-relationship"
        | "unknown-plan"
        | "invalid-period"
        | "period-already-granted"
        | "failed";
      /** The server's own sentence, shown beside the fixture's when it adds a fact. */
      readonly detail?: string;
    };
