/**
 * `/admin/health` — the platform-health screen, for an operator (#508).
 *
 * **Why it exists.** The last two incidents were diagnosed by hand: `db:verify` drift, a tag that
 * was ahead of `package.json`, a gate that cost 176 s, and a deploy that did not happen. Each of
 * those is a measurement somebody had to go and take. This page takes them once, records them, and
 * shows them together.
 *
 * **Three gates, in this order.** `requireAdminProduct()` first (#509): the console is a template
 * capability, so a template that does not claim `product.admin` answers the 404 an unknown URL gets
 * before a session is read. Then `requireAdmin()` — a signed-out visitor is sent to
 * `/login?next=/admin/health`, a **`support`** session gets `notFound()` (the same 404 an unknown
 * URL returns, never a 403 that confirms the page exists), and an `admin` or `owner` session reaches
 * the read. Then the read, then the render. `/admin/audit` and `/admin/instances` document the same
 * order; `tests/platform-health.test.ts` drives a `support` answer through the real policy and
 * asserts the record is never read.
 *
 * **Read-only, structurally.** The page imports no write path — `lib/admin/act.ts` is the console's
 * only mutation entry point and it is not in this import graph — and the only two things it does
 * are read a file and run two `git` queries whose answers it prints. There is no form, no server
 * action and no link that changes state.
 *
 * **Request-time, and no clock.** `force-dynamic` because `package.json`, the nearest tag and
 * `origin/main` are read per request: that is what makes the mismatch alarm fire the moment
 * somebody checks out a tag ahead of the file, with no rebuild. Nothing here calls `new Date()` or
 * `Date.now()` — every date on the page is either the record's own `measuredAt` or an ISO instant
 * out of `git`, formatted by `content/core.ts`. A wall-clock label would render once on the server
 * and again at hydration and disagree (`#418`, `AGENTS.md`), which on a health screen would be a
 * bug that looks like drift.
 *
 * **Two honest failures.** A tree with no record — a fresh clone, a deployment that did not ship
 * the artifact, a hand-edit that broke the JSON — is `HealthRecordUnreadable`, drawn as a panel
 * with the reason. It is never drawn as zeroes: "no violations" because nobody could read the
 * report is the one lie this screen must not tell. A *value* that does not parse still throws,
 * because that is a defect the gate exists to catch.
 *
 * `robots` matters even behind the gate: a crawler that somehow held an admin's session must not
 * publish the build's commit and the state of production.
 */
import type { Metadata } from "next";

import { PlatformHealth } from "@/components/admin/platform-health";
import { adminHealthPageCopy } from "@/data/pages/admin-health";
import { requireAdmin } from "@/lib/auth/require-role";
import { requireAdminProduct } from "@/lib/brand-boundary";
import {
  ADMIN_HEALTH_PATH,
  type HealthFacts,
  HealthRecordUnreadable,
  healthFactsOf,
  readPlatformHealthRecord,
} from "@/lib/admin/platform-health";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: adminHealthPageCopy.heading,
  robots: { index: false, follow: false },
};

export default async function AdminHealthPage() {
  // The capability before the role (#509): a template that does not claim the console answers the
  // 404 an unknown URL gets, with no session read and no file read behind it.
  requireAdminProduct();
  await requireAdmin({ next: ADMIN_HEALTH_PATH });

  let facts: HealthFacts | null = null;
  let unreadable: string | null = null;
  try {
    facts = healthFactsOf(readPlatformHealthRecord());
  } catch (error) {
    if (!(error instanceof HealthRecordUnreadable)) throw error;
    console.error("admin-health: the health record could not be read", error);
    unreadable = error.reason;
  }

  return <PlatformHealth copy={adminHealthPageCopy} facts={facts} unreadable={unreadable} />;
}
