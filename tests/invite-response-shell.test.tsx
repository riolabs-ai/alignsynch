/**
 * The invite-response path in the flow's one modal (#710) — the shell, the rail, the deep link and
 * the exit.
 *
 * The card's acceptance is four facts, and three of them are visible in static markup — which is
 * the whole reason this file renders instead of screenshotting:
 *
 *   1. **The response renders inside `StageShell`.** The claim screen is not a second flow: the
 *      dialog, its close control and the five-stage rail come from the components the create flow
 *      already draws, and the screen is stage 4 — **Account** (#825) — because nothing is shared
 *      yet.
 *   2. **It is one screen, and it is in the server's HTML.** Since #1115 task 4 there is no
 *      `?step=1|2|3` wizard: the claim is two fields on one screen, addressed by the token in the
 *      path, so a refresh and a deep link both land on it. Old `?step=` links still resolve (a mail
 *      client's copy cannot be rewritten) and are ignored rather than 404ing.
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
import { ClaimForm } from "@/components/assessment-flow/claim-form";
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

/** The five names the binding spec fixes, in order (`docs/specs/flow-stages.md`, #825). */
const STAGE_NAMES = ["Details", "Settings", "Aspects", "Account", "Invite"] as const;

/** The index of `Account` in that list — the stage the response is (#825). */
const ACCOUNT_POSITION = 4;

const TOKEN = "k".repeat(43);

const PREVIEW: InvitePreview = {
  state: "claimable",
  instanceRecordId: "instance-response-1",
  initiatorName: "Avery",
  counterpartyName: "Rowan",
  templateTitle: "Relationship Basics",
  viewerRole: null,
};

function responseHtml(): string {
  return renderToStaticMarkup(
    createElement(ClaimForm, {
      copy: invitePageCopy,
      preview: PREVIEW,
      token: TOKEN,
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

/** The rail's cells, in order — one per stage, and nothing else. */
function railCells(html: string): string[] {
  return html.match(/data-step-cell="\d+"[^>]*>[^<]*/g) ?? [];
}

describe("the response path renders in the flow's one modal", () => {
  it("draws the shared shell, with the close control leaving onto an address", () => {
    const html = responseHtml();
    expect(html).toContain('role="dialog"');
    expect(html).toContain('data-stage-shell="true"');
    // The exit is a path, not a piece of state: closing is navigation (#709's contract).
    expect(html).toContain(`data-stage-close="${OVERVIEW_PATH}"`);
    expect(html).toContain('aria-label="Close"');
    // The stage is in the server's string, not mounted by a client after hydration.
    expect(html).toContain("You have been invited");
    expect(html).toContain("Avery wants to compare notes with you on Relationship Basics.");
  });

  it("keeps the shell's two presentations — the 390 sheet and the ≥1024 inset dialog", () => {
    const panel = panelOf(responseHtml());
    expect(panel).toContain("inset-0");
    expect(panel).toContain("lg:inset-6");
    expect(panel).toContain("lg:rounded-lg");
    expect(panel).toContain("lg:border");
  });

  it("sits at Account — stage 4 of 5 — and draws no Align cell", () => {
    const html = responseHtml();
    expect(html).toContain(`Stage ${ACCOUNT_POSITION} of 5`);
    // Five cells, the same rail every other stage draws.
    expect(railCells(html)).toHaveLength(5);
    for (const name of STAGE_NAMES) expect(html).toContain(name);
    // Account is the current cell, and there is no sixth to draw (#825).
    expect(html).toContain('data-step-state="current"');
    expect(html).not.toContain('data-step-cell="6"');
    expect(html).not.toContain(">Align<");
  });

  it("renders on the shared stage column, not a centred column of its own", () => {
    const html = responseHtml();
    // The column itself is still left-flush inside whatever frames it (#687): a max width, and no
    // centring of its own.
    const column = /class="([^"]*max-w-\[1126px\][^"]*)"/.exec(html)?.[1] ?? "";
    expect(column).toContain("w-full");
    expect(column).not.toContain("mx-auto");
    // Since #760 the *panel* is centred, because the artifact caps it at 880px — that is the
    // shell's box, not the column's, and the two are asserted separately on purpose.
    expect(panelOf(html)).toContain("lg:mx-auto");
  });

  it("has exactly one progress band — the five-stage rail, not a second step rail", () => {
    const html = responseHtml();
    // The retired `Step {n} of 3` line and its band are gone: one progress pattern (#716).
    expect(html).not.toMatch(/Step \d of 3/);
    expect(html.split("<nav").length - 1).toBe(1);
  });
});

describe("an invitation deep link resolves to the one claim screen", () => {
  it("reads an old `?step=` link without failing on it", () => {
    // The steps are retired as screens (#1115 task 4) but the addresses a mail client already
    // holds still have to resolve — nothing 404s and nothing re-mints the token.
    expect(inviteWizardStepOf("1")).toBe(1);
    expect(inviteWizardStepOf("3")).toBe(3);
    expect(inviteWizardStepOf(undefined)).toBe(1);
    expect(inviteStepPath(TOKEN, 1)).toBe(`/invite/${TOKEN}`);
    expect(inviteStepPath(TOKEN, 3)).toBe(`/invite/${TOKEN}?step=3`);
  });

  it("is the page's own wiring — one claim screen, unclaimed on a GET", () => {
    const page = source("app/(mainlayout)/invite/[token]/page.tsx");
    expect(page).toContain("<ClaimForm");
    // The GET stays inert: claiming is the POST, and the page only previews.
    expect(page).toContain("previewInvite(");
    expect(page).not.toContain("claimInvite(");
  });

  it("posts both fields to the claim endpoint, so a refresh never spends the token", () => {
    const html = responseHtml();
    expect(html).toContain(`action="/invite/${TOKEN}/claim"`);
    expect(html).toContain('method="post"');
    expect(html).toContain('name="name"');
    expect(html).toContain('name="email"');
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
    // #1115 task 4 — a claim that just created the account is signed in by the auth server's own
    // cookies, so it exits onto the dashboard like any other signed-in claim.
    expect(route).toContain("viewerSignedIn: signedIn");
  });
});
