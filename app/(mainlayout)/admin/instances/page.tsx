/**
 * `/admin/instances` — every relationship in the system, for an operator (console-ia §3.5,
 * card 3/5). The first console surface, and the first admin route outside `/demo/admin`.
 *
 * **The gate comes first, before anything is read.** `requireAdmin()` answers one of three ways
 * and never returns for a refusal: a member gets `notFound()` — the same 404 a URL that never
 * existed returns, not a 403 and not a redirect — a signed-out visitor is sent to `/login` with
 * this path as `next`, and only an `admin` session reaches the read below. The order matters:
 * calling it after the read would mean the database work (and any timing difference between
 * "rows exist" and "rows do not") happens for somebody who may not see the result.
 *
 * `next` is passed explicitly so the sign-in round trip returns an admin who followed a
 * bookmark to this page. That is not a leak: `/login` is public, and the value is a path this
 * site owns (`loginPathFor` refuses anything absolute).
 *
 * **Nothing here decides who may see what beyond that gate.** The read (`listAdminInstances`)
 * is cross-account by design — that is what an operator's registry is — and the card's blind
 * rule is enforced by what the read *selects*: seats, mode, Setting, derived stage. There is no
 * `relation` parameter, no `?userId=` and no second mode of this page.
 *
 * `force-dynamic` for the reason `/assessment/instances` carries it: the session is per-request,
 * the list is a database read, and `pnpm build` must never try to prerender either (`requireAdmin`
 * throws in a build with no request).
 *
 * A read that does not answer is a panel, not a digest: `DatabaseUnavailableError` is caught and
 * its sentence handed to the view, and any other failure keeps throwing, because a row that fails
 * the model is a defect the gate exists to catch.
 */
import type { Metadata } from "next";

import { InstanceRegistry } from "@/components/admin/instance-registry";
import { adminInstancesPageCopy } from "@/data/pages/admin-instances";
import { ADMIN_INSTANCES_PATH, type AdminInstanceRow } from "@/lib/admin/instance-registry";
import { requireAdmin } from "@/lib/auth/require-role";
import { listAdminInstances } from "@/lib/db/admin-instances";
import { DatabaseUnavailableError } from "@/lib/db/client";

export const dynamic = "force-dynamic";

/**
 * The tab title. Declared here and not composed from anything: `app/layout.tsx` supplies the
 * brand half (`"%s · AlignSynch"`), and a title that carried the brand again would print it twice.
 *
 * **Measured, and this card does not change it:** a member's refusal renders the 404 (status 404,
 * `h1` "404", the not-found body) but the streamed payload still carries this title, so a browser
 * tab reads "Relationships" over a 404 body. It is the same behaviour `/leaderboard` has under its
 * flag (`document.title` "Leaderboard · AlignSynch", `h1` "404", status 404 — measured on the same
 * server), because Next resolves a page's metadata alongside the render that calls `notFound()`.
 * Making the refusal tell one story everywhere is a change to that resolution for **every** gated
 * route, which is not this card's surface; it is recorded in the PR as the known residual rather
 * than fixed here in a way that would only cover `/admin/instances`.
 *
 * `robots` still matters: a crawler that somehow held an admin's session must not publish an
 * operator's cross-account table.
 */
export const metadata: Metadata = {
  title: "Relationships",
  robots: { index: false, follow: false },
};

export default async function AdminInstancesPage() {
  await requireAdmin({ next: ADMIN_INSTANCES_PATH });

  let rows: readonly AdminInstanceRow[] = [];
  let unreadable: string | null = null;
  try {
    // One clock for the whole request: the invite states on one screen are decided against the
    // same instant, so two rows cannot disagree about "expired" by a millisecond.
    rows = await listAdminInstances(new Date());
  } catch (error) {
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    console.error("admin-instances: the registry could not be read", error);
    unreadable = error.reason;
  }

  return <InstanceRegistry copy={adminInstancesPageCopy} rows={rows} unreadable={unreadable} />;
}
