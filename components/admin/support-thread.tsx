"use client";

/**
 * template-ancestor: components/chat/chat-conversation.tsx   (variation: one support message's thread — the person's message and our replies as the same left/right bubbles with a receipt line under each, a facts header in place of the contact's presence, and an audited reply form in place of the chat composer)
 *
 * `/admin/inbox`, the right-hand half: one `contact_message`, its thread, and the three things a
 * support seat may do with it (#506).
 *
 * **The bubbles are the ancestor's, the state under them is this screen's.** `chat-message.tsx`
 * draws a sent message as a right-aligned bubble with a clock/check receipt under it; here the
 * receipt is the *provider's* answer — `sending`, `accepted <at>`, or `not accepted` with the error
 * the provider returned, stored on the reply row. A reply that failed is not hidden and not
 * restyled: the words stay in the thread with their refusal under them, which is the card's
 * "visible, never swallowed" made into a layout.
 *
 * **Nothing here decides a permission or a refusal.** `sendRefusalFor()` is imported from the
 * module the server also uses, so the button's disabled state and the server's refusal are one
 * derivation; the role floors are `act()`'s inside the transaction, and the screen only knows
 * whether *it* can send. A band it cannot use is disabled with the sentence saying why.
 *
 * **The screen re-reads after every write.** Each operation answers the audit row's id and the
 * new state, which is drawn immediately; `router.refresh()` then re-reads the server render, so the
 * list's row and the facts header agree with the row the transaction committed. Nothing is patched
 * optimistically — a status this screen invented would be a status nobody recorded.
 *
 * Literal-free (E23): every word is `data/pages/admin-inbox.ts`; `formatDateTimeLong` and the
 * status vocabulary are the exceptions the repo already makes for instants and model values.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { formatDateTimeLong } from "@/content/core";
import type { PageCopy, PageCopySection } from "@/content/pages";
import {
  MESSAGE_STATUSES,
  type MessageStatus,
  type SendRefusal,
  sendRefusalFor,
} from "@/lib/admin/inbox";
import type { InboxOperationInput, InboxOperationOutcome } from "@/lib/admin/inbox-inputs";
import type { InboxMessage, InboxReply, InboxSeat, InboxThread } from "@/lib/db/admin-inbox";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

/** The status's copy id, `status-` prefixed so the list and the header share one word per status. */
const STATUS_COPY_ID: Record<MessageStatus, string> = {
  new: "status-new",
  open: "status-open",
  waiting: "status-waiting",
  closed: "status-closed",
};

/** The badge variant per status — a queue reads at a glance, and `waiting` is the alarm. */
const STATUS_VARIANT: Record<MessageStatus, "blue" | "yellow" | "warning" | "muted" | "outline"> = {
  new: "blue",
  open: "yellow",
  waiting: "warning",
  closed: "muted",
};

/** What the screen is doing, or what the last write answered. */
type Phase =
  | { readonly kind: "idle" }
  | { readonly kind: "done"; readonly outcome: InboxOperationOutcome }
  | { readonly kind: "error"; readonly code: string };

/** A heading, or the empty string — `sectionHeading` is not a reader the repo has. */
function headingOf(section: PageCopySection): string {
  return section.heading ?? "";
}

/** Fill `{name}` in a sentence without inventing a second string. */
function say(
  section: PageCopySection,
  id: string,
  values: Record<string, string | number>,
): string {
  return fillLabel(itemLabel(section, id), values);
}

/** The refusal sentence for a code, falling back to the generic one the fixture carries. */
function refusalOf(refusals: PageCopySection, code: string): string {
  const item = refusals.items?.find((candidate) => candidate.id === code);
  return item === undefined ? itemLabel(refusals, "failed") : item.label;
}

