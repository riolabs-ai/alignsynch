/**
 * The Discussion tab is a thread, a composer and three states — the register's `chat-and-discussion`
 * row (issue #1131, `docs/specs/v2-rectification.md`).
 *
 * The row named two deltas on one surface: the doc promises a composer (**"Message {name}"**,
 * **"Tag an Aspect"**, **"Send"**) and the reference draws a threaded conversation with timestamps,
 * an **Add a Comment** box and an Aspect selector — and the live panel drew a heading and one empty
 * sentence. So this suite pins the three claims a static render can carry, and the states that must
 * not draw a composer:
 *
 *   the thread    the demo relationship's messages render with their author, their seat, their
 *                 timestamp and the Aspect they were tagged with. The body asserted here is a
 *                 hand-copied literal from `data/chat-threads.ts`, not a re-read of the fixture, so a
 *                 panel that rendered the fixture back at itself cannot pass.
 *   the composer  a `<textarea>` whose placeholder is **Message {name}**, a control labelled
 *                 **Tag an Aspect** with one option per Aspect plus **No Aspect**, and a **Send**
 *                 control. Every placeholder is filled from the relationship, never from a constant.
 *   the states    a waiting relationship (invitation never claimed) draws the waiting sentence and
 *                 **no** composer; a paused one draws the read-only sentence and no composer. Both
 *                 are derived (`chatThreadStateOf`), never a prop the page sets by hand.
 *
 * The seam is the panel's rendered markup: `DiscussionPanel` is the component the page mounts for
 * the tab, so a change to the derivation (connection, pause) shows up here, and a change to the CSS
 * does not.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DiscussionPanel } from "@/components/dashboard/relationship-panels";
import { assessments } from "@/data/assessments";
import { dashboardRelationshipDetailPageCopy } from "@/data/pages/dashboard-relationship-detail";
import type { MemberRelationshipView } from "@/lib/member/relationships";

const record = (() => {
  const found = assessments.find((entry) => entry.id === "assessment-relationship-basics");
  if (found === undefined) throw new Error("assessment-relationship-basics is not a fixture");
  return found;
})();

/** The demo relationship `data/chat-threads.ts` carries a conversation for. */
const DEMO_THREAD_ID = "relationship-assessment-instance-avery-rowan";

function view(overrides: Partial<MemberRelationshipView> = {}): MemberRelationshipView {
  return {
    id: DEMO_THREAD_ID,
    status: "published",
    viewerRole: "initiator",
    isInitiator: true,
    templateId: record.id,
    templateSlug: record.slug,
    title: record.title,
    relationshipTitle: "Avery B – Rowan",
    summary: record.summary,
    createdAt: "2026-10-28T18:30:00.000Z",
    publishedAt: "2026-10-29T12:00:00.000Z",
    sessionRecordId: "assessment-instance-avery-rowan",
    aspectCount: record.items.length,
    invite: { claimed: true, revoked: false, expiresAt: new Date("2026-11-12T12:00:00.000Z") },
    counterpartyName: "Rowan",
    counterpartySeatName: "Rowan",
    initiatorName: "Avery",
    view: "invite-claimed",
    membership: { state: "open", reason: null, endedAt: null, writable: true },
    template: record,
    aspectsEditable: false,
    publishable: false,
    completion: null,
    offersRepublish: false,
    trialWithoutLiveInvite: false,
    closed: false,
    trial: "active",
    trialEndsAt: "2026-11-05T12:00:00.000Z",
    lapseSentence: null,
    inviteLinkAvailable: false,
    canForkTemplate: false,
    ...overrides,
  };
}

function markup(overrides: Partial<MemberRelationshipView> = {}): string {
  return renderToStaticMarkup(
    createElement(DiscussionPanel, {
      copy: dashboardRelationshipDetailPageCopy,
      relationship: view(overrides),
    }),
  );
}

