/**
 * The onboarding flow's draft (#688) — stage 1's answers, carried to stage 2.
 *
 * **One object, two steps.** The create flow used to be one form: a person filled the names,
 * the address and the two choices, and either submitted all of it or lost all of it. The
 * approved flow (`docs/review/artifacts/prototype-relationship-lifecycle-v5.html`) splits it
 * into Stage 1 (Who) and Stage 2 (Mode), so the values have to survive a step — and the step
 * is a page navigation, so "survive" means *persisted*, not component state. They live in one
 * small JSON object, written to one cookie per template, read back by both stages.
 *
 * **A cookie, not a table.** A draft is one person's unfinished typing on one template; it
 * has no identity, no lifetime worth auditing, and nothing joins to it. A `draft` table would
 * be a migration, a cleanup job and a row per abandoned form; a cookie is deleted by the
 * browser on its own and by the create on success. The value is percent-encoded JSON, small
 * (well under the 4 KB cookie ceiling), and read through a schema so a hand-edited cookie
 * falls back to an empty draft instead of throwing during a render.
 *
 * **Validation answers with the field, not with a column.** A refusal names one field and one
 * reason (`"email"`, `"required"`); the *sentence* is the fixture's, composed with the field's
 * own label — so a refusal says "Their email address must be an address the invitation can
 * reach", never `counterparty_email` and never a sentence typed into the route. Both stages go
 * through here before the store is asked anything: the store's `required()` message is for an
 * operator reading a log, this is for the person filling the form.
 *
 * Pure on purpose — no `next/headers`, no React — so the rules are unit-tested without a
 * server, and the two route handlers and the two pages share exactly one implementation.
 */
import { z } from "zod";
import { ALIGNMENT_SETTINGS, ASSESSMENT_MODES } from "@/content/assessment";
import { zAspectDraft } from "./aspects";
import { personName } from "./names";
import { emailLooksDeliverable } from "./resend";

/**
 * The draft, as the three stages build it.
 *
 * Every value is a string because every value arrives as form text: `mode` and
 * `alignmentSetting` are parsed against the model's enums by `modeDraft` below, and a draft
 * that has only been through Stage 1 carries them empty. `.catchall` is deliberately absent —
 * the object is written by this module alone, and an unknown key is not something to preserve.
 *
 * `aspects` is **optional and absent until stage 3 saves**, which is the distinction stage 3
 * needs: absent means "the person has not touched the list, seed it from the template", and an
 * empty array means "a list the person emptied". A `default([])` would collapse the two and
 * silently restore the template under somebody who had just deleted its last Aspect (#689).
 */
const zCreateDraft = z
  .object({
    /**
     * Each seat as the four fields Stage 1 asks (#825). The *stored* party name is composed from
     * them (`personName()`), so the draft keeps the split the form collected: the title is
     * derived from first + last-initial, and a reload has to re-derive it from the same parts
     * rather than from a string somebody already flattened.
     */
    initiatorFirst: z.string(),
    initiatorLast: z.string(),
    counterpartyFirst: z.string(),
    counterpartyLast: z.string(),
    email: z.string(),
    title: z.string(),
    description: z.string(),
    mode: z.string(),
    alignmentSetting: z.string(),
    aspects: z.array(zAspectDraft).optional(),
  })
  .strict();

export type CreateDraft = z.infer<typeof zCreateDraft>;

/** A draft with nothing in it — what Stage 1 renders before anybody has typed. */
export const EMPTY_CREATE_DRAFT: CreateDraft = {
  initiatorFirst: "",
  initiatorLast: "",
  counterpartyFirst: "",
  counterpartyLast: "",
  email: "",
  title: "",
  description: "",
  mode: "",
  alignmentSetting: "",
};

/**
 * The two seats' names, composed from the four fields the form collects (#825).
 *
 * The draft stores the parts; everything downstream — the party row, the invitation's "who is
 * inviting you", the dashboard — wants one string. `personName()` is that one composition, so a
 * seat's name cannot be spelled two ways depending on which module flattened it.
 */
export function initiatorNameOf(draft: CreateDraft): string {
  return personName(draft.initiatorFirst, draft.initiatorLast);
}

export function counterpartyNameOf(draft: CreateDraft): string {
  return personName(draft.counterpartyFirst, draft.counterpartyLast);
}

/** The fields a refusal may name. The id, never a column name. */
export const CREATE_DRAFT_FIELDS = [
  "initiator-first",
  "initiator-last",
  "counterparty-first",
  "counterparty-last",
  "email",
  "title",
  "mode",
  "setting",
] as const;

export type CreateDraftField = (typeof CREATE_DRAFT_FIELDS)[number];

/**
 * Why a field was refused.
 *
 * `required` — nothing was typed where something has to be.
 * `email`    — it was typed, but it is not an address a mailer could reach.
 * `choice`   — it is not one of the options this form offered (a crafted or stale post).
 */
export const CREATE_DRAFT_REASONS = ["required", "email", "choice"] as const;

export type CreateDraftReason = (typeof CREATE_DRAFT_REASONS)[number];

export interface CreateDraftProblem {
  readonly field: CreateDraftField;
  readonly reason: CreateDraftReason;
}

/** Both stages answer the same shape: the next draft, or the one field to fix. */
export type CreateDraftStep =
  | { readonly ok: true; readonly draft: CreateDraft }
  | { readonly ok: false; readonly problem: CreateDraftProblem };

