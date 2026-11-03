/**
 * The vocabulary one repair screen and its server action share (#503).
 *
 * **Why this is not in `actions.ts`.** That file is `"use server"`, and Next refuses a module with
 * that directive that exports anything but async functions — the build fails at
 * `collecting configuration for /admin/instances/[id]` with "A \"use server\" file can only export
 * async functions, found object". The five repair names and the two payload shapes are values and
 * types a client component also needs, so they live here, in a module with no directive: the
 * component imports the types, the action imports the names, and neither reaches `pg`.
 *
 * The names are a **closed list**, not a string the form may invent: `performRepair()` switches on
 * them and a value outside the union falls to a refusal rather than to an `undefined is not a
 * function` inside a transaction.
 */

/** The repair names the form may post. */
export const REPAIR_NAMES = ["unlock", "resend", "revoke", "void", "force-close"] as const;

export type RepairName = (typeof REPAIR_NAMES)[number];

/** What the form posts. `role` and `email` are only read by the repairs that use them. */
export interface RepairInput {
  readonly repair: string;
  readonly instanceRecordId: string;
  readonly reason: string;
  readonly role?: string;
  readonly email?: string;
}

/** What the component draws. `code` is always one the copy fixture has a sentence for. */
export type RepairOutcome =
  | {
      readonly ok: true;
      readonly action: string;
      readonly actionId: string;
      /** The one-time link a resend mints. Never stored, never logged, shown once. */
      readonly link?: string;
      readonly email?: string;
    }
  | { readonly ok: false; readonly code: string };
