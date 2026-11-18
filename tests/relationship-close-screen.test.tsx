// @vitest-environment jsdom
/**
 * **The four ending verbs on the relationship screen, and the one thing it must never draw (#1135).**
 *
 * The issue's acceptance line is behavioural: "after Leave, Stage 6 is closed and both parties can
 * still read the results", and #1119 D-E adds the absence — **no Delete Relationship anywhere**. Both
 * are properties of this component, so they are asserted on a mounted DOM rather than on the source:
 *
 *   the invitation   a live, unclaimed invitation draws Copy Invite Link · Resend Invite · Cancel
 *                    Invite, behind a neutral confirm — never a red button and never a delete
 *   declined         the Counterparty's "no" is its own sentence naming who said it (#1125's row
 *                    write, read back here), and it is not reported as a support revocation
 *   the draft        Abandon Draft for a draft nobody was invited to, with its optional reason
 *   closing          Leave for either seat, Request My Removal for the Counterparty with a reason
 *                    that is support's alone, and the request's instant once it exists
 *   the absences     no "Delete", no red destructive control, and a hand-built view with no
 *                    `hygiene` draws none of the panels at all — fail-closed, not fail-open
 *
 * `tests/relationship-close.test.ts` is the other half: what each verb writes, and what it refuses.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { refreshSpy } = vi.hoisted(() => ({ refreshSpy: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshSpy, push: vi.fn(), replace: vi.fn() }),
}));
import { RelationshipDetail } from "@/components/dashboard/relationship-detail";
import { assessments } from "@/data/assessments";
import { dashboardRelationshipDetailPageCopy } from "@/data/pages/dashboard-relationship-detail";
import type { InvitationHygiene, MemberRelationshipView } from "@/lib/member/relationships";
import type {
  AbandonOutcome,
  CancelInviteOutcome,
  LeaveOutcome,
  RemovalRequestOutcome,
  ResendInviteOutcome,
} from "@/lib/member/outcomes";
import { itemLabel, sectionOf } from "@/lib/page-copy";

declare global {
  // React reads this to know it is inside `act()`; without it every update is unmocked.
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const template = assessments[0];
if (template === undefined) throw new Error("data/assessments.ts carries no template to draw");

const HYGIENE = sectionOf(dashboardRelationshipDetailPageCopy, "hygiene");
const CLOSE = sectionOf(dashboardRelationshipDetailPageCopy, "close");
const ABANDON = sectionOf(dashboardRelationshipDetailPageCopy, "abandon");
const VIEW = sectionOf(dashboardRelationshipDetailPageCopy, "view");

const CANCEL = itemLabel(HYGIENE, "cancel");
const RESEND = itemLabel(HYGIENE, "resend");
const LEAVE = itemLabel(CLOSE, "leave");
const REQUEST = itemLabel(CLOSE, "request");
const ABANDON_LABEL = itemLabel(ABANDON, "submit");

/** A hygiene block with every flag off; each case turns on only the verbs it is about. */
function hygieneOf(over: Partial<InvitationHygiene> = {}): InvitationHygiene {
  return {
    canCancelInvite: false,
    canResendInvite: false,
    canAbandon: false,
    canLeave: false,
    canRequestRemoval: false,
    removalRequestedAt: null,
    ...over,
  };
}

