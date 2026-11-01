// template-ancestor: components/admin/instance-registry.tsx
"use client";

import { RELATIONSHIP_STAGES, type RelationshipStage } from "@/content/stages";
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

/** The Admin's home — every relationship, every template, and the gap aggregates. */
export function AdminHome() {
  const { hydrated, relationships, templates } = useV1Store();

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-8">
        <LoadingState rows={6} />
      </div>
    );
  }

  const summaries = relationships.map(gapSummary);
  const byStage = (stage: RelationshipStage) => summaries.filter((s) => s.stage === stage).length;
  const totalGaps = summaries.reduce((sum, s) => sum + s.totalGaps, 0);
  const unmetGaps = summaries.reduce((sum, s) => sum + s.unmetGaps, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <SectionIntro
        title="Admin"
        subtitle="Every relationship, every template, and the gap aggregates across the store."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Relationships" value={String(relationships.length)} />
        {RELATIONSHIP_STAGES.map((stage) => (
          <StatTile key={stage} label={stage} value={String(byStage(stage))} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
        <StatTile label="Gaps measured" value={String(totalGaps)} />
        <StatTile label="Gaps exceeding the Setting" value={String(unmetGaps)} />
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Relationships</h2>
        {relationships.length === 0 ? (
          <EmptyState title="No relationships" body="Nothing in the store yet." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Relationship</th>
                  <th className="px-3 py-2 font-medium">Initiator</th>
                  <th className="px-3 py-2 font-medium">Counterparty</th>
                  <th className="px-3 py-2 font-medium">Stage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {relationships.map((rel) => {
                  const template = templates.find((t) => t.id === rel.templateId);
                  const summary = gapSummary(rel);
                  return (
                    <tr key={rel.id}>
                      <td className="px-4 py-2">
                        <Link
                          href={`/v1/relationships/${rel.id}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {relationshipNameOf(rel, template?.title ?? "")}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{rel.initiatorName}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {rel.counterpartyName ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <StageBadge stage={summary.stage} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Templates</h2>
        {templates.length === 0 ? (
          <EmptyState title="No templates" body="Nothing in the library yet." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Template</th>
                  <th className="px-3 py-2 font-medium">Aspects</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {templates.map((template) => (
                  <tr key={template.id}>
                    <td className="px-4 py-2">
                      <span className="font-medium text-foreground">{template.title}</span>
                      <p className="text-xs text-muted-foreground">{template.summary}</p>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{template.items.length}</td>
                    <td className="px-3 py-2 text-muted-foreground">{template.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
