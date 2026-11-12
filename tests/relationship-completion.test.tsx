// @vitest-environment jsdom
/**
 * The payer's two acts, and the refusals that are sentences rather than dead ends (#739).
 *
 * The card's diagnosis was that the whole payment workflow was green on the server and reachable
 * from nothing: `capturePaymentMethodAction` and `completeRelationshipAction` had no caller outside
 * their own module, and `relationship-cards.tsx` shipped two controls disabled for good. This file
 * is the half a screenshot cannot cover — that the screen **presses** the actions, and that every
 * outcome they can answer is drawn:
 *
 *   the two acts      a sealed relationship with no method draws the completion, and a door into the
 *                     pay modal — the only surface that takes a card (#912)
 *   payment-required  the refusal carries a url, and the url is a link the person can click —
 *                     the difference between a dead end and a detour
 *   a decline         the provider's own sentence, never a generic failure
 *   not-the-payer     the fee belongs to the initiator, so a Counterparty's screen draws no band
 *   no capture        the screen draws no dialog, no frame and no add-method control: one surface
 *                     captures a card and it is not this one (#912)
 *   completed         the fee's amount and the status the write answered with
 *
 * A DOM rather than static markup because the outcome only exists after a click: the component's
 * state machine is the subject. `tests/relationship-publish-gate.test.tsx` holds the publish-time
 * half of this screen (and the absence assertions), and `tests/flow-payment.test.ts` holds the
 * derivation; this file starts where those stop — at the button.
 */
import { act } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { refreshSpy } = vi.hoisted(() => ({ refreshSpy: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshSpy, push: vi.fn(), replace: vi.fn() }),
}));
import { RelationshipDetail } from "@/components/dashboard/relationship-detail";
import { assessments } from "@/data/assessments";
import { dashboardRelationshipDetailPageCopy } from "@/data/pages/dashboard-relationship-detail";
import type { CompletionGate } from "@/lib/member/payment";
import type { MemberRelationshipView } from "@/lib/member/relationships";
import type { CaptureOutcome, CompleteOutcome } from "@/lib/member/outcomes";
import { itemLabel, sectionOf } from "@/lib/page-copy";

