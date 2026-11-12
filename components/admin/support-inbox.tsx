"use client";

/**
 * template-ancestor: components/my-quizzes/my-quizzes.tsx   (variation: the list is a support queue — one row per contact message with its status badge, seat and reply count, and the selected row opening a thread on the same screen instead of navigating to a details page)
 *
 * `/admin/inbox`, the left-hand half and the frame: the queue, then the selected message's thread
 * (`components/admin/support-thread.tsx`). #506.
 *
 * **One surface, one read.** The queue and the open thread are drawn from the same request-time
 * render, so a status the thread just changed is the status the row above it shows — there is no
 * second fetch that could answer from a different snapshot. The selection is a query parameter
 * (`?message=<id>`), which keeps a message's thread a link an operator can send to a colleague
 * without a second route the manifest has to know about.
 *
 * **The queue is not filtered, and that is a decision.** A filter would be a second read or a
 * client-side hidden list; a support queue is worked newest-first, and every status is visible on
 * the row it belongs to. What *is* said explicitly is the truncated case: the read is bounded
 * (`INBOX_PAGE_SIZE`), and a hidden count is a sentence rather than a silent cut.
 *
 * **No address is authored here.** Names, addresses and bodies are rows; every word this file
 * renders comes from `data/pages/admin-inbox.ts` (E23), and the surface's `support` gate is what
 * keeps all of it off a public page.
 */
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/content/core";
import type { PageCopy, PageCopySection } from "@/content/pages";
import { SupportThread } from "@/components/admin/support-thread";
import type { MessageStatus } from "@/lib/admin/inbox";
import type { InboxOperationInput, InboxOperationOutcome } from "@/lib/admin/inbox-inputs";
import { adminInboxMessagePath } from "@/lib/admin/paths";
import type { InboxMessage, InboxSeat, InboxSource, InboxThread } from "@/lib/db/admin-inbox";
import { cn } from "@/lib/utils";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

/** The status's copy id — one word per status, shared with the thread header. */
const STATUS_COPY_ID: Record<MessageStatus, string> = {
  new: "status-new",
  open: "status-open",
  waiting: "status-waiting",
  closed: "status-closed",
};

/** The badge variant per status: `waiting` is the alarm, `closed` is quiet. */
const STATUS_VARIANT: Record<MessageStatus, "blue" | "yellow" | "warning" | "muted"> = {
  new: "blue",
  open: "yellow",
  waiting: "warning",
  closed: "muted",
};

/** The first line of a message, for the row. One line, because the row is a queue item. */
function snippetOf(body: string): string {
  const firstLine = body.trim().split("\n")[0] ?? "";
  return firstLine.length > 120 ? `${firstLine.slice(0, 120)}…` : firstLine;
}

/** A heading, or the empty string — `sectionHeading` is not a reader the repo has. */
function headingOf(section: PageCopySection): string {
  return section.heading ?? "";
}

export function SupportInbox({
  copy,
  source,
  thread,
  selectedId,
  action,
  selfUserId,
}: {
  copy: PageCopy;
  source: InboxSource;
  thread: InboxThread | null;
  selectedId: string | null;
  action: (input: InboxOperationInput) => Promise<InboxOperationOutcome>;
  selfUserId: string;
}) {
  const listCopy = sectionOf(copy, "list");

  const seatNameOf = (message: InboxMessage): string | null => {
    if (message.assignedUserId === null) return null;
    const seat: InboxSeat | undefined = source.seats.find(
      (candidate) => candidate.userId === message.assignedUserId,
    );
    return seat?.name ?? message.assignedName ?? message.assignedUserId;
  };

  const repliesOf = (message: InboxMessage): string =>
    fillLabel(
      itemLabel(listCopy, message.replyCount === 1 ? "replies-count" : "replies-count-plural"),
      { count: message.replyCount },
    );

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{copy.heading}</h1>
        {copy.subtitle === undefined ? null : (
          <p className="max-w-3xl text-muted-foreground">{copy.subtitle}</p>
        )}
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{headingOf(listCopy)}</CardTitle>
          <CardDescription>{sectionBody(listCopy)}</CardDescription>
        </CardHeader>
        <CardContent>
          {source.messages.length === 0 ? (
            <p data-empty="true" className="text-sm text-muted-foreground">
              {itemLabel(listCopy, "empty")}
            </p>
          ) : (
            <>
              <div className="hidden gap-3 border-b px-3 pb-2 text-xs uppercase tracking-wide text-muted-foreground sm:grid sm:grid-cols-[1fr_auto_auto_auto]">
                <span>{itemLabel(listCopy, "column-message")}</span>
                <span>{itemLabel(listCopy, "column-status")}</span>
                <span>{itemLabel(listCopy, "column-seat")}</span>
                <span>{itemLabel(listCopy, "column-received")}</span>
              </div>
              <ul className="divide-y">
                {source.messages.map((message) => {
                  const selected = message.id === selectedId;
                  const seat = seatNameOf(message);
                  return (
                    <li key={message.id}>
                      <Link
                        href={adminInboxMessagePath(message.id)}
                        data-message={message.id}
                        data-selected={selected ? "true" : "false"}
                        className={cn(
                          "grid gap-2 px-3 py-3 transition-colors hover:bg-muted/60 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center sm:gap-3",
                          selected ? "bg-muted/70" : "",
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{message.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {snippetOf(message.message)}
                          </span>
                          <span className="block text-[11px] text-muted-foreground">
                            {repliesOf(message)}
                            {message.throttle.throttled
                              ? ` · ${itemLabel(listCopy, "throttled")}`
                              : ""}
                            {message.delivery === "bounced" || message.delivery === "complained"
                              ? ` · ${itemLabel(listCopy, `chip-${message.delivery}`)}`
                              : ""}
                          </span>
                        </span>
                        <Badge
                          variant={STATUS_VARIANT[message.status]}
                          data-status={message.status}
                        >
                          {itemLabel(listCopy, STATUS_COPY_ID[message.status])}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {seat ?? itemLabel(listCopy, "unassigned")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(message.createdAt)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {source.hidden === 0 ? null : (
            <p data-hidden={source.hidden} className="mt-3 text-xs text-muted-foreground">
              {fillLabel(itemLabel(listCopy, "hidden"), { count: source.hidden })}
            </p>
          )}
        </CardContent>
      </Card>

      {thread === null ? null : (
        <SupportThread
          copy={copy}
          thread={thread}
          seats={source.seats}
          action={action}
          selfUserId={selfUserId}
        />
      )}
    </div>
  );
}
