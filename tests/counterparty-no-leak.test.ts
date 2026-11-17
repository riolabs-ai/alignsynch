/**
 * The Counterparty never sees a price, a trial, a card or an extension (#1125, spec US-2).
 *
 * **Why a file of its own, and why it reads the surface rather than one component.** The rule is
 * about the *whole path* — three steps, their carrier, their routes and their copy fixture — and the
 * failure mode is a single word added to one band by a later card: a plan name on the invitation, a
 * "7 days free" line under the acceptance, a card field on the account step. None of those would fail
 * a type, a render or a click-through; each of them would change what the invitee is asked to think
 * about at the most fragile moment in the funnel.
 *
 * So the check is a vocabulary sweep over every module the join ships and every string its fixture
 * holds, plus the two structural rules the words cannot express:
 *
 *   the fixture   `data/pages/invite.ts` — the surface's only source of copy — holds no price, plan,
 *                 trial, card, billing or extension word
 *   the modules   the five components, the page and its three route handlers import no billing,
 *                 payment, checkout or pricing module, and print no `$`
 *   the fields    no step draws a card-like input (`cc-number`, `card`, `cvc`, `expiry`)
 *
 * `trial` is a **word**, not a substring: the product's own "trial" only ever belongs to the
 * Initiator's side of this flow, and the Counterparty joins a pair that is already paid for — the
 * bundle's own line is "You're never charged. {initiator} covers this relationship." A test that
 * banned the substring would also ban `trial` in a comment about why it is banned, which is how a
 * ratchet gets weakened to pass.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { invitePageCopy } from "@/data/pages/invite";
import { sectionOf } from "@/lib/page-copy";
import type { PageCopySection } from "@/content/pages";

const REPO = join(import.meta.dirname, "..");

function source(relative: string): string {
  return readFileSync(join(REPO, relative), "utf8");
}

/** Every module the join ships — the three steps, the stepper, the party cards, the page, the routes. */
const JOIN_MODULES = [
  "components/assessment-flow/join-invite-step.tsx",
  "components/assessment-flow/join-account-step.tsx",
  "components/assessment-flow/join-accept-step.tsx",
  "components/assessment-flow/join-stepper.tsx",
  "components/assessment-flow/join-party-cards.tsx",
  "app/(mainlayout)/invite/[token]/page.tsx",
  "app/(mainlayout)/invite/[token]/join/route.ts",
  "app/(mainlayout)/invite/[token]/decline/route.ts",
  "app/(mainlayout)/invite/[token]/claim/route.ts",
  "lib/flow/join-details.ts",
];

/** The three steps' sections — everything a reader of the join is shown. */
const JOIN_SECTIONS = ["steps", "invitation", "account", "accept", "declined"] as const;

/** Words that must not reach the invitee, as whole words, at any case. */
const FORBIDDEN = /\b(price|pricing|plan|plans|trial|trials|card|cards|billing|invoice|checkout|subscription|upgrade|extension|paid|pay|payment)\b/i;

function strings(section: PageCopySection): string[] {
  const found: string[] = [];
  if (section.heading !== undefined) found.push(section.heading);
  if (section.body !== undefined) found.push(section.body);
  for (const item of section.items ?? []) found.push(item.label);
  return found;
}

describe("the join's copy says nothing about money", () => {
  it("holds no plan, price, trial, card or extension word on any step", () => {
    for (const id of JOIN_SECTIONS) {
      for (const line of strings(sectionOf(invitePageCopy, id))) {
        expect(line, `${id}: ${line}`).not.toMatch(FORBIDDEN);
      }
    }
  });

  it("says who pays, without asking the invitee for anything", () => {
    const invitation = sectionOf(invitePageCopy, "invitation");
    const labels = strings(invitation);
    // The one sentence about money is the reassurance, and it names the other party as the payer.
    expect(labels).toContain("You’re never charged.");
    expect(labels).toContain("{initiator} covers this relationship.");
  });

  it("prints no currency symbol on any step", () => {
    for (const id of JOIN_SECTIONS) {
      for (const line of strings(sectionOf(invitePageCopy, id))) {
        expect(line, `${id}: ${line}`).not.toContain("$");
      }
    }
  });
});

describe("the join's modules reach no billing, payment or checkout path", () => {
  it("imports nothing that could sell, charge or upgrade", () => {
    for (const file of JOIN_MODULES) {
      const imports = [...source(file).matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]);
      expect(imports.length, file).toBeGreaterThan(0);
      for (const specifier of imports) {
        expect(specifier, file).not.toMatch(/billing|payment|checkout|pricing|plan-choices/i);
      }
    }
  });

  it("draws no card-shaped field on any step", () => {
    for (const file of [
      "components/assessment-flow/join-account-step.tsx",
      "components/assessment-flow/join-accept-step.tsx",
      "components/assessment-flow/join-invite-step.tsx",
    ]) {
      const text = source(file).toLowerCase();
      for (const forbidden of ["cc-number", "cc-exp", "cc-csc", 'name="card', "cvc", "expiry"]) {
        expect(text, file).not.toContain(forbidden);
      }
      expect(text, file).not.toContain('type="password"');
    }
  });

  it("keeps the claim route's own write set free of a purchase", () => {
    // The route may send the acceptance notice; it may not resolve a price, start a checkout or
    // touch a payment obligation. The claim's transaction (store) writes the Initiator's trial and
    // nothing of the claimer's, and `tests/claim-two-fields.test.ts` pins that region.
    const route = source("app/(mainlayout)/invite/[token]/claim/route.ts");
    expect(route).not.toMatch(/checkout|stripe|payment_method|payment_obligation/i);
  });
});
