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
 * **The same rule, in the mail (#1139).** The screen was only half of the path: the lapse notice
 * went to both seats and said the pair was read-only "until a plan is active again", so the person
 * who was invited to a relationship was told about a plan in a mailbox they cannot click out of.
 * #1139 splits that letter by seat, and the sweep below is the rule rather than the fix — it walks
 * **every** registered template that can land in the Counterparty's mailbox (the invitation, the
 * reminder, the report-ready notice, the support reply, the expired notice's counterparty body and
 * the paused notice) and fails on the vocabulary anywhere in the subject, the text or the HTML. A
 * template added to that path later can be added to the list; a word added to an existing one cannot
 * get through.
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
import {
  invitationTemplate,
  relationshipExpiredTemplate,
  relationshipPausedTemplate,
  reminderTemplate,
  renderTemplate,
  reportReadyTemplate,
  supportReplyTemplate,
  templateById,
  type EmailTemplate,
} from "@/lib/email/templates";

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
const FORBIDDEN =
  /\b(price|pricing|plan|plans|trial|trials|card|cards|billing|invoice|checkout|subscription|upgrade|extension|paid|pay|payment)\b/i;

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

/* ------------------------------------------------------------------ *
 * …and in the mail (#1139)
 * ------------------------------------------------------------------ */

/** The words that must not reach that mailbox, as whole words, at any case. */
const MONEY = /\b(price|pricing|plan|plans|trial|trials|card|cards|extension|extensions)\b/i;

const RELATIONSHIP = "https://alignsynch.com/dashboard/relationships/rel-1";
const INVITE = "https://alignsynch.com/invite/abcdefghijklmnopqrstuvwxyz0123456789abcdefg";

/** One template that can land in the Counterparty's mailbox, and the facts it needs. */
interface CounterpartyEmail {
  readonly id: string;
  readonly render: () => { readonly subject: string; readonly text: string; readonly html: string };
}

/** Bind a registered template to a fixture of facts, so the union of fact types stays out of it. */
function counterpartyEmail<Facts>(template: EmailTemplate<Facts>, facts: Facts): CounterpartyEmail {
  return { id: template.id, render: () => renderTemplate(template, facts) };
}

/**
 * Every registered template that can reach this seat, and why it can.
 *
 * The set is a hand-written list because the register does not carry a recipient column — the
 * *sender* knows, and a column here would be a second place to keep true. The first case below
 * fails when an id in this list stops being a registered template, which is the way this list rots.
 */
const COUNTERPARTY_EMAILS: readonly CounterpartyEmail[] = [
  // Minted with the invite, addressed to the invited person.
  counterpartyEmail(invitationTemplate, {
    inviter: "Avery",
    counterparty: "Rowan",
    template: "Relationship Basics",
    link: INVITE,
  }),
  // 48 h before that invitation expires.
  counterpartyEmail(reminderTemplate, {
    inviter: "Avery",
    template: "Relationship Basics",
    link: INVITE,
    expiresAt: new Date("2026-11-12T09:00:00.000Z"),
  }),
  // Sent to whichever seat did **not** submit — so it reaches this one half the time.
  counterpartyEmail(reportReadyTemplate, {
    recipient: "Rowan",
    other: "Avery",
    template: "Relationship Basics",
    link: RELATIONSHIP,
  }),
  // Whoever wrote to support gets the reply, and this seat may be the one who wrote.
  counterpartyEmail(supportReplyTemplate, {
    recipient: "Rowan",
    subject: "Invitation link expired",
    receivedAt: new Date("2026-11-04T09:00:00.000Z"),
  }),
  // Both seats, and this is the branch of the template written for the invited person.
  counterpartyEmail(relationshipExpiredTemplate, {
    recipient: "counterparty",
    name: "Rowan",
    template: "Relationship Basics",
    expiredAt: new Date("2026-11-15T12:00:00.000Z"),
    link: RELATIONSHIP,
  }),
  // The lapse notice, split by seat (#1139): this template exists only for this mailbox.
  counterpartyEmail(relationshipPausedTemplate, {
    recipient: "Rowan",
    template: "Relationship Basics",
    pausedAt: new Date("2026-11-14T09:30:00.000Z"),
    link: RELATIONSHIP,
  }),
];

describe("no Counterparty-recipient template says anything about money", () => {
  it("names only registered templates, and includes the one this rule was written for", () => {
    for (const item of COUNTERPARTY_EMAILS) {
      expect(templateById(item.id), item.id).toBeDefined();
    }
    const ids = COUNTERPARTY_EMAILS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    // The mail #1139 replaced said "until a plan is active again" to this seat; the fix is only a
    // fix while the replacement is in the swept set.
    expect(ids).toContain("relationship-paused");
    expect(ids).not.toContain("membership-lapsed");
    expect(ids).not.toContain("trial-ended-paused");
  });

  it("carries no price, plan, trial, card or extension word in the subject, the text or the HTML", () => {
    for (const item of COUNTERPARTY_EMAILS) {
      const rendered = item.render();
      const parts = [
        ["subject", rendered.subject],
        ["text", rendered.text],
        ["html", rendered.html],
      ] as const;
      for (const [part, body] of parts) {
        expect(body, `${item.id} ${part}`).not.toMatch(MONEY);
      }
    }
  });

  it("prints no amount and no currency figure", () => {
    for (const item of COUNTERPARTY_EMAILS) {
      const { subject, text } = item.render();
      // The text, not the HTML: the HTML is derived from it (the band's own rule), and it also
      // carries CSS decimals like `1.55` that are not a price.
      for (const body of [subject, text]) {
        expect(body, item.id).not.toMatch(/\$\s?\d/);
        expect(body, item.id).not.toMatch(/\d{1,3}\.\d{2}\b/);
      }
    }
  });
});
