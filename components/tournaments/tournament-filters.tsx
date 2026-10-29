"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PageCopySection } from "@/content/pages";
import { itemLabel } from "@/lib/page-copy";

/** The statuses a tournament can be filtered by: the view owns the values, the fixture the words. */
const FILTERS = [
  { id: "filter-all", value: "all" },
  { id: "filter-upcoming", value: "upcoming" },
  { id: "filter-ongoing", value: "ongoing" },
  { id: "filter-completed", value: "completed" },
  { id: "filter-registration", value: "registration" },
] as const;

interface TournamentFiltersProps {
  activeFilter: string;
  setActiveFilter: (filter: string) => void;
  copy: PageCopySection;
}

export function TournamentFilters({ activeFilter, setActiveFilter, copy }: TournamentFiltersProps) {
  return (
    <div className="flex items-center space-x-4">
      <Select value={activeFilter} onValueChange={setActiveFilter}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder={itemLabel(copy, "filter-placeholder")} />
        </SelectTrigger>
        <SelectContent>
          {FILTERS.map((filter) => (
            <SelectItem key={filter.value} value={filter.value}>
              {itemLabel(copy, filter.id)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
