/**
 * The counterparty's entry is **two fields and one screen** (#1115 task 4).
 *
 * The owner's rule for this surface is "no friction", and the issue's own acceptance is the
 * sentence that makes it measurable: *an invitation link opens on the relationship it names,
 * requires at most two fields before the counterparty can begin answering, and never shows a plan,
 * a price or a payment form* (US-2). This file pins the five things that sentence decomposes into,
 * and each one is a way the screen has already been wrong in this repo:
 *
 *   1. **The store's contract is `{ invitationToken, name, email }`.** The token names the
 *      invitation, the name confirms which party is being joined (the anti-replay statement
 *      `confirmationMatches` has always been), and the address is the only fact the claim adds —
 *      it decides which account the seat binds to.
 *   2. **The address must be the invitation's.** A claim that names a different address than the
 *      one the invitation was sent to is refused `email-mismatch`, with a sentence that tells the
 *      person to ask for a resend. That is the anti-hijack half of a two-field claim: the link is
 *      not enough on its own once the seat binds to an account.
 *   3. **The screen shows two fields and nothing else.** No password, no card, no plan, no price —
 *      measured on the rendered markup, and on the module graph of the screen and its route.
 *   4. **The counterparty never buys anything — and the acceptance is what opens the Initiator's
 *      week.** The claim's transaction writes no checkout and no obligation of the claimer's; the
 *      one subscription row it may write is the **Initiator's** trial (`grantAcceptanceTrial`, spec
 *      D3: the week starts when the Counterparty accepts). Nothing on this path reaches a card.
 *   5. **A dead link is a sentence, never a 500.** `expired` / `unknown` draw their band, and the
 *      band already tells the reader to ask for another one.
 *
 * The store's own behaviour against live rows is `tests/flow-store-identity.test.ts` (a stubbed
 * client) and `scripts/flow-e2e.mjs` (real Postgres); this file is the pure rules, the rendered
 * surface and the ratchets that keep a payment form from being reintroduced.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

import { JoinAccountStep } from "@/components/assessment-flow/join-account-step";
import { invitePageCopy } from "@/data/pages/invite";
import {
  CLAIM_REFUSALS,
  claimConfirmationValue,
  claimEmailMatches,
  claimEmailOf,
  confirmationMatches,
} from "@/lib/flow/claim";
import { claimPath, joinDetailsPath } from "@/lib/flow/paths";
import type { InvitePreview } from "@/lib/flow/store";
import { itemLabel, sectionOf } from "@/lib/page-copy";

const REPO = join(import.meta.dirname, "..");

function source(relative: string): string {
  return readFileSync(join(REPO, relative), "utf8");
}

const TOKEN = "k".repeat(43);

const PREVIEW: InvitePreview = {
  state: "claimable",
  instanceRecordId: "assessment-instance-avery-rowan",
  initiatorName: "Avery",
  counterpartyName: "Rowan",
  templateTitle: "Relationship Basics",
  viewerRole: null,
  relationshipTitle: "Staying Close",
  templateSummary: "Relationship Basics, answered by Avery and Rowan.",
  mode: "basic",
  setting: "soft",
  aspects: [
    {
      id: "aspect-contact",
      prompt: "How does how often you are in touch compare to what each wants?",
    },
    { id: "aspect-roles", prompt: "How much do old roles still decide how you treat each other?" },
  ],
};

function textOf(markup: string): string {
  return markup
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&mdash;/g, "—")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ------------------------------------------------------------------ *\
 * 1. The address, as a pure rule
 * ------------------------------------------------------------------ */

describe("claimEmailOf", () => {
  it("normalises the address a form or an autofill padded", () => {
    expect(claimEmailOf("  Rowan@Example.TEST ")).toBe("rowan@example.test");
  });

  it("answers null for nothing at all", () => {
    expect(claimEmailOf(null)).toBeNull();
    expect(claimEmailOf(undefined)).toBeNull();
    expect(claimEmailOf("   ")).toBeNull();
  });
});

