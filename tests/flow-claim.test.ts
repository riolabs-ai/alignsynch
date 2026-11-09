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
import { describe, expect, it, vi } from "vitest";
import { AssessmentInstanceView } from "@/components/assessment-flow/instance-view";
import { CounterpartyWizard } from "@/components/assessment-flow/counterparty-wizard";
import { InviteView } from "@/components/assessment-flow/invite-view";
import { assessmentInstancePageCopy } from "@/data/pages/assessment-instance";
import { invitePageCopy } from "@/data/pages/invite";
import { loginPageCopy } from "@/data/pages/login";
import { signInDestination } from "@/lib/auth/next-path";
import { invitePromptFor } from "@/lib/auth/invite-prompt";
import {
  CLAIM_REFUSALS,
  claimConfirmationValue,
  claimRefusalOf,
  confirmationMatches,
  isTokenStateRefusal,
} from "@/lib/flow/claim";
import {
  inviteAuthPath,
  inviteStepPath,
  inviteWizardStepOf,
  submittedPath,
} from "@/lib/flow/paths";
import type { FlowScreen } from "@/lib/flow/screen";
import { partyTokensFrom } from "@/lib/flow/session";
import type { InvitePreview } from "@/lib/flow/store";
import { itemLabel, sectionOf } from "@/lib/page-copy";

/**
 * #710 — the response renders inside `StageShell`, whose only Next dependency is `useRouter`.
 * No render here navigates: the stub keeps a render a render.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

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
    instanceRecordId: "instance-1",
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

function wizardMarkup(input: Parameters<typeof CounterpartyWizard>[0]): string {
  return renderToStaticMarkup(createElement(CounterpartyWizard, input));
}

const CLAIM_CONTROL = "Accept the invitation";

describe("the invitation's refusal bands", () => {
  it("refuses the Initiator their own invitation, and offers no control that would take it", () => {
    const html = inviteMarkup({
      copy: invitePageCopy,
      preview: preview({ viewerRole: "initiator" }),
    });
    expect(html).toContain("You are answering as Avery, the Initiator.");
    expect(html).toContain("You already have a seat in this instance");
    expect(html).toContain("Nothing was claimed");
    expect(html).not.toContain("You are joining as");
  });

  it("names the Counterparty on a later visit too, and still offers no claim control", () => {
    const html = inviteMarkup({
      copy: invitePageCopy,
      preview: preview({ viewerRole: "counterparty" }),
    });
    expect(html).toContain("You are answering as Rowan, the Counterparty.");
    expect(html).not.toContain(CLAIM_CONTROL);
  });

  it("does not repeat the token's own state as a second refusal", () => {
    const html = inviteMarkup({
      copy: invitePageCopy,
      preview: preview({ state: "claimed" }),
      refusal: "claimed",
    });
    expect(html).toContain("This invitation was used already");
    expect(html).not.toContain("Nothing was claimed");
  });
});

/* ------------------------------------------------------------------ *\
 * The onboarding wizard (#t_0aa81144)
 * ------------------------------------------------------------------ */

