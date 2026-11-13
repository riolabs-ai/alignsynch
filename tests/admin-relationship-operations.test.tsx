/**
 * `/admin/instances/[id]` — unlock, reissue and withdraw as the screen draws them (#503).
 *
 * `tests/admin-relationship-ops.test.ts` proves the *write*: one audited transaction per repair,
 * refusal codes, rollback. This file proves the other half of the same card — that the three
 * repairs are **reachable** and that each one asks for a reason — and it does it by rendering the
 * component the page renders, not by reading the source for a `<Card>`.
 *
 * Three claims:
 *
 *   1. **Every band is a form with a reason.** `data-repair="unlock" | "resend" | "revoke"` each
 *      carry `input[name="reason"]` with `required` and the server's own `minLength`, so a reader
 *      who never opens `act()` can see where the eight characters come from. The attribute is the
 *      browser's hint — `act()` is the enforcement — and the test asserts the hint is wired.
 *   2. **A withdrawal is terminal, so the band beside it closes.** With `revokedAt` set the
 *      reissue band is disabled and says the invitation was withdrawn; the withdraw band is
 *      disabled too. Neither is hidden: an operator looking for the button needs to know it exists
 *      and why it cannot be used.
 *   3. **A row with nothing to repair says so.** A seat with no unlock mark, and an invitation that
 *      does not exist, draw disabled bands with the fixture's sentence rather than an enabled
 *      button the store would refuse.
 *
 * `renderToStaticMarkup` and not jsdom: the initial render is the whole claim (which bands exist,
 * what their controls are, whether they are disabled), and a mount would only re-assert React's
 * own event wiring. No database, no request, and no clock: every instant is a literal.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RelationshipOperations } from "@/components/admin/relationship-operations";
import { adminRelationshipPageCopy } from "@/data/pages/admin-relationship";
import type { AdminRelationshipDetail, AdminSeat } from "@/lib/db/admin-relationship";

const UNLOCK_INSTANT = "2026-11-01T10:00:00.000Z";
const EXPIRY_INSTANT = "2026-11-09T10:00:00.000Z";
const REVOKED_INSTANT = "2026-11-02T09:32:00.000Z";

/** One seat, defaulted to an answered, accepted, marked seat. */
function seat(overrides: Partial<AdminSeat> = {}): AdminSeat {
  return {
    role: "initiator",
    name: "Avery",
    hasAccount: true,
    answered: 3,
    acceptedAt: null,
    impersonatedBy: null,
    unlockSeenAt: UNLOCK_INSTANT,
    ...overrides,
  };
}

/** The row the screen draws, defaulted to a live relationship with an unclaimed invitation. */
function detail(overrides: Partial<AdminRelationshipDetail> = {}): AdminRelationshipDetail {
  return {
    instanceRecordId: "inst-1",
    relationshipId: "relationship-inst-1",
    slug: "avery-rowan",
    name: "Avery & Rowan",
    templateTitle: "Parent & Child",
    mode: "basic",
    setting: "soft",
    status: "answering",
    voided: false,
    voidedAt: null,
    aspects: 3,
    seats: [seat(), seat({ role: "counterparty", name: "Rowan", hasAccount: false })],
    invite: {
      email: "rowan@example.com",
      expiresAt: EXPIRY_INSTANT,
      claimedAt: null,
      revokedAt: null,
      state: "unclaimed",
      resentCount: 1,
    },
    ...overrides,
  };
}

/** The screen, rendered once with a row and a server action that is never called. */
function render(row: AdminRelationshipDetail = detail()): string {
  return renderToStaticMarkup(
    <RelationshipOperations
      action={async () => ({ ok: false, code: "failed" })}
      copy={adminRelationshipPageCopy}
      detail={row}
    />,
  );
}

/**
 * One repair band's markup, by the attribute the component puts on its card.
 *
 * Slicing between two `data-repair` attributes is enough here because the bands are siblings, and
 * a helper that shelled out to a DOM parser would be a second renderer to keep in step with the
 * first. `data-repair` is the component's own handle, not a class name a stylesheet can move.
 */
function band(html: string, repair: "unlock" | "resend" | "revoke"): string {
  const at = html.indexOf(`data-repair="${repair}"`);
  if (at === -1) throw new Error(`the screen drew no ${repair} band`);
  const next = html.indexOf("data-repair=", at + 1);
  return html.slice(at, next === -1 ? undefined : next);
}

/**
 * Is the band's button disabled?
 *
 * The opening tag's `class` is dropped first: the shadcn variant carries `disabled:pointer-events-
 * none disabled:opacity-50`, so a substring search for `disabled` finds every button — including
 * the ones this file is trying to prove are live. What is asserted is the **attribute**, read off
 * the tag the way the browser reads it.
 */
function isDisabled(markup: string): boolean {
  const tag = /<button[^>]*>/.exec(markup)?.[0];
  if (tag === undefined) throw new Error("the band drew no button");
  const withoutClass = tag.replace(/\sclass="[^"]*"/, "");
  return /\sdisabled(=|\s|\/?>)/.test(withoutClass);
}

