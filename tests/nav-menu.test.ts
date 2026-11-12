/**
 * The rail's menu is data, and the data is a role-constrained ladder (#542 phase 2).
 *
 * The defect this file exists for, measured on `main`: `/admin/console` had **no row anywhere in
 * the UI** — the operator's five destinations were a separately gated block of JSX, and the hub
 * every one of them hangs off was in neither list. An admin could reach their own console only by
 * typing the URL.
 *
 * So the assertions are about the *descriptor* first (`lib/nav-menu.ts` — pure, no React) and about
 * the rendered rail second:
 *
 *   1. every row names a real fixture label and a real route: a row is not a string nobody checks;
 *   2. the Admin group leads with `/admin/console` and ends with `/admin/audit`, and no `/admin`
 *      destination exists outside it;
 *   3. the four rungs produce four different menus, and each one is a prefix of the next — a
 *      `support` seat sees the member's rows plus the queue they work, an `admin` sees those plus
 *      the console, and `owner` sees everything an `admin` sees;
 *   4. the rendered rail agrees with `menuFor`, because a descriptor nothing renders is a document.
 *
 * **Membership is not authorisation**, and this file does not pretend otherwise: every `/admin/*`
 * page refuses a member with `notFound()` (`lib/auth/require-role.ts`), and every audited write
 * re-asks its floor inside the transaction (`lib/admin/act.ts`). What is proven here is that the
 * rail does not *advertise* a surface the reader would be refused — a row pointing at a 404 is a
 * row that tells a stranger the surface exists.
 */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

import { AppNav } from "@/components/layout/nav-menus";
import { matchRoute } from "@/content/route-manifest";
import { routeManifest } from "@/content/routes";
import { shellPageCopy } from "@/data/pages/shell";
import { navViewer } from "@/lib/nav";
import { ALIGN_MENU, allItems, menuFor } from "@/lib/nav-menu";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import { USER_ROLES, type UserRole } from "@/content/role-ladder";

/** Every `href` in a rendered tree, in document order. */
function hrefsOf(html: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
}

/** The alignment rail's markup for one role — the same mount the shell uses. */
function railHtml(role: UserRole | null): string {
  return renderToStaticMarkup(
    createElement(AppNav, {
      brandId: "alignsynch",
      viewer: navViewer(role),
      copy: shellPageCopy,
      collapsed: false,
      pathname: "/dashboard",
      onNavigate: () => undefined,
    }),
  );
}

/** The rail's destinations for one role. */
function railHrefs(role: UserRole | null): string[] {
  return hrefsOf(railHtml(role));
}

/** The aligned menu's rows for one role, flattened. */
function hrefsFor(role: UserRole | null): string[] {
  return menuFor(role).flatMap((group) => group.items.map((item) => item.href));
}

