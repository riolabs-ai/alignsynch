"use client";

// template-ancestor: components/v1/template-editor.tsx   (variation: Aspects of a live relationship instead of a template — add, rename, reorder, and a soft delete with restore)

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
import { Input } from "@/components/ui/input";
import type { Aspect } from "@/content/assessment";
import type { V1Relationship } from "@/data/v1/fixtures";
import { useV1Store } from "@/lib/v1/store";
import { ArrowDown, ArrowUp, PlusCircle, RotateCcw, Trash2 } from "lucide-react";

/** A blueprint is a conversation aid, not an inventory — cap it where the taxonomy tops out. */
const MAX_ASPECTS = 8;

/** A fresh Aspect is authored valid, so the initiator renames it rather than filling a blank. */
function blankAspect(): Omit<Aspect, "id" | "scale"> {
  return { prompt: "New Aspect", leftValue: "Left Value", rightValue: "Right Value" };
}

/**
 * The Aspects editor, reached from a relationship's detail page for the initiator alone.
 *
 * It varies `template-editor.tsx` on one axis: the Aspects belong to a *relationship*, not a
 * library template, so a delete is **soft** — the Aspect leaves the blueprint but stays in
 * `deletedAspects` and is restorable, because the parties' answers keyed by its id must survive.
 * Add, rename, reorder and restore are immediate writes to the store; delete is the one
 * irreversible-looking act and gets the AlertDialog.
 */
export function RelationshipAspectsEditor({ rel }: { rel: V1Relationship }) {
  const { addAspect, renameAspect, moveAspect, deleteAspect, restoreAspect } = useV1Store();

  const commit = (itemId: string, field: "prompt" | "leftValue" | "rightValue", value: string) => {
    const current = rel.items.find((item) => item.id === itemId)?.[field];
    if (current !== undefined && current !== value.trim()) {
      renameAspect(rel.id, itemId, { [field]: value.trim() });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {rel.items.length} Aspect{rel.items.length === 1 ? "" : "s"} in this relationship. Rename
          an Aspect, reorder it, or remove it — removed Aspects can be restored.
        </p>
        <Button
          size="sm"
          onClick={() => {
            if (rel.items.length >= MAX_ASPECTS) return;
            const blank = blankAspect();
            addAspect(rel.id, {
              prompt: blank.prompt,
              leftValue: blank.leftValue,
              rightValue: blank.rightValue,
            });
          }}
          disabled={rel.items.length >= MAX_ASPECTS}
        >
          <PlusCircle className="mr-2 h-4 w-4" /> Add aspect
        </Button>
      </div>

      {rel.items.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No Aspects yet. Add the first.
        </p>
      ) : (
        <ol className="space-y-2">
          {rel.items.map((item, index) => (
            <li key={item.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <span className="w-6 shrink-0 text-center text-xs font-medium text-muted-foreground">
                  {index + 1}
                </span>
                <Input
                  defaultValue={item.prompt}
                  aria-label="Aspect question"
                  onBlur={(event) => commit(item.id, "prompt", event.target.value)}
                  className="flex-1"
                />
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Move aspect up"
                    disabled={index === 0}
                    onClick={() => moveAspect(rel.id, item.id, "up")}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Move aspect down"
                    disabled={index === rel.items.length - 1}
                    onClick={() => moveAspect(rel.id, item.id, "down")}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Delete aspect"
                        disabled={rel.items.length <= 1}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove this Aspect?</AlertDialogTitle>
                        <AlertDialogDescription>
                          &ldquo;{item.prompt}&rdquo; leaves the blueprint, so the next session no
                          longer asks it. Both parties&apos; answers on it stay stored, and you can
                          restore it from the list below.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteAspect(rel.id, item.id)}>
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <div className="mt-2 grid gap-2 pl-8 sm:grid-cols-2">
                <Input
                  defaultValue={item.leftValue}
                  aria-label="Left value"
                  onBlur={(event) => commit(item.id, "leftValue", event.target.value)}
                  className="text-xs"
                />
                <Input
                  defaultValue={item.rightValue}
                  aria-label="Right value"
                  onBlur={(event) => commit(item.id, "rightValue", event.target.value)}
                  className="text-xs"
                />
              </div>
            </li>
          ))}
        </ol>
      )}

      {rel.deletedAspects.length > 0 && (
        <section className="rounded-lg border border-dashed border-border p-3">
          <p className="text-sm font-medium text-foreground">
            Removed Aspects ({rel.deletedAspects.length})
          </p>
          <ul className="mt-2 space-y-1">
            {rel.deletedAspects.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2"
              >
                <span className="truncate text-sm text-muted-foreground">{item.prompt}</span>
                <Button variant="outline" size="sm" onClick={() => restoreAspect(rel.id, item.id)}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Restore
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