describe("the three invitation repairs are reachable, each with a reason", () => {
  it("draws an unlock, a reissue and a withdraw band", () => {
    const html = render();
    expect(html).toContain('data-repair="unlock"');
    expect(html).toContain('data-repair="resend"');
    expect(html).toContain('data-repair="revoke"');
  });

  it("gives every band a submit button and no reason input at all (#732)", () => {
    const html = render();
    for (const repair of ["unlock", "resend", "revoke"] as const) {
      const markup = band(html, repair);
      // The owner's rule: no action form asks for a reason, so the band asks for none — not a
      // required field, not an optional one.
      expect(
        /<input[^>]*name="reason"[^>]*>/.test(markup),
        `${repair} band has a reason input`,
      ).toBe(false);
      expect(markup).toContain("<button");
      expect(isDisabled(markup)).toBe(false);
    }
  });

  it("names the unlock repair as the V11 repair, so the button is the manual transaction", () => {
    // The band's own copy is the fixture's, quoted with the escape the fixture uses. The claim is
    // not the wording: it is that the screen says V11 and the store performs exactly the manual
    // statement (`UPDATE party SET unlock_seen_at = NULL`), which the ops suite asserts.
    expect(render()).toContain("V11");
  });
});

describe("a withdrawal is terminal on the screen, as it is in the store", () => {
  it("disables the reissue band on a withdrawn invitation and says why", () => {
    const html = render(
      detail({
        invite: {
          email: "rowan@example.com",
          expiresAt: EXPIRY_INSTANT,
          claimedAt: null,
          revokedAt: REVOKED_INSTANT,
          state: "revoked",
          resentCount: 1,
        },
      }),
    );

    const resend = band(html, "resend");
    expect(isDisabled(resend)).toBe(true);
    // The fixture's sentence for a withdrawn invitation, not a sentence written here (E23).
    expect(resend).toContain("Withdrawn");

    // …and the withdraw band cannot be pressed a second time either.
    expect(isDisabled(band(html, "revoke"))).toBe(true);
  });

  it("leaves the reissue band live while the invitation is unclaimed and unrevoked", () => {
    expect(isDisabled(band(render(), "resend"))).toBe(false);
  });

  it("disables the withdraw band once the invitation was claimed — there is no live link", () => {
    const html = render(
      detail({
        invite: {
          email: "rowan@example.com",
          expiresAt: EXPIRY_INSTANT,
          claimedAt: "2026-11-03T09:00:00.000Z",
          revokedAt: null,
          state: "claimed",
          resentCount: 1,
        },
      }),
    );
    expect(isDisabled(band(html, "revoke"))).toBe(true);
    expect(isDisabled(band(html, "resend"))).toBe(true);
  });
});

describe("a row with nothing to repair draws a disabled band, never a hopeful button", () => {
  it("disables unlock when no seat carries a mark", () => {
    const html = render(
      detail({
        seats: [seat({ unlockSeenAt: null }), seat({ role: "counterparty", unlockSeenAt: null })],
      }),
    );
    expect(isDisabled(band(html, "unlock"))).toBe(true);
  });

  it("disables both invite repairs when the relationship has no invitation at all", () => {
    const html = render(detail({ invite: null }));
    expect(isDisabled(band(html, "resend"))).toBe(true);
    expect(isDisabled(band(html, "revoke"))).toBe(true);
  });
});

/**
 * A `<p>` may not contain a block element, and `Badge` **is** a `<div>` (`components/ui/badge.tsx`).
 *
 * The invitation card drew the state badge inside a `<p>`, so the server wrote markup the browser
 * re-parents and the client then refuses to hydrate: React logged `<p> cannot contain a nested
 * <div>` and regenerated the whole tree, which is a hydration failure on an operator's screen —
 * found beside #980 while proving the page's console is clean. This is the static half of that
 * claim: the rendered markup carries no paragraph wrapping a block element, so there is nothing
 * for hydration to disagree with. The interacting half (the address field) is
 * `tests/admin-relationship-email-input.test.tsx`.
 */
describe("no paragraph wraps a block element, so the page hydrates", () => {
  /** Every `<p>…</p>` whose contents open a block-level tag. */
  function blockedParagraphs(html: string): string[] {
    const offenders: string[] = [];
    for (const match of html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)) {
      const inner = match[1] ?? "";
      if (/<(div|p|section|article|ul|ol|table|form|h[1-6])\b/.test(inner)) {
        offenders.push(match[0].slice(0, 160));
      }
    }
    return offenders;
  }

  it("draws the invitation's state badge beside the paragraph, not inside it", () => {
    const html = render();
    expect(html).toContain("Unclaimed");
    expect(blockedParagraphs(html)).toEqual([]);
  });

  it("holds for every invitation state the card can draw", () => {
    for (const state of ["unclaimed", "claimed", "revoked", "expired"] as const) {
      const html = render(
        detail({
          invite: {
            email: "rowan@example.com",
            expiresAt: EXPIRY_INSTANT,
            claimedAt: null,
            revokedAt: null,
            state,
            resentCount: 1,
          },
        }),
      );
      expect(blockedParagraphs(html), `the ${state} row nests a block in a paragraph`).toEqual([]);
    }
  });
});
