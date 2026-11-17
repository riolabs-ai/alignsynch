/**
 * `/admin/permissions` (#1126) — the gates, the honest failure state, and the parse behind them.
 *
 * Four claims, and each one is the thing the issue's acceptance line asks for:
 *
 *   1. **The gates run in `/admin/docs` order.** `requireAdminProduct()` is the capability, and it
 *      closes before a session is read; then `requireAdmin({ next: "/admin/permissions" })` through
 *      the **real** policy — a member is refused with Next's own `notFound()` (never a redirect,
 *      never a 403), and a signed-out visitor is sent to `/login?next=/admin/permissions`.
 *   2. **A source that is absent is a panel, not an empty table.** The matrix file does not exist on
 *      this tree yet, so the rendered page names `docs/specs/v2-prototype/crud-matrix.md`, says an
 *      owner supplies it, and draws no `<table>` at all. The eleven P0 gaps and the six role ×
 *      action rules still render: they are #1126's own text, not the source's rows.
 *   3. **A source that parses becomes rows and honest figures.** With the reader stubbed to a real
 *      15-row-shaped document, every header figure comes from `countsOf()` over the cells — so
 *      "counts match the source file" is a property of the code, not of a copied number.
 *   4. **Read-only, and the filter is the address.** The served markup carries no form, no input and
 *      no button; each filter is a `Link` whose href round-trips through `parseCrudFilter`, and the
 *      facets combine.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** What the mocked role gate answers with — the *policy* underneath it stays real. */
const gate = vi.hoisted(() => ({
  role: "admin" as "support" | "admin" | "owner" | "member" | "signed-out",
}));

/** The capability switch, flipped by the capability case and reset by every other. */
const capability = vi.hoisted(() => ({ adminProduct: true }));

/**
 * The matrix the page reads. `null` is the tree's own state today (no source file), which is the
 * failure panel; a list is a source that parsed.
 */
const source = vi.hoisted(() => ({
  cells: null as
    | null
    | {
        object: string;
        action: string;
        role: string;
        prototype: "covered" | "hinted" | "missing" | "n/a";
        selector: string;
        upstream: "exists" | "not-found" | "conflict";
        mvp: string;
        rationale: string;
        priority: "P0" | "P1" | "P2" | "Won't" | "none";
      }[],
}));

/** A spy, so "the capability closed before a session was read" is a claim about a call. */
const requireAdminSpy = vi.hoisted(() => vi.fn());

vi.mock("@/lib/brand-boundary", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/brand-boundary")>();
  const { notFound } = await import("next/navigation");
  return {
    ...real,
    requireAdminProduct: () => {
      if (!capability.adminProduct) notFound();
    },
  };
});

vi.mock("@/lib/auth/session", () => ({
  currentUser: async () => null,
}));

vi.mock("@/lib/db/user-profiles", () => ({
  readUserProfileByUserId: async () => null,
  readUserProfileByHandle: async () => null,
}));

vi.mock("@/lib/auth/require-role", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/auth/require-role")>();
  const { notFound, redirect } = await import("next/navigation");
  return {
    ...real,
    requireAdmin: async (options: { readonly next?: string } = {}) => {
      requireAdminSpy(options);
      const answer = real.roleAnswerFor({
        needed: "admin",
        signedIn: gate.role !== "signed-out",
        role: gate.role === "signed-out" ? null : gate.role,
        ...(options.next === undefined ? {} : { next: options.next }),
      });
      if (answer.kind === "redirect") {
        redirect(answer.to);
        throw new Error("redirect() did not throw");
      }
      if (answer.kind === "not-found") {
        notFound();
        throw new Error("notFound() did not throw");
      }
      return {
        user: { userId: "auth-1", email: "a@b.c", name: "", sessionId: null },
        role: answer.role,
      };
    },
  };
});

/** The reader, switched by `source.cells`: absent (the tree's state) or a parsed matrix. */
vi.mock("@/lib/admin/crud-matrix-file", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/admin/crud-matrix-file")>();
  const matrix = await import("@/lib/admin/crud-matrix");
  return {
    ...real,
    readCrudMatrix: () => {
      if (source.cells === null) {
        throw new matrix.CrudMatrixUnreadable(
          `${matrix.CRUD_MATRIX_PATH} is not present in this tree, so there is no matrix to read`,
        );
      }
      return source.cells;
    },
  };
});

/** Next's `notFound()` digest, read the way the other console page tests read it. */
async function digestOf(call: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await call();
    return undefined;
  } catch (error) {
    return (error as { digest?: string }).digest;
  }
}

