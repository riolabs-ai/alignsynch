/**
 * Chat v2 (#1131) — one thread per relationship, Aspect-tagged messages that carry their status.
 *
 * The issue's acceptance is a claim about a screen, so the render cases draw the real
 * `ChatThread` over a real `projectScreen()` projection and the real demo fixture, and read the
 * markup. What is pinned here is exactly the part that could drift:
 *
 *   state      the three states are a function of two facts (`connected`, `paused`) and are asked
 *              in one order — not-connected is *waiting* even when a pause also reads true, because
 *              an unjoined relationship has no trial to lapse;
 *   status     a tag's Align status is `alignmentStatusOf()` over the Aspect's widest cross-party
 *              Gap, so the same numbers move the word when the tolerance moves, and a 1-step Gap
 *              keeps "Small Gap" under Full with the tighter qualifier;
 *   blind      with no report (both parties have not accepted) every tag is `null` — the chip
 *              carries the Aspect's name and nothing else;
 *   unread     a message the reader wrote is never counted unread to them;
 *   render     live draws the composer and the tags, waiting draws the sentence and no composer,
 *              paused draws the read-only band and the Initiator's one action — and the
 *              Counterparty's paused thread carries no card at all;
 *   anchor     a chip's link is the Aspect's own anchor on the Align surface, so the door lands on
 *              the Aspect the message named.
 *
 * No database and no server: the rows are `lib/db/rows.ts` shapes, exactly as
 * `tests/alignment-view.test.tsx` builds them.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ChatThread, type ChatThreadMessageView } from "@/components/chat/thread";
import type { AlignmentSetting, Assessment, PartyRole } from "@/content/assessment";
import type { ChatSender, ChatThread as ChatThreadRecord } from "@/content/chat";
import { assessmentSessionPageCopy } from "@/data/pages/assessment-instance";
import { chatThreadFor } from "@/data/chat-threads";
import { chatPageCopy } from "@/data/pages/chat";
import { assessments } from "@/data/assessments";
import type { ItemRow, OpinionRow, PartyRow } from "@/lib/db/rows";
import {
  aspectGapOf,
  chatAspectTagsOf,
  chatMessageIsMine,
  chatMessagesOf,
  chatThreadStateOf,
  chatThreadWritable,
  unreadCountOf,
} from "@/lib/chat/thread";
import { projectScreen, type FlowSessionRows } from "@/lib/flow/screen";

const template: Assessment = (() => {
  const found = assessments.find((entry) => entry.id === "assessment-relationship-basics");
  if (found === undefined) throw new Error("the chat test's template fixture is missing");
  return found;
})();

const INSTANCE_ID = "session-chat-v2";
const RELATIONSHIP_ID = `relationship-${INSTANCE_ID}`;
const ACCEPTED_AT = new Date("2026-11-08T09:00:00.000Z");
const ASPECTS = template.items.length;

const items: ItemRow[] = template.items.map((item, position) => ({
  record_id: INSTANCE_ID,
  item_id: item.id,
  position,
  prompt: item.prompt,
  scale_kind: "score",
  left_value: item.leftValue,
  right_value: item.rightValue,
}));

const parties: PartyRow[] = [
  { session_record_id: INSTANCE_ID, role: "initiator", name: "Avery", accepted_at: ACCEPTED_AT },
  { session_record_id: INSTANCE_ID, role: "counterparty", name: "Rowan", accepted_at: ACCEPTED_AT },
];

/**
 * One opinion row per Aspect, Feel compared and Wish equal:
 *
 *   aspect[0]   Feel 2 against 3 — a Gap of **1**, the row the tolerance re-reads
 *   aspect[1]   Feel 1 against 5 — a Gap of **4**
 *   the rest    equal answers — In Synch
 */
function opinionsFor(role: PartyRole): OpinionRow[] {
  const feel: Record<number, [number, number]> = {
    0: [2, 3],
    1: [1, 5],
  };
  return template.items.map((item, position) => {
    const pair = feel[position] ?? [4, 4];
    return {
      session_record_id: INSTANCE_ID,
      role,
      item_id: item.id,
      feel: role === "initiator" ? pair[0] : pair[1],
      wish: 4,
      think: null,
      guess: null,
    };
  });
}

function screenWith(setting: AlignmentSetting = "soft") {
  const rows: FlowSessionRows = {
    record: {
      id: INSTANCE_ID,
      slug: "relationship-basics-chat",
      record_type: "assessment",
      status: "draft",
      date: new Date("2026-11-08T09:00:00.000Z"),
      title: template.title,
      summary: "answered by Avery and Rowan",
    },
    items,
    options: [],
    session: {
      record_id: INSTANCE_ID,
      template_record_id: template.id,
      relationship_id: RELATIONSHIP_ID,
      mode: "basic",
      setting,
    },
    parties,
    opinions: [...opinionsFor("initiator"), ...opinionsFor("counterparty")],
    answerCounts: { initiator: ASPECTS, counterparty: ASPECTS },
  };
  return projectScreen({ rows, template, viewerRole: "initiator", invite: null });
}

