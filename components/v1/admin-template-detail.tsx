// template-ancestor: components/assessment-flow/template-detail.tsx   (variation: the operator's template page — the Aspects as authored, the relationships that started from it live and archived, and the disable/enable pair the store can undo)
"use client";

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
import {
  EmptyState,
  LoadingState,
  NotFoundState,
  SectionIntro,
  StageBadge,
} from "@/components/v1/v1-ui";
import { formatDate } from "@/content/core";
import { seedSessions } from "@/data/v1/fixtures";
import {
  ADMIN_TEMPLATES_PATH,
  type AdminRelationshipRow,
  adminRelationshipPath,
  adminRelationshipRows,
  adminTemplateRows,
} from "@/lib/v1/admin-console";
import { useV1Store } from "@/lib/v1/store";
import { Power, PowerOff } from "lucide-react";
import Link from "next/link";

/** One relationship started from the template, as the list draws it. */
function RelationshipLine({ row }: { row: AdminRelationshipRow }) {
  return (
    <li
      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
      data-admin-template-relationship={row.id}
      data-admin-relationship-archived={row.archived ? "true" : "false"}
    >
      <div>
        <Link
          href={adminRelationshipPath(row.id)}
          className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          {row.name}
        </Link>
        <p className="text-xs text-muted-foreground">
          {row.initiator.name} → {row.counterparty.name ?? "—"} · {row.sessionsScored} scored ·{" "}
          {formatDate(row.lastActivity)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {row.archived && (
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
            archived
          </span>
        )}
        <StageBadge stage={row.stage} />
      </div>
    </li>
  );
}

/**
 * `/admin/console/templates/[id]` — one template, its Aspects, and every relationship that
 * started from it.
 *
 * This is the second half of "see which relationships started from each": the registry counts
 * them, this page names them. The Aspect list is the **template's blueprint** — a prompt and its
 * two named scale ends — which is authored content every persona can browse in the library; it is
 * not a party's answer, and no answer is rendered here because the rows carry none.
 */
export function AdminTemplateDetail({ templateId }: { templateId: string }) {
  const {
    hydrated,
    templates,
    relationships,
    disabledTemplateIds,
    disableTemplate,
    enableTemplate,
  } = useV1Store();

  if (!hydrated) {
    return (
      <div className="space-y-4">
        <LoadingState rows={4} />
      </div>
    );
  }

  const template = templates.find((candidate) => candidate.id === templateId);
  if (template === undefined) {
    return (
      <NotFoundState
        message={`No template "${templateId}" exists in the store.`}
        back={ADMIN_TEMPLATES_PATH}
      />
    );
  }

  const rows = adminRelationshipRows(
    relationships,
    new Map(templates.map((entry) => [entry.id, entry.title])),
    Date.now(),
    seedSessions,
  );
  const templateRow = adminTemplateRows(templates, rows, disabledTemplateIds).find(
    (entry) => entry.id === template.id,
  );
  const live = rows.filter((row) => row.templateId === template.id && !row.archived);
  const archived = rows.filter((row) => row.templateId === template.id && row.archived);
  const disabled = templateRow?.disabled ?? false;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={ADMIN_TEMPLATES_PATH}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Templates
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionIntro
          title={template.title}
          subtitle={`${template.items.length} Aspects · ${live.length} live relationship${
            live.length === 1 ? "" : "s"
          } started from it · ${archived.length} archived`}
        />
        <span
          className={
            disabled
              ? "inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700"
              : "inline-flex items-center rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700"
          }
          data-admin-template-state={disabled ? "disabled" : "enabled"}
        >
          {disabled ? "Disabled" : "Enabled"}
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Aspects</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm">
            {template.items.map((item, index) => (
              <li key={item.id} className="rounded-md border border-border px-3 py-2">
                <p className="font-medium text-foreground">
                  {index + 1}. {item.prompt}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.leftValue} → {item.rightValue} · score {item.scale.min}–{item.scale.max}
                </p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <section aria-labelledby="template-relationships" className="space-y-2">
        <h2 id="template-relationships" className="text-base font-semibold text-foreground">
          Relationships started from this template
        </h2>
        {live.length === 0 && archived.length === 0 ? (
          <EmptyState
            title="No relationship has used this template yet"
            body="Starting a relationship from the library copies this template's Aspects into a new row; that copy is what this list would show."
          />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {[...live, ...archived].map((row) => (
              <RelationshipLine key={row.id} row={row} />
            ))}
          </ul>
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Template state</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {disabled ? (
            <>
              <p>
                This template is disabled. It stays in the registry with every relationship it
                started; enabling it makes it available again. Nothing was deleted.
              </p>
              <Button
                variant="outline"
                onClick={() => enableTemplate(template.id)}
                data-admin-enable-template={template.id}
              >
                <Power className="mr-2 h-4 w-4" aria-hidden="true" />
                Enable template
              </Button>
            </>
          ) : (
            <>
              <p>
                Disabling marks the template unavailable to start from. It removes nothing — the
                relationships below keep their own copy of the Aspects.
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" data-admin-disable-trigger={template.id}>
                    <PowerOff className="mr-2 h-4 w-4" aria-hidden="true" />
                    Disable template
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disable {template.title}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The template is marked unavailable to start from. Its {live.length} live
                      relationship{live.length === 1 ? "" : "s"} and {archived.length} archived one
                      {archived.length === 1 ? "" : "s"} keep their own copy of the Aspects. Enable
                      puts it back.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => disableTemplate(template.id)}
                      data-admin-disable-confirm={template.id}
                    >
                      Disable
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
