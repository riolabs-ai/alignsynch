"use client";

/**
 * template-ancestor: components/create/quiz-editor.tsx   (variation: the same tabs-over-panels editor, per-item accordion and add/remove/reorder, bound to a template record instead of a quiz; the preview renders the record as a party sees it through the flow's own answer sheet, and every save is an `act()`-audited draft write rather than local state)
 *
 * `/admin/templates/[id]` — draft one template (#502a).
 *
 * **What is the same as the quiz editor.** Tabs over the panels, one collapsible row per item,
 * add and remove, and a preview that shows the thing a respondent will see. That is the shape an
 * author already knows, and #336 is why this file varies it rather than inventing a fourth form.
 *
 * **What is different, and why each difference is load-bearing.**
 *
 *   - The record is a **template**: a `record` with Aspects and no parties. The guidance is
 *     `content/assessment.ts`'s — a question, a Left Value at notch 1, a Right Value at notch 5 —
 *     so the fields are the model's, not a UI's private vocabulary.
 *   - **Validation is the schema's.** This component does not decide whether a draft is a
 *     template; it posts it, and the server answers with `zAssessment`'s own findings
 *     (`{ path, message }`), which are drawn under the save band verbatim. A client-side copy of
 *     "an Aspect needs two poles" would be the second rule this card forbids.
 *   - **A save is a write.** The reason field is the audit row's sentence, and the answer carries
 *     the `admin_action` id, which the saved line prints. Local state is the *draft*; the record
 *     in Postgres is what everything else in the product reads.
 *   - **The preview cannot read a published row.** It is built from the in-progress draft, so a
 *     change is visible before it is saved — and the sheet it reuses is
 *     `components/assessment-flow/answer-form.tsx`, the flow's own party sheet (whose ancestor is
 *     `components/quiz/quiz-play.tsx`), wrapped in a disabled fieldset so no answer can be posted
 *     from a preview.
 *   - **A published template is read-only here.** Editing one in place would drift every
 *     relationship that copied it (`data:check` E31), and versioning is the next card. The inputs
 *     are disabled and the panel says so, instead of the save being refused after the fact.
 */
import { AnswerForm } from "@/components/assessment-flow/answer-form";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Assessment, AssessmentMode } from "@/content/assessment";
import { formatCurrency } from "@/content/core";
import type { PageCopy, PageCopySection } from "@/content/pages";
import { SCORE_MAX, SCORE_MIN } from "@/content/record";
import type { TemplateFormPayload, TemplateSaveOutcome } from "@/lib/admin/template-draft";
import { buildTemplateRecord } from "@/lib/admin/template-draft";
import { fillLabel, itemLabel, pageItemOf, sectionBody, sectionOf } from "@/lib/page-copy";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** One Aspect while it is being edited. `id` is absent only for a row added in this edit. */
interface AspectState {
  readonly id?: string;
  readonly prompt: string;
  readonly leftValue: string;
  readonly rightValue: string;
}

/** An empty row the author can type into; every field is theirs to fill. */
const BLANK_ASPECT: AspectState = { prompt: "", leftValue: "", rightValue: "" };

/**
 * The mode the preview draws. Basic asks Feel and Wish — the two every relationship answers — so
 * the preview shows the sheet a person actually receives. It is a constant rather than a control:
 * an instance's mode is fixed at creation (`content/assessment.ts`), and a preview toggle would
 * teach that a template has one.
 */
const PREVIEW_MODE: AssessmentMode = "basic";

/** The refusal sentence for a code, or `null` when the save succeeded. */
function refusalText(
  refusals: PageCopySection,
  outcome: TemplateSaveOutcome | null,
): string | null {
  if (outcome === null || outcome.ok) return null;
  const known = (refusals.items ?? []).find((item) => item.id === outcome.code);
  return known?.label ?? itemLabel(refusals, "failed");
}

