/**
 * template-ancestor: components/admin/support-inbox.tsx   (variation: the inbox's list-and-record shape, with a review artifact in place of a support thread — the list is grouped by release, the record is a sandboxed file beside its to-dos and its feedback issues, and the address carries two query parameters instead of one: `?artifact=` and, inside it, `?issue=`)
 *
 * `/admin/review` — the console's review shelf (#665).
 *
 * **Three panes from one manifest entry.** The list, the file and the review record all answer from
 * the artifact the address names, so a row's counts and the checklist below it cannot disagree —
 * there is no second fetch that could return a different snapshot.
 *
 * **The list is grouped by release, and a group is archived or active as one.** The grouping is
 * derived (`lib/review/artifacts.ts::groupsOf`), never authored: membership comes from the
 * artifact's `release`, the state comes from the changelog's release record. A group's rows carry no
 * badge of their own — the heading is the state, which is what the owner asked for.
 *
 * **The file is served, never embedded.** The `<iframe>` loads `/review-artifacts/[id]`, which
 * resolves the id through the manifest and 404s for anything it does not name, and it is sandboxed
 * to `allow-scripts`: the document's own scripts run (the prototypes are interactive) and it has no
 * same-origin access to the console around it. The manifest is the only catalogue — there is no
 * disk scan here and no path parameter anywhere.
 *
 * **Read-only, and it says so.** Checking a to-do and closing an issue are writes, and the store
 * that owns them (`review_artifact` / `review_todo` / `review_issue`) is carded separately. The
 * sentence comes from `reviewStore.readOnlyReason`, which is a fact about the store rather than
 * page copy: when the store lands it answers `null` and the note leaves with it.
 *
 * Every word resolves from `data/pages/admin-review.ts` (E23); the artifact's own title, look-for
 * line and the review rows come from the manifest and the store, because they are records.
 */
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  ExternalLink,
  FileText,
  Network,
  MessageSquare,
  ClipboardList,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/content/core";
import type { PageCopy } from "@/content/pages";
import type {
  ReviewArtifact,
  ReviewArtifactKind,
  ReviewIssue,
  ReviewRecord,
} from "@/content/review";
import type { ReviewCatalogue } from "@/lib/review/artifacts";
import { reviewStatsOf } from "@/lib/review/artifacts";
import { reviewArtifactFileUrl, reviewArtifactPath, reviewIssuePath } from "@/lib/review/paths";
import { reviewStore } from "@/lib/review/store";
import { cn } from "@/lib/utils";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

/**
 * The frame's sandbox. `allow-scripts` alone: the prototypes are interactive, and no token here
 * grants the document a same-origin relationship with the console, so a script inside an artifact
 * cannot read this page's DOM or its cookies.
 */
const IFRAME_SANDBOX = "allow-scripts";

/** The picture a kind gets in the row. Three kinds, three marks — a review artifact is not a logo. */
const KIND_ICON: Record<ReviewArtifactKind, typeof FileText> = {
  prototype: FileText,
  diagram: Network,
  report: ClipboardList,
};

/** Open feedback is the alarm; closed is quiet. Same two variants the inbox uses for a status. */
const ISSUE_VARIANT: Record<ReviewIssue["status"], "warning" | "muted"> = {
  open: "warning",
  closed: "muted",
};

/** The `kind` label a reader sees, resolved from the fixture rather than `artifact.kind` itself. */
function kindLabelOf(copy: PageCopy, kind: ReviewArtifactKind): string {
  const section = sectionOf(copy, "artifact");
  return itemLabel(section, `kind-${kind}`);
}

