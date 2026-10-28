"use client";

import type React from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { BarChart3, BookOpen, ChevronDown, Compass, DollarSign, Home, LayoutDashboard, LogOut, PlusCircle, Settings, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "./sidebar-context";

export function AppSidebar() {
  const pathname = usePathname();
  const { collapsed } = useSidebar();

  const isActive = (path: string) => {
    return pathname === path;
  };

  return (
    <aside className={cn("sticky top-0 flex h-screen flex-col border-r bg-background transition-all duration-300", collapsed ? "w-[70px]" : "w-[250px]")}>
      <div className="flex h-16 items-center justify-center border-b px-4">
        <Link href="/" className="flex items-center space-x-2">
          <BookOpen className="h-6 w-6 text-primary" />
          {!collapsed && <span className="text-xl font-bold">QuizHub</span>}
        </Link>
      </div>

      <div className="flex-1 overflow-auto py-4">
        <nav className="grid gap-1 px-2">
          <NavItem href="/dashboard" icon={<LayoutDashboard className="h-5 w-5" />} label="Dashboard" active={isActive("/dashboard")} />
          <NavItem href="/my-quizzes" icon={<Home className="h-5 w-5" />} label="My Quizzes" active={isActive("/my-quizzes")} />
          <NavItem href="/explore" icon={<Compass className="h-5 w-5" />} label="Explore Quizzes" active={isActive("/explore")} />

          <Collapsible>
            <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
              <div className="flex items-center gap-3">
                <PlusCircle className="h-5 w-5" />
                {!collapsed && <span>Create Quiz</span>}
              </div>
              {!collapsed && <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className={cn("grid gap-1", collapsed ? "pl-0" : "pl-6")}>
                <NavItem href="/create/editor" icon={<div className="h-1 w-1 rounded-full bg-current" />} label="Editor" active={isActive("/create/editor")} nested />
                <NavItem href="/create/generator" icon={<div className="h-1 w-1 rounded-full bg-current" />} label="Generator" active={isActive("/create/generator")} nested />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <NavItem href="/categories" icon={<BookOpen className="h-5 w-5" />} label="Categories" active={isActive("/categories")} />
          <NavItem href="/leaderboard" icon={<Trophy className="h-5 w-5" />} label="Leaderboard" active={isActive("/leaderboard")} />
          <NavItem href="/affiliate" icon={<Users className="h-5 w-5" />} label="Affiliate Page" active={isActive("/affiliate")} />
          <NavItem href="/pricing" icon={<DollarSign className="h-5 w-5" />} label="Pricing Plan" active={isActive("/pricing")} />
          <NavItem href="/earnings" icon={<DollarSign className="h-5 w-5" />} label="Earnings & Wallet" active={isActive("/earnings")} />
          <NavItem href="/analytics" icon={<BarChart3 className="h-5 w-5" />} label="Results & Analytics" active={isActive("/analytics")} />
          <NavItem href="/settings" icon={<Settings className="h-5 w-5" />} label="Account Settings" active={isActive("/settings")} />
        </nav>
      </div>

      <div className="border-t py-4">
        <nav className="grid gap-1 px-2">
          <NavItem href="#" icon={<LogOut className="h-5 w-5" />} label="Logout" active={isActive("#")} />
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
  const { collapsed } = useSidebar();

  if (collapsed) {
    return (
      <div className="relative group">
        <Link href={href} className={cn("flex h-10 w-10 items-center justify-center rounded-md transition-colors", active ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground", nested && "h-6 w-6")}>
          {icon}
        </Link>
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 rounded bg-popover text-popover-foreground text-sm font-medium opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[100] shadow-md border whitespace-nowrap">{label}</div>
      </div>
    );
  }

  return (
    <Link href={href} className={cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors", active ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground", nested && "pl-6")}>
      <span>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
