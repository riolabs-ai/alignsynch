"use client";

// template-ancestor: components/chat/thread.tsx   (variation: the in-relationship Discussion tab — the same thread drawn as comment cards with the author's seat and a "Tag an Aspect" select rather than party-tinted bubbles with a chip toggle group, because it is a panel inside a record page and not a full-height thread)

/**
 * The Discussion tab's thread and composer — one relationship's conversation, on its own screen.
 *
 * `docs/specs/v2-bundles/03-spec-design-page-relationship-detail-v2/relationship-detail.html`
 * (`data-tab="discussion"`) draws this panel as a labelled box with an Aspect selector, a Send
 * button, and the conversation beneath it as comment cards carrying the author, their seat and the
 * instant; `07-…/chat.html` is the same thread at full height. `docs/specs/v2-rectification.md`'s
 * `chat-and-discussion` row names the gap this file closes: the panel drew a heading and one
 * sentence, and the doc and the reference both draw a composer.
 *
 * ## The surfaces are one thread, two expressions
 *
 * `/dashboard/chat` owns the bubble expression and this is the card expression of the **same**
 * facts: the messages come from `data/chat-threads.ts` through `lib/chat/thread.ts`, the state is
 * `chatThreadStateOf`'s answer (waiting, paused, live), and the names are the relationship's own
 * seats. Nothing here re-decides who may write — `writable` is the state's answer, so a waiting or
 * paused relationship cannot render a composer even if a prop asked for one.
 *
 * ## Two things are client state, and nothing else
 *
 * The draft and the Aspect this reader attached to it. A message sent here is appended to the
 * session's own list and is **not written anywhere durable** — the thread model is #921's and that
 * issue has not been approved for a schema — so the sent message carries no timestamp rather than
 * one it invented, exactly as the Chat page's composer does. The history it draws is read from the
 * relationship's own facts, so a thread with no model still renders correctly.
 *
 * No clock is read: every label arrives formatted from an instant (`content/core.ts`), and a
 * message this session appends has no time to print.
 */
import { MessageSquare, PauseCircle, Send } from "lucide-react";
import { useState } from "react";

import { Chip } from "@/components/ui/badge";
import type { PageCopySection } from "@/content/pages";
import { chatThreadWritable, type ChatThreadState } from "@/lib/chat/thread";
import { fillLabel, itemLabel } from "@/lib/page-copy";
import { cn } from "@/lib/utils";

/** Which seat wrote a message — the tone its mark takes, clay for the Initiator, slate for the other. */
export type DiscussionSeat = "initiator" | "counterparty";

/** One message as this panel draws it. Every string is authored or formatted before it arrives. */
export interface DiscussionMessageView {
  readonly id: string;
  /** Written by the reader — labelled "You". */
  readonly mine: boolean;
  readonly seat: DiscussionSeat;
  readonly body: string;
  /** The instant, as `datetime`; `null` for a message this session appended. */
  readonly at: string | null;
  /** The formatted instant, or `null` for a message this session appended. */
  readonly timeLabel: string | null;
  /** The Aspect the message was tagged with, by its prompt — or `null` when it was not tagged. */
  readonly aspectPrompt: string | null;
}

/** One Aspect the selector may tag a message with. */
export interface DiscussionAspect {
  readonly id: string;
  readonly prompt: string;
}

/** The seat's own word — "Initiator" / "Counterparty" — from the page fixture, never a literal here. */
export interface DiscussionSeatLabels {
  readonly initiator: string;
  readonly counterparty: string;
}

/** The mark's two tones: the seat's solid, which is the same pair the Chat page's avatars use. */
const MARK: Record<DiscussionSeat, string> = {
  initiator: "bg-initiator-solid",
  counterparty: "bg-counterparty-solid",
};

