"use client";
import { cn } from "@/lib/utils";
import type { PageCopy } from "@/content/pages";
import type { BrandMark } from "@/lib/brand-mark";
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
import Image from "next/image";
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
export function AppSidebar({ copy, mark }: { copy: PageCopy; mark?: BrandMark }) {
  const nav = sectionOf(copy, "nav");
  const pathname = usePathname();

  const { collapsed, mobileOpen, closeMobile } = useSidebar();
  const isActive = (path: string) => {
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  /**
   * Closed is the CSS default below `xl` — off-canvas *and* `invisible` — so nothing
   * bleeds through before hydration and the panel's links leave the tab order while it is
   * dismissed; only `mobileOpen` slides it in. Desktop (`xl:`) is untouched by both
   * classes, so the rail keeps its 250px/70px behaviour.
   */
  return (
    <aside
      id="app-sidebar"
      className={cn(
        "max-xl:fixed max-xl:top-0 max-xl:left-0 max-xl:h-full xl:sticky top-0 flex h-screen flex-col border-r bg-background transition-all duration-300",
        collapsed ? "w-[250px] xl:w-[70px]" : "w-[250px]",
        mobileOpen
          ? "max-xl:visible max-xl:translate-x-0 max-xl:shadow-2xl"
          : "max-xl:invisible max-xl:-translate-x-full",
      )}
    >
      <div
        className={`flex h-16 items-center max-xl:justify-between gap-2 border-b px-4 ${collapsed ? "justify-center" : "justify-between"}`}
      >
        <Link
          href="/"
          aria-label={mark ? copy.heading : undefined}
          className="flex justify-center items-center gap-2"
        >
          {mark ? (
            /**
             * The brand's mark, cropped out of its lockup.
             *
             * `as2-logo_v2_cl.png` is one 818×127 file: the AS monogram in the first ~175
             * columns, then the wordmark. Its wordmark is black "Align" beside gray
             * "Synch", so on this near-black rail the black half is invisible and drawing
             * the whole lockup would leave a ghost "Synch" floating right of the mark. The
             * shell therefore draws the *mark* — the file at its natural height in a 40 px
             * window (`h-7 w-10`), the rest clipped — and sets the full name in type beside
             * it, which is what the brand asks for: the logo carries the motif, the record
             * carries the name. `max-w-none` is load-bearing: Tailwind's preflight would
             * otherwise cap the image at its 40 px container and scale it down instead of
             * cropping it.
             *
             * `alt=""` because the wordmark beside it already says the name — a second
             * description would make a screen reader read the brand twice — and the link
             * carries `aria-label` so it still has a name when the rail is collapsed.
             */
            <span className="block h-7 w-10 shrink-0 overflow-hidden">
              <Image
                src={mark.src}
                alt=""
                width={mark.width}
                height={mark.height}
                className="h-7 w-auto max-w-none"
                priority
              />
            </span>
          ) : (
            <BookOpen className="h-6 w-6 text-primary" />
          )}
          {!collapsed && <span className="text-xl font-bold">{copy.heading}</span>}
        </Link>
        <button
          type="button"
          className="xl:hidden"
          onClick={closeMobile}
          aria-label="Close navigation"
        >
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
  const { collapsed, closeMobile } = useSidebar();
  if (collapsed) {
    return (
      <div className="relative group flex justify-center items-center">
        <Link
          href={href}
          onClick={closeMobile}
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
      onClick={closeMobile}
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
