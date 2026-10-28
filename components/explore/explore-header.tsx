"use client"

import { Search, Grid3X3, List } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface ExploreHeaderProps {
  searchQuery: string
  setSearchQuery: (query: string) => void
  viewMode: "grid" | "list"
  setViewMode: (mode: "grid" | "list") => void
}

export function ExploreHeader({ searchQuery, setSearchQuery, viewMode, setViewMode }: ExploreHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Explore Quizzes</h1>
          <p className="text-muted-foreground mt-1">Discover and play quizzes from our community</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search quizzes by title, category, or creator..."
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
            <span className="sr-only">Grid view</span>
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
            <span className="sr-only">List view</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
