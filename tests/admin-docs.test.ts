/**
 * `/admin/docs` — the manifest, the link rewrite, the two gates and the asset route (#892).
 *
 * Four claims, and each one is a different kind of fact:
 *
 *   1. **The manifest is the tree's, not a second copy.** `docs/docs.json` is parsed, flattened and
 *      indexed by the real modules, and the reader's own numbers (117 documents, 9 sections) are
 *      asserted against the file on disk — so `docs/` growing a page is a test that still passes, and
 *      a manifest that stopped agreeing with the tree is the one that fails (`pnpm docs:check` is the
 *      gate's version of the same question).
 *   2. **A link written for a checkout becomes an address this reader serves.** `GATE.md`,
 *      `../GATE.md`, `![](images/x.png)`, `#anchor` and `https://…` are five different answers, and
 *      `../../etc/passwd` is a refusal — the rewrite is pure, so it is driven here with no tree.
 *   3. **Both gates run in the documented order, and a refusal is the 404 an unknown URL gets.** The
 *      capability is `requireAdminProduct()` first (a template that does not claim `product.admin`
 *      answers 404 with no session read behind it), then `requireAdmin()` through the *real* policy —
 *      a member is refused with Next's own `notFound()`, never a redirect and never a 403.
 *   4. **The asset route cannot be walked out of `docs/`,** and it serves only images.
 *
 * The render cases assert what a reader actually gets: the hub's rows, one document's body with its
 * links rewritten, and `notFound()` for a slug the manifest does not carry.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { resolveDocsTarget } from "@/lib/docs/links";
import { DocsManifestUnreadable, parseDocsManifest } from "@/lib/docs/manifest";
import {
  docContext,
  docHref,
  docPathOfSegments,
  docsRows,
  findDoc,
  searchDocs,
  sectionMetas,
} from "@/lib/docs/rows";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** What the mocked role gate answers with — the *policy* underneath it stays real. */
const gate = vi.hoisted(() => ({ role: "admin" as "support" | "admin" | "owner" | "member" }));

/** Whether the template claims the console. Flipped by the capability case, reset by every other. */
const capability = vi.hoisted(() => ({ adminProduct: true }));

/** A spy, so "the capability gate closed before anything was read" is a claim about a call. */
const requireAdminSpy = vi.hoisted(() => vi.fn());

/**
 * The console's capability gate (#509), replaced with a switch.
 *
 * The real one reads `data/flags.ts` for `product.admin`; what this file needs is the *order*, and the
 * order is only visible when the first gate can refuse while the second is spied on.
 */
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

/** The auth module the policy needs, stubbed: a node worker cannot resolve `next/headers`. */
vi.mock("@/lib/auth/session", () => ({
  currentUser: async () => null,
}));

vi.mock("@/lib/db/user-profiles", () => ({
  readUserProfileByUserId: async () => null,
  readUserProfileByHandle: async () => null,
}));

