"use client";

// template-ancestor: components/chat/chat-conversation.tsx   (variation: one relationship's thread instead of one quiz contact's — party-tinted bubbles by seat, an Aspect chip with its Align status beside a message, and three states the thread can be in: live, waiting to join, and paused read-only)

/**
 * One relationship's thread — `/dashboard/chat?relationship=<id>` (#1131).
 *
 * The v2 bundle's thread (`docs/specs/v2-bundles/07-spec-design-page-chat-v2/chat.html`): a header
 * with the other person's mark, the relationship's title, who it is with and the thread's state; the
 * messages as party-tinted bubbles; and one of three footers — a composer, the waiting sentence, or
 * the paused band.
 *
 * ## The three states are the page's answer, never this component's
 *
 * `state` arrives derived (`lib/chat/thread.ts::chatThreadStateOf`): `live`, `waiting` or `paused`.
 * This file draws the footer that state owns and asks no second question, so a thread cannot render a
 * composer over a paused relationship — the frozen answer *is* the state.
 *
 * ## A tag is an Aspect plus the status Align gives it
 *
 * A message may carry an Aspect chip and, beside it, that Aspect's Align status — ✓ In Synch, ≈ Small
 * Gap, or the flag — and the pair links to the Aspect **on Align**. `tags` arrives from
 * `chatAspectTagsOf()`, whose status is `null` until both parties have accepted: under the blind rule
 * the chip then names the Aspect and shows no status, because a status *is* a reading of the other
 * person's answers.
 *
 * ## Two things are client state, and nothing else
 *
 * The composer's tag selection and the message it appends. Both are the reader's own act inside a
 * session; nothing is written anywhere durable yet — the thread model is #921's, and this surface
 * therefore says so in its own docstring and in the PR rather than pretending a write happened. The
 * tags a message was sent with are read from props, so a thread with no model still draws its
 * history exactly as the relationship's own facts describe it.
 *
 * No clock is read: every label is formatted on the server and arrives as a string, and a message
 * this component appends carries no time rather than a time it invented.
 */
