/**
 * Stage 5, **Sent** (#691) — the screen the create lands on.
 *
 * The card's acceptance is a set of facts that are all visible in markup, so this file renders the
 * real component over a screen built by the real `projectScreen()` from real template rows:
 *
 *   1. **The state is derived, not a badge.** `unclaimed`, `claimed` and `expired` each draw their
 *      own sentence from `data/pages/assessment-sent.ts`, and the sentence names the counterparty —
 *      a screen that said "waiting" about an invitation that had died would be the defect.
 *   2. **The timeline is the variation.** Three moments, one `aria-current`, and the middle one's
 *      wording is chosen by the invitation's own state, not by a boolean.
 *   3. **Resend is the shipped mechanism and is only drawn where it would work** — the Initiator's
 *      seat, an invitation not yet claimed — and it posts to `reinvitePath()` with the hidden
 *      `returnTo` that keeps the 303 on this screen.
 *   4. **Signed out is behind the person, not in front.** Nothing here links to `/login`; the `go`
 *      band says where the relationship lives until an account claims it.
 *   5. **The rail is stage 5 of 5**, one current entry, because this is a stage and the instance
 *      screen it leads to is not (`docs/specs/ux-stages.md`).
 *
 * No database and no server: `projectScreen` is the same pure projection the read path hands the
 * page, so a state that cannot be built here cannot be drawn there either.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SentState } from "@/components/assessment-flow/sent-state";
import { formatDate } from "@/content/core";
import { assessments } from "@/data/assessments";
import { assessmentSentPageCopy } from "@/data/pages/assessment-sent";
import type { Assessment, PartyRole } from "@/content/assessment";
import type { ItemRow, PartyRow } from "@/lib/db/rows";
import { INVITE_STATES } from "@/lib/flow/invite-state";
import { instancePath, reinvitePath } from "@/lib/flow/paths";
import {
  projectScreen,
  type FlowInstanceRows,
  type FlowInvite,
  type FlowScreen,
} from "@/lib/flow/screen";
import { itemLabel, sectionOf } from "@/lib/page-copy";

const template: Assessment = (() => {
  const found = assessments.find((entry) => entry.id === "assessment-relationship-basics");
  if (found === undefined) throw new Error("the test's template fixture is missing");
  return found;
})();

const INSTANCE_ID = "instance-sent-state";
const SENT_AT = "2026-11-07T09:00:00.000Z";
const EXPIRES_AT = "2026-11-14T09:00:00.000Z";
const CLAIMED_AT = "2026-11-08T10:00:00.000Z";

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
  { session_record_id: INSTANCE_ID, role: "initiator", name: "Avery" },
  { session_record_id: INSTANCE_ID, role: "counterparty", name: "Rowan" },
];

function rows(): FlowInstanceRows {
  return {
    record: {
      id: INSTANCE_ID,
      slug: "relationship-basics-sent",
      record_type: "assessment",
      status: "draft",
      date: new Date(SENT_AT),
      title: template.title,
      summary: "sent to Rowan",
    },
    items,
    options: [],
    instance: {
      record_id: INSTANCE_ID,
      template_record_id: template.id,
      relationship_id: "relationship-sent-state",
      mode: "basic",
      setting: "soft",
    },
    parties,
    opinions: [],
    answerCounts: { initiator: 0, counterparty: 0 },
  };
}

/** One invitation in one state — the four `inviteStateOf()` can answer, plus the absent row. */
function inviteIn(state: "unclaimed" | "claimed" | "expired" | "revoked"): FlowInvite {
  const claimed = state === "claimed";
  return {
    email: "rowan@example.com",
    counterpartyName: "Rowan",
    sentAt: SENT_AT,
    claimedAt: claimed ? CLAIMED_AT : null,
    expiresAt: state === "expired" ? "2026-11-05T09:00:00.000Z" : EXPIRES_AT,
    state,
    resentAt: null,
    resentCount: 0,
    // The read path withholds the link in every state but `unclaimed`: the claim would refuse it.
    link: state === "unclaimed" ? "https://example.test/invite/token-sent" : null,
  };
}

function htmlWith(
  inviteState: "unclaimed" | "claimed" | "expired" | "revoked" | "none",
  viewer: PartyRole = "initiator",
  signedIn = true,
): string {
  const screen = projectScreen({
    rows: rows(),
    template,
    viewerRole: viewer,
    invite: inviteState === "none" ? null : inviteIn(inviteState),
  });

  return renderToStaticMarkup(
    createElement(SentState, {
      copy: assessmentSentPageCopy,
      screen,
      resendAction: reinvitePath(INSTANCE_ID),
      openHref: instancePath(INSTANCE_ID),
      signedIn,
    }),
  );
}

/** The one sentence in the status band, without its markup. */
function statusSentence(html: string): string {
  const band = html.match(/data-sent-status="([\w-]+)"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/);
  return `${band?.[1] ?? "missing"}|${(band?.[2] ?? "").replace(/<[^>]+>/g, "")}`;
}

const timeline = sectionOf(assessmentSentPageCopy, "timeline");
const status = sectionOf(assessmentSentPageCopy, "status");

