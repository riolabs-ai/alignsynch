/**
 * #1121 — the paused screen, from both seats, and the Counterparty's promise.
 *
 * The issue's table has two columns, and the whole card turns on the second one being *smaller*:
 *
 *   Initiator    Paused · **Your Trial Ended** · Add a Card + Get 7 More Days Free · the free week
 *                offered once and then gone · a membership row that names the pause
 *   Counterparty Paused · Waiting on <Marcus> · **See Your Results** · and nothing about a plan, a
 *                price, a card, a trial or an extension — not a word, not a control, not a title
 *
 * A screenshot can show the first column. Only a render can prove the second one is *absent*, which
 * is why this file asserts the Counterparty's markup for the missing words rather than reading the
 * component and hoping. The list is the issue's own must-not: `$`, "trial", "card", "extension",
 * "price".
 *
 * The view literals are built here rather than read from Postgres — `readMyRelationship()` is the
 * boundary where `pauseOf()` is decided, `tests/trial-pause.test.ts` drives that derivation, and this
 * file starts where the component starts.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
}));

import { RelationshipDetail } from "@/components/dashboard/relationship-detail";
import { assessments } from "@/data/assessments";
import { dashboardRelationshipDetailPageCopy } from "@/data/pages/dashboard-relationship-detail";
import type { MemberRelationshipView } from "@/lib/member/relationships";
import type { Pause } from "@/lib/relationship/pause";
import {
  LAPSE_EXTENSION_DAYS,
  lapseSentenceOf,
  type LapseReason,
  type Membership,
} from "@/lib/relationship/membership";
import { METHOD_TRIAL_DAYS } from "@/lib/flow/payment";
import { itemLabel, sectionOf } from "@/lib/page-copy";

const template = assessments[0];
if (template === undefined) throw new Error("data/assessments.ts carries no template to draw");

const PAUSE_COPY = sectionOf(dashboardRelationshipDetailPageCopy, "pause");
const label = (id: string): string => itemLabel(PAUSE_COPY, id);

/** The paused facts, as `pauseOf()` reports them at this instant. */
const TRIAL_ENDED: Pause = {
  state: "trial-ended",
  paused: true,
  endsAt: new Date("2026-11-19T00:00:00.000Z"),
  daysLeft: null,
  extended: false,
  extensionAvailable: true,
};
const EXTRA_ENDED: Pause = {
  ...TRIAL_ENDED,
  state: "extra-week-ended",
  extended: true,
  extensionAvailable: false,
};
const RUNNING: Pause = {
  state: "running",
  paused: false,
  endsAt: new Date("2026-11-22T00:00:00.000Z"),
  daysLeft: 3,
  extended: false,
  extensionAvailable: false,
};

function viewOf(input: {
  isInitiator: boolean;
  pause?: Pause;
  canClaimExtension?: boolean;
  trialEndsAt?: string | null;
}): MemberRelationshipView {
  const pause = input.pause ?? TRIAL_ENDED;
  return {
    id: "relationship-1121",
    status: pause.paused ? "expired" : "active",
    viewerRole: input.isInitiator ? "initiator" : "counterparty",
    isInitiator: input.isInitiator,
    templateId: template.id,
    templateSlug: template.slug,
    title: template.title,
    summary: template.summary,
    createdAt: "2026-11-01T00:00:00.000Z",
    publishedAt: "2026-11-02T00:00:00.000Z",
    sessionRecordId: "session-1121",
    aspectCount: template.items.length,
    invite: null,
    counterpartyName: input.isInitiator ? "Rowan" : "Avery",
    initiatorName: "Avery",
    counterpartySeatName: "Rowan",
    view: "invite-claimed",
    membership: pause.paused
      ? {
          state: "lapsed",
          reason: "trial-ended",
          endedAt: new Date("2026-11-19T00:00:00.000Z"),
          writable: false,
        }
      : { state: "open", reason: null, endedAt: null, writable: true },
    template,
    aspectsEditable: false,
    publishable: false,
    completion: null,
    offersRepublish: false,
    trialWithoutLiveInvite: false,
    closed: false,
    trial: pause.paused ? "expired" : "active",
    trialEndsAt: input.trialEndsAt === undefined ? "2026-11-22T00:00:00.000Z" : input.trialEndsAt,
    lapseSentence: null,
    inviteLinkAvailable: false,
    canForkTemplate: false,
    pause,
    trialExtendedAt: pause.extended ? "2026-11-19T12:00:00.000Z" : null,
    canClaimExtension: input.canClaimExtension ?? (input.isInitiator && pause.extensionAvailable),
  };
}

