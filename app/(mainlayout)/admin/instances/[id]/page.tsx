/**
 * template-ancestor: components/my-quizzes/quiz-details.tsx   (variation: a relationship's detail screen — the row's own facts, the two seats with their state, and the operator's five audited repairs in place of the quiz's play/share actions)
 *
 * `/admin/instances/[id]` — one relationship, and the five repairs on it (#503).
 *
 * **The gate is the console's, in the order `/admin/instances` records.** `requireAdminProduct()`
 * first (#509) so a template that does not claim `product.admin` answers the 404 an unknown URL
 * gets with no session read; then `requireAdmin()`, which sends a signed-out visitor to `/login`
 * with this path as `next` and answers a `member` with the same 404. Only an `admin` session
 * reaches the read below.
 *
 * **A support floor is not a support page.** `party.unlock` and `invite.resend` are `support`-floored
 * actions (`lib/admin/roles.ts`), and this screen is `admin`-only, exactly like the registry it is
 * reached from. The floors are still the enforcement — `act()` refuses below the rung inside the
 * transaction — and the surface that gives `support` its own view is the support inbox (#506),
 * which is a different card. Said here because a reader will ask why two of five buttons need less
 * than the page does: the page is where the repairs live today, and the policy lives in one file.
 *
 * **`params` is a Promise in Next 16** and is unwrapped here. An id that names nothing answers
 * `notFound()` — the same 404 a member gets, which is what keeps an operator's surface from
 * confirming which ids exist.
 *
 * **`force-dynamic`**, for the registry's reason: the guard reads a session and a profile row, the
 * row is a database read on every visit, and `pnpm build` must keep passing with no `DATABASE_URL`
 * and no `NEON_AUTH_*`.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RelationshipOperations } from "@/components/admin/relationship-operations";
import { adminRelationshipPageCopy } from "@/data/pages/admin-relationship";
import { ADMIN_INSTANCES_PATH } from "@/lib/admin/instance-registry";
import { REASON_MIN_LENGTH } from "@/lib/admin/act";
import { requireAdmin } from "@/lib/auth/require-role";
import { requireAdminProduct } from "@/lib/brand-boundary";
import { DatabaseUnavailableError } from "@/lib/db/client";
import { readAdminRelationship } from "@/lib/db/admin-relationship";

import { performRepair } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Relationship operations",
  robots: { index: false, follow: false },
};

export default async function AdminRelationshipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  requireAdminProduct();
  await requireAdmin({ next: `${ADMIN_INSTANCES_PATH}/[id]` });

  const { id } = await params;

  let detail;
  try {
    // One clock for the request: the invitation's state is a comparison against an instant, and a
    // screen that read the clock twice could disagree with itself about "expired".
    detail = await readAdminRelationship(id, new Date());
  } catch (error) {
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    console.error("admin-relationship: the row could not be read", error);
    return (
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          {adminRelationshipPageCopy.sections?.find((s) => s.id === "unreadable")?.heading ??
            adminRelationshipPageCopy.heading}
        </h1>
        <p className="max-w-3xl text-muted-foreground">{error.reason}</p>
      </div>
    );
  }

  if (detail === undefined) notFound();

  return (
    <RelationshipOperations
      copy={adminRelationshipPageCopy}
      detail={detail}
      action={performRepair}
      reasonMin={REASON_MIN_LENGTH}
    />
  );
}
