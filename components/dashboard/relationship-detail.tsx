"use client";

// template-ancestor: components/my-quizzes/quiz-details.tsx   (variation: the relationship's own detail — the status band, the invitation's state and the trial notice replace the quiz's stats header, and the per-Aspect accordion becomes an editable Aspect list with a publish panel and a one-click reissue where the quiz has play/share actions)

/**
 * `/dashboard/relationships/[id]` — one relationship, from draft to a live invitation (#533 phase 2).
 *
 * **Four bands, and `publishViewOf()` decides which renders.** The stored lifecycle status, the
 * invitation row and the instant the page rendered are one value by the time this component runs
 * (`MemberRelationshipView.view`), so the screen cannot say "link live" while the server would
 * refuse the link. The bands are:
 *
 *   view      what the relationship is, and what its invitation is doing
 *   aspects   the initiator's editor, while `draft`/`pending` — `aspectsEditable()` decided that,
 *             and the server action re-decides it under a row lock
 *   publish   the counterparty's name and address, the reason, and one button that starts the trial
 *             (or a checkout), publishes the relationship and mints the invitation
 *   republish one click, for a link that lapsed or was revoked — and only those two, because a
 *             claimed seat is not reissued and a live link has nothing to fix
 *
 * **The trial sentence is a first-class state.** #533 requires the screen to say plainly when a
 * trial is running and no invitation is live. That combination is a member who paid for a link that
 * stopped working, so the band says so — `trialRunningWithoutLiveInvite()` is the same function the
 * test drives, not a second reading of the two values.
 *
 * **The link is shown once, and the screen says why.** A token is never stored (`lib/flow/tokens.ts`
 * keeps a hash), so no read can reprint it: the component keeps the url from the publish (or
 * reissue) response in state and prints it there. Reloading loses it, which is what the copy on the
 * panel tells the member before they need it.
 *
 * **Nothing here is the enforcement.** Hiding the Aspect editor for a published relationship is a
 * courtesy; `saveAspects` refuses `not-editable` inside its transaction, and a counterparty who
 * posts at it gets `not-yours` — #533's "enforce in the server action, not by hiding a button".
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PageCopy, PageCopySection } from "@/content/pages";
import { buildTemplateRecord } from "@/lib/admin/template-draft";
import { formatDate } from "@/content/core";
import {
  refusalSentence,
  type AspectsOutcome,
  type PublishOutcome,
  type RepublishOutcome,
} from "@/lib/member/outcomes";
import type { MemberRelationshipView } from "@/lib/member/relationships";
import { fillLabel, itemLabel, pageItemOf, sectionBody, sectionOf } from "@/lib/page-copy";
import { useState, useTransition } from "react";

/** One Aspect while it is being edited. `id` is absent only for a row added in this edit. */
interface AspectState {
  readonly id?: string;
  readonly prompt: string;
  readonly leftValue: string;
  readonly rightValue: string;
}

/** The blank row the "add an Aspect" control appends; every field is the member's to fill. */
const BLANK_ASPECT: AspectState = { prompt: "", leftValue: "", rightValue: "" };

/** The refusal sentence for a code: the server's own words first, then the fixture's line. */
function sentenceFor(
  refusals: PageCopySection,
  outcome: { code: string; message?: string },
): string {
  return refusalSentence(outcome.code, outcome.message, (id) => {
    const known = (refusals.items ?? []).find((item) => item.id === id);
    return known?.label ?? null;
  });
}

