// template-ancestor: components/explore/explore-quiz-list.tsx   (variation: the operator's template registry — every template with how many relationships started from it, and a disable action behind a confirmation that the store can undo)
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingState, SectionIntro } from "@/components/v1/v1-ui";
import { Card, CardContent } from "@/components/ui/card";
import {
  adminRelationshipRows,
  adminTemplatePath,
  adminTemplateRows,
} from "@/lib/v1/admin-console";
import { useV1Store } from "@/lib/v1/store";
import { cn } from "@/lib/utils";
import { ChevronRight, PowerOff, Power } from "lucide-react";
import Link from "next/link";

/**
 * `/admin/console/templates` — every template in the store, and who started from it.
 *
 * The usage figure is **derived** (`adminTemplateRows` counts the relationship rows by
 * `templateId`), never a stored counter: a template's "3 started" and the three rows on the
 * registry that name it are the same array filtered twice, so a disable that hides a template
 * cannot leave a stale count behind.
 *
 * **Disable is reversible and confirmed.** It writes one entry to the store's admin slice (a set
 * of ids), which is why it can be undone with a single click and why it does not touch the
 * template record — an `Assessment` is the strict content model, and an operator decision is not
 * a property of it. The action is drawn behind an `AlertDialog` because it changes what the
 * library offers; the undo is not, because undoing a disable is not destructive.
 */
export function AdminTemplateRegistry() {
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

  const rows = adminRelationshipRows(
    relationships,
    new Map(templates.map((template) => [template.id, template.title])),
    Date.now(),
  );
  const templateRows = adminTemplateRows(templates, rows, disabledTemplateIds);
  const disabled = templateRows.filter((template) => template.disabled).length;

  return (
    <div className="space-y-5">
      <SectionIntro
        title="Templates"
        subtitle={`${templateRows.length} template${templateRows.length === 1 ? "" : "s"} in the store · ${disabled} disabled. Relationships started from a template are counted from the registry, never stored.`}
      />

      <div className="hidden md:block" data-admin-template-registry="table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead className="text-right">Aspects</TableHead>
              <TableHead className="text-right">Started from it</TableHead>
              <TableHead className="text-right">Archived</TableHead>
              <TableHead>State</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templateRows.map((template) => (
              <TableRow
                key={template.id}
                data-admin-template-row={template.id}
                data-admin-template-disabled={template.disabled ? "true" : "false"}
              >
                <TableCell>
                  <Link
                    href={adminTemplatePath(template.id)}
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {template.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">{template.id}</p>
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                  {template.aspectCount}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                  {template.startedCount} live
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                  {template.archivedCount}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                      template.disabled
                        ? "bg-slate-100 text-slate-700 border-slate-200"
                        : "bg-green-50 text-green-700 border-green-200",
                    )}
                  >
                    {template.disabled ? "Disabled" : "Enabled"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {template.disabled ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => enableTemplate(template.id)}
                        data-admin-enable-template={template.id}
                      >
                        <Power className="mr-1 h-4 w-4" aria-hidden="true" />
                        Enable
                      </Button>
                    ) : (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            data-admin-disable-trigger={template.id}
                          >
                            <PowerOff className="mr-1 h-4 w-4" aria-hidden="true" />
                            Disable
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Disable {template.title}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              A disabled template stays in the registry, with its{" "}
                              {template.startedCount} relationship
                              {template.startedCount === 1 ? "" : "s"} intact — it is marked as
                              unavailable to start from. Enable puts it back. Nothing is deleted.
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
                    )}
                    <Link
                      href={adminTemplatePath(template.id)}
                      className="inline-flex items-center text-sm text-action hover:underline"
                    >
                      Relationships
                      <ChevronRight className="ml-0.5 h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden" data-admin-template-registry="cards">
        {templateRows.map((template) => (
          <Card
            key={template.id}
            data-admin-template-row={template.id}
            data-admin-template-disabled={template.disabled ? "true" : "false"}
          >
            <CardContent className="space-y-2 pt-4">
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={adminTemplatePath(template.id)}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {template.title}
                </Link>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                    template.disabled
                      ? "bg-slate-100 text-slate-700 border-slate-200"
                      : "bg-green-50 text-green-700 border-green-200",
                  )}
                >
                  {template.disabled ? "Disabled" : "Enabled"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {template.aspectCount} Aspects · {template.startedCount} live relationship
                {template.startedCount === 1 ? "" : "s"} · {template.archivedCount} archived
              </p>
              <div className="flex items-center gap-2">
                <Link
                  href={adminTemplatePath(template.id)}
                  className="inline-flex items-center text-sm text-action hover:underline"
                >
                  Relationships
                  <ChevronRight className="ml-0.5 h-4 w-4" aria-hidden="true" />
                </Link>
                {template.disabled ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => enableTemplate(template.id)}
                    data-admin-enable-template={template.id}
                  >
                    Enable
                  </Button>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline" data-admin-disable-trigger={template.id}>
                        Disable
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Disable {template.title}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          A disabled template stays in the registry with its relationships intact —
                          it is marked as unavailable to start from. Enable puts it back.
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
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
