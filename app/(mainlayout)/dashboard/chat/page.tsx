/**
 * `/dashboard/chat` — one thread per relationship (#1131).
 *
 * **The AlignSynch build's chat, not the quiz product's.** `/chat` is gated to the quiz brand
 * (`requireQuizProduct`, #300) and its conversations are that product's; this route lists the
 * relationships the reader is a party to and draws the v2 Chat surface over them
 * (`docs/specs/v2-bundles/07-spec-design-page-chat-v2/`). `lib/flow/paths.ts::CHAT_PATH` carries the
 * decision, and the rail's Chat row points here.
 *
 * ## Two reads, and neither takes an id from the request
 *
 *   `listMyRelationships(userId)`   the threads: every relationship the viewer is a party to, with
 *                                   the seat, the invitation, the membership and the connection
 *                                   already derived on the row. The viewer's id comes from the
 *                                   session, never from the URL.
 *   `readRelationshipById(id, …)`   only for the thread that is open: the gated projection, which
 *                                   is where the Aspects and the report come from. A request that
 *                                   names somebody else's relationship resolves to `undefined` and
 *                                   answers 404 — the same answer the relationship screen gives.
 *
 * ## Every state is derived, never a query switch
 *
 * `?relationship=<id>` selects a thread. It does **not** select a state: `chatThreadStateOf()` reads
 * `connectionOf()`'s "is the pair both in" and `pauseOf()`'s "did the trial lapse" (#1121), so a
 * waiting thread says when chat opens, a paused one is read-only with the Initiator's one action, and
 * everything else is live. The bundle is explicit that the prototype's `?role=` and `?state=` are
 * review tools; there is no equivalent here, and both roles render from the same row.
 *
 * **A closed relationship has no thread.** `complete` and `void` are decisions, not a pause, and the
 * bundle draws no fourth state — so those rows are left out of the list rather than drawn as paused.
 * The relationship screen owns what a closed relationship says.
 *
 * ## What the thread shows and what it does not
 *
 * A message can carry an Aspect chip and, beside it, that Aspect's Align status
 * (`chatAspectTagsOf`). The status exists only once both parties have accepted — the blind rule —
 * and clicking the pair opens the Aspect **on Align** (`instancePath()` + the card's anchor). The
 * composer appends what the reader sends to this session and writes nothing durable: the thread
 * model is #921's, that issue has not been approved for a schema, so `data/chat-threads.ts` holds the
 * demo bodies and the write is stated as absent rather than faked. That is the one known limit of
 * this surface, and it is on the issue and the PR.
 *
 * `force-dynamic` for the reasons every gated console route carries: per-request session, database
 * reads, and a `pnpm build` that must pass with no `DATABASE_URL`.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StageColumn } from "@/components/assessment-flow/stage-column";
import {
  ChatConversationList,
  ChatPickConversation,
  type ChatConversationRow,
} from "@/components/chat/conversation-list";
import { ChatThread, type ChatThreadMessageView } from "@/components/chat/thread";
import type { ChatMessage, ChatThread as ChatThreadRecord } from "@/content/chat";
import {
  dayDelta,
  formatClockTime,
  formatDate,
  formatMonthDay,
  formatWeekdayShort,
} from "@/content/core";
import type { PageCopySection } from "@/content/pages";
import { chatThreadFor } from "@/data/chat-threads";
import { chatPageCopy } from "@/data/pages/chat";
import { requireRole } from "@/lib/auth/require-role";
import {
  chatAspectTagsOf,
  chatMessageIsMine,
  chatMessagesOf,
  chatThreadStateOf,
  type ChatAspectTag,
  type ChatThreadState,
  unreadCountOf,
} from "@/lib/chat/thread";
import { readRelationshipById } from "@/lib/db/assessments";
import { DatabaseUnavailableError } from "@/lib/db/client";
import { CHAT_PATH, createInviteForPath, instancePath, relationshipPath } from "@/lib/flow/paths";
import { listMyRelationships, type MemberRelationshipRow } from "@/lib/member/relationships";
import { fillLabel, itemLabel, pageItemOf, sectionOf } from "@/lib/page-copy";
import { pauseOf } from "@/lib/relationship/pause";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: chatPageCopy.heading,
  robots: { index: false, follow: false },
};

type ChatParams = {
  readonly relationship?: string | string[];
  readonly q?: string | string[];
};

/** One query value as the string a person typed. A repeated key takes the first entry. */
function queryOf(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : (value?.[0] ?? "");
}

/**
 * Up to two letters for a person's mark — the bundle's avatar, without a stored image.
 *
 * A name with one word gives one letter; an empty name gives `?` rather than nothing, because a mark
 * with no glyph in it is a hole in the row.
 */