export function RelationshipDetail({
  copy,
  relationship,
  onSaveAspects,
  onPublish,
  onRepublish,
}: {
  copy: PageCopy;
  relationship: MemberRelationshipView;
  onSaveAspects: (payload: {
    relationshipId?: string;
    record?: unknown;
    reason?: string;
    saveAs?: string;
  }) => Promise<AspectsOutcome>;
  onPublish: (payload: {
    relationshipId?: string;
    counterpartyName?: string;
    email?: string;
    reason?: string;
  }) => Promise<PublishOutcome>;
  onRepublish: (payload: { relationshipId?: string; reason?: string }) => Promise<RepublishOutcome>;
}) {
  const viewCopy = sectionOf(copy, "view");
  const statusCopy = sectionOf(copy, "status");
  const aspectCopy = sectionOf(copy, "aspects");
  const publishCopy = sectionOf(copy, "publish");
  const republishCopy = sectionOf(copy, "republish");
  const linkCopy = sectionOf(copy, "link");
  const closedCopy = sectionOf(copy, "closed");
  const refusals = sectionOf(copy, "refusals");

  const [pending, startTransition] = useTransition();
  const [aspects, setAspects] = useState<AspectState[]>(
    relationship.template.items.map((item) => ({
      id: item.id,
      prompt: item.prompt,
      leftValue: item.leftValue,
      rightValue: item.rightValue,
    })),
  );
  const [reason, setReason] = useState("");
  const [aspectsOutcome, setAspectsOutcome] = useState<AspectsOutcome | null>(null);

  const [counterpartyName, setCounterpartyName] = useState("");
  const [email, setEmail] = useState("");
  const [publishReason, setPublishReason] = useState("");
  const [publishOutcome, setPublishOutcome] = useState<PublishOutcome | null>(null);

  const [republishReason, setRepublishReason] = useState("");
  const [republishOutcome, setRepublishOutcome] = useState<RepublishOutcome | null>(null);

  const editable = relationship.aspectsEditable;
  const publishableNow = relationship.publishable;
  const offersRepublish = relationship.offersRepublish;
  const trialAlone = relationship.trialWithoutLiveInvite;

  /** The refusal line for the view's own sentence — one id per state, from the fixture. */
  const viewSentence = (view: string): string => {
    const known = (viewCopy.items ?? []).find((item) => item.id === view);
    return known?.label ?? view;
  };

  function patchAspect(index: number, patch: Partial<AspectState>): void {
    setAspects((current) =>
      current.map((aspect, at) => (at === index ? { ...aspect, ...patch } : aspect)),
    );
  }

  function moveAspect(index: number, delta: number): void {
    setAspects((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      const [row] = next.splice(index, 1);
      if (row === undefined) return current;
      next.splice(target, 0, row);
      return next;
    });
  }

  /** Save the Aspects. `saveAs` is the only difference between the two buttons. */
  function save(saveAs: "draft" | "pending"): void {
    setAspectsOutcome(null);
    startTransition(async () => {
      const answer = await onSaveAspects({
        relationshipId: relationship.id,
        record: buildTemplateRecord({
          id: relationship.templateId,
          slug: relationship.template.slug,
          title: relationship.template.title,
          summary: relationship.template.summary,
          status: relationship.template.status,
          date: relationship.template.date,
          aspects,
        }),
        reason,
        saveAs,
      });
      setAspectsOutcome(answer);
    });
  }

  function publish(): void {
    setPublishOutcome(null);
    startTransition(async () => {
      const answer = await onPublish({
        relationshipId: relationship.id,
        counterpartyName,
        email,
        reason: publishReason,
      });
      setPublishOutcome(answer);
    });
  }

  function republish(): void {
    setRepublishOutcome(null);
    startTransition(async () => {
      const answer = await onRepublish({
        relationshipId: relationship.id,
        reason: republishReason,
      });
      setRepublishOutcome(answer);
    });
  }

  const aspectsRefusal =
    aspectsOutcome !== null && !aspectsOutcome.ok ? sentenceFor(refusals, aspectsOutcome) : null;
  const publishRefusal =
    publishOutcome !== null && !publishOutcome.ok ? sentenceFor(refusals, publishOutcome) : null;
  const republishRefusal =
    republishOutcome !== null && !republishOutcome.ok
      ? sentenceFor(refusals, republishOutcome)
      : null;

  /** The link to show: whichever mint produced it most recently, and never a stored one. */
  const shownLink =
    publishOutcome?.ok === true
      ? { url: publishOutcome.inviteLink, expiresAt: publishOutcome.inviteExpiresAt }
      : republishOutcome?.ok === true
        ? { url: republishOutcome.inviteLink, expiresAt: republishOutcome.inviteExpiresAt }
        : null;

  return (
    <div className="space-y-6">
      <Card data-relationship-view={relationship.view}>
        <CardHeader>
          <CardTitle>{viewCopy.heading}</CardTitle>
          <CardDescription>{sectionBody(viewCopy)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge variant="secondary" data-relationship-status={relationship.status}>
              {(() => {
                const known = (statusCopy.items ?? []).find(
                  (item) => item.id === relationship.status,
                );
                return known?.label ?? relationship.status;
              })()}
            </Badge>
            <Badge variant="outline" data-relationship-invite={relationship.view}>
              {viewSentence(relationship.view)}
            </Badge>
            {/* #533 phase 3 — the derived membership, beside the stored status. */}
            {relationship.membership.state === "lapsed" ? (
              <Badge variant="outline" data-membership-state="lapsed">
                {pageItemOf(copy, "read-only").label}
              </Badge>
            ) : null}
          </div>
          {/* #533 phase 3 — the sentence both parties read. It names the initiator's membership
              and the instant it ended, from the row, so a lapse is never mistaken for a failure of
              the person reading it. */}
          {relationship.lapseSentence === null ? null : (
            <p
              data-membership-sentence="lapsed"
              className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
            >
              {relationship.lapseSentence}
            </p>
          )}
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="text-muted-foreground">{pageItemOf(copy, "started").label}</dt>
              <dd>{formatDate(relationship.createdAt)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">{pageItemOf(copy, "published").label}</dt>
              <dd>
                {relationship.publishedAt === null
                  ? pageItemOf(copy, "none").label
                  : formatDate(relationship.publishedAt)}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">{pageItemOf(copy, "invited").label}</dt>
              <dd>{relationship.counterpartyName ?? pageItemOf(copy, "none").label}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">{pageItemOf(copy, "trial").label}</dt>
              <dd>
                {relationship.trialEndsAt === null
                  ? pageItemOf(copy, "none").label
                  : formatDate(relationship.trialEndsAt)}
              </dd>
            </div>
          </dl>
          {trialAlone ? (
            <p data-trial-without-invite className="text-sm font-medium">
              {itemLabel(viewCopy, "trial-running-no-invite")}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {editable ? (
        <Card>
          <CardHeader>
            <CardTitle>{aspectCopy.heading}</CardTitle>
            <CardDescription>{sectionBody(aspectCopy)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul data-aspect-editor className="space-y-3">
              {aspects.map((aspect, index) => (
                <li key={aspect.id ?? `new-${index}`} className="space-y-2 rounded-lg border p-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`aspect-prompt-${index}`}>
                      {itemLabel(aspectCopy, "prompt")}
                    </Label>
                    <Input
                      id={`aspect-prompt-${index}`}
                      value={aspect.prompt}
                      onChange={(event) => patchAspect(index, { prompt: event.target.value })}
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`aspect-left-${index}`}>
                        {itemLabel(aspectCopy, "left")}
                      </Label>
                      <Input
                        id={`aspect-left-${index}`}
                        value={aspect.leftValue}
                        onChange={(event) => patchAspect(index, { leftValue: event.target.value })}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`aspect-right-${index}`}>
                        {itemLabel(aspectCopy, "right")}
                      </Label>
                      <Input
                        id={`aspect-right-${index}`}
                        value={aspect.rightValue}
                        onChange={(event) => patchAspect(index, { rightValue: event.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => moveAspect(index, -1)}
                    >
                      {itemLabel(aspectCopy, "up")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => moveAspect(index, 1)}
                    >
                      {itemLabel(aspectCopy, "down")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setAspects((current) => current.filter((_, at) => at !== index))
                      }
                    >
                      {itemLabel(aspectCopy, "remove")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAspects((current) => [...current, BLANK_ASPECT])}
            >
              {itemLabel(aspectCopy, "add")}
            </Button>
            <div className="flex flex-col gap-2">
              <Label htmlFor="aspects-reason">{itemLabel(aspectCopy, "reason")}</Label>
              <Input
                id="aspects-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => save("draft")}
                disabled={pending}
              >
                {pending ? itemLabel(aspectCopy, "saving") : itemLabel(aspectCopy, "save-draft")}
              </Button>
              <Button type="button" onClick={() => save("pending")} disabled={pending}>
                {pending ? itemLabel(aspectCopy, "saving") : itemLabel(aspectCopy, "save-pending")}
              </Button>
              {aspectsOutcome?.ok === true ? (
                <p data-aspects-saved={aspectsOutcome.actionId} className="text-sm">
                  {fillLabel(itemLabel(aspectCopy, "saved"), {
                    status: aspectsOutcome.status,
                    actionId: aspectsOutcome.actionId,
                  })}
                </p>
              ) : null}
              {aspectsRefusal === null ? null : (
                <p
                  data-aspects-refusal={aspectsOutcome?.ok === false ? aspectsOutcome.code : ""}
                  className="text-sm"
                >
                  {aspectsRefusal}
                </p>
              )}
            </div>
            {aspectsOutcome !== null &&
            !aspectsOutcome.ok &&
            aspectsOutcome.problems !== undefined ? (
              <ul data-aspects-problems className="space-y-1 text-sm">
                {aspectsOutcome.problems.map((problem) => (
                  <li key={`${problem.path}:${problem.message}`}>
                    <span className="font-mono">{problem.path}</span>
                    {": "}
                    {problem.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {publishableNow ? (
        <Card>
          <CardHeader>
            <CardTitle>{publishCopy.heading}</CardTitle>
            <CardDescription>{sectionBody(publishCopy)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="publish-name">{itemLabel(publishCopy, "name")}</Label>
                <Input
                  id="publish-name"
                  value={counterpartyName}
                  onChange={(event) => setCounterpartyName(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="publish-email">{itemLabel(publishCopy, "email")}</Label>
                <Input
                  id="publish-email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="publish-reason">{itemLabel(publishCopy, "reason")}</Label>
              <Input
                id="publish-reason"
                value={publishReason}
                onChange={(event) => setPublishReason(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" onClick={publish} disabled={pending}>
                {pending ? itemLabel(publishCopy, "publishing") : itemLabel(publishCopy, "submit")}
              </Button>
              {publishOutcome?.ok === true ? (
                <p data-publish-expiry={publishOutcome.inviteExpiresAt} className="text-sm">
                  {fillLabel(itemLabel(publishCopy, "expiry"), {
                    instant: publishOutcome.inviteExpiresAt,
                  })}
                </p>
              ) : null}
              {publishRefusal === null ? null : (
                <p
                  data-publish-refusal={publishOutcome?.ok === false ? publishOutcome.code : ""}
                  className="text-sm"
                >
                  {publishRefusal}
                </p>
              )}
            </div>
            {publishOutcome?.ok === false && publishOutcome.url !== undefined ? (
              <p className="text-sm">
                <a className="underline underline-offset-4" href={publishOutcome.url}>
                  {itemLabel(publishCopy, "checkout")}
                </a>
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {offersRepublish ? (
        <Card>
          <CardHeader>
            <CardTitle>{republishCopy.heading}</CardTitle>
            <CardDescription>{sectionBody(republishCopy)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="republish-reason">{itemLabel(republishCopy, "reason")}</Label>
              <Input
                id="republish-reason"
                value={republishReason}
                onChange={(event) => setRepublishReason(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" onClick={republish} disabled={pending}>
                {pending ? itemLabel(republishCopy, "working") : itemLabel(republishCopy, "submit")}
              </Button>
              {republishOutcome?.ok === true ? (
                <p data-republish-expiry={republishOutcome.inviteExpiresAt} className="text-sm">
                  {fillLabel(itemLabel(republishCopy, "reissued"), {
                    instant: republishOutcome.inviteExpiresAt,
                  })}
                </p>
              ) : null}
              {republishRefusal === null ? null : (
                <p
                  data-republish-refusal={
                    republishOutcome?.ok === false ? republishOutcome.code : ""
                  }
                  className="text-sm"
                >
                  {republishRefusal}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {shownLink === null ? null : (
        <Card data-invite-link={shownLink.expiresAt}>
          <CardHeader>
            <CardTitle>{linkCopy.heading}</CardTitle>
            <CardDescription>{sectionBody(linkCopy)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="break-all font-mono text-sm">{shownLink.url}</p>
            <p className="text-sm text-muted-foreground">
              {fillLabel(itemLabel(publishCopy, "expiry"), { instant: shownLink.expiresAt })}
            </p>
          </CardContent>
        </Card>
      )}

      {relationship.closed ? (
        <Card data-relationship-closed>
          <CardHeader>
            <CardTitle>{closedCopy.heading}</CardTitle>
            <CardDescription>{sectionBody(closedCopy)}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}
    </div>
  );
}
