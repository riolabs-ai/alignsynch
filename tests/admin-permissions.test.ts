/**
 * `/admin/permissions` (#1126) — the gates, the honest failure state, and the parse behind them.
 *
 * Five claims, and each one is the thing the issue's acceptance line asks for:
 *
 *   1. **The gates run in `/admin/docs` order.** `requireAdminProduct()` is the capability, and it
 *      closes before a session is read; then `requireAdmin({ next: "/admin/permissions" })` through
 *      the **real** policy — a member is refused with Next's own `notFound()` (never a redirect,
 *      never a 403), and a signed-out visitor is sent to `/login?next=/admin/permissions`.
 *   2. **A source that is absent is a panel, not an empty table.** With the reader stubbed to
 *      "there is no file", the rendered page names `docs/specs/v2-prototype/crud-matrix.md`, says
 *      an owner supplies it, and draws no `<table>` at all. The eleven P0 gaps and the six role ×
 *      action rules still render: they are #1126's own text, not the source's rows.
 *   3. **The committed source renders every row it carries.** With the **real** reader — #1158
 *      committed the matrix at that path — the page draws 169 `data-cell` rows, the source's own
 *      eight columns, and a counts band whose figures are `countsOf()`'s over that file.
 *   4. **A stub that parses becomes rows and honest figures.** Every header figure comes from
 *      `countsOf()` over the cells, so "counts match the source file" is a property of the code,
 *      not of a copied number.
 *   5. **Read-only, and the filter is the address.** The served markup carries no form, no input
 *      and no button; each filter is a `Link` whose href round-trips through `parseCrudFilter`, and
 *      the facets combine.
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

/** The columns a stubbed source's header names, unless a case narrows it (see the chip block). */
const STUB_COLUMNS = [
  "object",
  "action",
  "role",
  "prototype",
  "selector",
  "upstream",
  "mvp",
  "rationale",
  "priority",
] as const;

/** The eight the committed file names — no `priority`, so `mvp` carries the rank. */
const EIGHT_COLUMNS = STUB_COLUMNS.filter((column) => column !== "priority");

/**
 * The matrix the page reads. `null` is "no source file" — the failure panel; a list is a source
 * that parsed; `undefined` hands the page the **real** reader and the committed file.
 */
const source = vi.hoisted(() => ({
  cells: null as
    | null
    | undefined
    | {
        object: string;
        action: string;
        role: string;
        prototype: "covered" | "hinted" | "missing" | "n/a";
        selector: string;
        upstream: "exists" | "not-found" | "conflict" | "n/a";
        mvp: string;
        rationale: string;
        priority: "P0" | "P1" | "P2" | "Won't" | "none";
      }[],
  /** The triage pass the stubbed source states about itself — `null` is a source that says none. */
  pass: 10 as number | null,
}));

/** How the stub's header reads — `null` keeps the nine columns, a case may narrow it to eight. */
const header = vi.hoisted(() => ({ columns: null as readonly string[] | null }));

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

