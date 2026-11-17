/**
 * The demo dataset's chat threads (#1131) — **bodies only**.
 *
 * The durable thread is **#921's** model, and #921 is an evaluation: no schema, no migration and no
 * writer until the owner approves its mockup. So until that lands the messages a demo relationship
 * shows are fixtures — the same mechanism every other demo row uses before its table exists — and
 * this file is that fixture.
 *
 * **What is authored here is the least a thread can be.** A body, the seat that wrote it, the
 * instant, and — when a message was tagged — the Aspect's id. Nothing else:
 *
 *   - no names — the screen prints the reader's own "You" and the other seat's **real** name from
 *     the relationship's `party` row, so one thread reads correctly for both people;
 *   - no statuses — a tag's Align status is `content/gaps.ts::alignmentStatusOf` over the pair's own
 *     answers at request time (`lib/chat/thread.ts::chatAspectTagsOf`), never authored;
 *   - no state — waiting, paused and live are derived from the relationship's own rows, so nothing
 *     here can put a thread into a state the product does not support;
 *   - no claims about the other person's answers. Under the blind rule a message that quoted them
 *     would be the leak the chat surface must not make, and a fixture cannot know whether the pair
 *     has finished.
 *
 * **The key is the relationship's id, and only a demo row has one of these.** `scripts/db-seed.mjs`
 * writes every demo relationship under a deterministic id, `relationship-<record id>`, from
 * `data/assessments.ts`'s four hand-authored instances — so an entry here names exactly the row the
 * demo branch holds, and a relationship nobody authored (every relationship a person creates) has no
 * entry and draws the thread's own empty state. That is the honest shape: chat works for any
 * relationship, and only the demo dataset has something to say in it so far.
 */
import { zChatThreads, type ChatThread } from "../content/chat";

/** The id `scripts/db-seed.mjs` writes for one demo instance's relationship. */
function demoRelationshipId(instanceId: string): string {
  return `relationship-${instanceId}`;
}

export const chatThreads: readonly ChatThread[] = zChatThreads.parse([
  /**
   * Avery and Rowan — the feature example (`assessment-instance-avery-rowan`). Two tagged messages
   * on the Aspects Align draws, one of them Rowan's and still unread, so the list's badge has a
   * number on the demo branch without anything being invented for it.
   */
  {
    relationshipId: demoRelationshipId("assessment-instance-avery-rowan"),
    messages: [
      {
        id: "chat-avery-rowan-1",
        sender: "counterparty",
        body: "I read through the five Aspects. The one I keep coming back to is how the week actually splits.",
        at: "2026-10-28T19:02:00.000Z",
        aspectId: "aspect-housework",
      },
      {
        id: "chat-avery-rowan-2",
        sender: "initiator",
        body: "Same. I would rather work out what we both mean before we change anything.",
        at: "2026-10-28T19:14:00.000Z",
        aspectId: "aspect-housework",
      },
      {
        id: "chat-avery-rowan-3",
        sender: "counterparty",
        body: "Then let us start with Tuesday and Thursday. Ten minutes, no more than that.",
        at: "2026-10-28T19:26:00.000Z",
        unread: true,
      },
    ],
  },
  /**
   * Ruth and Sam — the agreement case: every Gap is 0, so a tag on this thread reads *In Synch* and
   * proves the chip follows the numbers rather than a mood.
   */
  {
    relationshipId: demoRelationshipId("assessment-instance-ruth-sam"),
    messages: [
      {
        id: "chat-ruth-sam-1",
        sender: "initiator",
        body: "Nothing in this surprised me, which is its own kind of useful.",
        at: "2026-10-27T08:20:00.000Z",
      },
      {
        id: "chat-ruth-sam-2",
        sender: "counterparty",
        body: "Agreed. Keeping the check-in where it is seems to be doing the work.",
        at: "2026-10-27T08:31:00.000Z",
        aspectId: "aspect-check-ins",
      },
    ],
  },
  /**
   * Marco and Priya — the disagreement case: the widest Feel Gap on these Aspects is 4, so a tag
   * here draws *Gap* with the flag rather than a colour.
   */
  {
    relationshipId: demoRelationshipId("assessment-instance-marco-priya"),
    messages: [
      {
        id: "chat-marco-priya-1",
        sender: "counterparty",
        body: "I want to talk about the workload one before it becomes a bigger thing than it is.",
        at: "2026-10-26T17:05:00.000Z",
        aspectId: "aspect-workload",
      },
      {
        id: "chat-marco-priya-2",
        sender: "initiator",
        body: "Fair. Give me until Thursday to read it properly and then let us sit down with it.",
        at: "2026-10-26T17:22:00.000Z",
        aspectId: "aspect-workload",
      },
      {
        id: "chat-marco-priya-3",
        sender: "counterparty",
        body: "Thursday works.",
        at: "2026-10-26T17:40:00.000Z",
        unread: true,
      },
    ],
  },
  /**
   * Noor and Iris — Advanced Mode, on Full tolerance. The tag names an Aspect both sheets answered,
   * so a status exists; under Full a 1-step Gap keeps its word and takes the Gap's colour.
   */
  {
    relationshipId: demoRelationshipId("assessment-instance-noor-iris"),
    messages: [
      {
        id: "chat-noor-iris-1",
        sender: "initiator",
        body: "Privacy is the one I guessed wrong on. I would like to hear how you read it.",
        at: "2026-10-29T10:05:00.000Z",
        aspectId: "aspect-privacy",
      },
      {
        id: "chat-noor-iris-2",
        sender: "counterparty",
        body: "Later today, once the house is quiet.",
        at: "2026-10-29T10:18:00.000Z",
      },
    ],
  },
]);

/**
 * One relationship's thread, or `undefined` when the demo dataset says nothing about it.
 *
 * An exact key, never a prefix: a relationship id is opaque and two of them can differ by one
 * character, so a "closest match" here would attach one pair's conversation to another pair's row.
 */
export function chatThreadFor(relationshipId: string): ChatThread | undefined {
  return chatThreads.find((thread) => thread.relationshipId === relationshipId);
}