describe("the state sentence (#691)", () => {
  it("names the counterparty and waits, while the invitation is unclaimed", () => {
    expect(statusSentence(htmlWith("unclaimed"))).toBe(
      `unclaimed|${itemLabel(status, "unclaimed").replace("{counterparty}", "Rowan")}`,
    );
  });

  it("says accepted, not waiting, once the seat is filled", () => {
    expect(statusSentence(htmlWith("claimed"))).toContain(
      itemLabel(status, "claimed").replace("{counterparty}", "Rowan"),
    );
  });

  it("draws a distinct sentence for an invitation that ran out", () => {
    expect(statusSentence(htmlWith("expired"))).toContain(itemLabel(status, "expired"));
  });

  it("draws a distinct sentence for one an operator withdrew", () => {
    expect(statusSentence(htmlWith("revoked"))).toContain(itemLabel(status, "revoked"));
  });
});

/**
 * **A relationship whose invitation was never written is a state with words (#976).**
 *
 * `session_invite` holding no row for the session is legitimate — the commit can land before the
 * send writes the invitation, and the seed leaves the table empty — so `SentState` asks the band
 * for the id `"none"`. The fixture had only the four derived states, and `itemLabel`'s throw turned
 * a reachable state into a server-render exception: `/assessment/instances/<id>/sent` answered 500
 * for every such relationship. The throw is correct and stays; the fixture was wrong.
 *
 * The second case is the invariant that keeps this from recurring: every value the view can ask
 * for — `INVITE_STATES` plus the absent-row id — must resolve in the same band, so adding a state
 * to `inviteStateOf()` without a sentence is a red test rather than a 500 at capture time.
 */
describe("a relationship with no invitation row (#976)", () => {
  it("draws its own sentence instead of throwing, with no timeline to draw", () => {
    // The render itself is the assertion: before the fixture carried the item this call threw
    // `PageCopy: section "status" has no item "none"`, which is the 500 the card was filed for.
    const html = htmlWith("none");
    expect(statusSentence(html)).toBe(`none|${itemLabel(status, "none")}`);
    // There is no row, so there is no history and no address to print — the screen says the one
    // fact it has rather than drawing an empty timeline.
    expect(html).not.toContain("data-sent-timeline");
    expect(html).not.toContain(itemLabel(status, "email").replace("{email}", "rowan@example.com"));
  });

  it("covers every state the view can ask for — INVITE_STATES plus the absent row", () => {
    for (const id of [...INVITE_STATES, "none"]) {
      // `itemLabel` throws on a missing id; an empty label would be the same defect wearing words.
      expect(itemLabel(status, id).trim().length).toBeGreaterThan(0);
    }
    // The sentence is the row's own — it never borrows `unclaimed`, because "the link has not been
    // claimed" and "there is no link" are different facts.
    expect(itemLabel(status, "none")).not.toBe(itemLabel(status, "unclaimed"));
  });
});

/**
 * **A state this build has no sentence for renders, it does not 500 (#998).**
 *
 * `invite.state` is derived by the read, so its id is not a literal E23 can resolve against the
 * fixture: the next status `inviteStateOf()` grows — or a second route that reuses this band with
 * another vocabulary — met `itemLabel`'s throw inside a server render, at request time, while
 * `typecheck`, `lint`, `data:check` and `next build` all stayed green. #988 closed the one instance
 * of that (the absent row, `none`); this pins the class: the band carries a neutral fallback row,
 * the band's own sentence renders, and the screen keeps its timeline and its next-step list.
 */
