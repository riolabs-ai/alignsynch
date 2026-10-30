/**
 * A claim binds a browser to one party, and never reassigns a session (#202).
 *
 * The defect this file covers was found against a seeded instance: a signed-in Initiator
 * who opened their own invitation link spent the token, and from then on their answers were
 * recorded as the Counterparty's — silently, so the Gap was computed between one person and
 * themselves. Three rules came out of it, and each has a test here:
 *
 *   the pure rules     `confirmationMatches` compares the posted name with the invitation's
 *                      own, so a claim that does not say who it is joining is refused
 *   the request's      `partyTokensFrom` finds the party cookies a claim must be refused on
 *   the rendering      an already-bound visitor is named and never shown the claim control;
 *                      a claimable one is told, in a sentence, who they are joining as
 *
 * The store's half (refusals that leave `claimed_at` NULL, the direct-POST refusal) is proven
 * against live rows by `scripts/flow-e2e.mjs` — the gate stays database-free on purpose.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AssessmentInstanceView } from "@/components/assessment-flow/instance-view";
import { InviteView } from "@/components/assessment-flow/invite-view";
import { assessmentInstancePageCopy } from "@/data/pages/assessment-instance";
import { invitePageCopy } from "@/data/pages/invite";
import {
  CLAIM_REFUSALS,
  claimConfirmationValue,
  claimRefusalOf,
  confirmationMatches,
  isTokenStateRefusal,
} from "@/lib/flow/claim";
import type { FlowScreen } from "@/lib/flow/screen";
import { partyTokensFrom } from "@/lib/flow/session";
import type { InvitePreview } from "@/lib/flow/store";
import { itemLabel, sectionOf } from "@/lib/page-copy";

/* ------------------------------------------------------------------ *\
 * The pure rules
 * ------------------------------------------------------------------ */

describe("confirmationMatches", () => {
  it("accepts the invitation's own name for the party", () => {
    expect(confirmationMatches("Rowan", "Rowan")).toBe(true);
  });

  it("accepts it with the padding a form or an autofill adds", () => {
    expect(confirmationMatches("  Rowan  ", "Rowan")).toBe(true);
    expect(confirmationMatches("Rowan", " Rowan ")).toBe(true);
  });

  it("refuses a claim that confirms nothing", () => {
    expect(confirmationMatches(null, "Rowan")).toBe(false);
    expect(confirmationMatches(undefined, "Rowan")).toBe(false);
    expect(confirmationMatches("", "Rowan")).toBe(false);
    expect(confirmationMatches("   ", "Rowan")).toBe(false);
  });

  it("refuses the other party's name — the confirmation is about who is joining", () => {
    expect(confirmationMatches("Avery", "Rowan")).toBe(false);
    expect(confirmationMatches("Rowan, the Counterparty", "Rowan")).toBe(false);
    expect(confirmationMatches("rowan", "Rowan")).toBe(false);
  });

  it("posts exactly the name the invitation carries", () => {
    expect(claimConfirmationValue("  Rowan ")).toBe("Rowan");
    expect(confirmationMatches(claimConfirmationValue("Rowan"), "Rowan")).toBe(true);
  });
});

describe("claimRefusalOf", () => {
  it("round-trips every refusal the store can return", () => {
    for (const code of CLAIM_REFUSALS) expect(claimRefusalOf(code)).toBe(code);
  });

  it("ignores what a hand-written query string carries", () => {
    expect(claimRefusalOf("nonsense")).toBeUndefined();
    expect(claimRefusalOf("toString")).toBeUndefined();
    expect(claimRefusalOf("")).toBeUndefined();
    expect(claimRefusalOf(undefined)).toBeUndefined();
  });

  it("separates the refusals the token's state already explains", () => {
    expect(isTokenStateRefusal("claimed")).toBe(true);
    expect(isTokenStateRefusal("expired")).toBe(true);
    expect(isTokenStateRefusal("unknown")).toBe(true);
    expect(isTokenStateRefusal("already-a-party")).toBe(false);
    expect(isTokenStateRefusal("already-bound")).toBe(false);
    expect(isTokenStateRefusal("unconfirmed")).toBe(false);
  });
});