/** The role gate, still answered by the real policy — `roleAnswerFor` decides what `gate.role` means. */
vi.mock("@/lib/auth/require-role", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/auth/require-role")>();
  const { notFound } = await import("next/navigation");
  return {
    ...real,
    requireAdmin: async (options: { next?: string } = {}) => {
      requireAdminSpy(options);
      const answer = real.roleAnswerFor({ needed: "admin", signedIn: true, role: gate.role });
      if (answer.kind === "redirect") throw new Error(`an unexpected redirect to ${answer.to}`);
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

/** Comments out, code left: these docstrings name `new Date(` and `node:fs` without importing them. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function sourceOf(relative: string): string {
  return code(readFileSync(`${ROOT}${relative}`, "utf8"));
}

/** The manifest as the tree actually holds it — the fixture every case below works over. */
function realManifest() {
  return parseDocsManifest(JSON.parse(readFileSync(`${ROOT}docs/docs.json`, "utf8")));
}

describe("/admin/docs — the manifest is the tree's", () => {
  it("parses docs/docs.json into sections and rows, and the flat count is the sections' sum", () => {
    const manifest = realManifest();
    const rows = docsRows(manifest);
    // Derived, never a literal: `docs/` grows a page whenever somebody lands one (117 at #892, 119
    // once #890's two workflow pages landed), and `pnpm docs:check` is the gate on the exact count.
    // What this asserts is the shape — every section is headed, every row resolves, and the flat
    // list is exactly the sections' rows.
    expect(manifest.sections.length).toBeGreaterThan(1);
    expect(rows.length).toBeGreaterThan(100);
    expect(rows.length).toBe(
      manifest.sections.reduce((sum, section) => sum + section.docs.length, 0),
    );
    expect(sectionMetas(manifest).reduce((sum, section) => sum + section.count, 0)).toBe(
      rows.length,
    );
    expect(manifest.sections.every((section) => section.title.length > 0)).toBe(true);
    expect(rows.every((row) => row.href.startsWith("/admin/docs/"))).toBe(true);
  });

  it("derives every address from the row's own path", () => {
    const row = findDoc(realManifest(), ["operations", "gate.md"]);
    expect(row?.href).toBe(docHref("operations/gate.md"));
    expect(row?.href).toBe("/admin/docs/operations/gate.md");
    // A nested document keeps its segments: the catch-all route is why this works.
    const nested = findDoc(realManifest(), ["wiki", "modules", "app-api.md"]);
    expect(nested?.href).toBe("/admin/docs/wiki/modules/app-api.md");
    expect(nested?.sectionId).toBeTruthy();
  });

  it("answers null for an address the manifest does not carry, and for one that cannot be a path", () => {
    const manifest = realManifest();
    expect(findDoc(manifest, ["does-not-exist.md"])).toBeNull();
    // `notFound()` at the page, not a quiet fallback: a link must stay the page it named.
    expect(findDoc(manifest, ["..", "..", "package.json"])).toBeNull();
    expect(docPathOfSegments([])).toBeNull();
    expect(docPathOfSegments(["a", "", "b.md"])).toBeNull();
  });

  it("names the shape it broke rather than returning a plausible empty list", () => {
    expect(() => parseDocsManifest({ hub: "README.md", sections: [] })).toThrow(
      DocsManifestUnreadable,
    );
    expect(() => parseDocsManifest({ hub: "/abs.md", sections: [] })).toThrow(
      DocsManifestUnreadable,
    );
    try {
      parseDocsManifest({
        hub: "README.md",
        sections: [{ id: "x", title: "X", blurb: "b", docs: [{ path: "a.md" }] }],
      });
      expect.unreachable("a row with no title/question must not parse");
    } catch (error) {
      expect(error).toBeInstanceOf(DocsManifestUnreadable);
      expect((error as InstanceType<typeof DocsManifestUnreadable>).reason).toContain(
        "sections.0.docs.0",
      );
    }
  });

  it("orders prev/next by the manifest, and keeps a section's siblings together", () => {
    const manifest = realManifest();
    const rows = docsRows(manifest);
    const second = rows[1];
    const context = docContext(manifest, second);
    expect(context.previous?.path).toBe(rows[0]?.path);
    expect(context.next?.path).toBe(rows[2]?.path);
    expect(context.siblings.every((row) => row.sectionId === second.sectionId)).toBe(true);
  });

  it("filters on title and question only, case-insensitively, and returns every row for an empty query", () => {
    const rows = docsRows(realManifest());
    expect(searchDocs(rows, "")).toHaveLength(rows.length);
    expect(searchDocs(rows, "   ")).toHaveLength(rows.length);

    const gateRow = rows.find((row) => row.path === "operations/gate.md");
    expect(gateRow).toBeDefined();
    const byTitle = searchDocs(rows, gateRow?.title.toUpperCase() ?? "");
    expect(byTitle.map((row) => row.path)).toContain("operations/gate.md");

    const byQuestion = searchDocs(rows, "verify.sh");
    expect(byQuestion.length).toBeGreaterThan(0);
    expect(
      byQuestion.every(
        (row) =>
          row.question.toLowerCase().includes("verify.sh") ||
          row.title.toLowerCase().includes("verify.sh"),
      ),
    ).toBe(true);
    expect(searchDocs(rows, "zzzz-no-such-page")).toHaveLength(0);
  });
});

describe("/admin/docs — what a link inside a document becomes", () => {
  it("rewrites a sibling document to its address, keeping the fragment", () => {
    expect(resolveDocsTarget("operations/gate.md", "../reference/env-spec.md")).toEqual({
      kind: "doc",
      href: "/admin/docs/reference/env-spec.md",
    });
    expect(resolveDocsTarget("wiki/modules/app.md", "../../operations/gate.md#step-4")).toEqual({
      kind: "doc",
      href: "/admin/docs/operations/gate.md#step-4",
    });
    expect(resolveDocsTarget("wiki/modules/app.md", "./content.md")).toEqual({
      kind: "doc",
      href: "/admin/docs/wiki/modules/content.md",
    });
  });

  it("serves an image through the asset route, and drops the fragment it cannot mean", () => {
    expect(resolveDocsTarget("qa/stage5/README.md", "stage5-entitled-390.png")).toEqual({
      kind: "asset",
      href: "/api/docs/asset/qa/stage5/stage5-entitled-390.png",
    });
  });

  it("leaves external addresses and in-page anchors alone", () => {
    expect(resolveDocsTarget("operations/gate.md", "https://example.com/x")).toEqual({
      kind: "external",
      href: "https://example.com/x",
    });
    expect(resolveDocsTarget("operations/gate.md", "//example.com/x")).toEqual({
      kind: "external",
      href: "//example.com/x",
    });
    expect(resolveDocsTarget("operations/gate.md", "#the-gate")).toEqual({
      kind: "anchor",
      href: "#the-gate",
    });
    expect(resolveDocsTarget("operations/gate.md", "/dashboard")).toEqual({
      kind: "route",
      href: "/dashboard",
    });
  });

  it("refuses a path that leaves docs/, and a file this reader cannot serve", () => {
    expect(resolveDocsTarget("operations/gate.md", "../../../etc/passwd")).toEqual({
      kind: "unresolved",
    });
    expect(resolveDocsTarget("wiki/modules/app.md", "../../../../package.json")).toEqual({
      kind: "unresolved",
    });
    // A script, not a page: the label renders as plain text instead of an anchor that 404s.
    expect(resolveDocsTarget("operations/gate.md", "../scripts/verify.sh")).toEqual({
      kind: "unresolved",
    });
    expect(resolveDocsTarget("operations/gate.md", "")).toEqual({ kind: "unresolved" });
  });
});

describe("/admin/docs — the gates, in order", () => {
  it("closes on the capability before it reads a session, and answers the 404 an unknown URL gets", async () => {
    capability.adminProduct = false;
    requireAdminSpy.mockClear();
    const { default: AdminDocsPage } = await import("@/app/(mainlayout)/admin/docs/page");

    let digest: string | undefined;
    try {
      await AdminDocsPage();
    } catch (error) {
      digest = (error as { digest?: string }).digest;
    }

    expect(digest).toBe("NEXT_HTTP_ERROR_FALLBACK;404");
    // The role gate — and therefore the session and the profile row — was never reached.
    expect(requireAdminSpy).not.toHaveBeenCalled();
    capability.adminProduct = true;
  });

  it("answers a member with the same 404, on both the hub and a document", async () => {
    gate.role = "member";
    const { default: AdminDocsPage } = await import("@/app/(mainlayout)/admin/docs/page");
    const { default: AdminDocPage } = await import("@/app/(mainlayout)/admin/docs/[...slug]/page");

    const digestOf = async (run: () => Promise<unknown>): Promise<string | undefined> => {
      try {
        await run();
      } catch (error) {
        return (error as { digest?: string }).digest;
      }
      return undefined;
    };

    expect(await digestOf(async () => AdminDocsPage())).toBe("NEXT_HTTP_ERROR_FALLBACK;404");
    expect(
      await digestOf(async () =>
        AdminDocPage({ params: Promise.resolve({ slug: ["operations", "gate.md"] }) }),
      ),
    ).toBe("NEXT_HTTP_ERROR_FALLBACK;404");
    gate.role = "admin";
  });
});

describe("/admin/docs — what the pages render", () => {
  it("renders every row of the hub, with the count the manifest carries", async () => {
    gate.role = "admin";
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { default: AdminDocsPage } = await import("@/app/(mainlayout)/admin/docs/page");

    const html = renderToStaticMarkup((await AdminDocsPage()) as ReactElement);

    // Every document's address is on the page: the hub is the manifest, not a sample of it.
    const rows = docsRows(realManifest());
    for (const row of rows) {
      expect(html, `${row.path} is missing from the hub`).toContain(`href="${row.href}"`);
    }
    // The header's count is the manifest's own — derived, never a literal the tree can outgrow.
    expect(html).toContain(`${rows.length} documents`);
  });

  it("renders one document's body with its links and images rewritten", async () => {
    gate.role = "admin";
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { default: AdminDocPage } = await import("@/app/(mainlayout)/admin/docs/[...slug]/page");

    const page = (await AdminDocPage({
      params: Promise.resolve({ slug: ["operations", "gate.md"] }),
    })) as ReactElement;
    const html = renderToStaticMarkup(page);

    const title = findDoc(realManifest(), ["operations", "gate.md"])?.title ?? "";
    expect(html).toContain(title);
    // A relative link inside the document is now an address this reader serves.
    expect(html).toMatch(/href="\/admin\/docs\/[A-Za-z0-9._/-]+\.md/);
    // And nothing points back at `public/`, where the docs images are not.
    expect(html).not.toContain('src="images/');
  });

  it("renders a nested document, which is why the route is a catch-all", async () => {
    gate.role = "admin";
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { default: AdminDocPage } = await import("@/app/(mainlayout)/admin/docs/[...slug]/page");

    const html = renderToStaticMarkup(
      (await AdminDocPage({
        params: Promise.resolve({ slug: ["wiki", "modules", "app-api.md"] }),
      })) as ReactElement,
    );
    expect(html).toContain(findDoc(realManifest(), ["wiki", "modules", "app-api.md"])?.title ?? "");
  });

  it("answers notFound() for a slug the manifest does not carry", async () => {
    gate.role = "admin";
    const { default: AdminDocPage } = await import("@/app/(mainlayout)/admin/docs/[...slug]/page");

    for (const slug of [
      ["does-not-exist.md"],
      ["..", "..", "package.json"],
      ["operations", "gate.md", "extra"],
    ]) {
      let digest: string | undefined;
      try {
        await AdminDocPage({ params: Promise.resolve({ slug }) });
      } catch (error) {
        digest = (error as { digest?: string }).digest;
      }
      expect(digest, `${slug.join("/")} must 404`).toBe("NEXT_HTTP_ERROR_FALLBACK;404");
    }
  });
});

describe("/admin/docs — the asset route", () => {
  it("serves a real image with its content type", async () => {
    gate.role = "admin";
    const { GET } = await import("@/app/api/docs/asset/[...path]/route");
    const response = await GET(new Request("http://localhost/api/docs/asset"), {
      params: Promise.resolve({ path: ["qa", "stage5", "stage5-entitled-390.png"] }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toContain("private");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });

  it("answers 404 for a traversal, a non-image and a refused session", async () => {
    gate.role = "admin";
    const { GET } = await import("@/app/api/docs/asset/[...path]/route");
    const ask = (path: string[]) =>
      GET(new Request("http://localhost/api/docs/asset"), { params: Promise.resolve({ path }) });

    expect((await ask(["..", "..", "package.json"])).status).toBe(404);
    expect((await ask(["docs.json"])).status).toBe(404);
    expect((await ask(["nope", "missing.png"])).status).toBe(404);

    // A member's `<img>` gets the 404 the page would give, not a redirect into a login page.
    gate.role = "member";
    expect((await ask(["qa", "stage5", "stage5-entitled-390.png"])).status).toBe(404);
    gate.role = "admin";
  });
});

describe("/admin/docs — the sources say what the docstrings claim", () => {
  const pages = [
    "app/(mainlayout)/admin/docs/page.tsx",
    "app/(mainlayout)/admin/docs/[...slug]/page.tsx",
  ] as const;

  it("gates the capability before the role, on both pages and on the asset route", () => {
    for (const file of [...pages, "app/api/docs/asset/[...path]/route.ts"]) {
      const source = sourceOf(file);
      const capabilityAt = source.indexOf("requireAdminProduct()");
      const roleAt = source.indexOf("requireAdmin(");
      expect(capabilityAt, `${file} must call requireAdminProduct()`).toBeGreaterThan(-1);
      expect(roleAt, `${file} must call requireAdmin()`).toBeGreaterThan(-1);
      expect(capabilityAt, `${file} must gate the capability first`).toBeLessThan(roleAt);
    }
  });

  it("never reads a clock, and never prerenders", () => {
    for (const file of pages) {
      const source = sourceOf(file);
      expect(source, `${file} must be request-time`).toContain('dynamic = "force-dynamic"');
      expect(source, `${file} must not read a clock`).not.toContain("new Date(");
      expect(source, `${file} must not prerender the tree`).not.toContain("generateStaticParams");
    }
  });

  it("keeps fs out of the client graph: only the server modules import node:fs", () => {
    expect(sourceOf("lib/docs/tree.ts")).toContain("node:fs");
    for (const file of [
      "components/admin/docs/docs-hub.tsx",
      "components/admin/docs/doc-article.tsx",
      "lib/docs/manifest.ts",
      "lib/docs/rows.ts",
      "lib/docs/links.ts",
    ]) {
      expect(sourceOf(file), `${file} must not reach node:fs`).not.toContain("node:fs");
      expect(sourceOf(file), `${file} must not import the tree`).not.toContain('"@/lib/docs/tree"');
    }
    // The one client module in the feature: the hub's filter. The article is a server component.
    expect(sourceOf("components/admin/docs/docs-hub.tsx")).toContain('"use client"');
    expect(sourceOf("components/admin/docs/doc-article.tsx")).not.toContain('"use client"');
  });
});