describe("the menu descriptor", () => {
  it("names a fixture label that exists — the words are the shell's, not the rail's", () => {
    const nav = sectionOf(shellPageCopy, "nav-alignsynch");
    const ids = new Set(nav.items?.map((item) => item.id) ?? []);
    for (const group of ALIGN_MENU) {
      // Throws on a missing id, which is the failure mode this case is for.
      expect(itemLabel(nav, group.label)).toBeTruthy();
      for (const item of group.items) {
        expect(ids.has(item.id), `${item.href} names id "${item.id}"`).toBe(true);
        expect(itemLabel(nav, item.id)).toBeTruthy();
      }
    }
  });

  it("points every row at a route the router resolves", () => {
    for (const item of allItems()) {
      expect(matchRoute(routeManifest, item.href), `${item.href} is not a route`).toBeDefined();
    }
  });

  it("draws no section twice — one row per destination", () => {
    const hrefs = allItems().map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("leads the Admin group with the console hub and ends it with the audit log", () => {
    const admin = ALIGN_MENU.find((group) => group.label === "group-admin");
    expect(admin).toBeDefined();
    const hrefs = admin?.items.map((item) => item.href) ?? [];
    expect(hrefs[0]).toBe("/admin/console");
    expect(hrefs[hrefs.length - 1]).toBe("/admin/audit");
    // The five the rail already carried are still there, and the two it could not reach before.
    for (const href of [
      "/admin/instances",
      "/admin/gaps",
      "/admin/billing",
      "/admin/broadcast",
      "/admin/inbox",
      "/admin/health",
    ]) {
      expect(hrefs).toContain(href);
    }
  });

  it("keeps every /admin destination inside the Admin group", () => {
    const adminHrefs = new Set(
      (ALIGN_MENU.find((group) => group.label === "group-admin")?.items ?? []).map(
        (item) => item.href,
      ),
    );
    for (const group of ALIGN_MENU) {
      if (group.label === "group-admin") continue;
      for (const item of group.items) {
        expect(item.href.startsWith("/admin"), `${item.href} sits outside the Admin group`).toBe(
          false,
        );
      }
    }
    for (const href of allItems().filter((item) => item.href.startsWith("/admin"))) {
      expect(adminHrefs.has(href.href)).toBe(true);
    }
  });
});

describe("the ladder decides the rows", () => {
  /** The four rungs, in order, with the rung each row's floor is met by. */
  const MENUS: Record<UserRole, string[]> = {
    member: hrefsFor("member"),
    support: hrefsFor("support"),
    admin: hrefsFor("admin"),
    owner: hrefsFor("owner"),
  };

  it("gives a member the four rows that are theirs, and no staff row", () => {
    expect(MENUS.member).toEqual([
      "/dashboard/relationships",
      "/dashboard/templates",
      "/dashboard/help",
      "/dashboard/support",
    ]);
    expect(MENUS.member.filter((href) => href.startsWith("/admin"))).toEqual([]);
  });

  /**
   * #620 — the Workspace group is **exactly two rows**, and the assertion is over the descriptor
   * rather than a screenshot: a menu is data, and a count of two is the thing the issue asked for.
   * The two ids are the owner's words, so a third row cannot be added back without naming it here.
   */
  it("draws exactly two Workspace rows — My Relationships and Templates, and nothing else", () => {
    const workspace = ALIGN_MENU.find((group) => group.label === "group-app");
    expect(workspace?.items.map((item) => item.id)).toEqual(["my-relationships", "templates"]);
    expect(workspace?.items.map((item) => item.href)).toEqual([
      "/dashboard/relationships",
      "/dashboard/templates",
    ]);
  });

  it("gives a support seat the member's rows plus the one queue it works", () => {
    expect(MENUS.support).toEqual([...MENUS.member, "/admin/inbox"]);
  });

  it("gives an admin the console group, after the member's rows and with the hub first", () => {
    expect(MENUS.admin.slice(0, MENUS.member.length)).toEqual(MENUS.member);
    const staff = MENUS.admin.slice(MENUS.member.length);
    expect(staff[0]).toBe("/admin/console");
    expect(staff[staff.length - 1]).toBe("/admin/audit");
    // #665 — the review shelf joined the operator group, between Broadcast and the audit log.
    expect(staff[staff.length - 2]).toBe("/admin/review");
    expect(staff).toHaveLength(9);
  });

  it("gives an owner everything an admin sees — the top rung is not a second list", () => {
    expect(MENUS.owner).toEqual(MENUS.admin);
    expect(MENUS.owner).toEqual(allItems().map((item) => item.href));
  });

  it("counts one more row per rung, in the ladder's own order", () => {
    const counts = USER_ROLES.map((role) => MENUS[role].length);
    expect(counts).toEqual([4, 5, 13, 13]);
    // Not decoration: the first two rungs differ by exactly the row support exists for.
    expect(counts[1]).toBe(counts[0] + 1);
    expect(counts[2]).toBeGreaterThan(counts[1]);
  });

  it("shows a signed-out visitor the member menu, and never a staff row", () => {
    // `null` is nobody signed in. Every member row answers a signed-out request with
    // `redirect(/login?next=…)` — a working destination — so the reader is shown them and
    // nothing they would be refused.
    expect(hrefsFor(null)).toEqual(MENUS.member);
  });

  it("draws no group heading over no rows", () => {
    expect(menuFor("member").map((group) => group.label)).toEqual(["group-app", "group-support"]);
    expect(menuFor("support").map((group) => group.label)).toEqual([
      "group-app",
      "group-support",
      "group-admin",
    ]);
  });
});

describe("the rendered rail", () => {
  it("renders the descriptor's rows for each role, in order", () => {
    for (const role of USER_ROLES) {
      expect(railHrefs(role)).toEqual(hrefsFor(role));
    }
  });

  it("renders the console hub for an admin and an owner, and for nobody below them", () => {
    expect(railHrefs("admin")).toContain("/admin/console");
    expect(railHrefs("owner")).toContain("/admin/console");
    expect(railHrefs("support")).not.toContain("/admin/console");
    expect(railHrefs("member")).not.toContain("/admin/console");
    expect(railHrefs(null)).not.toContain("/admin/console");
  });

  it("does not leave an operator row in the markup for a member", () => {
    // The refusal is that a member does not learn the surface exists — so the words are absent
    // from the HTML, not `hidden` in a class a reader could still select.
    const nav = sectionOf(shellPageCopy, "nav-alignsynch");
    const html = railHtml("member");
    for (const id of ["console", "admin-instances", "admin-audit", "admin-inbox", "admin-health"]) {
      expect(html).not.toContain(`>${itemLabel(nav, id)}<`);
    }
  });

  it("marks the current page — and only the current page", () => {
    const activeOf = (pathname: string, role: UserRole = "member") =>
      [
        ...renderToStaticMarkup(
          createElement(AppNav, {
            brandId: "alignsynch",
            viewer: navViewer(role),
            copy: shellPageCopy,
            collapsed: false,
            pathname,
            onNavigate: () => undefined,
          }),
        ).matchAll(/<a\b[^>]*>/g),
      ]
        .map((match) => match[0])
        .filter((tag) => tag.includes("bg-nav-active"))
        .map((tag) => /href="([^"]*)"/.exec(tag)?.[1] ?? "");

    // #620 removed the Overview row, so `/dashboard` lights nothing: the rail has no row it
    // could mark, and a rail that marked a row it does not draw would be the same bug mirrored.
    expect(activeOf("/dashboard")).toEqual([]);
    // A child page keeps its list row lit.
    expect(activeOf("/dashboard/relationships/abc")).toEqual(["/dashboard/relationships"]);
    expect(activeOf("/admin/console", "admin")).toEqual(["/admin/console"]);
  });
});
