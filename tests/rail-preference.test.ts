/**
 * The rail's width is remembered on the **server** (#542 phase 2).
 *
 * This shell has removed a desktop width toggle once, for a reason worth keeping: it stored the
 * choice in `localStorage`, the server therefore had to draw the expanded rail, and the browser
 * corrected it after hydration — a column that changed width as the page settled, on every
 * navigation. The card that asks for the control again asks for it this way: a cookie, read in
 * `app/(mainlayout)/layout.tsx`, so the first paint is already right.
 *
 * The cases below are the three halves of that claim: the pure state machine (`railStateFrom`),
 * the wiring (the layout reads the cookie, the action writes it), and the one prohibition — no
 * `localStorage` in a path a server renders.
 */
import { describe, expect, it } from "vitest";

import {
  RAIL_COOKIE,
  RAIL_COOKIE_MAX_AGE,
  RAIL_STATES,
  railIsCollapsed,
  railStateFrom,
  toggledRailState,
} from "@/lib/shell/rail-preference";

describe("the rail's preference", () => {
  it("is expanded unless the cookie says otherwise", () => {
    expect(railStateFrom(undefined)).toBe("expanded");
    expect(railStateFrom("")).toBe("expanded");
    expect(railStateFrom("collapsed")).toBe("collapsed");
    // A tampered value must not be able to take the labels away: they are the rail's content.
    expect(railStateFrom("collapsed; path=/")).toBe("expanded");
    expect(railStateFrom("expanded")).toBe("expanded");
  });

  it("toggles between exactly the two states, both ways", () => {
    expect(toggledRailState("expanded")).toBe("collapsed");
    expect(toggledRailState("collapsed")).toBe("expanded");
    expect(toggledRailState(toggledRailState("expanded"))).toBe("expanded");
    expect(RAIL_STATES).toEqual(["expanded", "collapsed"]);
  });

  it("answers the view with one boolean", () => {
    expect(railIsCollapsed("collapsed")).toBe(true);
    expect(railIsCollapsed("expanded")).toBe(false);
    expect(railIsCollapsed(undefined)).toBe(false);
  });

  it("is a long-lived, first-party, single-purpose cookie", () => {
    expect(RAIL_COOKIE).toBe("shell.rail");
    expect(RAIL_COOKIE_MAX_AGE).toBeGreaterThanOrEqual(60 * 60 * 24 * 30);
  });
});

describe("the cookie is read on the server and written by an action", () => {
  it("reads it in the shell's layout, before any HTML exists", async () => {
    const { readFile } = await import("node:fs/promises");
    const layout = await readFile("app/(mainlayout)/layout.tsx", "utf8");
    expect(layout).toContain("cookies()");
    expect(layout).toContain("RAIL_COOKIE");
    expect(layout).toContain("railIsCollapsed");
    expect(layout).toContain("railCollapsed={");
  });

  it("writes it from a server action, and revalidates the shell", async () => {
    const { readFile } = await import("node:fs/promises");
    const action = await readFile("app/(mainlayout)/rail-actions.ts", "utf8");
    expect(action.startsWith('"use server"')).toBe(true);
    expect(action).toContain("RAIL_COOKIE");
    expect(action).toContain("store.set(");
    expect(action).toContain('revalidatePath("/", "layout")');
  });

  it("keeps the width out of browser storage, and out of client state", async () => {
    const { readFile } = await import("node:fs/promises");
    /**
     * Comments are stripped before the match on purpose: this repo explains *why* a previous
     * `localStorage` toggle was removed, in the very files that must not use one, and a rule that
     * failed on its own explanation would force the lesson out of the tree.
     */
    const code = (source: string) =>
      source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    for (const file of [
      "components/layout/sidebar.tsx",
      "components/layout/main-layout.tsx",
      "lib/shell/rail-preference.ts",
    ]) {
      const source = await readFile(file, "utf8");
      expect(code(source), file).not.toMatch(/localStorage|sessionStorage/);
    }
    // The sidebar draws the prop; it never decides it. A `useState` here would be the flash back.
    const sidebar = code(await readFile("components/layout/sidebar.tsx", "utf8"));
    expect(sidebar).not.toMatch(/setCollapsed|useState\(.*collapsed/);
    expect(sidebar).toContain("collapsed = false");
  });
});
