"use client";

/**
 * template-ancestor: components/layout/nav-menus.tsx   (variation: the rail drawn from the proposal's own descriptor — a main item with its pages as a submenu, same row primitive, different data)
 *
 * The proposed rail, rendered live for `/admin/review/ia` (#721, revised for #731).
 *
 * **It draws rows; it does not draw a second rail.** `NavRow` is the shell's own row component —
 * the forty-pixel height, the active fill, the icon/label split and the pending-surface rule all
 * come from there, so the preview cannot drift into a new visual language. What this file owns is
 * the *group* shape the owner asked for and the two lookups the shipped menu also owns: an
 * icon-name → lucide table, and the fixture label (`itemLabel(nav, id)`).
 *
 * **A group is a main item, and its pages are its submenu.** The main item is a row-shaped control
 * with the group's own glyph and a chevron; opening it reveals the group's pages indented beneath.
 * That is the QuizHub pattern the owner pointed at, and it replaces v1's `Operations` group, which
 * nested five sub-headings (people, content, sessions, money, system) under a console hub row.
 *
 * **Three row renders, decided by the row's own data — never by a flag in the markup.**
 *
 *   an action    `proposed: true` and **no href at all**: `NavRow` with `onSelect`, so the DOM is a
 *                `<button>` — a proposed action has no page behind it, and a rail must never link a
 *                placeholder
 *   a pattern    an href carrying `[id]`: drawn as text, because a `Link` to a pattern is the
 *                dynamic-href error Next raises (and the client crash #721 fixed)
 *   a link       any other href: `NavRow` with the destination, which exists and is concrete
 *
 * **A client component, because a row is a control.** `NavRow` is a `Link` and a group opens and
 * closes, so this is state: every group starts open, because a review artifact that hid its own
 * rows behind a click would be asking the reviewer to trust it. Nothing here writes, reads a
 * database or fetches — every href is in `lib/app-ia.ts`.
 */
import {
  Activity,
  BarChart3,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Copy,
  CreditCard,
  FileText,
  Gauge,
  HeartHandshake,
  Inbox,
  LayoutTemplate,
  LifeBuoy,
  Library,
  Mail,
  Megaphone,
  PackagePlus,
  ScrollText,
  Server,
  ShieldCheck,
  UploadCloud,
  Users,
  Workflow,
} from "lucide-react";
import { type ComponentType, useState } from "react";

import { NavRow } from "@/components/layout/nav-menus";
import type { PageCopy } from "@/content/pages";
import { APP_IA_GROUPS, type AppIaIconName, type AppIaRow, isLinkableHref } from "@/lib/app-ia";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import { cn } from "@/lib/utils";

/**
 * The glyph per icon name in `lib/app-ia.ts`.
 *
 * Most are the shipped rail's own choices, reused rather than re-picked: `overview` is `Gauge` (a
 * dashboard is the state of things at a glance), `relationships` is `HeartHandshake` (two people in
 * agreement is this product's subject), `instances` is `ShieldCheck` (the operator registry), and
 * `templates`, `gap`, `health`, `billing`, `broadcast`, `review`, `audit`, `inbox`, `help` and
 * `support` map to the components `components/layout/nav-menus.tsx` already names. The rest are the
 * cheapest true picture: `Users` for a directory, `Library` for a catalogue, `PackagePlus` for a new
 * record, `Copy` and `UploadCloud` for the two authoring verbs, `Server` for the group that holds
 * the platform's own machinery, `FileText` for a report, `ClipboardList` for a session list and
 * `Mail` for an invitation queue.
 */
const IA_ICONS: Record<AppIaIconName, ComponentType<{ className?: string }>> = {
  overview: Gauge,
  relationships: HeartHandshake,
  templates: LayoutTemplate,
  assessments: ClipboardList,
  gap: BarChart3,
  invitations: Mail,
  reports: FileText,
  users: Users,
  inbox: Inbox,
  library: Library,
  "new-template": PackagePlus,
  clone: Copy,
  publish: UploadCloud,
  instances: ShieldCheck,
  health: Activity,
  billing: CreditCard,
  broadcast: Megaphone,
  review: ClipboardCheck,
  audit: ScrollText,
  system: Server,
  help: Workflow,
  support: LifeBuoy,
};

/**
 * The main item's class string, copied from `NavRow`'s labelled row so a group heading reads as a
 * row rather than as a second kind of furniture. The chevron is the one addition: a main item that
 * opens is the affordance the shipped rail has no example of.
 */
const MAIN_ITEM_CLASS =
  "flex h-10 w-full items-center justify-start gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground";

/** A pattern row — a page whose url carries an id — is muted text, never a control. */
const PATTERN_ROW_CLASS =
  "flex h-10 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground";

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
  /**
   * Which groups are open. Seeded with **every** group's id: the artifact's job is to be read, and
   * a reviewer should see the four operator groups' pages without clicking four times first.
   */
  const [open, setOpen] = useState<ReadonlySet<string>>(
    () => new Set(APP_IA_GROUPS.map((group) => group.id)),
  );

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** One submenu row, rendered by what it *is* — see the three renders in the docblock. */
  const renderRow = (row: AppIaRow) => {
    const Icon = IA_ICONS[row.icon];
    const label = itemLabel(nav, row.id);
    const href = row.href;

    if (row.proposed) {
      return (
        <div key={row.id} className="grid gap-0.5" data-proposed-row={row.id}>
          <NavRow
            icon={<Icon className="size-5" />}
            label={label}
            labelled={labelled}
            onSelect={() => undefined}
            onNavigate={() => undefined}
          />
          <p className="px-3 pb-1 text-xs font-normal text-muted-foreground">
            {itemLabel(nav, "proposed-marker")}
          </p>
        </div>
      );
    }

    /**
     * A **pattern**, or a row carrying no destination at all. The `proposed` branch above is the
     * only legitimate no-href row, so a missing href here is a descriptor defect — drawn as text
     * rather than handed to `<Link>`, which is the one thing that must never happen.
     */
    if (href === undefined || !isLinkableHref(href)) {
      return (
        <div key={row.id} className={PATTERN_ROW_CLASS} data-pattern-row={row.id} title={href}>
          <Icon className="size-5 shrink-0" />
          <span className="truncate">{label}</span>
          <code className="ml-auto truncate text-xs">{href}</code>
        </div>
      );
    }

    return (
      <NavRow
        key={row.id}
        href={href}
        icon={<Icon className="size-5" />}
        label={label}
        active={pathname === href}
        labelled={labelled}
        onNavigate={() => undefined}
      />
    );
  };

  return (
    <div className="grid gap-4">
      {APP_IA_GROUPS.map((group) => {
        const Icon = IA_ICONS[group.icon];
        const expanded = open.has(group.id);
        return (
          <div key={group.id} className="grid gap-1" data-nav-group={group.id}>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => toggle(group.id)}
              className={MAIN_ITEM_CLASS}
            >
              <Icon className="size-5 shrink-0" />
              <span className="truncate">{itemLabel(nav, group.id)}</span>
              <ChevronDown
                className={cn(
                  "ml-auto size-4 shrink-0 transition-transform",
                  expanded ? "rotate-180" : "rotate-0",
                )}
              />
            </button>
            {expanded ? (
              <div className="grid gap-1 pl-2" data-nav-submenu={group.id}>
                {group.items.map((row) => renderRow(row))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
