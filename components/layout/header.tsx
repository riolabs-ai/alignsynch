"use client";
// template-ancestor: components/layout/nav-menus.tsx   (variation: the top bar — search, the message and notification drawers' triggers and the account menu, over the same nav data as the rail)

import { GeneratedAvatar } from "@/components/media/generated-avatar";
import { BrandGlyph } from "@/components/layout/brand-glyph";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { SearchIndex } from "@/content/search";
import { formatMetricValue } from "@/content/metrics";
import type { PageCopy, PageCopySection } from "@/content/pages";
import { recentMessagesFor } from "@/data/chat-data";
import type { BrandId } from "@/data/brand";
import { metric } from "@/data/metrics";
import { notificationsFor } from "@/data/notifications";
import { querySearchIndex } from "@/content/search";
import { accountProfileHref } from "@/lib/auth/profile-href";
import { endSession } from "@/lib/auth/sign-out";
import type { ShellAccount } from "@/lib/auth/shell-account";
import type { BrandMark } from "@/lib/brand-mark";
import { type NavViewer, seesQuizProduct } from "@/lib/nav";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";
import { accountMenu, type AccountMenuRowId } from "@/lib/shell/account-menu";
import { searchSectionFor } from "@/lib/shell-copy";
import {
  Bell,
  ChevronLeft,
  FileQuestion,
  FileText,
  LogOut,
  Mail,
  Menu,
  MessageCircleQuestion,
  MessageSquare,
  Search,
  Settings,
  Tag,
  TrendingUp,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import ChatDrawer from "../header/ChatDrawer";
import NotificationDrawer from "../header/NotificationDrawer";
import { Badge } from "../ui/badge";

/**
 * The icon and its two colours, per row — the only thing the header adds to `accountMenu()`'s
 * derived rows (#979). Keyed by the row id rather than by position, so a row that disappears (a
 * visitor's Settings, a member's profile before they have a handle) cannot shift a neighbour's
 * icon, and a new row id is a compile error until it is given art.
 */
const ACCOUNT_ROW_ART: Readonly<
  Record<AccountMenuRowId, { icon: typeof User; ground: string; ink: string }>
> = {
  "sign-in": { icon: User, ground: "bg-muted", ink: "" },
  "sign-up": { icon: UserPlus, ground: "bg-gray-100", ink: "text-gray-600" },
  profile: { icon: User, ground: "bg-blue-100", ink: "text-blue-600" },
  dashboard: { icon: TrendingUp, ground: "bg-muted", ink: "text-action" },
  quizzes: { icon: MessageCircleQuestion, ground: "bg-blue-100", ink: "text-blue-600" },
  settings: { icon: Settings, ground: "bg-gray-100", ink: "text-gray-600" },
};

/**
 *
 * `GeneratedAvatar` draws a monogram from a person's name; a signed-out shell has no person and
 * no name, so it must not draw one. This is the neutral disc the spec allows in that state: the
 * same size and shape as the avatar it stands in for, a muted surface, and a generic person glyph
 * — plus the accessible name the slot needs so a screen reader does not announce a person who is
 * not there. It is drawn here rather than in `components/media/` because it is not an avatar of
 * anybody; it is the absence of one, and it has no seed to be a function of.
 */
function SignedOutAvatar({ label, size }: { label: string; size: number }) {
  return (
    <span
      aria-label={label}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
      role="img"
      style={{ width: size, height: size }}
    >
      <User
        aria-hidden="true"
        style={{ width: Math.round(size * 0.5), height: Math.round(size * 0.5) }}
      />
    </span>
  );
}

export function Header({
  copy,
  mark,
  brandId,
  viewer,
  account,
  searchIndex,
  hiddenNav,
  navigationOpen,
  onOpenNavigation,
  focusFlow,
  notice = false,
}: {
  copy: PageCopy;
  /**
   * The brand's lockup, resolved on the server (`lib/brand-mark.ts`) and drawn here only in a
   * focused flow (#542 phase 2) — the one time this bar has to carry the wordmark, because the
   * rail that normally draws it is not rendered. `undefined` for a brand whose logo is the
   * placeholder, in which case the title in type stands in, exactly as the rail falls back.
   */
  mark?: BrandMark;
  brandId: BrandId;
  /**
   * What the person looking at the header may see (`lib/nav.ts`, issue #156). The header is
   * chrome on every route, and two of its pieces are the quiz product's: the wallet chip in the
   * account row, and the account menu's quiz rows. None of them are deleted — the quiz brand
   * renders exactly what it shipped (its brand *is* the product), and on the alignment brand a
   * viewer carrying `quiz-surfaces` gets them back. `seesQuizProduct` is that decision, in one
   * place, because a bare `sees(...)` here would have stripped the quiz build's own wallet
   * (`navViewer()` grants nothing today).
   */
  viewer: NavViewer;
  /**
   * The signed-in person, or `null` (issue #212). Resolved server-side from this request's
   * session by `lib/auth/shell-account.ts` and passed down through the layout, because a client
   * component cannot read a session and an identity the browser supplied is not one.
   *
   * This used to be copy — a placeholder monogram `JD`, a made-up name, a made-up handle and the
   * brand's support mailbox, out of `data/pages/shell.ts` — so
   * every page behind the shell announced a stranger, including a demo Admin's own board. The
   * three lines below are the whole rendering of a person now: the monogram and gradient come
   * from `GeneratedAvatar` (`name` + the handle as its seed), which is the one avatar path
   * `/profile` and `/leaderboard` already draw (#152). Nothing here invents a person, and
   * nothing is random, so the disc is byte-identical on the server and in the browser.
   */
  account: ShellAccount | null;
  /** The brand's own search catalog, built on the server (`data/searchdata.ts`). */
  searchIndex: SearchIndex;
  /**
   * The hrefs a feature flag has turned off (issue #175), resolved on the server in
   * `app/(mainlayout)/layout.tsx` and forwarded by `MainLayout` — `lib/flags.ts` refuses to run
   * in this client component. The notification rows are the header's one navigation surface: a
   * row's `link` is a destination like any nav entry, so a row pointing at a gated route is not
   * drawn (#291 put `/affiliate` on that list). Absent means every gated surface is on.
   */
  hiddenNav?: readonly string[];
  /**
   * The mobile drawer is open (`components/layout/main-layout.tsx` owns the boolean). The header
   * does not render the drawer — `AppSidebar` does — it renders the one trigger, and says so the
   * way a screen reader asks for it: `aria-expanded` follows the state and `aria-controls` names
   * the panel's id.
   */
  navigationOpen: boolean;
  /** Open the drawer. Stable identity: the drawer's focus effect keys on the matching close. */
  onOpenNavigation: () => void;
  /**
   * The focused flow's chrome (#542 phase 2), or `undefined` on every ordinary route.
   *
   * `components/layout/main-layout.tsx` decides it, from the path and `lib/shell/focus-flow.ts`;
   * this bar only draws it. When it is present the left-hand group is the **wordmark and one
   * explicit way back** instead of the drawer trigger and the search field: a rail is not rendered
   * in a focused flow, so the trigger would open nothing, and the palette is a way out of the flow
   * by another name. The account row on the right is untouched — the person, their notifications
   * and their menu stay, which is what makes the flow a screen and not a trap.
   */
  focusFlow?: {
    /** Where the exit goes (`/dashboard` — the workspace, not the marketing site). */
    readonly backHref: string;
    /** Its label, from `data/pages/shell.ts`'s `focus` section. */
    readonly backLabel: string;
  };
  /**
   * Is the admin notice bar mounted above this header (#906)?
   *
   * The bar is a row in the document flow, so a `sticky top-0` header would stick *over* it — the
   * exact "cover the header" failure the banner spec's §3 arithmetic exists to stop. When the bar
   * is present the header's top is `var(--admin-notice-h)` (the height the bar publishes on the
   * layout wrapper); when it is not, this is `undefined` and the class list stays byte-for-byte what
   * it was, which is what keeps a signed-out or QuizHub render out of `pnpm parity`'s diff.
   */
  notice?: boolean;
}) {
  // The shell's copy, resolved here rather than in each band: `data/pages/shell.ts`
  // owns the words, this file owns which ids it renders. A renamed id is a red build
  // (E23) and a blank header would be the alternative.
  const searchCopy = searchSectionFor(copy, brandId);
  const accountCopy = sectionOf(copy, "account");
  const notificationsCopy = sectionOf(copy, "notifications");
  const messagesCopy = sectionOf(copy, "messages");
  /**
   * The drawer trigger's two names. Below 768px only: at `md` and up the rail is a column — 64px
   * of icons, then the labelled 250px rail from `lg` — so there is nothing for a hamburger to
   * open, and a control that toggles a panel which is always present is the "button that does
   * nothing" this shell has already removed twice.
   */
  const railCopy = sectionOf(copy, "rail");

  /**
   * The account menu's "My Profile" row (#226).
   *
   * The row's target is the session's own handle and nothing else: `accountProfileHref` answers
   * `null` when nobody is signed in, and the row is then **not rendered**. It used to be a fixture
   * player's profile, which is a valid route — so no link check could see it — on every screen this
   * menu appears on: the whole quiz brand, and an alignment admin carrying `quiz-surfaces`. A link
   * to a stranger is not a link to "my" anything, and hiding the row is the honest state rather
   * than pointing it at whichever person the fixtures happen to name.
   */
  const profileHref = accountProfileHref(account);

  /**
   * The account menu, derived from the session (#979). `accountMenu()` owns *which* rows exist —
   * a visitor gets Sign in and Sign up, a member gets their own rows and a Log out — so this
   * component cannot drift back to a menu that offers a log-out control to somebody with no
   * session. The art below is the only thing it adds.
   */
  const menu = accountMenu({
    copy: accountCopy,
    account,
    quizRows: seesQuizProduct(brandId, viewer),
    profileHref,
  });

  /**
   * The drawers' content for this brand (`data/chat-data.ts`, `data/notifications.ts`). Both
   * fixtures are the quiz product's; the alignment build has nothing behind either drawer, so it
   * gets empty lists and the drawers draw their own empty states instead of another product's
   * conversations and badges (issue #156 follow-up).
   */
  const messages = recentMessagesFor(brandId);
  /**
   * The rows whose destination a flag has turned off are dropped here, before the drawer and the
   * unread badge both read this list (#291 — a "Quiz Reward" row pointed at `/affiliate`, which
   * answers 404 while `commerce.affiliate` is off). Filtering at the source is what keeps the
   * badge's count equal to the rows a person can actually open; filtering inside the drawer would
   * leave a count for a row nobody can see.
   */
  const notifications = notificationsFor(brandId).filter(
    (notification) => !(hiddenNav ?? []).includes(notification.link),
  );

  const pathname = usePathname();
  const router = useRouter();
  const [isMessagesDrawerOpen, setIsMessagesDrawerOpen] = useState(false);
  const [isNotificationsDrawerOpen, setIsNotificationsDrawerOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);

  // Add useState for search functionality
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const searchResultsRef = React.useRef<HTMLDivElement>(null);

  // The palette reads the same derived index the /search page renders, through the same
  // projection (`querySearchIndex`), so a palette hit and a result row can never disagree.
  // Slices only: the dropdown shows the top few, and "View all" sends the query to /search.
  const paletteResults = querySearchIndex(searchIndex, { text: searchQuery });
  const searchResults = {
    quizzes: paletteResults.quizzes.slice(0, 4),
    categories: paletteResults.categories.slice(0, 3),
    creators: paletteResults.creators.slice(0, 3),
    pages: paletteResults.pages.slice(0, 3),
  };

  // Add click outside handler to close search results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchResultsRef.current &&
        !searchResultsRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setIsSearchFocused(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Close drawers when navigating to a new page
  useEffect(() => {
    setIsMessagesDrawerOpen(false);
    setIsNotificationsDrawerOpen(false);
  }, [pathname]);

  // Ensure only one drawer can be open at a time
  useEffect(() => {
    if (isMessagesDrawerOpen) {
      setIsNotificationsDrawerOpen(false);
    }
  }, [isMessagesDrawerOpen]);

  useEffect(() => {
    if (isNotificationsDrawerOpen) {
      setIsMessagesDrawerOpen(false);
    }
  }, [isNotificationsDrawerOpen]);

  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;
  const unreadMessagesCount = messages.filter((m) => m.unread).length;

  const handleMessageClick = (conversationId: string) => {
    router.push(`/chat?conversation=${conversationId}`);
    setIsMessagesDrawerOpen(false);
  };

  const handleNotificationClick = () => {
    setIsNotificationsDrawerOpen(false);
    // In a real app, you would mark the notification as read here
  };

  const markAllNotificationsAsRead = () => {
    // In a real app, you would call an API to mark all notifications as read
    // For now, we'll just close the drawer
    setIsNotificationsDrawerOpen(false);
  };

  /**
   * Sign out from the account menu — the same step the rail's row runs, so one control does not
   * pretend while the other revokes. On success the person lands on the marketing front page,
   * signed out, with no dashboard chrome; a failure is said out loud under the button rather than
   * swallowed (issue #272's rule, on the header's control).
   */
  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutFailed(false);
    if (!(await endSession())) {
      setSigningOut(false);
      setSignOutFailed(true);
      return;
    }
    router.replace("/");
    router.refresh();
  };

  return (
    <>
      <header
        className={`sticky ${notice ? "top-[var(--admin-notice-h)]" : "top-0"} z-30 flex h-16 items-center justify-between border-b bg-background px-4 md:px-6`}
      >
        <div className="flex items-center gap-4">
          {/**
           * The focused flow's own left-hand chrome (#542 phase 2): the wordmark, and one explicit
           * way back.
           *
           * In a focused flow the rail is not rendered (`components/layout/main-layout.tsx`), so
           * the shell's wordmark would otherwise leave the screen entirely and the page would open
           * on a bar whose only content is the account row. The mark is drawn here in one form —
           * the lockup at its own aspect ratio, as the 250px rail draws it — rather than with the
           * rail's three-width rule, because this bar has one width. With no lockup asset the
           * title in type is the wordmark, exactly as the rail falls back.
           *
           * It is **not a link**: the one control the flow offers is the exit below, and two
           * anchors to two destinations on a screen whose point is "finish this one thing" is
           * the choice this bar removes.
           */}
          {focusFlow !== undefined && (
            <>
              <span className="flex shrink-0 items-center gap-2">
                {mark !== undefined ? (
                  <Image
                    src={mark.src}
                    alt={copy.heading}
                    width={mark.width}
                    height={mark.height}
                    className="h-7 w-auto"
                    priority
                  />
                ) : (
                  <>
                    <BrandGlyph className="h-6 w-6 text-primary" />
                    <span className="text-lg font-bold">{copy.heading}</span>
                  </>
                )}
              </span>
              {/**
               * **The way out, and the reason this bar exists.** A flow that hid the navigation
               * and offered no exit would be a dead end — the failure the card names — so the
               * link is the first thing in the bar, not a control in a menu: the label says where
               * it goes, and it goes to the workspace rather than to the marketing site.
               */}
              <Link
                href={focusFlow.backHref}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                {focusFlow.backLabel}
              </Link>
            </>
          )}
          {focusFlow === undefined && (
            <>
              {/*
            The drawer trigger — the one control in the shell that opens navigation, and the only
            width that has anything to open. Below `md` the rail is an overlay
            (`components/layout/sidebar.tsx`); from `md` it is a sticky column, so this is
            `md:hidden` and the button cannot become a toggle for something always on screen.
          */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={onOpenNavigation}
                aria-label={
                  navigationOpen ? itemLabel(railCopy, "close") : itemLabel(railCopy, "open")
                }
                aria-expanded={navigationOpen}
                aria-controls="app-sidebar"
              >
                <Menu className="size-5" aria-hidden="true" />
              </Button>

              <div className="relative w-full md:w-64 lg:w-80 xl:w-96 max-md:hidden">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  type="search"
                  placeholder={itemLabel(searchCopy, "placeholder")}
                  className="w-full rounded-md border-0 bg-muted pl-8 focus-visible:ring-0 focus-visible:ring-offset-0"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                />

                {/* Search Results Dropdown */}
                {isSearchFocused && (
                  <div
                    ref={searchResultsRef}
                    className="absolute top-full left-0 w-full mt-1 p-2 bg-background rounded-md border shadow-lg z-50 max-h-[80vh] overflow-auto"
                  >
                    {!searchQuery.trim() ? (
                      <div className="p-4 text-center text-muted-foreground">
                        <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>{itemLabel(searchCopy, "hint")}</p>
                      </div>
                    ) : (
                      <>
                        {Object.entries(searchResults).every(([_, items]) => items.length === 0) ? (
                          <div className="p-4 text-center text-muted-foreground">
                            <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>
                              {fillLabel(itemLabel(searchCopy, "empty-title"), {
                                query: searchQuery,
                              })}
                            </p>
                            <p className="text-sm mt-1">{itemLabel(searchCopy, "empty-hint")}</p>
                          </div>
                        ) : (
                          <>
                            {/* Quizzes */}
                            {searchResults.quizzes.length > 0 && (
                              <div className="mb-4">
                                <div className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted-foreground">
                                  <FileQuestion className="h-4 w-4" />
                                  <span>{itemLabel(searchCopy, "group-quizzes")}</span>
                                </div>
                                <div className="mt-1">
                                  {searchResults.quizzes.map((quiz) => (
                                    <Link
                                      key={quiz.id}
                                      href={quiz.path}
                                      className="flex items-start gap-3 p-2 hover:bg-muted rounded-md transition-colors"
                                      onClick={() => {
                                        setIsSearchFocused(false);
                                        setSearchQuery("");
                                      }}
                                    >
                                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                                        <FileQuestion className="h-4 w-4 text-primary" />
                                      </div>
                                      <div>
                                        <p className="font-medium line-clamp-1">{quiz.title}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                          <Badge variant="outline" className="text-xs font-normal">
                                            {quiz.categoryNames[0]}
                                          </Badge>
                                          <Badge variant="outline" className="text-xs font-normal">
                                            {quiz.difficulty}
                                          </Badge>
                                        </div>
                                      </div>
                                    </Link>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Categories */}
                            {searchResults.categories.length > 0 && (
                              <div className="mb-4">
                                <div className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted-foreground">
                                  <Tag className="h-4 w-4" />
                                  <span>{itemLabel(searchCopy, "group-categories")}</span>
                                </div>
                                <div className="mt-1">
                                  {searchResults.categories.map((category) => (
                                    <Link
                                      key={category.id}
                                      href={category.path}
                                      className="flex items-center gap-3 p-2 hover:bg-muted rounded-md transition-colors"
                                      onClick={() => {
                                        setIsSearchFocused(false);
                                        setSearchQuery("");
                                      }}
                                    >
                                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-100">
                                        <Tag className="h-4 w-4 text-blue-600" />
                                      </div>
                                      <div className="flex-1">
                                        <p className="font-medium">{category.name}</p>
                                      </div>
                                      <Badge variant="outline" className="text-xs font-normal">
                                        {fillLabel(itemLabel(searchCopy, "count-quizzes"), {
                                          count: category.count,
                                        })}
                                      </Badge>
                                    </Link>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Creators */}
                            {searchResults.creators.length > 0 && (
                              <div className="mb-4">
                                <div className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted-foreground">
                                  <Users className="h-4 w-4" />
                                  <span>{itemLabel(searchCopy, "group-creators")}</span>
                                </div>
                                <div className="mt-1">
                                  {searchResults.creators.map((creator) => (
                                    <Link
                                      key={creator.id}
                                      href={`/profile/${creator.username}`}
                                      className="flex items-center gap-3 p-2 hover:bg-muted rounded-md transition-colors"
                                      onClick={() => {
                                        setIsSearchFocused(false);
                                        setSearchQuery("");
                                      }}
                                    >
                                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-green-100">
                                        <User className="h-4 w-4 text-green-600" />
                                      </div>
                                      <div className="flex-1">
                                        <p className="font-medium">{creator.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                          @{creator.username}
                                        </p>
                                      </div>
                                      <Badge variant="outline" className="text-xs font-normal">
                                        {fillLabel(itemLabel(searchCopy, "count-quizzes"), {
                                          count: creator.quizCount,
                                        })}
                                      </Badge>
                                    </Link>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Pages */}
                            {searchResults.pages.length > 0 && (
                              <div className="mb-2">
                                <div className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted-foreground">
                                  <FileText className="h-4 w-4" />
                                  <span>{itemLabel(searchCopy, "group-pages")}</span>
                                </div>
                                <div className="mt-1">
                                  {searchResults.pages.map((page) => (
                                    <Link
                                      key={page.id}
                                      href={page.path}
                                      className="flex items-center gap-3 p-2 hover:bg-muted rounded-md transition-colors"
                                      onClick={() => {
                                        setIsSearchFocused(false);
                                        setSearchQuery("");
                                      }}
                                    >
                                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                                        <FileText className="h-4 w-4 text-action" />
                                      </div>
                                      <p className="font-medium">{page.title}</p>
                                    </Link>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* View All Results Button */}
                            <div className="mt-2 pt-2 border-t">
                              <Button
                                variant="outline"
                                className="w-full justify-center"
                                onClick={() => {
                                  router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
                                  setIsSearchFocused(false);
                                  setSearchQuery("");
                                }}
                              >
                                <Search className="h-4 w-4 mr-2" />
                                {fillLabel(itemLabel(searchCopy, "view-all"), {
                                  query: searchQuery,
                                })}
                              </Button>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            className="relative"
            onClick={() => setIsMessagesDrawerOpen(true)}
          >
            <MessageSquare className="h-5 w-5" />
            {unreadMessagesCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                {unreadMessagesCount}
              </span>
            )}
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="relative"
            onClick={() => setIsNotificationsDrawerOpen(true)}
          >
            <Bell className="h-5 w-5" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                {unreadNotificationsCount}
              </span>
            )}
          </Button>

          {/*
            The account row's first chip. On the quiz product it is the wallet balance and it
            opens the quiz dashboard's wallet tab; an alignment visitor has no wallet there, and
            `/dashboard/user` is that product's account home, so their chip is the brand's own
            account route instead (`/settings`, in `lib/nav.ts`'s ALIGNMENT_ROUTES). Both routes
            are session-gated; neither is deleted, and the elevated viewer keeps the wallet word
            for word.
          */}
          {seesQuizProduct(brandId, viewer) ? (
            <Link
              href="/dashboard/user?tab=wallet"
              className="flex items-center gap-2 rounded-full border px-3 py-1.5 max-sm:hidden"
            >
              <span className="text-sm font-medium">
                {formatMetricValue(metric("dashboard.balance"))}
              </span>
              <span className="text-green-500">💰</span>
            </Link>
          ) : (
            <Link
              href="/settings"
              className="flex items-center gap-2 rounded-full border px-3 py-1.5 max-sm:hidden"
            >
              <Settings className="h-4 w-4" />
              <span className="text-sm font-medium">{itemLabel(accountCopy, "settings")}</span>
            </Link>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                {account === null ? (
                  /* Signed out: a neutral disc, not a person. The label says what the slot is
                     for, and the menu it opens offers the only action that exists. */
                  <SignedOutAvatar label={itemLabel(accountCopy, "signed-out")} size={32} />
                ) : (
                  <GeneratedAvatar name={account.name} seed={account.handle} size={32} />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0">
              {/*
                The menu is the session's, not a list with a session-shaped header (#979). A
                signed-out visitor used to get Settings and a destructive **Log out** below the
                "Sign in" row: nothing to log out of, and a control describing a session that did
                not exist. `accountMenu()` decides which rows exist; this file draws them.

                The identity block is a member's only: a visitor's first rows *are* Sign in and
                Sign up, so drawing both would offer the same door twice.
              */}
              {menu.account !== null && (
                <div className="flex flex-col space-y-2 p-4">
                  <div className="flex items-center gap-3">
                    <GeneratedAvatar
                      name={menu.account.name}
                      seed={menu.account.handle}
                      size={64}
                    />
                    <div>
                      <h3 className="text-lg font-semibold">{menu.account.name}</h3>
                      <p className="text-sm text-muted-foreground">{`@${menu.account.handle}`}</p>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <span>{menu.account.email}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {menu.signedIn && <DropdownMenuSeparator />}

              <div className="p-2">
                {menu.rows.map((row) => {
                  const art = ACCOUNT_ROW_ART[row.id];
                  const Icon = art.icon;
                  return (
                    <DropdownMenuItem key={row.id} asChild className="flex gap-3 px-3 py-1.5">
                      <Link href={row.href}>
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-md ${art.ground}`}
                        >
                          <Icon className={`h-4 w-4 ${art.ink}`} />
                        </div>
                        {row.hint === undefined ? (
                          <span>{row.label}</span>
                        ) : (
                          <div className="flex flex-col">
                            <span>{row.label}</span>
                            <span className="text-xs text-muted-foreground">{row.hint}</span>
                          </div>
                        )}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </div>

              {/*
                Log out exists only for a member, and `null` — not a disabled button — is how a
                visitor's menu says there is no session to end.
              */}
              {menu.signOut !== null && (
                <div className="p-4 pt-0">
                  <Button
                    variant="destructive"
                    className="w-full justify-center"
                    onClick={signOut}
                    disabled={signingOut}
                  >
                    <LogOut className="h-4 w-4" />
                    <span>{signingOut ? menu.signOut.pending : menu.signOut.label}</span>
                  </Button>
                  {signOutFailed && (
                    <p className="pt-2 text-sm text-red-600">{menu.signOut.error}</p>
                  )}
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Overlay for both drawers */}
      <div
        className={`fixed inset-0 bg-black/20 z-50 transition-opacity ${isMessagesDrawerOpen || isNotificationsDrawerOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={() => {
          setIsMessagesDrawerOpen(false);
          setIsNotificationsDrawerOpen(false);
        }}
      />

      {/* Messages Drawer */}
      <ChatDrawer
        copy={messagesCopy}
        messages={messages}
        setIsMessagesDrawerOpen={setIsMessagesDrawerOpen}
        isMessagesDrawerOpen={isMessagesDrawerOpen}
        handleMessageClick={handleMessageClick}
      />

      {/* Notifications Drawer */}
      <NotificationDrawer
        copy={notificationsCopy}
        notifications={notifications}
        handleNotificationClick={handleNotificationClick}
        isNotificationsDrawerOpen={isNotificationsDrawerOpen}
        markAllNotificationsAsRead={markAllNotificationsAsRead}
        setIsNotificationsDrawerOpen={setIsNotificationsDrawerOpen}
      />
    </>
  );
}
