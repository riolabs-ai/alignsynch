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
 *   2. the Admin group leads with the inbox and ends with `/admin/audit`, every `/admin`
 *      destination is in a staff group — the operator group, the project-spec group above it, or
 *      one of the two staff rows #929 moved into Support;
 *   3. the four rungs produce four different menus, each one the whole document **in the
 *      document's order** with the rows that seat cannot reach removed — `needs` gates
 *      visibility, never the sequence (#929);
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
import { USER_ROLES, roleAdmits, type UserRole } from "@/content/role-ladder";

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
      // Throws on a missing id, which is the failure mode this case is for. A **title-less** group
      // declares no label id at all (the project-spec group above the Admin heading), and the
      // absence is the statement — so the check is on a label the group actually carries.
      if (group.label !== undefined) expect(itemLabel(nav, group.label)).toBeTruthy();
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

  /**
   * 2026-11-19, the owner's request — **the project spec is above the Admin heading.** A row above
   * a group's heading cannot live in that group, so it has one of its own: first in the document,
   * exactly one row, and **no heading**, because a heading over a single row that already says
   * "Project Spec" would be the same word twice. `label` is omitted rather than emptied, which is
   * what the renderer reads as "draw no heading".
   */
  it("opens the rail with the project spec, in a title-less group above the Admin heading", () => {
    expect(ALIGN_MENU[0]?.id).toBe("group-project-spec");
    expect(ALIGN_MENU[0]?.label).toBeUndefined();
    expect(ALIGN_MENU[0]?.items.map((item) => item.href)).toEqual(["/admin/spec"]);
    // …and the Admin group follows it, so the row is above that group's title and nowhere else.
    expect(ALIGN_MENU[1]?.id).toBe("group-admin");
    // One row, one href — the defect two rows pointing at `/admin/spec` would be.
    const drawn = (navDocument as unknown as { groups: { items: { href: string }[] }[] }).groups
      .flatMap((group) => group.items)
      .filter((row) => row.href === "/admin/spec");
    expect(drawn).toHaveLength(1);
    expect(allItems().filter((item) => item.href === "/admin/spec")).toHaveLength(1);
  });

  /**
   * #929 — the owner's order, restored: the inbox leads the operator group and the log closes it.
   * The two rows that left for `group-support` (the review shelf, the health page) are asserted
   * **absent** here and present in Support below, because "moved" — not "deleted" — is the claim.
   *
   * #1095 took the growth row out: the page charts a *modelled* business, so the owner kept the
   * screen and removed it from the rail. The row is gone from this list, and its absence is
   * asserted below rather than left implied.
   *
   * 2026-11-19 took the project-spec row out of this group — not off the rail: it leads the rail
   * above this group's heading, and the case above pins that.
   */
  it("leads the Admin group with the inbox and ends it with the audit log", () => {
    const admin = ALIGN_MENU.find((group) => group.id === "group-admin");
    expect(admin).toBeDefined();
    expect(admin?.items.map((item) => item.href)).toEqual([
      "/admin/inbox",
      "/admin/console",
      "/admin/instances",
      "/admin/gaps",
      "/admin/billing",
      "/admin/broadcast",
      "/admin/docs",
      "/admin/permissions",
      // #1138 — the transactional-mail override editor, the third reference row.
      "/admin/email-templates",
      "/admin/audit",
    ]);
  });

  /**
   * #1095 — `/admin/growth` is **URL-only**. The owner's ruling kept the page and dropped the
   * menu row, because a screen charting a simulated business does not belong in an operator's
   * rail. The assertion is negative on purpose and sits where the positive one lived, so the
   * absence is proven at every rung instead of going unmentioned — and the route is asserted
   * present in the same case, because "off the rail" is not "out of the tree".
   */
  it("does not draw the growth model, and still resolves its URL", () => {
    expect(allItems().map((item) => item.href)).not.toContain("/admin/growth");
    expect(hrefsFor("admin")).not.toContain("/admin/growth");
    expect(hrefsFor("owner")).not.toContain("/admin/growth");
    expect(railHrefs("admin")).not.toContain("/admin/growth");
    expect(railHrefs("owner")).not.toContain("/admin/growth");
    // The page is untouched: the route still resolves, so the address is still the way in.
    expect(matchRoute(routeManifest, "/admin/growth")).toBeDefined();
  });

  /**
   * #929 puts exactly **two** admin-gated rows inside `group-support` — the review shelf and the
   * health page. 2026-11-19 adds the project-spec group, which is where `/admin/spec` now lives.
   * So the invariant is: every `/admin` destination is in `group-admin`, in `group-project-spec`,
   * or one of those two named Support rows. A third escaping row, or one escaping into a member
   * group, is still a failure.
   */
  it("keeps every /admin destination in a staff group, and only two outside the operator group", () => {
    const STAFF_ROWS_IN_SUPPORT = ["/admin/review", "/admin/health"];
    const STAFF_GROUPS = ["group-admin", "group-project-spec"];
    const supportHrefs = (
      ALIGN_MENU.find((group) => group.id === "group-support")?.items ?? []
    ).map((item) => item.href);
    expect(supportHrefs.filter((href) => href.startsWith("/admin"))).toEqual(STAFF_ROWS_IN_SUPPORT);

    for (const group of ALIGN_MENU) {
      if (STAFF_GROUPS.includes(group.id) || group.id === "group-support") continue;
      for (const item of group.items) {
        expect(item.href.startsWith("/admin"), `${item.href} sits outside the staff groups`).toBe(
          false,
        );
      }
    }
    for (const item of allItems().filter((candidate) => candidate.href.startsWith("/admin"))) {
      const staffGroupRow = ALIGN_MENU.filter((group) => STAFF_GROUPS.includes(group.id))
        .flatMap((group) => [...group.items])
        .some((candidate) => candidate.href === item.href);
      expect(
        staffGroupRow || STAFF_ROWS_IN_SUPPORT.includes(item.href),
        `${item.href} is in neither staff group`,
      ).toBe(true);
    }
  });
});

