/**
 * The one call a sender makes instead of `renderTemplate()` — the published override, when there
 * is one (#1138 requirement 9).
 *
 * **Why this is a module and not four lines inside `renderTemplate()`.** `renderTemplate()` is
 * pure and is imported by a client component (the admin editor's live preview). Reading Postgres
 * from it would put `pg` in the browser graph — the E34 crossing this repo has already paid for
 * once (#228) — and would make a mail render depend on a connection that a preview does not have.
 * So the read lives here, on the server, and the pure function takes the result as an argument.
 *
 * **A sender that forgets this still sends the default.** That is the whole risk posture: the
 * override is an enrichment, never a requirement. `readPublishedOverride()` answers `undefined`
 * for "no row", "no table" and "no connection" alike, so a deployment that has not migrated
 * behaves exactly as it did before this card — which is what makes shipping the page and the
 * migration separately safe.
 *
 * **The option surface is the caller's, unchanged.** `origin`, `mode` and `unsubscribeUrl` pass
 * through untouched, so a marketing template still requires its token (the band throws) and a
 * captured/test key still stamps the footer. Only `override` is added, and only here.
 */
import { readPublishedOverride, type EmailTemplateSql } from "@/lib/db/email-templates";
import type { MailKeyMode } from "@/lib/email/key-mode";
import type { EmailOverride } from "@/lib/email/override";
import type { EmailTemplate, RenderedTemplate } from "@/lib/email/templates/index";
import { renderTemplate } from "@/lib/email/templates/index";

/** What a send caller may pass: `renderTemplate()`'s options, plus the statement surface a test fakes. */
export interface SendRenderOptions {
  readonly origin?: string;
  readonly mode?: MailKeyMode;
  /** Required for a `marketing` template (the band throws without it), refused for the rest. */
  readonly unsubscribeUrl?: string;
  /** A fake or a caller's own connection; the pool when omitted. */
  readonly sql?: EmailTemplateSql;
  /**
   * A caller that already holds the override — **the test send** (`/admin/email-templates`'s
   * "Send Test"), which sends the admin's *draft* rather than the published words so they can read
   * it in their own mailbox before publishing. A real send never passes this.
   */
  readonly override?: EmailOverride;
}

/**
 * Render one template with its published override, or its code default.
 *
 * The override is read **per send**, never cached: an admin's publish has to take effect on the
 * next mail, and a cache would be the one piece of state that makes "publish changes only
 * subsequent real sends" untrue in a way nobody could see.
 */
export async function renderTemplateForSend<Facts>(
  template: EmailTemplate<Facts>,
  facts: Facts,
  options: SendRenderOptions = {},
): Promise<RenderedTemplate> {
  const override = options.override ?? (await readPublishedOverride(template.id, options.sql));
  const base = {
    ...(options.origin === undefined ? {} : { origin: options.origin }),
    ...(options.mode === undefined ? {} : { mode: options.mode }),
    ...(options.unsubscribeUrl === undefined ? {} : { unsubscribeUrl: options.unsubscribeUrl }),
  };
  return renderTemplate(template, facts, override === undefined ? base : { ...base, override });
}
