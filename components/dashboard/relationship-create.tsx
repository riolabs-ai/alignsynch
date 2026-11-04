"use client";

// template-ancestor: components/my-quizzes/my-quizzes.tsx   (variation: a four-field create band above the list — a template picker instead of a title/thumbnail form, and the outcome a link to the relationship it started rather than a card inserted into the grid)

/**
 * "Start a relationship" — the band above the member's relationship list (#533 phase 2).
 *
 * **The picker is the member's own templates, and the server re-checks it.** `listMyTemplates`
 * supplies the options; `createRelationship` re-reads the template under `FOR SHARE` inside the
 * transaction and refuses `not-yours` for a row the actor does not own. The picker is a convenience,
 * not the rule — a posted id for somebody else's template is refused with a sentence, which is what
 * #533's "enforce in the server action" means when the control happens to be a `<Select>`.
 *
 * **The copy is honest about what starting does.** A relationship gets its own copy of the Aspects,
 * so configuring it later cannot mutate the template; the band says so, because "start" otherwise
 * reads like a reference.
 *
 * **No templates is a state, not an error.** A member who has nothing to start from gets the
 * fixture's sentence and a link to create one, rather than an empty select that cannot be submitted.
 */
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PageCopy, PageCopySection } from "@/content/pages";
import type { MemberTemplateRow } from "@/lib/member/templates";
import type { RelationshipCreateOutcome } from "@/lib/member/outcomes";
import { itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import Link from "next/link";
import { useState, useTransition } from "react";

/** The sentence for a refusal code: the fixture's line for that id, else `failed`. */
function lineFor(refusals: PageCopySection, outcome: { code: string; message?: string }): string {
  const known = (refusals.items ?? []).find((item) => item.id === outcome.code);
  if (known !== undefined) return known.label;
  if (outcome.message !== undefined && outcome.message.trim() !== "") return outcome.message;
  return itemLabel(refusals, "failed");
}

export function RelationshipCreate({
  copy,
  templates,
  onCreate,
}: {
  copy: PageCopy;
  templates: readonly MemberTemplateRow[];
  onCreate: (payload: {
    templateId?: string;
    reason?: string;
  }) => Promise<RelationshipCreateOutcome>;
}) {
  const fresh = sectionOf(copy, "new");
  const [templateId, setTemplateId] = useState("");
  const [reason, setReason] = useState("");
  const [outcome, setOutcome] = useState<RelationshipCreateOutcome | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(): void {
    setOutcome(null);
    startTransition(async () => {
      setOutcome(await onCreate({ templateId, reason }));
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{fresh.heading}</CardTitle>
        <CardDescription>{sectionBody(fresh)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {templates.length === 0 ? (
          <div data-relationship-create-empty className="space-y-2">
            <p className="text-sm text-muted-foreground">{itemLabel(fresh, "none")}</p>
            <Link className="text-sm underline underline-offset-4" href="/dashboard/templates">
              {itemLabel(fresh, "new-template")}
            </Link>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="relationship-template">{itemLabel(fresh, "choose")}</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger id="relationship-template">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="relationship-reason">{itemLabel(fresh, "reason")}</Label>
                <Input
                  id="relationship-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Button type="button" onClick={submit} disabled={pending || templateId === ""}>
                {pending ? itemLabel(fresh, "starting") : itemLabel(fresh, "submit")}
              </Button>
              {outcome?.ok === true ? (
                <p data-relationship-created={outcome.actionId} className="text-sm">
                  {itemLabel(fresh, "created")}{" "}
                  <Link
                    className="underline underline-offset-4"
                    href={`/dashboard/relationships/${outcome.id}`}
                  >
                    {itemLabel(fresh, "open")}
                  </Link>
                </p>
              ) : null}
              {outcome !== null && !outcome.ok ? (
                <p data-relationship-create-refusal={outcome.code} className="text-sm">
                  {lineFor(sectionOf(copy, "new"), outcome)}
                </p>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