describe("claimEmailMatches", () => {
  it("accepts the invitation's own address, whatever the case", () => {
    expect(claimEmailMatches("ROWAN@example.test", "rowan@example.test")).toBe(true);
    expect(claimEmailMatches(" rowan@example.test ", "rowan@example.test")).toBe(true);
  });

  it("refuses a different address — the seat binds to the account that was invited", () => {
    expect(claimEmailMatches("someone@else.test", "rowan@example.test")).toBe(false);
  });

  it("refuses an empty address rather than binding a seat to nobody", () => {
    expect(claimEmailMatches(null, "rowan@example.test")).toBe(false);
    expect(claimEmailMatches("", "rowan@example.test")).toBe(false);
  });

  it("accepts any address when the invitation carries none to compare", () => {
    // A seeded row, or a create that never collected an address: there is no fact to disagree
    // with, so the claim is not blocked on one. The seat still binds.
    expect(claimEmailMatches("rowan@example.test", null)).toBe(true);
    expect(claimEmailMatches("rowan@example.test", "")).toBe(true);
  });
});

/* ------------------------------------------------------------------ *\
 * 2. The refusals — named, and each with a sentence
 * ------------------------------------------------------------------ */

describe("the claim's refusals", () => {
  it("names the address mismatch", () => {
    expect(CLAIM_REFUSALS).toContain("email-mismatch");
  });

  it("gives every refusal the page can draw a sentence", () => {
    const refusals = sectionOf(invitePageCopy, "refusals");
    const tokenState = ["unknown", "claimed", "expired", "revoked"];
    for (const code of CLAIM_REFUSALS) {
      if (tokenState.includes(code)) continue; // the token's own band says it
      expect(itemLabel(refusals, code)).not.toBe("");
    }
  });

  it("tells the reader to ask for another one when the link is dead", () => {
    // The affordance the card asks for: a named refusal *and* what to do next, never a 500.
    expect(sectionOf(invitePageCopy, "expired").body).toMatch(/ask .*to send you a new one/i);
    expect(itemLabel(sectionOf(invitePageCopy, "refusals"), "email-mismatch")).toMatch(/resend/i);
  });

  it("keeps the confirmation a statement about this invitation", () => {
    expect(claimConfirmationValue(" Rowan ")).toBe("Rowan");
    expect(confirmationMatches("Rowan", "Rowan")).toBe(true);
    expect(confirmationMatches("Avery", "Rowan")).toBe(false);
  });
});

/* ------------------------------------------------------------------ *\
 * 3. The screen — two fields on `Join`, one form, nothing to pay
 * ------------------------------------------------------------------ */

describe("the join's account step", () => {
  /** Every control the person can type into, in document order. */
  function inputs(markup: string): readonly string[] {
    return [...markup.matchAll(/<(input|textarea|select)\b[^>]*>/g)].map((match) => match[0]);
  }

  function accountHtml(problem?: string): string {
    return renderToStaticMarkup(
      createElement(JoinAccountStep, {
        copy: invitePageCopy,
        preview: PREVIEW,
        token: TOKEN,
        ...(problem === undefined ? {} : { problem }),
      }),
    );
  }

  it("renders exactly two fields: the name and the email", () => {
    const fields = inputs(accountHtml());

    // One checkbox would be a third control, so the confirmation is the name field itself.
    expect(fields).toHaveLength(2);
    expect(fields[0]).toContain('name="name"');
    expect(fields[1]).toContain('name="email"');
    expect(fields[1]).toContain('type="email"');
  });

  it("prefills the name the invitation carries, so one field is left to type", () => {
    expect(accountHtml()).toContain('value="Rowan"');
  });

  it("posts both fields to the carrier, as a POST — not to the claim", () => {
    const markup = accountHtml();

    expect(markup).toContain(`action="${joinDetailsPath(TOKEN)}"`);
    expect(markup).toContain('method="post"');
    // Step 2 carries the pair; the claim is step 3's single write (`join-accept-step.tsx`).
    expect(markup).not.toContain(`action="${claimPath(TOKEN)}"`);
  });

  it("asks for no password, no card, no plan and no price", () => {
    const markup = accountHtml();
    const text = textOf(markup);

    // Markup: no password control and no card-shaped field. `bg-card` is a class and not a control,
    // so the words are checked against the text the reader sees.
    for (const forbidden of ['type="password"', "cvc", "expiry", "billing", "cc-number"]) {
      expect(markup.toLowerCase()).not.toContain(forbidden);
    }
    expect(text).not.toMatch(/\$\d|per month|\/mo\b|\bcard\b|\bplan\b|\btrial\b/i);
  });

  it("draws the carrier's own refusal beside the form that can retry it", () => {
    const text = textOf(accountHtml("email"));

    expect(text).toContain("missing something");
  });

  it("imports no billing, plan or payment module — the graph, not the markup", () => {
    // The rendered check above can only see what a signed-out claim draws; a payment component
    // imported but conditionally hidden would pass it. This reads each module's own imports.
    for (const file of [
      "components/assessment-flow/join-invite-step.tsx",
      "components/assessment-flow/join-account-step.tsx",
      "components/assessment-flow/join-accept-step.tsx",
      "components/assessment-flow/join-stepper.tsx",
      "app/(mainlayout)/invite/[token]/page.tsx",
    ]) {
      const text = source(file);
      const imports = [...text.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]);
      expect(imports.length).toBeGreaterThan(2);
      for (const specifier of imports) {
        expect(specifier).not.toMatch(/billing|payment|plan-choices|checkout|pricing/i);
      }
    }
  });
});

