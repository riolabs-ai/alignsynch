"use client";

// template-ancestor: components/explore/explore-quiz-list.tsx   (variation: the initiator's library — built-in templates vs "my saved sets", no media, no pagination)

import { Button } from "@/components/ui/button";
import type { Assessment } from "@/content/assessment";
import { v1Templates } from "@/data/v1/fixtures";
import { useV1Store } from "@/lib/v1/store";
import { EmptyState, LoadingState, SectionIntro } from "@/components/v1/v1-ui";
import { BookOpen, Plus } from "lucide-react";
import Link from "next/link";

/** One library card — a template or a saved set, with its Aspects named plainly. */
function LibraryCard({ entry, kind }: { entry: Assessment; kind: "template" | "saved-set" }) {
  return (
    <article className="flex flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:border-action">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{entry.title}</p>
        <span
          className={
            kind === "template"
              ? "shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
              : "shrink-0 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700"
          }
        >
          {kind === "template" ? "Template" : "Saved set"}
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{entry.summary}</p>
      <p className="mt-3 text-xs text-muted-foreground">
        {entry.items.length} Aspect{entry.items.length === 1 ? "" : "s"}:
      </p>
      <ul className="mt-1 space-y-0.5">
        {entry.items.map((item) => (
          <li key={item.id} className="truncate text-xs text-foreground">
            {item.prompt}
          </li>
        ))}
      </ul>
    </article>
  );
}

/**
 * `/v1/[persona]/templates` — the initiator's library (admin reads it too).
 *
 * Two shelves, told apart in the UI: **Templates** are the built-in starting points the store
 * seeds from; **My saved sets** are the Aspect sets the initiator saved from a relationship or
 * wrote in the editor — reusable for the next relationship. Both render from the same store, so
 * a saved set is a real entry the moment `saveAspectSetToLibrary` writes it, not a mock.
 */
export function RelationshipLibrary() {
  const { hydrated, templates } = useV1Store();

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-8">
        <LoadingState rows={3} />
      </div>
    );
  }

  const isBuiltIn = (entry: Assessment) => v1Templates.some((seed) => seed.id === entry.id);
  const builtIns = templates.filter(isBuiltIn);
  const savedSets = templates.filter((entry) => !isBuiltIn(entry));

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionIntro
          title="Templates"
          subtitle="The Aspect sets a relationship is built from — built-in starters, and the sets you saved."
        />
        <Button asChild variant="outline">
          <Link href="/v1/initiator/templates/new">
            <Plus className="mr-2 h-4 w-4" /> New template
          </Link>
        </Button>
      </div>

      <p className="rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground">
        A <span className="font-medium text-foreground">template</span> is a built-in starting
        point. A <span className="font-medium text-foreground">saved set</span> is your own Aspects,
        saved from a relationship, and ready to start a new one from.
      </p>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Templates</h2>
          <span className="text-xs text-muted-foreground">{builtIns.length}</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {builtIns.map((entry) => (
            <LibraryCard key={entry.id} entry={entry} kind="template" />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">My saved sets</h2>
          <span className="text-xs text-muted-foreground">{savedSets.length}</span>
        </div>
        {savedSets.length === 0 ? (
          <EmptyState
            title="No saved sets yet"
            body="Open a relationship and choose Save to library to keep its Aspects here."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {savedSets.map((entry) => (
              <LibraryCard key={entry.id} entry={entry} kind="saved-set" />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
