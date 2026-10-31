"use client";

import type { PageCopy } from "@/content/pages";
import type { BrandId } from "@/data/brand";
import { type NavViewer, sees } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import {
  Award,
  BarChart3,
  BookOpen,
  Compass,
  DollarSign,
  FileQuestion,
  Home,
  LayoutTemplate,
  LifeBuoy,
  Lightbulb,
  Medal,
  Newspaper,
  PackagePlus,
  Sparkles,
  Swords,
  Trophy,
  Users,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import type React from "react";

/**
 * The shell's navigation, as one definition filtered by brand and capability (issue #156).
 *
 * Before this module the sidebar wrote one list of fifteen quiz links and rendered it on
 * every route of every brand, so the AlignSynch demo's first click was `/leaderboard` — a
 * quiz feature, from a page about alignment. The fix is not a second sidebar: the two menus
 * are two compositions of the same `NavRow`, chosen by a `switch` over the brand literal the
 * way `app/(marketing)/page.tsx` chooses its front page, and the quiz menu is one component
 * that a viewer either gets or does not (`lib/nav.ts`).
 *
 * Three rules this file keeps:
 *
 *   - **The words come from `data/pages/shell.ts`.** Every label is `itemLabel()` against a
 *     section id (`nav`, `nav-alignsynch`), so renaming a destination is a fixture edit and a
 *     renamed id is a red build (E23) rather than a blank row.
 *   - **The hrefs stay literal JSX attributes, on purpose.** `data:check` E10 extracts
 *     literal `href`s from the tree; a menu held in a `const` array of `{ href }` takes every
 *     route reference out of that gate without failing anything. That is why the two menus are
 *     components and not a fixture table.
 *   - **A third brand is a compile error, not an inherited menu.** The `switch` has no
 *     fall-through: its `default` assigns the narrowed union to `never`, so adding a brand to
 *     `data/brand.ts` fails `tsc` here until its menu is chosen deliberately, instead of
 *     quietly rendering the quiz product.
 *
 * The component holds no hooks and no context: `pathname`, `collapsed` and the navigate
 * callback arrive as props, which is what lets `tests/nav-brand.test.ts` render it with
 * `renderToStaticMarkup` and assert the destinations of either brand and either viewer.
 */

/** What the sidebar knows and the menu needs — passed in, never read from context. */
export interface NavRenderProps {
  copy: PageCopy;
  /** `xl` and up: the rail renders icons with a tooltip-free `aria-label`-less link. */
  collapsed: boolean;
  /** The current route, for the active row (`/` matches only `/`, not everything). */
  pathname: string;
  /** Called when a row is followed — the mobile drawer closes itself on this. */
  onNavigate: () => void;
  /**
   * The hrefs whose destination is powered off by a feature flag (issue #175). Absent means
   * "nothing is gated off", which is the pre-flag menu — the shell resolves this on the server
   * (`lib/flags.ts` is server-only) and hands it down, so a client component never decides it.
   *
   * A row carrying one of these is not rendered at all: not `hidden` classes, not `aria-hidden`.
   * An entry that is only visually gone is still in the tab order and still announced, and the
   * route behind it answers 404 — a link to a page that says it does not exist.
   */
  hidden?: readonly string[];
}

function isActive(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

/**
 * Where a row goes, or what it does — exactly one of the two (issue #272).
 *
 * A row that would have been a link with nothing behind it is not a link: sign-out revokes a
 * session, so it is a control. The union is what stops a caller supplying both, or neither.
 */
type NavRowTarget =
  | { href: string; onSelect?: undefined }
  | { onSelect: () => void; href?: undefined };

export type NavRowProps = {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  collapsed: boolean;
  onNavigate: () => void;
  /** Flagged off: draw nothing (issue #175). See `NavRenderProps.hidden`. */
  hidden?: boolean;
} & NavRowTarget;

/**
 * One row of the rail. Exported for the one row the sidebar owns itself — sign-out, which is an
 * account action on both brands rather than a destination in either menu — so that row keeps
 * exactly the markup it had before this module existed.
 *
 * **An action row is a `<button>`, not a link with an empty `href` (issue #272).** The sign-out
 * row carried a bare hash: it rendered, took focus, announced as a link and did nothing, which is
 * worse than an absent row because it says the session ended when it did not. `onSelect` is
 * that row; every destination row is still a `Link`, class for class, so the menus this module
 * draws are byte-for-byte what they were.
 */
export function NavRow(props: NavRowProps) {
  const { icon, label, active, collapsed, onNavigate, hidden } = props;
  if (hidden) return null;

  const tone = active
    ? "bg-nav-active text-action-foreground"
    : "hover:bg-accent hover:text-accent-foreground";

  const className = collapsed
    ? cn("flex h-10 w-10 items-center justify-center rounded-md transition-colors", tone)
    : cn(
        "flex items-center gap-3 rounded-md px-3 py-2 xl:py-2.5 text-sm font-medium transition-colors",
        tone,
      );

  const content = collapsed ? (
    icon
  ) : (
    <>
      <span>{icon}</span>
      <span>{label}</span>
    </>
  );

  const row =
    props.onSelect === undefined ? (
      <Link href={props.href} onClick={onNavigate} className={className}>
        {content}
      </Link>
    ) : (
      <button type="button" onClick={props.onSelect} className={className}>
        {content}
      </button>
    );

  if (!collapsed) return row;
  return <div className="relative group flex justify-center items-center">{row}</div>;
}

/**
 * The quiz product's menu — the fifteen rows the sidebar has always rendered, in the same
 * order, with the same hrefs and the same active rule.
 *
 * `BRAND=quizhub` renders this and nothing else, which is what makes that build byte for
 * byte what it was: the brand switch below picks this branch, and the labels still resolve
 * against the `nav` section of the same fixture.
 */
function QuizHubMenu({ copy, collapsed, pathname, onNavigate, hidden }: NavRenderProps) {
  const nav = sectionOf(copy, "nav");
  return (
    <>
      <NavRow
        href="/"
        icon={<Home className="size-5" />}
        label={itemLabel(nav, "home")}
        active={pathname === "/"}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />
      <NavRow
        href="/daily-challenge"
        icon={<Trophy className="size-5" />}
        label={itemLabel(nav, "daily-challenge")}
        active={isActive(pathname, "/daily-challenge")}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />
      <NavRow
        href="/categories"
        icon={<BookOpen className="size-5" />}
        label={itemLabel(nav, "categories")}
        active={isActive(pathname, "/categories")}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />
      <NavRow
        href="/battle"
        icon={<Swords className="size-5" />}
        label={itemLabel(nav, "battle")}
        active={isActive(pathname, "/battle")}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />
      <NavRow
        href="/news"
        icon={<Newspaper className="size-5" />}
        label={itemLabel(nav, "news")}
        active={isActive(pathname, "/news")}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />
      <NavRow
        href="/explore"
        icon={<Compass className="size-5" />}
        label={itemLabel(nav, "explore")}
        active={isActive(pathname, "/explore")}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />
      <NavRow
        href="/tournaments"
        icon={<Award className="size-5" />}
        label={itemLabel(nav, "tournaments")}
        active={isActive(pathname, "/tournaments")}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />
      <NavRow
        href="/leaderboard"
        icon={<Medal className="size-5" />}
        label={itemLabel(nav, "leaderboard")}
        active={isActive(pathname, "/leaderboard")}
        collapsed={collapsed}
        onNavigate={onNavigate}
        hidden={hidden?.includes("/leaderboard")}
      />
      <NavRow
        href="/creator-tips"
        icon={<Lightbulb className="size-5" />}
        label={itemLabel(nav, "creator-tips")}
        active={isActive(pathname, "/creator-tips")}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />
      <NavRow
        href="/quiz-discussions"
        icon={<FileQuestion className="size-5" />}
        label={itemLabel(nav, "quiz-discussions")}
        active={isActive(pathname, "/quiz-discussions")}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />
      <NavRow
        href="/create/editor"
        icon={<PackagePlus className="size-5" />}
        label={itemLabel(nav, "create-editor")}
        active={isActive(pathname, "/create/editor")}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />
      <NavRow
        href="/create/generator"
        icon={<Sparkles className="size-5" />}
        label={itemLabel(nav, "create-generator")}
        active={isActive(pathname, "/create/generator")}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />
      <NavRow
        href="/affiliate"
        icon={<Users className="size-5" />}
        label={itemLabel(nav, "affiliate")}
        active={isActive(pathname, "/affiliate")}
        collapsed={collapsed}
        onNavigate={onNavigate}
        hidden={hidden?.includes("/affiliate")}
      />
      <NavRow
        href="/pricing"
        icon={<DollarSign className="size-5" />}
        label={itemLabel(nav, "pricing")}
        active={isActive(pathname, "/pricing")}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />
      <NavRow
        href="/support"
        icon={<LifeBuoy className="size-5" />}
        label={itemLabel(nav, "support")}
        active={isActive(pathname, "/support")}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />
    </>
  );
}

/**
 * The alignment product's menu — four rows, and every one of them is a destination that
 * exists on this brand today.
 *
 * The two middle rows are anchors into the front page's own bands (`/#templates`,
 * `/#questions`), which is why `/` gives those bands an `id`: a route that does not exist
 * yet is a later card, and a nav that links to it early is the same 404 this issue removes.
 * `tests/nav-brand.test.ts` holds these three hrefs to the ids the rendered page emits, so an
 * anchor cannot drift from its band.
 */
function AlignSynchMenu({
  copy,
  collapsed,
  pathname,
  onNavigate,
  viewer,
}: NavRenderProps & { viewer: NavViewer }) {
  const nav = sectionOf(copy, "nav-alignsynch");
  return (
    <>
      <NavRow
        href="/"
        icon={<Home className="size-5" />}
        label={itemLabel(nav, "home")}
        active={pathname === "/"}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />
      <NavRow
        href="/#templates"
        icon={<LayoutTemplate className="size-5" />}
        label={itemLabel(nav, "templates")}
        active={false}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />
      <NavRow
        href="/#questions"
        icon={<Workflow className="size-5" />}
        label={itemLabel(nav, "how-it-works")}
        active={false}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />
      <NavRow
        href="/support"
        icon={<LifeBuoy className="size-5" />}
        label={itemLabel(nav, "support")}
        active={isActive(pathname, "/support")}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />
      {/*
        The console's Gap Analysis row, behind the `admin-console` capability rather than always
        drawn (the same rule the quiz rows follow). `/admin/gaps` answers a member with the 404 a
        URL that never existed returns (`lib/auth/require-role.ts`), so a row every viewer could
        see would be a row that 404s for most of them — "an entry that is only visually gone is
        still in the tab order and still announced" (this file's own note on hidden rows).

        `navViewer()` grants no capability today, so this row renders for nobody yet: the
        role → capability mapping is one function (`lib/nav.ts::navViewer`), and until it reads
        `user_profile.role` an operator reaches the screen by URL, exactly as #156 recorded for
        every gated surface. The row exists so the mapping is a capability, not a second menu.
      */}
      {sees(viewer, "admin-console") && (
        <NavRow
          href="/admin/gaps"
          icon={<BarChart3 className="size-5" />}
          label={itemLabel(nav, "console-gaps")}
          active={isActive(pathname, "/admin/gaps")}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      )}
    </>
  );
}

/** The rows the sidebar renders, for one brand and one viewer. */
export function AppNav({
  brandId,
  viewer,
  ...render
}: NavRenderProps & { brandId: BrandId; viewer: NavViewer }) {
  switch (brandId) {
    case "quizhub":
      return <QuizHubMenu {...render} />;
    case "alignsynch":
      return (
        <>
          <AlignSynchMenu {...render} viewer={viewer} />
          {sees(viewer, "quiz-surfaces") && (
            /**
             * The quiz product, for a viewer who is allowed to see it. It is the *same*
             * component the quiz brand renders, not a copy of its links, so an admin's menu
             * cannot drift from the product's.
             */
            <div className="mt-3 grid gap-1 border-t pt-3">
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {itemLabel(sectionOf(render.copy, "nav-alignsynch"), "quiz-tools")}
              </p>
              <QuizHubMenu {...render} />
            </div>
          )}
        </>
      );
    default: {
      // A brand added to `data/brand.ts` without a menu lands here and fails `tsc`.
      const unhandled: never = brandId;
      throw new Error(`no navigation for brand ${String(unhandled)}`);
    }
  }
}