describe("the ladder decides the rows", () => {
  /** The five rungs, in order, with the rung each row's floor is met by. */
  const MENUS: Record<UserRole, string[]> = {
    member: hrefsFor("member"),
    stakeholder: hrefsFor("stakeholder"),
    support: hrefsFor("support"),
    admin: hrefsFor("admin"),
    owner: hrefsFor("owner"),
  };

  /**
   * #929 — the operator group, as the owner ordered it: the inbox first, the log last.
   * #1095 — the growth row is gone; the page is URL-only, so no rung draws it.
   * 2026-11-19 — the project-spec row left this group for its own, above the Admin heading; it is
   * asserted as `PROJECT_SPEC` below, so "moved" is proved rather than assumed.
   */
  const ADMIN_GROUP = [
    "/admin/inbox",
    "/admin/console",
    "/admin/instances",
    "/admin/gaps",
    "/admin/billing",
    "/admin/broadcast",
    "/admin/docs",
    // #1126 — the CRUD & Permissions matrix, directly after Docs: the docs say how the product
    // works, this says which role may do what.
    "/admin/permissions",
    // #1138 — the transactional-mail override editor: what the product writes to a person.
    "/admin/email-templates",
    "/admin/audit",
  ];

  /** The one row above the Admin heading, in a group that draws no heading of its own. */
  const PROJECT_SPEC = ["/admin/spec"];

  /** #929 — the Support group, in the owner's order: two staff rows among the help pair. */
  const SUPPORT_GROUP = ["/admin/review", "/dashboard/help", "/admin/health", "/dashboard/support"];

  /**
   * The four Workspace rows every rung above it shares (#620, #877, #1129, #1131).
   *
   * #1129 put `start` at the top (the signed-in landing, `/dashboard`) and retired
   * `my-assessments`; #1131 added `Chat` → `/dashboard/chat` last of the group, which is the order
   * the v2 rail draws (Start · My Relationships · Templates · Chat).
   */
  const WORKSPACE = [
    "/dashboard",
    "/dashboard/relationships",
    "/dashboard/templates",
    "/dashboard/chat",
  ];

  /**
   * **The rule the amendment added, and the one that is easy to lose in a "just move these six
   * rows" edit.** `needs` gates visibility, never the sequence: what a role sees is the document
   * filtered, so the document's order is the *only* order any role gets. A per-role reshuffle —
   * moving the staff rows back to the top for an admin, or closing the gap for a member — fails
   * here even though every individual row is still present.
   */
  it("gives every role the document's own order — needs gates visibility, never the sequence", () => {
    const document = allItems();
    for (const role of USER_ROLES) {
      // Both gates, in the order `menuFor` applies them: the rung (`needs`) and, since #1252, the
      // capability a row may also name (`admin-spec` needs stakeholder *and* `spec-read`, which is
      // how a support seat passes the floor and is still not drawn the row).
      const capabilities = navViewer(role).capabilities;
      const visible = document
        .filter(
          (item) =>
            roleAdmits(item.needs, role) &&
            (item.capability === undefined || capabilities.has(item.capability)),
        )
        .map((item) => item.href);
      expect(hrefsFor(role), `role "${role}" is a re-sort of the document`).toEqual(visible);
      // And the groups a role sees are the document's groups, in the document's order.
      expect(menuFor(role).map((group) => group.id)).toEqual(
        ["group-project-spec", "group-admin", "group-app", "group-support"].filter((id) =>
          hrefsFor(role).some((href) =>
            (ALIGN_MENU.find((group) => group.id === id)?.items ?? []).some(
              (item) => item.href === href,
            ),
          ),
        ),
      );
    }
  });

  it("gives a member the six rows that are theirs, and no staff row", () => {
    expect(MENUS.member).toEqual([...WORKSPACE, "/dashboard/help", "/dashboard/support"]);
    expect(MENUS.member.filter((href) => href.startsWith("/admin"))).toEqual([]);
  });

  /**
   * #620 — the Workspace group is **exactly four rows**, and the assertion is over the descriptor
   * rather than a screenshot: a menu is data, and the count is the thing the issues asked for. The
   * ids are the owner's words, so a row cannot be added back without naming it here — #1129 put
   * `start` at the top (the signed-in landing, `/dashboard`) and retired `my-assessments` (the
   * sessions it listed are one click from My Relationships and `/assessments` still answers), and
   * #1131 added `chat` ("Chat") last, where the v2 rail draws it.
   */
  it("draws exactly four Workspace rows — Start, My Relationships, Templates and Chat", () => {
    const workspace = ALIGN_MENU.find((group) => group.id === "group-app");
    expect(workspace?.items.map((item) => item.id)).toEqual([
      "start",
      "my-relationships",
      "templates",
      "chat",
    ]);
    expect(workspace?.items.map((item) => item.href)).toEqual([
      "/dashboard",
      "/dashboard/relationships",
      "/dashboard/templates",
      "/dashboard/chat",
    ]);
  });

  /**
   * #929 — a support seat's rail opens on the operator group (where the one queue they work is the
   * only row they can reach), then the member's own work, then Support. The row moved from the end
   * of the menu to the front, and nothing around it was re-sorted.
   */
  it("gives a support seat the one queue it works, at the top of the document's order", () => {
    expect(MENUS.support).toEqual(["/admin/inbox", ...MENUS.member]);
    // The project-spec group is dropped whole for this rung: its single row needs `spec-read`,
    // which a support seat — admitted by the rung above it — does not carry.
    expect(menuFor("support").map((group) => group.id)).toEqual([
      "group-admin",
      "group-app",
      "group-support",
    ]);
  });

  it("gives an admin the project spec, the operator group, the member's work, then Support", () => {
    expect(MENUS.admin).toEqual([...PROJECT_SPEC, ...ADMIN_GROUP, ...WORKSPACE, ...SUPPORT_GROUP]);
    // The two admin-gated rows the owner moved into Support are drawn there, for an admin, with
    // the help pair — #929's arrangement, asserted rather than assumed.
    expect(MENUS.admin).toContain("/admin/review");
    expect(MENUS.admin).toContain("/admin/health");
    // #901's docs row survived the move, #1095 removed the growth row, #1126 added the CRUD &
    // Permissions row directly after Docs, #1138 added the mail-override row after that, and
    // 2026-11-19 moved the project spec out into the rail's first group — so ten rows here, with
    // the log still last.
    expect(ADMIN_GROUP).toHaveLength(10);
  });

  /**
   * #1252 — the stakeholder seat. It sits **between** member and support on the ladder, and the one
   * row it draws proves both halves of the new rule: the rung (`needs: stakeholder`) is what a
   * member lacks, and the capability (`spec-read`) is what support — a rung *above* it — lacks. A
   * stakeholder therefore gets the spec and nothing else from the operator group, and no
   * `admin-console` capability to inherit a console row from.
   */
  it("gives a stakeholder the spec and nothing else — no console, no inbox", () => {
    expect(MENUS.stakeholder).toEqual(["/admin/spec", ...MENUS.member]);
    expect(hrefsFor("stakeholder")).not.toContain("/admin/console");
    expect(hrefsFor("stakeholder")).not.toContain("/admin/inbox");
    expect(navViewer("stakeholder").capabilities.has("admin-console")).toBe(false);
    // …and the row is not drawn for the seat that outranks it, which is the capability's whole job.
    expect(hrefsFor("support")).not.toContain("/admin/spec");
    expect(railHrefs("stakeholder")).toContain("/admin/spec");
    expect(railHrefs("support")).not.toContain("/admin/spec");
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

  it("counts the rows each rung draws — five rungs, three shapes", () => {
    const counts = USER_ROLES.map((role) => MENUS[role].length);
    // #920 added one operator row and #1095 removed it again; #1126 added the CRUD & Permissions
    // row, #1138 the mail-override row and #1252 the project spec. 2026-11-19 moved the spec out
    // of the operator group into the rail's first one, so a staff rung still carries 19
    // (PROJECT_SPEC 1 + ADMIN_GROUP 10 + WORKSPACE 4 + SUPPORT_GROUP 4) and the two rungs below it
    // carry 6 and 7. `stakeholder` and `support` both count 7 by coincidence, not by sharing: the
    // stakeholder's seventh row is the spec and support's is the inbox (asserted above).
    expect(counts).toEqual([6, 7, 7, 19, 19]);
    // Not decoration: the first two rungs differ by exactly the row the second exists for.
    expect(counts[1]).toBe(counts[0] + 1);
    expect(counts[2]).toBe(counts[1]);
    expect(counts[3]).toBeGreaterThan(counts[2]);
  });

  it("shows a signed-out visitor the member menu, and never a staff row", () => {
    // `null` is nobody signed in. Every member row answers a signed-out request with
    // `redirect(/login?next=…)` — a working destination — so the reader is shown them and
    // nothing they would be refused.
    expect(hrefsFor(null)).toEqual(MENUS.member);
  });

  it("draws no group heading over no rows", () => {
    expect(menuFor("member").map((group) => group.id)).toEqual(["group-app", "group-support"]);
    // The project-spec group leads the document, so it is the first thing a staff rung draws and
    // the operator group is the first *heading*. A stakeholder reads the spec and nothing else from
    // the staff side, so the operator group is dropped for it exactly as an empty heading would be;
    // a support seat is refused `spec-read`, so the leading group is dropped instead; a member's
    // rail drops both.
    const STAFF: Record<string, string[]> = {
      stakeholder: ["group-project-spec", "group-app", "group-support"],
      support: ["group-admin", "group-app", "group-support"],
      admin: ["group-project-spec", "group-admin", "group-app", "group-support"],
      owner: ["group-project-spec", "group-admin", "group-app", "group-support"],
    };
    for (const [role, expected] of Object.entries(STAFF)) {
      const groups = menuFor(role as UserRole);
      expect(
        groups.map((group) => group.id),
        role,
      ).toEqual(expected);
      // Every group that survives has something to draw; the spec group is the only one allowed to
      // name nothing, and only because it is not empty.
      for (const group of groups)
        expect(group.items.length, `${role} · ${group.id}`).toBeGreaterThan(0);
    }
  });
});

describe("the rendered rail", () => {
  it("renders the descriptor's rows for each role, in order", () => {
    for (const role of USER_ROLES) {
      expect(railHrefs(role)).toEqual(hrefsFor(role));
    }
  });

  /**
   * #929's claim, read off the markup rather than the descriptor: the **operator group is the
   * first heading an admin's rail draws**, and a member's rail opens on their own work because the
   * empty operator group is dropped instead of being re-sorted to the bottom.
   *
   * 2026-11-19 puts one row above that heading: the project spec. It is in the markup first for
   * both staff rungs that can read it, and a support seat — which cannot — still opens on its own
   * queue, so the leading group is dropped the same way an empty heading is.
   */
  it("draws the operator group first for an admin, and opens on the member's work for a member", () => {
    expect(railHrefs("admin")[0]).toBe("/admin/spec");
    expect(railHrefs("owner")[0]).toBe("/admin/spec");
    expect(railHrefs("admin")[1]).toBe("/admin/inbox");
    expect(railHrefs("support")[0]).toBe("/admin/inbox");
    expect(railHrefs("stakeholder")[0]).toBe("/admin/spec");
    expect(railHrefs("member")[0]).toBe("/dashboard");
    // The two staff rows inside Support are in the admin's markup, in the owner's order.
    const admin = railHrefs("admin");
    expect(admin.slice(-4)).toEqual([
      "/admin/review",
      "/dashboard/help",
      "/admin/health",
      "/dashboard/support",
    ]);
    expect(railHrefs("member")).not.toContain("/admin/review");
  });

  /**
   * 2026-11-19 — the owner asked for the row *above the Admin group title*, and it arrives without
   * a title of its own. Two claims, and only the second is what a reader sees: the descriptor has
   * no label for the group, and the markup draws no heading for it. The strip of HTML between the
   * group's own marker and its row is asserted empty of a heading element, because a heading there
   * would be the row's own words twice.
   */
  it("draws the project spec above the Admin heading, with no heading of its own", () => {
    const nav = sectionOf(shellPageCopy, "nav-alignsynch");
    const html = railHtml("admin");
    const spec = html.indexOf('href="/admin/spec"');
    const adminHeading = html.indexOf(`>${itemLabel(nav, "group-admin")}<`);
    expect(spec).toBeGreaterThan(-1);
    expect(adminHeading).toBeGreaterThan(-1);
    expect(spec).toBeLessThan(adminHeading);

    const groupAt = html.indexOf('data-nav-group="group-project-spec"');
    expect(groupAt).toBeGreaterThan(-1);
    expect(groupAt).toBeLessThan(spec);
    expect(html.slice(groupAt, spec)).not.toContain("<p");

    // A stakeholder draws the same group; a support seat — refused `spec-read` — draws none of it.
    expect(railHtml("stakeholder")).toContain('data-nav-group="group-project-spec"');
    expect(railHtml("support")).not.toContain('data-nav-group="group-project-spec"');
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
    for (const id of [
      "console",
      "admin-instances",
      "admin-audit",
      "admin-inbox",
      "admin-health",
      "admin-spec",
    ]) {
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

    // #1129 brought Start back as `/dashboard`, and its row is `exact`: the landing lights, and
    // the child pages below it do not light it beside their own row.
    expect(activeOf("/dashboard")).toEqual(["/dashboard"]);
    expect(activeOf("/dashboard/relationships")).toEqual(["/dashboard/relationships"]);
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
  /**
   * The JSON's inferred type is a union of row shapes (#1129 added `exact` to one row), and a union
   * of arrays is not a `flatMap` input. Reading it through the record type once keeps the assertions
   * below about the *document*, which is what this block is for.
   */
  const document = navDocument as unknown as { groups: { items: NavRowRecord[] }[] };
  const rows = document.groups.flatMap((group) => group.items) as unknown as NavRowRecord[];

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
    for (const row of document.groups.flatMap(
      (group) => group.items,
    ) as unknown as NavRowRecord[]) {
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