describe("partyTokensFrom", () => {
  const jar = (cookies: { name: string; value: string }[]) => ({
    getAll: () => cookies,
  });

  it("returns every party token the browser holds, and nothing else", () => {
    expect(
      partyTokensFrom(
        jar([
          { name: "flow_party_instance-a", value: "token-a" },
          { name: "flow_invite_instance-a", value: "invite-a" },
          { name: "flow_party_instance-b", value: "token-b" },
          { name: "theme", value: "dark" },
        ]),
      ),
    ).toEqual(["token-a", "token-b"]);
  });

  it("ignores a cleared cookie, so an empty value is not a party", () => {
    expect(partyTokensFrom(jar([{ name: "flow_party_instance-a", value: "" }]))).toEqual([]);
    expect(partyTokensFrom(jar([]))).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *\
 * The copy the two screens draw
 * ------------------------------------------------------------------ */

describe("the invite fixture carries every band the page can ask for", () => {
  it("names the two parties, in the words the screen shows", () => {
    const viewer = sectionOf(invitePageCopy, "viewer");
    expect(itemLabel(viewer, "initiator")).toContain("the Initiator");
    expect(itemLabel(viewer, "counterparty")).toContain("the Counterparty");
    expect(viewer.heading).toBeDefined();
  });

  it("has a refusal for every code whose meaning is not the token's", () => {
    const refusals = sectionOf(invitePageCopy, "refusals");
    for (const code of CLAIM_REFUSALS) {
      if (isTokenStateRefusal(code)) continue;
      expect(itemLabel(refusals, code).length).toBeGreaterThan(0);
    }
  });

  it("names the party being joined, and the confirmation that says so", () => {
    const claim = sectionOf(invitePageCopy, "claim");
    expect(itemLabel(claim, "join")).toContain("{counterparty}");
    expect(itemLabel(claim, "join")).toContain("the Counterparty");
    expect(itemLabel(claim, "confirm")).toContain("{counterparty}");
  });

  it("has an answering-party band on the instance screen for both roles", () => {
    const viewer = sectionOf(assessmentInstancePageCopy, "viewer");
    expect(itemLabel(viewer, "initiator")).toContain("{name}");
    expect(itemLabel(viewer, "initiator")).toContain("the Initiator");
    expect(itemLabel(viewer, "counterparty")).toContain("the Counterparty");
  });
});

/* ------------------------------------------------------------------ *\
 * What the claim page renders
 * ------------------------------------------------------------------ */

function preview(over: Partial<InvitePreview> = {}): InvitePreview {
  return {
    state: "claimable",
    initiatorName: "Avery",
    counterpartyName: "Rowan",
    templateTitle: "Relationship Basics",
    viewerRole: null,
    ...over,
  };
}

function inviteMarkup(input: Parameters<typeof InviteView>[0]): string {
  return renderToStaticMarkup(createElement(InviteView, input));
}

const CLAIM_CONTROL = "Accept and answer";

describe("the claim page", () => {
  it("tells a visitor who they are joining, and asks them to confirm it", () => {
    const html = inviteMarkup({ copy: invitePageCopy, preview: preview(), token: "t" });
    expect(html).toContain("You are joining as Rowan, the Counterparty.");
    expect(html).toContain("I am Rowan, and I am joining as the Counterparty.");
    expect(html).toContain('name="confirm"');
    expect(html).toContain('value="Rowan"');
    expect(html).toContain(CLAIM_CONTROL);
  });

  it("refuses the Initiator their own invitation, and offers no control that would take it", () => {
    const html = inviteMarkup({
      copy: invitePageCopy,
      preview: preview({ viewerRole: "initiator" }),
      token: "t",
    });
    expect(html).toContain("You are answering as Avery, the Initiator.");
    expect(html).toContain("You already have a seat in this instance");
    expect(html).toContain("Nothing was claimed");
    expect(html).not.toContain(CLAIM_CONTROL);
    expect(html).not.toContain("You are joining as");
  });

  it("names the Counterparty on a later visit too", () => {
    const html = inviteMarkup({
      copy: invitePageCopy,
      preview: preview({ viewerRole: "counterparty" }),
      token: "t",
    });
    expect(html).toContain("You are answering as Rowan, the Counterparty.");
    expect(html).not.toContain(CLAIM_CONTROL);
  });

  it("draws the store's refusal sentence after a refused claim", () => {
    const html = inviteMarkup({
      copy: invitePageCopy,
      preview: preview(),
      token: "t",
      refusal: "unconfirmed",
    });
    expect(html).toContain("Nothing was claimed: the claim did not confirm joining as Rowan.");
  });

  it("does not repeat the token's own state as a second refusal", () => {
    const html = inviteMarkup({
      copy: invitePageCopy,
      preview: preview({ state: "claimed" }),
      token: "t",
      refusal: "claimed",
    });
    expect(html).toContain("This invitation was used already");
    expect(html).not.toContain("Nothing was claimed");
  });
});

/* ------------------------------------------------------------------ *\
 * What the instance screen renders
 * ------------------------------------------------------------------ */

function screen(role: "initiator" | "counterparty"): FlowScreen {
  return {
    instanceRecordId: "instance-1",
    slug: "relationship-basics-instance-1",
    title: "Relationship Basics",
    summary: "An instance between two people.",
    status: "awaiting_counterparty",
    viewer: { role, name: role === "initiator" ? "Avery" : "Rowan" },
    aspects: [],
    initiatorName: "Avery",
    counterpartyName: role === "initiator" ? null : "Rowan",
    waiting: [role === "initiator" ? "counterparty" : "initiator"],
    invite: null,
    report: null,
  };
}

describe("the instance screen names the answering party on every visit", () => {
  it("says the session answers as the Initiator", () => {
    const html = renderToStaticMarkup(
      createElement(AssessmentInstanceView, {
        screen: screen("initiator"),
        copy: assessmentInstancePageCopy,
      }),
    );
    expect(html).toContain("You are answering as Avery, the Initiator.");
    expect(html).toContain('data-answering-as="initiator"');
  });

  it("says the session answers as the Counterparty", () => {
    const html = renderToStaticMarkup(
      createElement(AssessmentInstanceView, {
        screen: screen("counterparty"),
        copy: assessmentInstancePageCopy,
      }),
    );
    expect(html).toContain("You are answering as Rowan, the Counterparty.");
    expect(html).toContain('data-answering-as="counterparty"');
  });
});
