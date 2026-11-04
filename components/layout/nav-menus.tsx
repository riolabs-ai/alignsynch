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
import { type NavViewer, sees } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import {
  Award,
  BarChart3,
  BookOpen,
  Compass,
  CreditCard,
  DollarSign,
  FileQuestion,
  Gauge,
  HeartHandshake,
  Home,
  LayoutTemplate,
  Library,
  LifeBuoy,
  Lightbulb,
  Medal,
  Megaphone,
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
  /**
   * Explicit icon-only markup — the label in `title`/`aria-label`, no text node. No shell mount
   * passes this any more (the rail's narrow form is a class, see `NavRow`), so it is the prop a
   * caller uses when it wants the icon row *as markup* — which is how the node tests drive the
   * shape without a browser.
   */
  collapsed?: boolean;
  /**
   * Render every row's label as a text node, whatever the viewport says (the mobile drawer, see
   * `AppSidebar`). Without it the label is `hidden lg:inline`: an icon rail between 768 and
   * 1023px, a labelled column from 1024. The drawer is 250px wide at a 390px viewport, so its
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
  icon: React.ReactNode;
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
  const leaving = !pending && props.href !== undefined && leavesApp(props.href);

  const tone = pending
    ? "cursor-not-allowed text-muted-foreground opacity-70"
    : active
      ? "bg-nav-active text-action-foreground"
      : "hover:bg-accent hover:text-accent-foreground";

  const className = collapsed
    ? cn("flex h-10 w-10 items-center justify-center rounded-md transition-colors", tone)
    : cn(
        /**
         * **The row is an icon between `md` and `lg`.** The rail narrows to 64px there
         * (`components/layout/sidebar.tsx`), so the text is `hidden lg:inline` and the row is a
         * 40px square centred in the column; from `lg` — a laptop, and the width the owner asked
         * the rail to be expanded at — it is the full-width row it always was. The accessible
         * name does not depend on the width: `title` and `aria-label` carry the label at every
         * breakpoint, so the icon rail is still readable by a pointer and announced by a screen
         * reader. That is a class, not state — no component measures a window to decide whether a
         * label exists. `labelled` is the one exception, and it is not a width: it is the mobile
         * drawer, which is 250px wide at a 390px viewport.
         */
        labelled
          ? "flex h-10 items-center justify-start gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors"
          : "flex h-10 items-center justify-center gap-3 rounded-md text-sm font-medium transition-colors lg:h-auto lg:justify-start lg:px-3 lg:py-2.5",
        tone,
      );

  /**
   * The words a screen reader hears and a pointer shows on hover. A pending row carries its
   * status as well, because the second line that explains it is `hidden lg:flex` like every other
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
        <span className={labelled ? "flex min-w-0 flex-col" : "hidden min-w-0 flex-col lg:flex"}>
          <span className="truncate">{label}</span>
          <span className="truncate text-xs font-normal">
            {statusWord} — {surface?.reason}
          </span>
        </span>
      ) : labelled ? (
        <span className="truncate">{label}</span>
      ) : (
        <span className="hidden lg:inline">{label}</span>
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
        iconClassName={collapsed ? "hidden" : labelled ? "ml-auto" : "ml-auto hidden lg:inline"}
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
 * The alignment product's menu: the console's own destinations in the order the owner's review
 * set, then the one front-page band it still links, then Support, then the operator's rows when
 * the viewer carries `admin-console`.
 *
 * **The rail opens on Dashboard and there is exactly one row for `/dashboard`.** The old menu had
 * "Home" at `/` and a separate "Overview" at `/dashboard`: two words, one console. They are one
 * row now — Dashboard, at `/dashboard` — so the label names the page it opens and no destination
 * appears twice.
 *
 * **The icon is `Gauge`, deliberately.** A dashboard's job is the state of things at a glance, and
 * `Gauge` is the instrument-panel mark for that. `LayoutDashboard` was the removed Overview row's
 * glyph and is a floorplan of a page; carrying it onto the merged row would have kept the look of
 * the duplicate that was deleted, and the review asked for a new mark. `Home` was a building, and
 * the row no longer goes to the front page, so keeping it would be the word and the picture
 * disagreeing with the href.
 *
 * **My Relationships carries `HeartHandshake`, not `Users`.** Two people in agreement is this
 * product's subject; `Users` is the quiz menu's affiliate glyph and `ShieldCheck` is the operator
 * registry's, so either would read as a second meaning for one picture.
 *
 * **My Relationships and Library are adjacent, and Templates sits one row above Support.** The two
 * console lists read as a pair (what you own, what you build from), and the marketing bands end
 * the menu instead of interrupting it.
 *
 * **Why this menu cannot reach the quiz build.** These rows live in `AlignSynchMenu`, which
 * `AppNav`'s `switch` renders only for `BRAND=alignsynch`; the quiz brand renders `QuizHubMenu`
 * and nothing else. So `/assessment/instances` and `/assessment/templates` — routes the brand
 * boundary answers `404` for on the quiz build — are structurally absent there rather than hidden
 * by a check. The only capability consulted below is the operator's,
 * `sees(viewer, "admin-console")`: every console row here answers a signed-out request with
 * `redirect(/login?next=…)`, which is a working destination, unlike `/admin/*`, which answers a
 * signed-in *member* with a 404 and therefore must not be advertised.
 */
