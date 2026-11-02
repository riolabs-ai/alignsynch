"use client";

// template-ancestor: components/ui/navigation-menu.tsx   (variation: the nav definition hand-rolled as rows — role-filtered, brand-keyed groups, no navigation-menu primitive)

import { GeneratedAvatar } from "@/components/media/generated-avatar";
import type { PageCopy } from "@/content/pages";
import type { BrandId } from "@/data/brand";
import { surfaceFor } from "@/data/surface-registry";
import { accountProfileHref } from "@/lib/auth/profile-href";
import type { ShellAccount } from "@/lib/auth/shell-account";
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
  Gauge,
  HeartHandshake,
  Home,
  LayoutTemplate,
  Library,
  LifeBuoy,
  Lightbulb,
  Medal,
  Newspaper,
  PackagePlus,
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
  const { icon, label, active, collapsed, onNavigate, hidden } = props;
  if (hidden) return null;

  const surface = props.href === undefined ? undefined : surfaceFor(props.href);
  const pending = surface !== undefined && surface.status !== "live";
  const statusWord = surface?.status === "preview" ? "Preview" : "Pending";

  const tone = pending
    ? "cursor-not-allowed text-muted-foreground opacity-70"
    : active
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
      {pending ? (
        <span className="flex min-w-0 flex-col">
          <span className="truncate">{label}</span>
          <span className="truncate text-xs font-normal">
            {statusWord} — {surface?.reason}
          </span>
        </span>
      ) : (
        <span>{label}</span>
      )}
    </>
  );

  const row = pending ? (
    <button
      type="button"
      disabled
      aria-disabled="true"
      aria-label={collapsed ? `${label} — ${statusWord.toLowerCase()}` : undefined}
      title={surface?.reason}
      data-surface-status={surface?.status}
      className={className}
    >
      {content}
    </button>
  ) : props.onSelect === undefined ? (
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
 * The alignment product's menu: the console's own destinations in the order the owner's review
 * set, then the two front-page bands and Support, then the operator's rows when the viewer
 * carries `admin-console`.
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
  collapsed,
  pathname,
  onNavigate,
  viewer,
}: NavRenderProps & { viewer: NavViewer }) {
  const nav = sectionOf(copy, "nav-alignsynch");
  return (
    <>
      <NavRow
        href="/dashboard"
        icon={<Gauge className="size-5" />}
        label={itemLabel(nav, "dashboard")}
        active={isActive(pathname, "/dashboard")}
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
        href="/assessment/instances"
        icon={<HeartHandshake className="size-5" />}
        label={itemLabel(nav, "my-relationships")}
        active={isActive(pathname, "/assessment/instances")}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />
      <NavRow
        href="/assessment/templates"
        icon={<Library className="size-5" />}
        label={itemLabel(nav, "template-library")}
        active={isActive(pathname, "/assessment/templates")}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />
      {/*
        The two front-page bands the brand shipped. They are anchors into `/`'s own sections
        (`/#templates`, `/#questions`), which is why `/` gives those bands an `id`: a route that
        does not exist yet is a later card, and a nav that links to it early is the same 404 this
        issue removes. `tests/nav-brand.test.ts` holds these hrefs to the ids the rendered page
        emits, so an anchor cannot drift from its band.

        Templates is one row above Support on purpose (the review's order), and it stays after the
        console rows: the rail reads console → marketing bands, so the product a member signed up
        for comes before the page it was sold on.
      */}
      <NavRow
        href="/#templates"
        icon={<LayoutTemplate className="size-5" />}
        label={itemLabel(nav, "templates")}
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
      {/*
        The console's Relationships registry (card 3/5, `/admin/instances`), behind the same
        `admin-console` capability and for the same reason: the route refuses a member with the 404
        a URL that never existed returns, so a row every viewer could see would be a row that 404s
        for most of them. `navViewer(role)` in `lib/nav.ts` is what grants the capability — to an
        `admin` session and to nobody else — and `lib/auth/require-role.ts` re-decides it from the
        same request on the page itself.
      */}
      {sees(viewer, "admin-console") && (
        <NavRow
          href="/admin/instances"
          icon={<ShieldCheck className="size-5" />}
          label={itemLabel(nav, "admin-instances")}
          active={isActive(pathname, "/admin/instances")}
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
 * `nav-alignsynch` section names, plus `/pricing`.
 *
 * Templates and How it works are the front page's own bands (`/#templates`, `/#questions`), the
 * same anchors the sidebar and the footer already point at — a public route for either does not
 * exist yet, and a link to a route that does not exist is the defect this menu removes.
 */
function AlignSynchPublicNav({ copy }: { copy: PageCopy }) {
  const nav = sectionOf(copy, "nav-alignsynch");
  return (
    <nav className="hidden items-center gap-6 md:flex">
      <Link className={PUBLIC_ROW_CLASS} href="/">
        {itemLabel(nav, "home")}
      </Link>
      <Link className={PUBLIC_ROW_CLASS} href="/#templates">
        {itemLabel(nav, "templates")}
      </Link>
      <Link className={PUBLIC_ROW_CLASS} href="/#questions">
        {itemLabel(nav, "how-it-works")}
      </Link>
      <Link className={PUBLIC_ROW_CLASS} href="/pricing">
        {itemLabel(nav, "pricing")}
      </Link>
      <Link className={PUBLIC_ROW_CLASS} href="/support">
        {itemLabel(nav, "support")}
      </Link>
    </nav>
  );
}

/**
 * The quiz brand's public menu: four rows, because four of the five public routes are the quiz
 * product's own destinations and `/` is both front pages at once.
 *
 * It reads the `nav` section — the same one its sidebar reads — so "Pricing Plan" there and here
 * is one string, and the two surfaces cannot drift. `/categories` and `/support` are quiz routes
 * the brand publishes; `/welcome` is the landing page and is reached from the page's own bands, not
 * from this menu (a menu row pointing at the marketing copy beside it is furniture).
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
      <Link className={PUBLIC_ROW_CLASS} href="/support">
        {itemLabel(nav, "support")}
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
      <div className="flex items-center gap-2">
        <Link className={PUBLIC_ROW_CLASS} href="/login">
          {itemLabel(accountCopy, "signed-out")}
        </Link>
        <Link
          className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
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
