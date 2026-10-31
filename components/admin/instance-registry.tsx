"use client";

/**
 * `/admin/instances` — the filterable record registry (console-ia §3.5, card 3/5).
 *
 * **The template it copies, and the axes it varies.** This is `components/my-quizzes/my-quizzes.tsx`
 * in its list shape, composed with `components/ui/table.tsx` and the filter row the leaderboard
 * screen draws (`components/leaderboard/leaderboard-filters.tsx`):
 *
 *   my-quizzes                    this registry
 *   ----------------------------  ------------------------------------------------
 *   tab row: Active/Draft/…       tab row: the four relationship stages + All
 *   status select                 two selects: mode, Setting
 *   search field                  a "stalled only" toggle (no text search: an operator
 *                                 triages by state, not by a title they half-remember)
 *   grid/list toggle              dropped — a registry is a table or it is nothing
 *   per-row dropdown actions      dropped — this card is read-and-filter; acting on
 *                                 somebody's relationship is its own card and its own
 *                                 confirmation design
 *   grid of cards                 `Table`/`TableHeader`/`TableRow`/`TableCell`
 *
 * Every filter is **client-side over the already-read list** — the read is one statement
 * (`lib/db/admin-instances.ts`) and a filter must not become a second query. That also means the
 * count line and the table are the same `filterRegistry()` call, so they cannot disagree.
 *
 * **What this component is not allowed to render.** It draws a seat's *state*, the mode, the
 * Setting and the derived stage. It has no prop, no helper and no field through which a score, a
 * Gap or an answered count could reach the DOM: `AdminInstanceRow` is the whole of the data, and
 * it carries none of those (see `lib/admin/instance-registry.ts`). A later "operators need the
 * answers" screen starts by widening that type, which is a decision somebody has to make in a
 * diff rather than a column somebody adds here.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/content/core";
import type { PageCopy, PageCopySection } from "@/content/pages";
import {
  type AdminInstanceRow,
  filterRegistry,
  MODE_OPTIONS,
  NO_FILTER,
  REGISTRY_LABELS,
  type RegistryFilter,
  SETTING_OPTIONS,
  STAGE_TABS,
  type SeatRow,
} from "@/lib/admin/instance-registry";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import { useState } from "react";

/** The badge tone a seat's state gets: an account is good, an expired invitation is not. */
const SEAT_VARIANT: Record<SeatRow["state"], "success" | "secondary" | "outline" | "destructive"> =
  {
    claimed: "success",
    seat: "secondary",
    invited: "outline",
    expired: "destructive",
    none: "outline",
  };

/** The stage's tone, in ladder order — never a colour a reader could read as a measure. */
const STAGE_VARIANT: Record<AdminInstanceRow["stage"], "secondary" | "outline" | "success"> = {
  invited: "outline",
  connected: "secondary",
  sharing: "secondary",
  aligned: "success",
};

function seatLabel(section: PageCopySection, seat: SeatRow): string {
  if (seat.state === "none") return itemLabel(section, "none");
  return itemLabel(section, seat.state);
}

/** One seat cell: the state, and the name only when the seat itself carries one. */
function SeatCell({
  seat,
  seatCopy,
  unnamed,
}: {
  seat: SeatRow;
  seatCopy: PageCopySection;
  unnamed: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Badge variant={SEAT_VARIANT[seat.state]} className="w-fit">
        {seatLabel(seatCopy, seat)}
      </Badge>
      {seat.name === null ? (
        <span className="text-xs text-muted-foreground">{unnamed}</span>
      ) : (
        <span className="text-sm">{seat.name}</span>
      )}
    </div>
  );
}