declare global {
  // React reads this to know it is inside `act()`; without it every update is unmocked.
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const template = assessments[0];
if (template === undefined) throw new Error("data/assessments.ts carries no template to draw");

const COMPLETION = sectionOf(dashboardRelationshipDetailPageCopy, "completion");
const CAPTURE_LABEL = itemLabel(COMPLETION, "capture");
const COMPLETE_LABEL = itemLabel(COMPLETION, "complete");

/** A gate in the state each case needs; `null` is a relationship with no session at all. */
function gateOf(overrides: Partial<CompletionGate> = {}): CompletionGate {
  return {
    sealed: true,
    phase: "none",
    hasMethod: false,
    awaitingPayment: true,
    amountCents: 1900,
    deadlineAt: "2026-11-16T00:00:00.000Z",
    chargedAt: null,
    ...overrides,
  };
}

function viewOf(input: {
  gate: CompletionGate | null;
  isInitiator?: boolean;
  closed?: boolean;
}): MemberRelationshipView {
  const isInitiator = input.isInitiator ?? true;
  return {
    id: "relationship-completion",
    status: input.closed === true ? "complete" : "active",
    viewerRole: isInitiator ? "initiator" : "counterparty",
    isInitiator,
    templateId: template.id,
    templateSlug: template.slug,
    title: template.title,
    summary: template.summary,
    createdAt: "2026-11-01T00:00:00.000Z",
    publishedAt: "2026-11-02T00:00:00.000Z",
    sessionRecordId: "session-completion",
    aspectCount: template.items.length,
    invite: null,
    counterpartyName: "Rowan",
    initiatorName: "Avery",
    view: "invite-claimed",
    membership: { state: "open", reason: null, endedAt: null, writable: true },
    template,
    aspectsEditable: false,
    publishable: false,
    hasPaymentMethod: input.gate?.hasMethod === true,
    completion: input.gate,
    offersRepublish: false,
    trialWithoutLiveInvite: false,
    closed: input.closed === true,
    trial: "none",
    trialEndsAt: null,
    lapseSentence: null,
    inviteLinkAvailable: false,
    /* #785 — the fork is not this file's subject; `tests/relationship-fork.test.tsx` drives it. */
    canForkTemplate: false,
  };
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
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

/** Mount the real component with the one callback a case needs. */
interface Press {
  readonly complete?: (payload: {
    relationshipId?: string;
    planId?: string;
    reason?: string;
  }) => Promise<CompleteOutcome>;
}

function mount(view: MemberRelationshipView, press: Press = {}): void {
  act(() => {
    root.render(
      createElement(RelationshipDetail, {
        copy: dashboardRelationshipDetailPageCopy,
        relationship: view,
        onSaveAspects: async () => ({ ok: false as const, code: "failed" }),
        onPublish: async () => ({ ok: false as const, code: "failed" }),
        onRepublish: async () => ({ ok: false as const, code: "failed" }),
        onComplete: press.complete ?? (async () => ({ ok: false as const, code: "failed" })),
        onFork: async () => ({ ok: false as const, code: "failed" }),
        templatesHref: "/templates/relationship?view=mine",
      }),
    );
  });
}

/**
 * #912 — **the payment door is a link, not a capture.** The band used to draw a button that opened
 * `PaymentCaptureDialog`; that component is deleted, so the control this file is about is the anchor
 * the band draws instead. `null` means the band drew no door at all.
 */
function payDoor(): HTMLAnchorElement | null {
  return container.querySelector<HTMLAnchorElement>("[data-capture-method]");
}

/** The button whose label is `label` — the person clicks a word, not an attribute. */
function button(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find(
    (element) => element.textContent?.trim() === label,
  );
  if (found === undefined) throw new Error(`no button labelled "${label}" on the screen`);
  return found;
}

async function press(element: HTMLButtonElement): Promise<void> {
  await act(async () => {
    element.click();
  });
}

describe("the payer's band", () => {
  it("offers both acts when the sheets are sealed and no method is on file", () => {
    mount(viewOf({ gate: gateOf() }));
    const band = container.querySelector("[data-completion-gate]");
    expect(band?.getAttribute("data-completion-gate")).toBe("none");
    expect(band?.getAttribute("data-completion-sealed")).toBe("true");
    expect(payDoor()).not.toBeNull();
    expect(button(COMPLETE_LABEL)).toBeDefined();
    expect(container.querySelector('[data-completion-method="missing"]')).not.toBeNull();
    expect(
      container.querySelector("[data-completion-amount]")?.getAttribute("data-completion-amount"),
    ).toBe("1900");
  });

  it("withholds the completion until both sheets are sealed, and says what it is waiting for", () => {
    mount(viewOf({ gate: gateOf({ sealed: false, awaitingPayment: false, deadlineAt: null }) }));
    expect(container.querySelector("[data-completion-seal]")).not.toBeNull();
    expect(container.querySelector("[data-complete-relationship]")).toBeNull();
    expect(payDoor()).not.toBeNull();
  });

  it("draws only the completion once a method is on file", () => {
    mount(
      viewOf({ gate: gateOf({ phase: "method-on-file", hasMethod: true, awaitingPayment: true }) }),
    );
    expect(container.querySelector("[data-capture-method]")).toBeNull();
    expect(
      container.querySelector("[data-completion-method]")?.getAttribute("data-completion-method"),
    ).toBe("on-file");
    expect(button(COMPLETE_LABEL)).toBeDefined();
  });

  it("says the fee landed, and stops offering the acts, when the phase is charged", () => {
    mount(
      viewOf({
        gate: gateOf({
          phase: "charged",
          hasMethod: true,
          awaitingPayment: false,
          chargedAt: "2026-11-09T10:00:00.000Z",
          amountCents: 1900,
        }),
      }),
    );
    expect(container.querySelector("[data-completion-charged]")).not.toBeNull();
    expect(container.querySelector("[data-capture-method]")).toBeNull();
    expect(container.querySelector("[data-complete-relationship]")).toBeNull();
  });

  it("answers an expired obligation with a sentence, not a button", () => {
    mount(viewOf({ gate: gateOf({ phase: "expired", awaitingPayment: true }) }));
    expect(container.querySelector("[data-completion-expired]")).not.toBeNull();
    expect(container.querySelector("[data-capture-method]")).toBeNull();
    expect(container.querySelector("[data-complete-relationship]")).toBeNull();
  });

  it("draws nothing at all for the Counterparty — the fee is not theirs", () => {
    mount(viewOf({ gate: gateOf(), isInitiator: false }));
    expect(container.querySelector("[data-completion-gate]")).toBeNull();
    expect(container.querySelector("[data-completion-refusal]")).toBeNull();
  });

  it("draws nothing on a closed relationship, where there is nothing left to complete", () => {
    mount(viewOf({ gate: gateOf(), closed: true }));
    expect(container.querySelector("[data-completion-gate]")).toBeNull();
  });
});

describe("the payment door on the payer's band", () => {
  it("is a link into the pay modal, carrying both handles the stage resolves (#912)", () => {
    mount(viewOf({ gate: gateOf() }));
    const door = payDoor();
    expect(door).not.toBeNull();
    expect(door?.textContent?.trim()).toBe(CAPTURE_LABEL);
    /*
     * The modal's own address, built by `createInviteForPath()`: the relationship's **copy** in the
     * path (`#794` — a slug, not the storage id) and its session in `?instance=`. Asserting the
     * whole string is the point: a link that dropped the query would land on stage 1 with the
     * relationship forgotten, and a link that put `templateId` in the path would ship a storage
     * handle in a URL.
     */
    expect(door?.getAttribute("href")).toBe(
      `/templates/relationship/${template.slug}/create/invite?instance=session-completion`,
    );
  });

  it("draws no capture on the screen at all — no dialog, no frame, no add-method control", () => {
    mount(viewOf({ gate: gateOf() }));
    expect(container.querySelector("[data-capture-dialog]")).toBeNull();
    expect(container.querySelector("[data-add-method]")).toBeNull();
    expect(container.querySelector("[data-capture-frame]")).toBeNull();
    expect(container.querySelector("[data-capture-plan]")).toBeNull();
  });

  it("draws no door when the relationship has no session for the modal to read", () => {
    /*
     * A draft written by the list's own create band has no session, so stage 5 answers it by
     * redirecting to stage 1 — a door that bounces is worse than a sentence. The band cannot render
     * for such a row (`completion` is null without a session), which is why this asserts the absence
     * of the control rather than of the link.
     */
    mount(viewOf({ gate: null }));
    expect(container.querySelector("[data-completion-gate]")).toBeNull();
    expect(payDoor()).toBeNull();
  });
});

describe("a relationship the fee already moved", () => {
  it("keeps the receipt once the relationship is complete — a paid, closed row still says so", () => {
    mount(
      viewOf({
        gate: gateOf({
          hasMethod: true,
          phase: "charged",
          awaitingPayment: false,
          chargedAt: "2026-11-09T10:00:00.000Z",
        }),
        closed: true,
      }),
    );
    // `closed` is what hides the band, so a receipt that renders only while the relationship is
    // open would be invisible exactly when it is true: the payer would be told nothing about money
    // that moved. The band survives the completion and the two acts do not.
    const band = container.querySelector("[data-completion-gate]");
    expect(band?.getAttribute("data-completion-gate")).toBe("charged");
    expect(container.querySelector("[data-completion-charged]")?.textContent).toContain("$19.00");
    expect(container.querySelector("[data-capture-method]")).toBeNull();
    expect(container.querySelector("[data-complete-relationship]")).toBeNull();
  });

  it("draws nothing on a closed relationship whose fee never landed", () => {
    mount(viewOf({ gate: gateOf({ phase: "expired" }), closed: true }));
    expect(container.querySelector("[data-completion-gate]")).toBeNull();
  });

  it("draws nothing of the payer's on the Counterparty's screen, charged or not", () => {
    mount(
      viewOf({
        gate: gateOf({ hasMethod: true, phase: "charged", chargedAt: "2026-11-09T10:00:00.000Z" }),
        isInitiator: false,
        closed: true,
      }),
    );
    expect(container.querySelector("[data-completion-gate]")).toBeNull();
  });
});

describe("pressing complete", () => {
  it("charges through the action and reports the amount and the status it answered", async () => {
    const complete = vi.fn(async () => ({
      ok: true as const,
      actionId: "action-1",
      status: "complete",
      chargedAt: "2026-11-09T10:00:00.000Z",
      amountCents: 1900,
    }));
    mount(viewOf({ gate: gateOf({ hasMethod: true, phase: "method-on-file" }) }), { complete });
    await press(button(COMPLETE_LABEL));
    expect(complete).toHaveBeenCalledWith({ relationshipId: "relationship-completion" });
    const done = container.querySelector("[data-completion-done]");
    expect(done?.getAttribute("data-completion-done")).toBe("complete");
    expect(done?.textContent).toContain("$19.00");
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it("turns payment-method-required into a sentence **and** a working link", async () => {
    mount(viewOf({ gate: gateOf({ hasMethod: true, phase: "method-on-file" }) }), {
      complete: async () => ({
        ok: false,
        code: "payment-method-required",
        url: "https://checkout.example.test/cs_test_2",
      }),
    });
    await press(button(COMPLETE_LABEL));
    const refusal = container.querySelector("[data-completion-refusal]");
    expect(refusal?.getAttribute("data-completion-refusal")).toBe("payment-method-required");
    // The server's own words when it sent any; the fixture's sentence when it did not.
    expect(refusal?.textContent?.length ?? 0).toBeGreaterThan(20);
    expect(container.querySelector("[data-completion-link]")?.getAttribute("href")).toBe(
      "https://checkout.example.test/cs_test_2",
    );
    // Nothing was charged, so the screen must not pretend the relationship moved.
    expect(container.querySelector("[data-completion-done]")).toBeNull();
  });

  it("prints the provider's sentence for a decline", async () => {
    mount(viewOf({ gate: gateOf({ hasMethod: true, phase: "method-on-file" }) }), {
      complete: async () => ({
        ok: false,
        code: "charge-declined",
        message: "the fee was declined (card_declined): Your card was declined.",
      }),
    });
    await press(button(COMPLETE_LABEL));
    const refusal = container.querySelector("[data-completion-refusal]");
    expect(refusal?.getAttribute("data-completion-refusal")).toBe("charge-declined");
    expect(refusal?.textContent).toContain("card_declined");
    expect(container.querySelector("[data-completion-link]")).toBeNull();
  });

  it("says whose fee it is when the payer is not this account", async () => {
    mount(viewOf({ gate: gateOf({ hasMethod: true, phase: "method-on-file" }) }), {
      complete: async () => ({ ok: false, code: "not-the-payer" }),
    });
    await press(button(COMPLETE_LABEL));
    expect(container.querySelector("[data-completion-refusal]")?.textContent).toBe(
      itemLabel(sectionOf(dashboardRelationshipDetailPageCopy, "refusals"), "not-the-payer"),
    );
  });
});