function viewOf(input: {
  status: string;
  isInitiator?: boolean;
  view: string;
  hygiene?: InvitationHygiene;
}): MemberRelationshipView {
  const isInitiator = input.isInitiator ?? true;
  return {
    id: "relationship-close",
    status: input.status,
    viewerRole: isInitiator ? "initiator" : "counterparty",
    isInitiator,
    templateId: template.id,
    templateSlug: template.slug,
    title: template.title,
    summary: template.summary,
    createdAt: "2026-11-01T00:00:00.000Z",
    publishedAt: "2026-11-02T00:00:00.000Z",
    sessionRecordId: "session-close",
    aspectCount: template.items.length,
    invite: null,
    counterpartyName: "Rowan",
    initiatorName: "Avery",
    view: input.view,
    membership: { state: "open", reason: null, endedAt: null, writable: true },
    template,
    aspectsEditable: false,
    publishable: false,
    completion: null,
    offersRepublish: false,
    trialWithoutLiveInvite: false,
    closed: input.status === "complete" || input.status === "void",
    trial: "none",
    trialEndsAt: null,
    lapseSentence: null,
    inviteLinkAvailable: false,
    canForkTemplate: false,
    ...(input.hygiene === undefined ? {} : { hygiene: input.hygiene }),
  } as MemberRelationshipView;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  refreshSpy.mockClear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  for (const dialog of document.querySelectorAll("[role='alertdialog']")) {
    dialog.parentElement?.remove();
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

const ANSWER_REFUSED = async () => ({ ok: false as const, code: "failed" });

/** The five ending verbs' real signatures, so a stub may only lie about the *answer*. */
interface Endings {
  onCancelInvite?: (payload: {
    relationshipId?: string;
    reason?: string;
  }) => Promise<CancelInviteOutcome>;
  onResendInvite?: (payload: { sessionRecordId?: string }) => Promise<ResendInviteOutcome>;
  onAbandon?: (payload: { relationshipId?: string; reason?: string }) => Promise<AbandonOutcome>;
  onLeave?: (payload: { relationshipId?: string; reason?: string }) => Promise<LeaveOutcome>;
  onRequestRemoval?: (payload: {
    relationshipId?: string;
    reason?: string;
  }) => Promise<RemovalRequestOutcome>;
}

/** Mount the real component, recording every ending verb the screen can press. */
function mount(view: MemberRelationshipView, over: Endings = {}): void {
  act(() => {
    root.render(
      createElement(RelationshipDetail, {
        copy: dashboardRelationshipDetailPageCopy,
        relationship: view,
        onSaveAspects: ANSWER_REFUSED,
        onPublish: ANSWER_REFUSED,
        onRepublish: ANSWER_REFUSED,
        onComplete: ANSWER_REFUSED,
        onFork: ANSWER_REFUSED,
        onClaimExtension: ANSWER_REFUSED,
        onCancelInvite: over.onCancelInvite ?? ANSWER_REFUSED,
        onResendInvite: over.onResendInvite ?? ANSWER_REFUSED,
        onAbandon: over.onAbandon ?? ANSWER_REFUSED,
        onLeave: over.onLeave ?? ANSWER_REFUSED,
        onRequestRemoval: over.onRequestRemoval ?? ANSWER_REFUSED,
        templatesHref: "/templates/relationship?view=mine",
      }),
    );
  });
}

function buttonIn(scope: ParentNode, label: string): HTMLButtonElement | undefined {
  return [...scope.querySelectorAll("button")].find(
    (element) => element.textContent?.trim() === label,
  );
}

function button(label: string): HTMLButtonElement {
  const found = buttonIn(container, label);
  if (found === undefined) throw new Error(`no button labelled "${label}" on the screen`);
  return found;
}

async function press(element: HTMLButtonElement): Promise<void> {
  await act(async () => {
    element.click();
  });
}

const screen = (): string => container.textContent ?? "";

/* ------------------------------------------------------------------ *
 * The invitation, while it is live
 * ------------------------------------------------------------------ */

describe("a live, unclaimed invitation", () => {
  it("draws the copy, resend and cancel controls under the fixture's own heading", () => {
    mount(
      viewOf({
        status: "published",
        view: "invite-live",
        hygiene: hygieneOf({ canCancelInvite: true, canResendInvite: true }),
      }),
    );

    const panel = container.querySelector("[data-invite-hygiene]");
    expect(panel).not.toBeNull();
    expect(panel?.textContent).toContain(HYGIENE.heading);
    expect(buttonIn(panel as ParentNode, CANCEL)).toBeDefined();
    expect(buttonIn(panel as ParentNode, RESEND)).toBeDefined();
    // Copy Invite Link is drawn only beside a live link this render minted: tokens are never stored,
    // so a fresh load offers Resend instead of a stale copy.
    expect(buttonIn(panel as ParentNode, itemLabel(HYGIENE, "copy"))).toBeUndefined();
  });

  it("puts Cancel behind the neutral confirm, and says what survives", async () => {
    mount(
      viewOf({
        status: "published",
        view: "invite-live",
        hygiene: hygieneOf({ canCancelInvite: true }),
      }),
    );

    await press(button(CANCEL));
    const dialog = document.querySelector("[role='alertdialog']");
    expect(dialog).not.toBeNull();
    // The sentence a person reads before the link dies — that the draft stays is the whole point.
    expect(dialog?.textContent).toContain(itemLabel(HYGIENE, "cancel-confirm"));
    expect(buttonIn(dialog as ParentNode, itemLabel(HYGIENE, "keep"))).toBeDefined();
  });

  it("cancels through the action the page passed, and reports its refusal in words", async () => {
    const onCancelInvite = vi.fn(async () => ({ ok: false as const, code: "invite-dead" }));
    mount(
      viewOf({
        status: "published",
        view: "invite-live",
        hygiene: hygieneOf({ canCancelInvite: true }),
      }),
      { onCancelInvite: onCancelInvite as never },
    );

    await press(button(CANCEL));
    const confirm = container.querySelector("[data-confirm-action]");
    const action = confirm ?? document.querySelector("[data-confirm-action]");
    await act(async () => {
      (action as HTMLElement).click();
    });

    expect(onCancelInvite).toHaveBeenCalledWith({ relationshipId: "relationship-close" });
    // `invite-dead` has a sentence in the fixture; the panel prints it instead of going quiet.
    expect(screen()).toContain(
      itemLabel(sectionOf(dashboardRelationshipDetailPageCopy, "refusals"), "invite-dead"),
    );
  });
});

/* ------------------------------------------------------------------ *
 * The Counterparty's "no"
 * ------------------------------------------------------------------ */

describe("a declined invitation", () => {
  it("is its own sentence, naming the person, and offers the republish", () => {
    mount(
      viewOf({
        status: "published",
        view: "invite-declined",
        hygiene: hygieneOf({ canResendInvite: false }),
      }),
    );

    const sentence = itemLabel(VIEW, "invite-declined").replace("{counterparty}", "Rowan");
    expect(screen()).toContain(sentence);
    /*
     * The two are one row write (`revoked_at`) and different news: a decline must never be reported
     * with the operator-revocation sentence, which is what a reader would take as "support stopped
     * this".
     */
    expect(screen()).not.toContain(
      itemLabel(VIEW, "invite-revoked").replace("{brand}", "AlignSynch"),
    );
  });
});

/* ------------------------------------------------------------------ *
 * The draft
 * ------------------------------------------------------------------ */

describe("a draft nobody was invited to", () => {
  it("offers Abandon Draft with its optional reason, and no invitation panel", () => {
    mount(
      viewOf({ status: "draft", view: "not-published", hygiene: hygieneOf({ canAbandon: true }) }),
    );

    const panel = container.querySelector("[data-abandon-draft]");
    expect(panel).not.toBeNull();
    expect(buttonIn(panel as ParentNode, ABANDON_LABEL)).toBeDefined();
    expect(buttonIn(panel as ParentNode, itemLabel(ABANDON, "reason"))).toBeUndefined();
    const reason = panel?.querySelector("input, textarea");
    expect(reason).not.toBeNull();
    expect(container.querySelector("[data-invite-hygiene]")).toBeNull();
    expect(container.querySelector("[data-close-relationship]")).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * Closing, and leaving
 * ------------------------------------------------------------------ */

describe("a live Stage 6", () => {
  it("gives the Initiator Leave, and no request: leaving is their verb", () => {
    mount(
      viewOf({ status: "active", view: "invite-claimed", hygiene: hygieneOf({ canLeave: true }) }),
    );

    const panel = container.querySelector("[data-close-relationship]");
    expect(panel).not.toBeNull();
    expect(buttonIn(panel as ParentNode, LEAVE)).toBeDefined();
    expect(buttonIn(panel as ParentNode, REQUEST)).toBeUndefined();
    expect(container.querySelector("[data-invite-hygiene]")).toBeNull();
  });

  it("gives the Counterparty Leave and Request My Removal, with a reason only support reads", async () => {
    const onRequestRemoval = vi.fn(async () => ({
      ok: false as const,
      code: "removal-already-requested",
    }));
    mount(
      viewOf({
        status: "active",
        isInitiator: false,
        view: "invite-claimed",
        hygiene: hygieneOf({ canLeave: true, canRequestRemoval: true }),
      }),
      { onRequestRemoval: onRequestRemoval as never },
    );

    const panel = container.querySelector("[data-close-relationship]") as ParentNode;
    expect(buttonIn(panel, LEAVE)).toBeDefined();
    expect(buttonIn(panel, REQUEST)).toBeDefined();
    const input = panel.querySelector("input") as HTMLInputElement;
    expect(input).not.toBeNull();
    // The fixture's own words: "they keep it to themselves" — the promise the read enforces.
    expect(screen()).toContain(itemLabel(CLOSE, "request-reason"));

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, "this is not working");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await press(buttonIn(panel, REQUEST) as HTMLButtonElement);
    const dialog = document.querySelector("[role='alertdialog']");
    const action = dialog?.querySelector("[data-confirm-action]") as HTMLElement;
    await act(async () => {
      action.click();
    });

    expect(onRequestRemoval).toHaveBeenCalledWith({
      relationshipId: "relationship-close",
      reason: "this is not working",
    });
    expect(screen()).toContain(
      itemLabel(
        sectionOf(dashboardRelationshipDetailPageCopy, "refusals"),
        "removal-already-requested",
      ),
    );
  });

  it("says when the request was made, instead of offering it twice", () => {
    mount(
      viewOf({
        status: "active",
        isInitiator: false,
        view: "invite-claimed",
        hygiene: hygieneOf({ removalRequestedAt: "2026-11-15T09:00:00.000Z" }),
      }),
    );

    expect(container.querySelector("[data-removal-requested]")).not.toBeNull();
    expect(buttonIn(container, REQUEST)).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ *
 * The absences
 * ------------------------------------------------------------------ */

describe("what the screen must never draw", () => {
  it("has no delete, no red control, and no destructive word", () => {
    mount(
      viewOf({
        status: "active",
        isInitiator: false,
        view: "invite-claimed",
        hygiene: hygieneOf({ canLeave: true, canRequestRemoval: true }),
      }),
    );

    // #1119 D-E: there is no "Delete Relationship" anywhere in this build.
    expect(screen().toLowerCase()).not.toContain("delete");
    for (const element of container.querySelectorAll("[data-destructive-action]")) {
      const className = element.getAttribute("class") ?? "";
      expect(className).not.toContain("destructive");
      expect(className).not.toContain("red");
    }
  });

  it("draws no ending verb for a closed relationship, and says it is closed", () => {
    mount(viewOf({ status: "complete", view: "complete" }));

    expect(container.querySelector("[data-invite-hygiene]")).toBeNull();
    expect(container.querySelector("[data-abandon-draft]")).toBeNull();
    expect(container.querySelector("[data-close-relationship]")).toBeNull();
    expect(
      container.querySelector("[data-relationship-closed], [data-completion-gate]"),
    ).not.toBeNull();
  });

  it("draws them for nothing when the read carried no hygiene at all", () => {
    // A view literal built by hand (a suite, a fixture) carries no `hygiene`; fail closed, so a
    // missing read can only ever hide a control, never invent one.
    mount(viewOf({ status: "published", view: "invite-live" }));
    expect(container.querySelector("[data-invite-hygiene]")).toBeNull();
    expect(container.querySelector("[data-close-relationship]")).toBeNull();
    expect(container.querySelector("[data-abandon-draft]")).toBeNull();
  });
});