function html(view: MemberRelationshipView, arrival: "extend" | null = null): string {
  const noop = async () => ({ ok: true as const }) as never;
  return renderToStaticMarkup(
    createElement(RelationshipDetail, {
      copy: dashboardRelationshipDetailPageCopy,
      relationship: view,
      onSaveAspects: noop,
      onPublish: noop,
      onRepublish: noop,
      onComplete: noop,
      onFork: noop,
      onClaimExtension: noop,
      arrival,
      templatesHref: "/templates/relationship?view=mine",
    }),
  );
}

describe("#1121 · the Initiator's paused screen", () => {
  it("draws the pause, one status line, and the two ways out", () => {
    const markup = html(viewOf({ isInitiator: true }));

    expect(markup).toContain('data-stage-pause="trial-ended"');
    expect(markup).toContain(label("badge"));
    expect(markup).toContain(label("line"));
    expect(markup).toContain(label("trial-ended-heading"));
    expect(markup).toContain(label("trial-ended-body"));
    expect(markup).toContain(label("add-card"));
    expect(markup).toContain(label("extend"));
    // The read-only bar, and the membership fact that names the pause.
    expect(markup).toContain('data-stage-pause-read-only="true"');
    expect(markup).toContain(label("membership-trial-ended"));
  });

  it("offers the free week once — after the grant the control is gone, not disabled", () => {
    const before = html(viewOf({ isInitiator: true }));
    expect(before).toContain('data-pause-extend="true"');

    const after = html(viewOf({ isInitiator: true, pause: EXTRA_ENDED, canClaimExtension: false }));
    expect(after).not.toContain('data-pause-extend="true"');
    expect(after).toContain(label("extra-ended-heading"));
    // Add a Card is the only action left, and the copy no longer mentions the week.
    expect(after).toContain(label("add-card"));
    expect(after).not.toContain(label("trial-ended-body"));
    expect(after).toContain(label("membership-extra-ended"));
  });

  it("draws the countdown pill only while a window is running, and never a zero", () => {
    const running = html(
      viewOf({ isInitiator: true, pause: RUNNING, trialEndsAt: "2026-11-22T12:00:00.000Z" }),
    );
    expect(running).toContain('data-trial-chip="trial"');
    expect(running).toContain("3 Days Left");

    const paused = html(viewOf({ isInitiator: true }));
    expect(paused).not.toContain("data-trial-chip");
  });

  it("says the week was added, with the end the rows carry, on a `?from=extend` arrival", () => {
    const markup = html(
      viewOf({
        isInitiator: true,
        pause: { ...RUNNING, extended: true, endsAt: new Date("2026-11-26T00:00:00.000Z") },
        trialEndsAt: "2026-11-26T00:00:00.000Z",
      }),
      "extend",
    );
    expect(markup).toContain('data-stage-pause-arrival="extend"');
    expect(markup).toContain("7 More Days Added");
    // The same page without the arrival draws no banner: it is news, not a state.
    expect(html(viewOf({ isInitiator: true }))).not.toContain('data-stage-pause-arrival="extend"');
  });
});

/**
 * #1224 — **the lapse line is written for the seat reading it.**
 *
 * The band's words come from `lapseSentenceOf()` (`lib/relationship/membership.ts`), so this file
 * checks the two halves where a reader would meet them: the Counterparty's render carries no price,
 * trial, card, payment or extension word in the *sentence*, and the Initiator's render names the
 * trial's own numbers rather than the promoted total. The line draws where the pause panel does
 * not — a lapsed membership whose reason is the payment's or the cancellation's, since the trial's
 * own pause is the panel's story and saying it twice is how two strings start disagreeing.
 */
