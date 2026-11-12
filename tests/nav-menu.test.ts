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
import {
  NAV_DOCUMENT_VERSION,
  NAV_ICON_NAMES,
  zNavDocument,
  type NavRowRecord,
} from "@/content/nav";
import { matchRoute } from "@/content/route-manifest";
import { routeManifest } from "@/content/routes";
import navDocument from "@/data/nav-menu.json";
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

  it("gives a member the five rows that are theirs, and no staff row", () => {
    expect(MENUS.member).toEqual([
      "/dashboard/relationships",
      "/assessments",
      "/dashboard/templates",
      "/dashboard/help",
      "/dashboard/support",
    ]);
    expect(MENUS.member.filter((href) => href.startsWith("/admin"))).toEqual([]);
  });

  /**
   * #620 — the Workspace group is **exactly three rows**, and the assertion is over the descriptor
   * rather than a screenshot: a menu is data, and the count is the thing the issues asked for. The
   * ids are the owner's words, so a row cannot be added back without naming it here — #877 added
   * `my-assessments` ("My Assessments"), immediately after the relationships it lists the sessions
   * of, and nothing else moved.
   */
  it("draws exactly three Workspace rows — My Relationships, My Assessments and Templates", () => {
    const workspace = ALIGN_MENU.find((group) => group.label === "group-app");
    expect(workspace?.items.map((item) => item.id)).toEqual([
      "my-relationships",
      "my-assessments",
      "templates",
    ]);
    expect(workspace?.items.map((item) => item.href)).toEqual([
      "/dashboard/relationships",
      "/assessments",
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
    // #665 — the review shelf joined the operator group, between Broadcast and the audit log;
    // #901 put the docs home between it and the log, which is why both moved one place up.
    expect(staff[staff.length - 2]).toBe("/admin/docs");
    expect(staff[staff.length - 3]).toBe("/admin/review");
    expect(staff).toHaveLength(10);
  });

  /**
   * #901 — `/admin/docs` renders the 117-page manifest and had **no** rail row, so the whole tree
   * was reachable only by typing the address. The assertion is over both halves the defect needs:
   * the descriptor carries the row, and the rail actually draws it for an operator and for nobody
   * below one.
   */
  it("gives the docs home a row, for an operator and for nobody below one", () => {
    expect(hrefsFor("admin")).toContain("/admin/docs");
    expect(hrefsFor("owner")).toContain("/admin/docs");
    expect(hrefsFor("support")).not.toContain("/admin/docs");
    expect(railHrefs("admin")).toContain("/admin/docs");
    expect(railHrefs("member")).not.toContain("/admin/docs");
  });

  it("gives an owner everything an admin sees — the top rung is not a second list", () => {
    expect(MENUS.owner).toEqual(MENUS.admin);
    expect(MENUS.owner).toEqual(allItems().map((item) => item.href));
  });

  it("counts one more row per rung, in the ladder's own order", () => {
    const counts = USER_ROLES.map((role) => MENUS[role].length);
    expect(counts).toEqual([5, 6, 15, 15]);
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

/**
 * #861 — the rows are a document (`data/nav-menu.json`), and the assertions that used to be about
 * an array in `lib/nav-menu.ts` are now about the file an operator edits. The two halves are
 * checked separately on purpose: this block proves the *document* is complete and honest (schema,
 * rung, route, label, hidden-with-reason), and the blocks above prove the *rail* draws it.
 */
describe("the document the rail is read from", () => {
  const rows = navDocument.groups.flatMap((group) => group.items) as unknown as NavRowRecord[];

  it("satisfies the schema in content/nav.ts — strict, so an unknown key is a failure", () => {
    const parsed = zNavDocument.safeParse(navDocument);
    expect(parsed.error?.issues ?? []).toEqual([]);
    expect(parsed.success).toBe(true);
  });

  it("names the version this build reads", () => {
    expect(navDocument.version).toBe(NAV_DOCUMENT_VERSION);
  });

  it("draws exactly the document's rows, in the document's order", () => {
    // No row uses the explicit `order` key today: the order an editor reads is the order the rail
    // draws, which is the property the move must not lose.
    expect(rows.filter((row) => row.order !== undefined)).toEqual([]);
    expect(allItems().map((item) => item.href)).toEqual(
      rows.filter((row) => row.hidden !== true).map((row) => row.href),
    );
  });

  it("keeps every row — hidden ones included — pointed at a route, an icon and a real label", () => {
    const nav = sectionOf(shellPageCopy, "nav-alignsynch");
    const ids = new Set(nav.items?.map((item) => item.id) ?? []);
    for (const row of navDocument.groups.flatMap((group) => group.items) as NavRowRecord[]) {
      expect(matchRoute(routeManifest, row.href), `${row.href} is not a route`).toBeDefined();
      expect(NAV_ICON_NAMES, `${row.icon} is not an icon name`).toContain(row.icon);
      expect(ids.has(row.label ?? row.id), `${row.href} names "${row.label ?? row.id}"`).toBe(true);
      expect(USER_ROLES).toContain(row.needs);
    }
  });

  it("gives a hidden row a reason — `hidden` is not a role gate, so it has to say why", () => {
    for (const row of rows.filter((candidate) => candidate.hidden === true)) {
      expect((row.reason ?? "").trim(), `row "${row.id}" is hidden with no reason`).not.toBe("");
    }
  });
});
