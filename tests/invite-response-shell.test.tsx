/**
 * The invite-response path in the flow's one modal (#710) — the shell, the rail, the deep link and
 * the exit.
 *
 * The card's acceptance is four facts, and three of them are visible in static markup — which is
 * the whole reason this file renders instead of screenshotting:
 *
 *   1. **The response renders inside `StageShell`.** The invitation's wizard is not a second flow:
 *      the dialog, its close control and the six-stage rail come from the components the create
 *      flow already draws, and the screen is stage 5 — **Connect** — with `Align` unavailable
 *      because nothing is shared yet.
 *   2. **The stage is in the server's HTML, so a deep link and a refresh land on it.** The shell
 *      renders in place rather than through `DialogPortal`, and the three onboarding screens are
 *      each addressed by `?step=` with the token in the path — `inviteWizardStepOf()` reads the
 *      query, and an unknown value lands on step 1 instead of a 404.
 *   3. **A completed response closes onto `/dashboard`.** That decision is `afterClaimTarget()` in
 *      `lib/flow/paths.ts`, asserted here rather than restated in the route, plus one source rule
 *      proving the claim handler is its caller.
 *   4. **No `Ongoing` surface is involved.** The exit names a screen the relationship owns; the
 *      retired seventh stage is not a destination anywhere on this path.
 *
 * The page module itself needs a live row to mount, so its half is a source rule — the same
 * technique `tests/stage-modal.test.tsx` uses for Sent and the account gate.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CounterpartyWizard } from "@/components/assessment-flow/counterparty-wizard";
import { invitePageCopy } from "@/data/pages/invite";
import { afterClaimTarget, instancePath, inviteStepPath, OVERVIEW_PATH } from "@/lib/flow/paths";
import { inviteWizardStepOf } from "@/lib/flow/paths";
import type { InvitePreview } from "@/lib/flow/store";

/**
 * `StageShell`'s only Next dependency is `useRouter`, and no render here navigates: stubbing it
 * keeps a render a render. (A static render cannot press a close control, and a test of the stub
 * would prove nothing about the app.)
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

/** The six names the binding spec fixes, in order (`docs/specs/flow-stages.md`). */
const STAGE_NAMES = ["Details", "Settings", "Aspects", "Invite", "Connect", "Align"] as const;

/** The index of `Connect` in that list — the stage the response is. */
const CONNECT_POSITION = 5;

const TOKEN = "k".repeat(43);

const PREVIEW: InvitePreview = {
  state: "claimable",
  instanceRecordId: "instance-response-1",
  initiatorName: "Avery",
  counterpartyName: "Rowan",
  templateTitle: "Relationship Basics",
  viewerRole: null,
};

function responseHtml(step: 1 | 2 | 3, viewerName: string | null = null): string {
  return renderToStaticMarkup(
    createElement(CounterpartyWizard, {
      copy: invitePageCopy,
      preview: PREVIEW,
      token: TOKEN,
      step,
      viewerName,
    }),
  );
}

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

/** The open panel's own attributes — where the shell's two presentations live. */
function panelOf(html: string): string {
  return /data-stage-shell="true"[^>]*/.exec(html)?.[0] ?? "";
}

/** The Align cell, as the rail draws it. */
function alignCell(html: string): string {
  return /data-step-cell="6"[^>]*>[\s\S]*?(?=data-step-cell|<\/nav>)/.exec(html)?.[0] ?? "";
}