export function InstanceRegistry({
  copy,
  rows,
  unreadable,
}: {
  copy: PageCopy;
  /** Every row the reader may see, newest first. Already bounded by role at the page's gate. */
  rows: readonly AdminInstanceRow[];
  /** `DatabaseUnavailableError.reason` when the read failed; `null` on a normal visit. */
  unreadable: string | null;
}) {
  const [filter, setFilter] = useState<RegistryFilter>(NO_FILTER);

  const columns = sectionOf(copy, "columns");
  const seatCopy = sectionOf(copy, "seat");
  const stageCopy = sectionOf(copy, "stage-filter");
  const filtersCopy = sectionOf(copy, "filters");
  const listCopy = sectionOf(copy, "list");

  const visible = filterRegistry(rows, filter);
  const unnamed = itemLabel(seatCopy, "unnamed");

  const summary = fillLabel(itemLabel(sectionOf(copy, "summary"), "count"), {
    shown: visible.length,
    total: rows.length,
  });

  /** One axis at a time, so a caller never has to restate the whole filter it is not changing. */
  const setAxis = <K extends keyof RegistryFilter>(axis: K, value: RegistryFilter[K]) =>
    setFilter((current) => ({ ...current, [axis]: value }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{copy.heading}</h1>
        {copy.subtitle === undefined ? null : (
          <p className="text-muted-foreground mt-1 max-w-3xl">{copy.subtitle}</p>
        )}
      </div>

      {unreadable === null ? null : (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>{sectionOf(copy, "unreadable").heading ?? copy.heading}</CardTitle>
            <CardDescription>{sectionBody(sectionOf(copy, "unreadable"))}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-mono">{unreadable}</p>
          </CardContent>
        </Card>
      )}

      {unreadable === null && (
        <>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={filter.mode}
                onValueChange={(value) => setAxis("mode", value as RegistryFilter["mode"])}
              >
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder={itemLabel(filtersCopy, "mode-all")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>{itemLabel(columns, "mode")}</SelectLabel>
                    <SelectItem value="all">{itemLabel(filtersCopy, "mode-all")}</SelectItem>
                    {MODE_OPTIONS.map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {REGISTRY_LABELS.mode[mode]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select
                value={filter.setting}
                onValueChange={(value) => setAxis("setting", value as RegistryFilter["setting"])}
              >
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder={itemLabel(filtersCopy, "setting-all")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>{itemLabel(columns, "setting")}</SelectLabel>
                    <SelectItem value="all">{itemLabel(filtersCopy, "setting-all")}</SelectItem>
                    {SETTING_OPTIONS.map((setting) => (
                      <SelectItem key={setting} value={setting}>
                        {REGISTRY_LABELS.setting[setting]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant={filter.stalled ? "default" : "outline"}
                aria-pressed={filter.stalled}
                title={itemLabel(filtersCopy, "stalled-body")}
                onClick={() => setAxis("stalled", !filter.stalled)}
              >
                {itemLabel(filtersCopy, "stalled")}
              </Button>
            </div>

            <p className="text-sm text-muted-foreground" aria-live="polite">
              {summary}
            </p>
          </div>

          <Tabs
            value={filter.stage}
            onValueChange={(value) => setAxis("stage", value as RegistryFilter["stage"])}
          >
            <TabsList>
              {STAGE_TABS.map((stage) => (
                <TabsTrigger key={stage} value={stage}>
                  {itemLabel(stageCopy, stage)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {rows.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>{sectionOf(copy, "empty-all").heading ?? copy.heading}</CardTitle>
                <CardDescription>{sectionBody(sectionOf(copy, "empty-all"))}</CardDescription>
              </CardHeader>
            </Card>
          ) : visible.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>{sectionOf(copy, "empty").heading ?? copy.heading}</CardTitle>
                <CardDescription>{sectionBody(sectionOf(copy, "empty"))}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button type="button" variant="outline" onClick={() => setFilter(NO_FILTER)}>
                  {itemLabel(sectionOf(copy, "empty"), "clear")}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{itemLabel(columns, "id")}</TableHead>
                    <TableHead>{itemLabel(columns, "template")}</TableHead>
                    <TableHead>{itemLabel(columns, "initiator")}</TableHead>
                    <TableHead>{itemLabel(columns, "counterparty")}</TableHead>
                    <TableHead>{itemLabel(columns, "mode")}</TableHead>
                    <TableHead>{itemLabel(columns, "setting")}</TableHead>
                    <TableHead>{itemLabel(columns, "stage")}</TableHead>
                    <TableHead>{itemLabel(columns, "created")}</TableHead>
                    <TableHead>{itemLabel(columns, "last-activity")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((row) => (
                    <TableRow key={row.instanceRecordId}>
                      <TableCell className="font-mono text-xs">
                        <span className="block">{row.slug}</span>
                        <span className="block text-muted-foreground">{row.instanceRecordId}</span>
                      </TableCell>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>
                        <SeatCell seat={row.initiator} seatCopy={seatCopy} unnamed={unnamed} />
                      </TableCell>
                      <TableCell>
                        <SeatCell seat={row.counterparty} seatCopy={seatCopy} unnamed={unnamed} />
                      </TableCell>
                      <TableCell>{REGISTRY_LABELS.mode[row.mode]}</TableCell>
                      <TableCell>{REGISTRY_LABELS.setting[row.setting]}</TableCell>
                      <TableCell>
                        <Badge variant={STAGE_VARIANT[row.stage]}>
                          {REGISTRY_LABELS.stage[row.stage]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(row.created)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(row.lastActivity)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <p className="text-xs text-muted-foreground">{sectionBody(listCopy)}</p>
        </>
      )}
    </div>
  );
}
