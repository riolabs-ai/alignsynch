"use client";
import { useWindowSize } from "@/hooks/use-window";
import { cn } from "@/lib/utils";
import type { PageCopy } from "@/content/pages";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import {
  Award,
  BookOpen,
  Compass,
  DollarSign,
  FileQuestion,
  Home,
  LifeBuoy,
  Lightbulb,
  LogOut,
  Medal,
  Newspaper,
  PackagePlus,
  Sparkles,
  Swords,
  Trophy,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type React from "react";
import { useSidebar } from "./sidebar-context";

/**
 * The sidebar. Every label resolves an id on `data/pages/shell.ts` (`itemLabel` against
 * the `nav` section); the hrefs stay literal JSX attributes **on purpose** — `data:check`
 * E10 extracts literal `href`s from the tree, so moving them into a const array would take
 * 15 route references out of the link gate without failing anything. Words move into the
 * fixture; destinations stay where the checker can see them.
 */
export function AppSidebar({ copy }: { copy: PageCopy }) {
  const nav = sectionOf(copy, "nav");
  const pathname = usePathname();

  const { collapsed, setCollapsed } = useSidebar();
  const isActive = (path: string) => {
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  return (
    <aside
      className={cn(
        "max-xl:fixed max-xl:top-0 max-xl:left-0 max-xl:h-full xl:sticky top-0 flex h-screen flex-col border-r bg-background transition-all duration-300",
        collapsed ? "w-[250px] xl:w-[70px]" : "w-[250px]",
        collapsed ? "max-xl:-translate-x-full" : "max-xl:translate-x-0",
      )}
    >
      <div
        className={`flex h-16 items-center max-xl:justify-between gap-2 border-b px-4 ${collapsed ? "justify-center" : "justify-between"}`}
      >
        <Link href="/" className="flex justify-center items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          {!collapsed && <span className="text-xl font-bold">{copy.heading}</span>}
        </Link>
        <button className="xl:hidden" onClick={() => setCollapsed(!collapsed)}>
          <X className="size-5" />
        </button>
      </div>

      <div className="flex-1 overflow-auto py-4">
        <nav className="grid gap-1 px-2">
          <NavItem
            href="/"
            icon={<Home className="size-5" />}
            label={itemLabel(nav, "home")}
            active={isActive("/")}
          />
          <NavItem
            href="/daily-challenge"
            icon={<Trophy className="size-5" />}
            label={itemLabel(nav, "daily-challenge")}
            active={isActive("/daily-challenge")}
          />
          <NavItem
            href="/categories"
            icon={<BookOpen className="size-5" />}
            label={itemLabel(nav, "categories")}
            active={isActive("/categories")}
          />
          <NavItem
            href="/battle"
            icon={<Swords className="size-5" />}
            label={itemLabel(nav, "battle")}
            active={isActive("/battle")}
          />
          <NavItem
            href="/news"
            icon={<Newspaper className="size-5" />}
            label={itemLabel(nav, "news")}
            active={isActive("/news")}
          />
          <NavItem
            href="/explore"
            icon={<Compass className="size-5" />}
            label={itemLabel(nav, "explore")}
            active={isActive("/explore")}
          />
          <NavItem
            href="/tournaments"
            icon={<Award className="size-5" />}
            label={itemLabel(nav, "tournaments")}
            active={isActive("/tournaments")}
          />
          <NavItem
            href="/leaderboard"
            icon={<Medal className="size-5" />}
            label={itemLabel(nav, "leaderboard")}
            active={isActive("/leaderboard")}
          />
          <NavItem
            href="/creator-tips"
            icon={<Lightbulb className="size-5" />}
            label={itemLabel(nav, "creator-tips")}
            active={isActive("/creator-tips")}
          />
          <NavItem
            href="/quiz-discussions"
            icon={<FileQuestion className="size-5" />}
            label={itemLabel(nav, "quiz-discussions")}
            active={isActive("/quiz-discussions")}
          />
          <NavItem
            href="/create/editor"
            icon={<PackagePlus className="size-5" />}
            label={itemLabel(nav, "create-editor")}
            active={isActive("/create/editor")}
          />
          <NavItem
            href="/create/generator"
            icon={<Sparkles className="size-5" />}
            label={itemLabel(nav, "create-generator")}
            active={isActive("/create/generator")}
          />
          <NavItem
            href="/affiliate"
            icon={<Users className="size-5" />}
            label={itemLabel(nav, "affiliate")}
            active={isActive("/affiliate")}
          />
          <NavItem
            href="/pricing"
            icon={<DollarSign className="size-5" />}
            label={itemLabel(nav, "pricing")}
            active={isActive("/pricing")}
          />
          <NavItem
            href="/support"
            icon={<LifeBuoy className="size-5" />}
            label={itemLabel(nav, "support")}
            active={isActive("/support")}
          />
        </nav>
      </div>

      <div className="border-t py-4">
        <nav className="grid gap-1 px-2">
          <NavItem
            href="#"
            icon={<LogOut className="size-5" />}
            label={itemLabel(nav, "logout")}
            active={isActive("#")}
          />
        </nav>
      </div>
    </aside>
  );
}

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  nested?: boolean;
}

function NavItem({ href, icon, label, active, nested = false }: NavItemProps) {
  const { collapsed, setCollapsed } = useSidebar();
  const { width } = useWindowSize();
  const handleClick = () => {
    if (width < 1280) {
      setCollapsed(true);
    }
  };
  if (collapsed) {
    return (
      <div className="relative group flex justify-center items-center">
        <Link
          href={href}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-md transition-colors",
            active ? "bg-indigo-500 text-white" : "hover:bg-accent hover:text-accent-foreground",
            nested && "h-6 w-6",
          )}
        >
          {icon}
        </Link>
      </div>
    );
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 xl:py-2.5 text-sm font-medium transition-colors",
        active ? "bg-indigo-500 text-white" : "hover:bg-accent hover:text-accent-foreground",
        nested && "pl-6",
      )}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