describe("the response path renders in the flow's one modal", () => {
  it("draws the shared shell, with the close control leaving onto an address", () => {
    const html = responseHtml(1);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('data-stage-shell="true"');
    // The exit is a path, not a piece of state: closing is navigation (#709's contract).
    expect(html).toContain(`data-stage-close="${OVERVIEW_PATH}"`);
    expect(html).toContain('aria-label="Close"');
    // The stage is in the server's string, not mounted by a client after hydration.
    expect(html).toContain("Avery invited you to answer Relationship Basics.");
  });

  it("keeps the shell's two presentations — the 390 sheet and the ≥1024 inset dialog", () => {
    const panel = panelOf(responseHtml(1));
    expect(panel).toContain("inset-0");
    expect(panel).toContain("lg:inset-6");
    expect(panel).toContain("lg:rounded-lg");
    expect(panel).toContain("lg:border");
  });

  it("sits at Connect — stage 5 of 6 — and draws Align as the unavailable sixth cell", () => {
    const html = responseHtml(1);
    expect(html).toContain(`Stage ${CONNECT_POSITION} of 6`);
    // Six cells, the same rail every other stage draws.
    expect(html.split("data-step-cell=").length - 1).toBe(6);
    for (const name of STAGE_NAMES) expect(html).toContain(name);
    // Connect is the current cell; Align is drawn but not live — nothing is shared yet.
    expect(html).toContain('data-step-state="current"');
    expect(alignCell(html)).toContain('data-step-state="unavailable"');
  });

  it("renders on the shared stage column, not a centred column of its own", () => {
    const html = responseHtml(1);
    // The column itself is still left-flush inside whatever frames it (#687): a max width, and no
    // centring of its own.
    const column = /class="([^"]*max-w-\[1126px\][^"]*)"/.exec(html)?.[1] ?? "";
    expect(column).toContain("w-full");
    expect(column).not.toContain("mx-auto");
    // Since #760 the *panel* is centred, because the artifact caps it at 880px — that is the
    // shell's box, not the column's, and the two are asserted separately on purpose.
    expect(panelOf(html)).toContain("lg:mx-auto");
  });

  it("has exactly one progress band — the six-stage rail, not a second step rail", () => {
    const html = responseHtml(2);
    // The retired `Step {n} of 3` line and its band are gone: one progress pattern (#716).
    expect(html).not.toMatch(/Step \d of 3/);
    expect(html.split("<nav").length - 1).toBe(1);
  });
});

describe("an invitation deep link resolves to the response stage", () => {
  it("reads the step from the query, and lands on step 1 for anything it does not know", () => {
    expect(inviteWizardStepOf("1")).toBe(1);
    expect(inviteWizardStepOf("2")).toBe(2);
    expect(inviteWizardStepOf("3")).toBe(3);
    // A reader's position is not an address that can be wrong.
    expect(inviteWizardStepOf(undefined)).toBe(1);
    expect(inviteWizardStepOf("4")).toBe(1);
    expect(inviteWizardStepOf("")).toBe(1);
    expect(inviteWizardStepOf(["3", "1"])).toBe(3);
  });

  it("keeps the token in the path on every step, so a refresh returns to the same screen", () => {
    expect(inviteStepPath(TOKEN, 1)).toBe(`/invite/${TOKEN}`);
    for (const step of [2, 3] as const) {
      expect(inviteStepPath(TOKEN, step)).toBe(`/invite/${TOKEN}?step=${step}`);
    }
  });

  it("renders every step inside the one shell — a deep link, not a second page", () => {
    for (const step of [1, 2, 3] as const) {
      const html = responseHtml(step);
      expect(html, `step ${step}`).toContain('data-stage-shell="true"');
      expect(html, `step ${step}`).toContain(`Stage ${CONNECT_POSITION} of 6`);
    }
  });

  it("is the page's own wiring — the route hands its query to the wizard, unclaimed", () => {
    const page = source("app/(mainlayout)/invite/[token]/page.tsx");
    expect(page).toContain("inviteWizardStepOf(rawStep)");
    expect(page).toContain("<CounterpartyWizard");
    // The GET stays inert: claiming is the POST, and the page only previews.
    expect(page).toContain("previewInvite(");
    expect(page).not.toContain("claimInvite(");
  });
});

describe("a completed response closes onto /dashboard", () => {
  it("lands a signed-in claimer on the console, where the relationship is listed", () => {
    expect(
      afterClaimTarget({ viewerSignedIn: true, instanceRecordId: PREVIEW.instanceRecordId ?? "" }),
    ).toBe(OVERVIEW_PATH);
  });

  it("keeps a signed-out claim on the relationship it just bound", () => {
    expect(afterClaimTarget({ viewerSignedIn: false, instanceRecordId: "instance-1" })).toBe(
      instancePath("instance-1"),
    );
  });

  it("names no `Ongoing` surface on either exit — that stage does not exist", () => {
    for (const viewerSignedIn of [true, false]) {
      const target = afterClaimTarget({ viewerSignedIn, instanceRecordId: "instance-1" });
      expect(target).not.toMatch(/ongoing/i);
    }
  });

  it("is the claim handler that asks for it, so the route has no second copy of the rule", () => {
    const route = source("app/(mainlayout)/invite/[token]/claim/route.ts");
    expect(route).toContain("afterClaimTarget({");
    expect(route).toContain("viewerSignedIn: viewer !== null");
  });
});