/** Is this query value a field this module can name? A stray one draws no sentence. */
export function isCreateDraftField(value: string | undefined): value is CreateDraftField {
  return value !== undefined && (CREATE_DRAFT_FIELDS as readonly string[]).includes(value);
}

/** Is this query value a reason this module can name? */
export function isCreateDraftReason(value: string | undefined): value is CreateDraftReason {
  return value !== undefined && (CREATE_DRAFT_REASONS as readonly string[]).includes(value);
}

/**
 * Read the draft out of a cookie value, or `null` when there is nothing trustworthy there.
 *
 * The value is base64url (see `serializeCreateDraft`); anything that is not a decodable JSON
 * object of the right shape is "no draft", because a hand-edited or stale cookie must render an
 * empty Stage 1 rather than throw during a render.
 */
export function parseCreateDraft(raw: string | undefined): CreateDraft | null {
  if (raw === undefined || raw === "") return null;
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const parsed = zCreateDraft.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * The cookie value for a draft.
 *
 * **base64url, not URL-encoded JSON.** Next serialises a cookie through the `cookie` package,
 * which percent-encodes the value again — measured: a `encodeURIComponent(JSON)` value landed in
 * the header as `%257B…`, and the read handed back the single-encoded string, so one decode left
 * JSON that still would not parse. base64url is cookie-octet-safe on its own (alphanumerics, `-`,
 * `_`, no padding), so nothing re-encodes it and the round trip is exact.
 */
export function serializeCreateDraft(draft: CreateDraft): string {
  return Buffer.from(JSON.stringify(draft), "utf8").toString("base64url");
}

/**
 * Stage 1 — **Details** (#825, v9 artifact `s4Who`).
 *
 * Each seat is two fields — first and last — and the invitation address is a third. The store
 * has always refused a blank name or address (`required()` in `lib/flow/store.ts`), but that
 * refusal is a code for an operator; this one names the field's label and happens one page
 * earlier, so the person is looking at the input they have to fix instead of at Stage 2.
 *
 * **Which halves are required is the artifact's decision, not a convenience.** The Initiator's
 * first *and* last name are required (the person is signing in; their name is known), the
 * Counterparty's first name is required and their last name is **optional** — the invitation is
 * addressed to somebody who has not told us their surname yet, and `personName()` renders the
 * seat without it. The address is required because the invitation has no destination without
 * it, and so is the title, which the form derives until somebody types over it.
 *
 * `title` arrives already derived-or-edited (`derivedTitle()` in the form, `whoDraft` here just
 * trims it) — the flow stores the answer, never the derivation.
 */
export function whoDraft(read: (name: string) => string): CreateDraftStep {
  const initiatorFirst = read("initiatorFirst").trim();
  if (initiatorFirst === "") {
    return { ok: false, problem: { field: "initiator-first", reason: "required" } };
  }

  const initiatorLast = read("initiatorLast").trim();
  if (initiatorLast === "") {
    return { ok: false, problem: { field: "initiator-last", reason: "required" } };
  }

  const counterpartyFirst = read("counterpartyFirst").trim();
  if (counterpartyFirst === "") {
    return { ok: false, problem: { field: "counterparty-first", reason: "required" } };
  }

  // The one optional half: a surname nobody has given us yet is not a refusal.
  const counterpartyLast = read("counterpartyLast").trim();

  const email = read("email").trim();
  if (email === "") return { ok: false, problem: { field: "email", reason: "required" } };
  if (!emailLooksDeliverable(email) || email.length > 254) {
    return { ok: false, problem: { field: "email", reason: "email" } };
  }

  const title = read("title").trim();
  if (title === "") return { ok: false, problem: { field: "title", reason: "required" } };

  return {
    ok: true,
    draft: {
      initiatorFirst,
      initiatorLast,
      counterpartyFirst,
      counterpartyLast,
      email,
      title,
      description: read("description").trim(),
      // Stage 2 has not happened yet; these stay empty until it does.
      mode: "",
      alignmentSetting: "",
    },
  };
}

/**
 * Stage 2 — **Settings**.
 *
 * Mode is fixed at creation; the Setting is what a party may move later. Neither is
 * pre-selected on the form, so both are refused-with-nothing-chosen here rather than defaulted
 * — a default would be this flow choosing a bar for two people who never saw the question.
 *
 * A value that is not one of the model's own options is a `choice` refusal, not a `required`
 * one: the difference is what a person is told to do (pick one vs. stop posting invented ones),
 * and the store refuses it again before the transaction opens.
 */
export function modeDraft(read: (name: string) => string, previous: CreateDraft): CreateDraftStep {
  const mode = read("mode").trim();
  if (mode === "") return { ok: false, problem: { field: "mode", reason: "required" } };
  if (!(ASSESSMENT_MODES as readonly string[]).includes(mode)) {
    return { ok: false, problem: { field: "mode", reason: "choice" } };
  }

  const alignmentSetting = read("alignmentSetting").trim();
  if (alignmentSetting === "") {
    return { ok: false, problem: { field: "setting", reason: "required" } };
  }
  if (!(ALIGNMENT_SETTINGS as readonly string[]).includes(alignmentSetting)) {
    return { ok: false, problem: { field: "setting", reason: "choice" } };
  }

  return {
    ok: true,
    draft: {
      ...previous,
      mode,
      alignmentSetting,
    },
  };
}
