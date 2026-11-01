"use client";

// template-ancestor: components/create/quiz-editor.tsx   (variation: aspects replace questions, no correct answer, no preview)

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Assessment, Aspect } from "@/content/assessment";
import type { PublishStatus } from "@/content/core";
import { MAX_ASPECTS } from "@/lib/flow/template-draft";
import { useV1Store } from "@/lib/v1/store";
import {
  Archive,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  Save,
  Trash,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useState } from "react";

/**
 * One Aspect while it is being authored — the model's `Aspect` minus the parts that are
 * derived on save (the fixed `score` scale and the `aspect-1..n` id that position assigns).
 */
interface AspectDraft {
  /** Client-only key, stable across reorders so React reconciles the accordion correctly. */
  readonly key: string;
  readonly prompt: string;
  readonly leftValue: string;
  readonly rightValue: string;
}

/** The editor's working copy of a template: the fields a template stores, nothing more. */
interface EditorDraft {
  readonly title: string;
  readonly summary: string;
  readonly status: PublishStatus;
  readonly aspects: readonly AspectDraft[];
}

/** A fresh, empty template — no Aspects, so the empty state is the first thing a person sees. */
function blankDraft(): EditorDraft {
  return { title: "Untitled template", summary: "", status: "published", aspects: [] };
}

/** A stored template, read into the editor's draft shape. */
function toDraft(template: Assessment): EditorDraft {
  return {
    title: template.title,
    summary: template.summary,
    status: template.status,
    aspects: template.items.map((aspect, index) => ({
      key: `${template.id}-aspect-${index}`,
      prompt: aspect.prompt,
      leftValue: aspect.leftValue,
      rightValue: aspect.rightValue,
    })),
  };
}

/**
 * A kebab-case slug from a title, the same fold `lib/flow/templates.ts::slugFor` uses for
 * the live save. Inlined here because that module reaches `lib/db/**`, which a client
 * module may not import (E34).
 */
function slugFor(title: string): string {
  const folded = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return folded === "" ? "template" : folded;
}

/**
 * The family a summary names, read out of the one sentence the front page reads too
 * (`lib/alignment-home.ts::relationshipTypeOf`) — "Relationship Type: <Family> — …".
 * A family has no field of its own, so it is derived here rather than stored.
 */
function familyOf(summary: string): string | undefined {
  const match = /^Relationship Type:\s*([^\u2014]+?)\s+\u2014/.exec(summary.trim());
  return match?.[1] ?? undefined;
}

/** The draft, written back out as a real `Assessment` — ids and the scale assigned here. */
function buildAssessment(
  draft: EditorDraft,
  prior: Assessment | undefined,
  status: PublishStatus | undefined,
): Assessment {
  const title = draft.title.trim() === "" ? "Untitled template" : draft.title.trim();
  const items: Aspect[] = draft.aspects.map((aspect, index) => ({
    id: `aspect-${index + 1}`,
    prompt: aspect.prompt.trim(),
    scale: { kind: "score", min: 1, max: 5 },
    leftValue: aspect.leftValue.trim(),
    rightValue: aspect.rightValue.trim(),
  }));
  return {
    id: prior?.id ?? `assessment-${crypto.randomUUID()}`,
    slug: prior?.slug ?? slugFor(title),
    type: "assessment",
    status: status ?? draft.status,
    date: prior?.date ?? new Date().toISOString(),
    title,
    summary: draft.summary.trim(),
    items,
  };
}

/**
 * The template editor — a variation of `components/create/quiz-editor.tsx`.
 *
 * The axes that change: **Details** is title/summary/family instead of title/description/
 * difficulty; **Aspects** replace questions and drop the correct-answer radio (nothing here
 * is right or wrong — the "opinion kinds" are the four Feel/Wish/Think/Guess, decided per
 * relationship, never per Aspect); **Settings** drops the timer/score controls and says so
 * about mode and gap tolerance, which live on an instance, not a template; and the preview
 * dialog is dropped entirely, because a preview that scores an answer is a lie here.
 *
 * Save, Publish, Archive and Delete are all real writes to `lib/v1/store.tsx` — no server
 * action — so the template library reads what this editor writes.
 */