const soft = screenWith("soft");
const full = screenWith("full");

const tagsOf = (screen: ReturnType<typeof screenWith>) =>
  chatAspectTagsOf({ report: screen.report, aspects: screen.aspects });

const softTags = tagsOf(soft);
const fullTags = tagsOf(full);

const step1 = template.items[0]?.id ?? "";
const step4 = template.items[1]?.id ?? "";

describe("chat v2 — the thread's state is derived, never a switch", () => {
  it("reads waiting when the pair is not both in, whatever the trial says", () => {
    expect(chatThreadStateOf({ connected: false, paused: false })).toBe("waiting");
    // An unjoined relationship has no trial to lapse, so a pause alongside "not connected" is not
    // reachable through the page — and if it ever is, the state with an action wins.
    expect(chatThreadStateOf({ connected: false, paused: true })).toBe("waiting");
  });

  it("reads paused only when the pair is in and the membership lapsed", () => {
    expect(chatThreadStateOf({ connected: true, paused: true })).toBe("paused");
    expect(chatThreadStateOf({ connected: true, paused: false })).toBe("live");
  });

  it("lets only the live state take a message", () => {
    expect(chatThreadWritable("live")).toBe(true);
    expect(chatThreadWritable("paused")).toBe(false);
    expect(chatThreadWritable("waiting")).toBe(false);
  });
});

describe("chat v2 — an Aspect's status is the Align surface's own answer", () => {
  it("counts only the cross-party Gaps, and takes the widest of them", () => {
    const row = soft.report?.rows[0];
    expect(row).toBeDefined();
    if (row === undefined) return;
    // Feel is 1 apart, Wish agrees. The own-side kinds (Feel against one's own Wish) are present on
    // the projection and must not be read: a tag is about where the pair stands.
    expect(row.gaps.feel).toBe(1);
    expect(row.gaps.wish).toBe(0);
    expect(aspectGapOf(row)).toBe(1);
  });

  it("moves the word with the tolerance, and keeps the 1-step Gap's own name", () => {
    const softStep1 = softTags.find((tag) => tag.itemId === step1);
    const fullStep1 = fullTags.find((tag) => tag.itemId === step1);
    expect(softStep1?.status).toBe("small-gap-ok");
    // Under Full a 1-step Gap keeps "Small Gap" and takes the tighter qualifier — the same rule
    // `alignmentStatusOf()` owns for the Align surface, read through one function.
    expect(fullStep1?.status).toBe("small-gap-tight");
  });

  it("reads a wide Gap as a Gap, and an agreeing Aspect as In Synch", () => {
    expect(softTags.find((tag) => tag.itemId === step4)?.status).toBe("gap");
    const agreeing = softTags.find((tag) => tag.itemId === (template.items[2]?.id ?? ""));
    expect(agreeing?.status).toBe("in-synch");
  });

  it("carries no status at all until both parties have accepted", () => {
    const blind = chatAspectTagsOf({ report: null, aspects: soft.aspects });
    expect(blind).toHaveLength(ASPECTS);
    // The chip's name is not an answer: the Aspect is still taggable, its status is absent.
    expect(blind.every((tag) => tag.status === null)).toBe(true);
    expect(blind[0]?.prompt).toBe(soft.aspects[0]?.prompt);
  });
});

