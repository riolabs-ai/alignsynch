/**
 * The account menu opens the signed-in person's own profile — or nothing at all (#226).
 *
 * A code review of #221 found the avatar fixed and the row under it still pointing at a fixture
 * player's profile. That link was a 200, so every link check in the tree was green: `data:check`
 * E10 asks whether an `href` resolves, not **whose** profile it is. The row sat inside
 * `seesQuizProduct(brandId, viewer)`, which is true for the whole quiz brand and for an alignment
 * admin carrying `quiz-surfaces`, so "My Profile" opened a stranger for most of this product's
 * users — including a demo Admin's own board.
 *
 * What this file proves, at the two layers the defect crossed:
 *
 *   1. **the derivation** — `accountProfileHref` is `/profile/<the session's handle>` and `null`
 *      when there is no session or no handle. It reads no fixture, so there is no third answer it
 *      could give;
 *   2. **the row** — `Header` rendered with `renderToStaticMarkup` draws that anchor for each of
 *      the three seeded demo accounts (`scripts/db-seed.mjs`'s handles), draws it on the alignment
 *      brand for a viewer carrying `quiz-surfaces`, and **omits the row entirely** when signed out
 *      rather than substituting another person.
 *
 * The render is the part a unit test cannot see: the row is JSX, and an `href` built in the file is
 * exactly what #221's review found still wrong while the module under it was right. Radix's
 * dropdown content is mounted only when the menu opens, so it is mocked to a pass-through div —
 * otherwise a static render of a closed menu would contain no rows and this file would pass on the
 * defect it exists to catch.
 */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
}));

/** The menu's parts, as plain elements: a closed Radix menu renders no rows at all. */
vi.mock("@/components/ui/dropdown-menu", () => {
  const Box = ({ children }: { children?: ReactNode }) => createElement("div", null, children);
  return {
    DropdownMenu: Box,
    DropdownMenuContent: Box,
    DropdownMenuItem: Box,
    DropdownMenuSeparator: () => createElement("hr"),
    DropdownMenuTrigger: Box,
  };
});

/**
 * `lib/auth/shell-account.ts` reaches the session module, which reaches `@neon/auth` and
 * `next/headers` — neither resolves outside a Next server. The derivation under test takes a
 * `SessionUser` as an argument, so the request-shaped half is stubbed exactly as
 * `tests/shell-account.test.ts` stubs it; no test here signs a request in.
 */
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: () => undefined })) }));
vi.mock("@/lib/auth/session", () => ({ currentUser: vi.fn(async () => null) }));
vi.mock("@/lib/db/user-profiles", () => ({
  readUserProfileByUserId: vi.fn(async () => null),
  readUserProfileByHandle: vi.fn(async () => null),
  writeUserProfile: vi.fn(async () => ({ ok: true })),
}));

/**
 * The header's account menu now signs out through `endSession`, which reaches `@neon/auth`
 * (unresolvable outside a Next server). Stubbed here for the same reason the session module above
 * is: the file renders the header, not the auth client.
 */
vi.mock("@/lib/auth/sign-out", () => ({ endSession: vi.fn(async () => true) }));

import { Header } from "@/components/layout/header";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { ConnectedAccounts } from "@/components/settings/connected-accounts";
import type { UserProfile } from "@/content/identity";
import { notifications } from "@/data/notifications";
import { DEMO_ACCOUNT_EMAILS } from "@/lib/auth/demo-accounts";
import { accountProfileHref } from "@/lib/auth/profile-href";
import type { SessionUser } from "@/lib/auth/session";
import { shellAccountOf } from "@/lib/auth/shell-account";
import { PLATFORM_VIEWER, viewerWith } from "@/lib/nav";
import { shellPageCopy } from "@/data/pages/shell";
import { searchIndexFor } from "@/data/searchdata";

/** The three accounts `pnpm db:seed` creates, in the order the demo panel offers them. */
const DEMO = [
  {
    role: "initiator",
    email: DEMO_ACCOUNT_EMAILS.initiator,
    name: "Avery",
    handle: "demo-initiator",
  },
  {
    role: "counterparty",
    email: DEMO_ACCOUNT_EMAILS.counterparty,
    name: "Rowan",
    handle: "demo-counterparty",
  },
  { role: "admin", email: DEMO_ACCOUNT_EMAILS.admin, name: "Demo Admin", handle: "demo-admin" },
] as const;

/** The session as `currentUser()` hands it over. */
function session(email: string, name: string): SessionUser {
  // `sessionId` is only ever read by the set-password path; a fixture that never signs in as this
  // person has no session to keep alive.
  return { userId: `user_${email}`, email, name, sessionId: null };
}

/** A saved `user_profile` row — `handle` is what `db:seed` writes for each demo account. */
function profile(handle: string, displayName: string): UserProfile {
  return {
    userId: `user_${handle}`,
    handle,
    displayName,
    role: "member",
    joinedAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  };
}

/** Every `href` in a rendered tree, in document order. */
function hrefsOf(html: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
}

/**
 * Render the shell's header as the layout renders it: the account resolved server-side, one prop.
 *
 * `searchIndex` is the brand's own catalog — a header without one is a different component — and
 * `SidebarProvider` is the real provider, so the render is the tree the app mounts rather than a
 * component beside it.
 */