/** The page, as markup, for the mocked role and the mocked source. */
async function render(): Promise<string> {
  const { default: Page } = await import("@/app/(mainlayout)/admin/permissions/page");
  const { renderToStaticMarkup } = await import("react-dom/server");
  return renderToStaticMarkup((await Page({})) as ReactElement);
}

describe("/admin/permissions — the gate", () => {
  it("answers a member with the 404 an unknown URL gets", async () => {
    gate.role = "member";
    capability.adminProduct = true;
    const { default: Page } = await import("@/app/(mainlayout)/admin/permissions/page");

    expect(await digestOf(() => Page({}))).toBe("NEXT_HTTP_ERROR_FALLBACK;404");
  });

  it("answers a support seat the same way — the ladder's floor is admin", async () => {
    gate.role = "support";
    const { default: Page } = await import("@/app/(mainlayout)/admin/permissions/page");

    expect(await digestOf(() => Page({}))).toBe("NEXT_HTTP_ERROR_FALLBACK;404");
  });

  it("sends a signed-out visitor to /login with the page as the destination", async () => {
    gate.role = "signed-out";
    const { default: Page } = await import("@/app/(mainlayout)/admin/permissions/page");

    let destination = "";
    try {
      await Page({});
    } catch (error) {
      destination = String((error as { digest?: string }).digest ?? "");
    }
    expect(destination).toContain("/login?next=%2Fadmin%2Fpermissions");
  });

  it("refuses a template that does not claim the console before any session is read", async () => {
    capability.adminProduct = false;
    gate.role = "admin";
    requireAdminSpy.mockClear();
    const { default: Page } = await import("@/app/(mainlayout)/admin/permissions/page");

    expect(await digestOf(() => Page({}))).toBe("NEXT_HTTP_ERROR_FALLBACK;404");
    expect(requireAdminSpy).not.toHaveBeenCalled();
    capability.adminProduct = true;
  });

  it("lets an admin through, and asks for the page as the next destination", async () => {
    gate.role = "admin";
    requireAdminSpy.mockClear();
    source.cells = null;
    const { default: Page } = await import("@/app/(mainlayout)/admin/permissions/page");

    await expect(Page({})).resolves.toBeTruthy();
    expect(requireAdminSpy).toHaveBeenCalledWith({ next: "/admin/permissions" });
  });
});