describe("chat v2 — the demo thread fixture", () => {
  const DEMO_KEY = "relationship-assessment-instance-avery-rowan";
  const avery = chatThreadFor(DEMO_KEY);

  it("names exactly the seeded relationship ids, so a demo row finds its thread", () => {
    expect(chatThreadFor(DEMO_KEY)).toBeDefined();
    expect(chatThreadFor("relationship-assessment-instance-ruth-sam")).toBeDefined();
    // An exact key, never a prefix: a relationship nobody authored has no thread.
    expect(chatThreadFor("relationship-assessment-instance-avery-ro")).toBeUndefined();
    expect(chatThreadFor("")).toBeUndefined();
    // The projection this file builds is not a demo row, so it has no thread — the honest shape.
    expect(chatThreadFor(RELATIONSHIP_ID)).toBeUndefined();
  });

  it("counts unread from the other seat only", () => {
    const thread = chatThreadFor("relationship-assessment-instance-avery-rowan");
    expect(thread).toBeDefined();
    if (thread === undefined) return;
    const unreadRows = thread.messages.filter((message) => message.unread === true);
    expect(unreadRows).toHaveLength(1);
    // Rowan wrote the unread message, so Avery sees one and Rowan sees none of their own.
    expect(unreadCountOf(thread, "initiator")).toBe(1);
    expect(unreadCountOf(thread, "counterparty")).toBe(0);
  });

  it("never marks the reader's own message unread, whatever the fixture says", () => {
    const thread: ChatThreadRecord = {
      relationshipId: "relationship-test",
      messages: [
        {
          id: "own",
          sender: "initiator",
          body: "mine",
          at: "2026-10-28T19:00:00.000Z",
          unread: true,
        },
      ],
    };
    expect(unreadCountOf(thread, "initiator")).toBe(0);
    expect(unreadCountOf(thread, "counterparty")).toBe(1);
  });

  it("renders messages in send order even when the fixture is assembled out of order", () => {
    const thread: ChatThreadRecord = {
      relationshipId: "relationship-test",
      messages: [
        { id: "b", sender: "initiator", body: "second", at: "2026-10-28T19:10:00.000Z" },
        { id: "a", sender: "counterparty", body: "first", at: "2026-10-28T19:00:00.000Z" },
      ],
    };
    expect(chatMessagesOf(thread).map((message) => message.id)).toEqual(["a", "b"]);
  });

  it("decides mine from the seat, not from the screen", () => {
    const message = avery?.messages[0];
    expect(message).toBeDefined();
    if (message === undefined) return;
    expect(chatMessageIsMine(message, message.sender)).toBe(true);
    const other: ChatSender = message.sender === "initiator" ? "counterparty" : "initiator";
    expect(chatMessageIsMine(message, other)).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * The screen
 * ------------------------------------------------------------------ */

const VIEWER_MESSAGES: readonly ChatThreadMessageView[] = [
  {
    id: "m1",
    mine: false,
    seat: "counterparty",
    body: "I read through the five Aspects.",
    aspectId: null,
    timeLabel: "Wed 2:02 PM",
  },
  {
    id: "m2",
    mine: true,
    seat: "initiator",
    body: "Same. Let us start with Tuesday.",
    aspectId: step1,
    timeLabel: "Wed 2:14 PM",
  },
];

function threadWith(input: {
  readonly state: "live" | "waiting" | "paused";
  readonly payHref?: string | null;
  readonly tags?: typeof softTags;
  readonly messages?: readonly ChatThreadMessageView[];
}) {
  return renderToStaticMarkup(
    createElement(ChatThread, {
      copy: chatPageCopy,
      title: "Sharing the Week",
      otherName: "Rowan",
      otherInitials: "R",
      selfInitials: "A",
      state: input.state,
      messages: input.messages ?? VIEWER_MESSAGES,
      tags: input.tags ?? softTags,
      alignHrefBase: "/assessment/instances/session-chat-v2",
      withLine: "With Rowan",
      listHref: "/dashboard/chat",
      openHref: "/dashboard/relationships/relationship-session-chat-v2",
      payHref: input.payHref ?? null,
      waitingHeading: "Chat Opens When Rowan Joins",
      waitingBody: "The invitation is open until Nov 21, 2026.",
    }),
  );
}

const liveHtml = threadWith({ state: "live" });
const waitingHtml = threadWith({ state: "waiting" });
const pausedHtml = threadWith({
  state: "paused",
  payHref: "/assessment/new/template/session/pay",
});

describe("chat v2 — live, waiting and paused are three different screens", () => {
  it("draws the composer and the Aspect tags on a live thread", () => {
    expect(liveHtml).toContain('data-chat-thread="live"');
    expect(liveHtml).toContain('data-chat-composer="true"');
    expect(liveHtml).toContain('data-chat-message="mine"');
    expect(liveHtml).toContain('data-chat-message="theirs"');
    // One tag chip per Aspect, all of them from the relationship's own Aspects.
    for (const tag of softTags) {
      expect(liveHtml).toContain(`data-tag-chip="${tag.itemId}"`);
    }
    expect(liveHtml).not.toContain("data-chat-paused");
    expect(liveHtml).not.toContain("data-chat-waiting");
  });

  it("carries the tagged message's status word and the Aspect it names", () => {
    expect(liveHtml).toContain(`data-chat-tag="${step1}"`);
    expect(liveHtml).toContain('data-status-chip="small-gap-ok"');
    // The word is the fixture's, never a literal in the component.
    expect(liveHtml).toContain(">Small Gap<");
    // The door lands on the Aspect the message named, on the Align surface — the anchor
    // `alignment-view.tsx` already draws for its numbered card.
    expect(liveHtml).toContain(`href="/assessment/instances/session-chat-v2#aspect-${step1}"`);
    // The sender's name is on every line: "You" for the reader, the other seat's real name else.
    expect(liveHtml).toContain(">Rowan<");
  });

  it("draws an agreeing Aspect as In Synch once a message is tagged with one", () => {
    const agreeing = template.items[2]?.id ?? "";
    const html = threadWith({
      state: "live",
      messages: [
        {
          id: "agree",
          mine: false,
          seat: "counterparty",
          body: "We read that one the same way.",
          aspectId: agreeing,
          timeLabel: "Wed 2:20 PM",
        },
      ],
    });
    expect(html).toContain('data-status-chip="in-synch"');
    expect(html).toContain(">In Synch<");
  });

  it("draws the waiting sentence, its body, and no composer", () => {
    expect(waitingHtml).toContain('data-chat-thread="waiting"');
    expect(waitingHtml).toContain('data-chat-waiting="true"');
    expect(waitingHtml).toContain("Chat Opens When Rowan Joins");
    expect(waitingHtml).toContain("The invitation is open until Nov 21, 2026.");
    expect(waitingHtml).not.toContain('data-chat-composer="true"');
    // Chat has nothing to say to one person, so no messages are drawn either.
    expect(waitingHtml).not.toContain("data-chat-message=");
  });

  it("draws the read-only band, and the Initiator's one action", () => {
    expect(pausedHtml).toContain('data-chat-thread="paused"');
    expect(pausedHtml).toContain('data-chat-paused="true"');
    expect(pausedHtml).toContain("Stage 6 is paused, so chat is read-only. Nothing is lost.");
    expect(pausedHtml).toContain('data-chat-add-card="true"');
    expect(pausedHtml).toContain(">Add a Card<");
    expect(pausedHtml).not.toContain('data-chat-composer="true"');
    // The history stays: a paused thread is read-only, not emptied.
    expect(pausedHtml).toContain("I read through the five Aspects.");
  });

  it("gives the Counterparty's paused thread no card, no price and no trial word", () => {
    const counterpartyHtml = threadWith({ state: "paused", payHref: null });
    expect(counterpartyHtml).toContain('data-chat-paused="true"');
    expect(counterpartyHtml).not.toContain("data-chat-add-card");
    for (const forbidden of ["Add a Card", "$", "trial", "Trial", "upgrade", "Upgrade"]) {
      expect(counterpartyHtml).not.toContain(forbidden);
    }
  });

  it("states a status the fixture can word and leaves an unmeasured one blank", () => {
    const blind = threadWith({
      state: "live",
      tags: chatAspectTagsOf({ report: null, aspects: soft.aspects }),
    });
    // The tag still names the Aspect…
    expect(blind).toContain(`data-chat-tag="${step1}"`);
    // …and claims nothing about it: no status word, no chip paint.
    expect(blind).toContain('data-status-chip="none"');
    expect(blind).not.toContain(">Small Gap<");
    expect(blind).not.toContain(">In Synch<");
  });

  it("draws the header's state chip in the fixture's words", () => {
    expect(liveHtml).toContain(">Stage 6 Live<");
    expect(waitingHtml).toContain(">Waiting on Invite<");
    expect(pausedHtml).toContain(">Paused · Read-Only<");
  });

  it("keeps the thread's own empty state for a relationship with nothing said yet", () => {
    const empty = renderToStaticMarkup(
      createElement(ChatThread, {
        copy: chatPageCopy,
        title: "Sharing the Week",
        otherName: "Rowan",
        otherInitials: "R",
        selfInitials: "A",
        state: "live",
        messages: [],
        tags: softTags,
        alignHrefBase: "/assessment/instances/session-chat-v2",
        withLine: "With Rowan",
        listHref: "/dashboard/chat",
        openHref: "/dashboard/relationships/relationship-session-chat-v2",
        payHref: null,
        waitingHeading: "Chat Opens When Rowan Joins",
        waitingBody: "The invitation is open until Nov 21, 2026.",
      }),
    );
    expect(empty).toContain("Nothing here yet. Say hello.");
  });
});

describe("chat v2 — the surface's words live in the fixture", () => {
  it("draws no word the chat fixture does not carry", () => {
    // The page's copy is the only source of labels on this surface; a sentence assembled in a
    // component is what E23's leaf budget catches, and this is the same claim from the render side.
    for (const word of ["Pick a Conversation", "Tag:", "Send", "You", "Messages"]) {
      const carried =
        (chatPageCopy.items ?? []).some((item) => item.label === word) ||
        (chatPageCopy.sections ?? []).some(
          (section) =>
            section.heading === word ||
            section.body === word ||
            section.items?.some((item) => item.label === word) === true,
        );
      expect(carried).toBe(true);
    }
    expect(liveHtml).toContain(">Tag:<");
    expect(liveHtml).toContain('aria-label="Send"');
    expect(liveHtml).toContain(">You<");
    // The Align surface's own copy is untouched: this surface reads the report, it does not draw it.
    expect(assessmentSessionPageCopy.heading).toBeTruthy();
  });
});