function initialsOf(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word !== "");
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "";
  const initials = `${first}${last}`.toUpperCase();
  return initials === "" ? "?" : initials;
}

/**
 * The state one row's thread is in.
 *
 * **`connected`** is `Connection.connected` (`lib/relationship/membership.ts`) — both seats bound to
 * an account and a session open. A row literal written before that field existed carries no
 * `connection`, and the fallback is the invitation's own fact (`invite.claimed`) rather than a guess:
 * a relationship whose invitation was claimed has two seats in it, and one that never had an
 * invitation has not been sent yet.
 *
 * **`paused`** is `pauseOf()`'s answer, and only its `paused` flag is read here: chat draws no
 * countdown and offers no extension, so the window's end and the free week's claim are not facts this
 * surface needs. The membership itself is `membershipOf()`'s, already derived on the row — this
 * function never re-asks whether the pair may write.
 */
function threadStateOf(row: MemberRelationshipRow, now: Date): ChatThreadState {
  const connected = row.connection?.connected ?? row.invite?.claimed === true;
  const pause = pauseOf({
    membership: row.membership,
    endsAt: null,
    trialExtendedAt: null,
    now,
  });
  return chatThreadStateOf({ connected, paused: pause.paused });
}

/** The other seat's name, as the row knows it, falling back to the fixture's word. */
function otherNameOf(row: MemberRelationshipRow, fallback: string): string {
  if (row.viewerRole === "initiator") {
    return row.counterpartySeatName ?? row.counterpartyName ?? fallback;
  }
  return row.initiatorName ?? fallback;
}

/** The last line the list shows for a thread: the newest message's body, or the waiting sentence. */
function previewOf(input: {
  readonly state: ChatThreadState;
  readonly thread: ChatThreadRecord | undefined;
  readonly otherName: string;
  readonly listCopy: PageCopySection;
}): string {
  if (input.state === "waiting") {
    return fillLabel(itemLabel(input.listCopy, "waiting-line"), { name: input.otherName });
  }
  const messages = input.thread === undefined ? [] : chatMessagesOf(input.thread);
  const last = messages[messages.length - 1];
  return last === undefined ? itemLabel(input.listCopy, "no-messages") : last.body;
}

/** A message's clock label, formatted from the fixture instant — never from a render-time clock. */
function messageTimeLabel(at: string): string {
  return `${formatWeekdayShort(at)} ${formatClockTime(at)}`;
}

/**
 * The list row's own time: the clock while it is the reader's own UTC day, the month and day once it
 * is not — the bundle's two shapes (`9:42`, `Nov 14`). `dayDelta` is the repo's own comparison, and
 * `now` is the request's instant handed in as an argument rather than read here.
 */
function rowClockLabel(at: string, now: Date): string {
  return dayDelta(at, now.toISOString()) === 0 ? formatClockTime(at) : formatMonthDay(at);
}

/** One message of the open thread, as the thread component draws it. */
function messageView(
  message: ChatMessage,
  viewerRole: MemberRelationshipRow["viewerRole"],
): ChatThreadMessageView {
  return {
    id: message.id,
    mine: chatMessageIsMine(message, viewerRole),
    seat: message.sender,
    body: message.body,
    aspectId: message.aspectId ?? null,
    timeLabel: messageTimeLabel(message.at),
  };
}

