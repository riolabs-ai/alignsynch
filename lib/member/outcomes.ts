/**
 * What a member action answers — the shapes that cross the client/server boundary (#533 phase 2).
 *
 * A `"use server"` module may export only async functions, so the result types cannot live beside
 * the actions; and a client component may not import `lib/db/**` (E34), so they cannot live beside
 * the writes either. They live here, importable by both, with no `pg` and no React in the closure.
 *
 * **Two fields are load-bearing and they are not the same thing.**
 *
 *   code     what the screen maps to a sentence — every value here has a fixture entry, and E23
 *            fails the build on an id a component asks for that the fixture does not carry.
 *   message  the server's own sentence, shown verbatim under the refusal. #533's acceptance asks
 *            for "the server error, not a disabled button" when a trial is already running, so a
 *            refusal that names an instant has to survive the trip to the browser: the code alone
 *            would let the screen invent a sentence, and an invented one cannot name the trial.
 *
 * Every `ok: true` carries `actionId` — the `admin_action` row the write left. It is what makes
 * "every state change goes through `act()`" checkable from the screen rather than only in the log.
 */
import type { TemplateSaveOutcome } from "@/lib/admin/template-draft";

/** A `zAssessment` finding, flattened to the field it names. */
export interface OutcomeProblem {
  readonly path: string;
  readonly message: string;
}

/**
 * A template create, clone or save.
 *
 * It is the console's own `TemplateSaveOutcome`, not a member-shaped copy of it: one editor renders
 * both paths (`components/admin/template-editor.tsx` in its `band: "private"` variation), so a
 * second outcome type would be a second answer to "what may a save say" — and the member copy's
 * `refusals` section already carries a sentence for every code in that union.
 */
export type TemplateWriteOutcome = TemplateSaveOutcome;

/** Starting a relationship from a template. */
export type RelationshipCreateOutcome =
  | { readonly ok: true; readonly id: string; readonly actionId: string }
  | { readonly ok: false; readonly code: string; readonly message?: string };

/** Saving a relationship's Aspects (and, optionally, moving it to `pending`). */
export type AspectsOutcome =
  | { readonly ok: true; readonly status: string; readonly actionId: string }
  | {
      readonly ok: false;
      readonly code: string;
      readonly message?: string;
      readonly problems?: readonly OutcomeProblem[];
    };

/**
 * Publishing. `url` is the one non-refusal failure shape: a checkout that has not completed is not
 * an error, it is where the browser goes — the relationship is untouched and publish is one click
 * again once the account is entitled.
 */
export type PublishOutcome =
  | {
      readonly ok: true;
      readonly actionId: string;
      readonly status: string;
      /** The link, shown once: the token is never stored, so no read can reprint it. */
      readonly inviteLink: string;
      readonly inviteExpiresAt: string;
      /** `null` when the account already paid for this relationship — no trial was started. */
      readonly trialEndsAt: string | null;
    }
  | {
      readonly ok: false;
      readonly code: string;
      readonly message?: string;
      readonly url?: string;
    };

/** Reissuing a lapsed or revoked invitation — one click, no Aspects re-entered. */
export type RepublishOutcome =
  | {
      readonly ok: true;
      readonly actionId: string;
      readonly inviteLink: string;
      readonly inviteExpiresAt: string;
    }
  | { readonly ok: false; readonly code: string; readonly message?: string };

/** The sentence a refusal draws: the server's own words, or the fixture's line for the code. */
export function refusalSentence(
  code: string,
  message: string | undefined,
  lookup: (id: string) => string | null,
): string {
  if (message !== undefined && message.trim() !== "") return message;
  return lookup(code) ?? lookup("failed") ?? code;
}