describe("/admin/permissions — the source that is not there yet", () => {
  it("names the missing file, says an owner supplies it, and draws no table", async () => {
    gate.role = "admin";
    capability.adminProduct = true;
    source.cells = null;
    const html = await render();

    expect(html).toContain("docs/specs/v2-prototype/crud-matrix.md");
    expect(html).toContain("An owner supplies the file");
    expect(html).toContain("data-matrix-unreadable");
    // The one lie the screen must not tell: an empty table that reads as "the matrix has no rows".
    expect(html).not.toContain("<table");
  });

  it("still states the rules and the eleven P0 gaps — they are the issue's text, not rows", async () => {
    gate.role = "admin";
    source.cells = null;
    const html = await render();

    expect(html).toContain("Role × action rules");
    expect(html).toContain(
      "The Counterparty never sees a price, the word trial, a card or an extension.",
    );
    expect(html).toContain("P0 gaps");
    // Eleven items, numbered 1–11: the backbone of the release, not a summary of the matrix.
    expect(html).toContain(
      "Billing: trial pause / extra week enforced in billing, not only in HTML",
    );
    expect(html).toContain(">11<");
  });

  it("carries the two links that leave the app, with the new-tab contract", async () => {
    gate.role = "admin";
    source.cells = null;
    const html = await render();

    expect(html).toContain("https://cursor.com/canvas/store-5adda110");
    expect(html).toContain("https://github.com/riolabs-ai/alignsynch/issues/1119");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("opens in a new tab");
  });

  it("is read-only: no form, no input, no button anywhere in the served markup", async () => {
    gate.role = "admin";
    source.cells = null;
    const html = await render();

    expect(html).not.toContain("<form");
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<button");
  });

  it("has no client component in the surface — the page ships no JavaScript of its own", () => {
    const console = readFileSync(
      `${ROOT}components/admin/permissions/permissions-console.tsx`,
      "utf8",
    );
    const page = readFileSync(`${ROOT}app/(mainlayout)/admin/permissions/page.tsx`, "utf8");

    for (const file of [console, page]) {
      // A directive is the first statement of the file, never a mention in a docstring.
      expect(file).not.toMatch(/^["']use client["'];/m);
      expect(file).not.toMatch(/^["']use server["'];/m);
    }
  });
});

describe("/admin/permissions — a source that parses", () => {
  /** Five cells: one per status, two P0, one conflict, one the matrix does not schedule. */
  const CELLS = [
    {
      object: "Template",
      action: "Create",
      role: "Initiator",
      prototype: "covered" as const,
      selector: "data-template-create",
      upstream: "exists" as const,
      mvp: "yes",
      rationale: "The library's own create path.",
      priority: "P0" as const,
    },
    {
      object: "Template",
      action: "Archive",
      role: "Initiator",
      prototype: "hinted" as const,
      selector: "data-card-kebab",
      upstream: "not-found" as const,
      mvp: "yes",
      rationale: "No archive control draws today.",
      priority: "P0" as const,
    },
    {
      object: "Relationship",
      action: "Leave",
      role: "Counterparty",
      prototype: "missing" as const,
      selector: "data-close-relationship",
      upstream: "conflict" as const,
      mvp: "no",
      rationale: "Upstream deletes; the spec closes.",
      priority: "P1" as const,
    },
    {
      object: "Template",
      action: "Restore",
      role: "Admin-curator",
      prototype: "n/a" as const,
      selector: "",
      upstream: "exists" as const,
      mvp: "no",
      rationale: "Not a role action on this screen.",
      priority: "none" as const,
    },
    {
      object: "Relationship",
      action: "Propose a change",
      role: "Initiator",
      prototype: "missing" as const,
      selector: "",
      upstream: "not-found" as const,
      mvp: "no",
      rationale: "The silent write this replaces.",
      priority: "Won't" as const,
    },
  ];

  it("draws every cell, with the figures the rows imply", async () => {
    gate.role = "admin";
    source.cells = CELLS;
    const html = await render();

    expect(html).toContain("<table");
    expect(html.match(/data-cell=/g) ?? []).toHaveLength(5);
    // countsOf, over the whole matrix: 5 cells, 4 applicable, 1 covered, 1 hinted, 2 missing,
    // 2 P0, 1 P1, 0 P2, 1 won't, 1 conflict.
    for (const figure of [
      "5 cells",
      "4 applicable",
      "1 covered",
      "1 hinted",
      "2 missing",
      "2 P0",
      "1 P1",
      "0 P2",
      "1 won&#x27;t",
      "1 upstream conflicts",
    ]) {
      expect(html, `${figure} is a header figure`).toContain(figure);
    }
    expect(html).toContain("5 of 5 cells shown");
  });

  it("carries each filter as a link, and the facets combine in the address", async () => {
    gate.role = "admin";
    source.cells = CELLS;
    const html = await render();

    // One chip per distinct value, plus "All" for each of the five facets.
    expect(html).toContain('href="/admin/permissions?role=Counterparty"');
    expect(html).toContain('href="/admin/permissions?object=Template"');
    expect(html).toContain('href="/admin/permissions?prototype=missing"');
    expect(html).toContain('href="/admin/permissions?upstream=conflict"');
    expect(html).toContain('href="/admin/permissions?priority=P0"');
  });

  it("narrows the table to the address, and says how much of the matrix it shows", async () => {
    gate.role = "admin";
    source.cells = CELLS;
    const { default: Page } = await import("@/app/(mainlayout)/admin/permissions/page");
    const { renderToStaticMarkup } = await import("react-dom/server");

    const html = renderToStaticMarkup(
      (await Page({ searchParams: Promise.resolve({ role: "Initiator" }) })) as ReactElement,
    );

    expect(html.match(/data-cell=/g) ?? []).toHaveLength(3);
    expect(html).toContain("3 of 5 cells shown");
    // A narrowed view is a link back out of the view.
    expect(html).toContain("Clear filters");
  });

  it("lists the conflicts panel from the rows, not from a sentence", async () => {
    gate.role = "admin";
    source.cells = CELLS;
    const html = await render();

    expect(html).toContain("Conflicts &amp; decisions");
    // Two tables: the matrix, then the conflicts list built from the one row with `upstream:
    // conflict` — the panel is derived, never a typed sentence.
    expect(html.match(/<table/g) ?? []).toHaveLength(2);
    expect(html).not.toContain("No cell in the matrix records an upstream conflict.");
  });

  it("says so when the matrix has no conflict, rather than drawing an empty table", async () => {
    gate.role = "admin";
    source.cells = CELLS.map((cell) =>
      cell.upstream === "conflict" ? { ...cell, upstream: "exists" as const } : cell,
    );
    const html = await render();

    expect(html).toContain("No cell in the matrix records an upstream conflict.");
    // Only the matrix's own table: the conflicts panel says so in a sentence instead of drawing
    // a header row with nothing under it.
    expect(html.match(/<table/g) ?? []).toHaveLength(1);
  });
});