export default async function ChatPage({ searchParams }: { searchParams: Promise<ChatParams> }) {
  const { user } = await requireRole("member", { next: CHAT_PATH });
  const params = await searchParams;
  const copy = chatPageCopy;
  const listCopy = sectionOf(copy, "list");
  const query = queryOf(params.q).trim();
  const selectedParam = queryOf(params.relationship);
  const now = new Date();

  let rows: readonly MemberRelationshipRow[] = [];
  let unreadable: string | null = null;
  try {
    rows = await listMyRelationships(user.userId, now);
  } catch (error) {
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    console.error("member-chat: the conversations could not be read", error);
    unreadable = error.reason;
  }

  const unnamed = pageItemOf(copy, "unnamed").label;
  const open = rows.filter((row) => row.membership.state !== "closed");

  const threads = open.map((row) => {
    const state = threadStateOf(row, now);
    const thread = chatThreadFor(row.id);
    const messages = thread === undefined ? [] : chatMessagesOf(thread);
    const last = messages[messages.length - 1];
    const otherName = otherNameOf(row, unnamed);
    const conversation: ChatConversationRow = {
      relationshipId: row.id,
      title: row.title,
      otherName,
      initials: initialsOf(otherName),
      state,
      preview: previewOf({ state, thread, otherName, listCopy }),
      timeLabel: last === undefined ? null : rowClockLabel(last.at, now),
      unread: thread === undefined ? 0 : unreadCountOf(thread, row.viewerRole),
    };
    return { row, conversation, thread, state };
  });

  const conversations = threads.map((each) => each.conversation);
  const filtered =
    query === ""
      ? conversations
      : conversations.filter((each) => {
          const haystack = `${each.title} ${each.otherName}`.toLowerCase();
          return haystack.includes(query.toLowerCase());
        });

  const selected =
    selectedParam === "" ? undefined : threads.find((each) => each.row.id === selectedParam);
  if (selectedParam !== "" && selected === undefined) notFound();

  let threadNode = <ChatPickConversation copy={copy} />;
  if (selected !== undefined) {
    const { row, state } = selected;
    const detail =
      state === "waiting"
        ? undefined
        : await readRelationshipById(row.id, { viewerUserId: user.userId, now });
    if (state !== "waiting" && detail === undefined) notFound();
    const screen = detail?.screen;

    const viewerName =
      screen === undefined || screen.viewer.name === ""
        ? user.name === ""
          ? (user.email.split("@")[0] ?? "")
          : user.name
        : screen.viewer.name;
    const otherName = otherNameOf(row, unnamed);

    const tags: readonly ChatAspectTag[] =
      screen === undefined
        ? []
        : chatAspectTagsOf({
            report: screen.report,
            aspects: screen.aspects.map((aspect) => ({
              itemId: aspect.itemId,
              prompt: aspect.prompt,
            })),
          });

    const messages = (selected.thread === undefined ? [] : chatMessagesOf(selected.thread)).map(
      (message) => messageView(message, row.viewerRole),
    );

    const waitingCopy = sectionOf(copy, "waiting");
    const waitingBody =
      row.invite === null
        ? itemLabel(waitingCopy, "not-sent")
        : fillLabel(itemLabel(waitingCopy, "invited"), {
            instant: formatDate(row.invite.expiresAt.toISOString()),
          });

    threadNode = (
      <ChatThread
        copy={copy}
        title={row.title}
        otherName={otherName}
        otherInitials={initialsOf(otherName)}
        selfInitials={initialsOf(viewerName)}
        state={state}
        messages={messages}
        tags={tags}
        alignHrefBase={
          screen === undefined ? relationshipPath(row.id) : instancePath(screen.instanceRecordId)
        }
        withLine={
          otherName === unnamed
            ? null
            : fillLabel(pageItemOf(copy, "with").label, { name: otherName })
        }
        listHref={CHAT_PATH}
        openHref={relationshipPath(row.id)}
        payHref={
          state === "paused" && row.isInitiator && screen !== undefined
            ? createInviteForPath(row.templateSlug, screen.instanceRecordId)
            : null
        }
        waitingHeading={fillLabel(waitingCopy.heading ?? "", { name: otherName })}
        waitingBody={waitingBody}
      />
    );
  }

  const unreadableCopy = sectionOf(copy, "unreadable");
  const emptyCopy = sectionOf(copy, "empty");

  return (
    <StageColumn>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight text-primary">{copy.heading}</h1>

        {unreadable !== null ? (
          <section data-chat-unreadable="true" className="rounded-lg border bg-card p-4">
            <h2 className="text-base font-semibold text-primary">{unreadableCopy.heading}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {fillLabel(unreadableCopy.body ?? "", { reason: unreadable })}
            </p>
          </section>
        ) : conversations.length === 0 ? (
          <section
            data-chat-empty="true"
            aria-labelledby="chat-empty-heading"
            className="rounded-lg border border-dashed border-line bg-card p-8 text-center"
          >
            <h2 id="chat-empty-heading" className="text-lg font-semibold text-primary">
              {emptyCopy.heading}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{emptyCopy.body}</p>
            {emptyCopy.cta === undefined ? null : (
              <Link
                href={emptyCopy.cta.href}
                className="mt-4 inline-flex h-9 items-center rounded-md bg-action px-3 text-sm font-medium text-action-foreground transition-colors hover:bg-action-hover"
              >
                {emptyCopy.cta.label}
              </Link>
            )}
          </section>
        ) : (
          <div
            className="grid grid-cols-1 gap-4 lg:grid-cols-shell lg:items-start"
            data-chat="true"
          >
            <ChatConversationList
              copy={copy}
              rows={filtered}
              selectedId={selected?.row.id ?? null}
              query={query}
            />
            <div className="min-w-0">{threadNode}</div>
          </div>
        )}
      </div>
    </StageColumn>
  );
}
