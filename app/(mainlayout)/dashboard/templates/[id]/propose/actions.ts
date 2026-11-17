"use server";

/**
 * Submit for Review (#1130) — the one write the proposal form has, and it writes to nothing durable yet.
 *
 * **It must not publish, and it does not.** The Library is admin-curated (#533): there is no code path
 * from this action into a `record` or a `template_version`, and the review queue behind a proposal is
 * undecided (crud-matrix "Conflicts: Propose to Library"). So the action validates the form, confirms
 * the template is the caller's own, and answers `sent` — the sent panel says in words that nothing has
 * been reviewed yet, so the surface does not promise a reviewer who does not exist.
 *
 * When the ruling lands, this is where one insert goes. `validateProposal()` (`lib/member/proposal.ts`)
 * stays as it is, because it is about the form and not about the store — that split is why the six
 * refusal codes can be asserted without a database.
 *
 * **The actor is the session's**, read server-side, and the ownership check is `readMyTemplate()`: an id
 * that names another account's template answers `no-such-template`, the same indistinct answer the page
 * gives a stranger's id, because "not yours" would tell a prober which ids are real.
 */
import { currentUser } from "@/lib/auth/session";
import { DatabaseUnavailableError } from "@/lib/db/client";
import {
  validateProposal,
  type ProposalSubmission,
  type TemplateProposalPayload,
} from "@/lib/member/proposal";
import { readMyTemplate } from "@/lib/member/templates";

export async function proposeToLibrary(
  payload: TemplateProposalPayload,
): Promise<ProposalSubmission> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };

  const parsed = validateProposal(payload);
  if (!parsed.ok) return { ok: false, code: parsed.code };

  try {
    const view = await readMyTemplate(user.userId, parsed.proposal.templateId);
    if (view === undefined) return { ok: false, code: "no-such-template" };
  } catch (error) {
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    return { ok: false, code: "failed" };
  }

  /**
   * Accepted, and deliberately not stored: the queue is the missing half and it is the owner's decision,
   * not this card's. `status: "sent"` is what the panel's `sent` band draws.
   */
  return { ok: true, status: "sent" };
}
