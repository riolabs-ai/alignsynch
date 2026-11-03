/**
 * `/admin/audit` — the screen's gate, its two empty states and its own source (#501b).
 *
 * Three claims a pure module test cannot make:
 *
 *   1. **`support` gets the 404, and nothing is read.** The page is driven with the *real* policy
 *      (`roleAnswerFor`, the function `tests/require-role.test.ts` already pins) answering for a
 *      `support` session, and Next's own `notFound()` is what refuses. `readAuditLog` — the page's
 *      only database call — is a spy, so "no row was written anywhere by the attempt" is a claim
 *      about a call that never happened rather than about a comment.
 *   2. **The empty state is measured against the fixture clock.** The unfiltered empty render is
 *      asserted to carry `DEMO_NOW_ISO`'s date through `formatDateTimeLong` — a string that is the
 *      same on every machine at every hour, because a wall clock in a render path is the `#418`
 *      hydration mismatch `AGENTS.md` forbids.
 *   3. **A value is a key and a truncation.** The rendered row carries the party name for a short
 *      field and 48 characters plus a disclosure for a long one — never a whole `before` blob.
 *
 * The last block is a source assertion: neither the page nor its component imports the write path
 * or reads a clock. Comments are stripped first, because this tree documents `act()` and
 * `new Date()` by name in prose and a grep that reads prose is a grep that fails on a docstring.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** What the mocked gate answers with. `roleAnswerFor` decides what that means for the page. */
const gate = vi.hoisted(() => ({ role: "support" as "support" | "admin" | "owner" | "member" }));

/** The page's only database call, replaced: this file is about the gate and the render. */
const read = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => [] as unknown[]));

vi.mock("@/lib/db/admin-audit", () => ({
  readAuditLog: (...args: unknown[]) => read(...args),
}));

/**
 * The two heavyweight reads behind the session, stubbed so the *policy* can be real.
 *
 * `@/lib/auth/session` pulls Neon's SDK in, whose entry imports `next/headers` — a module a node
 * worker cannot resolve. Neither function is called here (`requireAdmin` is replaced below), so
 * stubbing them costs the test nothing and buys the real `roleAnswerFor`.
 */
vi.mock("@/lib/auth/session", () => ({
  currentUser: async () => null,
}));

vi.mock("@/lib/db/user-profiles", () => ({
  readUserProfileByUserId: async () => null,
  readUserProfileByHandle: async () => null,
}));

/**
 * The gate, still answered by the real policy.
 *
 * `requireAdmin` reads a cookie and a profile row, which a test cannot supply; the *question* —
 * what a `support` session gets — stays `roleAnswerFor`'s, and a refusal is Next's own
 * `notFound()`, so the digest asserted below is the one a request would carry.
 */
vi.mock("@/lib/auth/require-role", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/auth/require-role")>();
  const { notFound } = await import("next/navigation");
  return {
    ...real,
    requireAdmin: async () => {
      const answer = real.roleAnswerFor({ needed: "admin", signedIn: true, role: gate.role });
      if (answer.kind === "redirect") throw new Error(`an unexpected redirect to ${answer.to}`);
      if (answer.kind === "not-found") {
        notFound();
        // `notFound()` throws Next's control-flow signal; this line only satisfies the type.
        throw new Error("notFound() did not throw");
      }
      return {
        user: { userId: "auth-1", email: "a@b.c", name: "", sessionId: null },
        role: answer.role,
      };
    },
  };
});

