"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { recentMessages } from "@/data/chat-data";
import { notifications } from "@/data/notifications";
import { mockSearchData } from "@/data/searchdata";
import { Bell, FileQuestion, FileText, LogOut, Mail, MessageCircleQuestion, MessageSquare, Moon, PanelLeftClose, PanelRightClose, Search, Settings, Tag, TrendingUp, User, Users } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import ChatDrawer from "../header/ChatDrawer";
import NotificationDrawer from "../header/NotificationDrawer";
import { ThemeToggle } from "../header/ThemeToggle";
import { Badge } from "../ui/badge";
import { useSidebar } from "./sidebar-context";

export function Header() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const { toggleCollapsed, collapsed } = useSidebar();
  const [isMessagesDrawerOpen, setIsMessagesDrawerOpen] = useState(false);
  const [isNotificationsDrawerOpen, setIsNotificationsDrawerOpen] = useState(false);

  // Add useState for search functionality
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const searchResultsRef = React.useRef<HTMLDivElement>(null);

  // Add search filter function
  const getFilteredResults = () => {
    if (!searchQuery.trim()) return { quizzes: [], categories: [], creators: [], pages: [] };

    const query = searchQuery.toLowerCase().trim();

    return {
      quizzes: mockSearchData.quizzes.filter((quiz) => quiz.title.toLowerCase().includes(query) || quiz.category.toLowerCase().includes(query)).slice(0, 4),
      categories: mockSearchData.categories.filter((category) => category.name.toLowerCase().includes(query)).slice(0, 3),
      creators: mockSearchData.creators.filter((creator) => creator.name.toLowerCase().includes(query) || creator.username.toLowerCase().includes(query)).slice(0, 3),
      pages: mockSearchData.pages.filter((page) => page.title.toLowerCase().includes(query)).slice(0, 3),
    };
  };

  // Add click outside handler to close search results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchResultsRef.current && !searchResultsRef.current.contains(event.target as Node) && searchInputRef.current && !searchInputRef.current.contains(event.target as Node)) {
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
  const unreadMessagesCount = recentMessages.filter((m) => m.unread).length;

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
          <Button variant="ghost" size="icon" onClick={toggleCollapsed}>
            {collapsed ? <PanelRightClose className="!text-3xl" /> : <PanelLeftClose className="!text-3xl" />}
          </Button>

          <div className="relative w-full md:w-64 lg:w-80 xl:w-96 max-md:hidden">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input ref={searchInputRef} type="search" placeholder="Search quizzes, categories, creators..." className="w-full rounded-md border-0 bg-muted pl-8 focus-visible:ring-0 focus-visible:ring-offset-0" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onFocus={() => setIsSearchFocused(true)} />

            {/* Search Results Dropdown */}
            {isSearchFocused && (
              <div ref={searchResultsRef} className="absolute top-full left-0 w-full mt-1 p-2 bg-background rounded-md border shadow-lg z-50 max-h-[80vh] overflow-auto">
                {!searchQuery.trim() ? (
                  <div className="p-4 text-center text-muted-foreground">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Type to search for quizzes, categories, creators, and more...</p>
                  </div>
                ) : (
                  <>
                    {Object.entries(getFilteredResults()).every(([_, items]) => items.length === 0) ? (
                      <div className="p-4 text-center text-muted-foreground">
                        <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No results found for "{searchQuery}"</p>
                        <p className="text-sm mt-1">Try different keywords or check spelling</p>
                      </div>
                    ) : (
                      <>
                        {/* Quizzes */}
                        {getFilteredResults().quizzes.length > 0 && (
                          <div className="mb-4">
                            <div className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted-foreground">
                              <FileQuestion className="h-4 w-4" />
                              <span>Quizzes</span>
                            </div>
                            <div className="mt-1">
                              {getFilteredResults().quizzes.map((quiz) => (
                                <Link
                                  key={quiz.id}
                                  href={`/quiz/${quiz.id}`}
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
                                        {quiz.category}
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
                        {getFilteredResults().categories.length > 0 && (
                          <div className="mb-4">
                            <div className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted-foreground">
                              <Tag className="h-4 w-4" />
                              <span>Categories</span>
                            </div>
                            <div className="mt-1">
                              {getFilteredResults().categories.map((category) => (
                                <Link
                                  key={category.id}
                                  href={`/categories/${category.name.toLowerCase().replace(/\s+/g, "-")}`}
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
                                    {category.quizCount} quizzes
                                  </Badge>
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Creators */}
                        {getFilteredResults().creators.length > 0 && (
                          <div className="mb-4">
                            <div className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted-foreground">
                              <Users className="h-4 w-4" />
                              <span>Creators</span>
                            </div>
                            <div className="mt-1">
                              {getFilteredResults().creators.map((creator) => (
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
                                    <p className="text-xs text-muted-foreground">@{creator.username}</p>
                                  </div>
                                  <Badge variant="outline" className="text-xs font-normal">
                                    {creator.quizCount} quizzes
                                  </Badge>
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Pages */}
                        {getFilteredResults().pages.length > 0 && (
                          <div className="mb-2">
                            <div className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted-foreground">
                              <FileText className="h-4 w-4" />
                              <span>Pages</span>
                            </div>
                            <div className="mt-1">
                              {getFilteredResults().pages.map((page) => (
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
                            View all results for "{searchQuery}"
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
          <Button variant="outline" size="icon" className="relative" onClick={() => setIsMessagesDrawerOpen(true)}>
            <MessageSquare className="h-5 w-5" />
            {unreadMessagesCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">{unreadMessagesCount}</span>}
          </Button>

          <Button variant="outline" size="icon" className="relative" onClick={() => setIsNotificationsDrawerOpen(true)}>
            <Bell className="h-5 w-5" />
            {unreadNotificationsCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">{unreadNotificationsCount}</span>}
          </Button>

          <ThemeToggle />

          <Link href="/dashboard/user?tab=wallet" className="flex items-center gap-2 rounded-full border px-3 py-1.5 max-sm:hidden">
            <span className="text-sm font-medium">$124.50</span>
            <span className="text-green-500">💰</span>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="/avatars/brain.png" alt="User" />
                  <AvatarFallback>JD</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0">
              <div className="flex flex-col space-y-2 p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src="/avatars/brain.png" alt="User" />
                    <AvatarFallback>JD</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-lg font-semibold">Jonathan Doe</h3>
                    <p className="text-sm text-muted-foreground">@johndoe</p>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      <span>info@quizhub.com</span>
                    </div>
                  </div>
                </div>
              </div>

              <DropdownMenuSeparator />

              <div className="p-2">
                <DropdownMenuItem asChild className="flex gap-3 px-3 py-1.5">
                  <Link href="/profile/alexjohnson">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-100">
                      <User className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex flex-col">
                      <span>My Profile</span>
                      <span className="text-xs text-muted-foreground">Account settings</span>
                    </div>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="flex gap-3 px-3 py-1.5">
                  <Link href="/dashboard/user">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-purple-100">
                      <TrendingUp className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="flex flex-col">
                      <span>Dashboard</span>
                      <span className="text-xs text-muted-foreground">Your activity and stats</span>
                    </div>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="flex gap-3 px-3 py-1.5">
                  <Link href="/my-quizzes">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-100">
                      <MessageCircleQuestion className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex flex-col">
                      <span>My Quizes</span>
                      <span className="text-xs text-muted-foreground">Your created quizes</span>
                    </div>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild className="flex gap-3 px-3 py-1.5">
                  <Link href="/settings">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100">
                      <Settings className="h-4 w-4 text-gray-600" />
                    </div>
                    <div className="flex flex-col">
                      <span>Settings</span>
                      <span className="text-xs text-muted-foreground">Preferences</span>
                    </div>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem className="flex items-center justify-between p-3">
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-purple-100">
                      <Moon className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="flex flex-col">
                      <span>Dark Mode</span>
                      <span className="text-xs text-muted-foreground">Toggle theme</span>
                    </div>
                  </div>
                  <Switch checked={theme === "dark"} onCheckedChange={() => setTheme(theme === "dark" ? "light" : "dark")} />
                </DropdownMenuItem>
              </div>

              <div className="p-4 pt-0">
                <Button variant="destructive" className="w-full justify-center" asChild>
                  <Link href="/login" className="flex items-center gap-2">
                    <LogOut className="h-4 w-4" />
                    <span>Log out</span>
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
      <ChatDrawer setIsMessagesDrawerOpen={setIsMessagesDrawerOpen} isMessagesDrawerOpen={isMessagesDrawerOpen} handleMessageClick={handleMessageClick} />

      {/* Notifications Drawer */}
      <NotificationDrawer handleNotificationClick={handleNotificationClick} isNotificationsDrawerOpen={isNotificationsDrawerOpen} markAllNotificationsAsRead={markAllNotificationsAsRead} setIsNotificationsDrawerOpen={setIsNotificationsDrawerOpen} />
    </>
  );
}
