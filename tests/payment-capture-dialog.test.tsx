// @vitest-environment jsdom
/**
 * The capture dialog — the artifact's plan card, and the provider's frame inside the page (#748).
 *
 * The card's acceptance for the UI half is three sentences, and each one is a thing a static
 * screenshot cannot prove:
 *
 *   1. **The copy is the artifact's, verbatim.** Every string on this surface is asserted against
 *      `data/pages/dashboard-relationship-detail.ts` (section `capture`) rather than against a
 *      literal typed here — so the test fails if the fixture drifts from the approved words, and it
 *      cannot pass by agreeing with itself.
 *   2. **The frame is mounted by `@stripe/stripe-js`, not by an `<iframe>` we wrote.** The module is
 *      mocked, and the case asserts the loader was called with the publishable key and that
 *      `createEmbeddedCheckoutPage` mounted our node with the session's client secret.
 *   3. **Nothing navigates.** The dialog answers a capture in place: the router is not refreshed, no
 *      anchor to the provider exists, and the dialog stays on the frame stage with the method's
 *      completion resolved through the callback the screen passed in.
 *
 * The prices are asserted against `data/billing-plans.ts` **and against the artifact's numbers being
 * absent**: the prototype prints `$9.95` / `$19.85`, this product sells 895 / 1_695, and the case
 * pins the fixture's figure so a "make the copy match the mockup" edit cannot quietly start
 * promising a price no checkout charges.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { refreshSpy, pushSpy, stripe } = vi.hoisted(() => {
  const created: {
    clientSecret: string | null;
    mountedAt: string | null;
    destroyed: number;
  } = { clientSecret: null, mountedAt: null, destroyed: 0 };
  return {
    refreshSpy: vi.fn(),
    pushSpy: vi.fn(),
    stripe: {
      created,
      loadStripe: vi.fn(async () => ({
        createEmbeddedCheckoutPage: async (options: {
          clientSecret?: string;
          onComplete?: () => void;
        }) => {
          created.clientSecret = options.clientSecret ?? null;
          return {
            mount: (element: HTMLElement) => {
              created.mountedAt = element.getAttribute("data-stripe-embedded-checkout");
              element.setAttribute("data-frame-mounted", "true");
            },
            unmount: () => undefined,
            destroy: () => {
              created.destroyed += 1;
            },
          };
        },
      })),
    },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshSpy, push: pushSpy, replace: vi.fn() }),
}));

vi.mock("@stripe/stripe-js", () => ({ loadStripe: stripe.loadStripe }));

import { RelationshipDetail } from "@/components/dashboard/relationship-detail";
import { assessments } from "@/data/assessments";
import { billingPlan, planPriceCents } from "@/data/billing-plans";
import { dashboardRelationshipDetailPageCopy } from "@/data/pages/dashboard-relationship-detail";
import { formatCurrencyAmount } from "@/content/metrics";
import type { CaptureOutcome } from "@/lib/member/outcomes";
import type { CompletionGate } from "@/lib/member/payment";
import type { MemberRelationshipView } from "@/lib/member/relationships";
import { itemLabel, sectionOf } from "@/lib/page-copy";

declare global {
  // React reads this to know it is inside `act()`; without it every update is unmocked.
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const template = assessments[0];
if (template === undefined) throw new Error("data/assessments.ts carries no template to draw");

const CAPTURE = sectionOf(dashboardRelationshipDetailPageCopy, "capture");
const COMPLETION = sectionOf(dashboardRelationshipDetailPageCopy, "completion");
const REFUSALS = sectionOf(dashboardRelationshipDetailPageCopy, "refusals");

function gateOf(overrides: Partial<CompletionGate> = {}): CompletionGate {
  return {
    sealed: true,
    phase: "none",
    hasMethod: false,
    awaitingPayment: true,
    amountCents: 895,
    deadlineAt: "2026-11-16T00:00:00.000Z",
    chargedAt: null,
    ...overrides,
  };
}

function viewOf(gate: CompletionGate): MemberRelationshipView {
  return {
    id: "relationship-capture",
    status: "active",
    viewerRole: "initiator",
    isInitiator: true,
    templateId: template.id,
    title: template.title,
    summary: template.summary,
    createdAt: "2026-11-01T00:00:00.000Z",
    publishedAt: "2026-11-02T00:00:00.000Z",
    sessionRecordId: "session-capture",
    aspectCount: template.items.length,
    invite: null,
    counterpartyName: "Rowan",
    initiatorName: "Avery",
    view: "invite-claimed",
    membership: { state: "open", reason: null, endedAt: null, writable: true },
    template,
    aspectsEditable: false,
    publishable: false,
    hasPaymentMethod: gate.hasMethod,
    completion: gate,
    offersRepublish: false,
    trialWithoutLiveInvite: false,
    closed: false,
    trial: "none",
    trialEndsAt: null,
    lapseSentence: null,
    inviteLinkAvailable: false,
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  refreshSpy.mockClear();
  pushSpy.mockClear();
  stripe.created.clientSecret = null;
  stripe.created.mountedAt = null;
  stripe.created.destroyed = 0;
  stripe.loadStripe.mockClear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.removeAttribute("style");
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

function mount(
  capture: (payload: { relationshipId?: string; presentation?: string }) => Promise<CaptureOutcome>,
  resolve: (payload: {
    relationshipId?: string;
    captureSessionId?: string;
  }) => Promise<CaptureOutcome> = async () => ({ ok: false, code: "failed" }),
): void {
  act(() => {
    root.render(
      createElement(RelationshipDetail, {
        copy: dashboardRelationshipDetailPageCopy,
        relationship: viewOf(gateOf()),
        backHref: "/dashboard/relationships",
        onSaveAspects: async () => ({ ok: false as const, code: "failed" }),
        onPublish: async () => ({ ok: false as const, code: "failed" }),
        onRepublish: async () => ({ ok: false as const, code: "failed" }),
        onCapture: capture,
        onResolve: resolve,
        onComplete: async () => ({ ok: false as const, code: "failed" }),
      }),
    );
  });
}

async function press(element: HTMLElement | null): Promise<void> {
  if (element === null) throw new Error("the control the case presses is not on the screen");
  await act(async () => {
    element.click();
  });
  // One more turn: the dialog's mount effect resolves asynchronously and React commits after it.
  await act(async () => {
    await Promise.resolve();
  });
}

const dialog = (): Element | null => container.querySelector("[data-capture-dialog]");
const addMethod = (): HTMLElement | null =>
  container.querySelector<HTMLElement>("[data-add-method]");
const captureButton = (): HTMLElement | null =>
  container.querySelector<HTMLElement>("[data-capture-method]");

describe("the dialog the capture opens", () => {
  it("draws the artifact's plan card, word for word from the fixture", async () => {
    mount(async () => ({ ok: true, url: null }));
    await press(captureButton());

    expect(dialog()).not.toBeNull();
    const text = dialog()?.textContent ?? "";
    for (const id of [
      "trial",
      "plan-payg",
      "plan-payg-note",
      "plan-unlimited",
      "plan-unlimited-note",
      "price-per",
      "best-value",
      "add-method",
      "skip",
    ]) {
      expect(text).toContain(itemLabel(CAPTURE, id));
    }
    // The section's own heading and body are the artifact's `s8.plansHeading` / `s8.payBody`.
    expect(text).toContain(CAPTURE.heading);
    expect(text).toContain(CAPTURE.body ?? "");
  });

  it("prices the rows from the billing fixture, never from the artifact's figures", async () => {
    mount(async () => ({ ok: true, url: null }));
    await press(captureButton());

    const payg = container.querySelector("[data-capture-plan='basic']")?.textContent ?? "";
    const unlimited = container.querySelector("[data-capture-plan='principal']")?.textContent ?? "";
    const basic = billingPlan("basic");
    const principal = billingPlan("principal");
    if (basic === undefined || principal === undefined) throw new Error("fixture tiers missing");

    expect(payg).toContain(formatCurrencyAmount(planPriceCents(basic, "month")));
    expect(unlimited).toContain(formatCurrencyAmount(planPriceCents(principal, "month")));
    // The prototype's prices are not this product's, and a screen must not promise one.
    expect(dialog()?.textContent).not.toContain("$9.95");
    expect(dialog()?.textContent).not.toContain("$19.85");
  });

  it("mounts the provider's frame with the session's client secret, and navigates nowhere", async () => {
    const capture = vi.fn(async () => ({
      ok: true as const,
      url: null,
      clientSecret: "cs_test_secret",
      publishableKey: "pk_test_dialog",
      captureSessionId: "cs_test_dialog",
    }));
    mount(capture);

    await press(captureButton());
    await press(addMethod());

    expect(capture).toHaveBeenCalledWith({
      relationshipId: "relationship-capture",
      presentation: "embedded",
    });
    // The loader is the provider's own, called with the publishable key the server sent.
    expect(stripe.loadStripe).toHaveBeenCalledWith("pk_test_dialog");
    expect(stripe.created.clientSecret).toBe("cs_test_secret");
    // And it mounted *our* node — the frame is inside this page.
    expect(stripe.created.mountedAt).toBe("true");

    const frameStage = container.querySelector("[data-capture-frame='embedded']");
    expect(frameStage).not.toBeNull();
    expect(frameStage?.textContent).toContain(itemLabel(CAPTURE, "secure"));
    expect(frameStage?.textContent).toContain(itemLabel(CAPTURE, "test-mode"));
    expect(frameStage?.textContent).toContain(itemLabel(CAPTURE, "frame-body"));
    expect(frameStage?.textContent).toContain(itemLabel(CAPTURE, "frame-note"));

    // No navigation: the router was not asked to move, and no anchor leaves for the provider.
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(pushSpy).not.toHaveBeenCalled();
    expect(container.querySelector("[data-capture-link]")).toBeNull();
    expect(dialog()?.getAttribute("data-capture-stage")).toBe("frame");
  });

  it("closes on the artifact's cancel, and destroys the frame it mounted", async () => {
    mount(async () => ({
      ok: true as const,
      url: null,
      clientSecret: "cs_test_secret",
      publishableKey: "pk_test_dialog",
      captureSessionId: "cs_test_dialog",
    }));
    await press(captureButton());
    await press(addMethod());

    const cancel = container.querySelector<HTMLElement>("[data-closepay]");
    await press(cancel);

    expect(container.querySelector("[data-capture-frame='embedded']")).toBeNull();
    // A frame left behind keeps a listener on a dead component; the dialog destroys it on the way out.
    expect(stripe.created.destroyed).toBeGreaterThanOrEqual(1);
  });

  it("draws the server's sentence when the capture is refused, and mounts nothing", async () => {
    mount(async () => ({
      ok: false as const,
      code: "not-configured",
      message: "STRIPE_TEST_SECRET_KEY is not set — the billing adapter has no key",
    }));
    await press(captureButton());
    await press(addMethod());

    expect(container.querySelector("[data-capture-refusal]")?.textContent).toContain(
      "STRIPE_TEST_SECRET_KEY is not set",
    );
    expect(stripe.loadStripe).not.toHaveBeenCalled();
    // The band underneath did not move: nothing was captured and nothing was charged.
    expect(container.querySelector("[data-capture-method-recorded]")).toBeNull();
  });

  it("uses the page's own not-configured sentence when the server sends none", async () => {
    mount(async () => ({ ok: false as const, code: "not-configured" }));
    await press(captureButton());
    await press(addMethod());

    expect(container.querySelector("[data-capture-refusal]")?.textContent).toBe(
      itemLabel(REFUSALS, "not-configured"),
    );
  });

  it("closes and reports an inline capture — the keyless adapter still takes one click", async () => {
    mount(async () => ({ ok: true as const, url: null, captured: true }));
    await press(captureButton());
    await press(addMethod());

    expect(dialog()).toBeNull();
    expect(container.querySelector("[data-capture-method-recorded]")).not.toBeNull();
    // The band re-reads the row rather than believing the client: this render is a snapshot of the
    // props it was given, so it still reads "missing" until the server's refresh lands.
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[data-completion-method]")?.textContent).toBe(
      itemLabel(COMPLETION, "method-missing"),
    );
  });
});