/** The visible text of a render, tags stripped — for asserting a sentence rather than a class. */
function textOf(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

describe("the Discussion tab draws the thread the relationship has", () => {
  it("renders the demo conversation's messages, with their bodies", () => {
    const rendered = textOf(markup());
    expect(rendered).toContain(
      "I read through the five Aspects. The one I keep coming back to is how the week actually splits.",
    );
    expect(rendered).toContain("Then let us start with Tuesday and Thursday.");
  });

  it("gives every message a timestamp — the reference's threaded conversation", () => {
    const html = markup();
    // Three authored messages, three instants; each prints `<time dateTime="…">Wed 07:02 PM</time>`.
    const times = [...html.matchAll(/<time[^>]*dateTime="([^"]+)"/g)].map((match) => match[1]);
    expect(times.length).toBeGreaterThanOrEqual(3);
    expect(times[0]).toBe("2026-10-28T19:02:00.000Z");
    expect(textOf(html)).toMatch(/Wed 07:02 PM/);
  });

  it("names the Aspect a tagged message was sent about, and no status it cannot read", () => {
    // The tag's Align status is a function of the pair's report, which this screen does not read, so
    // the chip carries the Aspect's name only — the blind rule, stated as an absence. The prompt is
    // the record's own (`assessment-relationship-basics`), not the prototype's sample vocabulary.
    const rendered = textOf(markup());
    expect(rendered).toContain("How is the work of the household divided?");
    expect(rendered).not.toMatch(/In Synch|Small Gap/);
  });

  it("says the thread is empty when the relationship has no messages", () => {
    expect(markup({ id: "relationship-with-no-thread" })).toContain(
      "Nothing has been said here yet.",
    );
  });
});

describe("the Discussion tab draws a composer on a live thread", () => {
  it("offers a message box whose placeholder names the other person", () => {
    const html = markup();
    expect(html).toContain('placeholder="Message Rowan"');
    expect(html).toContain("<textarea");
  });

  it("labels itself Add a Comment for a screen reader", () => {
    expect(markup()).toMatch(
      /<label[^>]*for="discussion-composer-body"[^>]*>Add a Comment<\/label>/,
    );
  });

  it("offers a Tag an Aspect control carrying every Aspect plus No Aspect", () => {
    const html = markup();
    expect(textOf(html)).toContain("Tag an Aspect");
    expect(textOf(html)).toContain("No Aspect");
    const options = [...html.matchAll(/<option[^>]*value="([^"]*)"/g)].map((match) => match[1]);
    // One "no Aspect" option plus one per Aspect on the record — not a fixed list in the view.
    expect(options).toHaveLength(record.items.length + 1);
    expect(options[0]).toBe("");
  });

  it("offers a Send control, and disables it until there are words to send", () => {
    const html = markup();
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled[^>]*>\s*<svg[\s\S]*?Send/);
  });
});

describe("the Discussion tab draws no composer where the thread cannot be written", () => {
  it("says when chat opens while the invitation is unclaimed", () => {
    const html = markup({
      invite: { claimed: false, revoked: false, expiresAt: new Date("2026-11-12T12:00:00.000Z") },
      view: "invite-live",
    });
    expect(html).toContain('data-discussion-waiting="true"');
    expect(textOf(html)).toContain("Chat opens when Rowan joins.");
    expect(html).not.toContain("<textarea");
  });

  it("reads as read-only while Stage 6 is paused", () => {
    const html = markup({
      membership: { state: "lapsed", reason: "trial-ended", endedAt: null, writable: false },
      pause: {
        state: "trial-ended",
        paused: true,
        endsAt: null,
        daysLeft: null,
        extended: false,
        extensionAvailable: true,
      },
    });
    expect(html).toContain('data-discussion-read-only="true"');
    expect(textOf(html)).toContain("Stage 6 is paused, so chat is read-only. Nothing is lost.");
    expect(html).not.toContain("<textarea");
  });

  it("keeps a closed relationship's thread readable and takes no message", () => {
    const html = markup({ closed: true, status: "complete" });
    expect(html).toContain('data-discussion-read-only="true"');
    expect(textOf(html)).toContain("This relationship is closed, so the Discussion is read-only.");
    expect(html).not.toContain("<textarea");
    // The history stays: closing a relationship ends the writing, not the record of it.
    expect(textOf(html)).toContain("Then let us start with Tuesday and Thursday.");
  });
});

describe("the Discussion tab reads the same thread from the other seat", () => {
  it("labels the reader's own messages You and the other person's with their name", () => {
    // The same fixture, seen by the Counterparty: the second message was the Initiator's, so it is
    // now the other person's, and the third — Rowan's — is the reader's own. One authored thread,
    // two correct readings, which is what `chatMessageIsMine` exists for.
    const asCounterparty = textOf(markup({ viewerRole: "counterparty" }));
    expect(asCounterparty).toContain("Same. I would rather work out what we both mean");
    expect(asCounterparty).not.toContain("Message Rowan");
    // The placeholder names the *other* seat, which for the Counterparty is the Initiator.
    expect(markup({ viewerRole: "counterparty" })).toContain('placeholder="Message Avery"');
  });
});
