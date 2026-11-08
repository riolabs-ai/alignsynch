"use client";

/**
 * template-ancestor: components/layout/nav-menus.tsx   (variation: the rail drawn from the proposal's own descriptor — same row primitive, different data)
 *
 * The proposed rail, rendered live for `/admin/review/ia` (#721).
 *
 * **It draws rows; it does not draw a second rail.** `NavRow` is the shell's own row component —
 * the forty-pixel height, the active fill, the icon/label split and the pending-surface rule all
 * come from there, so the preview cannot drift into a new visual language. The one thing this file
 * owns is the two lookups the shipped menu also owns: `NAV_ICONS`-equivalent (a name → a lucide
 * glyph) and the fixture label (`itemLabel(nav, id)`), both over `lib/app-ia.ts` and the page's own
 * `data/pages/admin-review-ia.ts`.
 *
 * **Why it is not `AlignSynchMenu` itself.** That renderer resolves `menuFor(viewer.role)` from
 * `lib/nav-menu.ts` — the *shipped* descriptor, filtered by rung. A proposal has to show whole
 * groups at once (a member's operations row cannot be read if the group is filtered away), so the
 * data source is the one thing that varies; the markup below is `NavGroup`'s, class for class.
 *
 * **A client component, because a row is a control.** `NavRow` is a `Link`, and a preview that
 * navigates is the useful artifact: clicking one of these rows lands on the real page it names.
 * Nothing here writes, reads a database or fetches — every href is in `lib/app-ia.ts`.
 */
import {
  Activity,
  BarChart3,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileText,
  Gauge,
  HeartHandshake,
  Inbox,
  LayoutDashboard,
  LayoutTemplate,
  LifeBuoy,
  Mail,
  Megaphone,
  ScrollText,
  ShieldCheck,
  Users,
  Workflow,
} from "lucide-react";
import { type ComponentType, Fragment } from "react";

import { NavRow } from "@/components/layout/nav-menus";
import type { PageCopy } from "@/content/pages";
import { APP_IA_GROUPS, type AppIaIconName } from "@/lib/app-ia";
import { itemLabel, sectionOf } from "@/lib/page-copy";

/**
 * The glyph per icon name in `lib/app-ia.ts`.
 *
 * Six of these are the shipped rail's own choices, reused rather than re-picked: `overview` is
 * `Gauge` (a dashboard is the state of things at a glance), `relationships` is `HeartHandshake`
 * (two people in agreement is this product's subject), `instances` is `ShieldCheck` (the operator
 * registry), and `console`, `templates`, `gap`, `health`, `billing`, `broadcast`, `review`, `audit`,
 * `inbox`, `help` and `support` map to the components `components/layout/nav-menus.tsx` already
 * names. The five the shipped rail has no glyph for — `users`, `reports`, `assessments`,
 * `invitations` and `overview`'s neighbour here — get the cheapest true picture: `Users` for a
 * directory, `FileText` for a report, `ClipboardList` for a session list, `Mail` for an invitation
 * queue.
 */
const IA_ICONS: Record<AppIaIconName, ComponentType<{ className?: string }>> = {
  overview: Gauge,
  relationships: HeartHandshake,
  templates: LayoutTemplate,
  assessments: ClipboardList,
  gap: BarChart3,
  invitations: Mail,
  reports: FileText,
  console: LayoutDashboard,
  users: Users,
  instances: ShieldCheck,
  inbox: Inbox,
  health: Activity,
  billing: CreditCard,
  broadcast: Megaphone,
  review: ClipboardCheck,
  audit: ScrollText,
  help: Workflow,
  support: LifeBuoy,
};

/** One heading of the preview — the class string `NavGroup` draws, at two depths. */
function PreviewHeading({ label, nested }: { label: string; nested?: boolean }) {
  return (
    <p
      className={
        nested
          ? "px-3 pb-1 pl-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          : "px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
      }
    >
      {label}
    </p>
  );
}

/**
 * The proposal as a sidebar. `copy` is the page's own fixture, so the labels are the review
 * screen's words; `pathname` marks the row the reader is on (the review page itself, which no row
 * names, so nothing is lit — the prop is here because a preview mounted elsewhere should behave).
 */
export function AppIaRailPreview({
  copy,
  pathname,
  labelled = true,
}: {
  copy: PageCopy;
  pathname: string;
  labelled?: boolean;
}) {
  const nav = sectionOf(copy, "nav-alignsynch");

  return (
    <div className="grid gap-4">
      {APP_IA_GROUPS.map((group) => (
        <div key={group.id} className="grid gap-1" data-nav-group={group.id}>
          <PreviewHeading label={itemLabel(nav, group.id)} />
          {group.items.map((row) => {
            const Icon = IA_ICONS[row.icon];
            return (
              <NavRow
                key={row.id}
                href={row.href}
                icon={<Icon className="size-5" />}
                label={itemLabel(nav, row.id)}
                active={pathname === row.href}
                labelled={labelled}
                onNavigate={() => undefined}
              />
            );
          })}
          {group.subGroups.map((subGroup) => (
            <Fragment key={subGroup.id}>
              <PreviewHeading nested label={itemLabel(nav, subGroup.id)} />
              {subGroup.items.map((row) => {
                const Icon = IA_ICONS[row.icon];
                return (
                  <NavRow
                    key={row.id}
                    href={row.href}
                    icon={<Icon className="size-5" />}
                    label={itemLabel(nav, row.id)}
                    active={pathname === row.href}
                    labelled={labelled}
                    onNavigate={() => undefined}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}
