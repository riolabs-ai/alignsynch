/**
 * The demo switch (#183, part 2): one variable mounts a backdoor, so production needs two.
 *
 * What is pinned here is the refusal, because it is the branch nobody exercises by hand — a
 * production deployment that inherited `DEMO_AUTH=1` from a copied environment file. Four
 * properties make the card's guard real rather than documented:
 *
 *   - `DEMO_AUTH=1` alone in production is `refused`, and `refused` is not demo mode;
 *   - `DEMO_ALLOW_PRODUCTION=1` **without** `DEMO_AUTH=1` is still off — the override cannot
 *     enable anything on its own, so a stray second variable is not a second chance;
 *   - only the exact string `1` counts, so `true`, `yes` and `1 ` do not mount a demo login;
 *   - demo mode cannot be entered with an empty `DEMO_PIN`, because a panel that compares
 *     against nothing is a one-click sign-in.
 *
 * The log line is checked too: it names the mode and the variables, and it never carries a
 * value. `mode=demo` in a log is the audit trail for a deliberate backdoor.
 */
import { describe, expect, it } from "vitest";

import { demoModeFor, demoModeLogLine, DEMO_FLAG_ON, type DemoEnv } from "@/lib/auth/demo-mode";

/** A local run with the flag off — the shape every gate, CI run and parity render sees. */
const OFF: DemoEnv = {
  demoAuth: undefined,
  vercelEnv: undefined,
  allowProduction: undefined,
  pin: undefined,
};

const LOCAL_DEMO: DemoEnv = {
  demoAuth: DEMO_FLAG_ON,
  vercelEnv: undefined,
  allowProduction: undefined,
  pin: "123456",
};

describe("demoModeFor", () => {
  it("is off when DEMO_AUTH is unset", () => {
    expect(demoModeFor(OFF)).toEqual({ kind: "off", reason: "unset" });
  });

  it("accepts no spelling but exactly 1", () => {
    for (const value of ["true", "yes", "on", "1 ", " 1", "", "2"]) {
      expect(demoModeFor({ ...LOCAL_DEMO, demoAuth: value })).toEqual({
        kind: "off",
        reason: "other-value",
      });
    }
  });

  it("mounts the panel in a non-production environment", () => {
    expect(demoModeFor(LOCAL_DEMO)).toEqual({ kind: "demo", production: false });
    expect(demoModeFor({ ...LOCAL_DEMO, vercelEnv: "preview" })).toEqual({
      kind: "demo",
      production: false,
    });
  });

  it("REFUSES DEMO_AUTH=1 in production without the second variable", () => {
    expect(
      demoModeFor({ ...LOCAL_DEMO, vercelEnv: "production", allowProduction: undefined }),
    ).toEqual({ kind: "refused", reason: "production" });
  });

  it("refuses in production when the second variable is any other value", () => {
    for (const value of ["true", "yes", "0", "", "1 "]) {
      expect(
        demoModeFor({ ...LOCAL_DEMO, vercelEnv: "production", allowProduction: value }),
      ).toEqual({ kind: "refused", reason: "production" });
    }
  });

  it("mounts in production only with both variables", () => {
    expect(
      demoModeFor({ ...LOCAL_DEMO, vercelEnv: "production", allowProduction: DEMO_FLAG_ON }),
    ).toEqual({ kind: "demo", production: true });
  });

  it("cannot enable anything from DEMO_ALLOW_PRODUCTION alone", () => {
    expect(
      demoModeFor({
        demoAuth: undefined,
        vercelEnv: "production",
        allowProduction: DEMO_FLAG_ON,
        pin: "123456",
      }),
    ).toEqual({ kind: "off", reason: "unset" });
  });

  it("refuses a demo login with no PIN", () => {
    for (const pin of [undefined, "", "   "]) {
      expect(demoModeFor({ ...LOCAL_DEMO, pin })).toEqual({
        kind: "refused",
        reason: "no-pin",
      });
    }
  });
});

describe("demoModeLogLine", () => {
  it("names the mode without carrying a value", () => {
    const line = demoModeLogLine(demoModeFor(LOCAL_DEMO));
    expect(line).toContain("mode=demo");
    expect(line).toContain("not a real login");
    // The PIN never reaches a log line, whatever it is.
    expect(line).not.toContain("123456");
  });

  it("says which side of the production guard a demo is on", () => {
    expect(
      demoModeLogLine(
        demoModeFor({ ...LOCAL_DEMO, vercelEnv: "production", allowProduction: DEMO_FLAG_ON }),
      ),
    ).toContain("DEMO_ALLOW_PRODUCTION=1");
  });

  it("reports a refusal as a refusal", () => {
    const refused = demoModeLogLine(
      demoModeFor({ ...LOCAL_DEMO, vercelEnv: "production", allowProduction: undefined }),
    );
    expect(refused).toContain("mode=refused");
    expect(refused).toContain("DEMO_ALLOW_PRODUCTION");
    expect(refused).not.toContain("123456");
  });

  it("says the panel is not mounted when the flag is off", () => {
    const line = demoModeLogLine(demoModeFor(OFF));
    expect(line).toContain("mode=off");
    expect(line).toContain("not mounted");
    // "off" never claims a demo login exists.
    expect(line).not.toContain("mode=demo");
    expect(line).not.toContain("not a real login");
  });
});
