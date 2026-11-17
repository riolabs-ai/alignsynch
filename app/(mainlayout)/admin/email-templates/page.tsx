/**
 * `/admin/email-templates` — the register of transactional mail, and what production sends (#1138).
 *
 * **Two gates, in this order, the same as `/admin/docs`.** `requireAdminProduct()` first (#509): a
 * template that does not claim `product.admin` answers the 404 an unknown URL gets, before a session
 * is read. Then `requireAdmin({ next })`, which sends a signed-out visitor to
 * `/login?next=%2Fadmin%2Femail-templates` and answers a member — a `support` seat included — with
 * the same 404, never a 403 that would confirm the page exists. That is the issue's "Must not 403 a
 * member who hits `/admin/email-templates`; same 404 / login behaviour as Docs".
 *
 * **The template is `/admin/templates`.** A `StageColumn`, a heading, and one client component whose
 * every string comes from `data/pages/admin-email-templates.ts`; the axis of variation is the data
 * source (the code register plus a version table, instead of `record` rows) and the missing create
 * band (a mail template is code — this screen overrides one, it does not author a new row). Nothing
 * new is invented, and the template doctrine's question 1 is answered by that file.
 *
 * **What the code does not say, the screen does not claim.** `listEmailTemplates()` reads the live
 * rows for every registered template in one statement; a `DatabaseUnavailableError` is drawn as the
 * panel naming the reason, never as a list of `default` badges, because "nothing is overridden" and
 * "the overrides could not be read" are different statements and only one of them is true.
 *
 * `force-dynamic`: the session is per-request, the list is a database read, and `pnpm build` must
 * pass with no `DATABASE_URL` and no `NEON_AUTH_*` (a *request* on a tree with no auth env answers
 * 500 `NEON_AUTH_BASE_URL is not set`, which is the documented answer for a gated console route).
 */
import { StageColumn } from "@/components/assessment-flow/stage-column";
import type { Metadata } from "next";

import { EmailTemplateRegistry } from "@/components/admin/email-templates/email-template-registry";
import { adminEmailTemplatesPageCopy } from "@/data/pages/admin-email-templates";
import { listEmailTemplates, type EmailTemplateListRow } from "@/lib/admin/email-templates";
import { ADMIN_EMAIL_TEMPLATES_PATH } from "@/lib/admin/paths";
import { requireAdmin } from "@/lib/auth/require-role";
import { requireAdminProduct } from "@/lib/brand-boundary";
import { DatabaseUnavailableError } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: adminEmailTemplatesPageCopy.heading,
  robots: { index: false, follow: false },
};

export default async function AdminEmailTemplatesPage() {
  // The capability before the role (#509): a template that does not claim the console answers the
  // 404 an unknown URL gets, with no session read and no database read behind it.
  requireAdminProduct();
  await requireAdmin({ next: ADMIN_EMAIL_TEMPLATES_PATH });

  let rows: readonly EmailTemplateListRow[] = [];
  let unreadable: string | null = null;
  try {
    rows = await listEmailTemplates();
  } catch (error) {
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    console.error("admin-email-templates: the overrides could not be read", error);
    unreadable = error.reason;
  }

  return (
    <StageColumn>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">{adminEmailTemplatesPageCopy.heading}</h1>
          {adminEmailTemplatesPageCopy.subtitle === undefined ? null : (
            <p className="max-w-3xl text-sm text-muted-foreground">
              {adminEmailTemplatesPageCopy.subtitle}
            </p>
          )}
        </header>
        <EmailTemplateRegistry
          copy={adminEmailTemplatesPageCopy}
          rows={rows}
          unreadable={unreadable}
        />
      </div>
    </StageColumn>
  );
}
