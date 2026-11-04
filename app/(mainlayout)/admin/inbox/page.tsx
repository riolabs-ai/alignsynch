/**
 * template-ancestor: components/chat/chat-conversation.tsx   (variation: the console's support
 * inbox — one request-time read of the contact queue and one thread, with the reply, triage and
 * assignment forms in place of a chat composer)
 *
 * `/admin/inbox` — the support inbox (#506, epic #500).
 *
 * **The gate is `support`, and it answers like every admin surface.** `requireAdminProduct()`
 * runs first (#509): a template that does not claim `product.admin` has no console at all and
 * answers the 404 an unknown URL gets, with no session read. Then `requireRole("support")`, which
 * sends a signed-out visitor to `/login?next=/admin/inbox` and answers a **`member`** with the
 * same 404 a URL that never existed returns — `lib/auth/require-role.ts` owns that policy, and
 * nothing here re-implements it. The inbox holds strangers' names, addresses and words, so it is
 * the clearest case the epic's PII invariant has: an anonymous visitor cannot reach it, and no
 * public page links to it.
 *
 * **One read per visit, and the selected thread comes out of it.** `readInbox()` reads the queue
 * (with the provider's state per address and the form's throttle per address), `readThread()`
 * reads the replies of the message named by `?message=`. A message id that names no row answers
 * `notFound()` — the same 404 a member gets, so probing the parameter tells a refused visitor
 * nothing about which ids exist. With no parameter the newest message opens, which is how a queue
 * is worked.
 *
 * **`force-dynamic`, always.** The guard reads a cookie, a session and a profile row, and the queue
 * is a database read on every visit; a prerendered answer would be one visit's snapshot baked into
 * the build, and `pnpm build` must keep passing with no `DATABASE_URL` and no `NEON_AUTH_*`. A
 * *request* to a tree with no auth env answers 500 `NEON_AUTH_BASE_URL is not set` instead of
 * pretending nobody is signed in, exactly as `/admin/instances` and `/admin/gaps` do.
 *
 * **No clock in a render path.** Every instant on the page comes from a row; the throttle window's
 * edge is evaluated inside the read, and the sentence it produces carries counts and minutes, never
 * a "now" that the browser could disagree with.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SupportInbox } from "@/components/admin/support-inbox";
import { adminInboxPageCopy } from "@/data/pages/admin-inbox";
import { REASON_MIN_LENGTH } from "@/lib/admin/act";
import { ADMIN_INBOX_PATH } from "@/lib/admin/paths";
import { requireRole } from "@/lib/auth/require-role";
import { requireAdminProduct } from "@/lib/brand-boundary";
import { DatabaseUnavailableError } from "@/lib/db/client";
import { readInbox, readThread } from "@/lib/db/admin-inbox";

import { performInboxOperation } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Support inbox",
  robots: { index: false, follow: false },
};

export default async function AdminInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string | string[] }>;
}) {
  requireAdminProduct();
  const grant = await requireRole("support", { next: ADMIN_INBOX_PATH });
  const params = await searchParams;
  const requested = Array.isArray(params.message) ? params.message[0] : params.message;

  let source: Awaited<ReturnType<typeof readInbox>>;
  try {
    source = await readInbox();
  } catch (error) {
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    console.error("admin-inbox: the queue could not be read", error);
    const unreadable = adminInboxPageCopy.sections?.find((section) => section.id === "unreadable");
    return (
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          {unreadable?.heading ?? adminInboxPageCopy.heading}
        </h1>
        <p className="max-w-3xl text-muted-foreground">{error.reason}</p>
      </div>
    );
  }

  /**
   * Which message is open. An explicit id is read as asked — a thread bookmarked by a colleague
   * stays the thread it named — and with no id the newest message opens; an empty queue opens
   * nothing. An id that names no row is a 404 rather than a quiet fallback to the newest: a
   * message that was deleted should not silently become a different message's screen.
   */
  const selectedId =
    requested === undefined || requested === "" ? (source.messages[0]?.id ?? null) : requested;

  const thread = selectedId === null ? null : await readThread(selectedId);
  if (selectedId !== null && thread === null) notFound();

  return (
    <SupportInbox
      copy={adminInboxPageCopy}
      source={source}
      thread={thread}
      selectedId={selectedId}
      action={performInboxOperation}
      reasonMin={REASON_MIN_LENGTH}
      selfUserId={grant.user.userId}
    />
  );
}
