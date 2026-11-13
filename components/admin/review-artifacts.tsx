/**
 * template-ancestor: components/admin/support-inbox.tsx   (variation: the inbox's list-and-record shape, with a review artifact in place of a support thread — the list is grouped by release, the record is a sandboxed file beside its to-do checklist and its feedback issues, and the address carries two query parameters instead of one: `?artifact=` and, inside it, `?issue=`)
 *
 * `/admin/review` — the console's review shelf (#665), drawn from the store #667 landed.
 *
 * **Three panes from one record.** The list, the file and the review detail all answer from the
 * artifact the address names, so a row's counts and the checklist below it cannot disagree — the
 * counts are the store's own aggregates (`ReviewArtifactSummary.progress`) and the detail is one
 * `readReviewArtifact()`, not a second fetch that could return a different snapshot.
 *
 * **The list is grouped by release, and a group is archived or active as one.** The grouping is
 * derived (`lib/review/artifacts.ts::shelfOf`), never authored: membership comes from the artifact's
 * release in `docs/review/artifacts.json`, the state from the changelog's release record. A group's
 * rows carry no badge of their own — the heading is the state, which is what the owner asked for.
 *
 * **The file is served, never embedded.** The `<iframe>` loads `/review-artifacts/[id]`, which
 * resolves the id through the catalogue and 404s for anything it does not name, and it is sandboxed
 * to `allow-scripts`: the document's own scripts run (the prototypes are interactive) and it has no
 * same-origin access to the console around it.
 *
 * **The writes are mounted, and the screen says what it does.** The checklist and the thread render
 * `./review-todos` and `./review-thread`, two client components the page hands the store's three
 * actions to (`toggleReviewTodoAction`, `commentOnReviewIssueAction`,
 * `setReviewIssueStateAction`) — the inbox's pattern, where the server page passes the action down
 * and the component never imports a `"use server"` module itself. A refused write draws the
 * fixture's sentence beside the control; nothing here is disabled to hide a policy.
 *
 * Every word resolves from `data/pages/admin-review.ts` (E23); the artifact's title, version, kind,
 * the to-do bodies and the issue titles are records and come from the store.
 */
import { ClipboardList, ExternalLink, FileText, MessageSquare, Network } from "lucide-react";
import Link from "next/link";

import { ReviewIssueThread } from "@/components/admin/review-thread";
import { ReviewTodos } from "@/components/admin/review-todos";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/content/core";
import type { PageCopy } from "@/content/pages";
import type {
  ReviewActionOutcome,
  ReviewCommentInput,
  ReviewIssueStateInput,
  ReviewTodoInput,
} from "@/lib/admin/review-inputs";
import type {
  ReviewIssueThread as ReviewIssueThreadRecord,
  ReviewArtifactDetail,
} from "@/lib/db/review-artifacts";
import type { ReviewKind } from "@/content/review";
import type { ReviewReleaseGroup, ReviewShelf } from "@/lib/review/artifacts";
import { reviewArtifactFileUrl, reviewArtifactPath, reviewIssuePath } from "@/lib/review/paths";
import { cn } from "@/lib/utils";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

/**
 * The frame's sandbox. `allow-scripts` alone: the prototypes are interactive, and no token here
 * grants the document a same-origin relationship with the console, so a script inside an artifact
 * cannot read this page's DOM or its cookies.
 */
const IFRAME_SANDBOX = "allow-scripts";

/** The picture a kind gets in the row. Three kinds, three marks — an artifact is not a logo. */
const KIND_ICON: Record<ReviewKind, typeof FileText> = {
  prototype: FileText,
  diagram: Network,
  report: ClipboardList,
};

/** Open feedback is the alarm; closed is quiet. Same two variants the inbox uses for a status. */
const ISSUE_VARIANT: Record<"open" | "closed", "warning" | "muted"> = {
  open: "warning",
  closed: "muted",
};

/** A day, from a record's own instant — never a clock read in the render. */
function dayOf(iso: string): string {
  return formatDate(iso);
}

