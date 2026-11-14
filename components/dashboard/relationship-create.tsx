"use client";

// template-ancestor: components/my-quizzes/my-quizzes.tsx   (variation: a one-field chooser above the record list — a template picker that hands the reader to the flow, where a quiz's create form would write the record in place)

/**
 * "Start a relationship" — the template chooser above the member's relationship list (#533, #913).
 *
 * **This band writes nothing: starting a relationship is the create flow's modal (#913).** It used
 * to copy the template itself, and that row was written with no session and no seats — so the
 * dashboard card's `Invite Members` had no pay modal to open, and publishing it had no invitation
 * to mint. The member's own complaint was exactly that ("it's blocked to get back to the modal step
 * needed"), and the cause was a second create path beside the flow. Choosing a template here
 * navigates to `/templates/relationship/<slug>/create`, which is stage 1 of the one flow that
 * writes a relationship: Details → Settings → Aspects → **Account** (writes the draft, the session
 * and the staged invitation) → Invite (the pay modal). Every row the product can then complete has
 * what those two later stages read.
 *
 * **The picker is the member's own templates.** `listMyTemplates` supplies the options, and the
 * flow's own read re-checks the template under its own authorization when stage 1 loads, so a
 * crafted slug is refused there with a sentence rather than silently honoured here.
 *
 * **No templates is a state, not an error.** A member who has nothing to start from gets the
 * fixture's sentence and a link to create one, rather than an empty select that cannot be submitted.
 */
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PageCopy } from "@/content/pages";
import { rememberFlowOrigin } from "@/lib/flow/dialog-origin";
import { createRelationshipPath } from "@/lib/flow/paths";
import { itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

/**
 * One option in the picker — the three fields the flow's address and the reader need.
 *
 * Deliberately not `MemberTemplateRow`: the options are the **library** the flow copies from
 * (platform templates plus the member's own), not only the templates this account authored, so the
 * page maps `LibraryTemplate` down to this and the band cannot accidentally depend on a field the
 * wider read does not carry.
 */
export interface RelationshipStartTemplate {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
}

export function RelationshipStart({
  copy,
  templates,
}: {
  copy: PageCopy;
  templates: readonly RelationshipStartTemplate[];
}) {
  const fresh = sectionOf(copy, "new");
  /** The chooser holds the template's **slug**, which is the flow's address (`#794`). */
  const [slug, setSlug] = useState("");
  const router = useRouter();
  const pathname = usePathname();

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
            <div className="flex flex-col gap-2">
              <Label htmlFor="relationship-template">{itemLabel(fresh, "choose")}</Label>
              <Select value={slug} onValueChange={setSlug}>
                <SelectTrigger id="relationship-template">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.slug}>
                      {template.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {/* A navigation, not a write: the modal behind this address owns the create. */}
              <Button
                type="button"
                data-start-in-flow="true"
                data-create-relationship-trigger="true"
                disabled={slug === ""}
                onClick={(event) => {
                  if (slug === "") return;
                  /*
                   * **Where the flow was opened from, and what opened it (#979 B).** The flow's
                   * dialog is mounted by an intercepted route, so the address that opens it is the
                   * stage's own and carries no origin: the page underneath is remembered here, by
                   * the control that is standing on it, and closing returns to exactly this page
                   * with focus back on this button. Nothing is written to storage — a reload is
                   * not a re-entry.
                   */
                  rememberFlowOrigin(pathname, event.currentTarget);
                  router.push(createRelationshipPath(slug));
                }}
              >
                {itemLabel(fresh, "submit")}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
