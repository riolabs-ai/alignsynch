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
   * Avery and Rowan, the open relationship (`assessment-instance-avery-rowan-flat`).
   *
   * **Which relationship is why this entry exists, not the wording.** `chat-and-discussion`'s
   * register row (`docs/specs/v2-rectification.md`) photographs
   * `relationship-assessment-instance-avery-rowan-flat?tab=discussion`, and that is the demo
   * relationship that is still running: `relationship-assessment-instance-avery-rowan` is `complete`,
   * so its Discussion is read-only and can only ever photograph the closed band. A demo thread on the
   * running row is what makes the Discussion tab show a conversation, and the sentence below promises
   * nothing about either person's answers — the blind rule holds.
   */
  {
    relationshipId: demoRelationshipId("assessment-instance-avery-rowan-flat"),
    messages: [
      {
        id: "chat-avery-rowan-flat-1",
        sender: "counterparty",
        body: "I read through the five Aspects. The one I keep coming back to is how the week actually splits.",
        at: "2026-10-21T19:02:00.000Z",
        aspectId: "aspect-housework",
      },
      {
        id: "chat-avery-rowan-flat-2",
        sender: "initiator",
        body: "Same. I would rather work out what we both mean before we change anything.",
        at: "2026-10-21T19:14:00.000Z",
        aspectId: "aspect-housework",
      },
      {
        id: "chat-avery-rowan-flat-3",
        sender: "counterparty",
        body: "Then let us start with Tuesday and Thursday. Ten minutes, no more than that.",
        at: "2026-10-21T19:26:00.000Z",
        unread: true,
      },
    ],
  },
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
  {
    /**
     * Rowan and Avery — the review relationship, and the second thread the **Counterparty**
     * account can open. `rowan-avery-review` is `published` with Rowan initiating, so the
     * relationship-detail Discussion tab is live for both seats and the unread message is Rowan's
     * — the seat that is not the reader.
     */
    relationshipId: demoRelationshipId("assessment-instance-rowan-avery-review"),
    messages: [
      {
        id: "chat-rowan-avery-review-1",
        sender: "initiator",
        body: "Before Thursday: the sheet is not a verdict on you, and I want to be clear about that first.",
        at: "2026-10-19T17:12:00.000Z",
        aspectId: "shared-context",
      },
      {
        id: "chat-rowan-avery-review-2",
        sender: "counterparty",
        body: "I read it that way. The one I want to talk through is credit — I do not think it is as even as the number says.",
        at: "2026-10-20T08:40:00.000Z",
        aspectId: "credit",
      },
      {
        id: "chat-rowan-avery-review-3",
        sender: "initiator",
        body: "Fair. Let us take that one first and leave the rest for the next round.",
        at: "2026-10-20T09:02:00.000Z",
        unread: true,
      },
    ],
  },
  /**
   * Avery and Rowan — the **complete** relationship, kept on purpose. A finished relationship's
   * Discussion is read-only, so this thread is what the closed band draws: a conversation that
   * happened, with no composer over it.
   */
  {
    relationshipId: demoRelationshipId("assessment-instance-avery-rowan-summer"),
    messages: [
      {
        id: "chat-avery-rowan-summer-1",
        sender: "initiator",
        body: "Summer is the one I keep re-reading. We agreed on the rules and disagreed on how much notice they get.",
        at: "2026-09-29T19:15:00.000Z",
        aspectId: "aspect-house-rules",
      },
      {
        id: "chat-avery-rowan-summer-2",
        sender: "counterparty",
        body: "And we settled it by writing the notice down, which is why it stopped being a fight.",
        at: "2026-09-29T19:38:00.000Z",
        aspectId: "aspect-house-rules",
      },
    ],
  },
  /**
   * Kenji and Rosa — a **seven-Aspect** sheet (`co-founders`), so a tag here names an Aspect the
   * five-Aspect templates do not have. Two messages, both about the two rows they disagree on.
   */
  {
    relationshipId: demoRelationshipId("assessment-instance-kenji-rosa-company"),
    messages: [
      {
        id: "chat-kenji-rosa-company-1",
        sender: "initiator",
        body: "The money one is why I wanted to do this. I would rather we say it out loud than keep assuming.",
        at: "2026-10-17T18:05:00.000Z",
        aspectId: "cofounder-money",
      },
      {
        id: "chat-kenji-rosa-company-2",
        sender: "counterparty",
        body: "Agreed — and the exit, too. Neither of us has written anything down about it.",
        at: "2026-10-17T18:22:00.000Z",
        aspectId: "cofounder-exit",
      },
    ],
  },
  /**
   * Milo and Ines — a **six-Aspect** sheet (`spouses`). The conversation is about the one row with
   * a real Gap on it, so the chip beside the message carries a Gap rather than In Synch.
   */
  {
    relationshipId: demoRelationshipId("assessment-instance-milo-ines-marriage"),
    messages: [
      {
        id: "chat-milo-ines-marriage-1",
        sender: "counterparty",
        body: "The household one is not really about the list. It is about who notices the list needs doing.",
        at: "2026-10-14T07:40:00.000Z",
        aspectId: "household-load",
      },
      {
        id: "chat-milo-ines-marriage-2",
        sender: "initiator",
        body: "That is fair, and I had not read it that way at all.",
        at: "2026-10-14T08:05:00.000Z",
        aspectId: "household-load",
      },
      {
        id: "chat-milo-ines-marriage-3",
        sender: "counterparty",
        body: "Then let us look at it together on Sunday, before the week starts.",
        at: "2026-10-14T08:12:00.000Z",
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
