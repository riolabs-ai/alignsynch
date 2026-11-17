// template-ancestor: components/dashboard/relationships-list.tsx   (variation: the same member rows as a conversation list — a 20rem sidebar of one-line threads instead of a card grid, where the *address* is the selection (`?relationship=`) rather than a per-row link to a detail page, and each row's third line is the state the thread is in)

/**
 * The conversation list — `/dashboard/chat`'s left pane (#1131).
 *
 * The v2 bundle's list (`docs/specs/v2-bundles/07-spec-design-page-chat-v2/chat.html`): a search, then
 * one row per relationship carrying the other person's mark, the relationship's title, the last line
 * said, the time, an unread count and — when the thread is not live — a paused chip.
 *
 * **The row is a link and the URL is the selection.** `?relationship=<id>` opens a thread, so a click
 * is a GET, the back button works, a `curl` can ask for one, and the row needs no client state. The
 * current row carries `aria-current="page"`, which is also what paints it.
 *
 * **Search is the URL too** (`?q=`), like the templates shelf: the form is a GET, the filter is a
 * substring match over the relationship's own title and the other party's name, and the page applies
 * it — this component draws only the rows it is handed. A list that filtered in the browser would
 * disagree with the URL the reader can copy.
 *
 * **A server component.** It holds no state and no handler; the only interactive thing on this pane
 * is the form, which is markup. The words come from `data/pages/chat.ts` (E23, budget 0), and the
 * state chip's label is *given*, so this file never re-derives a state name.
 *
 * There is no shadow: elevation on this tree is a border (`AGENTS.md`, C1 — `Card` carries none), so
 * the bundle's `shadow-sm` on the two panes is drawn as `border bg-card` and nothing more.
 */
import { MessageSquare, PauseCircle, Search } from "lucide-react";
import Link from "next/link";

import type { PageCopy } from "@/content/pages";
import { chatThreadStateLabel } from "@/lib/chat/copy";
import type { ChatThreadState } from "@/lib/chat/thread";
import { chatThreadPath } from "@/lib/flow/paths";
import { fillLabel, itemLabel, pageItemOf, sectionOf } from "@/lib/page-copy";
import { cn } from "@/lib/utils";

/** One row of the list, as the page hands it over. Every string is already authored or derived. */
export interface ChatConversationRow {
  readonly relationshipId: string;
  /** The relationship's own title — `relationship.title`, never the template's. */
  readonly title: string;
  /** The other seat's name: the name printed in the thread header and in the preview line. */
  readonly otherName: string;
  /** Two letters for the mark, from the other seat's name. */
  readonly initials: string;
  readonly state: ChatThreadState;
  /** The last thing said, or the waiting sentence — one line, truncated by CSS. */
  readonly preview: string;
  /** The last message's clock date, or `null` for a thread with nothing in it yet. */
  readonly timeLabel: string | null;
  /** How many of the other party's messages this reader has not opened. */
  readonly unread: number;
}

/**
 * The other seat's mark.
 *
 * A live thread's mark is filled in the party's solid tone; a thread that is waiting or paused draws
 * the tinted, ringed version, which is the bundle's own difference between "here now" and "not yet".
 * `aria-hidden`, because the name beside it is the accessible fact and a pair of initials read aloud
 * is noise.
 */
