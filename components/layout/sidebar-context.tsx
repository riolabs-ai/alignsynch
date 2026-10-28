"use client";

import { useWindowSize } from "@/hooks/use-window";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type SidebarContextType = {
  collapsed: boolean;
  toggleCollapsed: () => void;
  setCollapsed: (collapsed: boolean) => void;
};

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const { width } = useWindowSize();
  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
  };
  useEffect(() => {
    if (width && width < 1280) {
      setCollapsed(true);
    } else {
      setCollapsed(false);
    }
  }, [width]);
  return <SidebarContext.Provider value={{ collapsed, toggleCollapsed, setCollapsed }}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