/** A labelled text field; `disabled` is the whole of the read-only mode. */
function Field({
  id,
  label,
  value,
  onChange,
  disabled,
  multiline,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  disabled: boolean;
  multiline?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {multiline === true ? (
        <Textarea
          id={id}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          id={id}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}

export function TemplateEditor({
  copy,
  sheetCopy,
  template,
  editable,
  catalogue,
  onSave,
}: {
  copy: PageCopy;
  /** The flow's own answer-sheet copy — the preview renders that surface's words. */
  sheetCopy: PageCopy;
  template: Assessment;
  editable: boolean;
  /** The catalogue type the slug names, when it names one: realm and price are its fields. */
  catalogue: { readonly realm: string; readonly price: number } | null;
  /** The server action, passed in rather than imported: this module never reaches `app/`. */
  onSave: (payload: TemplateFormPayload) => Promise<TemplateSaveOutcome>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(template.title);
  const [summary, setSummary] = useState(template.summary);
  const [slug, setSlug] = useState(template.slug);
  const [aspects, setAspects] = useState<AspectState[]>(
    template.items.map((item) => ({
      id: item.id,
      prompt: item.prompt,
      leftValue: item.leftValue,
      rightValue: item.rightValue,
    })),
  );
  const [reason, setReason] = useState("");
  const [outcome, setOutcome] = useState<TemplateSaveOutcome | null>(null);

  const details = sectionOf(copy, "details");
  const aspectCopy = sectionOf(copy, "aspects");
  const preview = sectionOf(copy, "preview");
  const save = sectionOf(copy, "save");
  const refusals = sectionOf(copy, "refusals");
  const locked = sectionOf(copy, "locked");
  const problems = sectionOf(copy, "problems");
  const readOnly = !editable;

  /** Replace one Aspect, or add one, without mutating the array the render is reading. */
  function patchAspect(index: number, patch: Partial<AspectState>): void {
    setAspects((current) =>
      current.map((aspect, at) => (at === index ? { ...aspect, ...patch } : aspect)),
    );
  }

  /** Move one row by one place, inside the record's own order (`item.position`). */
  function moveAspect(index: number, delta: number): void {
    setAspects((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      const [row] = next.splice(index, 1);
      if (row === undefined) return current;
      next.splice(target, 0, row);
      return next;
    });
  }

  function submit(): void {
    setOutcome(null);
    startTransition(async () => {
      const answer = await onSave({
        record: buildTemplateRecord({
          id: template.id,
          slug,
          title,
          summary,
          status: template.status,
          date: template.date,
          aspects,
        }),
        reason,
      });
      setOutcome(answer);
      if (answer.ok) router.refresh();
    });
  }

  /**
   * The draft as the party's sheet will draw it. A blank row is skipped so the preview does not
   * show an Aspect nobody has written yet; the `own` answers are absent because a preview shows
   * the sheet a person is handed, never somebody's scores.
   */
  const previewAspects = aspects
    .filter((aspect) => aspect.prompt.trim() !== "")
    .map((aspect, index) => ({
      itemId: aspect.id ?? `draft-aspect-${index}`,
      prompt: aspect.prompt,
      leftValue: aspect.leftValue,
      rightValue: aspect.rightValue,
      min: SCORE_MIN,
      max: SCORE_MAX,
      own: null,
    }));

  const refusal = refusalText(refusals, outcome);

  return (
    <div className="space-y-6">
      <div
        className="flex flex-wrap items-center gap-3"
        data-template-state={readOnly ? "locked" : "draft"}
      >
        <Badge variant={readOnly ? "outline" : "secondary"}>
          {pageItemOf(copy, readOnly ? "locked" : "editable").label}
        </Badge>
        <span className="font-mono text-xs text-muted-foreground">{template.id}</span>
      </div>

      {readOnly ? (
        <Card data-template-locked>
          <CardHeader>
            <CardTitle>{locked.heading}</CardTitle>
            <CardDescription>{sectionBody(locked)}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">{pageItemOf(copy, "tab-details").label}</TabsTrigger>
          <TabsTrigger value="aspects">{pageItemOf(copy, "tab-aspects").label}</TabsTrigger>
          <TabsTrigger value="preview">{pageItemOf(copy, "tab-preview").label}</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>{details.heading}</CardTitle>
              <CardDescription>{sectionBody(details)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field
                id="editor-title"
                label={itemLabel(details, "title")}
                value={title}
                onChange={setTitle}
                disabled={readOnly}
              />
              <Field
                id="editor-summary"
                label={itemLabel(details, "summary")}
                value={summary}
                onChange={setSummary}
                disabled={readOnly}
                multiline
              />
              <Field
                id="editor-slug"
                label={itemLabel(details, "slug")}
                value={slug}
                onChange={setSlug}
                disabled={readOnly}
              />
              <dl className="grid gap-3 text-sm md:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">{itemLabel(details, "type")}</dt>
                  <dd>{itemLabel(details, "assessment")}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{itemLabel(details, "realm")}</dt>
                  <dd data-template-realm={catalogue?.realm ?? "none"}>
                    {catalogue === null ? itemLabel(details, "not-in-catalogue") : catalogue.realm}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{itemLabel(details, "price")}</dt>
                  <dd data-template-price={catalogue === null ? "none" : String(catalogue.price)}>
                    {catalogue === null
                      ? itemLabel(details, "not-in-catalogue")
                      : formatCurrency(catalogue.price)}
                  </dd>
                </div>
              </dl>
              <p className="text-xs text-muted-foreground">
                {itemLabel(details, "catalogue-note")}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aspects">
          <Card>
            <CardHeader>
              <CardTitle>{aspectCopy.heading}</CardTitle>
              <CardDescription>{sectionBody(aspectCopy)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Accordion type="multiple" className="w-full">
                {aspects.map((aspect, index) => (
                  <AccordionItem key={aspect.id ?? `new-${index}`} value={`aspect-${index}`}>
                    <AccordionTrigger>
                      {aspect.prompt.trim() || itemLabel(aspectCopy, "new-aspect")}
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      <Field
                        id={`aspect-${index}-prompt`}
                        label={itemLabel(aspectCopy, "prompt")}
                        value={aspect.prompt}
                        onChange={(next) => patchAspect(index, { prompt: next })}
                        disabled={readOnly}
                      />
                      <div className="grid gap-3 md:grid-cols-2">
                        <Field
                          id={`aspect-${index}-left`}
                          label={itemLabel(aspectCopy, "left")}
                          value={aspect.leftValue}
                          onChange={(next) => patchAspect(index, { leftValue: next })}
                          disabled={readOnly}
                        />
                        <Field
                          id={`aspect-${index}-right`}
                          label={itemLabel(aspectCopy, "right")}
                          value={aspect.rightValue}
                          onChange={(next) => patchAspect(index, { rightValue: next })}
                          disabled={readOnly}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={readOnly || index === 0}
                          onClick={() => moveAspect(index, -1)}
                        >
                          {itemLabel(aspectCopy, "up")}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={readOnly || index === aspects.length - 1}
                          onClick={() => moveAspect(index, 1)}
                        >
                          {itemLabel(aspectCopy, "down")}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={readOnly || aspects.length === 1}
                          onClick={() =>
                            setAspects((current) => current.filter((_, at) => at !== index))
                          }
                        >
                          {itemLabel(aspectCopy, "remove")}
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
              <Button
                type="button"
                variant="outline"
                disabled={readOnly}
                onClick={() => setAspects((current) => [...current, BLANK_ASPECT])}
              >
                {itemLabel(aspectCopy, "add")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle>{preview.heading}</CardTitle>
              <CardDescription>{sectionBody(preview)}</CardDescription>
            </CardHeader>
            <CardContent>
              <fieldset disabled data-template-preview>
                <AnswerForm
                  copy={sheetCopy}
                  aspects={previewAspects}
                  action="#"
                  hasAnswers={false}
                  mode={PREVIEW_MODE}
                />
              </fieldset>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {readOnly ? null : (
        <Card>
          <CardHeader>
            <CardTitle>{save.heading}</CardTitle>
            <CardDescription>{sectionBody(save)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="editor-reason">{itemLabel(save, "reason")}</Label>
              <Input
                id="editor-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Button type="button" onClick={submit} disabled={pending}>
                {pending ? itemLabel(save, "saving") : itemLabel(save, "submit")}
              </Button>
              {outcome?.ok === true ? (
                <p data-template-saved={outcome.actionId} className="text-sm text-muted-foreground">
                  {fillLabel(itemLabel(save, "saved"), { actionId: outcome.actionId })}
                </p>
              ) : null}
              {refusal !== null ? (
                <p
                  data-template-refusal={outcome?.ok === false ? outcome.code : ""}
                  className="text-sm"
                >
                  {refusal}
                </p>
              ) : null}
            </div>
            {outcome?.ok === false && outcome.problems !== undefined ? (
              <div data-template-problems className="space-y-1">
                <p className="text-sm font-medium">{problems.heading}</p>
                <p className="text-xs text-muted-foreground">{sectionBody(problems)}</p>
                <ul className="space-y-1 text-sm">
                  {outcome.problems.map((problem) => (
                    <li key={`${problem.path}:${problem.message}`}>
                      <span className="font-mono">{problem.path || "record"}</span>
                      {": "}
                      {problem.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