describe("#1224 · the lapse line, per seat", () => {
  /** A lapsed relationship that is **not** the trial's pause, with the line the read would hand it. */
  function lapsedView(isInitiator: boolean, reason: LapseReason = "payment-failed") {
    const membership: Membership = {
      state: "lapsed",
      reason,
      endedAt: new Date("2026-11-19T00:00:00.000Z"),
      writable: false,
    };
    return {
      ...viewOf({ isInitiator, pause: RUNNING }),
      membership,
      lapseSentence: lapseSentenceOf({
        membership,
        seat: isInitiator ? ("initiator" as const) : ("counterparty" as const),
        initiatorName: "Avery",
      }),
    } satisfies MemberRelationshipView;
  }

  it("tells the Counterparty the pause and whose move it is, and no billing word", () => {
    const markup = html(lapsedView(false));
    const text = visibleText(markup);

    expect(markup).toContain('data-membership-sentence="lapsed"');
    expect(text).toContain("stage 6 is paused until avery resumes it. everything is saved.");
    // The issue's must-not list, over the whole render — the band must not reintroduce a word the
    // screen already keeps out.
    for (const forbidden of ["$", "price", "trial", "extension", "add a card", "7 more days"]) {
      expect(text, forbidden).not.toContain(forbidden);
    }
  });

  it("tells the Initiator the trial's own numbers, never the promoted total", () => {
    const markup = html(lapsedView(true, "trial-ended"));
    const text = visibleText(markup);

    expect(markup).toContain('data-membership-sentence="lapsed"');
    expect(text).toContain(
      `${METHOD_TRIAL_DAYS}-day free trial and ${LAPSE_EXTENSION_DAYS}-day free extension`,
    );
    expect(text).toContain("so align is paused");
    expect(text).not.toContain("14-day");
  });

  it("draws the line on the status tokens, with an icon and a word", () => {
    for (const isInitiator of [true, false]) {
      const markup = html(lapsedView(isInitiator));
      expect(markup).toContain("border-status-line bg-status");
      expect(markup).not.toContain("amber-");
      // An icon plus the word, never colour alone (locked rule 2): the pause mark is immediately
      // followed by the status word inside one span.
      expect(markup).toContain("lucide-pause");
      expect(markup).toContain("</svg>Paused</span>");
    }
  });
});

/**
 * The reader-visible text: tags and attributes stripped, because a `data-*` value is a handle. */
function visibleText(markup: string): string {
  return markup
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

describe("#1121 · the Counterparty is never asked to pay", () => {
  const markup = html(viewOf({ isInitiator: false }));
  const text = visibleText(markup);

  it("reads the pause as waiting on the initiator, and keeps its one door", () => {
    expect(markup).toContain('data-stage-pause-role="counterparty"');
    expect(text).toContain("waiting on avery");
    expect(text).toContain("stage 6 is paused until avery resumes it. everything is saved.");
    expect(text).toContain(label("see-results").toLowerCase());
    expect(markup).toContain('data-pause-see-results="true"');
  });

  it("carries no price, no trial, no card ask and no extension", () => {
    // The issue's own must-not list, asserted against the **visible** text — the words a screenshot
    // would not settle, because absence is the claim. A `data-*` value is a handle (`data-stage-pause
    // ="trial-ended"` names the state for the suite above); the reader never sees it.
    //
    // `card` is asserted as the *ask* (`add a card`), not as the bare word: this page's own subtitle
    // says "the card says so" about the relationship card, which is a UI card and not a payment one.
    for (const forbidden of ["$", "price", "trial", "extension", "add a card", "7 more days"]) {
      expect(text, forbidden).not.toContain(forbidden);
    }
  });

  it("draws no control that asks them for anything", () => {
    expect(markup).not.toContain('data-pause-add-card="true"');
    expect(markup).not.toContain('data-pause-extend="true"');
    expect(markup).not.toContain("data-trial-chip");
  });
});
