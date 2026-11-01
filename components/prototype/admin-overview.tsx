/**
 * `/prototype/admin` — the admin overview (#console cohort 1).
 *
 * ## Which existing files this is a variation of (guardrail #336)
 *
 * Nothing on this screen is new visual work. Three chains, each rooted in a file that already ships:
 *
 *   1. **the header and the counts** — `components/identity/account-home.tsx` (the identity header:
 *      `container mx-auto max-w-4xl space-y-6`, then a header row with a large `h1` and a subtitle)
 *      → `components/console/overview.tsx` (that header without the avatar, over a four-card grid)
 *      → `components/console/stat-card-grid.tsx` and `components/dashboard/dashboard-overview.tsx`
 *      below it (the quiz dashboard's card anatomy: `Card` + title with an icon opposite + one figure
 *      + one caption line, `grid gap-4 md:grid-cols-2 lg:grid-cols-4`). This screen is the third
 *      expression of that arrangement.
 *   2. **the "needs attention" table** — `components/my-quizzes/my-quizzes.tsx` (the list of records
 *      as rows) → `components/admin/instance-registry.tsx` (the same list as a `Table` with stage
 *      `Badge`s and a seat cell) → this band. Same `components/ui/table.tsx`, same badge tones.
 *   3. **the "built in a later cohort" table** — chain 2 again, with one `Badge` for the status.
 *
 * The screen an operator lands on before drilling into `/admin/instances` or `/admin/gaps`. Three
 * bands:
 *
 *   1. **the header and the counts** are `components/console/overview.tsx`: an `h1` with a subtitle
 *      over a four-card grid of `<Card>`s, a title with an icon opposite it, one large figure and one
 *      caption line beneath (`components/console/stat-card-grid.tsx`'s anatomy to the letter).
 *      **What varies:** the cards are not links. `StatCard.href` is required by design ("a total with
 *      no list behind it is exactly the kind of number the console exists to stop printing"), and
 *      the lists these four counts open are cohort 2's `/prototype/relationships` and cohort 4's
 *      `/prototype/admin/gaps`, which do not render yet. A link here would be a 404 dressed as a
 *      count, so the band is written from `components/ui/card.tsx` in the grid's own column rhythm
 *      and the destinations are named as text in the third band. Also gone: the identity header's
 *      avatar, because there is no viewer record in the fixture — the screen names the population
 *      instead of greeting a person.
 *   2. **the "needs attention" table** is `components/admin/instance-registry.tsx`: the same
 *      `components/ui/table.tsx` row, the same `Badge` tones for a stage (ladder order, never a
 *      colour a reader could read as a measure), and the same seat cell — a state badge with the
 *      seat's own name under it, or the "unnamed" line when the seat carries none.
 *   3. **the "built in a later cohort" table** is the same `Table` again, with a `Badge` for the
 *      status. The two rows are text: the prototype routes they name are not mounted yet, and this
 *      screen may not hand out a link it cannot answer.
 *
 * **What this component may not render.** Every figure arrives as a `number` in `CountFigures`, and
 * the rows arrive as `AttentionRow`s — the columns the table draws, and nothing else. There is no
 * prop through which an opinion, an answer or a Gap could reach the DOM, which is the blind rule in
 * an operator's hands: a stalled relationship is a fact about a seat, never about what either party
 * wrote.
 *
 * No `"use client"`: props in, markup out, no hydration payload. Every string is
 * `data/pages/prototype-console.ts` (E23 budget 0) — the file holds none.
 */
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PageCopy } from "@/content/pages";
import { fillLabel, itemLabel, itemValue, sectionBody, sectionOf } from "@/lib/page-copy";
import { CheckCircle2, LayoutTemplate, MailWarning, Users } from "lucide-react";
import type React from "react";

/**
 * The seat and stage vocabularies, declared here rather than imported from
 * `data/prototypes/console.ts`: a type import is still an import-graph edge, and the registry walks
 * that edge to decide whether this domain reads a fixture. It renders props, so it does not.
 */
export type PrototypeStage = "invited" | "connected" | "sharing" | "aligned";
export type PrototypeSeatState = "claimed" | "invited" | "unclaimed" | "expired";

/** One seat, as the table draws it. `name` is `null` for every state but `claimed`. */
export interface PrototypeSeatView {
  readonly state: PrototypeSeatState;
  readonly name: string | null;
}

/** One row of the "needs attention" band — the columns, joined and nothing else. */
export interface AttentionRow {
  readonly id: string;
  readonly name: string;
  readonly template: string;
  readonly seat: PrototypeSeatView;
  readonly stage: PrototypeStage;
  /** Whole days between the relationship's last activity and the fixture clock. */
  readonly daysIdle: number;
}

/** The four figures, flattened: the page derives them, this component prints them. */
export interface CountFigures {
  readonly relationships: number;
  readonly invited: number;
  readonly connected: number;
  readonly sharing: number;
  readonly aligned: number;
  readonly awaitingInvitation: number;
  readonly templates: number;
  readonly builtIn: number;
  readonly authored: number;
  readonly complete: number;
}

/** The seat's tone: an account is good, an invitation that died is not. */
const SEAT_VARIANT: Record<
  PrototypeSeatState,
  "success" | "secondary" | "outline" | "destructive"
> = {
  claimed: "success",
  invited: "outline",
  unclaimed: "secondary",
  expired: "destructive",
};

