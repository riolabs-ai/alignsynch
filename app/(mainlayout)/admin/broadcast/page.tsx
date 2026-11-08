/**
 * template-ancestor: components/create/quiz-editor.tsx   (variation: the editor's compose-and-preview step becomes a one-off notice to the news list — same two panes, its save bar replaced by a dry-run/send bar, its counters replaced by the audience counts, and its publication badge replaced by the mail-key mode banner)
 *
 * `/admin/broadcast` — a one-off notice to the news list (#507, epic #500, the epic's last child).
 *
 * **Why it exists.** `news_signup` has collected addresses since #446 and there was no way to use
 * them. `email_event` (0027) now records what the provider said happened to a delivery, and the two
 * marks it writes are what a send has to read first. This screen is the only writer.
 *
 * **Three gates, in the console's order.** `requireAdminProduct()` first (#509): a template that does
 * not claim `product.admin` answers the 404 an unknown URL gets, before a session is read. Then
 * `requireAdmin()` — a signed-out visitor goes to `/login?next=/admin/broadcast`, a **`support`**
 * session gets `notFound()` (the same 404 an unknown URL returns, never a 403 that confirms the page
 * exists), and an `admin` or `owner` session reaches the read. Then the read, then the render.
 *
 * The role the gate *used* is passed down so the compose band can print the rung beside the floor —
 * it is never the enforcement. `act()` re-reads the actor's rung inside the transaction, which is why
 * `sendBroadcastAction` does not check the role itself: a `support` session that posts the form
 * directly gets `ActRefused("role-too-low")` and no row.
 *
 * **Two reads, and neither returns an address.** `readBroadcastConsole()` is six counts over
 * `news_signup` and the newest twenty sends (subject, segment, count, body hash — never a body and
 * never a recipient). The dry run is a server action the screen calls when the operator asks, and it
 * answers a count. Nothing here hands a recipient list to a client component.
 *
 * **No clock in the render path.** The cooldown window is measured from one instant the page reads
 * once (`now`) and passes to both the list read and the composer; every date drawn is a row's own
 * instant, formatted by `content/core.ts`. A wall-clock label would render once on the server and
 * again at hydration and disagree (`#418`, `AGENTS.md`).
 *
 * **`force-dynamic`**, for the registry's reason: the guard reads a session and a profile row, the
 * lists are database reads on every visit, and `pnpm build` must keep passing with no `DATABASE_URL`
 * and no `NEON_AUTH_*`.
 */
import type { Metadata } from "next";

import { BroadcastComposer } from "@/components/admin/broadcast-composer";
import { PageHeader } from "@/components/ui/page-header";
import { adminBroadcastPageCopy } from "@/data/pages/admin-broadcast";
import { ADMIN_AUDIT_PATH, ADMIN_BROADCAST_PATH } from "@/lib/admin/paths";
import { requirementFor } from "@/lib/admin/roles";
import { requireAdmin } from "@/lib/auth/require-role";
import { requireAdminProduct } from "@/lib/brand-boundary";
import { DatabaseUnavailableError } from "@/lib/db/client";
import { readBroadcastConsole, type BroadcastConsoleRead } from "@/lib/db/news-signups";
import { mailKeyMode } from "@/lib/email/key-mode";
import { DEFAULT_FROM, mailEndpoint } from "@/lib/flow/email";
import { BROADCAST_COOLDOWN_HOURS } from "@/lib/admin/broadcast-rules";

import { previewBroadcastAction, sendBroadcastAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: adminBroadcastPageCopy.heading,
  robots: { index: false, follow: false },
};

/** An empty console: the shape the screen renders when the database did not answer. */
const EMPTY: BroadcastConsoleRead = {
  counts: {
    total: 0,
    consented: 0,
    unsubscribed: 0,
    bounced: 0,
    complained: 0,
    cooling: 0,
  },
  sends: [],
};

export default async function AdminBroadcastPage() {
  // The capability before the role (#509), then the rung. A `support` session never reaches the
  // read below — `notFound()` is thrown, not returned.
  requireAdminProduct();
  const { role } = await requireAdmin({ next: ADMIN_BROADCAST_PATH });

  // One instant for this render: the list's cooldown count and the composer's window are the same
  // measurement, so the stat and a refusal cannot disagree about "lately".
  const now = new Date();
  const keyMode = mailKeyMode(process.env);
  const endpoint = mailEndpoint(process.env);
  const sender = process.env.RESEND_FROM?.trim() || DEFAULT_FROM;

  let read: BroadcastConsoleRead | null = null;
  let unreadable: string | null = null;
  try {
    read = await readBroadcastConsole({ now, cooldownHours: BROADCAST_COOLDOWN_HOURS });
  } catch (error) {
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    console.error("admin-broadcast: the news list could not be read", error);
    unreadable = error.reason;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={adminBroadcastPageCopy.heading}
        description={adminBroadcastPageCopy.subtitle}
      />
      <BroadcastComposer
        copy={adminBroadcastPageCopy}
        counts={(read ?? EMPTY).counts}
        sends={(read ?? EMPTY).sends}
        keyMode={keyMode}
        endpoint={endpoint}
        sender={sender}
        role={role}
        floor={requirementFor("broadcast.send")}
        unreadable={unreadable}
        auditPath={ADMIN_AUDIT_PATH}
        preview={previewBroadcastAction}
        send={sendBroadcastAction}
      />
    </div>
  );
}
