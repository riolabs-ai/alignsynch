import { describe, expect, it } from "vitest";
import { seedRelationships, seedThreadReadAt, v1Templates, type Persona } from "@/data/v1/fixtures";
import {
  notificationsFor,
  seedNotifications,
  unreadNotificationCountOf,
} from "@/data/v1/notifications";
import {
  inventedMessagesOf,
  isBlindThread,
  threadsOf,
  totalUnreadOf,
  unreadCountOf,
} from "@/lib/v1/chat";
import { relationshipsVisibleTo } from "@/lib/v1/persona";

const titlesById = new Map(v1Templates.map((template) => [template.id, template.title]));

function threadsFor(persona: Persona) {
  return relationshipsVisibleTo(persona, seedRelationships).flatMap((rel) =>
    threadsOf(rel, titlesById.get(rel.templateId) ?? rel.templateId),
  );
}

function relationship(id: string) {
  const found = seedRelationships.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`no seeded relationship "${id}"`);
  return found;
}

describe("v1 chat — the conversation list per persona", () => {
  it("initiator sees one thread per relationship, then one per Aspect, in order", () => {
    expect(threadsFor("initiator").map((thread) => thread.id)).toEqual([
      "rel-invited",
      "rel-invited--aspect-time",
      "rel-invited--aspect-money",
      "rel-invited--aspect-conflict",
      "rel-connected-blind",
      "rel-connected-blind--aspect-priorities",
      "rel-connected-blind--aspect-feedback",
      "rel-connected-blind--aspect-workload",
      "rel-connected-blind--aspect-decisions",
      // The shop's "before" seed — an unsubscribed relationship the initiator started, so it
      // carries a thread and one per Aspect like any other. It was added to the fixtures after
      // this test was written.
      "rel-unsubscribed",
      "rel-unsubscribed--aspect-time",
      "rel-unsubscribed--aspect-money",
      "rel-unsubscribed--aspect-conflict",
    ]);
  });

  it("counterparty sees only the relationships they are party to", () => {
    const ids = threadsFor("counterparty").map((thread) => thread.id);
    expect(ids).toContain("rel-connected-blind");
    expect(ids).toContain("rel-aligned--aspect-trust");
    expect(ids).not.toContain("rel-invited");
    expect(ids).not.toContain("rel-sharing-unmet");
    expect(ids).not.toContain("rel-advanced");
  });

  it("coach sees only shared relationships", () => {
    const ids = threadsFor("coach").map((thread) => thread.id);
    expect(ids.some((id) => id.startsWith("rel-sharing-unmet"))).toBe(true);
    expect(ids.some((id) => id.startsWith("rel-aligned"))).toBe(true);
    expect(ids.some((id) => id.startsWith("rel-invited"))).toBe(false);
    expect(ids.some((id) => id.startsWith("rel-connected-blind"))).toBe(false);
  });

  it("admin sees every relationship's threads", () => {
    const expected = seedRelationships.reduce((sum, rel) => sum + 1 + rel.items.length, 0);
    expect(threadsFor("admin")).toHaveLength(expected);
  });
});

describe("v1 chat — the blind rule", () => {
  it("a pre-scoring thread carries comments only, never the counterparty's answers", () => {
    // rel-sharing-unmet: both parties answered but neither accepted, so the blind rule still
    // holds. The only thread message is the coach's note — no answer value leaks anywhere.
    const rel = relationship("rel-sharing-unmet");
    const bodies = threadsOf(rel, titlesById.get(rel.templateId) ?? "").flatMap((thread) =>
      thread.messages.map((message) => message.body),
    );
    expect(bodies).toEqual([
      "You read 'conflict' from opposite ends. Before the next conversation, agree what 'said plainly' would look like to each of you.",
    ]);
    for (const answer of Object.values(rel.counterpartyAnswers)) {
      for (const value of [answer.feel, answer.wish, answer.think, answer.guess]) {
        expect(bodies.join(" ")).not.toContain(` ${value} `);
      }
    }
  });

  it("rel-connected-blind's pre-scoring Aspect thread discusses the Aspect, not the counterparty", () => {
    const rel = relationship("rel-connected-blind");
    const thread = threadsOf(rel, titlesById.get(rel.templateId) ?? "").find(
      (candidate) => candidate.id === "rel-connected-blind--aspect-priorities",
    );
    expect(thread).toBeDefined();
    // Sam has not answered, so there is no counterparty value to leak — the proof is that the
    // thread renders exactly the seeded discussion and nothing derived from an answer map.
    expect(rel.counterpartyAnswers).toEqual({});
    expect(thread?.messages.map((message) => message.body)).toEqual([
      "Before we sit down — how do you want to set the week's priorities? A Monday list or a shared board?",
      "A shared board would help me see what's committed. Let's agree the three that can't slip.",
    ]);
  });

  it("no message in any seeded thread exists without a comment record behind it", () => {
    // The provenance assertion: a body with no comment record would mean something other than the
    // store wrote the thread — an answer map, a component literal, a second messaging system.
    for (const rel of seedRelationships) {
      expect(inventedMessagesOf(rel, titlesById.get(rel.templateId) ?? rel.templateId)).toEqual([]);
    }
  });

  it("a session is blind until both parties accept, not when both have submitted", () => {
    // rel-sharing-unmet: both submitted, neither accepted — the blind rule is still in force.
    expect(isBlindThread(relationship("rel-sharing-unmet"))).toBe(true);
    expect(isBlindThread(relationship("rel-connected-blind"))).toBe(true);
    // rel-aligned: both accepted — the rule is lifted, so its threads may speak about values.
    expect(isBlindThread(relationship("rel-aligned"))).toBe(false);
  });
});

describe("v1 chat — unread, computed not stored", () => {
  it("the sidebar total equals the sum of per-thread unread", () => {
    for (const persona of ["initiator", "counterparty", "coach", "admin"] as const) {
      const threads = threadsFor(persona);
      const readAt = seedThreadReadAt[persona] ?? {};
      const sum = threads.reduce(
        (total, thread) => total + unreadCountOf(thread, persona, readAt[thread.id]),
        0,
      );
      expect(totalUnreadOf(threads, persona, readAt)).toBe(sum);
    }
  });

  it("the seed watermarks produce the demo's unread picture", () => {
    expect(totalUnreadOf(threadsFor("initiator"), "initiator", seedThreadReadAt.initiator)).toBe(1);
    expect(
      totalUnreadOf(threadsFor("counterparty"), "counterparty", seedThreadReadAt.counterparty),
    ).toBe(2);
    expect(totalUnreadOf(threadsFor("coach"), "coach", seedThreadReadAt.coach)).toBe(1);
  });
});

describe("v1 notifications — the bell agrees with the list", () => {
  it("unreadNotificationCountOf equals the list's unread rows", () => {
    for (const persona of ["initiator", "counterparty", "coach", "admin"] as const) {
      const listUnread = notificationsFor(persona, seedNotifications).filter(
        (notification) => !notification.read,
      ).length;
      expect(unreadNotificationCountOf(persona, seedNotifications)).toBe(listUnread);
    }
  });

  it("every event type is one the product emits", () => {
    const types = [...new Set(seedNotifications.map((notification) => notification.type))].sort();
    expect(types).toEqual(
      ["invite_accepted", "new_comment", "payment_failed", "session_scored"].sort(),
    );
  });
});