/** The stage's tone, in ladder order — never a colour a reader could read as a measure. */
const STAGE_VARIANT: Record<PrototypeStage, "secondary" | "outline" | "success"> = {
  invited: "outline",
  connected: "secondary",
  sharing: "secondary",
  aligned: "success",
};

/** One figure: the label, the number, and the line under it. */
function CountCard({
  id,
  label,
  value,
  detail,
  icon,
}: {
  id: string;
  label: string;
  value: number;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <Card data-prototype-count={id}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" data-prototype-figure={id}>
          {value}
        </div>
        <p className="text-muted-foreground mt-1 text-xs">{detail}</p>
      </CardContent>
    </Card>
  );
}

export function PrototypeAdminOverview({
  copy,
  figures,
  rows,
  staleDays,
}: {
  copy: PageCopy;
  /** The four counts, derived from the fixture rows by the page. */
  figures: CountFigures;
  /** The relationships that need attention, quietest first. */
  rows: readonly AttentionRow[];
  /** `STALE_DAYS` — the threshold the attention band's sentence quotes. */
  staleDays: number;
}) {
  const counts = sectionOf(copy, "counts");
  const attention = sectionOf(copy, "attention");
  const attentionEmpty = sectionOf(copy, "attention-empty");
  const stages = sectionOf(copy, "stages");
  const seats = sectionOf(copy, "seat");
  const coming = sectionOf(copy, "coming");
  const comingColumns = sectionOf(copy, "coming-columns");

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">{copy.heading}</h1>
        {copy.subtitle === undefined ? null : (
          <p className="text-muted-foreground max-w-3xl">{copy.subtitle}</p>
        )}
      </header>

      <section data-prototype-counts="true" className="space-y-3">
        {counts.heading === undefined ? null : (
          <h2 className="text-lg font-semibold">{counts.heading}</h2>
        )}
        <p className="text-muted-foreground text-sm">{sectionBody(counts)}</p>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <CountCard
            id="relationships"
            label={itemLabel(counts, "relationships")}
            value={figures.relationships}
            detail={fillLabel(itemLabel(counts, "relationships-detail"), {
              invited: figures.invited,
              connected: figures.connected,
              sharing: figures.sharing,
              aligned: figures.aligned,
            })}
            icon={<Users className="h-4 w-4" />}
          />
          <CountCard
            id="awaiting-invitation"
            label={itemLabel(counts, "awaiting-invitation")}
            value={figures.awaitingInvitation}
            detail={itemLabel(counts, "awaiting-invitation-detail")}
            icon={<MailWarning className="h-4 w-4" />}
          />
          <CountCard
            id="templates"
            label={itemLabel(counts, "templates")}
            value={figures.templates}
            detail={fillLabel(itemLabel(counts, "templates-detail"), {
              builtIn: figures.builtIn,
              authored: figures.authored,
            })}
            icon={<LayoutTemplate className="h-4 w-4" />}
          />
          <CountCard
            id="complete"
            label={itemLabel(counts, "complete")}
            value={figures.complete}
            detail={itemLabel(counts, "complete-detail")}
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
        </div>
      </section>

      <section data-prototype-attention="true" className="space-y-3">
        {attention.heading === undefined ? null : (
          <h2 className="text-lg font-semibold">{attention.heading}</h2>
        )}
        <p className="text-muted-foreground text-sm">
          {fillLabel(sectionBody(attention), { days: staleDays })}
        </p>

        {rows.length === 0 ? (
          <Card>
            <CardHeader>
              {attentionEmpty.heading === undefined ? null : (
                <CardTitle className="text-lg">{attentionEmpty.heading}</CardTitle>
              )}
              <CardDescription>{sectionBody(attentionEmpty)}</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{itemLabel(attention, "relationship")}</TableHead>
                  <TableHead>{itemLabel(attention, "template")}</TableHead>
                  <TableHead>{itemLabel(attention, "seat")}</TableHead>
                  <TableHead>{itemLabel(attention, "stage")}</TableHead>
                  <TableHead>{itemLabel(attention, "idle")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} data-prototype-attention-row={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.template}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={SEAT_VARIANT[row.seat.state]} className="w-fit">
                          {itemLabel(seats, row.seat.state)}
                        </Badge>
                        <span className="text-muted-foreground text-xs">
                          {row.seat.name ?? itemLabel(seats, "unnamed")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STAGE_VARIANT[row.stage]}>
                        {itemLabel(stages, row.stage)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{row.daysIdle}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section data-prototype-coming="true" className="space-y-3">
        {coming.heading === undefined ? null : (
          <h2 className="text-lg font-semibold">{coming.heading}</h2>
        )}
        <p className="text-muted-foreground text-sm">{sectionBody(coming)}</p>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{itemLabel(comingColumns, "screen")}</TableHead>
                <TableHead>{itemLabel(comingColumns, "route")}</TableHead>
                <TableHead>{itemLabel(comingColumns, "status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow data-prototype-coming-row="relationships">
                <TableCell className="font-medium">{itemLabel(coming, "relationships")}</TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">
                  {itemValue(coming, "relationships")}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{itemLabel(coming, "state")}</Badge>
                </TableCell>
              </TableRow>
              <TableRow data-prototype-coming-row="gaps">
                <TableCell className="font-medium">{itemLabel(coming, "gaps")}</TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">
                  {itemValue(coming, "gaps")}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{itemLabel(coming, "state")}</Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
