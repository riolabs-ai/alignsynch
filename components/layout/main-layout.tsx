"use client";

import { Header } from "@/components/layout/header";
import { AppSidebar } from "@/components/layout/sidebar";
import { cn } from "@/lib/utils";
import type React from "react";
import { useSidebar } from "./sidebar-context";

export function MainLayout({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();
  return (
    <div className="flex min-h-screen">
      <div className="z-50 relative">
        <AppSidebar />
      </div>
      <div className={cn(collapsed ? "xl:w-[calc(100%-70px)]" : "xl:w-[calc(100%-250px)]", "w-full")}>
        <Header />
        <main className="flex-1 overflow-auto p-3 md:p-4 xxl:p-6">{children}</main>
      </div>
    </div>
  );
}
