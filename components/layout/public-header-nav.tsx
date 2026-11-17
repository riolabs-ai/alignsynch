"use client";

// template-ancestor: components/layout/nav-menus.tsx   (variation: the public site's rows, an active item and a disclosure below `md` — no sidebar rows, no drawers, and an identity passed in rather than read)

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** One public row: where it goes, and the words on it (resolved from a fixture, never typed here). */
export interface PublicNavRow {
  readonly id: string;
  readonly label: string;
  readonly href: string;
}

/**
 * The public header's navigation, its two actions and its small-screen disclosure.
 *
 * **Why this is the one client component on the marketing chrome.** Two of its behaviours need the
 * browser: the current route (an active item is `usePathname()`, and a server render cannot know
 * which page it is inside), and the menu button below `md` (a disclosure is state). Neither touches
 * a session — the identity it draws arrives as `account` from the server layout, so the browser
 * never reads a cookie (#212).
 *
 * **The rows are the public site's, not the shell's.** `PublicNav` draws the sidebar's five-row
 * menu laid out horizontally, which is the right answer for a shell and the wrong one for a shop
 * front: a visitor deciding whether this product is for them gets the three doors that answer that
 * question — the catalogue, how it works, and the price. `/help` and the front page are one row
 * down in the footer, so nothing became unreachable.
 *
 * **The active item is graphite with a thin accent underline**, exactly as bundle 02 draws it —
 * `text-primary` plus `decoration-accent` on an `aria-current="page"` link, so the state is in the
 * accessibility tree as well as in the pixels (status is never colour alone).
 *
 * **Below `md` the rows move into a `h-11` panel** (44px a row, the touch target the bundle
 * specifies) behind a button that owns `aria-expanded` / `aria-controls`. The panel is `hidden`
 * rather than unmounted, so a keyboard user's focus order does not change under them when it opens.
 */
export function PublicHeaderNav({
  rows,
  signedOutLabel,
  startFreeLabel,
  startFreeHref,
  navName,
  menuName,
  menuOpenLabel,
  menuCloseLabel,
  account,
}: {
  rows: readonly PublicNavRow[];
  /** The ghost action a visitor gets, and where it goes (`/login`). */
  signedOutLabel: string;
  /** The one primary action: "Start Free", into the catalogue. */
  startFreeLabel: string;
  startFreeHref: string;
  /** The accessible name on the two `<nav>`s. */
  navName: string;
  menuName: string;
  menuOpenLabel: string;
  menuCloseLabel: string;
  /** The signed-in person's name, or `null` for a visitor. */
  account: { readonly name: string; readonly handle: string; readonly href: string | null } | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  /** Is this row the route the reader is on? Exact for the front page, a prefix for a tree. */
  const isActive = (row: PublicNavRow) =>
    row.href === "/" ? pathname === "/" : pathname === row.href || pathname.startsWith(`${row.href}/`);

  const rowClass = (active: boolean) =>
    cn(
      "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      active
        ? "text-primary underline decoration-accent decoration-2 underline-offset-8"
        : "text-foreground",
    );

  return (
    <>
      <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label={navName}>
        {rows.map((row) => (
          <Link
            aria-current={isActive(row) ? "page" : undefined}
            className={rowClass(isActive(row))}
            href={row.href}
            key={row.id}
          >
            {row.label}
          </Link>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        {account === null ? (
          <Link
            className="hidden h-10 items-center rounded-md px-3 text-sm font-medium text-primary transition-colors hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex lg:h-9"
            href="/login"
          >
            {signedOutLabel}
          </Link>
        ) : (
          <Link
            className="hidden items-center gap-2 rounded-md px-2 py-1 hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
            href={account.href ?? "/settings"}
          >
            <span className="text-sm font-medium">{account.name}</span>
            <span className="text-xs text-muted-foreground">{`@${account.handle}`}</span>
          </Link>
        )}
        <Link
          className="inline-flex h-10 items-center justify-center rounded-md bg-action px-3 text-sm font-medium text-action-foreground transition-colors hover:bg-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:h-9"
          data-start-free
          href={startFreeHref}
        >
          {startFreeLabel}
        </Link>
        <button
          aria-controls="public-menu"
          aria-expanded={open}
          aria-label={open ? menuCloseLabel : menuOpenLabel}
          className="inline-flex size-10 items-center justify-center rounded-md text-primary transition-colors hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          <svg
            aria-hidden="true"
            className="size-5 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path d="M4 6h16" />
            <path d="M4 12h16" />
            <path d="M4 18h16" />
          </svg>
        </button>
      </div>

      <nav
        aria-label={menuName}
        className="basis-full border-t bg-background px-4 py-2 md:hidden"
        hidden={!open}
        id="public-menu"
      >
        {rows.map((row) => (
          <Link
            aria-current={isActive(row) ? "page" : undefined}
            className="flex h-11 items-center rounded-md px-3 text-base font-medium text-foreground hover:bg-mist"
            href={row.href}
            key={row.id}
            onClick={() => setOpen(false)}
          >
            {row.label}
          </Link>
        ))}
        {account === null ? (
          <Link
            className="flex h-11 items-center rounded-md px-3 text-base font-medium text-foreground hover:bg-mist"
            href="/login"
            onClick={() => setOpen(false)}
          >
            {signedOutLabel}
          </Link>
        ) : null}
      </nav>
    </>
  );
}
