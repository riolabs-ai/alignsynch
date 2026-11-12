/**
 * `/admin/brand` (#906) — the gate, the redirect, and the eleven headings.
 *
 * Three claims, and the third is the one the page exists for:
 *
 *   1. **The three gates run in the documented order.** The capability is `requireAdminProduct()`
 *      first, then `requireAlignmentProduct()`, then `requireAdmin()` through the **real** policy —
 *      a member is refused with Next's own `notFound()` (never a redirect, never a 403), and a
 *      signed-out visitor is sent to `/login?next=/admin/brand`. `requireAdmin` is a spy, so "the
 *      capability closed before a session was read" is a claim about a call that never happened.
 *   2. **The words are the canon's.** The eleven headings are extracted from the *rendered page* and
 *      diffed against the eleven extracted from
 *      `docs/specs/spec-design-page-rel-templates-v2/brand-profile/brand-and-audience-profile.html`
 *      — same text, same order. `admin-brand/README.md` §2 calls this the check that keeps the page
 *      honest, and a paraphrase is the defect the page exists to prevent.
 *   3. **The page is read-only and unindexable.** No form, no input, no server action in the
 *      component's import graph, and the served metadata carries all three robots values — the
 *      `noarchive` included, which `/admin/health` deliberately omits.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const MOCKUP = `${ROOT}docs/specs/spec-design-page-rel-templates-v2/brand-profile/brand-and-audience-profile.html`;

/** What the mocked role gate answers with — the *policy* underneath it stays real. */
const gate = vi.hoisted(() => ({
  role: "admin" as "support" | "admin" | "owner" | "member" | "signed-out",
}));

/** The two capability switches, flipped by the capability cases and reset by every other. */
const capability = vi.hoisted(() => ({ adminProduct: true, alignment: true }));

/** A spy, so "the capability gate closed before anything was read" is a claim about a call. */
const requireAdminSpy = vi.hoisted(() => vi.fn());

/**
 * The two capability gates, as switches. The real ones read `data/flags.ts`; what this file needs is
 * the *order* (a closed capability must refuse before the role gate is reached) and the quiz build's
 * answer — `requireAlignmentProduct()` is what a quiz-only template trips.
 */
vi.mock("@/lib/brand-boundary", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/brand-boundary")>();
  const { notFound } = await import("next/navigation");
  return {
    ...real,
    requireAdminProduct: () => {
      if (!capability.adminProduct) notFound();
    },
    requireAlignmentProduct: () => {
      if (!capability.alignment) notFound();
    },
  };
});

/** The session and profile reads, stubbed so a node worker needs no Neon SDK. */
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

/** Every `<h1|h2|h3>` in a document, in order, with its text. */
function headings(html: string): string[] {
  const found: string[] = [];
  const pattern = /<h([123])\b[^>]*>([\s\S]*?)<\/h\1>/g;
  for (let match = pattern.exec(html); match !== null; match = pattern.exec(html)) {
    found.push(
      match[2]
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    );
  }
  return found;
}

/** The digest Next's `notFound()` throws, read the way the other console page tests read it. */
async function digestOf(call: () => Promise<unknown>): Promise<string | undefined> {
  try {
    await call();
    return undefined;
  } catch (error) {
    return (error as { digest?: string }).digest;
  }
}

