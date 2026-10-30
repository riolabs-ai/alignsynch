/**
 * The auth surfaces' two pure units (issue #164): the failure mapping and the `next` round-trip.
 *
 * Both are the parts of a login form that are worth testing without a browser: whether a wrong
 * password produces the *invalid credentials* message rather than "unknown", and whether a
 * `?next=` value can leave the site. The rest of the form is React state, and the acceptance for
 * that is a real sign-up/sign-in against Neon (reported with the card).
 */
import { describe, expect, it } from "vitest";

import { AUTH_FAILURES, authFailureItemId, authFailureOf } from "@/lib/auth/errors";
import { AFTER_SIGN_IN, loginPathFor, safeNextPath } from "@/lib/auth/paths";

describe("authFailureOf", () => {
  it("maps Better Auth's credential code to invalid credentials", () => {
    expect(authFailureOf({ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 })).toBe(
      "invalid-credentials",
    );
  });

  it("treats a 401 with no code as a rejected credential pair", () => {
    // The proxy answers 401 for both "no session" and "wrong password"; the only place that
    // status is rendered is the sign-in form.
    expect(authFailureOf({ status: 401 })).toBe("invalid-credentials");
  });

  it("maps a taken email to email-taken", () => {
    expect(authFailureOf({ code: "USER_ALREADY_EXISTS", status: 422 })).toBe("email-taken");
    expect(authFailureOf({ code: "user_already_exists_use_another_email" })).toBe("email-taken");
  });

  it("maps password and email shape codes", () => {
    expect(authFailureOf({ code: "PASSWORD_TOO_SHORT" })).toBe("weak-password");
    expect(authFailureOf({ code: "INVALID_EMAIL" })).toBe("invalid-email");
  });

  it("calls a transport failure a network failure, never invalid credentials", () => {
    expect(authFailureOf({ message: "Failed to fetch" })).toBe("network");
    expect(authFailureOf({ status: 0 })).toBe("network");
    expect(authFailureOf({ code: "NETWORK_TIMEOUT" })).toBe("network");
  });

  it("falls back to unknown for anything it does not recognise", () => {
    expect(authFailureOf(undefined)).toBe("unknown");
    expect(authFailureOf(null)).toBe("unknown");
    expect(authFailureOf({ code: "SOMETHING_ELSE", status: 500 })).toBe("unknown");
  });

  it("has a copy item for every failure kind", () => {
    for (const failure of AUTH_FAILURES) {
      expect(authFailureItemId(failure)).toMatch(/^error-[a-z-]+$/);
    }
  });
});

describe("safeNextPath", () => {
  it("keeps a same-site path", () => {
    expect(safeNextPath("/settings")).toBe("/settings");
    expect(safeNextPath("/dashboard/user?tab=wallet")).toBe("/dashboard/user?tab=wallet");
  });

  it("refuses anything that could leave the site", () => {
    expect(safeNextPath("//evil.example/steal")).toBe(AFTER_SIGN_IN);
    expect(safeNextPath("https://evil.example")).toBe(AFTER_SIGN_IN);
    expect(safeNextPath("javascript:alert(1)")).toBe(AFTER_SIGN_IN);
    expect(safeNextPath("")).toBe(AFTER_SIGN_IN);
    expect(safeNextPath(undefined)).toBe(AFTER_SIGN_IN);
  });
});

describe("loginPathFor", () => {
  it("round-trips a same-site path through the query string", () => {
    const path = loginPathFor("/profile/ada");
    expect(path.startsWith("/login?next=")).toBe(true);
    const encoded = path.slice("?next=".length + "/login".length);
    expect(safeNextPath(decodeURIComponent(encoded))).toBe("/profile/ada");
  });

  it("replaces an unsafe target with the default", () => {
    expect(loginPathFor("//evil.example")).toBe(`/login?next=${encodeURIComponent(AFTER_SIGN_IN)}`);
  });
});
