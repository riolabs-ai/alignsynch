// @vitest-environment jsdom
/**
 * **Completing a relationship charges nothing, and the tree cannot grow a charge back (#1010 R2).**
 *
 * #619 took a fee at completion, against a card captured earlier; #1010 retires that model. The
 * money is the membership bought at stage 5 — one monthly subscription, seven days free — and it
 * already covers every relationship the account runs. So sealing a relationship is a state change
 * and a Gap:
 *
 *   the band          draws the seal and the button, and **nothing about money** — no amount, no
 *                     deadline, no method state, and no door to a card surface
 *   pressing it      answers the status and the instant, never a charge id or an amount
 *   the tree         `chargeOnFile`, `startMethodCapture` and `resolveMethodCapture` are gone —
 *                     asserted on the source, because a deleted path cannot be reached by a later
 *                     card, and a rename is not a deletion
 *   the library      `lib/member/payment.ts` imports no billing module at all, so a completion
 *                     cannot reach a provider even by accident
 *
 * A DOM rather than static markup for the band, because the outcome only exists after a click: the
 * component's state machine is the subject. `tests/relationship-publish-gate.test.tsx` holds the
 * publish-time half of this screen.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
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
import type { CompleteOutcome } from "@/lib/member/outcomes";
import { itemLabel, sectionOf } from "@/lib/page-copy";

declare global {
  // React reads this to know it is inside `act()`; without it every update is unmocked.
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const template = assessments[0];
if (template === undefined) throw new Error("data/assessments.ts carries no template to draw");

const COMPLETION = sectionOf(dashboardRelationshipDetailPageCopy, "completion");
const COMPLETE_LABEL = itemLabel(COMPLETION, "complete");

const ROOT = join(__dirname, "..");

/** A gate in the state each case needs; `null` is a relationship with no session at all. */
function gateOf(overrides: Partial<CompletionGate> = {}): CompletionGate {
  return { sealed: true, ...overrides };
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
    hasMembership: true,
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
function mount(
  view: MemberRelationshipView,
  complete: (payload: {
    relationshipId?: string;
    reason?: string;
  }) => Promise<CompleteOutcome> = async () => ({
    ok: false as const,
    code: "failed",
  }),
): void {
  act(() => {
    root.render(
      createElement(RelationshipDetail, {
        copy: dashboardRelationshipDetailPageCopy,
        relationship: view,
        onSaveAspects: async () => ({ ok: false as const, code: "failed" }),
        onPublish: async () => ({ ok: false as const, code: "failed" }),
        onRepublish: async () => ({ ok: false as const, code: "failed" }),
        onComplete: complete,
        onFork: async () => ({ ok: false as const, code: "failed" }),
        templatesHref: "/templates/relationship?view=mine",
      }),
    );
  });
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

describe("the completion band, which sells nothing", () => {
  it("offers the completion when both sheets are sealed, and draws no money fact", () => {
    mount(viewOf({ gate: gateOf() }));
    const band = container.querySelector("[data-completion-gate]");
    expect(band?.getAttribute("data-completion-gate")).toBe("sealed");
    expect(container.querySelector("[data-completion-sealed]")).not.toBeNull();
    expect(button(COMPLETE_LABEL)).toBeDefined();
    /*
     * #1010 R2 — the assertions that matter most are absences. The band used to draw an amount, a
     * deadline, a method state and a door into a capture; none of those exists any more, and a
     * later card that re-added one would fail here rather than in a screenshot review.
     */
    expect(container.querySelector("[data-completion-amount]")).toBeNull();
    expect(container.querySelector("[data-completion-method]")).toBeNull();
    expect(container.querySelector("[data-capture-method]")).toBeNull();
    expect(container.querySelector("[data-completion-charged]")).toBeNull();
    expect(container.querySelector("[data-completion-expired]")).toBeNull();
    expect(container.textContent).not.toMatch(/\$\d/);
  });

  it("withholds the completion until both sheets are sealed, and says what it is waiting for", () => {
    mount(viewOf({ gate: gateOf({ sealed: false }) }));
    expect(container.querySelector("[data-completion-seal]")).not.toBeNull();
    expect(container.querySelector("[data-complete-relationship]")).toBeNull();
  });

  it("draws nothing at all for the Counterparty — completion is the initiator's click", () => {
    mount(viewOf({ gate: gateOf(), isInitiator: false }));
    expect(container.querySelector("[data-completion-gate]")).toBeNull();
    expect(container.querySelector("[data-completion-refusal]")).toBeNull();
  });

  it("draws nothing on a closed relationship, where there is nothing left to complete", () => {
    mount(viewOf({ gate: gateOf(), closed: true }));
    expect(container.querySelector("[data-completion-gate]")).toBeNull();
  });

  it("draws nothing when the relationship has no session", () => {
    mount(viewOf({ gate: null }));
    expect(container.querySelector("[data-completion-gate]")).toBeNull();
  });
});

describe("pressing complete", () => {
  it("reports the status and the instant, and no amount, because nothing was charged", async () => {
    const complete = vi.fn(async () => ({
      ok: true as const,
      actionId: "action-1",
      status: "complete",
      completedAt: "2026-11-09T10:00:00.000Z",
    }));
    mount(viewOf({ gate: gateOf() }), complete);
    await press(button(COMPLETE_LABEL));
    expect(complete).toHaveBeenCalledWith({ relationshipId: "relationship-completion" });
    const done = container.querySelector("[data-completion-done]");
    expect(done?.getAttribute("data-completion-done")).toBe("complete");
    expect(done?.textContent).not.toMatch(/\$\d/);
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it("prints the server's sentence for the one refusal this band can answer", async () => {
    mount(viewOf({ gate: gateOf() }), async () => ({ ok: false, code: "not-the-payer" }));
    await press(button(COMPLETE_LABEL));
    expect(container.querySelector("[data-completion-refusal]")?.textContent).toBe(
      itemLabel(sectionOf(dashboardRelationshipDetailPageCopy, "refusals"), "not-the-payer"),
    );
    // Nothing happened, so the screen must not pretend the relationship moved.
    expect(container.querySelector("[data-completion-done]")).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * The proof: the money path is gone, not renamed
 * ------------------------------------------------------------------ */

/** Every source file the app ships, as text — the sweep a rename cannot pass. */
function sourceText(path: string): string {
  const absolute = join(ROOT, path);
  return existsSync(absolute) ? readFileSync(absolute, "utf8") : "";
}

describe("completing a relationship cannot charge", () => {
  const PAYMENT = sourceText("lib/member/payment.ts");

  it("reads and writes no provider nouns anywhere in the completion library", () => {
    /*
     * The module that owns completion must not be able to reach a provider at all — not through an
     * import, not through an amount, not through an idempotency key. This is a source sweep on
     * purpose: a mocked network call proves today's behaviour, while an absent import proves that
     * tomorrow's edit has to add one back deliberately, in review, with this test failing.
     */
    expect(PAYMENT).not.toContain("@/lib/billing");
    expect(PAYMENT).not.toMatch(/paymentIntents|payment_intents|off_session|stripe/i);
    expect(PAYMENT).not.toMatch(/chargeOnFile|startMethodCapture|resolveMethodCapture/);
    expect(PAYMENT).not.toMatch(/amountCents|idempotencyKey/);
  });

  it("leaves no charge, capture or setup session in the billing port or its adapters", () => {
    for (const path of [
      "lib/billing/port.ts",
      "lib/billing/index.ts",
      "lib/billing/types.ts",
      "lib/billing/adapters/stripe.ts",
      "lib/billing/adapters/mock.ts",
    ]) {
      const text = sourceText(path);
      expect(text, path).not.toMatch(/chargeOnFile|startMethodCapture|resolveMethodCapture/);
      expect(text, path).not.toMatch(/mode: "setup"/);
    }
  });

  it("has deleted the routes and the job that existed only to charge", () => {
    for (const path of [
      "app/api/billing/payment/route.ts",
      "app/api/billing/payment/return/route.ts",
      "app/api/billing/payment-jobs/route.ts",
      "lib/member/payment-job-run.ts",
      "lib/member/payment-notice.ts",
      "lib/email/templates/payment-reminder.ts",
    ]) {
      expect(existsSync(join(ROOT, path)), path).toBe(false);
    }
  });

  it("gates the Gap on the membership, never on the card the deleted capture wrote", () => {
    /*
     * `instanceStatusOf()` is where `awaiting_payment` is decided, and the projection is what feeds
     * it. With the capture deleted nothing can write `relationship_payment.method_captured_at` any
     * more, so a projection that still read that row would shut every sealed sheet for ever — the
     * exact regression deleting the fee could leave behind. The publish gate and the claim already
     * refuse on `membership.writable`, so the Gap asks the same function.
     */
    const store = sourceText("lib/flow/store.ts");
    expect(store).not.toMatch(/paymentArmedOf/);
    expect(store).toMatch(/paymentArmed\s*=\s*membership\?\.membership\.writable/);
  });

  it("keeps no cron that would call the deleted job", () => {
    const vercel = sourceText("vercel.json");
    expect(vercel).not.toContain("payment-jobs");
  });
});
