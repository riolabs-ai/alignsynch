"use client";

// template-ancestor: components/ui/navigation-menu.tsx   (variation: the nav definition hand-rolled as rows — role-filtered, brand-keyed groups, no navigation-menu primitive)

import { LeavingLink } from "@/components/layout/leaving-link";
import { GeneratedAvatar } from "@/components/media/generated-avatar";
import type { PageCopy } from "@/content/pages";
import type { BrandId } from "@/data/brand";
import { surfaceFor } from "@/data/surface-registry";
import { accountProfileHref } from "@/lib/auth/profile-href";
import type { ShellAccount } from "@/lib/auth/shell-account";
import { leavesApp } from "@/lib/marketing-routes";
import { TEMPLATE_CATALOGUE_PATH } from "@/lib/flow/paths";
import { type NavIconName, menuFor } from "@/lib/nav-menu";
import { type NavViewer, sees } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import {
  Activity,
  Award,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  Compass,
  CreditCard,
  DollarSign,
  FileCheck2,
  FileQuestion,
  Gauge,
  HeartHandshake,
  Home,
  Inbox,
  LayoutDashboard,
  LayoutTemplate,
  Library,
  LifeBuoy,
  Lightbulb,
  Medal,
  Megaphone,
  MessageSquare,
  Newspaper,
  PackagePlus,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  Users,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { type ComponentType, Fragment, type ReactNode } from "react";

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
 *   - **Every href in a menu is a route the gate can see.** `data:check` E10 extracts literal
 *     `href`s from the tree, so a table of `{ href }` records takes every route reference out of
 *     that gate without failing anything. The quiz menu therefore still spells its rows as JSX
 *     attributes, and the alignment menu's rows — records in `lib/nav-menu.ts` since #542 phase 2
 *     — are read by `scripts/ui-refs.ts` as `href:` properties, so both forms are resolved
 *     against `content/routes.ts`. A new menu shape has to reach the gate, not bypass it.
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
  /**
   * Explicit icon-only markup — the label in `title`/`aria-label`, no text node. No shell mount
   * passes this any more (the rail's narrow form is a class, see `NavRow`), so it is the prop a
   * caller uses when it wants the icon row *as markup* — which is how the node tests drive the
   * shape without a browser.
   */
  collapsed?: boolean;
  /**
   * Render every row's label as a text node, whatever the viewport says (the mobile drawer, see
   * `AppSidebar`). Without it the label is `hidden xl:inline`: an icon rail between 768 and
   * 1279px, a labelled column from 1280. The drawer is 250px wide at a 390px viewport, so its
   * labels have room — a class that asks the viewport instead of the container would leave a
   * phone with a full-width panel of icons and no words.
   */
  labelled?: boolean;
  /** The current route, for the active row (`/` matches only `/`, not everything). */
  pathname: string;
  /**
   * Called when a row is followed. The desktop rail has nothing to close; the drawer closes
   * itself with it, so a surface that mounts this menu inside one needs no second menu component.
   */
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
  icon: ReactNode;
  label: string;
  active?: boolean;
  /** Explicit icon-only markup. Defaults to false: the row's width is a class (see `NavRow`). */
  collapsed?: boolean;
  /** See `NavRenderProps.labelled` — the drawer's rows, where the label has room at any viewport. */
  labelled?: boolean;
  onNavigate: () => void;
  /** Flagged off: draw nothing (issue #175). See `NavRenderProps.hidden`. */
  hidden?: boolean;
  /**
   * The first-run tour's anchor (#455), emitted as `data-tour` on the row's control. A step can
   * point at a destination the *shell* owns — the rail's Support row is the tour's sixth step —
   * and the menu stays ignorant of what a tour is: the value is opaque here and read only by
   * `lib/tour/steps.ts`.
   */
  tourAnchor?: string;
  /**
   * The row leaves the app on purpose (#1127). `NavRow` already derives that from `leavesApp()`,
   * but the derivation is invisible to `data:check` E39, which reads the *call site*: a rail row
   * that names a public page states it here, exactly as `Footer` takes `leaving`. Stating it does
   * not change the behaviour — it makes the departure readable where the href is written.
   */
  leaving?: boolean;
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
 *
 * **A pending destination is not a link (issue #409).** A row whose `href` names a surface
 * `data/surface-registry.ts` declares `pending` or `preview` renders as a **disabled `<button>`**:
 * no `<Link>`, no href, no click, `aria-disabled`, the muted tone and the registry's own reason
 * under the label (a `title` carries it in the collapsed rail, where there is no second line to
 * read). The
 * registry decides, not this file, so a surface cannot be greyed in one menu and linked in the
 * other — and a live row is untouched, which is what keeps this a status rule rather than a
 * second menu. Nothing is added or removed by it: greying changes how a row that already exists
 * is drawn, never which rows exist.
 */
export function NavRow(props: NavRowProps) {
  const { icon, label, active, collapsed = false, labelled, onNavigate, hidden } = props;
  if (hidden) return null;

  const surface = props.href === undefined ? undefined : surfaceFor(props.href);
  const pending = surface !== undefined && surface.status !== "live";
  const statusWord = surface?.status === "preview" ? "Preview" : "Pending";
  /**
   * A row that points at the public site leaves the app, and every `NavRow` in the tree is inside
   * the dashboard shell (the marketing header draws its own links from `PublicNav`), so this is
   * not a prop: `/` and `/pricing` in the rail are public pages, and following one in this tab
   * would throw away whatever the reader was doing. `leavesApp` is the runtime half of E39
   * (`lib/marketing-routes.ts`); the accessible name and the marker below are the announcement
   * the rule asks for.
   */
  const leaving =
    !pending && (props.leaving === true || (props.href !== undefined && leavesApp(props.href)));

  const tone = pending
    ? "cursor-not-allowed text-muted-foreground opacity-70"
    : active
      ? "bg-nav-active text-action-foreground"
      : "hover:bg-accent hover:text-accent-foreground";

  const className = collapsed
    ? cn("flex h-10 w-10 items-center justify-center rounded-md transition-colors", tone)
    : cn(
        /**
         * **The row is an icon between `md` and `xl`.** The rail narrows to 64px there
         * (`components/layout/sidebar.tsx`), so the text is `hidden xl:inline` and the row is a
         * 40px square centred in the column; from `xl` — 1280px, the width the owner's v2 shell
         * asked the rail to be expanded at (#1129, DESIGN-NOTES §8) — it is the full-width row it
         * always was. The accessible name does not depend on the width: `title` and `aria-label`
         * carry the label at every breakpoint, so the icon rail is still readable by a pointer and
         * announced by a screen reader. That is a class, not state — no component measures a window
         * to decide whether a label exists. `labelled` is the one exception, and it is not a width:
         * it is the mobile drawer, which is 250px wide at a 390px viewport.
         */
        labelled
          ? "flex h-10 items-center justify-start gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors"
          : "flex h-10 items-center justify-center gap-3 rounded-md text-sm font-medium transition-colors xl:h-auto xl:justify-start xl:px-3 xl:py-2.5",
        tone,
      );

  /**
   * The words a screen reader hears and a pointer shows on hover. A pending row carries its
   * status as well, because the second line that explains it is `hidden xl:flex` like every other
   * label — the announcement may not depend on a width either.
   */
  const accessibleLabel = pending ? `${label} — ${statusWord.toLowerCase()}` : label;
  const title = pending ? surface?.reason : label;

  const content = collapsed ? (
    icon
  ) : (
    <>
      <span>{icon}</span>
      {pending ? (
        <span className={labelled ? "flex min-w-0 flex-col" : "hidden min-w-0 flex-col xl:flex"}>
          <span className="truncate">{label}</span>
          <span className="truncate text-xs font-normal">
            {statusWord} — {surface?.reason}
          </span>
        </span>
      ) : labelled ? (
        <span className="truncate">{label}</span>
      ) : (
        <span className="hidden xl:inline">{label}</span>
      )}
    </>
  );

  const row = pending ? (
    <button
      type="button"
      disabled
      aria-disabled="true"
      aria-label={accessibleLabel}
      title={title}
      data-surface-status={surface?.status}
      data-tour={props.tourAnchor}
      className={className}
    >
      {content}
    </button>
  ) : props.onSelect === undefined ? (
    leaving ? (
      <LeavingLink
        href={props.href}
        label={accessibleLabel}
        title={title}
        onClick={onNavigate}
        tourAnchor={props.tourAnchor}
        className={className}
        iconClassName={collapsed ? "hidden" : labelled ? "ml-auto" : "ml-auto hidden xl:inline"}
      >
        {content}
      </LeavingLink>
    ) : (
      <Link
        href={props.href}
        onClick={onNavigate}
        aria-label={accessibleLabel}
        title={title}
        data-tour={props.tourAnchor}
        className={className}
      >
        {content}
      </Link>
    )
  ) : (
    <button
      type="button"
      onClick={props.onSelect}
      aria-label={accessibleLabel}
      title={title}
      data-tour={props.tourAnchor}
      className={className}
    >
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
function QuizHubMenu({
  copy,
  collapsed = false,
  labelled = false,
  pathname,
  onNavigate,
  hidden,
}: NavRenderProps) {
  const nav = sectionOf(copy, "nav");
  return (
    <>
      <NavRow
        href="/"
        icon={<Home className="size-5" />}
        label={itemLabel(nav, "home")}
        active={pathname === "/"}
        collapsed={collapsed}
        labelled={labelled}
        leaving
        onNavigate={onNavigate}
      />
      <NavRow
        href="/daily-challenge"
        icon={<Trophy className="size-5" />}
        label={itemLabel(nav, "daily-challenge")}
        active={isActive(pathname, "/daily-challenge")}
        collapsed={collapsed}
        labelled={labelled}
        onNavigate={onNavigate}
      />
      <NavRow
        href="/categories"
        icon={<BookOpen className="size-5" />}
        label={itemLabel(nav, "categories")}
        active={isActive(pathname, "/categories")}
        collapsed={collapsed}
        labelled={labelled}
        onNavigate={onNavigate}
      />
      <NavRow
        href="/battle"
        icon={<Swords className="size-5" />}
        label={itemLabel(nav, "battle")}
        active={isActive(pathname, "/battle")}
        collapsed={collapsed}
        labelled={labelled}
        onNavigate={onNavigate}
      />
      <NavRow
        href="/news"
        icon={<Newspaper className="size-5" />}
        label={itemLabel(nav, "news")}
        active={isActive(pathname, "/news")}
        collapsed={collapsed}
        labelled={labelled}
        onNavigate={onNavigate}
      />
      <NavRow
        href="/explore"
        icon={<Compass className="size-5" />}
        label={itemLabel(nav, "explore")}
        active={isActive(pathname, "/explore")}
        collapsed={collapsed}
        labelled={labelled}
        onNavigate={onNavigate}
      />
      <NavRow
        href="/tournaments"
        icon={<Award className="size-5" />}
        label={itemLabel(nav, "tournaments")}
        active={isActive(pathname, "/tournaments")}
        collapsed={collapsed}
        labelled={labelled}
        onNavigate={onNavigate}
      />
      <NavRow
        href="/leaderboard"
        icon={<Medal className="size-5" />}
        label={itemLabel(nav, "leaderboard")}
        active={isActive(pathname, "/leaderboard")}
        collapsed={collapsed}
        labelled={labelled}
        onNavigate={onNavigate}
        hidden={hidden?.includes("/leaderboard")}
      />
      <NavRow
        href="/creator-tips"
        icon={<Lightbulb className="size-5" />}
        label={itemLabel(nav, "creator-tips")}
        active={isActive(pathname, "/creator-tips")}
        collapsed={collapsed}
        labelled={labelled}
        onNavigate={onNavigate}
      />
      <NavRow
        href="/quiz-discussions"
        icon={<FileQuestion className="size-5" />}
        label={itemLabel(nav, "quiz-discussions")}
        active={isActive(pathname, "/quiz-discussions")}
        collapsed={collapsed}
        labelled={labelled}
        onNavigate={onNavigate}
      />
      <NavRow
        href="/create/editor"
        icon={<PackagePlus className="size-5" />}
        label={itemLabel(nav, "create-editor")}
        active={isActive(pathname, "/create/editor")}
        collapsed={collapsed}
        labelled={labelled}
        onNavigate={onNavigate}
      />
      <NavRow
        href="/create/generator"
        icon={<Sparkles className="size-5" />}
        label={itemLabel(nav, "create-generator")}
        active={isActive(pathname, "/create/generator")}
        collapsed={collapsed}
        labelled={labelled}
        onNavigate={onNavigate}
      />
      <NavRow
        href="/affiliate"
        icon={<Users className="size-5" />}
        label={itemLabel(nav, "affiliate")}
        active={isActive(pathname, "/affiliate")}
        collapsed={collapsed}
        labelled={labelled}
        onNavigate={onNavigate}
        hidden={hidden?.includes("/affiliate")}
      />
      <NavRow
        href="/pricing"
        icon={<DollarSign className="size-5" />}
        label={itemLabel(nav, "pricing")}
        active={isActive(pathname, "/pricing")}
        collapsed={collapsed}
        labelled={labelled}
        leaving
        onNavigate={onNavigate}
      />
      <NavRow
        href="/support"
        icon={<LifeBuoy className="size-5" />}
        label={itemLabel(nav, "support")}
        active={isActive(pathname, "/support")}
        collapsed={collapsed}
        labelled={labelled}
        onNavigate={onNavigate}
      />
    </>
  );
}

/**
 * The glyph per icon name in `lib/nav-menu.ts` — the one place a row's picture is chosen.
 *
 * The descriptor names an icon (`"dashboard"`, `"audit"`) because it holds no JSX; this table is
 * the rail's answer. Two of them carry a decision rather than an illustration:
 *
 *   - **Dashboard is `Gauge`.** A dashboard's job is the state of things at a glance, and `Gauge`
 *     is the instrument-panel mark for that. `LayoutDashboard` was the removed Overview row's
 *     glyph and is a floorplan of a page, so it went to the console hub instead.
 *   - **My Relationships is `HeartHandshake`, not `Users`.** Two people in agreement is this
 *     product's subject; `Users` is the quiz menu's affiliate glyph and `ShieldCheck` is the
 *     operator registry's, so either would read as a second meaning for one picture.
 */
const NAV_ICONS: Record<NavIconName, ComponentType<{ className?: string }>> = {
  dashboard: Gauge,
  relationships: HeartHandshake,
  /**
   * #877 — **My Assessments is `ClipboardList`.** A list of sessions, one line each, is exactly
   * what the glyph draws; `HeartHandshake` is the relationship row's ("two people in agreement"),
   * and reusing it here would say the two destinations are the same screen.
   */
  assessments: ClipboardList,
  // #1131 — Chat: a speech bubble, the glyph the v2 bundle draws for its own rail row.
  chat: MessageSquare,
  templates: LayoutTemplate,
  library: Library,
  help: Workflow,
  support: LifeBuoy,
  console: LayoutDashboard,
  instances: ShieldCheck,
  gaps: BarChart3,
  inbox: Inbox,
  health: Activity,
  billing: CreditCard,
  broadcast: Megaphone,
  review: ClipboardCheck,
  audit: ScrollText,
  // #1252 — Project Spec is `FileCheck2`: a document with a tick is "this page states what is
  // agreed and what is proven", and it is the one glyph in this group that draws a document.
  spec: FileCheck2,
};

/**
 * The alignment product's menu — **rendered from `lib/nav-menu.ts`, never written here.**
 *
 * The rows, their order, their groups and the rung each one needs are data (#542 phase 2). This
 * function is the surface: it resolves the fixture label each row names, picks the glyph the row's
 * icon name maps to, and decides which row is *current*. Adding a destination is one record in the
 * descriptor; a destination the viewer's rung cannot use is never in the array, so it is not
 * rendered at all — not hidden by a class, not `aria-hidden`, not disabled.
 *
 * **Why the words and the glyphs are still resolved here.** `lib/nav-menu.ts` holds no JSX and no
 * React, which is what lets a node test drive every rung of it (`tests/nav-menu.test.ts`) and lets
 * the link gate read its hrefs. Copy stays in `data/pages/shell.ts` (E23 holds this file at zero
 * literals), and the icon is a *name* in the descriptor that `NAV_ICONS` below resolves to a lucide
 * component — a picture is not a fact about the menu, it is how this rail draws one.
 *
 * **The active row keeps the two match rules the old markup had.** Most rows mark their children
 * (`/dashboard/relationships/[id]` keeps My Relationships lit); the Overview row is `exact`,
 * because a prefix rule lit it beside whichever `/dashboard/*` page the reader was on (#542
 * phase 1's defect). That is `item.exact` in the descriptor, not a special case here.
 *
 * **Why this menu cannot reach the quiz build.** `AppNav`'s `switch` renders this only for
 * `BRAND=alignsynch`; the quiz brand renders `QuizHubMenu` and nothing else. The quiz product's menu
 * is untouched by this card and still has no rungs — it is one product's own destinations, shown in
 * full to the brand that ships it.
 */
function AlignSynchMenu({
  copy,
  collapsed = false,
  labelled = false,
  pathname,
  onNavigate,
  viewer,
  hidden,
}: NavRenderProps & { viewer: NavViewer }) {
  const nav = sectionOf(copy, "nav-alignsynch");
  return (
    <>
      {menuFor(viewer.role, viewer.capabilities).map((group) => (
        <Fragment key={group.id}>
          <NavGroup
            id={group.id}
            label={group.label === undefined ? undefined : itemLabel(nav, group.label)}
            labelled={labelled}
          >
            {group.items.map((item) => {
              const Icon = NAV_ICONS[item.icon];
              return (
                <Fragment key={item.href}>
                  <NavRow
                    href={item.href}
                    icon={<Icon className="size-5" />}
                    label={itemLabel(nav, item.id)}
                    active={
                      item.exact === true ? pathname === item.href : isActive(pathname, item.href)
                    }
                    collapsed={collapsed}
                    labelled={labelled}
                    onNavigate={onNavigate}
                    tourAnchor={item.tourAnchor}
                    hidden={hidden?.includes(item.href)}
                  />
                </Fragment>
              );
            })}
          </NavGroup>
        </Fragment>
      ))}
    </>
  );
}

/**
 * One labelled group of rail rows (#539 item 10) — a heading and its rows, nothing else.
 *
 * The heading is a label for the group, not a destination: no anchor, no focus stop, and the
 * `lg`-only visibility is what keeps the icon rail a column of icons. `aria-hidden` would hide
 * the name from the one reader who needs it (a screen reader in the drawer), so it stays in the
 * tree at every width and is only visually collapsed between `md` and `lg` — `display: none`
 * takes it out of the accessibility tree there, which is correct for a rail that is icon-only.
 */
function NavGroup({
  children,
  id,
  label,
  labelled,
}: {
  children: ReactNode;
  id: string;
  label?: string;
  labelled: boolean;
}) {
  return (
    <div className="grid gap-1" data-nav-group={label ?? id}>
      {/*
       * No heading when the group has none: `group-project-spec` is the one group that names
       * nothing, because it sits above the first heading and holds a single row that already says
       * what it is. A heading is drawn only when the document gave the group a label id.
       *
       * `data-nav-group` carries the resolved words for every group that has them — that attribute
       * is a QA handle written into the parity manifest's renders, so the labelled groups keep the
       * markup they already shipped — and falls back to the group's id for the one group that draws
       * no heading.
       */}
      {label === undefined ? null : (
        <p
          className={cn(
            "px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
            labelled ? "block" : "hidden xl:block",
          )}
        >
          {label}
        </p>
      )}
      {children}
    </div>
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
