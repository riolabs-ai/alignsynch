/**
 * template-ancestor: components/quiz/quiz-results.tsx   (variation: the report a party reads, in the console's frame — the same verdict, per-Aspect numbers and button footer, with an audited reissue, a PII-gated submission read and two export links in place of the quiz's replay/share actions)
 *
 * `/admin/instances/[id]/report` — one relationship's Gap report, and its operations (#504).
 *
 * **The gate is `support`, and the operations are not.** The epic's second invariant is "no PII
 * without the gate": reading a party's submission needs `support` or above, so this screen opens
 * for `support` — otherwise the one seat the gate exists for could never reach it. The *writes*
 * keep their own floors inside `act()` (`lib/admin/roles.ts`): a reissue is `admin`'s, a
 * submission read is `support`'s. The band that a rung cannot use is disabled with a sentence, and
 * the store refuses it anyway — the screen's own check is courtesy twice over.
 *
 * `requireAdminProduct()` runs first (#509), exactly as the repair screen below it does: a
 * template that does not claim `product.admin` answers the 404 an unknown URL gets, with no
 * session read. Then `requireRole("support")`, which sends a signed-out visitor to `/login` with
 * this path as `next` and answers a `member` with the same 404 — the policy is
 * `lib/auth/require-role.ts`, not a check here.
 *
 * **`params` is a Promise in Next 16** and is unwrapped. An id that names no session answers
 * `notFound()` — the same 404 a member gets.
 *
 * **`force-dynamic`**, for the registry's reason: the guard reads a session and a profile row, the
 * report is a database read on every visit, and `pnpm build` must keep passing with no
 * `DATABASE_URL` and no `NEON_AUTH_*`.
 *
 * **No clock in a render path.** The report's instant is the fixture clock
 * (`content/core.ts::DEMO_NOW_ISO`), used by the document the export writes — this page renders no
 * "now" at all.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ReportOperations } from "@/components/admin/report-operations";
import { adminReportPageCopy } from "@/data/pages/admin-report";
import { REASON_MIN_LENGTH } from "@/lib/admin/act";
import { adminReportExportPath, adminRelationshipPath } from "@/lib/admin/paths";
import { atLeast } from "@/lib/admin/roles";
import { requireRole } from "@/lib/auth/require-role";
import { requireAdminProduct } from "@/lib/brand-boundary";
import { DatabaseUnavailableError } from "@/lib/db/client";
import { reportDocument } from "@/lib/report/document";
import { readReportSource } from "@/lib/db/admin-report";

import { performReportOperation } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Report operations",
  robots: { index: false, follow: false },
};

export default async function AdminReportPage({ params }: { params: Promise<{ id: string }> }) {
  requireAdminProduct();
  const { id } = await params;
  const grant = await requireRole("support", { next: `/admin/instances/${id}/report` });

  let source: Awaited<ReturnType<typeof readReportSource>>;
  try {
    source = await readReportSource(id);
  } catch (error) {
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    console.error("admin-report: the report could not be read", error);
    return (
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          {adminReportPageCopy.sections?.find((section) => section.id === "unreadable")?.heading ??
            adminReportPageCopy.heading}
        </h1>
        <p className="max-w-3xl text-muted-foreground">{error.reason}</p>
      </div>
    );
  }

  if (source === undefined) notFound();

  // The document the export writes is built here, once, and handed to the screen — so the numbers
  // an operator reads and the bytes they download are one value rendered two ways.
  const document =
    source.document === null
      ? null
      : reportDocument(
          source.document.instance,
          source.document.report,
          process.env.APP_VERSION ?? "unknown",
        );

  return (
    <ReportOperations
      copy={adminReportPageCopy}
      source={source}
      action={performReportOperation}
      reasonMin={REASON_MIN_LENGTH}
      canRegenerate={atLeast(grant.role, "admin")}
      exportPaths={{
        json: adminReportExportPath(id, "json"),
        pdf: adminReportExportPath(id, "pdf"),
      }}
      relationshipPath={adminRelationshipPath(id)}
      document={document}
    />
  );
}
