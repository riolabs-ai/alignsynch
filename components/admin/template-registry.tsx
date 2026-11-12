"use client";

/**
 * template-ancestor: components/my-quizzes/my-quizzes.tsx   (variation: the record list as a table — components/ui/table.tsx inside a Card, the status a column instead of tabs, and the create band above it a plain form of five fields)
 *
 * `/admin/templates` — the console's authored templates (#502a).
 *
 * **The template it copies, and the axes it varies.** `components/my-quizzes/my-quizzes.tsx` is
 * the same list of records with the same title row, the same state on each row and the same
 * primary action at the right, and `components/admin/instance-registry.tsx` already took it to a
 * table. This screen varies three things from that registry: the status is a `record.status`
 * (draft / published / archived) rather than a derived stage, the primary action **writes**
 * (the create band posts a draft) rather than filtering, and the row link opens an editor instead
 * of a read-only detail. There is no text search and no tab row: a template catalogue is small and
 * an operator triages by state, so a second filter would be a second answer to "which rows".
 *
 * **The create form asks for the minimum `zAssessment` accepts.** A template needs a title, a
 * summary and at least one Aspect (`items: z.array(zAspect).min(1)`), so the band asks for exactly
 * those and nothing else — the reason field every action form used to carry is gone (#732), and a
 * console create is no exception. The client does not validate the draft — the server does,
 * through the model's own schema — and a refusal is drawn from `refusals` beside the form rather
 * than invented here.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/content/core";
import type { PageCopy, PageCopySection } from "@/content/pages";
import { adminTemplatePath } from "@/lib/admin/paths";
import type { AdminTemplateRow } from "@/lib/admin/templates";
import type { TemplateCreatePayload, TemplateSaveOutcome } from "@/lib/admin/template-draft";
import { buildTemplateRecord } from "@/lib/admin/template-draft";
import { fillLabel, itemLabel, pageItemOf, sectionBody, sectionOf } from "@/lib/page-copy";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * The two columns rule 6 owns: a count of Aspects and a count of relationships started from the
 * template. The header of a numeric column takes the same edge as its cells, or the column reads
 * as a label with a number loose under it.
 */
const NUMBER_COLUMNS: ReadonlySet<string> = new Set(["aspects", "relationships"]);

/** The badge tone a state gets: a draft is in hand, a published template is the live product. */
const STATE_VARIANT: Record<string, "secondary" | "success" | "outline"> = {
  draft: "secondary",
  published: "success",
  archived: "outline",
};

/** One field in the create band: a label, an input and the id both share. */
function Field({
  id,
  label,
  value,
  onChange,
  multiline,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  multiline?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {multiline === true ? (
        <Textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </div>
  );
}

/** The refusal sentence for a code the action answered with. */
function refusalText(refusals: PageCopySection, outcome: TemplateSaveOutcome): string | null {
  if (outcome.ok) return null;
  const known = (refusals.items ?? []).find((item) => item.id === outcome.code);
  return known?.label ?? itemLabel(refusals, "failed");
}

export function TemplateRegistry({
  copy,
  rows,
  unreadable,
  onCreate,
}: {
  copy: PageCopy;
  rows: readonly AdminTemplateRow[];
  unreadable: string | null;
  /** The server action, passed in rather than imported: this module never reaches `app/`. */
  onCreate: (payload: TemplateCreatePayload) => Promise<TemplateSaveOutcome>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<TemplateSaveOutcome | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [prompt, setPrompt] = useState("");
  const [leftValue, setLeftValue] = useState("");
  const [rightValue, setRightValue] = useState("");

  const list = sectionOf(copy, "list");
  const columns = sectionOf(copy, "columns");
  const status = sectionOf(copy, "status");
  const band = sectionOf(copy, "new-draft");
  const refusals = sectionOf(copy, "refusals");
  const empty = sectionOf(copy, "empty");
  const failure = sectionOf(copy, "unreadable");

  function submit(): void {
    setOutcome(null);
    startTransition(async () => {
      const answer = await onCreate({
        record: buildTemplateRecord({
          id: "",
          slug: "",
          title,
          summary,
          status: "draft",
          date: "",
          aspects: [{ prompt, leftValue, rightValue }],
        }),
      });
      setOutcome(answer);
      if (answer.ok) {
        setCreated(answer.id);
        router.push(adminTemplatePath(answer.id));
      }
    });
  }

  if (unreadable !== null) {
    return (
      <Card data-templates-unreadable={unreadable}>
        <CardHeader>
          <CardTitle>{failure.heading}</CardTitle>
          <CardDescription>{sectionBody(failure)}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const refusal = outcome === null ? null : refusalText(refusals, outcome);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{band.heading}</CardTitle>
          <CardDescription>{sectionBody(band)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              id="template-title"
              label={itemLabel(band, "title")}
              value={title}
              onChange={setTitle}
            />
            <Field
              id="template-slug-note"
              label={itemLabel(band, "prompt")}
              value={prompt}
              onChange={setPrompt}
            />
            <Field
              id="template-left"
              label={itemLabel(band, "left")}
              value={leftValue}
              onChange={setLeftValue}
            />
            <Field
              id="template-right"
              label={itemLabel(band, "right")}
              value={rightValue}
              onChange={setRightValue}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="template-summary">{itemLabel(band, "summary")}</Label>
            <Textarea
              id="template-summary"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
            />
          </div>
          <div className="flex items-center gap-4">
            <Button type="button" onClick={submit} disabled={pending}>
              {pending ? itemLabel(band, "submitting") : itemLabel(band, "submit")}
            </Button>
            {created !== null ? (
              <p data-templates-created={created} className="text-sm text-muted-foreground">
                {fillLabel(itemLabel(band, "created"), { title })}
              </p>
            ) : null}
            {refusal !== null ? (
              <p
                data-templates-refusal={outcome?.ok === false ? outcome.code : ""}
                className="text-sm"
              >
                {refusal}
              </p>
            ) : null}
          </div>
          {outcome?.ok === false && outcome.problems !== undefined ? (
            <ul data-templates-problems className="space-y-1 text-sm">
              {outcome.problems.map((problem) => (
                <li key={`${problem.path}:${problem.message}`}>
                  <span className="font-mono">{problem.path || "record"}</span>
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
          <CardTitle>{list.heading}</CardTitle>
          <CardDescription>{sectionBody(list)}</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div
              data-templates-empty
              className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground"
            >
              <p className="font-medium text-foreground">{empty.heading}</p>
              <p className="mt-1">{sectionBody(empty)}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {["title", "slug", "status", "aspects", "relationships", "updated", "open"].map(
                    (id) => (
                      <TableHead
                        key={id}
                        className={NUMBER_COLUMNS.has(id) ? "text-right" : undefined}
                      >
                        {itemLabel(columns, id)}
                      </TableHead>
                    ),
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} data-template-row={row.id}>
                    <TableCell className="font-medium">{row.title}</TableCell>
                    <TableCell className="font-mono text-xs">{row.slug}</TableCell>
                    <TableCell>
                      <Badge variant={STATE_VARIANT[row.status] ?? "outline"}>
                        {itemLabel(status, row.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.aspectCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.instanceCount}</TableCell>
                    <TableCell>{formatDate(row.date)}</TableCell>
                    <TableCell>
                      <Link
                        href={adminTemplatePath(row.id)}
                        className="text-sm text-action underline-offset-4 hover:underline"
                      >
                        {pageItemOf(copy, row.editable ? "edit" : "read-only").label}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
