// template-ancestor: components/assessment-flow/template-library.tsx
"use client";

import { useV1Store } from "@/lib/v1/store";
import { EmptyState, LoadingState, SectionIntro } from "@/components/v1/v1-ui";
import Link from "next/link";

/** The Initiator's template library, one card per template, each opening into the flow. */
export function TemplateLibrary() {
  const { hydrated, templates } = useV1Store();

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-8">
        <LoadingState rows={4} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <SectionIntro
          title="Template library"
          subtitle="Every template you can turn into a relationship."
        />
        <Link
          href="/v1/initiator/templates/new"
          className="inline-flex h-11 items-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action/90"
        >
          Author a template
        </Link>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          title="No templates"
          body="Author one, or the seeded library is empty."
          action={
            <Link
              href="/v1/initiator/templates/new"
              className="inline-flex h-11 items-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action/90"
            >
              Author a template
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {templates.map((template) => (
            <li key={template.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/v1/initiator/templates/${template.id}`}
                    className="text-sm font-semibold text-foreground hover:text-action"
                  >
                    {template.title}
                  </Link>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {template.summary}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {template.items.length} Aspect{template.items.length === 1 ? "" : "s"}
                  </p>
                </div>
                <Link
                  href={`/v1/initiator/templates/${template.id}`}
                  className="inline-flex h-11 shrink-0 items-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action/90"
                >
                  Start this relationship
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
