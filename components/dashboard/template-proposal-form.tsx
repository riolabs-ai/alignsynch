// template-ancestor: components/dashboard/template-gallery.tsx   (variation: the dashboard's other in-place form — same card, same labelled fields and the same `{ ok }` outcome the server actions answer, with the blank-start and copy fields replaced by one proposal's four fields and a consent box; the gallery's template picker does not exist here because the template is the route's own fact)
"use client";

/**
 * Propose a Template — the form (#1130, bundle 06 `template-proposal.html`).
 *
 * **Four fields, one of them a consent box, and no publish control anywhere.** The name, the category, who
 * it is for, and an optional note for the reviewer; the box says the template carries nothing personal and
 * that submitting does not publish it. `Submit for Review` is disabled until the required four are satisfied
 * — and the same four are re-checked by `validateProposal()` on the server, because a disabled button is a
 * paint, not a rule.
 *
 * **The sent state says what actually happened.** The review queue is undecided, so the action stores
 * nothing and the panel says so in words rather than implying a reviewer is reading it today. A future
 * queue changes the action and this fixture's `sent` body, not this component.
 *
 * Every word is `data/pages/dashboard-template-proposal.ts`'s, so the file holds no copy literal (E23).
 */
import { useState, useTransition } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { FormSurface } from "@/components/ui/form-surface";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PageCopy } from "@/content/pages";
import { TEMPLATE_CATEGORIES } from "@/data/template-categories";
import type { ProposalSubmission, TemplateProposalPayload } from "@/lib/member/proposal";
import { itemLabel, pageItemOf, sectionBody, sectionOf } from "@/lib/page-copy";

const FIELD =
  "h-9 w-full min-w-0 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100";

export function TemplateProposalForm({
  copy,
  templateId,
  defaultName,
  backHref,
  onSubmit,
}: {
  copy: PageCopy;
  templateId: string;
  defaultName: string;
  backHref: string;
  onSubmit: (payload: TemplateProposalPayload) => Promise<ProposalSubmission>;
}) {
  const fields = sectionOf(copy, "fields");
  const consent = sectionOf(copy, "consent");
  const send = sectionOf(copy, "send");
  const refusals = sectionOf(copy, "refusals");
  const sent = sectionOf(copy, "sent");
  const shared = sectionOf(copy, "shared");
  const never = sectionOf(copy, "never");

  const [name, setName] = useState(defaultName);
  const [category, setCategory] = useState("");
  const [who, setWho] = useState("");
  const [note, setNote] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [outcome, setOutcome] = useState<ProposalSubmission | null>(null);
  const [pending, startTransition] = useTransition();

  const complete = name.trim() !== "" && category !== "" && who.trim() !== "" && agreed;

  function submit(): void {
    setOutcome(null);
    startTransition(async () => {
      setOutcome(
        await onSubmit({
          templateId,
          name,
          category,
          who,
          note,
          /* The box posts its own state; the server reads a boolean, never the field's presence. */
          consent: agreed,
        }),
      );
    });
  }

  const refusal =
    outcome !== null && !outcome.ok
      ? ((refusals.items ?? []).find((item) => item.id === outcome.code)?.label ??
        itemLabel(refusals, "failed"))
      : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        {outcome?.ok === true ? (
          <div
            data-proposal-sent
            className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900"
          >
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{sent.heading}</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{sectionBody(sent)}</p>
            <Link
              href={backHref}
              className="mt-3 inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
            >
              {itemLabel(sent, "back")}
            </Link>
          </div>
        ) : (
          <FormSurface className="space-y-4 p-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="proposal-name">{itemLabel(fields, "name")}</Label>
              <Input
                id="proposal-name"
                className={FIELD}
                value={name}
                placeholder={itemLabel(fields, "name-placeholder")}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="proposal-category">{itemLabel(fields, "category")}</Label>
              <select
                id="proposal-category"
                className={FIELD}
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="">{itemLabel(fields, "category-placeholder")}</option>
                {TEMPLATE_CATEGORIES.map((key) => (
                  <option key={key} value={key}>
                    {itemLabel(fields, key)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="proposal-who">{itemLabel(fields, "who")}</Label>
              <Textarea
                id="proposal-who"
                className="w-full min-w-0"
                value={who}
                placeholder={itemLabel(fields, "who-placeholder")}
                onChange={(event) => setWho(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="proposal-note">
                {itemLabel(fields, "note")}
                <span className="ml-2 text-xs text-muted-foreground">
                  {pageItemOf(copy, "optional").label}
                </span>
              </Label>
              <Textarea
                id="proposal-note"
                className="w-full min-w-0"
                value={note}
                placeholder={itemLabel(fields, "note-placeholder")}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>

            <div className="rounded-md border border-gray-200 p-3 dark:border-gray-700">
              <div className="flex items-start gap-2">
                <input
                  id="proposal-consent"
                  type="checkbox"
                  className="mt-1"
                  checked={agreed}
                  onChange={(event) => setAgreed(event.target.checked)}
                />
                <Label htmlFor="proposal-consent" className="space-y-1">
                  <span className="block text-sm font-medium">{itemLabel(consent, "label")}</span>
                  <span className="block text-sm font-normal text-muted-foreground">
                    {itemLabel(consent, "body")}
                  </span>
                </Label>
              </div>
            </div>

            {refusal === null ? null : (
              <p role="alert" data-proposal-refusal className="text-sm">
                {refusal}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                data-proposal-submit
                disabled={!complete || pending}
                onClick={submit}
              >
                {pending ? itemLabel(send, "sending") : itemLabel(send, "submit")}
              </Button>
              <Link
                href={backHref}
                className="inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
              >
                {itemLabel(send, "cancel")}
              </Link>
            </div>
          </FormSurface>
        )}
      </div>

      <aside className="space-y-4">
        <section className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {shared.heading}
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{sectionBody(shared)}</p>
          <ul className="mt-3 space-y-1 text-sm text-gray-700 dark:text-gray-200">
            {(shared.items ?? []).map((item) => (
              <li key={item.id}>{item.label}</li>
            ))}
          </ul>
        </section>
        <section className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {never.heading}
          </h2>
          <ul className="mt-3 space-y-1 text-sm text-gray-700 dark:text-gray-200">
            {(never.items ?? []).map((item) => (
              <li key={item.id}>{item.label}</li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
