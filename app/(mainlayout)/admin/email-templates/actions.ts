"use server";

/**
 * `/admin/email-templates` — the five server actions the screens post to (#1138).
 *
 * **The gate runs again on every action.** `requireAdmin({ next })` already guards both pages, but a
 * hidden button is not enforcement: an action is a public POST endpoint, so it re-asks the same
 * question, and `act()` inside `lib/admin/email-templates.ts` reads the actor's rung a third time in
 * the transaction that writes. Three reads of one fact is the house pattern (`actions.ts` beside
 * `/admin/templates` does the same) and it is the only arrangement where "support may not edit a
 * mail" is true rather than drawn.
 *
 * **The actor never travels in the payload.** `currentUser()` reads the session server-side, so a
 * crafted body cannot name whose audit row it gets, and cannot post a test send to somebody else's
 * address: the recipient is the session's own email, resolved here.
 *
 * **The preview is an action too**, and that is deliberate rather than convenient: the register is
 * TypeScript functions, so the only place a mail can be rendered is the server — and rendering it
 * through a real server action means the preview is *the same function* the send path uses, not a
 * lookalike drawn in the browser. It writes nothing and sends nothing.
 */
import { requireAdmin } from "@/lib/auth/require-role";
import { currentUser } from "@/lib/auth/session";
import {
  publishEmailTemplate,
  previewEmailTemplate,
  resetEmailTemplate,
  saveEmailTemplate,
  sendEmailTemplateTest,
  type EmailTemplateOutcome,
  type EmailTemplatePreview,
} from "@/lib/admin/email-templates";
import { ADMIN_EMAIL_TEMPLATES_PATH, adminEmailTemplatePath } from "@/lib/admin/paths";
import type { EmailTemplatePost } from "@/lib/admin/email-templates";
import type { EmailTemplateTestOutcome } from "@/components/admin/email-templates/email-template-editor";

/** The posted fields, trimmed — the three the editor sends, and nothing else. */
function fieldsOf(post: EmailTemplatePost): {
  readonly subject: string;
  readonly preheader: string;
  readonly body: string;
} {
  return {
    subject: post.subject.trim(),
    preheader: post.preheader.trim(),
    body: post.body.trim(),
  };
}

/**
 * Save a draft. Production mail is untouched until Publish — that is the write's property
 * (`lib/admin/email-templates.ts`), not this action's restraint.
 */
export async function saveEmailTemplateAction(
  post: EmailTemplatePost,
): Promise<EmailTemplateOutcome> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };
  await requireAdmin({ next: adminEmailTemplatePath(post.templateId) });

  return saveEmailTemplate({
    actorUserId: user.userId,
    templateId: post.templateId,
    ...fieldsOf(post),
  });
}

/** Publish the stored draft — never the form's fields, so an unsaved edit cannot go live. */
export async function publishEmailTemplateAction(post: {
  readonly templateId: string;
}): Promise<EmailTemplateOutcome> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };
  await requireAdmin({ next: adminEmailTemplatePath(post.templateId) });

  return publishEmailTemplate({ actorUserId: user.userId, templateId: post.templateId });
}

/** Drop the override. The next send uses the code default, and the retired rows keep the words. */
export async function resetEmailTemplateAction(post: {
  readonly templateId: string;
}): Promise<EmailTemplateOutcome> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };
  await requireAdmin({ next: adminEmailTemplatePath(post.templateId) });

  return resetEmailTemplate({ actorUserId: user.userId, templateId: post.templateId });
}

/**
 * Send the sample to **the signed-in admin's own address** (#1138 requirement 4).
 *
 * The address comes from the session here and from nowhere else: there is no field for one, so a
 * crafted POST cannot turn this page into a mail relay. The draft on screen is what is sent, not the
 * published words, because the point of the button is to read an edit before publishing it.
 */
export async function sendEmailTemplateTestAction(
  post: EmailTemplatePost,
): Promise<EmailTemplateTestOutcome> {
  const user = await currentUser();
  if (user === null) return { ok: false, code: "signed-out" };
  await requireAdmin({ next: adminEmailTemplatePath(post.templateId) });

  return sendEmailTemplateTest({
    templateId: post.templateId,
    to: user.email,
    override: fieldsOf(post),
  });
}

/** The live preview: the same render the send path makes, with no write and no transport. */
export async function previewEmailTemplateAction(
  post: EmailTemplatePost,
): Promise<EmailTemplatePreview> {
  await requireAdmin({ next: ADMIN_EMAIL_TEMPLATES_PATH });
  return previewEmailTemplate({ templateId: post.templateId, override: fieldsOf(post) });
}
