/**
 * The demo panel's refusals, and the sentence each one gets (#216).
 *
 * The defect this file pins: every refusal — a wrong PIN, an unknown button, a `demo_account` row
 * that was never seeded, and a sign-in the auth server refused — answered "That PIN is not
 * correct.", so a person whose PIN was right (the origin was not on the branch's trusted list) was
 * told to check the one thing that worked.
 *
 * What is asserted rather than described:
 *
 *   - a wrong PIN and an unknown role still share **one** sentence, so no reply says whether an
 *     account exists behind a button;
 *   - the origin and network causes render the **login page's own words**, joined through
 *     `authFailureItemId()`, so there is one phrasing of "this address is not authorised" in the
 *     tree — the two fixtures and the demo cannot drift apart;
 *   - nothing rendered carries the provider's message, a password or a token, even when the raw
 *     error is passed straight in.
 */
import { describe, expect, it } from "vitest";

import { loginPageCopy } from "@/data/pages/login";
import { registerPageCopy } from "@/data/pages/register";
import { authFailureItemId } from "@/lib/auth/errors";
import {
  DEMO_NOT_SEEDED,
  DEMO_SIGN_IN_REFUSED,
  NOT_SEEDED,
  PIN_REJECTED,
  signInRefused,
} from "@/lib/auth/demo-failure";
import { PIN_REJECTION } from "@/lib/auth/demo-pin";
import { itemLabel, sectionOf } from "@/lib/page-copy";

const loginSignIn = sectionOf(loginPageCopy, "sign-in");
const registerStatus = sectionOf(registerPageCopy, "status");

/** Every sentence this module can render. Kept in one place so "no secret" is checked over all of them. */
const ALL_MESSAGES = [
  PIN_REJECTED.message,
  NOT_SEEDED.message,
  DEMO_SIGN_IN_REFUSED,
  signInRefused({ code: "INVALID_ORIGIN", status: 403 }).message,
  signInRefused({ message: "Failed to fetch" }).message,
];

describe("a wrong PIN and an unknown role", () => {
  it("keep the single sentence that says nothing about an account", () => {
    expect(PIN_REJECTED.kind).toBe("pin");
    expect(PIN_REJECTED.message).toBe(PIN_REJECTION);
    expect(PIN_REJECTED.message).toBe("That PIN is not correct.");
  });

  it("is not the sentence a missing account or a refused sign-in gets", () => {
    expect(PIN_REJECTED.message).not.toBe(NOT_SEEDED.message);
    expect(PIN_REJECTED.message).not.toBe(DEMO_SIGN_IN_REFUSED);
  });
});

describe("a missing demo_account row", () => {
  it("has its own sentence, and it says what to do instead of checking the PIN", () => {
    expect(NOT_SEEDED.kind).toBe("not-seeded");
    expect(NOT_SEEDED.message).toBe(DEMO_NOT_SEEDED);
    expect(DEMO_NOT_SEEDED).toContain("reset");
    // The PIN was right, so the reply must not send the reader back to it.
    expect(DEMO_NOT_SEEDED).not.toMatch(/PIN is not correct|wrong PIN/i);
  });

  it("names the role, never an address", () => {
    expect(DEMO_NOT_SEEDED).not.toMatch(/@/);
    expect(DEMO_NOT_SEEDED).not.toMatch(/demo\.alignsynch\.test/);
  });
});

describe("a refused sign-in", () => {
  it("reads as an origin rejection when that is what happened (#203, #216)", () => {
    // What Neon Auth answers when the code survives.
    const byCode = signInRefused({ code: "INVALID_ORIGIN", status: 403 });
    expect(byCode.kind).toBe("origin");

    // What actually reaches the action: `@neon/auth` normalises a non-2xx answer into an
    // `AuthApiError`, remapping the code and keeping Better Auth's message. Measured on the demo
    // branch: 403 {"message":"Invalid origin","code":"INVALID_ORIGIN"}.
    const thrown = signInRefused({
      name: "AuthApiError",
      message: "Invalid origin",
      status: 403,
      code: "feature_not_supported",
    });
    expect(thrown.kind).toBe("origin");
    expect(thrown.message).toBe(byCode.message);
  });

  it("is not the PIN sentence", () => {
    expect(signInRefused({ code: "INVALID_ORIGIN", status: 403 }).message).not.toBe(PIN_REJECTION);
  });

  it("reuses the login page's wording rather than inventing a second phrasing", () => {
    const origin = itemLabel(loginSignIn, authFailureItemId("origin"));
    expect(signInRefused({ code: "INVALID_ORIGIN", status: 403 }).message).toBe(origin);
    // The register form describes the same fact; one phrasing, so the two fixtures agree.
    expect(itemLabel(registerStatus, authFailureItemId("origin"))).toBe(origin);
    expect(origin).toMatch(/address isn't authorised/);
  });

  it("says the connection failed when the transport failed, and does not blame the address", () => {
    const network = signInRefused({ message: "Failed to fetch" });
    expect(network.kind).toBe("network");
    expect(network.message).toBe(itemLabel(loginSignIn, authFailureItemId("network")));
    expect(network.message).not.toBe(itemLabel(loginSignIn, authFailureItemId("origin")));
  });

  it("has its own sentence for every other refusal, and says the PIN was accepted", () => {
    for (const error of [
      { code: "INVALID_EMAIL_OR_PASSWORD", status: 401 },
      { code: "SOMETHING_ELSE", status: 500 },
      undefined,
    ]) {
      const failure = signInRefused(error);
      expect(failure.kind).toBe("sign-in");
      expect(failure.message).toBe(DEMO_SIGN_IN_REFUSED);
    }
    expect(DEMO_SIGN_IN_REFUSED).toMatch(/PIN was accepted/);
    expect(DEMO_SIGN_IN_REFUSED).not.toMatch(/PIN is not correct/i);
  });
});

describe("nothing rendered is a credential or the provider's own words", () => {
  it("never echoes a password, a token or a secret", () => {
    for (const message of ALL_MESSAGES) {
      expect(message).not.toMatch(/password|token|secret|bearer/i);
    }
  });

  it("never renders the error it was given", () => {
    const providerMessage = "Invalid origin";
    const rendered = signInRefused({
      name: "AuthApiError",
      message: providerMessage,
      status: 403,
      code: "feature_not_supported",
    }).message;
    expect(rendered).not.toContain(providerMessage);

    // And a message that contains an address is classified, not printed.
    const withAddress = signInRefused({
      message: "origin http://127.0.0.1:3000 is not allowed for admin@demo.alignsynch.test",
      status: 403,
    }).message;
    expect(withAddress).not.toContain("127.0.0.1");
    expect(withAddress).not.toContain("@demo.alignsynch.test");
  });

  it("keeps every outcome a distinct sentence", () => {
    expect(new Set(ALL_MESSAGES).size).toBe(ALL_MESSAGES.length);
  });
});
