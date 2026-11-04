"use client";

// template-ancestor: components/my-quizzes/my-quizzes.tsx   (variation: the member's own templates as a card grid instead of a searchable tabbed list — no filters, no grid/list toggle and no row menu; the "create" band above it is a real form that posts a record to a server action, and the second band clones a public template by id)

/**
 * `/dashboard/templates` — the member's templates, and the two ways to start one (#533 phase 2).
 *
 * **The list is a grid of the member's own rows.** No tabs and no filters: a member's template list
 * is small, and a filter would be a second answer to "which rows" over a read that already filters
 * on `owner_user_id` in SQL (`listMyTemplates`). The count beside each title is Aspects and
 * relationships, which is what tells a member whether a template is still a draft idea or is in use.
 *
 * **Two create paths, and they write the same three fields.**
 *
 *   blank   the member types a title, a summary and the **first Aspect** — `zAssessment` requires at
 *           least one `item`, so "blank" cannot mean an empty record, and a form that saved one would
 *           be a button that always fails.
 *   clone   the member picks a public template; the server copies its words and Aspects in the
 *           transaction, so a template withdrawn between this render and the click is refused rather
 *           than half-copied.
 *
 * **Neither path can write a public row, and that is not a hidden field.** The record is built here
 * without `owner_user_id`, `author_user_id` or `visibility` at all; the action overwrites the fields
 * a member does not own, and the SQL statement writes `private` and the actor's id. A crafted body
 * carrying `visibility: "public"` is refused by `zAssessment`'s `.strict()` before anything opens a
 * transaction.
 *
 * **Refusals are sentences, and `invalid-draft` carries the schema's own findings** under the band —
 * the same contract the console's editor follows, because a client-side copy of "an Aspect needs two
 * poles" would be the second rule #502a refuses.
 */
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { PageCopy, PageCopySection } from "@/content/pages";
import { buildTemplateRecord } from "@/lib/admin/template-draft";
import { fillLabel, itemLabel, pageItemOf, sectionBody, sectionOf } from "@/lib/page-copy";
import { refusalSentence, type TemplateWriteOutcome } from "@/lib/member/outcomes";
import type { ClonableTemplate, MemberTemplateRow } from "@/lib/member/templates";
import Link from "next/link";
import { useState, useTransition } from "react";

/** The refusal line for a code: the server's sentence, else the fixture's, else `failed`. */
function sentenceFor(
  refusals: PageCopySection,
  outcome: { code: string; message?: string },
): string {
  return refusalSentence(outcome.code, outcome.message, (id) => {
    const known = (refusals.items ?? []).find((item) => item.id === id);
    return known?.label ?? null;
  });
}

/** Which create path the outcome belongs to — the two bands keep their own notices. */
type CreateKind = "blank" | "clone";

