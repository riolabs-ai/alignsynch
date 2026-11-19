/**
 * Proposing a template to the Library — the form's rules, and the boundary it must not cross (#1130).
 *
 * **A proposal is not a publish, and this module is where that is a fact rather than a comment.** The
 * Library is admin-curated (#533): a member has no write that changes what the catalogue offers. The
 * review queue behind a proposal is **undecided** (crud-matrix "Conflicts: Propose to Library"), so v1
 * validates the form and answers `sent` — it writes no `record`, no `template_version`, and nothing a
 * reader of the public catalogue could find. When the ruling lands, the queue is a table plus one write
 * in `proposeToLibrary()` (`app/(mainlayout)/dashboard/templates/[id]/propose/actions.ts`), and this
 * validator stays the same because it is about the form, not the store.
 *
 * **Pure on purpose.** No React, no `lib/db`, no clock: the four refusals are the issues' acceptance
 * criteria ("the consent box is required"), so they are asserted directly in
 * `tests/template-proposal.test.ts` instead of through a rendered page.
 *
 * `name` and `who` are free text with a floor of one non-space character. There is no maximum beyond the
 * column widths this never reaches: a proposal is prose a reviewer reads, and truncating it here would
 * be the surface losing the sentence that made the proposal worth reviewing.
 */
import { TEMPLATE_CATEGORIES, type TemplateCategory } from "@/data/template-categories";

/** What the form posts, field by field, exactly as it was typed. */
export interface TemplateProposalPayload {
  readonly templateId?: unknown;
  readonly name?: unknown;
  readonly category?: unknown;
  readonly who?: unknown;
  readonly note?: unknown;
  readonly consent?: unknown;
}

/** One field's answer, after trimming, so a whitespace-only input is empty rather than truthy. */
function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** The four codes the form can refuse on, plus the two the store can answer. */
export type TemplateProposalRefusal =
  | "name-required"
  | "category-required"
  | "who-required"
  | "consent-required"
  | "no-such-template";

/** A validated proposal — the fields, normalised, and nothing else. */
export interface TemplateProposal {
  readonly templateId: string;
  readonly name: string;
  readonly category: TemplateCategory;
  readonly who: string;
  readonly note: string | null;
}

/**
 * What the form is told: it was accepted, or the one code to draw a sentence for.
 *
 * It lives here rather than beside the server action because the **client** component needs it, and a
 * module marked `"use server"` may export only async functions — a type import from it would be erased,
 * but importing one that is not is the mistake this split removes.
 */
export type ProposalSubmission =
  | { readonly ok: true; readonly status: "sent" }
  | { readonly ok: false; readonly code: string };

/**
 * The form's rules, checked once for both callers.
 *
 * **Consent is a rule, not a checkbox's paint.** `consent` must be the boolean `true` (or the string
 * `"true"` a plain form posts) — anything else, including the string `"on"` from a hand-crafted body,
 * is `consent-required`. The box exists because a template is meant to carry no personal detail, and a
 * rule that accepted "the field was present" would agree to nothing.
 */
export function validateProposal(
  payload: TemplateProposalPayload,
):
  | { readonly ok: true; readonly proposal: TemplateProposal }
  | { readonly ok: false; readonly code: TemplateProposalRefusal } {
  const templateId = text(payload.templateId);
  if (templateId === "") return { ok: false, code: "no-such-template" };

  const name = text(payload.name);
  if (name === "") return { ok: false, code: "name-required" };

  const category = text(payload.category);
  const known = TEMPLATE_CATEGORIES.find((candidate) => candidate === category);
  if (known === undefined) return { ok: false, code: "category-required" };

  const who = text(payload.who);
  if (who === "") return { ok: false, code: "who-required" };

  const consent = payload.consent === true || payload.consent === "true";
  if (!consent) return { ok: false, code: "consent-required" };

  const note = text(payload.note);
  return {
    ok: true,
    proposal: { templateId, name, category: known, who, note: note === "" ? null : note },
  };
}