/** The sentence under a reply: what happened to it, and the provider's own words when it failed. */
function ReplyReceipt({ reply, copy }: { reply: InboxReply; copy: PageCopySection }) {
  if (reply.state === "sent") {
    return (
      <p data-reply-state="sent" className="text-[11px] text-muted-foreground">
        {say(copy, "state-sent", { at: formatDateTimeLong(reply.sentAt ?? reply.createdAt) })}
        {reply.providerId === null
          ? ""
          : ` · ${say(copy, "provider-id", { id: reply.providerId })}`}
      </p>
    );
  }
  if (reply.state === "sending") {
    return (
      <p data-reply-state="sending" className="text-[11px] text-amber-700">
        {itemLabel(copy, "state-sending")}
      </p>
    );
  }
  return (
    <div data-reply-state="failed" className="space-y-1">
      <p className="text-[11px] font-medium text-amber-700">{itemLabel(copy, "state-failed")}</p>
      <p className="text-[11px] text-muted-foreground">
        {say(copy, "error", { error: reply.error ?? "" })}
      </p>
    </div>
  );
}

/** The facts header: who wrote, when, which status, and which seat has it. */
function MessageFacts({
  message,
  copy,
  listCopy,
  seats,
}: {
  message: InboxMessage;
  copy: PageCopySection;
  listCopy: PageCopySection;
  seats: readonly InboxSeat[];
}) {
  const seat =
    message.assignedUserId === null
      ? null
      : (seats.find((candidate) => candidate.userId === message.assignedUserId)?.name ??
        message.assignedName ??
        message.assignedUserId);

  return (
    <dl className="grid gap-3 sm:grid-cols-3">
      <div className="flex flex-col gap-1">
        <dt className="text-xs uppercase tracking-wide text-muted-foreground">
          {itemLabel(copy, "from")}
        </dt>
        <dd className="text-sm font-medium">{message.name}</dd>
        <dd className="font-mono text-xs text-muted-foreground">{message.email}</dd>
      </div>
      <div className="flex flex-col gap-1">
        <dt className="text-xs uppercase tracking-wide text-muted-foreground">
          {itemLabel(copy, "received")}
        </dt>
        <dd className="text-sm font-medium">{formatDateTimeLong(message.createdAt)}</dd>
      </div>
      <div className="flex flex-col gap-1">
        <dt className="text-xs uppercase tracking-wide text-muted-foreground">
          {itemLabel(copy, "status")}
        </dt>
        <dd>
          <Badge variant={STATUS_VARIANT[message.status]} data-status={message.status}>
            {itemLabel(listCopy, STATUS_COPY_ID[message.status])}
          </Badge>
        </dd>
      </div>
      <div className="flex flex-col gap-1">
        <dt className="text-xs uppercase tracking-wide text-muted-foreground">
          {itemLabel(copy, "seat")}
        </dt>
        <dd className="text-sm font-medium">{seat ?? itemLabel(listCopy, "unassigned")}</dd>
      </div>
      <div className="flex flex-col gap-1">
        <dt className="text-xs uppercase tracking-wide text-muted-foreground">
          {itemLabel(copy, "replies")}
        </dt>
        <dd data-reply-count={message.replyCount} className="text-sm font-medium">
          {say(listCopy, message.replyCount === 1 ? "replies-count" : "replies-count-plural", {
            count: message.replyCount,
          })}
        </dd>
      </div>
      <div className="flex flex-col gap-1">
        <dt className="text-xs uppercase tracking-wide text-muted-foreground">
          {message.sentAt === null
            ? itemLabel(copy, "not-sent")
            : say(copy, "sent-at", { at: formatDateTimeLong(message.sentAt) })}
        </dt>
        <dd className="text-sm text-muted-foreground">
          {message.mailOutcome === null
            ? itemLabel(copy, "notice-outcome-unknown")
            : itemLabel(copy, `notice-outcome-${message.mailOutcome}`)}
        </dd>
      </div>
    </dl>
  );
}