export function ReviewArtifacts({
  copy,
  catalogue,
  selectedId,
  record,
  issue,
  unreadable,
}: {
  copy: PageCopy;
  /** `null` when the catalogue could not be read — `unreadable` says why. */
  catalogue: ReviewCatalogue | null;
  selectedId: string | null;
  record: ReviewRecord | null;
  /** The issue whose thread is open (`?issue=`), resolved by the page inside the selected record. */
  issue: ReviewIssue | null;
  unreadable: string | null;
}) {
  const listCopy = sectionOf(copy, "list");
  const previewCopy = sectionOf(copy, "preview");
  const artifactCopy = sectionOf(copy, "artifact");
  const todosCopy = sectionOf(copy, "todos");
  const feedbackCopy = sectionOf(copy, "feedback");
  const issueCopy = sectionOf(copy, "issue");
  const unreadableCopy = sectionOf(copy, "unreadable");

  /**
   * The row's one line. It comes from the record, so a to-do ticked in the store moves the number
   * on the row above it in the same render — the same rule the inbox's queue states.
   */
  const rowMeta = (artifact: ReviewArtifact): string => {
    const stats = reviewStatsOf(
      reviewStore.recordFor(artifact.id) ?? { artifactId: artifact.id, todos: [], issues: [] },
    );
    return fillLabel(itemLabel(listCopy, "row-meta"), {
      kind: kindLabelOf(copy, artifact.kind),
      done: stats.done,
      total: stats.total,
      open: stats.open,
      closed: stats.closed,
    });
  };

  const selected = selectedId === null ? null : (catalogue?.byId.get(selectedId) ?? null);

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

      {catalogue === null ? null : (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr] lg:items-start">
          <Card>
            <CardHeader>
              <CardTitle>{listCopy.heading ?? ""}</CardTitle>
              <CardDescription>{sectionBody(listCopy)}</CardDescription>
            </CardHeader>
            <CardContent className={cn("px-0", catalogue.groups.length === 0 && "px-6")}>
              {catalogue.groups.length === 0 ? (
                <p data-empty="true" className="text-sm text-muted-foreground">
                  {itemLabel(listCopy, "empty")}
                </p>
              ) : (
                <div className="space-y-6">
                  {catalogue.groups.map((group) => (
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
                              group.artifacts.length === 1 ? "group-count-one" : "group-count",
                            ),
                            { count: group.artifacts.length },
                          )}
                        </span>
                      </h2>
                      <ul className="divide-y">
                        {group.artifacts.map((artifact) => {
                          const Icon = KIND_ICON[artifact.kind];
                          const isSelected = artifact.id === selectedId;
                          return (
                            <li key={artifact.id}>
                              <Link
                                href={reviewArtifactPath(artifact.id)}
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
                                    {rowMeta(artifact)}
                                  </span>
                                  <span className="block text-[11px] text-muted-foreground">
                                    {fillLabel(itemLabel(listCopy, "row-published"), {
                                      date: formatDate(artifact.date),
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
                        <span>{selected.title}</span>
                        <Badge variant="muted">{selected.version}</Badge>
                      </CardTitle>
                      <CardDescription>{selected.lookFor}</CardDescription>
                    </div>
                    <Link
                      href={reviewArtifactFileUrl(selected.id)}
                      className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-action hover:underline"
                    >
                      {itemLabel(previewCopy, "open-file")}
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                    </Link>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <iframe
                      src={reviewArtifactFileUrl(selected.id)}
                      title={fillLabel(itemLabel(previewCopy, "frame-title"), {
                        title: selected.title,
                        version: selected.version,
                      })}
                      sandbox={IFRAME_SANDBOX}
                      className="h-[520px] w-full rounded-md border border-gray-200 bg-white"
                      data-artifact-frame={selected.id}
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
                        { id: "kind", value: kindLabelOf(copy, selected.kind) },
                        { id: "version", value: selected.version },
                        { id: "release", value: `v${selected.release}` },
                        { id: "published", value: formatDate(selected.date) },
                        { id: "file", value: selected.file },
                        { id: "sandbox", value: itemLabel(artifactCopy, "sandbox-value") },
                        { id: "id", value: selected.id },
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
                        <dd>{selected.lookFor}</dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>

                {issue === null ? (
                  <>
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <ClipboardList className="size-4" aria-hidden="true" />
                          <span>{todosCopy.heading ?? ""}</span>
                        </CardTitle>
                        {record === null ? null : (
                          <CardDescription>
                            {fillLabel(itemLabel(todosCopy, "progress"), {
                              done: reviewStatsOf(record).done,
                              total: reviewStatsOf(record).total,
                            })}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {record === null || record.todos.length === 0 ? (
                          <p data-empty="true" className="text-sm text-muted-foreground">
                            {itemLabel(todosCopy, "empty")}
                          </p>
                        ) : (
                          <ul className="divide-y">
                            {record.todos.map((todo) => (
                              <li
                                key={todo.id}
                                data-todo={todo.id}
                                data-done={todo.done ? "true" : "false"}
                                className="flex items-start gap-3 py-2.5"
                              >
                                {todo.done ? (
                                  <CheckCircle2
                                    className="mt-0.5 size-4 shrink-0 text-action"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <Circle
                                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                                    aria-hidden="true"
                                  />
                                )}
                                <span className="min-w-0 flex-1">
                                  <span
                                    className={cn(
                                      "block text-sm",
                                      todo.done && "text-muted-foreground line-through",
                                    )}
                                  >
                                    {todo.label}
                                  </span>
                                  {todo.done &&
                                  todo.actor !== undefined &&
                                  todo.at !== undefined ? (
                                    <span className="block text-xs text-muted-foreground">
                                      {fillLabel(itemLabel(todosCopy, "done-by"), {
                                        actor: todo.actor,
                                        date: formatDate(todo.at),
                                      })}
                                    </span>
                                  ) : null}
                                </span>
                                <Badge variant={todo.done ? "muted" : "outline"}>
                                  {itemLabel(todosCopy, todo.done ? "state-done" : "state-open")}
                                </Badge>
                              </li>
                            ))}
                          </ul>
                        )}
                        {reviewStore.readOnlyReason === null ? null : (
                          <p className="text-xs text-muted-foreground">
                            {reviewStore.readOnlyReason}
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <MessageSquare className="size-4" aria-hidden="true" />
                          <span>{feedbackCopy.heading ?? ""}</span>
                        </CardTitle>
                        {record === null ? null : (
                          <CardDescription>
                            {fillLabel(itemLabel(feedbackCopy, "summary"), {
                              open: reviewStatsOf(record).open,
                              closed: reviewStatsOf(record).closed,
                            })}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="px-0">
                        {record === null || record.issues.length === 0 ? (
                          <p data-empty="true" className="px-6 text-sm text-muted-foreground">
                            {itemLabel(feedbackCopy, "empty")}
                          </p>
                        ) : (
                          <ul className="divide-y">
                            {record.issues.map((entry) => (
                              <li key={entry.number}>
                                <Link
                                  href={reviewIssuePath(selected.id, entry.number)}
                                  data-issue={entry.number}
                                  data-status={entry.status}
                                  className="flex flex-col gap-1.5 px-6 py-3 transition-colors hover:bg-muted/60"
                                >
                                  <span className="flex items-center gap-2">
                                    <Badge
                                      variant={ISSUE_VARIANT[entry.status]}
                                      data-issue-state={entry.status}
                                    >
                                      {itemLabel(feedbackCopy, `state-${entry.status}`)}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {fillLabel(itemLabel(feedbackCopy, "number"), {
                                        number: entry.number,
                                      })}
                                    </span>
                                    <span
                                      className={cn(
                                        "truncate text-sm font-medium",
                                        entry.status === "closed" && "text-muted-foreground",
                                      )}
                                    >
                                      {entry.title}
                                    </span>
                                  </span>
                                  <span className="flex flex-wrap items-center gap-1.5">
                                    {entry.labels.map((label) => (
                                      <Badge key={label} variant="outline" className="font-normal">
                                        {label}
                                      </Badge>
                                    ))}
                                    <span className="text-xs text-muted-foreground">
                                      {fillLabel(itemLabel(feedbackCopy, "opened-by"), {
                                        author: entry.author,
                                        date: formatDate(entry.at),
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
                  <Card data-issue-thread={issue.number}>
                    <CardHeader className="space-y-3">
                      <Link
                        href={reviewArtifactPath(selected.id)}
                        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
                      >
                        <ArrowLeft className="size-3.5" aria-hidden="true" />
                        {itemLabel(issueCopy, "back")}
                      </Link>
                      <div className="space-y-2">
                        <CardTitle className="flex flex-wrap items-center gap-2">
                          <span>{issue.title}</span>
                          <Badge variant={ISSUE_VARIANT[issue.status]}>
                            {itemLabel(feedbackCopy, `state-${issue.status}`)}
                          </Badge>
                          <span className="text-sm font-normal text-muted-foreground">
                            {fillLabel(itemLabel(feedbackCopy, "number"), {
                              number: issue.number,
                            })}
                          </span>
                        </CardTitle>
                        <CardDescription className="flex flex-wrap items-center gap-1.5">
                          {issue.labels.map((label) => (
                            <Badge key={label} variant="outline" className="font-normal">
                              {label}
                            </Badge>
                          ))}
                          <span>
                            {fillLabel(itemLabel(feedbackCopy, "opened-by"), {
                              author: issue.author,
                              date: formatDate(issue.at),
                            })}
                          </span>
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <section className="space-y-2">
                        <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
                          {itemLabel(issueCopy, "body-heading")}
                        </h3>
                        <p className="text-sm">{issue.body}</p>
                      </section>

                      <section className="space-y-3">
                        <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
                          {itemLabel(issueCopy, "thread-heading")}
                        </h3>
                        {issue.comments.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            {itemLabel(issueCopy, "no-replies")}
                          </p>
                        ) : (
                          <ul className="space-y-3">
                            {issue.comments.map((comment) => (
                              <li key={comment.id} className="rounded-md border p-3">
                                <p className="text-xs text-muted-foreground">
                                  {fillLabel(itemLabel(feedbackCopy, "opened-by"), {
                                    author: comment.author,
                                    date: formatDate(comment.at),
                                  })}
                                </p>
                                <p className="mt-1 text-sm">{comment.body}</p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </section>

                      <section className="space-y-3">
                        <label className="block text-xs uppercase tracking-wide text-muted-foreground">
                          {itemLabel(issueCopy, "reply-label")}
                          <textarea
                            disabled
                            rows={3}
                            className="mt-1 w-full rounded-md border border-gray-300 bg-muted/40 p-2 text-sm normal-case tracking-normal"
                          />
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled
                            className="inline-flex h-9 items-center rounded-md bg-action px-3 text-sm font-medium text-action-foreground opacity-60"
                          >
                            {itemLabel(issueCopy, "comment")}
                          </button>
                          <button
                            type="button"
                            disabled
                            className="inline-flex h-9 items-center rounded-md border border-gray-300 px-3 text-sm font-medium opacity-60"
                          >
                            {itemLabel(issueCopy, "close")}
                          </button>
                          <span className="text-xs text-muted-foreground">
                            {itemLabel(issueCopy, "read-only")}
                          </span>
                        </div>
                        {issue.status === "closed" ? (
                          <p className="text-xs text-muted-foreground">
                            {itemLabel(issueCopy, "closed-note")}
                          </p>
                        ) : null}
                      </section>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
