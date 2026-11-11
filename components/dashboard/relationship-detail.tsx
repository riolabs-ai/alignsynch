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
 *   publish   the counterparty's name and address, and one button that starts the trial
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
import { PaymentCaptureDialog } from "@/components/dashboard/payment-capture-dialog";
import { Chip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PageCopy, PageCopySection } from "@/content/pages";
import { buildTemplateRecord } from "@/lib/admin/template-draft";
import { formatCurrency, formatDate } from "@/content/core";
import {
  refusalSentence,
  type AspectsOutcome,
  type CaptureOutcome,
  type CompleteOutcome,
  type PublishOutcome,
  type RepublishOutcome,
} from "@/lib/member/outcomes";
import type { MemberRelationshipView } from "@/lib/member/relationships";
import { AspectList, type AspectSaveResult } from "@/components/assessment-flow/aspect-list";
import { ASPECT_EDITOR_SECTION } from "@/data/pages/dashboard-relationship-detail";
import type { AspectDraft } from "@/lib/flow/aspects";
import { fillLabel, itemLabel, pageItemOf, sectionBody, sectionOf } from "@/lib/page-copy";
import { PRICING_PATH } from "@/lib/flow/paths";
import { useRouter } from "next/navigation";
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
  onCapture,
  onResolve,
  onComplete,
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
    mode?: string;
    setting?: string;
  }) => Promise<PublishOutcome>;
  onRepublish: (payload: { relationshipId?: string; reason?: string }) => Promise<RepublishOutcome>;
  /**
   * #739 — the payer's two acts, as callbacks. The screen cannot import the server actions
   * (a `"use client"` module that reaches `lib/db/**` is E34's failure mode), so they arrive as
   * props from the page, and the page is the only place that decides which action is which.
   */
  onCapture: (payload: {
    relationshipId?: string;
    presentation?: string;
  }) => Promise<CaptureOutcome>;
  /**
   * #748 — the frame's completion. The embedded capture has no return URL to carry the provider's
   * session id, so the dialog hands it back here and the server resolves the method from the
   * session itself (never from anything the caller claims).
   */
  onResolve: (payload: {
    relationshipId?: string;
    captureSessionId?: string;
  }) => Promise<CaptureOutcome>;
  onComplete: (payload: {
    relationshipId?: string;
    planId?: string;
    reason?: string;
  }) => Promise<CompleteOutcome>;
}) {
  const viewCopy = sectionOf(copy, "view");
  const statusCopy = sectionOf(copy, "status");
  const aspectCopy = sectionOf(copy, "aspects");
  const publishCopy = sectionOf(copy, "publish");
  const publishGateCopy = sectionOf(copy, "publish-gate");
  const republishCopy = sectionOf(copy, "republish");
  const linkCopy = sectionOf(copy, "link");
  const closedCopy = sectionOf(copy, "closed");
  const refusals = sectionOf(copy, "refusals");
  const completionCopy = sectionOf(copy, "completion");
  /** #748 — the capture dialog's own copy, and the sentence a failure in it draws. */
  const captureCopy = sectionOf(copy, "capture");

  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [aspects, setAspects] = useState<AspectState[]>(
    relationship.template.items.map((item) => ({
      id: item.id,
      prompt: item.prompt,
      leftValue: item.leftValue,
      rightValue: item.rightValue,
    })),
  );
  const [aspectsOutcome, setAspectsOutcome] = useState<AspectsOutcome | null>(null);

  const [counterpartyName, setCounterpartyName] = useState("");
  const [email, setEmail] = useState("");
  /** #623 — the two settings the session opens under; written once, at publish (V18). */
  const [mode, setMode] = useState("basic");
  const [setting, setSetting] = useState("soft");
  const [publishOutcome, setPublishOutcome] = useState<PublishOutcome | null>(null);

  const [republishOutcome, setRepublishOutcome] = useState<RepublishOutcome | null>(null);
  const [captureOutcome, setCaptureOutcome] = useState<CaptureOutcome | null>(null);
  /** #748 — the capture dialog; the band's button opens it, and every outcome closes it. */
  const [captureOpen, setCaptureOpen] = useState(false);
  const [completeOutcome, setCompleteOutcome] = useState<CompleteOutcome | null>(null);

  const editable = relationship.aspectsEditable;
  const publishableNow = relationship.publishable;
  /**
   * #690 — **the hard gate at publish.** A relationship may be published from its status, but not
   * without a payment method on file: the plans on stage 4 are the soft prompt and this is the half
   * that is not optional. When the method is missing the publish band is not drawn at all — no
   * disabled button, no form whose submit would be refused — and a band that says what to do is.
   */
  const methodMissing = publishableNow && !relationship.hasPaymentMethod;
  const offersRepublish = relationship.offersRepublish;
  const trialAlone = relationship.trialWithoutLiveInvite;

  /**
   * The list the standard editor draws: the dashboard's own row type, with a stand-in id for a row
   * added in this edit, so one component can hold a row the record does not have yet.
   */
  const aspectDrafts: AspectDraft[] = aspects.map((aspect, index) => ({
    id: aspect.id ?? `new-${String(index + 1)}`,
    prompt: aspect.prompt,
    leftValue: aspect.leftValue,
    rightValue: aspect.rightValue,
  }));

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
        record: buildRecord(aspects),
        saveAs,
      });
      setAspectsOutcome(answer);
    });
  }

  /**
   * The standard editor's writer: one row, saved through the same action the status buttons use.
   *
   * A row with a `new-` id is one this screen added and the record does not hold yet, so it is sent
   * without an id and the server creates it. `saveAs` stays `draft`: saving a row is not a decision
   * to publish, and "Save and mark ready" is still the control that makes that decision.
   */
  async function persistAspects(next: readonly AspectDraft[]): Promise<AspectSaveResult> {
    const answer = await onSaveAspects({
      relationshipId: relationship.id,
      record: buildRecord(next),
      saveAs: "draft",
    });
    setAspectsOutcome(answer);
    return answer.ok ? { ok: true } : { ok: false, problem: answer.code };
  }

  /** The rows the person is looking at, kept so a status change writes them rather than the mount. */
  function mirrorAspects(next: readonly AspectDraft[]): void {
    setAspects(
      next.map((row) => ({
        id: row.id.startsWith("new-") ? undefined : row.id,
        prompt: row.prompt,
        leftValue: row.leftValue,
        rightValue: row.rightValue,
      })),
    );
  }

  /** The relationship's template record with this list on it — one builder for both writers. */
  function buildRecord(list: readonly AspectState[]) {
    return buildTemplateRecord({
      id: relationship.templateId,
      slug: relationship.template.slug,
      title: relationship.template.title,
      summary: relationship.template.summary,
      status: relationship.template.status,
      date: relationship.template.date,
      aspects: list,
    });
  }

  function publish(): void {
    setPublishOutcome(null);
    startTransition(async () => {
      const answer = await onPublish({
        relationshipId: relationship.id,
        counterpartyName,
        email,
        mode,
        setting,
      });
      setPublishOutcome(answer);
    });
  }

  function republish(): void {
    setRepublishOutcome(null);
    startTransition(async () => {
      const answer = await onRepublish({ relationshipId: relationship.id });
      setRepublishOutcome(answer);
    });
  }

  /**
   * #739 — **put a method on file.** Nothing is charged and nothing is unlocked; the completion is
   * still the payer's own click.
   *
   * #748 — **the capture is a dialog, not a page.** The button opens `PaymentCaptureDialog`, which
   * draws the plan card the artifact approves and asks the server for an **embedded** session. The
   * dialog answers every outcome itself: an inline capture (the keyless mock) lands here as a fact
   * with no frame at all, the embedded one mounts the provider's form in place, and a hosted url —
   * the path that shipped before this card, still working — is drawn below as the link it always
   * was. Nothing navigates from under a reader on the embedded path, which is the whole point.
   */
  function openCapture(): void {
    setCaptureOutcome(null);
    setCaptureOpen(true);
  }

  /** What the dialog did: the band re-reads the row, and a failure draws its own sentence. */
  function captureAnswered(answer: CaptureOutcome): void {
    setCaptureOutcome(answer);
    if (answer.ok && answer.url === null) {
      setCaptureOpen(false);
      router.refresh();
    }
  }

  /**
   * #739 — **complete and open the Gap.** One click: the fee is taken against the method on file
   * and both parties can read the report.
   *
   * `payment-method-required` is not a dead end and not an error: it carries the capture's url, so
   * the screen prints the sentence and a working link rather than a button the person cannot get
   * past. A decline is a sentence too — the retry ladder is already running on the server.
   */
  function complete(): void {
    setCompleteOutcome(null);
    startTransition(async () => {
      const answer = await onComplete({ relationshipId: relationship.id });
      setCompleteOutcome(answer);
      if (answer.ok) router.refresh();
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

  /* #739 — the payer's band, and the four sentences it can print. */
  const gate = relationship.completion;
  const captureRefusal =
    captureOutcome !== null && !captureOutcome.ok ? sentenceFor(refusals, captureOutcome) : null;
  const completeRefusal =
    completeOutcome !== null && !completeOutcome.ok ? sentenceFor(refusals, completeOutcome) : null;

  return (
    <div className="space-y-6">
      <Card data-relationship-view={relationship.view}>
        <CardHeader>
          <CardTitle>{viewCopy.heading}</CardTitle>
          <CardDescription>{sectionBody(viewCopy)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Chip variant="soft" data-relationship-status={relationship.status}>
              {(() => {
                const known = (statusCopy.items ?? []).find(
                  (item) => item.id === relationship.status,
                );
                return known?.label ?? relationship.status;
              })()}
            </Chip>
            <Chip variant="soft" data-relationship-invite={relationship.view}>
              {viewSentence(relationship.view)}
            </Chip>
            {/* #706 — the viewer's own seat, from their party row. The card says it too; the
                detail screen repeats it because this is where the absent controls would be. */}
            <Chip variant="neutral" data-viewer-role={relationship.viewerRole}>
              {relationship.viewerRole === "initiator"
                ? pageItemOf(copy, "role-initiator").label
                : pageItemOf(copy, "role-counterparty").label}
            </Chip>
            {/* #533 phase 3 — the derived membership, beside the stored status. */}
            {relationship.membership.state === "lapsed" ? (
              <Chip variant="soft" data-membership-state="lapsed">
                {pageItemOf(copy, "read-only").label}
              </Chip>
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
          {/* #706 — the sentence that stands in for the three absent bands, so a Counterparty
              reads why this screen has no editor, no publish panel and no reissue control. */}
          {relationship.isInitiator ? null : (
            <p
              data-relationship-read-only="counterparty"
              className="rounded-md border border-gray-300 bg-gray-50 p-3 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800/60 dark:text-gray-200"
            >
              {itemLabel(viewCopy, "counterparty-read-only")}
            </p>
          )}
        </CardContent>
      </Card>

      {editable ? (
        <Card>
          <CardHeader>
            <CardTitle>{aspectCopy.heading}</CardTitle>
            <CardDescription>{sectionBody(aspectCopy)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AspectList
              copy={copy}
              wordsSection={ASPECT_EDITOR_SECTION}
              validationSection={null}
              aspects={aspectDrafts}
              addRemove
              onChange={mirrorAspects}
              save={persistAspects}
            />
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

      {methodMissing ? (
        /*
         * #690 — the hard gate. Publishing needs a method on file, and the create flow only ever
         * *asked* for one: a person who skipped the plans on stage 4 lands here, with no publish
         * button and one door to the page that sells a tier. The copy is the fixture's, so the
         * sentence and the link are reviewable beside the prices they promise.
         */
        <Card data-publish-gate="method-required">
          <CardHeader>
            <CardTitle>{publishGateCopy.heading}</CardTitle>
            <CardDescription>{sectionBody(publishGateCopy)}</CardDescription>
          </CardHeader>
          <CardContent>
            <a
              className="text-sm font-medium text-action underline underline-offset-4"
              href={PRICING_PATH}
              data-publish-gate-link="pricing"
            >
              {itemLabel(publishGateCopy, "plans")}
            </a>
          </CardContent>
        </Card>
      ) : null}

      {publishableNow && relationship.hasPaymentMethod ? (
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
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="publish-mode">{itemLabel(publishCopy, "mode")}</Label>
                <select
                  id="publish-mode"
                  className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                  value={mode}
                  onChange={(event) => setMode(event.target.value)}
                >
                  <option value="basic">{itemLabel(publishCopy, "mode-basic")}</option>
                  <option value="advanced">{itemLabel(publishCopy, "mode-advanced")}</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="publish-setting">{itemLabel(publishCopy, "setting")}</Label>
                <select
                  id="publish-setting"
                  className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                  value={setting}
                  onChange={(event) => setSetting(event.target.value)}
                >
                  <option value="soft">{itemLabel(publishCopy, "setting-soft")}</option>
                  <option value="full">{itemLabel(publishCopy, "setting-full")}</option>
                </select>
              </div>
              <p className="text-sm text-muted-foreground sm:col-span-2">
                {itemLabel(publishCopy, "mode-help")}
              </p>
              <p className="text-sm text-muted-foreground sm:col-span-2">
                {itemLabel(publishCopy, "setting-help")}
              </p>
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

      {relationship.isInitiator &&
      gate !== null &&
      (!relationship.closed || gate.phase === "charged") ? (
        /*
         * #739 — the payer's two acts, and the only place either is reachable.
         *
         * Initiator only: `isInitiator` is the payer (`initiator_user_id`), and the server action
         * re-asks under a row lock (`not-the-payer`), so this band is a courtesy and not the rule.
         * Nothing is drawn for a relationship with no session (`completion === null`) or a closed
         * one — both would be an affordance the transaction refuses. The exception is a closed
         * relationship whose fee was taken: the payer keeps the receipt sentence ("the $8.95 was
         * charged on …"), because the alternative is a screen that says nothing at all about money
         * that moved.
         *
         * The four outcomes that are not success each draw a sentence: `payment-method-required`
         * carries a url the person can click, a decline names the ladder that is already running,
         * `already-charged` says the fee landed, and `not-the-payer` says whose fee it is.
         */
        <Card
          data-completion-gate={gate.phase}
          data-completion-sealed={gate.sealed ? "true" : "false"}
        >
          <CardHeader>
            <CardTitle>{completionCopy.heading}</CardTitle>
            <CardDescription>{sectionBody(completionCopy)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p data-completion-amount={gate.amountCents} className="text-sm text-muted-foreground">
              {fillLabel(itemLabel(completionCopy, "amount"), {
                amount: formatCurrency(gate.amountCents),
              })}
            </p>
            {gate.deadlineAt === null ? null : (
              <p className="text-sm text-muted-foreground">
                {fillLabel(itemLabel(completionCopy, "deadline"), {
                  instant: formatDate(gate.deadlineAt),
                })}
              </p>
            )}
            {gate.phase === "charged" ? (
              <p data-completion-charged={gate.chargedAt ?? "true"} className="text-sm font-medium">
                {fillLabel(itemLabel(completionCopy, "charged"), {
                  amount: formatCurrency(gate.amountCents),
                  instant:
                    gate.chargedAt === null
                      ? pageItemOf(copy, "none").label
                      : formatDate(gate.chargedAt),
                })}
              </p>
            ) : gate.phase === "expired" ? (
              <p data-completion-expired="true" className="text-sm">
                {itemLabel(completionCopy, "expired")}
              </p>
            ) : (
              <>
                <p
                  data-completion-method={gate.hasMethod ? "on-file" : "missing"}
                  className="text-sm"
                >
                  {gate.hasMethod
                    ? itemLabel(completionCopy, "method-on-file")
                    : itemLabel(completionCopy, "method-missing")}
                </p>
                {gate.sealed ? null : (
                  <p data-completion-seal="open" className="text-sm text-muted-foreground">
                    {itemLabel(completionCopy, "not-sealed")}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  {gate.hasMethod ? null : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={openCapture}
                      data-capture-method="true"
                    >
                      {itemLabel(completionCopy, "capture")}
                    </Button>
                  )}
                  {gate.sealed ? (
                    <Button
                      type="button"
                      onClick={complete}
                      disabled={pending}
                      data-complete-relationship="true"
                    >
                      {pending
                        ? itemLabel(completionCopy, "completing")
                        : itemLabel(completionCopy, "complete")}
                    </Button>
                  ) : null}
                </div>
                {captureOutcome?.ok === true ? (
                  <p data-capture-method-recorded="true" className="text-sm">
                    {itemLabel(completionCopy, "captured")}
                  </p>
                ) : null}
                {captureOutcome?.ok === true && captureOutcome.url !== null ? (
                  <p className="text-sm">
                    <a
                      className="text-action underline underline-offset-4"
                      href={captureOutcome.url}
                      data-capture-link="hosted"
                    >
                      {itemLabel(completionCopy, "capture-continue")}
                    </a>
                  </p>
                ) : null}
                {captureRefusal === null ? null : (
                  <p
                    data-capture-refusal={captureOutcome?.ok === false ? captureOutcome.code : ""}
                    className="text-sm"
                  >
                    {captureRefusal}
                  </p>
                )}
                {completeOutcome?.ok === true ? (
                  <p data-completion-done={completeOutcome.status} className="text-sm font-medium">
                    {fillLabel(itemLabel(completionCopy, "completed"), {
                      amount: formatCurrency(completeOutcome.amountCents),
                      status: completeOutcome.status,
                    })}
                  </p>
                ) : null}
                {completeRefusal === null ? null : (
                  <p
                    data-completion-refusal={
                      completeOutcome?.ok === false ? completeOutcome.code : ""
                    }
                    className="text-sm"
                  >
                    {completeRefusal}
                  </p>
                )}
                {completeOutcome?.ok === false && completeOutcome.url !== undefined ? (
                  <p className="text-sm">
                    <a
                      className="text-action underline underline-offset-4"
                      href={completeOutcome.url}
                      data-completion-link="capture"
                    >
                      {itemLabel(completionCopy, "pay")}
                    </a>
                  </p>
                ) : null}
                {/*
                  #748 — the capture itself. Rendered inside this band because the band is the only
                  place the control exists, and the dialog is inert until it is opened.

                  It is a dialog rather than a route: the artifact draws the provider's card fields
                  in a frame on this page, and the payer's method is recorded without the screen
                  changing under them. The hosted path (a `url` in the outcome) is still drawn above
                  as the link it was — a deployment whose adapter answers a page keeps working.
                */}
                <PaymentCaptureDialog
                  copy={captureCopy}
                  refusalFallback={itemLabel(refusals, "not-configured")}
                  relationshipId={relationship.id}
                  open={captureOpen}
                  onOpenChange={setCaptureOpen}
                  onCapture={onCapture}
                  onResolve={onResolve}
                  onCaptured={captureAnswered}
                />
              </>
            )}
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