describe("the counterparty wizard", () => {
  it("step 1 says who invited them and what this is, and claims nothing", () => {
    const html = wizardMarkup({
      copy: invitePageCopy,
      preview: preview(),
      token: "token-1",
      step: 1,
      viewerName: null,
    });
    expect(html).toContain("Avery invited you to answer Relationship Basics.");
    // #710 — the rail is the flow's six stages, and this screen is Connect (stage 5).
    expect(html).toContain("Stage 5 of 6");
    expect(html).toContain('data-step-state="current"');
    expect(html).not.toContain('name="confirm"');
    expect(html).toContain('href="/invite/token-1?step=2"');
  });

  it("step 2 explains the order, and the back link returns to step 1 with the token", () => {
    const html = wizardMarkup({
      copy: invitePageCopy,
      preview: preview(),
      token: "token-1",
      step: 2,
      viewerName: null,
    });
    expect(html).toContain("Stage 5 of 6");
    expect(html).toContain("You can change any opinion until you accept the session.");
    expect(html).toContain('href="/invite/token-1"');
    expect(html).toContain('href="/invite/token-1?step=3"');
  });

  it("step 3 signed out offers sign-in and sign-up, both carrying the step URL as next", () => {
    const html = wizardMarkup({
      copy: invitePageCopy,
      preview: preview(),
      token: "token-1",
      step: 3,
      viewerName: null,
    });
    expect(html).toContain("Stage 5 of 6");
    expect(html).toContain("Accepting costs you nothing");
    expect(html).toContain(
      'href="/login?next=%2Finvite%2Ftoken-1%3Fstep%3D3&amp;intent=invite&amp;inviter=Avery"',
    );
    expect(html).toContain(
      'href="/register?next=%2Finvite%2Ftoken-1%3Fstep%3D3&amp;intent=invite&amp;inviter=Avery"',
    );
    expect(html).not.toContain('name="confirm"');
  });

  it("step 3 signed in is the one screen that can claim", () => {
    const html = wizardMarkup({
      copy: invitePageCopy,
      preview: preview(),
      token: "token-1",
      step: 3,
      viewerName: "Rowan",
    });
    expect(html).toContain("You are signed in as Rowan.");
    expect(html).toContain('action="/invite/token-1/claim"');
    expect(html).toContain('name="confirm"');
    expect(html).toContain('value="Rowan"');
    expect(html).toContain(CLAIM_CONTROL);
    expect(html).not.toContain('href="/login?next=');
  });

  it("draws the store's refusal sentence on the step the claim was refused from", () => {
    const html = wizardMarkup({
      copy: invitePageCopy,
      preview: preview(),
      token: "token-1",
      step: 3,
      viewerName: "Rowan",
      refusal: "unconfirmed",
    });
    expect(html).toContain("Nothing was claimed: the claim did not confirm joining as Rowan.");
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
    mode: "basic",
    setting: "soft",
    viewer: { role, name: role === "initiator" ? "Avery" : "Rowan" },
    aspects: [],
    initiatorName: "Avery",
    counterpartyName: role === "initiator" ? null : "Rowan",
    seats: [
      { role: "initiator" as const, name: "Avery", answered: 0, acceptedAt: null },
      ...(role === "initiator"
        ? []
        : [{ role: "counterparty" as const, name: "Rowan", answered: 0, acceptedAt: null }]),
    ],
    viewerAnswered: 0,
    viewerAccepted: false,
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

/* ------------------------------------------------------------------ *\
 * The addresses the wizard hands around (#t_0aa81144)
 * ------------------------------------------------------------------ */

describe("the wizard's addresses", () => {
  it("keeps the token in the path on every step", () => {
    expect(inviteStepPath("token-1", 1)).toBe("/invite/token-1");
    expect(inviteStepPath("token-1", 2)).toBe("/invite/token-1?step=2");
    expect(inviteStepPath("token-1", 3)).toBe("/invite/token-1?step=3");
  });

  it("reads a step, and falls back to step 1 rather than failing", () => {
    expect(inviteWizardStepOf("1")).toBe(1);
    expect(inviteWizardStepOf("2")).toBe(2);
    expect(inviteWizardStepOf("3")).toBe(3);
    expect(inviteWizardStepOf("0")).toBe(1);
    expect(inviteWizardStepOf("4")).toBe(1);
    expect(inviteWizardStepOf("nope")).toBe(1);
    expect(inviteWizardStepOf(undefined)).toBe(1);
    expect(inviteWizardStepOf(["2", "3"])).toBe(2);
  });

  it("sends sign-in and sign-up back to the same step, token intact", () => {
    const login = inviteAuthPath("login", "token-1", 3, "Avery");
    expect(login).toBe("/login?next=%2Finvite%2Ftoken-1%3Fstep%3D3&intent=invite&inviter=Avery");
    const register = inviteAuthPath("register", "token-1", 3, "Avery");
    expect(register).toBe(
      "/register?next=%2Finvite%2Ftoken-1%3Fstep%3D3&intent=invite&inviter=Avery",
    );
  });

  it("survives the login page's own validation — the round-trip target is the step, not home", () => {
    const next = new URL(
      inviteAuthPath("login", "token-1", 3, "Avery"),
      "https://app.example",
    ).searchParams.get("next");
    expect(next).toBe("/invite/token-1?step=3");
    for (const brandDestination of ["/dashboard", "/dashboard/user"]) {
      expect(signInDestination(next, brandDestination)).toBe("/invite/token-1?step=3");
    }
  });

  it("lands a submit on the instance's confirmation state", () => {
    expect(submittedPath("instance-1")).toBe("/assessment/instances/instance-1?submitted=1");
  });
});

/* ------------------------------------------------------------------ *\
 * The login page's one sentence (#t_0aa81144)
 * ------------------------------------------------------------------ */

describe("invitePromptFor", () => {
  it("names the inviter when the wizard passed one through", () => {
    expect(
      invitePromptFor(loginPageCopy, {
        intent: "invite",
        inviter: "Avery",
        next: "/invite/token-1?step=3",
      }),
    ).toBe("Sign in to accept Avery's invitation.");
  });

  it("still says why with no name, rather than nothing", () => {
    expect(
      invitePromptFor(loginPageCopy, {
        intent: "invite",
        inviter: "",
        next: "/invite/token-1?step=3",
      }),
    ).toBe("Sign in to accept the invitation you were sent.");
  });

  it("reads an older link that carries only next", () => {
    expect(
      invitePromptFor(loginPageCopy, {
        intent: undefined,
        inviter: undefined,
        next: "/invite/token-1?step=3",
      }),
    ).toBe("Sign in to accept the invitation you were sent.");
  });

  it("is absent for an ordinary visit", () => {
    expect(
      invitePromptFor(loginPageCopy, {
        intent: undefined,
        inviter: "Avery",
        next: "/settings",
      }),
    ).toBeNull();
  });

  it("caps what it will print from a URL", () => {
    const long = "A".repeat(200);
    const prompt = invitePromptFor(loginPageCopy, {
      intent: "invite",
      inviter: long,
      next: "/invite/token-1",
    });
    expect(prompt).toBe(`Sign in to accept ${"A".repeat(80)}'s invitation.`);
  });
});

/* ------------------------------------------------------------------ *\
 * The confirmation a submit lands on (#t_0aa81144)
 * ------------------------------------------------------------------ */

describe("the post-submit confirmation", () => {
  const render = (role: "initiator" | "counterparty", submitted: boolean) =>
    renderToStaticMarkup(
      createElement(AssessmentInstanceView, {
        screen: screen(role),
        copy: assessmentInstancePageCopy,
        submitted,
      }),
    );

  it("thanks the Counterparty, names the other party and says how to change an opinion", () => {
    const html = render("counterparty", true);
    expect(html).toContain("Thank you — your answers are saved");
    expect(html).toContain("Avery answers the same questions from their side and accepts");
    expect(html).toContain("How to change an opinion");
    expect(html).toContain('href="/assessment/instances/instance-1/answer"');
    expect(html).toContain('data-submitted-confirmation=""');
  });

  it("is not drawn on an ordinary visit to the same screen", () => {
    expect(render("counterparty", false)).not.toContain("Thank you — your answers are saved");
  });
});