function ConversationMark({
  initials,
  state,
}: {
  readonly initials: string;
  readonly state: ChatThreadState;
}) {
  const filled = state === "live";
  return (
    <span
      aria-hidden="true"
      data-chat-mark={state}
      className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
        filled
          ? "bg-counterparty-solid text-white"
          : "bg-counterparty-tint text-counterparty-ink ring-1 ring-inset ring-counterparty-line"
      }`}
    >
      {initials}
    </span>
  );
}

export function ChatConversationList({
  copy,
  rows,
  selectedId,
  query,
}: {
  readonly copy: PageCopy;
  readonly rows: readonly ChatConversationRow[];
  readonly selectedId: string | null;
  readonly query: string;
}) {
  const listCopy = sectionOf(copy, "list");
  const searchLabel = itemLabel(listCopy, "search-label");
  const searchPlaceholder = pageItemOf(copy, "search").label;

  return (
    <section
      data-chat-list="true"
      aria-labelledby="chat-conversations"
      className={cn("rounded-lg border bg-card", selectedId === null ? null : "hidden lg:block")}
    >
      <div className="space-y-3 border-b p-4">
        <h2 id="chat-conversations" className="text-base font-semibold text-primary">
          {listCopy.heading}
        </h2>
        {/*
          A GET form, so the search is the URL: `?q=` survives a reload, a bookmark and a `curl`, and
          the list is filtered on the server by the same read that drew it.
        */}
        <search>
          <form action="" method="get">
            <label className="relative block">
              <span className="sr-only">{searchLabel}</span>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder={searchPlaceholder}
                className="flex h-11 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-10"
              />
            </label>
          </form>
        </search>
      </div>

      {rows.length === 0 ? (
        <p
          data-chat-list-empty={query === "" ? "none" : "query"}
          className="p-4 text-sm text-muted-foreground"
        >
          {query === ""
            ? itemLabel(listCopy, "no-messages")
            : fillLabel(itemLabel(listCopy, "no-match"), { query })}
        </p>
      ) : (
        <ul className="space-y-0.5 p-2">
          {rows.map((row) => {
            const current = row.relationshipId === selectedId;
            return (
              <li key={row.relationshipId}>
                <Link
                  href={chatThreadPath(row.relationshipId)}
                  aria-current={current ? "page" : undefined}
                  data-chat-row={row.state}
                  className="flex gap-3 rounded-md p-3 transition-colors hover:bg-mist aria-[current=page]:bg-mist aria-[current=page]:ring-1 aria-[current=page]:ring-inset aria-[current=page]:ring-line"
                >
                  <ConversationMark initials={row.initials} state={row.state} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {row.title}
                      </span>
                      {row.timeLabel === null ? null : (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {row.timeLabel}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="truncate text-sm text-muted-foreground">{row.preview}</span>
                      {row.unread === 0 ? null : (
                        <span
                          data-chat-unread={row.unread}
                          className="flex size-5 shrink-0 items-center justify-center rounded-full bg-action text-xs font-semibold text-action-foreground"
                        >
                          <span aria-hidden="true">{row.unread}</span>
                          <span className="sr-only">
                            {fillLabel(pageItemOf(copy, "unread").label, { count: row.unread })}
                          </span>
                        </span>
                      )}
                    </span>
                    {row.state === "live" ? null : (
                      <span className="mt-1 inline-flex">
                        <span
                          data-chat-state={row.state}
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-line bg-background px-2.5 py-0.5 text-xs font-semibold text-foreground"
                        >
                          <PauseCircle aria-hidden="true" className="size-3.5 shrink-0" />
                          {chatThreadStateLabel(copy, row.state)}
                        </span>
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * The pane beside the list when nothing is open — "Pick a Conversation".
 *
 * Hidden below `lg`, exactly as the bundle hides it: on a phone the list is the whole screen until a
 * row is tapped, and an empty pane under a list would be a scroll to nowhere.
 */
export function ChatPickConversation({ copy }: { readonly copy: PageCopy }) {
  const pick = sectionOf(copy, "pick");
  return (
    <section
      data-chat-pick="true"
      aria-label={pick.heading}
      className="hidden flex-col items-center justify-center rounded-lg border border-dashed border-line bg-card px-4 py-16 text-center lg:flex"
    >
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full bg-status-chip text-deep-calm"
      >
        <MessageSquare className="size-6 shrink-0" />
      </span>
      <h2 className="mt-3 text-lg font-semibold text-primary">{pick.heading}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{pick.body}</p>
    </section>
  );
}
