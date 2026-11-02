// template-ancestor: components/admin/instance-registry.tsx   (variation: the operator's filterable registry, repurposed as the prototype's review checklist with approve and request-changes actions)
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  REVIEW_PERSONAS,
  REVIEW_PERSONA_LABELS,
  personaSurfaceFor,
  type PersonaAccess,
  type PersonaSurface,
  type ReviewPersona,
} from "@/data/v1/persona-surfaces";
import {
  REVIEW_SCREENS,
  reviewScreenFromHash,
  reviewScreenId,
  type ReviewScreen,
  type ReviewStatus,
} from "@/lib/v1/review";
import { useV1Store } from "@/lib/v1/store";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";

/** The three statuses as one badge tone each — no brand colour, the `StageBadge` rule. */
const STATUS_VARIANT: Record<ReviewStatus, "outline" | "warning" | "success"> = {
  unreviewed: "outline",
  "changes requested": "warning",
  approved: "success",
};

/** The three access marks as one badge tone each, from the matrix's `✓ / view / —`. */
const ACCESS_VARIANT: Record<PersonaAccess, "success" | "secondary" | "outline"> = {
  use: "success",
  view: "secondary",
  absent: "outline",
};

const ACCESS_LABEL: Record<PersonaAccess, string> = {
  use: "can use",
  view: "view only",
  absent: "not present",
};

type Filter = "all" | ReviewStatus;
type PersonaFilter = "all" | ReviewPersona;

/** The status pill — a badge, never a hand-rolled span. */
function StatusBadge({ status }: { status: ReviewStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className="normal-case">
      {status}
    </Badge>
  );
}

/** The access pill — `can use` / `view only` / `not present`, straight from the matrix. */
function AccessBadge({ access }: { access: PersonaAccess }) {
  return (
    <Badge variant={ACCESS_VARIANT[access]} className="normal-case">
      {ACCESS_LABEL[access]}
    </Badge>
  );
}