/* ------------------------------------------------------------------ *\
 * 4. The claim's transaction — the seat, and the Initiator's week
 * ------------------------------------------------------------------ */

describe("claimInvite binds a seat and opens the Initiator's trial — and buys nothing", () => {
  /**
   * The claim's own region of the store: from `export async function claimInvite` to the next
   * exported function. Read as source because the statement list is the contract — the live
   * suite (`scripts/flow-e2e.mjs`) proves the rows, this proves nothing new was added.
   */
  function claimRegion(): string {
    const store = source("lib/flow/store.ts");
    const start = store.indexOf("export async function claimInvite");
    // The claim's own body ends at the next section marker — `resumeClaimedSeat()` lives past it,
    // and its one statement must not be read as part of the claim's write set.
    const end = store.indexOf("* Resuming a seat an earlier claim took", start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    return store.slice(start, end);
  }

  it("binds the seat in the same transaction that spends the token", () => {
    const region = claimRegion();

    expect(region).toContain("INSERT INTO party");
    expect(region).toContain("UPDATE session_invite SET claimed_at");
    expect(region).toContain("UPDATE relationship SET status = 'active'");
    // One transaction: BEGIN before the first write, and the claim's own COMMIT after it. The
    // resume branch above the insert also commits (it is a separate path), so this compares
    // against the *last* commit in the body.
    expect(region.indexOf("BEGIN")).toBeLessThan(region.indexOf("INSERT INTO party"));
    expect(region.indexOf("INSERT INTO party")).toBeLessThan(region.lastIndexOf("COMMIT"));
  });

  it("opens the trial here (#1115, spec D3) — in the transaction, through the one writer", () => {
    const region = claimRegion();

    // The acceptance is the anchor: a draft and a pending invitation consume no trial days, so the
    // week opens in the transaction that gives the relationship its second seat. It goes through
    // `grantAcceptanceTrial()` — the account-keyed writer — and not through a statement of its own,
    // so a replayed claim or a second accepted relationship cannot write a second row.
    expect(region).toContain("grantAcceptanceTrial(sqlOf(client)");
    expect(region.indexOf("BEGIN")).toBeLessThan(
      region.indexOf("grantAcceptanceTrial(sqlOf(client)"),
    );
    expect(region.indexOf("grantAcceptanceTrial(sqlOf(client)")).toBeLessThan(
      region.lastIndexOf("COMMIT"),
    );
    // Never keyed to the claimer: the Counterparty joins a pair that is already paid for (US-2).
    expect(region).toMatch(/SELECT initiator_user_id FROM relationship/);
    expect(region).not.toMatch(/userId: claimerUserId/);
  });

  it("still buys nothing — no checkout, no obligation, no card", () => {
    const region = claimRegion();

    // The one row this path may write is the Initiator's trial, above. What must stay absent is
    // everything that would make the claim a purchase: a payment obligation, a checkout, a plan.
    expect(region).not.toMatch(/payment_obligation/i);
    expect(region).not.toMatch(/checkout|stripe|payment_method/i);
    // The retired anchors stay retired: the claim is the *only* user of a trial writer, so neither
    // the creation nor the publish writer may appear in it.
    expect(region).not.toMatch(/grant(Creation|Publish)Trial/);
  });

  it("takes the two posted fields and the token, and nothing else that names a person", () => {
    const region = claimRegion();

    // The token may not be posted (it is in the path) and the account may not be either.
    expect(region).toContain("input.name");
    expect(region).toContain("input.email");
    expect(region).toContain("normalizedUserId(input.viewerUserId)");
  });
});
