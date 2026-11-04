/**
 * `/dashboard/templates` — a member's own templates (#533 phase 2).
 *
 * **The gate is the ordinary member gate, and the read is keyed on the session.** `requireRole`
 * with `member` is signed-out → `/login?next=…` and everyone else → through; `listMyTemplates`
 * filters `record.owner_user_id = $1`, so the page has no way to list somebody else's rows even if
 * an id were posted to it. There is no `requireAlignmentProduct()` here for the reason
 * `/dashboard` carries none: this is a signed-in person's own workspace in both builds, and gating
 * it off in a quiz build would be a second brand decision where the tree already has one.
 *
 * **A read that cannot answer is a panel, not a 500.** `DatabaseUnavailableError` is caught and its
 * sentence handed to the gallery; every other failure keeps throwing, because a row that does not
 * satisfy `zAssessment` is drift the gate exists to catch.
 *
 * **The clone picker is keyed on the viewer too.** `listClonableTemplates(userId)` returns the
 * public catalogue minus this member's own rows, so the list cannot offer a clone of the thing they
 * are looking at — the copy in the fixture says why, and the read is what makes it true.
 *
 * `force-dynamic` for the reasons every gated console route carries it: per-request session,
 * database reads, and a `pnpm build` that must pass with no `DATABASE_URL`.
 */
import type { Metadata } from "next";

import { TemplateGallery } from "@/components/dashboard/template-gallery";
import { dashboardTemplatesPageCopy } from "@/data/pages/dashboard-templates";
import { requireRole } from "@/lib/auth/require-role";
import { DatabaseUnavailableError } from "@/lib/db/client";
import {
  listClonableTemplates,
  listMyTemplates,
  MEMBER_TEMPLATES_PATH,
  type ClonableTemplate,
  type MemberTemplateRow,
} from "@/lib/member/templates";
import { clonePublic, createPrivate } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My templates",
  robots: { index: false, follow: false },
};

export default async function MemberTemplatesPage() {
  const { user } = await requireRole("member", { next: MEMBER_TEMPLATES_PATH });

  let rows: readonly MemberTemplateRow[] = [];
  let clonable: readonly ClonableTemplate[] = [];
  let unreadable: string | null = null;
  try {
    rows = await listMyTemplates(user.userId);
    clonable = await listClonableTemplates(user.userId);
  } catch (error) {
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    console.error("member-templates: the list could not be read", error);
    unreadable = error.reason;
  }
  // No second check after the read: `requireRole` already answered a signed-out request with the
  // login redirect, and re-deciding it here would only be able to disagree with the gate.

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{dashboardTemplatesPageCopy.heading}</h1>
        {dashboardTemplatesPageCopy.subtitle === undefined ? null : (
          <p className="max-w-3xl text-sm text-muted-foreground">
            {dashboardTemplatesPageCopy.subtitle}
          </p>
        )}
      </header>
      <TemplateGallery
        copy={dashboardTemplatesPageCopy}
        rows={rows}
        clonable={clonable}
        unreadable={unreadable}
        onCreate={createPrivate}
        onClone={clonePublic}
      />
    </div>
  );
}