/** Comments out, code left: a docstring may name `act()` without calling it. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("/admin/audit — the gate", () => {
  it("answers a support session with the 404 an unknown URL gets, and reads nothing", async () => {
    gate.role = "support";
    read.mockClear();
    const { default: AdminAuditPage } = await import("@/app/(mainlayout)/admin/audit/page");

    let digest: string | undefined;
    try {
      await AdminAuditPage({ searchParams: Promise.resolve({}) });
    } catch (error) {
      digest = (error as { digest?: string }).digest;
    }

    // The same digest an absent URL answers: a 403 would confirm the surface exists.
    expect(digest).toBe("NEXT_HTTP_ERROR_FALLBACK;404");
    // No row was read, and the screen has no write to attempt: `readAuditLog` is the page's only
    // database call, and it was never reached.
    expect(read).not.toHaveBeenCalled();
  });

  it("lets an admin through, and an owner too — the ladder is ranked, and this page names only `admin`", async () => {
    read.mockClear();
    const { default: AdminAuditPage } = await import("@/app/(mainlayout)/admin/audit/page");

    for (const role of ["admin", "owner"] as const) {
      gate.role = role;
      read.mockClear();
      read.mockResolvedValue([]);
      await expect(AdminAuditPage({ searchParams: Promise.resolve({}) })).resolves.toBeTruthy();
      expect(read, `${role} must reach the read`).toHaveBeenCalledTimes(1);
    }
  });
});

describe("/admin/audit — what the page renders", () => {
  it("renders the empty log with the fixture clock, and the filtered empty state without it", async () => {
    gate.role = "admin";
    read.mockClear();
    read.mockResolvedValue([]);
    const { default: AdminAuditPage } = await import("@/app/(mainlayout)/admin/audit/page");
    const { renderToStaticMarkup } = await import("react-dom/server");

    const unfiltered = renderToStaticMarkup(
      (await AdminAuditPage({ searchParams: Promise.resolve({}) })) as ReactElement,
    );
    expect(unfiltered).toContain("No admin action is recorded");
    // `DEMO_NOW_ISO` through `formatDateTimeLong`, not `new Date()`: the sentence is identical on
    // every machine at every hour, which is what makes it a screenshot and a test at once.
    expect(unfiltered).toContain("The log is empty as of Thursday, October 29 at 12:00 PM.");

    const filtered = renderToStaticMarkup(
      (await AdminAuditPage({
        searchParams: Promise.resolve({ action: "role.change" }),
      })) as ReactElement,
    );
    expect(filtered).toContain("Nothing matches this view");
    expect(filtered).not.toContain("The log is empty as of");
    // The axis is on the page as a chip that removes itself, and the URL is what carries it.
    expect(filtered).toContain("Action: role.change");
    expect(filtered).toContain('href="/admin/audit"');
  });

  it("renders a row with keys and truncation, never a whole before/after blob", async () => {
    gate.role = "admin";
    read.mockClear();
    read.mockResolvedValue([
      {
        id: "action-1",
        actorUserId: "auth-owner",
        actorEmail: "owner@example.com",
        actorRole: "owner",
        action: "instance.delete",
        targetTable: "session",
        targetId: "instance-1",
        reason: "removed at the owner's request",
        before: { name: "Avery Chen", paragraph: "y".repeat(200) },
        after: null,
        createdAt: "2026-10-29T11:45:00.000Z",
      },
    ]);
    const { default: AdminAuditPage } = await import("@/app/(mainlayout)/admin/audit/page");
    const { renderToStaticMarkup } = await import("react-dom/server");

    const html = renderToStaticMarkup(
      (await AdminAuditPage({ searchParams: Promise.resolve({}) })) as ReactElement,
    );

    // Who, in which capacity, what they touched, and the link that answers for an operator.
    expect(html).toContain("owner@example.com");
    expect(html).toContain(">owner<");
    expect(html).toContain("session#instance-1");
    expect(html).toContain('href="/admin/instances"');
    expect(html).toContain("removed at the owner&#x27;s request");

    // A short value is drawn; a long one is 48 characters and an ellipsis inside a disclosure.
    expect(html).toContain("Avery Chen");
    expect(html).toContain(`${"y".repeat(48)}…`);
    expect(html).toContain("<details>");
    // A create has no before and a delete no after — the word is the fixture's, not "null".
    expect(html).toContain("Nothing was here");
  });
});

describe("the screen's own source", () => {
  const page = "app/(mainlayout)/admin/audit/page.tsx";
  const component = "components/admin/audit-log.tsx";
  const pure = "lib/admin/audit-log.ts";

  it("never imports or calls the write path", () => {
    for (const file of [page, component]) {
      // The vocabulary lives beside `act()` in that module, so the *pure* module may import the
      // list; the page and the component may not reach the write path at all.
      expect(code(readFileSync(`${ROOT}${file}`, "utf8"))).not.toMatch(/admin\/act/);
    }
    for (const file of [page, component, pure]) {
      expect(
        code(readFileSync(`${ROOT}${file}`, "utf8")),
        `${file} must not call act()`,
      ).not.toMatch(/\bact\s*\(/);
    }
  });

  it("reads no wall clock: `new Date()` with no argument is the #418 mismatch", () => {
    for (const file of [page, component, pure]) {
      expect(
        code(readFileSync(`${ROOT}${file}`, "utf8")),
        `${file} must not read a clock in a render path`,
      ).not.toContain("new Date()");
    }
  });
});
