// template-ancestor: components/console/overview.tsx   (variation: the initiator's counts and awaiting list)
"use client";

import { gapSummary, relationshipNameOf } from "@/lib/v1/derive";
import { useV1Store } from "@/lib/v1/store";
import {
  EmptyState,
  LoadingState,
  SectionIntro,
  StageBadge,
  StatTile,
} from "@/components/v1/v1-ui";
import Link from "next/link";

/** The Initiator's overview — the landing that the persona picker routes to. */
export function InitiatorOverview() {
  const { hydrated, templates, relationships } = useV1Store();

  if (!hydrated) {
    return (
      <div className="space-y-4 p-4 sm:p-8">
        <LoadingState rows={4} />
      </div>
    );
  }

  const invited = relationships.filter((rel) => rel.counterpartyName === null).length;
  const connected = relationships.filter((rel) => {
    const s = gapSummary(rel);
    return s.stage === "connected";
  }).length;
  const complete = relationships.filter((rel) => gapSummary(rel).verdict !== null).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <SectionIntro
          title="Your relationships"
          subtitle="Author a template, copy it into a relationship, and invite the other party."
        />
        <div className="flex gap-2">
          <Link
            href="/v1/initiator/templates/new"
            className="inline-flex h-11 items-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action/90"
          >
            New template
          </Link>
          <Link
            href="/v1/initiator/templates"
            className="inline-flex h-11 items-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
          >
            Template library
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Templates" value={String(templates.length)} />
        <StatTile label="Relationships" value={String(relationships.length)} />
        <StatTile label="Invited" value={String(invited)} />
        <StatTile label="Completed" value={String(complete)} />
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Relationships</h2>
        {relationships.length === 0 ? (
          <EmptyState
            title="No relationships yet"
            body="Copy a template into a relationship to see it here."
            action={
              <Link
                href="/v1/initiator/templates"
                className="inline-flex h-11 items-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action/90"
              >
                Open the template library
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {relationships.map((rel) => {
              const template = templates.find((t) => t.id === rel.templateId);
              const summary = gapSummary(rel);
              return (
                <li key={rel.id}>
                  <Link
                    href={`/v1/relationships/${rel.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {relationshipNameOf(rel, template?.title ?? "")}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {rel.initiatorName}
                        {rel.counterpartyName !== null
                          ? ` · ${rel.counterpartyName}`
                          : " · unclaimed"}
                      </p>
                    </div>
                    <StageBadge stage={summary.stage} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {connected > 0 && (
        <p className="text-xs text-muted-foreground">
          {connected} relationship{connected === 1 ? " is" : "s are"} mid-flight — the report stays
          locked until both parties have answered every Aspect.
        </p>
      )}
    </div>
  );
}