import { Check, Flag, MessageSquare, PauseCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { AlignmentStatus } from "@/content/gaps";
import type { PageCopy } from "@/content/pages";
import { chatStatusWord, chatThreadStateLabel } from "@/lib/chat/copy";
import type { ChatAspectTag, ChatThreadState } from "@/lib/chat/thread";
import { fillLabel, itemLabel, pageItemOf, sectionOf } from "@/lib/page-copy";

/** Who wrote a message: the reader's own seat, and which party tone the bubble takes. */
export type ChatSeat = "initiator" | "counterparty";

/** One message as the thread draws it. Every string is authored or formatted before it arrives. */
export interface ChatThreadMessageView {
  readonly id: string;
  /** Written by the reader — right-aligned, labelled "You". */
  readonly mine: boolean;
  /** The seat that wrote it. Clay is the Initiator's, slate-teal the Counterparty's. */
  readonly seat: ChatSeat;
  readonly body: string;
  /** The Aspect this message was tagged with, or `null` when it was not tagged. */
  readonly aspectId: string | null;
  /** The formatted instant, or `null` for a message this session appended. */
  readonly timeLabel: string | null;
}

/**
 * The status paint, per status — the same four tones Align uses, because they are the same statuses.
 *
 * Colour is the third cue on every chip: the mark is first, the word beside it second, and the four
 * class strings here only ever tint what those two already say. A 1-step Gap under Full tolerance
 * keeps its ≈ and takes the Gap's colour, which is also the one status whose *word* carries the
 * qualifier — so the tolerance is never legible from colour alone.
 */
const STATUS_PAINT: Record<AlignmentStatus, { chip: string; icon: "check" | "approx" | "flag" }> = {
  "in-synch": { chip: "border-synch-mark bg-synch-tint text-synch", icon: "check" },
  "small-gap-ok": {
    chip: "border-small-gap-mark bg-small-gap-tint text-small-gap",
    icon: "approx",
  },
  "small-gap-tight": { chip: "border-gap-mark bg-gap-tint text-gap", icon: "approx" },
  gap: { chip: "border-gap-mark bg-gap-tint text-gap", icon: "flag" },
};

/**
 * The ≈ as two waves rather than a font glyph, the same shape Align draws.
 */
function StatusIcon({ icon }: { readonly icon: "check" | "approx" | "flag" }) {
  if (icon === "check") return <Check className="size-3.5 shrink-0" aria-hidden />;
  if (icon === "flag") return <Flag className="size-3.5 shrink-0" aria-hidden />;
  return (
    <svg
      className="size-3.5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 9.5a6.5 6.5 0 0 1 7 0 6.5 6.5 0 0 0 7 0" />
      <path d="M5 15.5a6.5 6.5 0 0 1 7 0 6.5 6.5 0 0 0 7 0" />
    </svg>
  );
}

/**
 * The Aspect chip beside a message: the Aspect's own words, and its Align status when one may be
 * shown. One link around the pair, because a message's tag is a door to Align rather than two
 * controls — and the door's accessible name says where it goes.
 */
function AspectChip({
  copy,
  tag,
  alignHrefBase,
}: {
  readonly copy: PageCopy;
  readonly tag: ChatAspectTag;
  readonly alignHrefBase: string;
}) {
  const paint = tag.status === null ? null : STATUS_PAINT[tag.status];
  return (
    <Link
      href={`${alignHrefBase}#aspect-${tag.itemId}`}
      data-chat-tag={tag.itemId}
      data-status-chip={tag.status ?? "none"}
      aria-label={fillLabel(pageItemOf(copy, "open-aspect").label, { aspect: tag.prompt })}
      className="mt-2 inline-flex max-w-full flex-wrap items-center gap-1.5"
    >
      <span className="inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full border border-line bg-background px-2.5 py-0.5 text-xs font-semibold text-foreground">
        <MessageSquare aria-hidden className="size-3.5 shrink-0" />
        <span className="truncate">{tag.prompt}</span>
      </span>
      {paint === null || tag.status === null ? null : (
        <span
          className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${paint.chip}`}
        >
          <StatusIcon icon={paint.icon} />
          {chatStatusWord(copy, tag.status)}
        </span>
      )}
    </Link>
  );
}

/** One message: mark, who and when, and the bubble with the tag's chips under its words. */
function MessageBubble({
  copy,
  message,
  tags,
  alignHrefBase,
  selfInitials,
  otherInitials,
  otherName,
}: {
  readonly copy: PageCopy;
  readonly message: ChatThreadMessageView;
  readonly tags: readonly ChatAspectTag[];
  readonly alignHrefBase: string;
  readonly selfInitials: string;
  readonly otherInitials: string;
  readonly otherName: string;
}) {
  const tag =
    message.aspectId === null ? undefined : tags.find((each) => each.itemId === message.aspectId);
  const own = message.seat === "initiator";
  return (
    <li
      data-chat-message={message.mine ? "mine" : "theirs"}
      className={`flex gap-2 ${message.mine ? "flex-row-reverse" : ""}`}
    >
      <span
        aria-hidden="true"
        className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          own ? "bg-initiator-solid text-white" : "bg-counterparty-solid text-white"
        }`}
      >
        {message.mine ? selfInitials : otherInitials}
      </span>
      <div className="max-w-[85%] md:max-w-[70%]">
        <p className={`mb-1 text-xs text-muted-foreground ${message.mine ? "text-right" : ""}`}>
          <span className="font-medium text-foreground">
            {message.mine ? pageItemOf(copy, "you").label : otherName}
          </span>
          {message.timeLabel === null ? null : ` · ${message.timeLabel}`}
        </p>
        <div
          className={`rounded-lg border px-3 py-2 text-sm leading-6 text-foreground ${
            own
              ? "border-initiator-line bg-initiator-tint"
              : "border-counterparty-line bg-counterparty-tint"
          }`}
        >
          {message.body}
          {tag === undefined ? null : (
            <div className="flex flex-wrap items-center gap-1.5">
              <AspectChip copy={copy} tag={tag} alignHrefBase={alignHrefBase} />
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

/**
 * The composer: the Aspect tags, the box, and the send.
 *
 * **One tag at a time, on purpose.** A message carries one Aspect (`ChatMessage.aspectId`), so the
 * chips are a toggle *group* with one pressed at most: pressing a second tag moves the tag rather
 * than stacking two, and pressing the pressed one clears it. Each chip exposes `aria-pressed`, which
 * is what the bundle's prototype marks and what a screen reader announces.
 */
function Composer({
  copy,
  tags,
  otherName,
  onSend,
}: {
  readonly copy: PageCopy;
  readonly tags: readonly ChatAspectTag[];
  readonly otherName: string;
  readonly onSend: (input: { body: string; aspectId: string | null }) => void;
}) {
  const [pressed, setPressed] = useState<string | null>(null);
  const [body, setBody] = useState("");

  const send = () => {
    const text = body.trim();
    if (text === "") return;
    onSend({ body: text, aspectId: pressed });
    setBody("");
    setPressed(null);
  };

  return (
    <form
      data-chat-composer="true"
      className="space-y-2 border-t p-4"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <fieldset className="-mx-1 m-0 flex min-w-0 gap-1.5 overflow-x-auto border-0 p-0 px-1 pb-1">
        <legend className="sr-only">{pageItemOf(copy, "tag-group").label}</legend>
        <span className="flex shrink-0 items-center text-xs text-muted-foreground">
          {pageItemOf(copy, "tag-prefix").label}
        </span>
        {tags.map((tag) => (
          <button
            key={tag.itemId}
            type="button"
            aria-pressed={pressed === tag.itemId}
            data-tag-chip={tag.itemId}
            onClick={() => setPressed(pressed === tag.itemId ? null : tag.itemId)}
            className="inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-full border border-line bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-mist aria-pressed:border-action aria-pressed:bg-mist"
          >
            {tag.prompt}
          </button>
        ))}
      </fieldset>
      <div className="flex items-end gap-2">
        <label htmlFor="chat-composer-body" className="sr-only">
          {fillLabel(pageItemOf(copy, "message-placeholder").label, { name: otherName })}
        </label>
        <textarea
          id="chat-composer-body"
          rows={2}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={fillLabel(pageItemOf(copy, "message-placeholder").label, {
            name: otherName,
          })}
          className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="submit"
          aria-label={pageItemOf(copy, "send").label}
          disabled={body.trim() === ""}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md bg-action text-action-foreground transition-colors hover:bg-action-hover disabled:opacity-50 lg:size-10"
        >
          <svg
            className="size-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </button>
      </div>
    </form>
  );
}

export function ChatThread({
  copy,
  title,
  otherName,
  otherInitials,
  selfInitials,
  state,
  messages,
  tags,
  alignHrefBase,
  withLine,
  listHref,
  openHref,
  payHref,
  waitingHeading,
  waitingBody,
}: {
  readonly copy: PageCopy;
  readonly title: string;
  readonly otherName: string;
  readonly otherInitials: string;
  readonly selfInitials: string;
  readonly state: ChatThreadState;
  readonly messages: readonly ChatThreadMessageView[];
  readonly tags: readonly ChatAspectTag[];
  /** `instancePath(...)` — the Align surface's address, with the Aspect's anchor appended per tag. */
  readonly alignHrefBase: string;
  /** "With {name}", already filled — or `null` when the other seat has no name to print. */
  readonly withLine: string | null;
  /** The conversation list's own address — the mobile back chevron's destination. */
  readonly listHref: string;
  /** The relationship's own screen, the header's "Open". */
  readonly openHref: string;
  /** The pay modal's address for the paused band's one action, or `null` when there is none. */
  readonly payHref: string | null;
  /** "Chat Opens When {name} Joins", already filled. */
  readonly waitingHeading: string;
  /** The waiting band's second line, already filled: when the invitation runs out, or that it has not gone. */
  readonly waitingBody: string;
}) {
  /** The messages this session appended. Nothing durable exists yet — see the docstring. */
  const [appended, setAppended] = useState<readonly ChatThreadMessageView[]>([]);
  const shown = [...messages, ...appended];

  const pausedCopy = sectionOf(copy, "paused");
  const threadCopy = sectionOf(copy, "thread");

  return (
    <section
      data-chat-thread={state}
      aria-label={title}
      className="flex min-h-[32rem] flex-col rounded-lg border bg-card"
    >
      <div className="flex items-center gap-3 border-b p-4">
        {/*
          Below `lg` the list is hidden and this is the way back to it: a plain link to the list's own
          address, so there is no history to unwind and no client state that decides where "back" is.
        */}
        <Link
          href={listHref}
          aria-label={pageItemOf(copy, "back").label}
          className="inline-flex size-10 items-center justify-center rounded-md text-primary hover:bg-mist lg:hidden"
        >
          <svg
            className="size-5 shrink-0 rotate-180"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </Link>
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-counterparty-solid text-sm font-semibold text-white"
        >
          {otherInitials}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-primary">{title}</h2>
          {withLine === null ? null : <p className="text-xs text-muted-foreground">{withLine}</p>}
        </div>
        <span
          data-chat-thread-state={state}
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-status-line bg-status px-2.5 py-0.5 text-xs font-semibold text-foreground"
        >
          {state === "live" ? (
            <span aria-hidden className="size-1.5 rounded-full bg-accent" />
          ) : (
            <PauseCircle aria-hidden className="size-3.5 shrink-0" />
          )}
          {chatThreadStateLabel(copy, state)}
        </span>
        <Link
          href={openHref}
          className="hidden h-10 items-center rounded-md border border-input bg-background px-3 text-sm font-medium text-primary transition-colors hover:bg-mist sm:inline-flex lg:h-9"
        >
          {pageItemOf(copy, "open").label}
        </Link>
      </div>

      {state === "waiting" ? (
        <div
          data-chat-waiting="true"
          className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center"
        >
          <span
            aria-hidden="true"
            className="flex size-12 items-center justify-center rounded-full bg-mist text-primary"
          >
            <MessageSquare className="size-6 shrink-0" />
          </span>
          <h3 className="mt-3 text-base font-semibold text-primary">{waitingHeading}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{waitingBody}</p>
        </div>
      ) : (
        <ol aria-label={pageItemOf(copy, "messages").label} className="flex-1 space-y-4 p-4">
          {shown.length === 0 ? (
            <li className="text-sm text-muted-foreground">{itemLabel(threadCopy, "empty")}</li>
          ) : (
            shown.map((message) => (
              <MessageBubble
                key={message.id}
                copy={copy}
                message={message}
                tags={tags}
                alignHrefBase={alignHrefBase}
                selfInitials={selfInitials}
                otherInitials={otherInitials}
                otherName={otherName}
              />
            ))
          )}
        </ol>
      )}

      {state === "live" ? (
        <Composer
          copy={copy}
          tags={tags}
          otherName={otherName}
          onSend={({ body, aspectId }) =>
            setAppended((previous) => [
              ...previous,
              {
                id: `sent-${previous.length + 1}`,
                mine: true,
                seat: "initiator",
                body,
                aspectId,
                timeLabel: null,
              },
            ])
          }
        />
      ) : null}

      {state === "paused" ? (
        <div data-chat-paused="true" className="border-t p-4">
          <p className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-background p-3 text-sm text-foreground">
            <PauseCircle aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1">{itemLabel(pausedCopy, "read-only")}</span>
            {/*
              #1121's one action, for the Initiator and nobody else: the Counterparty's paused thread
              carries no card, no price and no word about a trial, which is the no-leak rule the
              issue puts first in its *must not* list. `payHref` is the existing checkout — the same
              door the relationship screen opens — so this is not a second payment path.
            */}
            {payHref === null ? null : (
              <Link
                href={payHref}
                data-chat-add-card="true"
                className="inline-flex h-9 shrink-0 items-center rounded-md bg-action px-3 text-sm font-medium text-action-foreground transition-colors hover:bg-action-hover"
              >
                {itemLabel(pausedCopy, "add-card")}
              </Link>
            )}
          </p>
        </div>
      ) : null}
    </section>
  );
}