export function SupportThread({
  copy,
  thread,
  seats,
  action,
  selfUserId,
}: {
  copy: PageCopy;
  thread: InboxThread;
  seats: readonly InboxSeat[];
  action: (input: InboxOperationInput) => Promise<InboxOperationOutcome>;
  selfUserId: string;
}) {
  const router = useRouter();
  const listCopy = sectionOf(copy, "list");
  const messageCopy = sectionOf(copy, "message");
  const deliveryCopy = sectionOf(copy, "delivery");
  const throttleCopy = sectionOf(copy, "throttle");
  const threadCopy = sectionOf(copy, "thread");
  const replyCopy = sectionOf(copy, "reply");
  const triageCopy = sectionOf(copy, "triage");
  const assignCopy = sectionOf(copy, "assign");
  const refusals = sectionOf(copy, "refusals");

  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [busy, setBusy] = useState<"reply" | "status" | "assign" | null>(null);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<MessageStatus>(thread.message.status);
  const [seat, setSeat] = useState(thread.message.assignedUserId ?? "");

  const message = thread.message;
  const refusal: SendRefusal | null = sendRefusalFor(message.delivery);
  const deliverySentence = itemLabel(deliveryCopy, message.delivery);

  const run = (which: "reply" | "status" | "assign", input: InboxOperationInput) => {
    if (busy !== null) return;
    setBusy(which);
    void action(input)
      .then((outcome) => {
        setPhase({ kind: "done", outcome });
        router.refresh();
      })
      .catch(() => setPhase({ kind: "error", code: "failed" }))
      .finally(() => setBusy(null));
  };

  const submitReply = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    run("reply", { operation: "reply", messageId: message.id, body });
  };

  const submitStatus = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    run("status", { operation: "status", messageId: message.id, status });
  };

  const submitAssign = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    run("assign", {
      operation: "assign",
      messageId: message.id,
      seatUserId: seat === "" ? null : seat,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{headingOf(messageCopy)}</CardTitle>
          <CardDescription>{messageCopy.body ?? ""}</CardDescription>
        </CardHeader>
        <CardContent>
          <MessageFacts message={message} copy={messageCopy} listCopy={listCopy} seats={seats} />
        </CardContent>
        <CardFooter className="flex flex-wrap items-center gap-3">
          <Badge
            variant={message.delivery === "unknown" ? "outline" : "secondary"}
            data-delivery={message.delivery}
          >
            {itemLabel(deliveryCopy, message.delivery)}
          </Badge>
          <p className="text-xs text-muted-foreground">{itemLabel(deliveryCopy, "source")}</p>
        </CardFooter>
      </Card>

      <Card data-delivery-card={message.delivery}>
        <CardHeader>
          <CardTitle>{headingOf(deliveryCopy)}</CardTitle>
          <CardDescription>{sectionBody(deliveryCopy)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p data-delivery-sentence={message.delivery} className="text-sm">
            {deliverySentence}
          </p>
          <p data-throttled={message.throttle.throttled ? "true" : "false"} className="text-sm">
            {say(throttleCopy, message.throttle.throttled ? "reached" : "quiet", {
              recent: message.throttle.recent,
              limit: message.throttle.limit,
              minutes: message.throttle.windowMinutes,
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            {say(throttleCopy, "total", { count: message.throttle.total })}
          </p>
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">{sectionBody(throttleCopy)}</p>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{headingOf(threadCopy)}</CardTitle>
          <CardDescription>{sectionBody(threadCopy)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 bg-muted/20">
          <div className="flex justify-start">
            <div className="max-w-[85%] space-y-1">
              <div className="rounded-2xl rounded-tl-none bg-muted px-4 py-2.5 text-sm">
                <p className="whitespace-pre-wrap break-words">{message.message}</p>
              </div>
              <p className="pl-1 text-[11px] text-muted-foreground">
                {say(threadCopy, "them", {
                  name: message.name,
                  at: formatDateTimeLong(message.createdAt),
                })}
              </p>
            </div>
          </div>

          {thread.replies.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
              {itemLabel(threadCopy, "empty")}
            </p>
          ) : null}

          {thread.replies.map((reply) => (
            <div key={reply.id} className="flex justify-end" data-reply={reply.id}>
              <div className="max-w-[85%] space-y-1">
                <div className="rounded-2xl rounded-tr-none bg-action px-4 py-2.5 text-sm text-action-foreground">
                  <p className="whitespace-pre-wrap break-words">{reply.body}</p>
                </div>
                <div className="pr-1 text-right">
                  <p className="text-[11px] text-muted-foreground">
                    {say(threadCopy, "you", {
                      name: reply.authorName ?? reply.authorUserId,
                      at: formatDateTimeLong(reply.createdAt),
                    })}
                  </p>
                  <ReplyReceipt reply={reply} copy={threadCopy} />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card data-reply-refused={refusal ?? "none"}>
        <CardHeader>
          <CardTitle>{headingOf(replyCopy)}</CardTitle>
          <CardDescription>{sectionBody(replyCopy)}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={submitReply}>
            <div className="space-y-1">
              <Label htmlFor="inbox-reply-body">{itemLabel(replyCopy, "body")}</Label>
              <textarea
                id="inbox-reply-body"
                className="border-input bg-background min-h-32 w-full rounded-md border px-3 py-2 text-sm"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                disabled={busy !== null || refusal !== null}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={busy !== null || refusal !== null}>
                {busy === "reply"
                  ? itemLabel(replyCopy, "sending")
                  : itemLabel(replyCopy, "button")}
              </Button>
              {refusal === null ? null : (
                <p data-send-refusal={refusal} className="text-sm font-medium text-amber-700">
                  {refusalOf(refusals, refusal)}
                </p>
              )}
            </div>
          </form>

          {phase.kind === "done" && phase.outcome.ok && phase.outcome.operation === "reply" ? (
            <div
              data-reply-outcome={phase.outcome.sentAt === null ? "refused" : "accepted"}
              className="mt-4 space-y-1 rounded-md border p-3"
            >
              {phase.outcome.sentAt === null ? (
                <p className="text-sm font-medium text-amber-700">
                  {say(replyCopy, "refused", { error: phase.outcome.error ?? "" })}
                </p>
              ) : (
                <p className="text-sm font-medium">
                  {say(replyCopy, "accepted", {
                    at: formatDateTimeLong(phase.outcome.sentAt),
                  })}
                </p>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{headingOf(triageCopy)}</CardTitle>
            <CardDescription>{sectionBody(triageCopy)}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={submitStatus}>
              <div className="space-y-1">
                <Label htmlFor="inbox-status">{itemLabel(triageCopy, "status")}</Label>
                <select
                  id="inbox-status"
                  name="status"
                  className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as MessageStatus)}
                  disabled={busy !== null}
                >
                  {MESSAGE_STATUSES.map((candidate) => (
                    <option key={candidate} value={candidate}>
                      {itemLabel(listCopy, STATUS_COPY_ID[candidate])}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" disabled={busy !== null}>
                {busy === "status"
                  ? itemLabel(triageCopy, "saving")
                  : itemLabel(triageCopy, "button")}
              </Button>
              {phase.kind === "done" && phase.outcome.ok && phase.outcome.operation === "status" ? (
                <p
                  data-status-saved={phase.outcome.status}
                  className="text-sm text-muted-foreground"
                >
                  {say(triageCopy, "done", { id: phase.outcome.actionId.slice(0, 8) })}
                </p>
              ) : null}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{headingOf(assignCopy)}</CardTitle>
            <CardDescription>{sectionBody(assignCopy)}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={submitAssign}>
              <div className="space-y-1">
                <Label htmlFor="inbox-seat">{itemLabel(assignCopy, "seat")}</Label>
                <select
                  id="inbox-seat"
                  name="seat"
                  className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                  value={seat}
                  onChange={(event) => setSeat(event.target.value)}
                  disabled={busy !== null}
                >
                  <option value="">{itemLabel(assignCopy, "none")}</option>
                  {seats.map((candidate) => (
                    <option key={candidate.userId} value={candidate.userId}>
                      {candidate.userId === selfUserId
                        ? `${candidate.name} · ${itemLabel(assignCopy, "self")}`
                        : candidate.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit" disabled={busy !== null}>
                {busy === "assign"
                  ? itemLabel(assignCopy, "saving")
                  : itemLabel(assignCopy, "button")}
              </Button>
              {phase.kind === "done" && phase.outcome.ok && phase.outcome.operation === "assign" ? (
                <p
                  data-seat-saved={phase.outcome.seatUserId ?? "none"}
                  className="text-sm text-muted-foreground"
                >
                  {say(assignCopy, "done", { id: phase.outcome.actionId.slice(0, 8) })}
                </p>
              ) : null}
            </form>
          </CardContent>
        </Card>
      </div>

      {phase.kind === "done" && !phase.outcome.ok ? (
        <p data-refusal={phase.outcome.code} className="text-sm font-medium text-amber-700">
          {refusalOf(refusals, phase.outcome.code)}
        </p>
      ) : null}
      {phase.kind === "error" ? (
        <p data-refusal={phase.code} className="text-sm font-medium text-amber-700">
          {refusalOf(refusals, phase.code)}
        </p>
      ) : null}
    </div>
  );
}