/** The persona row — the five personas, each with its mark and the action it can take. */
function PersonaRow({ surface }: { surface: PersonaSurface }) {
  return (
    <ul className="mt-3 space-y-1 rounded-md border border-border bg-muted/30 p-3">
      {REVIEW_PERSONAS.map((persona) => {
        const cell = surface.personas[persona];
        return (
          <li key={persona} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="w-28 shrink-0 font-medium text-foreground">
              {REVIEW_PERSONA_LABELS[persona]}
            </span>
            <AccessBadge access={cell.access} />
            {cell.access !== "absent" && (
              <span className="text-muted-foreground">{cell.action}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * One row of the checklist: the route (a link), its one-line description, its status and its
 * note, the persona row from the matrix, the ancestor it varies, and the three actions — Open,
 * Approve, Request changes (which reveals a note field).
 *
 * The row carries the route's slug as its DOM id, so a screen's review control can link straight
 * to it (`reviewScreenHref`); `focused` marks the row a deep link landed on, so the reviewer sees
 * which one it is after the jump rather than guessing.
 */
function ReviewRow({
  screen,
  surface,
  focused,
}: {
  screen: ReviewScreen;
  surface: PersonaSurface;
  focused: boolean;
}) {
  const { reviews, setReview } = useV1Store();
  const entry: ReviewEntryForRow = reviews[screen.route] ?? { status: "unreviewed", note: "" };
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(entry.note);

  return (
    <Card
      id={reviewScreenId(screen.route)}
      className={cn("scroll-mt-24", focused && "ring-2 ring-action ring-offset-2")}
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={screen.href}
              className="font-mono text-sm font-medium text-foreground hover:text-action"
            >
              {screen.route}
            </Link>
            <StatusBadge status={entry.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{screen.description}</p>
          {surface.flag !== null && (
            <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
              Not in any persona&apos;s navigation — {surface.flag}
            </p>
          )}
          {entry.status === "changes requested" && entry.note !== "" && (
            <p className="mt-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700">
              {entry.note}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Surface: <span className="text-foreground">{surface.surface}</span> · varies{" "}
            <code className="font-mono">{surface.ancestor}</code>
          </p>
          <PersonaRow surface={surface} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={screen.href}>Open</Link>
          </Button>
          <Button
            variant="success"
            size="sm"
            onClick={() => setReview(screen.route, { status: "approved", note: "" })}
          >
            Approve
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setNoteOpen((open) => !open)}>
            Request changes
          </Button>
        </div>
      </div>
      {noteOpen && (
        <div className="flex flex-col gap-2 border-t p-4 sm:flex-row">
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What needs to change?"
            className="flex-1"
          />
          <Button
            size="sm"
            onClick={() => {
              setReview(screen.route, { status: "changes requested", note: note.trim() });
              setNoteOpen(false);
            }}
          >
            Save changes
          </Button>
        </div>
      )}
    </Card>
  );
}

/** The row's read shape, for the fallback literal's contextual typing. */
type ReviewEntryForRow = { status: ReviewStatus; note: string };

/** `/v1/review` — the checklist. Approval is a persisted state, not a conversation. */
export function ReviewList() {
  const { hydrated, reviews } = useV1Store();
  const [filter, setFilter] = useState<Filter>("all");
  const [personaFilter, setPersonaFilter] = useState<PersonaFilter>("all");
  /** The route a deep link landed on, so its row is scrolled to and marked. */
  const [focused, setFocused] = useState<string | null>(null);

  /**
   * Honour `/v1/review#screen-…` — the review control's deep link to one row.
   *
   * The rows only exist once the store has hydrated, so the browser's own fragment scroll has
   * nothing to scroll to on first paint; this runs after the rows are committed and does it
   * instead, and listens for a later `hashchange` so a second link on the same page works. The
   * list is not filtered to the target: the row is marked in place, which keeps the surrounding
   * rows (and the counts) intact.
   */
  useEffect(() => {
    if (!hydrated) return;
    const focusFromHash = () => {
      const target = reviewScreenFromHash(window.location.hash);
      setFocused(target?.route ?? null);
      if (target === undefined) return;
      document
        .getElementById(reviewScreenId(target.route))
        ?.scrollIntoView({ block: "start", behavior: "auto" });
    };
    focusFromHash();
    window.addEventListener("hashchange", focusFromHash);
    return () => window.removeEventListener("hashchange", focusFromHash);
  }, [hydrated]);

  const statusOf = (screen: ReviewScreen): ReviewStatus =>
    reviews[screen.route]?.status ?? "unreviewed";

  const approved = REVIEW_SCREENS.filter((screen) => statusOf(screen) === "approved").length;
  const changes = REVIEW_SCREENS.filter(
    (screen) => statusOf(screen) === "changes requested",
  ).length;
  const unreviewed = REVIEW_SCREENS.length - approved - changes;

  // Every review screen resolves to its matrix entry — `personaSurfaceFor` throws if one does
  // not, and `data/v1/persona-surfaces.ts` validates the coverage at import, so there is no
  // fallback text here.
  const rows = REVIEW_SCREENS.map((screen) => ({
    screen,
    surface: personaSurfaceFor(screen.route),
  }));

  const visible = rows.filter(({ screen, surface }) => {
    const statusOk = filter === "all" || statusOf(screen) === filter;
    const personaOk =
      personaFilter === "all" || surface.personas[personaFilter].access !== "absent";
    return statusOk && personaOk;
  });

  // A persona filter presents the surfaces in the order their navigation does (the matrix's row
  // order); the "all" view keeps the route order `REVIEW_SCREENS` declares.
  const ordered =
    personaFilter === "all"
      ? visible
      : [...visible].sort((a, b) => (a.surface.order ?? 0) - (b.surface.order ?? 0));

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
      <div>
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Review</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every prototype screen, so approval is a state rather than a conversation. Each row says
          who the screen is for — the five personas, what each can do, and the ancestor it varies.
          Marking a screen here survives a reload.
        </p>
      </div>

      <p className="text-sm font-medium text-foreground">
        {REVIEW_SCREENS.length} screens · {approved} approved · {changes} changes requested ·{" "}
        {unreviewed} unreviewed
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Select value={filter} onValueChange={(value) => setFilter(value as Filter)}>
          <SelectTrigger className="w-full sm:w-56" aria-label="Filter by status">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="unreviewed">unreviewed</SelectItem>
            <SelectItem value="changes requested">changes requested</SelectItem>
            <SelectItem value="approved">approved</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={personaFilter}
          onValueChange={(value) => setPersonaFilter(value as PersonaFilter)}
        >
          <SelectTrigger className="w-full sm:w-56" aria-label="Filter by persona">
            <SelectValue placeholder="Filter by persona" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All personas</SelectItem>
            {REVIEW_PERSONAS.map((persona) => (
              <SelectItem key={persona} value={persona}>
                {REVIEW_PERSONA_LABELS[persona]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!hydrated ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-3">
          {ordered.map(({ screen, surface }) => (
            <ReviewRow
              key={screen.route}
              screen={screen}
              surface={surface}
              focused={focused === screen.route}
            />
          ))}
          {ordered.length === 0 && (
            <p className="rounded-lg border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
              No screens match these filters.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