export function ReviewArtifacts({
  copy,
  shelf,
  selected,
  thread,
  unreadable,
  onToggleTodo,
  onCommentOnIssue,
  onSetIssueState,
}: {
  copy: PageCopy;
  /** `null` when the shelf could not be built — `unreadable` says why. */
  shelf: ReviewShelf | null;
  /** The open artifact's record, both lists and counts; `null` when nothing is selected. */
  selected: ReviewArtifactDetail | null;
  /** The open issue and its comments (`?issue=`), resolved inside the selected artifact. */
  thread: ReviewIssueThreadRecord | null;
  unreadable: string | null;
  /**
   * The store's three writes, handed down from the page. Not imported here: a component that
   * imported a `"use server"` module would be the second place the action's identity lives.
   */
  onToggleTodo: (input: ReviewTodoInput) => Promise<ReviewActionOutcome>;
  onCommentOnIssue: (input: ReviewCommentInput) => Promise<ReviewActionOutcome>;
  onSetIssueState: (input: ReviewIssueStateInput) => Promise<ReviewActionOutcome>;
}) {
  const listCopy = sectionOf(copy, "list");
  const previewCopy = sectionOf(copy, "preview");
  const artifactCopy = sectionOf(copy, "artifact");
  const feedbackCopy = sectionOf(copy, "feedback");
  const unreadableCopy = sectionOf(copy, "unreadable");

  const selectedId = selected?.artifact.id ?? null;

  /** The row's one line: kind, both to-do counts, both issue counts — from the store's aggregates. */
  const rowMeta = (group: ReviewReleaseGroup, entryIndex: number): string => {
    const entry = group.entries[entryIndex];
    if (entry === undefined) return "";
    const { artifact, progress } = entry.summary;
    return fillLabel(itemLabel(listCopy, "row-meta"), {
      kind: itemLabel(artifactCopy, `kind-${artifact.kind}`),
      done: progress.todosDone,
      total: progress.todosTotal,
      open: progress.issuesOpen,
      closed: progress.issuesClosed,
    });
  };

  /** The release a selected artifact belongs to — the heading above its row, by construction. */
  const releaseLabelOf = (artifactId: string): string =>
    shelf?.groups.find((group) =>
      group.entries.some((entry) => entry.summary.artifact.id === artifactId),
    )?.label ?? "";

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{copy.heading}</h1>
        {copy.subtitle === undefined ? null : (
          <p className="max-w-3xl text-muted-foreground">{copy.subtitle}</p>
        )}
      </header>

      {unreadable === null ? null : (
        <Card data-unreadable="true">
          <CardHeader>
            <CardTitle>{unreadableCopy.heading}</CardTitle>
            <CardDescription>{sectionBody(unreadableCopy)}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-xs text-muted-foreground">{unreadable}</p>
          </CardContent>
        </Card>
      )}

      {shelf === null ? null : (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr] lg:items-start">
          <Card>
            <CardHeader>
              <CardTitle>{listCopy.heading ?? ""}</CardTitle>
              <CardDescription>{sectionBody(listCopy)}</CardDescription>
            </CardHeader>
            <CardContent className={cn("px-0", shelf.groups.length === 0 && "px-6")}>
              {shelf.groups.length === 0 ? (
                <p
                  data-empty="true"
                  className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground"
                >
                  {itemLabel(listCopy, "empty")}
                </p>
              ) : (
                <div className="space-y-6">
                  {shelf.groups.map((group) => (
                    <section key={group.version} data-release={group.version}>
                      <h2 className="flex items-center gap-2 px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <span>{group.label}</span>
                        <Badge
                          variant={group.status === "active" ? "blue" : "muted"}
                          data-release-status={group.status}
                        >
                          {itemLabel(listCopy, `status-${group.status}`)}
                        </Badge>
                        <span className="font-normal normal-case">
                          {fillLabel(
                            itemLabel(
                              listCopy,
                              group.entries.length === 1 ? "group-count-one" : "group-count",
                            ),
                            { count: group.entries.length },
                          )}
                        </span>
                      </h2>
                      <ul className="divide-y">
                        {group.entries.map((entry, index) => {
                          const artifact = entry.summary.artifact;
                          const Icon = KIND_ICON[artifact.kind];
                          const isSelected = artifact.id === selectedId;
                          return (
                            <li key={artifact.id}>
                              <Link
                                href={reviewArtifactPath(artifact.slug)}
                                data-artifact={artifact.id}
                                data-selected={isSelected ? "true" : "false"}
                                className={cn(
                                  "flex gap-3 border-l-2 px-3 py-3 transition-colors hover:bg-muted/60",
                                  isSelected ? "border-action bg-muted/70" : "border-transparent",
                                )}
                              >
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                  <Icon className="size-5" aria-hidden="true" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center gap-2">
                                    <span className="truncate text-sm font-medium">
                                      {artifact.title}
                                    </span>
                                    <Badge variant="muted">{artifact.version}</Badge>
                                  </span>
                                  <span className="mt-0.5 block text-xs text-muted-foreground">
                                    {rowMeta(group, index)}
                                  </span>
                                  <span className="block text-[11px] text-muted-foreground">
                                    {fillLabel(itemLabel(listCopy, "row-published"), {
                                      date: dayOf(artifact.capturedAt),
                                    })}
                                  </span>
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            {selected === null ? (
              <Card>
                <CardContent className="py-10">
                  <p data-empty="true" className="text-sm text-muted-foreground">
                    {itemLabel(previewCopy, "empty")}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader className="flex-row items-start justify-between space-y-0">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        <span>{selected.artifact.title}</span>
                        <Badge variant="muted">{selected.artifact.version}</Badge>
                      </CardTitle>
                      <CardDescription>
                        {shelf.byId.get(selected.artifact.id)?.lookFor ?? ""}
                      </CardDescription>
                    </div>
                    <Link
                      href={reviewArtifactFileUrl(selected.artifact.slug)}
                      className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-action hover:underline"
                    >
                      {itemLabel(previewCopy, "open-file")}
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                    </Link>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <iframe
                      src={reviewArtifactFileUrl(selected.artifact.slug)}
                      title={fillLabel(itemLabel(previewCopy, "frame-title"), {
                        title: selected.artifact.title,
                        version: selected.artifact.version,
                      })}
                      sandbox={IFRAME_SANDBOX}
                      className="h-[520px] w-full rounded-md border border-gray-200 bg-white"
                      data-artifact-frame={selected.artifact.id}
                    />
                    <p className="text-xs text-muted-foreground">
                      {itemLabel(previewCopy, "served")}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>{artifactCopy.heading ?? ""}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                      {[
                        {
                          id: "kind",
                          value: itemLabel(artifactCopy, `kind-${selected.artifact.kind}`),
                        },
                        { id: "version", value: selected.artifact.version },
                        {
                          id: "release",
                          value: releaseLabelOf(selected.artifact.id),
                        },
                        { id: "published", value: dayOf(selected.artifact.capturedAt) },
                        { id: "file", value: selected.artifact.path },
                        { id: "sandbox", value: itemLabel(artifactCopy, "sandbox-value") },
                        { id: "id", value: selected.artifact.id },
                      ].map((row) => (
                        <div key={row.id} className="flex flex-col gap-0.5">
                          <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                            {itemLabel(artifactCopy, row.id)}
                          </dt>
                          <dd className="break-all">{row.value}</dd>
                        </div>
                      ))}
                      <div className="flex flex-col gap-0.5 sm:col-span-2">
                        <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                          {itemLabel(artifactCopy, "look-for")}
                        </dt>
                        <dd>{shelf.byId.get(selected.artifact.id)?.lookFor ?? ""}</dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>

                {thread === null ? (
                  <>
                    <ReviewTodos
                      copy={copy}
                      artifactId={selected.artifact.id}
                      todos={selected.todos}
                      progress={selected.progress}
                      onToggle={onToggleTodo}
                    />

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <MessageSquare className="size-4" aria-hidden="true" />
                          <span>{feedbackCopy.heading ?? ""}</span>
                        </CardTitle>
                        <CardDescription>
                          {fillLabel(itemLabel(feedbackCopy, "summary"), {
                            open: selected.progress.issuesOpen,
                            closed: selected.progress.issuesClosed,
                          })}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="px-0">
                        {selected.issues.length === 0 ? (
                          <p
                            data-empty="true"
                            className="mx-6 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground"
                          >
                            {itemLabel(feedbackCopy, "empty")}
                          </p>
                        ) : (
                          <ul className="divide-y">
                            {selected.issues.map((issue) => (
                              <li key={issue.id}>
                                <Link
                                  href={reviewIssuePath(selected.artifact.slug, issue.number)}
                                  data-issue={issue.number}
                                  data-status={issue.state}
                                  className="flex flex-col gap-1.5 px-6 py-3 transition-colors hover:bg-muted/60"
                                >
                                  <span className="flex items-center gap-2">
                                    <Badge
                                      variant={ISSUE_VARIANT[issue.state]}
                                      data-issue-state={issue.state}
                                    >
                                      {itemLabel(feedbackCopy, `state-${issue.state}`)}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {fillLabel(itemLabel(feedbackCopy, "number"), {
                                        number: issue.number,
                                      })}
                                    </span>
                                    <span
                                      className={cn(
                                        "truncate text-sm font-medium",
                                        issue.state === "closed" && "text-muted-foreground",
                                      )}
                                    >
                                      {issue.title}
                                    </span>
                                  </span>
                                  <span className="flex flex-wrap items-center gap-1.5">
                                    {issue.labels.map((label) => (
                                      <Badge key={label} variant="outline" className="font-normal">
                                        {label}
                                      </Badge>
                                    ))}
                                    <span className="text-xs text-muted-foreground">
                                      {fillLabel(itemLabel(feedbackCopy, "opened-by"), {
                                        author: issue.authorUserId,
                                        date: dayOf(issue.openedAt),
                                      })}
                                    </span>
                                  </span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <ReviewIssueThread
                    copy={copy}
                    thread={thread}
                    onComment={onCommentOnIssue}
                    onSetState={onSetIssueState}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