describe("a state the band has no sentence for (#998)", () => {
  /** The screen's invitation, carrying a state outside this build's vocabulary. */
  function unknownStateScreen(): FlowScreen {
    const screen = projectScreen({
      rows: rows(),
      template,
      viewerRole: "initiator",
      invite: inviteIn("unclaimed"),
    });
    if (screen.invite === null) throw new Error("the fixture's screen carries no invitation");
    return { ...screen, invite: { ...screen.invite, state: "voided" } } as unknown as FlowScreen;
  }

  function renderUnknown(): string {
    return renderToStaticMarkup(
      createElement(SentState, {
        copy: assessmentSentPageCopy,
        screen: unknownStateScreen(),
        resendAction: reinvitePath(INSTANCE_ID),
        openHref: instancePath(INSTANCE_ID),
        signedIn: true,
      }),
    );
  }

  it("draws the band's fallback sentence instead of throwing", () => {
    // The render itself is the assertion: before the fallback row, this call threw
    // `PageCopy: section "status" has no item "voided"` — the 500 the issue names.
    const html = renderUnknown();
    expect(statusSentence(html)).toBe(`voided|${itemLabel(status, "unknown")}`);
    expect(html).toContain("data-sent-status-fallback");
  });

  it("still draws the timeline and what happens next", () => {
    const html = renderUnknown();
    expect(html.match(/data-moment="/g) ?? []).toHaveLength(3);
    expect(html).toContain('data-sent-timeline="voided"');
    expect(html).toContain('id="sent-next-heading"');
    expect(html).toContain(itemLabel(sectionOf(assessmentSentPageCopy, "next"), "1"));
  });

  it("marks only the fallback — every state the build knows keeps its own row", () => {
    for (const state of ["unclaimed", "claimed", "expired", "revoked", "none"] as const) {
      expect(htmlWith(state)).not.toContain("data-sent-status-fallback");
    }
  });

  it("draws no sentence for a refusal code the band does not carry, rather than throwing", () => {
    const screen = projectScreen({
      rows: rows(),
      template,
      viewerRole: "initiator",
      invite: inviteIn("unclaimed"),
    });
    const html = renderToStaticMarkup(
      createElement(SentState, {
        copy: assessmentSentPageCopy,
        screen,
        // `?resend=` names a code from a later build: the band has no row for it, so nothing is
        // drawn — the same answer the route's own filter gives a value it does not know.
        resendRefusal: "a-code-from-a-later-build",
        resendAction: reinvitePath(INSTANCE_ID),
        openHref: instancePath(INSTANCE_ID),
        signedIn: true,
      }),
    );
    expect(html).not.toContain("data-sent-refusal");
  });
});

describe("the invitation timeline (#691)", () => {
  it("draws three moments, in order, with exactly one current", () => {
    const html = htmlWith("unclaimed");
    expect(html.match(/data-moment="/g) ?? []).toHaveLength(3);
    expect(html.indexOf('data-moment="sent"')).toBeLessThan(html.indexOf('data-moment="waiting"'));
    expect(html.indexOf('data-moment="waiting"')).toBeLessThan(
      html.indexOf('data-moment="accepted"'),
    );
    expect(html.match(/aria-current="step"/g) ?? []).toHaveLength(1);
    // The timeline's live moment is `aria-current="true"` — the current item of a set, not a step
    // of the rail, so a screen reader is not told there are two steppers on one page.
    expect(html.match(/aria-current="true"/g) ?? []).toHaveLength(1);
    expect(html).toContain('data-sent-timeline="unclaimed"');
  });

  it("dates the first moment from the row, never from a clock", () => {
    // The row's `created_at`, formatted by the repo's UTC formatter: a render path has no clock of
    // its own, so this string is the same on the server and after hydration.
    expect(htmlWith("unclaimed")).toContain(formatDate(SENT_AT));
  });

  it("turns the waiting moment into the expiry date when the link died", () => {
    const html = htmlWith("expired");
    expect(html).toContain(
      itemLabel(timeline, "waiting-expired").replace(
        "{date}",
        formatDate("2026-11-05T09:00:00.000Z"),
      ),
    );
    expect(html).not.toContain(
      itemLabel(timeline, "waiting-claimed").replace("{counterparty}", "Rowan"),
    );
  });

  it("marks acceptance done only when the seat is filled", () => {
    const unclaimed = htmlWith("unclaimed");
    expect(unclaimed).toContain('data-moment="accepted" data-state="todo"');
    const claimed = htmlWith("claimed");
    expect(claimed).toContain('data-moment="accepted" data-state="done"');
  });
});

describe("resend, on the shipped mechanism (#691)", () => {
  it("posts to the instance's own re-invite endpoint and comes back here", () => {
    const html = htmlWith("unclaimed");
    expect(html).toContain(`action="${reinvitePath(INSTANCE_ID)}"`);
    expect(html).toContain('name="returnTo"');
    expect(html).toContain('value="sent"');
  });

  it("is not offered once the invitation is claimed", () => {
    expect(htmlWith("claimed")).not.toContain("data-reinvite-form");
  });

  it("is not offered to the Counterparty, who cannot send one", () => {
    expect(htmlWith("unclaimed", "counterparty")).not.toContain("data-reinvite-form");
  });

  it("prints the link only while the claim path would still accept it", () => {
    expect(htmlWith("unclaimed")).toContain("https://example.test/invite/token-sent");
    expect(htmlWith("expired")).not.toContain("token-sent");
  });
});

describe("the rail and the way onward (#691)", () => {
  it("draws stage 5 of 5 with one current entry", () => {
    const html = htmlWith("unclaimed");
    expect(html).toContain("Stage 5 of 5");
    expect(html).toContain('aria-current="step"');
    // The rail marks its current step with `data-step-state`; the timeline's own marks use
    // `data-state`, so exactly one of those is `current` too — the invitation's live moment.
    expect(html.match(/data-state="current"/g) ?? []).toHaveLength(1);
  });

  it("points at the relationship itself, which is stage 6", () => {
    expect(htmlWith("unclaimed")).toContain(`href="${instancePath(INSTANCE_ID)}"`);
  });

  it("offers no sign-in when the person is signed out — the account is behind them", () => {
    const html = htmlWith("unclaimed", "initiator", false);
    expect(html).not.toContain('href="/login');
    expect(html).toContain(itemLabel(sectionOf(assessmentSentPageCopy, "go"), "browser-note"));
  });

  it("says the relationship is on the dashboard when somebody is signed in", () => {
    expect(htmlWith("unclaimed")).toContain(
      itemLabel(sectionOf(assessmentSentPageCopy, "go"), "note"),
    );
  });
});
