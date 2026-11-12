/**
 * The admin notice bar (#906) — who gets it, what it draws, and the shell geometry it moves.
 *
 * Three claims, each one a different kind of fact:
 *
 *   1. **The predicate is the spec's three reads, and only the admin survives them.** A member, a
 *      signed-out visitor, the QuizHub build and a template without the console all answer "no";
 *      that four-way table is the whole visibility rule (`banner/README.md` §7) and it is pure, so
 *      it is tested with no session and no database.
 *   2. **"Renders nothing" means nothing.** A member's render is the empty string — not a hidden
 *      box, not a reserved gap. That is the claim `pnpm parity` backs up at the document level.
 *   3. **The rail's offsets move only when the bar is mounted.** `railClassName` is the real
 *      function the shell calls, so pinning its two answers keeps `md:top-0 md:h-screen` in the
 *      signed-out render (a parity hash is HTML, and that class string is part of it).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AdminNoticeBar } from "@/components/layout/admin-notice-bar";
import { railClassName } from "@/components/layout/sidebar";
import { shellPageCopy } from "@/data/pages/shell";
import { sectionOf } from "@/lib/page-copy";
import { adminNoticeVisible } from "@/lib/shell/admin-notice";

describe("adminNoticeVisible — the three reads the spec names", () => {
  it("is true for an admin on the alignment build, with the console shipped", () => {
    expect(adminNoticeVisible({ adminProduct: true, quizProduct: false, role: "admin" })).toBe(
      true,
    );
    expect(adminNoticeVisible({ adminProduct: true, quizProduct: false, role: "owner" })).toBe(
      true,
    );
  });

  it("is false for a member and for a signed-out visitor", () => {
    expect(adminNoticeVisible({ adminProduct: true, quizProduct: false, role: "member" })).toBe(
      false,
    );
    expect(adminNoticeVisible({ adminProduct: true, quizProduct: false, role: "support" })).toBe(
      false,
    );
    expect(adminNoticeVisible({ adminProduct: true, quizProduct: false, role: null })).toBe(false);
  });

  it("is false on the QuizHub build, even for an admin — the page there is a 404", () => {
    expect(adminNoticeVisible({ adminProduct: true, quizProduct: true, role: "admin" })).toBe(
      false,
    );
  });

  it("is false on a template that does not claim the console", () => {
    expect(adminNoticeVisible({ adminProduct: false, quizProduct: false, role: "admin" })).toBe(
      false,
    );
  });
});

describe("AdminNoticeBar — what a reader gets", () => {
  it("draws nothing at all for a member", () => {
    expect(renderToStaticMarkup(<AdminNoticeBar copy={shellPageCopy} viewerRole="member" />)).toBe(
      "",
    );
  });

  it("draws nothing at all for a signed-out visitor", () => {
    expect(renderToStaticMarkup(<AdminNoticeBar copy={shellPageCopy} viewerRole={null} />)).toBe(
      "",
    );
  });

  it("draws one row with one internal link for an admin on this build", () => {
    // The gate case above is the predicate's; this one runs the real flags, which on the
    // `BRAND=alignsynch` build the suite runs under are `product.admin` on and the quiz off.
    // The suite's build may be either brand; the flags decide, so they are pinned here rather than
    // inherited from whatever `BRAND` the process carries.
    vi.stubEnv("FLAG_PRODUCT_ADMIN", "1");
    vi.stubEnv("FLAG_PRODUCT_QUIZ_SURFACES", "0");
    const html = renderToStaticMarkup(<AdminNoticeBar copy={shellPageCopy} viewerRole="admin" />);
    vi.unstubAllEnvs();
    expect(html).not.toBe("");

    expect(html).toContain("data-admin-notice");
    expect(html).toContain('href="/admin/brand"');
    // Internal route: no `target`, no external marker — a `LeavingLink` would be wrong twice.
    expect(html).not.toContain('target="_blank"');
    // One item, one link, one row: no close control and no second destination.
    expect(html.match(/<a /g) ?? []).toHaveLength(1);
    expect(html).not.toContain("aria-label=");
  });

  it("takes its words from the shell fixture, not from the component", () => {
    const section = sectionOf(shellPageCopy, "admin-notice");
    expect(section.cta?.href).toBe("/admin/brand");
    expect(section.items?.map((item) => item.id)).toEqual(["label"]);
  });
});

describe("the rail's offsets", () => {
  it("is the shipped column when no bar is mounted", () => {
    const without = railClassName(false);
    expect(without).toContain("md:top-0");
    expect(without).toContain("md:h-screen");
    expect(without).not.toContain("--admin-notice-h");
  });

  it("moves its top down by the bar's height, and shortens by the same, when the bar is mounted", () => {
    const withBar = railClassName(false, false, true);
    expect(withBar).toContain("md:top-[var(--admin-notice-h)]");
    expect(withBar).toContain("md:h-[calc(100vh_-_var(--admin-notice-h)_-_4rem)]");
    expect(withBar).not.toContain("md:top-0");
  });
});