function AlignSynchMenu({
  copy,
  collapsed = false,
  labelled = false,
  pathname,
  onNavigate,
  viewer,
}: NavRenderProps & { viewer: NavViewer }) {
  const nav = sectionOf(copy, "nav-alignsynch");
  /**
   * Two groups, admin first (#539 item 10).
   *
   * The operator's five rows used to sit *after* the member's own links, so an admin opened a
   * rail whose first six rows were product navigation and whose real job — the console — was
   * below the fold on a laptop. The fix is the order the owner asked for, stated as two labelled
   * groups rather than as a re-sort: **Administration** (the console's rows, drawn only for a
   * viewer carrying `admin-console`) and then **Workspace** (the member's own destinations).
   *
   * Nothing is added or removed: the same eight rows in a different order, plus the two group
   * labels — which resolve from `data/pages/shell.ts` like every other word here (E23 holds this
   * file at zero literals). The labels are `hidden lg:block` so the 64px icon rail between `md`
   * and `lg` keeps its 40px squares and no 15-character heading is asked to fit in it; the
   * drawer (`labelled`) and the 250px rail show them.
   */
  const admin = sees(viewer, "admin-console");
  return (
    <>
      {admin && (
        <NavGroup label={itemLabel(nav, "group-admin")} labelled={labelled}>
          <NavRow
            href="/admin/gaps"
            icon={<BarChart3 className="size-5" />}
            label={itemLabel(nav, "console-gaps")}
            active={isActive(pathname, "/admin/gaps")}
            collapsed={collapsed}
            labelled={labelled}
            onNavigate={onNavigate}
          />
          <NavRow
            href="/admin/instances"
            icon={<ShieldCheck className="size-5" />}
            label={itemLabel(nav, "admin-instances")}
            active={isActive(pathname, "/admin/instances")}
            collapsed={collapsed}
            labelled={labelled}
            onNavigate={onNavigate}
          />
          <NavRow
            href="/admin/audit"
            icon={<ScrollText className="size-5" />}
            label={itemLabel(nav, "admin-audit")}
            active={isActive(pathname, "/admin/audit")}
            collapsed={collapsed}
            labelled={labelled}
            onNavigate={onNavigate}
          />
          <NavRow
            href="/admin/billing"
            icon={<CreditCard className="size-5" />}
            label={itemLabel(nav, "admin-billing")}
            active={isActive(pathname, "/admin/billing")}
            collapsed={collapsed}
            labelled={labelled}
            onNavigate={onNavigate}
          />
          <NavRow
            href="/admin/broadcast"
            icon={<Megaphone className="size-5" />}
            label={itemLabel(nav, "admin-broadcast")}
            active={isActive(pathname, "/admin/broadcast")}
            collapsed={collapsed}
            labelled={labelled}
            onNavigate={onNavigate}
          />
        </NavGroup>
      )}

      <NavGroup label={itemLabel(nav, "group-app")} labelled={labelled}>
        <NavRow
          href="/dashboard"
          icon={<Gauge className="size-5" />}
          label={itemLabel(nav, "dashboard")}
          active={isActive(pathname, "/dashboard")}
          collapsed={collapsed}
          labelled={labelled}
          onNavigate={onNavigate}
        />
        <NavRow
          href="/how-it-works"
          icon={<Workflow className="size-5" />}
          label={itemLabel(nav, "how-it-works")}
          active={isActive(pathname, "/how-it-works")}
          collapsed={collapsed}
          labelled={labelled}
          onNavigate={onNavigate}
        />
        <NavRow
          href="/assessment/instances"
          icon={<HeartHandshake className="size-5" />}
          label={itemLabel(nav, "my-relationships")}
          active={isActive(pathname, "/assessment/instances")}
          collapsed={collapsed}
          labelled={labelled}
          onNavigate={onNavigate}
        />
        <NavRow
          href="/assessment/templates"
          icon={<Library className="size-5" />}
          label={itemLabel(nav, "template-library")}
          active={isActive(pathname, "/assessment/templates")}
          collapsed={collapsed}
          labelled={labelled}
          onNavigate={onNavigate}
        />
        {/*
          Templates is the public catalogue, `/templates` — a real product page since the
          `#templates` card (#544), not the front page's band. The band is still there (and
          still has `id="templates"`), but a nav row that scrolls a marketing page to a
          section is not a destination; the page that lists every template is.

          It sits in Workspace, not Administration: it is a member-facing catalogue, and
          #539 item 10's split is admin functions first, then the reader's own links.
        */}
        <NavRow
          href="/templates"
          icon={<LayoutTemplate className="size-5" />}
          label={itemLabel(nav, "templates")}
          active={isActive(pathname, "/templates")}
          collapsed={collapsed}
          labelled={labelled}
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
          tourAnchor="help"
        />
      </NavGroup>
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
  label,
  labelled,
}: {
  children: React.ReactNode;
  label: string;
  labelled: boolean;
}) {
  return (
    <div className="grid gap-1" data-nav-group={label}>
      <p
        className={cn(
          "px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
          labelled ? "block" : "hidden lg:block",
        )}
      >
        {label}
      </p>
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

/**
 * The public pages' top menu — the one part of the shell's navigation a marketing route gets.
 *
 * `#317` moved the public pages out of `app/(mainlayout)`, which was right (a public page draws no
 * sidebar, no palette, no drawers) and took the top menu with it: the marketing header rendered a
 * wordmark and one CTA, so `/pricing` was reachable from `/` only if a reader guessed the URL. The
 * fix is not a second navigation tree — it is this file's destinations, laid out horizontally,
 * drawn by the same `PublicNav` on every public route.
 *
 * The shape follows the three rules the sidebar's menus already keep, which is why it lives here
 * and not in `components/marketing/`:
 *
 *   - **the words are the fixture's** — `sectionOf(copy, "nav")` / `sectionOf(copy, "nav-alignsynch")`
 *     and `itemLabel()`, so the header and the sidebar cannot call one destination by two names;
 *   - **the hrefs are literal JSX attributes** — E10 only sees a `href="…"`; a `const` table of
 *     `{ href }` rows would take every route in this menu out of the gate;
 *   - **the brand choice is a `switch` with a `never` default** — a third brand fails `tsc` here
 *     instead of inheriting the quiz menu, exactly as `AppNav` does.
 *
 * It carries **no active-row state**, on purpose: the current route would come from
 * `usePathname()`, and the marketing header has to stay a server component so the account slot's
 * identity is resolved on the server (`lib/auth/shell-account.ts`). A menu that marked the current
 * page would move the whole header — and the avatar in it — into the browser bundle. The active
 * state is a later card with its own decision to make.
 *
 * It is drawn from `md` up, like the shell header's own chips: a phone-width menu is a drawer, and
 * a drawer on a public page is the app chrome this group exists to keep out.
 */
export function PublicNav({ copy, brandId }: { copy: PageCopy; brandId: BrandId }) {
  switch (brandId) {
    case "quizhub":
      return <QuizHubPublicNav copy={copy} />;
    case "alignsynch":
      return <AlignSynchPublicNav copy={copy} />;
    default: {
      // A brand added to `data/brand.ts` without a public menu fails `tsc`.
      const unhandled: never = brandId;
      throw new Error(`no public navigation for brand ${String(unhandled)}`);
    }
  }
}

/** One public row's class string — five links that must read as one set. */
const PUBLIC_ROW_CLASS =
  "text-sm font-medium text-muted-foreground transition-colors hover:text-action";

/**
 * The alignment brand's public menu: the four front-page destinations the sidebar's own
 * `nav-alignsynch` section names, plus `/pricing` and the public help centre.
 *
 * **Templates is `/templates`, not `/#templates`.** The front page's `#templates` band is still
 * where a reader lands from in-page links, but the header row is a product destination now: a
 * menu row that scrolls the marketing page you are already on to a section is furniture, and the
 * owner asked for a catalogue. `How it works` is still the front page's `#questions` band,
 * because no public route for it exists — a link to a route that does not exist is the defect
 * this menu removes.
 *
 * **The last row is `/help`, not `/support`.** The Help/Support split put the answers in public
 * (`/help`) and the contact form behind the app's session (`/support`), so a menu drawn on
 * marketing routes must not send a signed-out reader to the account page — it would only redirect
 * them back here. `help` is its own fixture id, because the rail's `support` row still says
 * "Support" and still opens the account page.
 */
function AlignSynchPublicNav({ copy }: { copy: PageCopy }) {
  const nav = sectionOf(copy, "nav-alignsynch");
  return (
    <nav className="hidden items-center gap-6 md:flex">
      <Link className={PUBLIC_ROW_CLASS} href="/">
        {itemLabel(nav, "home")}
      </Link>
      <Link className={PUBLIC_ROW_CLASS} href="/templates">
        {itemLabel(nav, "templates")}
      </Link>
      <Link className={PUBLIC_ROW_CLASS} href="/#questions">
        {itemLabel(nav, "how-it-works")}
      </Link>
      <Link className={PUBLIC_ROW_CLASS} href="/pricing">
        {itemLabel(nav, "pricing")}
      </Link>
      <Link className={PUBLIC_ROW_CLASS} href="/help">
        {itemLabel(nav, "help")}
      </Link>
    </nav>
  );
}

/**
 * The quiz brand's public menu: four rows, because four of the five public routes are the quiz
 * product's own destinations and `/` is both front pages at once.
 *
 * It reads the `nav` section — the same one its sidebar reads — so "Pricing Plan" there and here
 * is one string, and the two surfaces cannot drift. `/categories` is a quiz route the brand
 * publishes; `/welcome` is the landing page and is reached from the page's own bands, not from
 * this menu (a menu row pointing at the marketing copy beside it is furniture).
 *
 * The last row is **Help** (`/help`) and not the rail's **Support** (`/support`): the split put the
 * FAQ and knowledge base in public and the contact form behind a session, so a signed-out reader
 * on a marketing route gets the page that answers them. The two words are two fixture ids
 * (`help` / `support`), which is why the rail keeps its own.
 */
function QuizHubPublicNav({ copy }: { copy: PageCopy }) {
  const nav = sectionOf(copy, "nav");
  return (
    <nav className="hidden items-center gap-6 md:flex">
      <Link className={PUBLIC_ROW_CLASS} href="/">
        {itemLabel(nav, "home")}
      </Link>
      <Link className={PUBLIC_ROW_CLASS} href="/categories">
        {itemLabel(nav, "categories")}
      </Link>
      <Link className={PUBLIC_ROW_CLASS} href="/pricing">
        {itemLabel(nav, "pricing")}
      </Link>
      <Link className={PUBLIC_ROW_CLASS} href="/help">
        {itemLabel(nav, "help")}
      </Link>
    </nav>
  );
}

/**
 * The public chrome's account slot — the signed-out pair of links, or the signed-in person.
 *
 * It sits beside `PublicNav` for the reason this file gives about `sectionOf` ids: the words are
 * the shell fixture's (`account/signed-out`, `account/sign-up`), and E23 only checks the ids a
 * component asks for against the fixture its surface declares. `components/marketing/**` is
 * attributed to `data/pages/marketing.ts` (the landing page's bands), so a `sectionOf(copy,
 * "account")` written in the header itself would be a name that fixture does not declare — the
 * gate would be right, and the fix is to keep the account's words where the account's words live.
 *
 * **The identity is a prop, never a read.** `account` is resolved by the page's layout, on the
 * server, from the request's session (`lib/auth/shell-account.ts`); nothing here calls
 * `currentUser()`, holds a session, or falls back to a fixture person — that fallback was #212, and
 * a stranger's name over a signed-out visitor's page is exactly what it looked like. `null` is a
 * state, not a failure: it draws the two links, and there is no third branch.
 */
export function PublicAccountSlot({
  copy,
  account,
}: {
  copy: PageCopy;
  account: ShellAccount | null;
}) {
  const accountCopy = sectionOf(copy, "account");

  if (account === null) {
    return (
      /**
       * Sign in / Sign up, with a real gap between them (#539 item 5).
       *
       * `gap-2` was 8px between a text link and a filled button — measured in a 1440 browser,
       * the two read as one control with a label. `gap-4` is 16px, the same step the shell's
       * account row uses between its chips. `whitespace-nowrap` and `shrink-0` are the second
       * half of the fix: at 390 the row used to compress both labels until "Sign In" wrapped
       * to two lines inside a 24px-high link, which is what made the pair look crowded at the
       * narrow end. Neither word may break, and the pair may not shrink — the header's own
       * mark is what gives way (`min-w-0` on the left group).
       */
      <div className="flex shrink-0 items-center gap-4">
        <Link className={cn(PUBLIC_ROW_CLASS, "whitespace-nowrap")} href="/login">
          {itemLabel(accountCopy, "signed-out")}
        </Link>
        <Link
          className="inline-flex items-center whitespace-nowrap rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          href="/register"
        >
          {itemLabel(accountCopy, "sign-up")}
        </Link>
      </div>
    );
  }

  /**
   * The person, as `/profile` and `/leaderboard` already draw one: `GeneratedAvatar` seeded by the
   * handle, the name under it, the `@handle` line below. The same three lines the shell header's
   * menu prints, from the same `ShellAccount`, so one person is one monogram on both chromes.
   */
  const identity = (
    <>
      <GeneratedAvatar name={account.name} seed={account.handle} size={32} />
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-medium">{account.name}</span>
        <span className="text-xs text-muted-foreground">{`@${account.handle}`}</span>
      </span>
    </>
  );

  /**
   * The profile target is the session's own handle (`lib/auth/profile-href.ts`), or nothing. With
   * no target the avatar and the name are drawn **unlinked** rather than pointed at a fixture
   * player: an account that has not chosen a handle yet has no page to open, and the row saying so
   * is the honest render.
   */
  const profileHref = accountProfileHref(account);
  if (profileHref === null) {
    return <div className="flex items-center gap-2">{identity}</div>;
  }

  return (
    <Link className="flex items-center gap-2" href={profileHref}>
      {identity}
    </Link>
  );
}
