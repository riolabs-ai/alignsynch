"use client";
import { GeneratedAvatar } from "@/components/media/generated-avatar";
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
import { type NavViewer, seesQuizProduct } from "@/lib/nav";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";
import { searchSectionFor } from "@/lib/shell-copy";
import {
  Bell,
  FileQuestion,
  FileText,
  LogOut,
  Mail,
  Menu,
  MessageCircleQuestion,
  MessageSquare,
  PanelLeftClose,
  PanelRightClose,
  Search,
  Settings,
  Tag,
  TrendingUp,
  User,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import ChatDrawer from "../header/ChatDrawer";
import NotificationDrawer from "../header/NotificationDrawer";
import { Badge } from "../ui/badge";
import { useSidebar } from "./sidebar-context";

export function Header({
  copy,
  brandId,
  viewer,
  searchIndex,
}: {
  copy: PageCopy;
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
  /** The brand's own search catalog, built on the server (`data/searchdata.ts`). */
  searchIndex: SearchIndex;
}) {
  // The shell's copy, resolved here rather than in each band: `data/pages/shell.ts`
  // owns the words, this file owns which ids it renders. A renamed id is a red build
  // (E23) and a blank header would be the alternative.
  const searchCopy = searchSectionFor(copy, brandId);
  const accountCopy = sectionOf(copy, "account");
  const notificationsCopy = sectionOf(copy, "notifications");
  const messagesCopy = sectionOf(copy, "messages");

  /**
   * The drawers' content for this brand (`data/chat-data.ts`, `data/notifications.ts`). Both
   * fixtures are the quiz product's; the alignment build has nothing behind either drawer, so it
   * gets empty lists and the drawers draw their own empty states instead of another product's
   * conversations and badges (issue #156 follow-up).
   */
  const messages = recentMessagesFor(brandId);
  const notifications = notificationsFor(brandId);

  const pathname = usePathname();
  const router = useRouter();
  const { toggleCollapsed, collapsed, toggleMobile, mobileOpen } = useSidebar();
  const [isMessagesDrawerOpen, setIsMessagesDrawerOpen] = useState(false);
  const [isNotificationsDrawerOpen, setIsNotificationsDrawerOpen] = useState(false);

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

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4 md:px-6">
        <div className="flex items-center gap-4">
          {/* Two toggles, one per layout: below `xl` the sidebar is an overlay drawer, so
              this opens it; at `xl` and up it is the rail collapse that has always been
              here. Both are `size="icon"` buttons at the same position, so the desktop
              header is unchanged. */}
          <Button
            variant="ghost"
            size="icon"
            className="xl:hidden"
            onClick={toggleMobile}
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
            aria-controls="app-sidebar"
          >
            <Menu className="!text-3xl" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden xl:inline-flex"
            onClick={toggleCollapsed}
          >
            {collapsed ? (
              <PanelRightClose className="!text-3xl" />
            ) : (
              <PanelLeftClose className="!text-3xl" />
            )}
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
                                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-purple-100">
                                    <FileText className="h-4 w-4 text-purple-600" />
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
                            {fillLabel(itemLabel(searchCopy, "view-all"), { query: searchQuery })}
                          </Button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
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
                <GeneratedAvatar
                  name={itemLabel(accountCopy, "display-name")}
                  seed={itemLabel(accountCopy, "display-handle")}
                  size={32}
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0">
              <div className="flex flex-col space-y-2 p-4">
                <div className="flex items-center gap-3">
                  <GeneratedAvatar
                    name={itemLabel(accountCopy, "display-name")}
                    seed={itemLabel(accountCopy, "display-handle")}
                    size={64}
                  />
                  <div>
                    <h3 className="text-lg font-semibold">
                      {itemLabel(accountCopy, "display-name")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {itemLabel(accountCopy, "display-handle")}
                    </p>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      <span>{itemLabel(accountCopy, "display-email")}</span>
                    </div>
                  </div>
                </div>
              </div>

              <DropdownMenuSeparator />

              <div className="p-2">
                {/*
                  The account menu's three quiz rows: the demo creator's profile, the quiz
                  dashboard and the quiz author's own list. They are the quiz product's
                  destinations, so an alignment visitor does not get them — the Settings row
                  below stays on both brands, because a preference page is an account action
                  rather than a product surface.
                */}
                {seesQuizProduct(brandId, viewer) && (
                  <>
                    <DropdownMenuItem asChild className="flex gap-3 px-3 py-1.5">
                      <Link href="/profile/alexjohnson">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-100">
                          <User className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex flex-col">
                          <span>{itemLabel(accountCopy, "profile")}</span>
                          <span className="text-xs text-muted-foreground">
                            {itemLabel(accountCopy, "profile-hint")}
                          </span>
                        </div>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="flex gap-3 px-3 py-1.5">
                      <Link href="/dashboard/user">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-purple-100">
                          <TrendingUp className="h-4 w-4 text-purple-600" />
                        </div>
                        <div className="flex flex-col">
                          <span>{itemLabel(accountCopy, "dashboard")}</span>
                          <span className="text-xs text-muted-foreground">
                            {itemLabel(accountCopy, "dashboard-hint")}
                          </span>
                        </div>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="flex gap-3 px-3 py-1.5">
                      <Link href="/my-quizzes">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-100">
                          <MessageCircleQuestion className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex flex-col">
                          <span>{itemLabel(accountCopy, "quizzes")}</span>
                          <span className="text-xs text-muted-foreground">
                            {itemLabel(accountCopy, "quizzes-hint")}
                          </span>
                        </div>
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}

                <DropdownMenuItem asChild className="flex gap-3 px-3 py-1.5">
                  <Link href="/settings">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100">
                      <Settings className="h-4 w-4 text-gray-600" />
                    </div>
                    <div className="flex flex-col">
                      <span>{itemLabel(accountCopy, "settings")}</span>
                      <span className="text-xs text-muted-foreground">
                        {itemLabel(accountCopy, "settings-hint")}
                      </span>
                    </div>
                  </Link>
                </DropdownMenuItem>
              </div>

              <div className="p-4 pt-0">
                <Button variant="destructive" className="w-full justify-center" asChild>
                  <Link href="/login" className="flex items-center gap-2">
                    <LogOut className="h-4 w-4" />
                    <span>{itemLabel(accountCopy, "logout")}</span>
                  </Link>
                </Button>
              </div>
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