export function TemplateEditor({ templateId }: { templateId?: string }) {
  const { templates, saveTemplate, deleteTemplate } = useV1Store();

  const [recordId, setRecordId] = useState<string | undefined>(templateId);
  const current = recordId === undefined ? undefined : templates.find((t) => t.id === recordId);

  const [draft, setDraft] = useState<EditorDraft>(() =>
    current === undefined ? blankDraft() : toDraft(current),
  );
  // The id whose shape the draft was seeded from, so a hydration late-load adopts once.
  const [seededFrom, setSeededFrom] = useState<string | null>(current?.id ?? null);
  const [notice, setNotice] = useState<string | null>(null);

  // A template the fixtures did not carry (one saved last session) resolves only after the
  // store hydrates; adopt it once and leave a person's edits alone after that.
  useEffect(() => {
    if (recordId === undefined) return;
    const found = templates.find((t) => t.id === recordId);
    if (found !== undefined && found.id !== seededFrom) {
      setDraft(toDraft(found));
      setSeededFrom(found.id);
    }
  }, [templates, recordId, seededFrom]);

  const isNew = recordId === undefined;
  const family = familyOf(draft.summary);

  const setField = (field: "title" | "summary", value: string) =>
    setDraft((previous) => ({ ...previous, [field]: value }));

  const setStatus = (status: PublishStatus) => setDraft((previous) => ({ ...previous, status }));

  const setAspect = (index: number, field: "prompt" | "leftValue" | "rightValue", value: string) =>
    setDraft((previous) => ({
      ...previous,
      aspects: previous.aspects.map((aspect, at) =>
        at === index ? { ...aspect, [field]: value } : aspect,
      ),
    }));

  const addAspect = () =>
    setDraft((previous) => {
      if (previous.aspects.length >= MAX_ASPECTS) return previous;
      return {
        ...previous,
        aspects: [
          ...previous.aspects,
          { key: crypto.randomUUID(), prompt: "", leftValue: "", rightValue: "" },
        ],
      };
    });

  const removeAspect = (index: number) =>
    setDraft((previous) => ({
      ...previous,
      aspects: previous.aspects.filter((_, at) => at !== index),
    }));

  const moveAspect = (index: number, direction: "up" | "down") =>
    setDraft((previous) => {
      if (
        (direction === "up" && index === 0) ||
        (direction === "down" && index === previous.aspects.length - 1)
      ) {
        return previous;
      }
      const aspects = [...previous.aspects];
      const target = direction === "up" ? index - 1 : index + 1;
      const temp = aspects[index];
      aspects[index] = aspects[target];
      aspects[target] = temp;
      return { ...previous, aspects };
    });

  const persist = (status: PublishStatus | undefined) => {
    const built = buildAssessment(draft, current, status);
    saveTemplate(built);
    setRecordId(built.id);
    setSeededFrom(built.id);
    setDraft((previous) => ({ ...previous, status: built.status }));
    setNotice(
      status === "archived"
        ? "Archived — hidden from the default library."
        : "Saved to the library.",
    );
  };

  const handleDelete = () => {
    if (recordId === undefined) return;
    deleteTemplate(recordId);
    setRecordId(undefined);
    setDraft(blankDraft());
    setNotice("Deleted from the library.");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={isNew ? "Write a template" : "Edit template"}
        description="A template holds Aspects — each a question with a Left Value and a Right Value. Nothing here is right or wrong."
      />

      {notice === null ? null : (
        <p data-template-notice="true" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}

      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="aspects">Aspects</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Template information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Template title</Label>
                <Input
                  id="title"
                  value={draft.title}
                  onChange={(event) => setField("title", event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="summary">Summary</Label>
                <Textarea
                  id="summary"
                  value={draft.summary}
                  onChange={(event) => setField("summary", event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="family">Family</Label>
                <Input
                  id="family"
                  value={family ?? ""}
                  placeholder="None — the summary names no Relationship Type"
                  readOnly
                />
                <p className="text-sm text-muted-foreground">
                  Family is read from the summary&apos;s &ldquo;Relationship Type: …&rdquo;
                  sentence, not stored as its own field.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aspects" className="space-y-4 pt-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Aspects</h3>
            <Button onClick={addAspect} size="sm" disabled={draft.aspects.length >= MAX_ASPECTS}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add aspect
            </Button>
          </div>

          {draft.aspects.length === 0 ? (
            <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              No Aspects yet. Add the first — a question with a Left Value and a Right Value.
            </div>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {draft.aspects.map((aspect, index) => (
                <AccordionItem key={aspect.key} value={`aspect-${aspect.key}`}>
                  <AccordionTrigger className="hover:bg-muted/50 px-4 rounded-md">
                    <div className="flex items-center justify-between w-full pr-4">
                      <span>Aspect {index + 1}</span>
                      <div className="flex items-center space-x-2">
                        <span
                          onClick={(event) => {
                            event.stopPropagation();
                            moveAspect(index, "up");
                          }}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </span>
                        <span
                          onClick={(event) => {
                            event.stopPropagation();
                            moveAspect(index, "down");
                          }}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </span>
                        <span
                          onClick={(event) => {
                            event.stopPropagation();
                            removeAspect(index);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pt-2">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor={`aspect-${aspect.key}-prompt`}>Question</Label>
                        <Textarea
                          id={`aspect-${aspect.key}-prompt`}
                          value={aspect.prompt}
                          onChange={(event) => setAspect(index, "prompt", event.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`aspect-${aspect.key}-leftValue`}>Left Value</Label>
                        <Input
                          id={`aspect-${aspect.key}-leftValue`}
                          value={aspect.leftValue}
                          onChange={(event) => setAspect(index, "leftValue", event.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`aspect-${aspect.key}-rightValue`}>Right Value</Label>
                        <Input
                          id={`aspect-${aspect.key}-rightValue`}
                          value={aspect.rightValue}
                          onChange={(event) => setAspect(index, "rightValue", event.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Opinion kinds</Label>
                        <p className="text-sm text-muted-foreground">
                          Feel · Wish · Think · Guess. Basic Mode asks Feel &amp; Wish, Advanced
                          Mode adds Think &amp; Guess. Chosen per relationship, not per Aspect —
                          there is no correct answer here.
                        </p>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="visibility">Visibility</Label>
                <Select
                  value={draft.status}
                  onValueChange={(value) => setStatus(value as PublishStatus)}
                >
                  <SelectTrigger id="visibility">
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="published">Published (listed in the library)</SelectItem>
                    <SelectItem value="draft">Draft (not listed)</SelectItem>
                    <SelectItem value="archived">
                      Archived (hidden — instances keep their copy)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Basic Mode asks Feel &amp; Wish; Advanced Mode adds Think &amp; Guess. Mode is
                  chosen when a relationship is created, never stored on a template.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Gap tolerance</Label>
                <p className="text-sm text-muted-foreground">
                  Soft tolerates a Small Gap (1); Full tolerates none. The Setting is chosen per
                  relationship, never stored on a template.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex flex-wrap justify-end gap-2 mt-8">
        {isNew ? null : (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">
                <Archive className="mr-2 h-4 w-4" /> Archive
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Archive this template?</AlertDialogTitle>
                <AlertDialogDescription>
                  An archived template stops appearing in the default library. Relationships already
                  made keep their own copy of the Aspects.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => persist("archived")}>Archive</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {isNew ? null : (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash className="mr-2 h-4 w-4" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this template?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the template from the prototype&apos;s store. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        <Button variant="outline" onClick={() => persist(undefined)}>
          <Save className="mr-2 h-4 w-4" /> Save
        </Button>

        <Button onClick={() => persist("published")}>
          <Upload className="mr-2 h-4 w-4" /> Publish
        </Button>
      </div>
    </div>
  );
}