function renderHeader(options: {
  account: ReturnType<typeof shellAccountOf>;
  brandId: "quizhub" | "alignsynch";
  viewer?: typeof PLATFORM_VIEWER;
}): string {
  const brandId = options.brandId;
  const viewer = options.viewer ?? PLATFORM_VIEWER;
  return renderToStaticMarkup(
    createElement(SidebarProvider, null, [
      createElement(Header, {
        key: "header",
        copy: shellPageCopy,
        brandId,
        viewer,
        account: options.account,
        searchIndex: searchIndexFor(brandId, viewer),
      }),
    ]),
  );
}

describe("accountProfileHref — the row's only possible target", () => {
  it("is the session's own handle for each seeded demo account", () => {
    for (const entry of DEMO) {
      const account = shellAccountOf(
        session(entry.email, entry.name),
        profile(entry.handle, entry.name),
      );
      expect(accountProfileHref(account)).toBe(`/profile/${entry.handle}`);
    }
  });

  it("follows the handle, so a rename moves the row and nothing else has to change", () => {
    const account = shellAccountOf(
      session("avery@example.test", "Avery"),
      profile("avery-q", "Avery"),
    );
    expect(accountProfileHref(account)).toBe("/profile/avery-q");
    expect(
      accountProfileHref({ name: "Avery", handle: "someone-else", email: "avery@example.test" }),
    ).toBe("/profile/someone-else");
  });

  it("answers null when nobody is signed in, and null for an account with no handle", () => {
    expect(accountProfileHref(null)).toBeNull();
    expect(
      accountProfileHref({ name: "Avery", handle: "", email: "avery@example.test" }),
    ).toBeNull();
    expect(
      accountProfileHref({ name: "Avery", handle: "  ", email: "avery@example.test" }),
    ).toBeNull();
  });

  it("never answers a fixture profile for any of the three", () => {
    const fixture = "/profile/alexjohnson";
    for (const entry of DEMO) {
      const account = shellAccountOf(
        session(entry.email, entry.name),
        profile(entry.handle, entry.name),
      );
      expect(accountProfileHref(account)).not.toBe(fixture);
    }
  });
});

describe("the account menu's My Profile row, rendered", () => {
  it("draws one row per demo account, each pointing at that account's own profile", () => {
    for (const entry of DEMO) {
      const html = renderHeader({
        account: shellAccountOf(
          session(entry.email, entry.name),
          profile(entry.handle, entry.name),
        ),
        brandId: "quizhub",
      });
      const own = hrefsOf(html).filter((href) => href.startsWith("/profile/"));
      // The notifications drawer renders somebody else's profile on purpose (a follower who is
      // not this person); the row this card owns is the only `/profile/` link in the menu.
      expect(own).toContain(`/profile/${entry.handle}`);
      expect(own).not.toContain("/profile/alexjohnson");
      expect(html).toContain("My Profile");
    }
  });

  it("draws no My Profile row for a signed-out visitor — the slot is absent, not substituted", () => {
    const html = renderHeader({ account: null, brandId: "quizhub" });
    expect(html).not.toContain("My Profile");
    expect(hrefsOf(html).filter((href) => href.startsWith("/profile/"))).not.toContain(
      "/profile/alexjohnson",
    );
    // The rest of the selection is still there: the row is hidden, the menu is not.
    expect(html).toContain("/dashboard/user");
    expect(html).toContain("/settings");
  });

  it("draws the admin's own handle on the alignment brand when the viewer carries quiz-surfaces", () => {
    const admin = DEMO[2];
    const html = renderHeader({
      account: shellAccountOf(session(admin.email, admin.name), profile(admin.handle, admin.name)),
      brandId: "alignsynch",
      viewer: viewerWith("quiz-surfaces"),
    });
    expect(hrefsOf(html)).toContain("/profile/demo-admin");
    expect(html).not.toContain("alexjohnson");
  });

  it("keeps the quiz rows off the alignment brand for a plain visitor, signed in or not", () => {
    const admin = DEMO[2];
    const html = renderHeader({
      account: shellAccountOf(session(admin.email, admin.name), profile(admin.handle, admin.name)),
      brandId: "alignsynch",
    });
    expect(html).not.toContain("My Profile");
    expect(hrefsOf(html).filter((href) => href.startsWith("/profile/"))).not.toContain(
      "/profile/demo-admin",
    );
  });
});

describe("the settings panel names the session, not a fixture", () => {
  it("renders every Connected-as line from the account it is handed", () => {
    const entry = DEMO[0];
    const account = shellAccountOf(
      session(entry.email, entry.name),
      profile(entry.handle, entry.name),
    );
    if (account === null) throw new Error("the demo account must resolve for this assertion");
    const html = renderToStaticMarkup(createElement(ConnectedAccounts, { account }));
    // Two rows start connected (Google, Twitter), so their lines are what a static render holds:
    // the mailbox for one, the handle for the other. Facebook and GitHub start disconnected —
    // their line is the same `account.name` / `account.handle` when they are connected, because
    // there is no other value in scope to render.
    expect(html).toContain(`Connected as ${account.email}`);
    expect(html).toContain(`Connected as @${account.handle}`);
    expect((html.match(/Not connected/g) ?? []).length).toBe(2);
    for (const fixture of ["alexjohnson", "@quizmaster", "alex@example.com", "Alex Johnson"]) {
      expect(html).not.toContain(fixture);
    }
  });
});

describe("the achievement notification is about the reader", () => {
  it("does not open a person's profile to do it", () => {
    const achievement = notifications.find((notification) => notification.type === "achievement");
    if (achievement === undefined) throw new Error("data/notifications.ts has no achievement row");
    expect(achievement.link.startsWith("/profile/")).toBe(false);
    expect(achievement.link).toBe("/dashboard/user");
  });
});
