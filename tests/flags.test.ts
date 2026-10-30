/**
 * The flag resolver, pinned (issue #175).
 *
 * Three things are being proved here, and they are the three the issue asks for:
 *
 *   1. **the precedence** — `FLAG_<NAME>` beats the per-template value beats `default`. The
 *      order is the whole feature: an operator who sets `FLAG_X=0` has to be able to take a
 *      surface down on a template that ships it on, or the lever is advisory.
 *   2. **the shape** — every declared flag is a boolean `default`, and every one of the eight is
 *      `false`. "A mock on by default is how a mock reaches a client", so a `true` added to
 *      `data/flags.ts` has to fail a test, not just a review.
 *   3. **the server-only rule** — the resolver refuses to run in a browser. A flag the client
 *      decides cannot 404 a route or stop a query, which is the entire point of the mechanism.
 *
 * The pure `resolveFlag` is tested for the three precedence cases because it takes the context as
 * an argument — no `process.env` writes, no module reloads. `isEnabled` gets its own pass with
 * stubbed env to prove the plumbing (`FLAG_COMMUNITY_LEADERBOARD` and the mapping that derives
 * it) actually reaches the resolver.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { type FlagDefinition, flagDefinition, flags, zFlags } from "@/data/flags";
import {
  currentTemplate,
  envNameFor,
  hiddenNavHrefs,
  isEnabled,
  navSurfaces,
  parseOverride,
  resolveFlag,
} from "@/lib/flags";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** A definition that is not in the record: the precedence cases must not depend on a real flag. */
const definition = (over: Partial<FlagDefinition> = {}): FlagDefinition => ({
  default: false,
  note: "test fixture",
  ...over,
});

describe("precedence — env override beats template value beats default", () => {
  it("default: with no override and no template match, the default is the answer", () => {
    expect(resolveFlag(definition({ default: false }), { template: "quizhub" })).toBe(false);
    expect(resolveFlag(definition({ default: true }), { template: "quizhub" })).toBe(true);
  });

  it("template value: a listed template turns the flag on whatever the default says", () => {
    const flagged = definition({ default: false, templates: ["alignsynch"] });

    expect(resolveFlag(flagged, { template: "quizhub" })).toBe(false);
    expect(resolveFlag(flagged, { template: "alignsynch" })).toBe(true);
  });

  it("env override: 1 and 0 win over both the template value and the default", () => {
    const onForAlignsynch = definition({ default: false, templates: ["alignsynch"] });

    // 0 on a template the flag ships on: the override takes it down.
    expect(resolveFlag(onForAlignsynch, { template: "alignsynch", override: false })).toBe(false);
    // 1 on a default-false flag: the override turns it on.
    expect(resolveFlag(onForAlignsynch, { template: "quizhub", override: true })).toBe(true);
    // and it wins over a default of true in the other direction too.
    expect(
      resolveFlag(definition({ default: true }), { template: "quizhub", override: false }),
    ).toBe(false);
  });
});

describe("the environment value", () => {
  it("reads 1 and 0, and treats anything else as absent", () => {
    expect(parseOverride("1")).toBe(true);
    expect(parseOverride("0")).toBe(false);
    expect(parseOverride(" 1 ")).toBe(true);
    expect(parseOverride("")).toBeUndefined();
    expect(parseOverride(undefined)).toBeUndefined();
    // A typo must not be read as "on": `yes`, `true` and `on` are not the interface.
    expect(parseOverride("yes")).toBeUndefined();
    expect(parseOverride("true")).toBeUndefined();
  });

  it("derives FLAG_<NAME> from the dotted flag name", () => {
    expect(envNameFor("community.leaderboard")).toBe("FLAG_COMMUNITY_LEADERBOARD");
    expect(envNameFor("commerce.pricing")).toBe("FLAG_COMMERCE_PRICING");
    expect(envNameFor("create.editor")).toBe("FLAG_CREATE_EDITOR");
  });

  it("is read through isEnabled, not only through the pure resolver", () => {
    expect(isEnabled("community.leaderboard")).toBe(false);

    vi.stubEnv("FLAG_COMMUNITY_LEADERBOARD", "1");
    expect(isEnabled("community.leaderboard")).toBe(true);

    vi.stubEnv("FLAG_COMMUNITY_LEADERBOARD", "0");
    expect(isEnabled("community.leaderboard")).toBe(false);
  });

  it("ignores an unreadable value and says so once, instead of taking the app down", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("FLAG_COMMUNITY_TOURNAMENTS", "yes");

    // Falls through to the default — false, the conservative answer.
    expect(isEnabled("community.tournaments")).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("FLAG_COMMUNITY_TOURNAMENTS");

    // Second read: still ignored, not warned twice (one line per variable per process).
    expect(isEnabled("community.tournaments")).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("takes the template from BRAND, and defaults to quizhub", () => {
    vi.stubEnv("BRAND", "");
    expect(currentTemplate()).toBe("quizhub");
    vi.stubEnv("BRAND", "alignsynch");
    expect(currentTemplate()).toBe("alignsynch");
  });
});

describe("the record", () => {
  it("declares the eight surfaces the issue names, and nothing else", () => {
    expect(Object.keys(flags).sort()).toEqual([
      "commerce.affiliate",
      "commerce.pricing",
      "community.battle",
      "community.chat",
      "community.leaderboard",
      "community.tournaments",
      "create.editor",
      "create.generator",
    ]);
  });

  it("defaults every one of them to false — a mock on by default is how a mock ships", () => {
    const onByDefault = Object.entries(flags)
      .filter(([, flag]) => flag.default)
      .map(([name]) => name);
    expect(onByDefault).toEqual([]);
  });

  it("gives every flag a note that says what state the surface is in", () => {
    for (const [name, flag] of Object.entries(flags)) {
      expect(flag.note.length, `${name} has no note`).toBeGreaterThan(20);
    }
  });

  it("rejects an unknown key and a malformed definition", () => {
    const unknownKey = zFlags.safeParse({ ...flags, "community.nope": definition() });
    expect(unknownKey.success).toBe(false);

    const missingNote = zFlags.safeParse({
      ...flags,
      "community.battle": { default: false },
    });
    expect(missingNote.success).toBe(false);

    const emptyTemplates = zFlags.safeParse({
      ...flags,
      "community.battle": { default: false, note: "x", templates: [] },
    });
    expect(emptyTemplates.success).toBe(false);
  });

  it("throws on a name it does not carry, instead of reading as false", () => {
    expect(() => flagDefinition("community.nope" as never)).toThrow(/not declared/);
    expect(() => isEnabled("community.nope")).toThrow(/not declared/);
  });
});

describe("the nav and the browser", () => {
  it("hides the gated href when its flag is off, and shows it when on", () => {
    expect(navSurfaces["/leaderboard"]).toBe("community.leaderboard");
    expect(hiddenNavHrefs()).toEqual(["/leaderboard"]);

    vi.stubEnv("FLAG_COMMUNITY_LEADERBOARD", "1");
    expect(hiddenNavHrefs()).toEqual([]);
  });

  it("refuses to resolve in a browser — a flag the client decides enforces nothing", () => {
    vi.stubGlobal("window", {});
    expect(() => isEnabled("community.leaderboard")).toThrow(/server-only/);
  });
});