export function TemplateGallery({
  copy,
  rows,
  clonable,
  unreadable,
  onCreate,
  onClone,
}: {
  copy: PageCopy;
  rows: readonly MemberTemplateRow[];
  /** The public templates a member may clone. Empty is a real answer, not a failure. */
  clonable: readonly ClonableTemplate[];
  /** The database's refusal sentence, or `null` when the read answered. */
  unreadable: string | null;
  onCreate: (payload: { record?: unknown; reason?: string }) => Promise<TemplateWriteOutcome>;
  onClone: (payload: { templateId?: string; reason?: string }) => Promise<TemplateWriteOutcome>;
}) {
  const list = sectionOf(copy, "list");
  const blank = sectionOf(copy, "new");
  const clone = sectionOf(copy, "clone");
  const refusals = sectionOf(copy, "refusals");
  const empty = sectionOf(copy, "empty");
  const unreadableCopy = sectionOf(copy, "unreadable");

  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [prompt, setPrompt] = useState("");
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [reason, setReason] = useState("");
  const [outcome, setOutcome] = useState<{ kind: CreateKind; value: TemplateWriteOutcome } | null>(
    null,
  );

  const [cloneId, setCloneId] = useState("");
  const [cloneReason, setCloneReason] = useState("");
  const [cloneOutcome, setCloneOutcome] = useState<TemplateWriteOutcome | null>(null);

  /**
   * The blank start. `buildTemplateRecord` derives the Aspect's id from its prompt and the scale
   * from the model's 1..5 band; the id and slug are the action's to derive, because they are facts
   * about the row rather than about this form.
   */
  function submitBlank(): void {
    setOutcome(null);
    startTransition(async () => {
      const answer = await onCreate({
        record: buildTemplateRecord({
          id: "",
          slug: "",
          title,
          summary,
          status: "draft",
          date: new Date().toISOString(),
          aspects: [{ prompt, leftValue: left, rightValue: right }],
        }),
        reason,
      });
      setOutcome({ kind: "blank", value: answer });
      if (answer.ok) {
        setTitle("");
        setSummary("");
        setPrompt("");
        setLeft("");
        setRight("");
      }
    });
  }

  function submitClone(): void {
    setCloneOutcome(null);
    startTransition(async () => {
      const answer = await onClone({ templateId: cloneId, reason: cloneReason });
      setCloneOutcome(answer);
      if (answer.ok) setCloneId("");
    });
  }

  const blankRefusal =
    outcome !== null && outcome.kind === "blank" && !outcome.value.ok
      ? sentenceFor(refusals, outcome.value)
      : null;
  const cloneRefusal =
    cloneOutcome !== null && !cloneOutcome.ok ? sentenceFor(refusals, cloneOutcome) : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{list.heading}</CardTitle>
          <CardDescription>{sectionBody(list)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {unreadable !== null ? (
            <div data-templates-unreadable>
              <p className="text-sm font-medium">{unreadableCopy.heading}</p>
              <p className="text-sm text-muted-foreground">{unreadable}</p>
            </div>
          ) : rows.length === 0 ? (
            <div data-templates-empty>
              <p className="text-sm font-medium">{empty.heading}</p>
              <p className="text-sm text-muted-foreground">{sectionBody(empty)}</p>
            </div>
          ) : (
            <ul data-templates-list className="grid gap-3 sm:grid-cols-2">
              {rows.map((row) => (
                <li key={row.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium">{row.title}</p>
                      <p className="text-sm text-muted-foreground">{row.summary}</p>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">{row.slug}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      {fillLabel(pageItemOf(copy, "aspects").label, {
                        count: String(row.aspectCount),
                      })}
                    </span>
                    <span>
                      {fillLabel(pageItemOf(copy, "relationships").label, {
                        count: String(row.relationshipCount),
                      })}
                    </span>
                    <Link
                      className="underline underline-offset-4"
                      href={`/dashboard/templates/${row.id}`}
                    >
                      {pageItemOf(copy, "open").label}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{blank.heading}</CardTitle>
          <CardDescription>{sectionBody(blank)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="template-title">{itemLabel(blank, "title")}</Label>
              <Input
                id="template-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="template-summary">{itemLabel(blank, "summary")}</Label>
              <Textarea
                id="template-summary"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="template-prompt">{itemLabel(blank, "prompt")}</Label>
            <Input
              id="template-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="template-left">{itemLabel(blank, "left")}</Label>
              <Input
                id="template-left"
                value={left}
                onChange={(event) => setLeft(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="template-right">{itemLabel(blank, "right")}</Label>
              <Input
                id="template-right"
                value={right}
                onChange={(event) => setRight(event.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="template-reason">{itemLabel(blank, "reason")}</Label>
            <Input
              id="template-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button type="button" onClick={submitBlank} disabled={pending}>
              {pending ? itemLabel(blank, "submitting") : itemLabel(blank, "submit")}
            </Button>
            {outcome?.kind === "blank" && outcome.value.ok ? (
              <p data-template-created={outcome.value.actionId} className="text-sm">
                {fillLabel(itemLabel(blank, "created"), { title })}{" "}
                <Link
                  className="underline underline-offset-4"
                  href={`/dashboard/templates/${outcome.value.id}`}
                >
                  {itemLabel(blank, "open-created")}
                </Link>
              </p>
            ) : null}
            {blankRefusal === null ? null : (
              <p
                data-template-refusal={outcome?.value.ok === false ? outcome.value.code : ""}
                className="text-sm"
              >
                {blankRefusal}
              </p>
            )}
          </div>
          {outcome !== null &&
          outcome.value.ok === false &&
          outcome.value.problems !== undefined ? (
            <ul data-template-problems className="space-y-1 text-sm">
              {outcome.value.problems.map((problem) => (
                <li key={`${problem.path}:${problem.message}`}>
                  <span className="font-mono">{problem.path}</span>
                  {": "}
                  {problem.message}
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{clone.heading}</CardTitle>
          <CardDescription>{sectionBody(clone)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {clonable.length === 0 ? (
            <p data-clone-empty className="text-sm text-muted-foreground">
              {itemLabel(clone, "none")}
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="clone-template">{itemLabel(clone, "choose")}</Label>
                <Select value={cloneId} onValueChange={setCloneId}>
                  <SelectTrigger id="clone-template">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {clonable.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="clone-reason">{itemLabel(clone, "reason")}</Label>
                <Input
                  id="clone-reason"
                  value={cloneReason}
                  onChange={(event) => setCloneReason(event.target.value)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={submitClone}
                  disabled={pending || cloneId === ""}
                >
                  {pending ? itemLabel(clone, "cloning") : itemLabel(clone, "submit")}
                </Button>
                {cloneOutcome?.ok === true ? (
                  <p data-template-cloned={cloneOutcome.actionId} className="text-sm">
                    {fillLabel(itemLabel(clone, "cloned"), { title: "" })}{" "}
                    <Link
                      className="underline underline-offset-4"
                      href={`/dashboard/templates/${cloneOutcome.id}`}
                    >
                      {pageItemOf(copy, "open").label}
                    </Link>
                  </p>
                ) : null}
                {cloneRefusal === null ? null : (
                  <p
                    data-clone-refusal={cloneOutcome?.ok === false ? cloneOutcome.code : ""}
                    className="text-sm"
                  >
                    {cloneRefusal}
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
