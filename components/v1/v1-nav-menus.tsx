// template-ancestor: components/layout/nav-menus.tsx   (variation: the persona-scoped menu — Relationships first, Chat second, rows filtered by the #384 matrix with unread/state badges)
"use client";

import {
  NAV_SECTIONS,
  sectionAllowedFor,
  sectionHref,
  type DashboardPersona,
  type NavSection,
} from "@/lib/v1/persona";
import { cn } from "@/lib/utils";
import {
  Bell,
  Handshake,
  LayoutTemplate,
  MessageSquare,
  Settings,
  ShieldCheck,
  ShoppingBag,
  User,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The prototype's navigation — the same row shape as the real shell's `NavRow`, but the menu is a
 * function of the **persona** (from the store) rather than the brand. `Relationships` is the first
 * row and `Chat` the second (#384: "connections and communication front and centre"); both carry a
 * badge, and the rows below them are filtered by `sectionAllowedFor`, so a counterparty's menu has
 * no Shop and nobody but the admin sees the console row.
 */

/** The two rows that carry a badge: Relationships (awaiting) and Chat (unread). */
export interface V1NavBadges {
  readonly relationships: number;
  readonly chat: number;
}

const SECTION_ICONS: Record<NavSection, ReactNode> = {
  relationships: <Handshake className="size-5" />,
  chat: <MessageSquare className="size-5" />,
  templates: <LayoutTemplate className="size-5" />,
  shop: <ShoppingBag className="size-5" />,
  profile: <User className="size-5" />,
  settings: <Settings className="size-5" />,
  notifications: <Bell className="size-5" />,
  admin: <ShieldCheck className="size-5" />,
};

const SECTION_LABELS: Record<NavSection, string> = {
  relationships: "Relationships",
  chat: "Chat",
  templates: "Templates",
  shop: "Shop",
  profile: "Profile",
  settings: "Settings",
  notifications: "Notifications",
  admin: "Admin",
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/v1/admin/console") return pathname.startsWith(href);
  return pathname === href || pathname.startsWith(`${href}/`);
}

function badgeOf(section: NavSection, badges: V1NavBadges): number {
  if (section === "relationships") return badges.relationships;
  if (section === "chat") return badges.chat;
  return 0;
}

/**
 * The rows the sidebar renders for one persona. No store, no hooks: the persona, the badges and
 * the navigate callback arrive as props, so the menu itself stays testable and a row that is not
 * in the persona's matrix is not rendered at all — not `hidden` classes, not `aria-hidden` — the
 * same rule the real shell keeps for flagged-off destinations.
 */
export function V1AppNav({
  persona,
  pathname,
  collapsed,
  badges,
  onNavigate,
}: {
  persona: DashboardPersona;
  pathname: string;
  collapsed: boolean;
  badges: V1NavBadges;
  onNavigate: () => void;
}) {
  const visible = NAV_SECTIONS.filter((section) => sectionAllowedFor(persona, section));

  return (
    <>
      {visible.map((section) => {
        const href = sectionHref(persona, section);
        const active = isActive(pathname, href);
        const badge = badgeOf(section, badges);
        const tone = active
          ? "bg-nav-active text-action-foreground"
          : "hover:bg-accent hover:text-accent-foreground";

        const rowClass = collapsed
          ? cn("relative flex h-10 w-10 items-center justify-center rounded-md", tone)
          : cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium", tone);

        const badgeEl =
          badge > 0 ? (
            collapsed ? (
              <span
                className="absolute right-0.5 top-0.5 size-2 rounded-full bg-action"
                aria-hidden="true"
              />
            ) : (
              <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-action px-1.5 text-[11px] font-semibold text-action-foreground">
                {badge}
              </span>
            )
          ) : null;

        return (
          <div key={section} className="relative flex items-center justify-center">
            <Link href={href} onClick={onNavigate} className={rowClass}>
              <span>{SECTION_ICONS[section]}</span>
              {!collapsed && <span>{SECTION_LABELS[section]}</span>}
            </Link>
            {badgeEl}
          </div>
        );
      })}
    </>
  );
}
