"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface TournamentFiltersProps {
  activeFilter: string
  setActiveFilter: (filter: string) => void
}

export function TournamentFilters({ activeFilter, setActiveFilter }: TournamentFiltersProps) {
  return (
    <div className="flex items-center space-x-4">
      <Select value={activeFilter} onValueChange={setActiveFilter}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Filter tournaments" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Tournaments</SelectItem>
          <SelectItem value="upcoming">Upcoming</SelectItem>
          <SelectItem value="ongoing">Ongoing</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="registration">Registration Open</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