/** One message, as a comment card: the mark, the author and their seat, the time, then the words. */
function MessageCard({
  message,
  section,
  otherName,
  otherInitials,
  seatLabels,
}: {
  readonly message: DiscussionMessageView;
  readonly section: PageCopySection;
  readonly otherName: string;
  readonly otherInitials: string;
  readonly seatLabels: DiscussionSeatLabels;
}) {
  const seatWord = message.seat === "initiator" ? seatLabels.initiator : seatLabels.counterparty;
  return (
    <li className="flex gap-3" data-discussion-message={message.id}>
      <span
        aria-hidden="true"
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white",
          MARK[message.seat],
        )}
      >
        {otherInitials}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium text-foreground">
            {message.mine ? itemLabel(section, "you") : otherName}
          </span>
          <Chip variant="tint" data-discussion-seat={message.seat}>
            {seatWord}
          </Chip>
          {message.timeLabel === null ? null : (
            <time dateTime={message.at ?? undefined} className="text-xs text-muted-foreground">
              {message.timeLabel}
            </time>
          )}
        </div>
        <p className="mt-2 text-sm leading-6 text-foreground">{message.body}</p>
        {message.aspectPrompt === null ? null : (
          <div className="mt-2">
            <Chip variant="neutral">{message.aspectPrompt}</Chip>
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * The composer — Add a Comment, the box, the Aspect selector and Send.
 *
 * **One Aspect per message.** A message carries at most one tag (`ChatMessage.aspectId`), so the
 * control is a single-select with an explicit **No Aspect** row rather than a chip group: a
 * select states "one, or none" without a second sentence, and it is what the relationship-detail
 * reference draws.
 */
function Composer({
  section,
  aspects,
  otherName,
  onSend,
}: {
  readonly section: PageCopySection;
  readonly aspects: readonly DiscussionAspect[];
  readonly otherName: string;
  readonly onSend: (input: { body: string; aspectId: string | null }) => void;
}) {
  const [body, setBody] = useState("");
  const [aspectId, setAspectId] = useState("");

  const placeholder = fillLabel(itemLabel(section, "composer-placeholder"), { name: otherName });

  return (
    <form
      data-discussion-composer="true"
      className="rounded-md border border-line bg-mist/50 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        const text = body.trim();
        if (text === "") return;
        onSend({ body: text, aspectId: aspectId === "" ? null : aspectId });
        setBody("");
        setAspectId("");
      }}
    >
      <label htmlFor="discussion-composer-body" className="sr-only">
        {itemLabel(section, "composer-label")}
      </label>
      <textarea
        id="discussion-composer-body"
        rows={3}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={placeholder}
        className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {itemLabel(section, "tag-label")}
          </span>
          <select
            value={aspectId}
            onChange={(event) => setAspectId(event.target.value)}
            className="flex h-9 w-full items-center rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-56"
          >
            <option value="">{itemLabel(section, "tag-none")}</option>
            {aspects.map((aspect) => (
              <option key={aspect.id} value={aspect.id}>
                {aspect.prompt}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={body.trim() === ""}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 self-start rounded-md bg-action px-3 text-sm font-medium text-action-foreground transition-colors hover:bg-action-hover disabled:opacity-50 sm:self-auto"
        >
          <Send aria-hidden="true" className="size-4 shrink-0" />
          {itemLabel(section, "send")}
        </button>
      </div>
    </form>
  );
}

export function DiscussionThread({
  section,
  state,
  messages,
  aspects,
  viewerSeat,
  otherName,
  otherInitials,
  selfInitials,
  seatLabels,
  readOnlyLine,
}: {
  readonly section: PageCopySection;
  readonly state: ChatThreadState;
  /** The relationship's thread, oldest first, already formatted. */
  readonly messages: readonly DiscussionMessageView[];
  readonly aspects: readonly DiscussionAspect[];
  readonly viewerSeat: DiscussionSeat;
  /** The other seat's name, as the relationship knows it. */
  readonly otherName: string;
  readonly otherInitials: string;
  readonly selfInitials: string;
  readonly seatLabels: DiscussionSeatLabels;
  /**
   * The band a thread that cannot be written draws, already chosen — paused and closed read
   * differently, and the panel owns which sentence is true. `null` means the thread is writable.
   */
  readonly readOnlyLine: string | null;
}) {
  /** The messages this session appended. Nothing durable exists yet — see the docstring. */
  const [appended, setAppended] = useState<readonly DiscussionMessageView[]>([]);
  const shown = [...messages, ...appended];
  const writable = chatThreadWritable(state) && readOnlyLine === null;

  if (state === "waiting") {
    return (
      <div
        data-discussion-waiting="true"
        className="flex flex-col items-center justify-center rounded-md border border-dashed border-line bg-mist/50 px-4 py-10 text-center"
      >
        <span
          aria-hidden="true"
          className="flex size-10 items-center justify-center rounded-full bg-mist text-primary"
        >
          <MessageSquare className="size-5 shrink-0" />
        </span>
        <p className="mt-3 text-sm text-foreground">
          {fillLabel(itemLabel(section, "waiting"), { name: otherName })}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {writable ? (
        <Composer
          section={section}
          aspects={aspects}
          otherName={otherName}
          onSend={({ body, aspectId }) =>
            setAppended((previous) => [
              ...previous,
              {
                id: `sent-${String(previous.length + 1)}`,
                mine: true,
                seat: viewerSeat,
                body,
                at: null,
                timeLabel: null,
                aspectPrompt: aspects.find((aspect) => aspect.id === aspectId)?.prompt ?? null,
              },
            ])
          }
        />
      ) : (
        <p
          data-discussion-read-only="true"
          className="flex items-center gap-2 rounded-md border border-dashed border-line bg-mist/50 p-3 text-sm text-foreground"
        >
          <PauseCircle aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          {readOnlyLine}
        </p>
      )}

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-discussion-empty="true">
          {itemLabel(section, "empty")}
        </p>
      ) : (
        <ol aria-label={itemLabel(section, "messages")} className="space-y-4">
          {shown.map((message) => (
            <MessageCard
              key={message.id}
              message={message}
              section={section}
              otherName={otherName}
              otherInitials={message.mine ? selfInitials : otherInitials}
              seatLabels={seatLabels}
            />
          ))}
        </ol>
      )}
    </div>
  );
}
