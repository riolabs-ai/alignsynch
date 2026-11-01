// template-ancestor: components/explore/explore-quiz-list.tsx   (variation: the template catalogue grid)
"use client";

import type { AlignmentSetting, AssessmentMode } from "@/content/assessment";
import { useV1Store } from "@/lib/v1/store";
import { Reveal } from "@/components/v1/reveal";
import { EmptyState, LoadingState, SectionIntro } from "@/components/v1/v1-ui";
import Link from "next/link";
import { useState } from "react";

/** The status word, authored once so the card and the library agree. */
const STATUS_WORD = { published: "Published", draft: "Draft", archived: "Archived" } as const;

/** The Initiator's template library, with an inline "copy into a relationship" form. */
export function TemplateLibrary() {
  const { hydrated, templates, createRelationship } = useV1Store();

  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [initiatorName, setInitiatorName] = useState("Jordan");
  const [counterpartyName, setCounterpartyName] = useState("Sam");
  const [mode, setMode] = useState<AssessmentMode>("advanced");
  const [setting, setSetting] = useState<AlignmentSetting>("soft");
  const [relationshipName, setRelationshipName] = useState("");

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-8">
        <LoadingState rows={4} />
      </div>
    );
  }

  const onCreate = (templateId: string) => {
    const rel = createRelationship({
      templateId,
      name: relationshipName.trim() || undefined,
      initiatorName,
      counterpartyName,
      mode,
      setting,
    });
    setCreatingId(null);
    window.location.assign(`/v1/relationships/${rel.id}`);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <SectionIntro
          title="Template library"
          subtitle="Every template you can copy into a relationship."
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
                <Reveal
                  variant="peek"
                  title={template.title}
                  description={`${template.items.length} Aspect${template.items.length === 1 ? "" : "s"} · ${STATUS_WORD[template.status]}`}
                  className="min-w-0 flex-1"
                  summary={
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {template.title}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          {template.items.length} Aspect{template.items.length === 1 ? "" : "s"}
                        </span>
                        <span aria-hidden>·</span>
                        <span>{STATUS_WORD[template.status]}</span>
                      </span>
                    </span>
                  }
                  detail={
                    <div className="space-y-3">
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {template.summary}
                      </p>
                      <ul className="space-y-2">
                        {template.items.map((item) => (
                          <li
                            key={item.id}
                            className="rounded-md border border-border bg-muted/30 px-3 py-2"
                          >
                            <p className="text-xs font-medium text-foreground">{item.prompt}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {item.leftValue} (1) → {item.rightValue} (5)
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  }
                />
                <button
                  type="button"
                  onClick={() => {
                    setCreatingId(creatingId === template.id ? null : template.id);
                    setRelationshipName("");
                    setInitiatorName("Jordan");
                    setCounterpartyName("Sam");
                    setMode("advanced");
                    setSetting("soft");
                  }}
                  className="inline-flex h-11 shrink-0 items-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action/90"
                >
                  Create relationship
                </button>
              </div>

              {creatingId === template.id && (
                <div className="mt-4 rounded-md border border-border bg-muted/40 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-medium text-foreground">
                      Your name
                      <input
                        value={initiatorName}
                        onChange={(event) => setInitiatorName(event.target.value)}
                        className="mt-1 h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
                      />
                    </label>
                    <label className="text-xs font-medium text-foreground">
                      Their name
                      <input
                        value={counterpartyName}
                        onChange={(event) => setCounterpartyName(event.target.value)}
                        className="mt-1 h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
                      />
                    </label>
                    <label className="text-xs font-medium text-foreground">
                      Relationship name (optional)
                      <input
                        value={relationshipName}
                        onChange={(event) => setRelationshipName(event.target.value)}
                        placeholder={template.title}
                        className="mt-1 h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-xs font-medium text-foreground">
                        Mode
                        <select
                          value={mode}
                          onChange={(event) => setMode(event.target.value as AssessmentMode)}
                          className="mt-1 h-11 w-full rounded-md border border-input bg-card px-2 text-sm"
                        >
                          <option value="advanced">Advanced (all four)</option>
                          <option value="basic" disabled>
                            Basic (Feel + Wish)
                          </option>
                        </select>
                        <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
                          Basic is a subset of Advanced. Not in this prototype.
                        </span>
                      </label>
                      <label className="text-xs font-medium text-foreground">
                        Setting
                        <select
                          value={setting}
                          onChange={(event) => setSetting(event.target.value as AlignmentSetting)}
                          className="mt-1 h-11 w-full rounded-md border border-input bg-card px-2 text-sm"
                        >
                          <option value="soft">Soft (Small Gap ok)</option>
                          <option value="full">Full (No Gap ok)</option>
                        </select>
                      </label>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setCreatingId(null)}
                      className="inline-flex h-11 items-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => onCreate(template.id)}
                      className="inline-flex h-11 items-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action/90"
                    >
                      Create and open
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
