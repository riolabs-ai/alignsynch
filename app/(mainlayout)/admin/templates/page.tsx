// template-ancestor: components/my-quizzes/my-quizzes.tsx   (variation: the record list as a table — components/ui/table.tsx inside a Card, a status column instead of tabs, and the create band above it a five-field form that writes)
/**
 * `/admin/templates` — the authored templates, for an operator (#502a).
 *
 * **The gate comes first, before anything is read**, and it is three checks in a fixed order:
 *
 *   1. `requireAdminProduct()` — a template that does not claim `product.admin` has no console at
 *      all, so it answers the 404 an unknown URL gets before a session is consulted (#509).
 *   2. `requireAlignmentProduct()` — this surface writes *assessment* templates, the product
 *      AlignSynch sells and a quiz-only build does not. `product.admin` is on for both templates,
 *      so without this second read of the same product flag an assessment authoring screen would
 *      appear inside a quiz build, which is the failure `product.quiz-surfaces` exists to stop.
 *   3. `requireAdmin()` — the role gate's three answers: signed out is a redirect to `/login` with
 *      this path as `next`, a member (a `support` session included) gets `notFound()` — the 404 a
 *      URL that never existed returns, never a 403 — and only `admin` reaches the read below.
 *
 * **The read is one statement.** `listAdminTemplates` counts Aspects and relationships in the
 * same round trip; the screen filters nothing, because a template catalogue is small and a second
 * filter would be a second answer to "which rows".
 *
 * `force-dynamic`, and for the reasons every gated route in this tree carries it: the session is
 * per-request, the list is a database read, and `pnpm build` must pass with no `DATABASE_URL` and
 * no `NEON_AUTH_*`. A *request* on a tree with no auth env answers 500 `NEON_AUTH_BASE_URL is not
 * set`, which is the documented answer for a gated console route, not a defect.
 *
 * A read that does not answer is a panel, not a digest: `DatabaseUnavailableError` is caught and
 * its sentence handed to the view, and any other failure keeps throwing, because a row that fails
 * the model is a defect the gate exists to catch.
 */
import type { Metadata } from "next";

import { TemplateRegistry } from "@/components/admin/template-registry";
import { adminTemplatesPageCopy } from "@/data/pages/admin-templates";
import {
  ADMIN_TEMPLATES_PATH,
  listAdminTemplates,
  type AdminTemplateRow,
} from "@/lib/admin/templates";
import { requireAdmin } from "@/lib/auth/require-role";
import { requireAdminProduct, requireAlignmentProduct } from "@/lib/brand-boundary";
import { DatabaseUnavailableError } from "@/lib/db/client";
import { createTemplate } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Templates",
  robots: { index: false, follow: false },
};

export default async function AdminTemplatesPage() {
  requireAdminProduct();
  requireAlignmentProduct();
  await requireAdmin({ next: ADMIN_TEMPLATES_PATH });

  let rows: readonly AdminTemplateRow[] = [];
  let unreadable: string | null = null;
  try {
    rows = await listAdminTemplates();
  } catch (error) {
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    console.error("admin-templates: the catalogue could not be read", error);
    unreadable = error.reason;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{adminTemplatesPageCopy.heading}</h1>
        {adminTemplatesPageCopy.subtitle === undefined ? null : (
          <p className="max-w-3xl text-sm text-muted-foreground">
            {adminTemplatesPageCopy.subtitle}
          </p>
        )}
      </header>
      <TemplateRegistry
        copy={adminTemplatesPageCopy}
        rows={rows}
        unreadable={unreadable}
        onCreate={createTemplate}
      />
    </div>
  );
}
