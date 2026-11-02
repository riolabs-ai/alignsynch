/**
 * lib/v1/chat.ts — the /v1 chat's thread model, all pure.
 *
 * The chat is a **view** over the relationship store, never a second messaging system. A
 * relationship's `comments` are its relationship thread; its `aspectComments` are the per-Aspect
 * threads (the BuddyBoss shape #384 asks for — connections and communication front and centre);
 * its `coachComments` are the coach's notes, folded into the relationship thread. Nothing here
 * creates, copies or stores messages: the store owns mutation (`addComment` / `addAspectComment` /
 * `addCoachComment`), and this module only projects those records into threads.
 *
 * The blind rule lives in the type, not in a runtime guard: a thread's messages are exactly the
 * comment records — `id`, `author`, `body`, `at` — and this module never reads
 * `initiatorAnswers` or `counterpartyAnswers`. An answer value cannot become a message because
 * there is no field for it and no code path that maps it. Before a session is scored the Aspect
 * thread therefore renders only the parties' discussion of the Aspect, never the counterparty's
 * response. `tests/v1-chat.test.ts` proves that on the blind fixture.
 *
 * No React, no store, no clock — `lib/v1/derive.ts` and `data/v1/fixtures.ts` are the only
 * dependencies, both client-safe, so E34 stays green.
 */
import type { V1Comment, V1Relationship } from "@/data/v1/fixtures";
import type { Persona } from "@/data/v1/fixtures";
import { relationshipNameOf, sessionCompleteOf } from "@/lib/v1/derive";

export type ChatAuthor = "initiator" | "counterparty" | "coach";

/** One chat message — a comment record, projected verbatim. No answer field exists. */
export interface ChatMessage {
  readonly id: string;
  readonly author: ChatAuthor;
  readonly body: string;
  readonly at: string;
}

export type ChatThreadKind = "relationship" | "aspect";

/** One thread in the conversation list. */
export interface ChatThread {
  /** URL-safe: `<relationshipId>` for the relationship, `<relationshipId>--<itemId>` for an Aspect. */
  readonly id: string;
  readonly kind: ChatThreadKind;
  readonly relationshipId: string;
  /** The Aspect id for an `aspect` thread, else null. */
  readonly itemId: string | null;
  /** The relationship's display name. */
  readonly title: string;
  /** The Aspect prompt for an `aspect` thread, else the relationship's display name. */
  readonly subtitle: string;
  /** The parties, copied from the relationship so a row needs no relationship lookup. */
  readonly initiatorName: string;
  readonly counterpartyName: string | null;
  readonly messages: readonly ChatMessage[];
  /** The tail message instant, or null on an empty thread. */
  readonly lastMessageAt: string | null;
}

/** The `--` separator keeps a thread id URL-safe and unambiguous (`rel-…--aspect-…`). */
export const THREAD_ID_SEPARATOR = "--";

export function threadIdOf(relationshipId: string, itemId?: string): string {
  return itemId === undefined ? relationshipId : `${relationshipId}${THREAD_ID_SEPARATOR}${itemId}`;
}

function toMessage(comment: V1Comment): ChatMessage {
  return { id: comment.id, author: comment.author, body: comment.body, at: comment.at };
}

/**
 * The relationship thread's messages: the parties' comments and the coach's notes, merged and
 * ordered by their instant. The coach note is advice left on the relationship, so it belongs in
 * the relationship thread, not in a third kind.
 */
function relationshipMessages(rel: V1Relationship): ChatMessage[] {
  const parties = rel.comments.map(toMessage);
  const coach = rel.coachComments.map(
    (note): ChatMessage => ({ id: note.id, author: "coach", body: note.body, at: note.at }),
  );
  return [...parties, ...coach].sort((a, b) => a.at.localeCompare(b.at));
}

/** Parse a thread id back into its relationship and optional Aspect, or null when it is foreign. */
export function resolveThreadId(
  rel: V1Relationship,
  threadId: string,
): { kind: "relationship" } | { kind: "aspect"; itemId: string } | null {
  if (threadId === rel.id) return { kind: "relationship" };
  if (threadId.startsWith(`${rel.id}${THREAD_ID_SEPARATOR}`)) {
    const itemId = threadId.slice(rel.id.length + THREAD_ID_SEPARATOR.length);
    if (itemId.length > 0) return { kind: "aspect", itemId };
  }
  return null;
}

/** The messages of one thread. The blind rule holds: comments only, never answer maps. */
export function messagesOf(rel: V1Relationship, threadId: string): ChatMessage[] {
  const resolved = resolveThreadId(rel, threadId);
  if (resolved === null) return [];
  if (resolved.kind === "relationship") return relationshipMessages(rel);
  return (rel.aspectComments[resolved.itemId] ?? []).map(toMessage);
}