/** The reader, switched by `source.cells`: absent, a stubbed matrix, or the real committed file. */
vi.mock("@/lib/admin/crud-matrix-file", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/admin/crud-matrix-file")>();
  const matrix = await import("@/lib/admin/crud-matrix");
  return {
    ...real,
    readCrudMatrix: (path?: string) => {
      if (source.cells === undefined) return real.readCrudMatrix(path);
      if (source.cells === null) {
        throw new matrix.CrudMatrixUnreadable(
          `${matrix.CRUD_MATRIX_PATH} is not present in this tree, so there is no matrix to read`,
        );
      }
      return {
        cells: source.cells,
        columns: [...(header.columns ?? STUB_COLUMNS)],
        snapshotPass: source.pass,
      };
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

describe("/admin/permissions — a source that is absent", () => {
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

    expect(html).toContain("Rules Every #1119 Child Must Honour");
    expect(html).toContain(
      "The Counterparty never sees a price, the word trial, a card or an extension.",
    );
    expect(html).toContain("P0 Gaps");
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
    expect(html).toContain("5 Rows");
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
    expect(html).toContain("Showing 3 of 5 Rows");
    // A narrowed view is a link back out of the view.
    expect(html).toContain("Clear Filters");
  });

  it("lists the conflicts panel from the rows, not from a sentence", async () => {
    gate.role = "admin";
    source.cells = CELLS;
    const html = await render();

    expect(html).toContain("Conflicts and Decisions");
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

describe("/admin/permissions — the committed source (#1158)", () => {
  /** The file's own numbers, read here through the real reader rather than typed into a fixture. */
  async function fromFile() {
    const real = await vi.importActual<typeof import("@/lib/admin/crud-matrix-file")>(
      "@/lib/admin/crud-matrix-file",
    );
    return real.readCrudMatrix();
  }

  it("draws every one of the file's rows, with the source's own eight columns", async () => {
    gate.role = "admin";
    capability.adminProduct = true;
    source.cells = undefined;

    const document = await fromFile();
    const html = await render();

    // Every cell the file carries is on the page — the acceptance line, as a count.
    expect(html.match(/data-cell=/g) ?? []).toHaveLength(document.cells.length);
    expect(document.cells.length).toBe(169);
    expect(html).toContain("169 cells");
    expect(html).toContain("169 Rows");
    // The counts band is the file's, not a sentence: the applicable figure is derived too.
    expect(html).toContain(
      `${document.cells.filter((cell) => cell.prototype !== "n/a").length} applicable`,
    );
    // Eight columns, the ones the header names — no invented ninth, and no failure panel.
    const matrixTable = html.slice(html.indexOf("<table"), html.indexOf("</table>"));
    expect(matrixTable.match(/<th /g) ?? []).toHaveLength(document.columns.length);
    expect(document.columns).toHaveLength(8);
    expect(matrixTable).toContain(">Rationale<");
    expect(matrixTable).not.toContain(">Priority<");
    expect(html).not.toContain("data-matrix-unreadable");

    source.cells = null;
  });

  it("narrows the committed matrix through the address, and says how much it shows", async () => {
    gate.role = "admin";
    source.cells = undefined;

    const document = await fromFile();
    const expected = document.cells.filter((cell) => cell.role === "Visitor").length;
    const { default: Page } = await import("@/app/(mainlayout)/admin/permissions/page");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const html = renderToStaticMarkup(
      (await Page({ searchParams: Promise.resolve({ role: "Visitor" }) })) as ReactElement,
    );

    expect(expected).toBeGreaterThan(0);
    expect(expected).toBeLessThan(document.cells.length);
    expect(html.match(/data-cell=/g) ?? []).toHaveLength(expected);
    expect(html).toContain(`Showing ${expected} of 169 Rows`);

    source.cells = null;
  });

  it("prints the artifact's snapshot line, and its Status and Priority facets (#rectification 12)", async () => {
    gate.role = "admin";
    source.cells = undefined;

    const document = await fromFile();
    const html = await render();

    // Delta 1: the summary line under the band — the triage pass the source states about itself,
    // the rank split, then the P0s the prototype still does not draw. Every figure is derived.
    expect(html).toContain("Pass 10 snapshot · 34 P0 · 23 P1 · 29 P2 · 15 Won&#x27;t · ");
    expect(html).toContain("2 P0 still open (hinted or missing).");
    expect(html).toContain("Counts are computed from the source file, not hardcoded.");
    // Delta 1, second half: the count line in the artifact's words — a whole matrix prints its size
    // bare, a narrowed one says what it shows.
    expect(html).toContain(`${document.cells.length} Rows`);

    // Delta 3: the five facets the artifact draws, Status among them — the prototype column's
    // question asked as a filter, beside Object, Role, Upstream and Priority.
    for (const facet of ["Object", "Role", "Status", "Upstream", "Priority"]) {
      expect(html, `${facet} is a filter heading`).toContain(`>${facet}</p>`);
    }

    // Delta 2: the six rules, under the artifact's own heading, in its own sentences.
    expect(html).toContain("Rules Every #1119 Child Must Honour");
    expect(html).toContain(
      "Archive over delete: templates archive or restore; permanent delete only when unused and unpublished; relationships close or are abandoned, never deleted.",
    );
    expect(html).toContain(
      "No silent edits. The Initiator or staff rewrite-with-confirm in lib/relationship/edit.ts is the conflict to replace, not to port.",
    );

    source.cells = null;
  });
});

/**
 * #1232 — the matrix reads as icon-plus-word status.
 *
 * Five claims, and each one is a thing the artifact draws:
 *
 *   1. **A status is a chip, not a bare word.** Every prototype and upstream cell, and every
 *      rank cell, is drawn by the shared `Badge` with the word the fixture carries inside it —
 *      so the vocabulary still has one home and a status edit is a fixture edit.
 *   2. **The tone is the design tokens, never a palette step and never red.** `synch` for
 *      covered, `small-gap` for hinted, `gap` for missing and for upstream's conflict, the
 *      neutral trio for a fact; the rank is action / action-tint / secondary.
 *   3. **The mark is only where the artifact draws one.** Covered, hinted, missing and conflict
 *      carry an icon; N/A, exists, not-found and the unscheduled rank do not, because a mark on
 *      "no gap" would say the opposite of the word.
 *   4. **The rank is read from the column the parser chose.** `priority` when the source names
 *      one, `mvp` when it does not — so a source whose `mvp` carries something else never prints
 *      a rank it did not store there.
 *   5. **The labels the brief names are Title Case**, and the table still scrolls inside its own
 *      container rather than pushing the page wide at 390 px.
 */
describe("/admin/permissions — icon-plus-word status (#1232)", () => {
  /** One cell per prototype status, per upstream status and per rank. */
  const CELLS = [
    {
      object: "Template",
      action: "Create",
      role: "Initiator",
      prototype: "covered" as const,
      selector: "data-template-create",
      upstream: "exists" as const,
      mvp: "P0",
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
      mvp: "P1",
      rationale: "No archive control draws today.",
      priority: "P1" as const,
    },
    {
      object: "Relationship",
      action: "Leave",
      role: "Counterparty",
      prototype: "missing" as const,
      selector: "data-close-relationship",
      upstream: "conflict" as const,
      mvp: "P2",
      rationale: "Upstream deletes; the spec closes.",
      priority: "P2" as const,
    },
    {
      object: "Template",
      action: "Restore",
      role: "Admin-curator",
      prototype: "n/a" as const,
      selector: "",
      upstream: "n/a" as const,
      mvp: "—",
      rationale: "Not a role action on this screen.",
      priority: "none" as const,
    },
    {
      object: "Relationship",
      action: "Propose a change",
      role: "Initiator",
      prototype: "covered" as const,
      selector: "",
      upstream: "exists" as const,
      mvp: "Won't",
      rationale: "The silent write this replaces.",
      priority: "Won't" as const,
    },
  ];

  /** One chip's opening tag and its contents, found by the marker the component stamps on it. */
  function chip(html: string, marker: string): string {
    const at = html.indexOf(`data-status-chip="${marker}"`);
    if (at < 0) return "";
    return html.slice(html.lastIndexOf("<", at), html.indexOf("</div>", at) + "</div>".length);
  }

  it("draws every status column as a chip, carrying the fixture's word", async () => {
    gate.role = "admin";
    capability.adminProduct = true;
    header.columns = null;
    source.cells = CELLS;
    const html = await render();

    // Five rows × the three chip columns (prototype, upstream, and the rank the header names).
    expect(html.match(/data-status-chip=/g) ?? []).toHaveLength(15);
    for (const [marker, word] of [
      ["prototype-covered", "Covered"],
      ["prototype-hinted", "Hinted"],
      ["prototype-missing", "Missing"],
      ["prototype-n/a", "N/A"],
      ["upstream-exists", "Exists"],
      ["upstream-not-found", "Not Found"],
      ["upstream-conflict", "Conflict"],
      ["priority-P0", "P0"],
      ["priority-Won&#x27;t", "Won&#x27;t"],
    ] as const) {
      expect(chip(html, marker), `${marker} is drawn`).not.toBe("");
      expect(chip(html, marker), `${marker} prints ${word}`).toContain(`>${word}<`);
    }
    source.cells = null;
  });

  it("tones each chip with the design tokens, and with nothing from the raw palette", async () => {
    gate.role = "admin";
    header.columns = null;
    source.cells = CELLS;
    const html = await render();

    expect(chip(html, "prototype-covered")).toContain("bg-synch-tint");
    expect(chip(html, "prototype-covered")).toContain("text-synch");
    expect(chip(html, "prototype-covered")).toContain("border-synch-mark");
    expect(chip(html, "prototype-hinted")).toContain("bg-small-gap-tint");
    expect(chip(html, "prototype-hinted")).toContain("text-small-gap");
    expect(chip(html, "prototype-missing")).toContain("bg-gap-tint");
    expect(chip(html, "prototype-missing")).toContain("text-gap");
    // A conflict is the same gap tone as a missing cell: one colour language, not a new one.
    expect(chip(html, "upstream-conflict")).toContain("bg-gap-tint");
    // A fact carries no tone at all — its ground is the page's own.
    expect(chip(html, "prototype-n/a")).toContain("bg-background");
    expect(chip(html, "priority-P0")).toContain("bg-action");
    expect(chip(html, "priority-P1")).toContain("bg-action/5");
    expect(chip(html, "priority-P2")).toContain("bg-secondary");
    // The calm palette's floor: no red, and no raw step standing in for a status token.
    expect(html).not.toMatch(/\b(?:amber|slate|green|red|yellow)-(?:\d{2,3})\b/);
    source.cells = null;
  });

  it("draws the mark only where the artifact draws one", async () => {
    gate.role = "admin";
    header.columns = null;
    source.cells = CELLS;
    const html = await render();

    for (const marker of [
      "prototype-covered",
      "prototype-hinted",
      "prototype-missing",
      "upstream-conflict",
    ]) {
      expect(chip(html, marker), `${marker} carries an icon`).toContain("<svg");
    }
    for (const marker of [
      "prototype-n/a",
      "upstream-exists",
      "upstream-not-found",
      "upstream-n/a",
      "priority-P0",
      "priority-none",
    ]) {
      expect(chip(html, marker), `${marker} carries no icon`).not.toContain("<svg");
    }
    source.cells = null;
  });

  it("chips the rank column the parser chose, and leaves the other one as text", async () => {
    gate.role = "admin";
    source.cells = CELLS;

    // Nine columns: the source names `priority`, so that column is the rank and `mvp` is text.
    header.columns = null;
    const nine = await render();
    expect(chip(nine, "priority-P0")).not.toBe("");
    expect(nine).toContain(">P0<");

    // Eight columns: no `priority`, so `mvp` carries the rank and is the column that chips.
    header.columns = EIGHT_COLUMNS;
    const eight = await render();
    expect(eight).toContain(">MVP<");
    expect(chip(eight, "priority-P0")).not.toBe("");
    expect(chip(eight, "priority-P1")).not.toBe("");

    header.columns = null;
    source.cells = null;
  });

  it("says every label the brief names in Title Case", async () => {
    gate.role = "admin";
    header.columns = null;
    source.cells = CELLS;
    // Narrowed, because "Clear Filters" only draws once the address selects something.
    const { default: Page } = await import("@/app/(mainlayout)/admin/permissions/page");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const html = renderToStaticMarkup(
      (await Page({ searchParams: Promise.resolve({ role: "Initiator" }) })) as ReactElement,
    );

    for (const label of [
      "Open the Triage Page",
      "Clear Filters",
      "Not Found",
      "Rules Every #1119 Child Must Honour",
      "P0 Gaps",
      "The Matrix at a Glance",
      "Every Cell",
      "Conflicts and Decisions",
    ]) {
      expect(html, `${label} is on the page`).toContain(label);
    }
    // The words the brief did not name stay as they were — this is a case change, not a rewrite.
    expect(html).not.toContain("Clear filters");
    source.cells = null;
  });

  it("scrolls the table inside its own container, so 390 px does not push the page wide", async () => {
    gate.role = "admin";
    header.columns = null;
    source.cells = CELLS;
    const html = await render();

    // `Table`'s own wrapper: `relative w-full overflow-auto` — the horizontal scroll is the
    // primitive's, so a wider table never widens the page.
    expect(html).toContain("relative w-full overflow-auto");
    source.cells = null;
  });
});