describe("/admin/brand — the gate", () => {
  it("answers a member with the 404 an unknown URL gets", async () => {
    gate.role = "member";
    capability.adminProduct = true;
    capability.alignment = true;
    const { default: Page } = await import("@/app/(mainlayout)/admin/brand/page");

    expect(await digestOf(() => Page())).toBe("NEXT_HTTP_ERROR_FALLBACK;404");
  });

  it("sends a signed-out visitor to /login with the page as the destination", async () => {
    gate.role = "signed-out";
    const { default: Page } = await import("@/app/(mainlayout)/admin/brand/page");

    let destination = "";
    try {
      await Page();
    } catch (error) {
      const thrown = error as { digest?: string };
      // Next's redirect throws a digest carrying the destination; the path is what matters.
      destination = String(thrown.digest ?? "");
    }
    expect(destination).toContain("/login?next=%2Fadmin%2Fbrand");
  });

  it("refuses a template that does not claim the console before any session is read", async () => {
    capability.adminProduct = false;
    gate.role = "admin";
    requireAdminSpy.mockClear();
    const { default: Page } = await import("@/app/(mainlayout)/admin/brand/page");

    expect(await digestOf(() => Page())).toBe("NEXT_HTTP_ERROR_FALLBACK;404");
    expect(requireAdminSpy).not.toHaveBeenCalled();
    capability.adminProduct = true;
  });

  it("answers the QuizHub build with a 404 — the alignment product gate", async () => {
    capability.alignment = false;
    gate.role = "admin";
    requireAdminSpy.mockClear();
    const { default: Page } = await import("@/app/(mainlayout)/admin/brand/page");

    expect(await digestOf(() => Page())).toBe("NEXT_HTTP_ERROR_FALLBACK;404");
    expect(requireAdminSpy).not.toHaveBeenCalled();
    capability.alignment = true;
  });

  it("lets an admin through, and asks for the page as the next destination", async () => {
    gate.role = "admin";
    requireAdminSpy.mockClear();
    const { default: Page } = await import("@/app/(mainlayout)/admin/brand/page");

    await expect(Page()).resolves.toBeTruthy();
    expect(requireAdminSpy).toHaveBeenCalledWith({ next: "/admin/brand" });
  });
});

describe("/admin/brand — the eleven headings, against the mockup", () => {
  it("renders the canon's eleven headings, in the canon's order, word for word", async () => {
    gate.role = "admin";
    const { default: Page } = await import("@/app/(mainlayout)/admin/brand/page");
    const { renderToStaticMarkup } = await import("react-dom/server");

    const html = renderToStaticMarkup((await Page()) as ReactElement);
    const mockup = readFileSync(MOCKUP, "utf8");

    const rendered = headings(html);
    const source = headings(mockup);

    expect(source).toHaveLength(11);
    expect(rendered).toEqual(source);
  });

  it("carries the five band anchors the hero's second action and the canon's nav point at", async () => {
    gate.role = "admin";
    const { default: Page } = await import("@/app/(mainlayout)/admin/brand/page");
    const { renderToStaticMarkup } = await import("react-dom/server");

    const html = renderToStaticMarkup((await Page()) as ReactElement);
    for (const anchor of ["positioning", "audiences", "workflow", "profile-copy", "closing"]) {
      expect(html, `missing #${anchor}`).toContain(`id="${anchor}"`);
    }
    // The secondary hero action is an in-page jump; its target is the band above.
    expect(html).toContain('href="#audiences"');
  });

  it("is read-only and unindexable", async () => {
    gate.role = "admin";
    const page = await import("@/app/(mainlayout)/admin/brand/page");
    const component = readFileSync(`${ROOT}components/admin/brand-profile.tsx`, "utf8");
    const source = readFileSync(`${ROOT}app/(mainlayout)/admin/brand/page.tsx`, "utf8");

    // Robots: all three values, `noarchive` included — the one `/admin/health` omits.
    const metadata = page.metadata as {
      robots?: { index?: boolean; follow?: boolean; noarchive?: boolean };
    };
    expect(metadata.robots).toEqual({ index: false, follow: false, noarchive: true });

    // No write path, no form, no clock: the one interaction is a link.
    for (const banned of ["<form", "<input", "<button", "use server", "action="]) {
      expect(component, `brand-profile.tsx must not carry ${banned}`).not.toContain(banned);
    }
    // The copy budget is 0, so the page module holds no rendered sentence either.
    expect(source).not.toMatch(/<h[123]/);
  });
});