/** Build every thread a relationship contributes — the relationship first, then one per Aspect. */
export function threadsOf(rel: V1Relationship, templateTitle: string): ChatThread[] {
  const name = relationshipNameOf(rel, templateTitle);
  const relationshipMessages_ = relationshipMessages(rel);
  const threads: ChatThread[] = [
    {
      id: rel.id,
      kind: "relationship",
      relationshipId: rel.id,
      itemId: null,
      title: name,
      subtitle: name,
      initiatorName: rel.initiatorName,
      counterpartyName: rel.counterpartyName,
      messages: relationshipMessages_,
      lastMessageAt: relationshipMessages_.at(-1)?.at ?? null,
    },
  ];
  for (const item of rel.items) {
    const messages = (rel.aspectComments[item.id] ?? []).map(toMessage);
    threads.push({
      id: threadIdOf(rel.id, item.id),
      kind: "aspect",
      relationshipId: rel.id,
      itemId: item.id,
      title: item.prompt,
      subtitle: name,
      initiatorName: rel.initiatorName,
      counterpartyName: rel.counterpartyName,
      messages,
      lastMessageAt: messages.at(-1)?.at ?? null,
    });
  }
  return threads;
}

/**
 * The blind rule, executable. A session is blind until both parties accept it
 * (`sessionCompleteOf` — the corrected hinge, not the second submission), and while it is blind a
 * thread may carry the parties' comments and the coach's notes and **nothing else**. That is why a
 * pre-scoring Aspect thread can discuss how priorities get set without showing what the other
 * person answered: `messagesOf` maps comment records only, and there is no field on `ChatMessage`
 * that an answer value could occupy.
 */
export function isBlindThread(rel: V1Relationship): boolean {
  return !sessionCompleteOf(rel);
}

/** The sentence a blind thread carries, so the rule is stated where a person reads it. */
export const BLIND_THREAD_NOTICE =
  "This session is still blind. You can discuss the Aspect here, but neither side's answers are " +
  "shown until both of you accept the session.";

/**
 * The provenance check that makes "no invented history" and "no answer content" one assertion:
 * every message body in every thread must be a comment record's body. A body with no comment
 * behind it means something other than the store wrote it — an answer map, a component literal or
 * a second messaging system. Returns the offending bodies, so an empty list is the proof.
 */
export function inventedMessagesOf(rel: V1Relationship, templateTitle: string): string[] {
  const recorded = new Set<string>([
    ...rel.comments.map((comment) => comment.body),
    ...rel.coachComments.map((note) => note.body),
    ...Object.values(rel.aspectComments).flatMap((comments) =>
      comments.map((comment) => comment.body),
    ),
  ]);
  return threadsOf(rel, templateTitle).flatMap((thread) =>
    thread.messages.map((message) => message.body).filter((body) => !recorded.has(body)),
  );
}

/** The role a persona plays in the threads they can reach, or null when they only read. */
export function authorRoleOf(persona: Persona): ChatAuthor | null {
  switch (persona) {
    case "initiator":
      return "initiator";
    case "counterparty":
      return "counterparty";
    case "coach":
      return "coach";
    default:
      return null;
  }
}

/** May this persona send a message in this thread? Coach notes go on the relationship only. */
export function canSendInThread(persona: Persona, thread: ChatThread): boolean {
  const role = authorRoleOf(persona);
  if (role === null) return false;
  if (role === "coach") return thread.kind === "relationship";
  return true;
}

/** The display name behind a message author, resolved from the thread's parties. */
export function authorNameOf(author: ChatAuthor, thread: ChatThread): string {
  if (author === "coach") return "Coach";
  if (author === "initiator") return thread.initiatorName;
  return thread.counterpartyName ?? "Counterparty";
}

/** The party a persona is *not* — the face on a relationship thread's avatar. */
export function otherPartyNameOf(persona: Persona, thread: ChatThread): string {
  if (persona === "initiator") return thread.counterpartyName ?? "Invited";
  if (persona === "counterparty") return thread.initiatorName;
  return `${thread.initiatorName} & ${thread.counterpartyName ?? "—"}`;
}

/** A persona's own role — messages from another author are inbound. */
function isOwn(role: ChatAuthor | null, message: ChatMessage): boolean {
  return role !== null && message.author === role;
}

/** Unread messages in a thread for one persona, against their last-read watermark. */
export function unreadCountOf(
  thread: ChatThread,
  persona: Persona,
  lastReadAt: string | undefined,
): number {
  const role = authorRoleOf(persona);
  if (lastReadAt === undefined) return 0;
  return thread.messages.filter((message) => !isOwn(role, message) && message.at > lastReadAt)
    .length;
}

/** The total unread across a persona's threads — the sidebar Chat badge, computed not stored. */
export function totalUnreadOf(
  threads: readonly ChatThread[],
  persona: Persona,
  readAt: Readonly<Record<string, string>>,
): number {
  return threads.reduce(
    (sum, thread) => sum + unreadCountOf(thread, persona, readAt[thread.id]),
    0,
  );
}
