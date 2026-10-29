"use client";

import { Search, Grid3X3, List } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { PageCopySection } from "@/content/pages";
import { itemLabel } from "@/lib/page-copy";

interface ExploreHeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  viewMode: "grid" | "list";
  setViewMode: (mode: "grid" | "list") => void;
  copy: PageCopySection;
}

/** The `/explore` header band. The words come from `sectionOf(explorePageCopy, "header")`. */
export function ExploreHeader({
  searchQuery,
  setSearchQuery,
  viewMode,
  setViewMode,
  copy,
}: ExploreHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{copy.heading}</h1>
          <p className="text-muted-foreground mt-1">{copy.body}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={itemLabel(copy, "search-placeholder")}
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center rounded-md border bg-muted/40">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode("grid")}
          >
            <Grid3X3 className="h-4 w-4" />
            <span className="sr-only">{itemLabel(copy, "grid-view")}</span>
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
            <span className="sr-only">{itemLabel(copy, "list-view")}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
