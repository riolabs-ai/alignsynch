/**
 * Chat — one thread per relationship, and the messages in it (#1131).
 *
 * The v2.0 Chat surface (`docs/specs/v2-bundles/07-spec-design-page-chat-v2/`) draws a
 * conversation list and one thread per relationship, where a message may carry an **Aspect chip
 * and that Aspect's Align status**. The status is *not* this model's: it is
 * `content/gaps.ts::alignmentStatusOf` over the relationship's own answers, read on the server and
 * passed down — a stored status would be a second authored value that could drift from the numbers
 * it claims to describe, which is the same rule that forbids a `gap` column.
 *
 * ## Why the bodies are authored here and not stored
 *
 * The durable thread is **#921's** model, and that issue is an evaluation: it ships no schema, no
 * migration and no writer until the owner approves its mockup. So the messages a demo relationship
 * shows are fixtures — the same mechanism that carries every other demo row before a table exists —
 * and `data/chat-threads.ts` holds them. What is authored is only the *body*, the sender's seat and
 * the instant; the names, the Aspects and every status come from the relationship's own rows at
 * request time, so a thread can never describe a person or an Aspect this product does not have.
 *
 * **A thread is keyed on the relationship, never on a session.** A relationship has one shared chat
 * (`docs/specs/v2-bundles/07-…/chat.html`), and its rounds — sessions — are the assessment cycles
 * inside it; keying on a session would split one conversation into as many threads as there were
 * rounds.
 *
 * Pure: no React, no Next, no `fs`, no clock. `data:check` compiles this module with the rest of
 * `content/` and runs it under plain node, which is why the thread's *derivations* live next door in
 * `lib/chat/thread.ts` — this file is the schema and nothing else.
 */
import { z } from "zod";
import { zId, zIsoDateTime } from "./core";

/**
 * Which seat wrote a message. A **role**, not an account id: the screen prints "You" for the reader's
 * own seat and the other person's real name for theirs, and the same fixture therefore reads
 * correctly for both parties without being authored twice.
 */
export const CHAT_SENDERS = ["initiator", "counterparty"] as const;

export const zChatSender = z.enum(CHAT_SENDERS);

export type ChatSender = z.infer<typeof zChatSender>;

/**
 * One message.
 *
 *   sender    the seat that wrote it — see `zChatSender`
 *   body      what it says. Never a status, a money figure or a link: the thread is two people
 *             talking, and the Align status rides on the chip beside it, not in the sentence.
 *   at        the instant it was sent, as an ISO string. `data/` carries instants and the UI formats
 *             them (`content/core.ts::formatClockTime`), so no render path reads a clock.
 *   aspectId  the Aspect it was tagged with, when it was. Matched against the relationship's own
 *             Aspects at render time; an id this relationship does not have drops the chip rather
 *             than printing a raw handle.
 *   unread    the Counterparty's message has not been read by the viewer. Only ever `true` on the
 *             other seat's messages — a message you wrote is not unread to you — and the list's
 *             count is the number of these (`lib/chat/thread.ts::unreadCountOf`).
 */
export const zChatMessage = z
  .object({
    id: zId,
    sender: zChatSender,
    body: z.string().min(1).max(600),
    at: zIsoDateTime,
    aspectId: zId.optional(),
    unread: z.boolean().optional(),
  })
  .strict();

export type ChatMessage = z.infer<typeof zChatMessage>;

/**
 * One relationship's thread.
 *
 * `relationshipId` is the relationship's own id — the value `relationship.id` holds and
 * `listMyRelationships()` hands a screen, never a session record id. `scripts/db-seed.mjs` writes
 * demo relationships under a deterministic id (`relationship-<record id>`), which is what lets a
 * fixture name a demo row exactly rather than by position.
 *
 * Messages are in send order: the list renders them in the order it is given, and the rule lives in
 * the schema as a `superRefine` so a fixture that appends out of order fails at load instead of
 * showing a conversation that runs backwards.
 */
export const zChatThread = z
  .object({
    relationshipId: z.string().min(1),
    messages: z.array(zChatMessage).min(1),
  })
  .strict()
  .superRefine((thread, ctx) => {
    let previous = "";
    for (const message of thread.messages) {
      if (previous !== "" && message.at < previous) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["messages"],
          message: `message "${message.id}" is earlier than the message before it — a thread is in send order`,
        });
      }
      previous = message.at;
    }
  });

export type ChatThread = z.infer<typeof zChatThread>;

/** The collection, as `data/chat-threads.ts` parses it. */
export const zChatThreads = z.array(zChatThread);
