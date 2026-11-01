// template-ancestor: components/assessment-flow/template-detail.tsx
"use client";

import { useV1Store } from "@/lib/v1/store";
import { LoadingState, NotFoundState, SectionIntro } from "@/components/v1/v1-ui";
import Link from "next/link";
import { useRouter } from "next/navigation";

/** Step 1 — the template page. Its one primary action starts the relationship flow. */
export function TemplateDetail({ templateId }: { templateId: string }) {
  const { hydrated, templates, persona, startDraft } = useV1Store();
  const router = useRouter();

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-8">
        <LoadingState rows={4} />
      </div>
    );
  }

  const template = templates.find((candidate) => candidate.id === templateId);

  if (template === undefined) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-8">
        <NotFoundState
          message={`No template with id "${templateId}" exists in this prototype's store.`}
          back="/v1/initiator/templates"
        />
      </div>
    );
  }

  const start = () => {
    const draft = startDraft(template.id);
    router.push(`/v1/flow/${draft.id}`);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <SectionIntro title={template.title} subtitle={template.summary} />
        <Link
          href="/v1/initiator/templates"
          className="inline-flex h-11 shrink-0 items-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
        >
          Back to library
        </Link>
      </div>

      {persona === "visitor" && (
        <p className="text-xs text-muted-foreground">
          You&apos;re not signed in — in this prototype the persona bar stands in for a real
          account.
        </p>
      )}

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">Starter aspects</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          These are pre-loaded at the next step — you can remove, reword or add to them.
        </p>
        <ul className="mt-3 space-y-2">
          {template.items.map((aspect) => (
            <li key={aspect.id} className="text-sm">
              <p className="font-medium text-foreground">{aspect.prompt}</p>
              <p className="text-xs text-muted-foreground">
                {aspect.leftValue} → {aspect.rightValue}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={start}
          className="inline-flex h-11 items-center rounded-md bg-action px-5 text-sm font-medium text-action-foreground hover:bg-action/90"
        >
          Start this relationship
        </button>
      </div>
    </div>
  );
}
