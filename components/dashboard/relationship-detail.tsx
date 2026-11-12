"use client";

// template-ancestor: components/assessment-flow/record-detail-shell.tsx   (variation: a relationship's working panels in the actions slot, the record's frozen Aspects in the content column, and no template CTAs)

/**
 * `/dashboard/relationships/[id]` — one relationship, from draft to a live invitation (#533 phase 2),
 * re-cast onto the shared record detail shell by #795.
 *
 * **One shell with the template page, two declared axes.** `components/assessment-flow/
 * record-detail-shell.tsx` draws the identity band, the facts card, the back link and the section
 * order; this file supplies only what a *relationship* says — exactly as the template page supplies
 * only what a template says. The artifact (`docs/mockups/one-card-one-detail-v2.html` §5, approved
 * on option A) allows two differences and no others: the cover slot (a card difference, drawn by
 * `relationship-cards.tsx`) and the working panels, which exist here and not there. Before #795 this
 * screen was a stack of shadcn cards with a page `<h1>` above a `CardTitle` — two headings, no back
 * link, and a `text-2xl` panel title in a 320 px rail, which is what made the two pages read as two
 * products.
 *
 * **The panels, and `publishViewOf()` decides which renders.** The stored lifecycle status, the
 * invitation row and the instant the page rendered are one value by the time this component runs
 * (`MemberRelationshipView.view`), so the screen cannot say “link live” while the server would
 * refuse the link. In the actions slot, in this order:
 *
 *   edit       the page's edit surface, passed in as `editTrigger` — a server read this component
 *              cannot do (E34), and since #923 a **control, not a column**: the panel it opens is
 *              mounted only while that dialog/sheet is open, so no fact is on screen twice
 *   publish    the counterparty's name and address, and one button that starts the trial
 *              (or a checkout), publishes the relationship and mints the invitation
 *   republish  one click, for a link that lapsed or was revoked — and only those two, because a
 *              claimed seat is not reissued and a live link has nothing to fix
 *   complete   the payer's fee, the method on file, and the one click that opens the Gap
 *   link       the invitation link, shown **once** after it is minted
 *   closed     a terminal relationship: nothing more happens to it here
 *
 * The content column keeps the two things the record *is*: **where this stands** (the invitation's
 * state, the trial, the seat the reader holds) and **the Aspects** — the initiator's editor while
 * `draft`/`pending` (`aspectsEditable()` decided that, and the server action re-decides it under a
 * row lock), and the frozen list for everyone else.
 *
 * **The trial sentence is a first-class state.** #533 requires the screen to say plainly when a
 * trial is running and no invitation is live. That combination is a member who paid for a link that
 * stopped working, so the status card says so — `trialRunningWithoutLiveInvite()` is the same
 * function the test drives, not a second reading of the two values.
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
import { AspectList, type AspectSaveResult } from "@/components/assessment-flow/aspect-list";
import {
  DetailBand,
  DetailFacts,
  DetailPanel,
  DetailSection,
  DETAIL_MUTED,
  RecordDetailShell,
  type DetailFact,
} from "@/components/assessment-flow/record-detail-shell";
import { relationshipTypeOf } from "@/components/assessment-flow/template-card";
import { Chip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PageCopy, PageCopySection } from "@/content/pages";
import { buildTemplateRecord } from "@/lib/admin/template-draft";
import { formatCurrency, formatDate } from "@/content/core";
import {
  refusalSentence,
  type AspectsOutcome,
  type CompleteOutcome,
  type ForkOutcome,
  type PublishOutcome,
  type RepublishOutcome,
} from "@/lib/member/outcomes";
import type { MemberRelationshipView } from "@/lib/member/relationships";
import { ASPECT_EDITOR_SECTION } from "@/data/pages/dashboard-relationship-detail";
import { REALM_GROUP } from "@/data/relationship-types";
import type { AspectDraft } from "@/lib/flow/aspects";
import { fillLabel, itemLabel, pageItemOf, sectionBody, sectionOf } from "@/lib/page-copy";
import { PRICING_PATH, RELATIONSHIPS_PATH, createInviteForPath } from "@/lib/flow/paths";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

/** One Aspect while it is being edited. `id` is absent only for a row added in this edit. */
interface AspectState {
  readonly id?: string;
  readonly prompt: string;
  readonly leftValue: string;
  readonly rightValue: string;
}

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
  editTrigger,
  onSaveAspects,
  onPublish,
  onRepublish,
  onComplete,
  onFork,
  templatesHref,
}: {
  copy: PageCopy;
  relationship: MemberRelationshipView;
  /**
   * The edit surface's **door**, rendered by the page. It is a server read
   * (`readRelationshipEditState()`) that this component cannot do, so it arrives as a node and is
   * drawn first in the actions slot — configuring a relationship comes before publishing it.
   *
   * #923 — the node is a trigger (`RelationshipEditDialog`), not the form. The detail renders no
   * edit surface of its own until the person asks for one; a relationship the page cannot edit
   * (`editState` absent or `closed`) passes no node at all, which is how it stays honest.
   */
  editTrigger?: ReactNode;
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
   * #739 — the payer's last act. The screen cannot import the server action (a `"use client"`
   * module that reaches `lib/db/**` is E34's failure mode), so it arrives as a prop from the page.
   *
   * **#912 retires the two capture props that used to sit beside it.** Putting a method on file is
   * no longer done on this screen at all: `onCapture`/`onResolve` and the dialog that spent them are
   * gone, and the band links into the pay modal instead (`PaymentCaptureDialog` is deleted). One
   * card, one capture, one address.
   */
  onComplete: (payload: {
    relationshipId?: string;
    planId?: string;
    reason?: string;
  }) => Promise<CompleteOutcome>;
  /**
   * #785 — the Counterparty's one action: take this relationship's template into their own library.
   * A server action, passed in for the same reason every other write here is.
   */
  onFork: (payload: { relationshipId?: string }) => Promise<ForkOutcome>;
  /**
   * Where the forked copy landed, passed in rather than imported: the constant lives beside a module
   * that reaches Postgres, which a `"use client"` file may not value-import (E34).
   */
  templatesHref: string;
}) {
  const identityCopy = sectionOf(copy, "identity");
  /** #873 — the page's own way-back string, reused as the Counterparty notice's one door. */
  const backCopy = sectionOf(copy, "back");
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
  /** #785 — the Counterparty's one action: the fork of this relationship's template. */
  const forkCopy = sectionOf(copy, "fork");

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
  /**
   * #912 — **where the pay modal is, and nothing else.** The band no longer opens a capture of its
   * own: this is the pay walk's address (`createInviteForPath`, #794's two handles), and `null`
   * when the relationship has no session — with no session there is no invitation for stage 5 to
   * shape, so the band draws the copy that says so instead of a link that would bounce the reader
   * back to stage 1.
   */
  const payHref =
    relationship.sessionRecordId === null
      ? null
      : createInviteForPath(relationship.templateSlug, relationship.sessionRecordId);
  const [completeOutcome, setCompleteOutcome] = useState<CompleteOutcome | null>(null);
  /** #785 — the fork's answer: the copy's title, and whether it was one they already had. */
  const [forkOutcome, setForkOutcome] = useState<ForkOutcome | null>(null);

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

  /** The stored status, as its own word (the chip the facts card draws). */
  const statusLabel: string = (() => {
    const known = (statusCopy.items ?? []).find((item) => item.id === relationship.status);
    return known?.label ?? relationship.status;
  })();

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
   * #912 — **this screen no longer does that.** #748 made it a dialog here; #912 retires it, because
   * a card capture in place is a second way to pay and the pay modal is the only one. The band draws
   * a link to the modal (`payHref`) and nothing else: the plan card, Stripe's fields and the record
   * of the method all live on the one surface that owns them — stage 5's walk, which mounts
   * `components/billing/stripe-frame.tsx`.
   */

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

  /**
   * #785 — **take the template.** One click, and the answer says which of the two things happened:
   * a new copy, or the one this account already had (the store points at it rather than writing a
   * second row with the same title).
   */
  function forkTemplate(): void {
    setForkOutcome(null);
    startTransition(async () => {
      const answer = await onFork({ relationshipId: relationship.id });
      setForkOutcome(answer);
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

  /* #739 — the payer's band, and the sentences it can print. */
  const gate = relationship.completion;
  const completeRefusal =
    completeOutcome !== null && !completeOutcome.ok ? sentenceFor(refusals, completeOutcome) : null;
  const forkRefusal =
    forkOutcome !== null && !forkOutcome.ok ? sentenceFor(refusals, forkOutcome) : null;

  /* #795 — the band. A relationship's slug names its catalogue type exactly as a template's does,
     so the identity band is the same component with the same three chips. */
  const type = relationshipTypeOf(relationship.template.slug);
  const groupLabel =
    type === undefined ? "" : itemLabel(identityCopy, REALM_GROUP[type.realm].toLowerCase());
  const rolesLine =
    type === undefined
      ? undefined
      : fillLabel(itemLabel(identityCopy, "roles"), {
          initiator: type.roles.initiator,
          counterparty: type.roles.counterparty,
        });

  /* #795 — the facts card. The four the artifact draws (§5), in the same cell anatomy the template
     uses for its figures. */
  const factRows: readonly DetailFact[] = [
    {
      id: "state",
      label: pageItemOf(copy, "status").label,
      value: (
        <Chip variant="soft" data-relationship-status={relationship.status}>
          {statusLabel}
        </Chip>
      ),
    },
    {
      id: "started",
      label: pageItemOf(copy, "started").label,
      value: formatDate(relationship.createdAt),
    },
    {
      id: "published",
      label: pageItemOf(copy, "published").label,
      value:
        relationship.publishedAt === null
          ? pageItemOf(copy, "none").label
          : formatDate(relationship.publishedAt),
    },
    {
      id: "invited",
      label: pageItemOf(copy, "invited").label,
      value: relationship.counterpartyName ?? pageItemOf(copy, "none").label,
    },
  ];

  return (
    <RecordDetailShell
      scope="relationship"
      band={
        <DetailBand
          scope="relationship"
          type={type}
          title={relationship.title}
          summary={relationship.summary}
          groupLabel={groupLabel}
          rolesLine={rolesLine}
        />
      }
      facts={
        <DetailFacts
          facts={factRows}
          hooks={{ "data-relationship-facts": "true" }}
          footnote={
            <div className="flex flex-wrap items-center gap-2">
              {/* #706 — the viewer's own seat, from their party row. The facts card says it too;
                  the detail screen repeats it because this is where the absent controls would be. */}
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
          }
        />
      }
      actions={
        <>
          {editTrigger}
          {/*
            #785 — the Counterparty's one action, and the only control on this screen that is
            theirs. It sits first in the rail because for them every other band is absent, and it
            is drawn from `canForkTemplate` (a party who does not own the words) rather than from
            `!isInitiator`: the server re-asks the seat under its own lock, so this is where the
            action is offered, never whether it is allowed.
          */}
          {relationship.canForkTemplate ? (
            <DetailPanel title={forkCopy.heading} hooks={{ "data-fork-template": "true" }}>
              <p className={DETAIL_MUTED}>{sectionBody(forkCopy)}</p>
              <Button
                type="button"
                variant="outline"
                onClick={forkTemplate}
                disabled={pending}
                data-fork-template-submit="true"
              >
                {pending ? itemLabel(forkCopy, "working") : itemLabel(forkCopy, "submit")}
              </Button>
              {forkOutcome?.ok === true ? (
                <p
                  data-fork-template-saved={forkOutcome.reused ? "existing" : "created"}
                  className="text-sm"
                >
                  {fillLabel(itemLabel(forkCopy, forkOutcome.reused ? "reused" : "saved"), {
                    title: forkOutcome.title,
                    aspects: String(forkOutcome.aspectCount),
                  })}{" "}
                  <a
                    className="font-medium text-action underline underline-offset-4"
                    href={templatesHref}
                    data-fork-template-open="true"
                  >
                    {itemLabel(forkCopy, "open")}
                  </a>
                </p>
              ) : null}
              {forkRefusal === null ? null : (
                <p
                  data-fork-template-refusal={forkOutcome?.ok === false ? forkOutcome.code : ""}
                  className="text-sm"
                >
                  {forkRefusal}
                </p>
              )}
            </DetailPanel>
          ) : null}
          {methodMissing ? (
            /*
             * #690 — the hard gate. Publishing needs a method on file, and the create flow only ever
             * *asked* for one: a person who skipped the plans on stage 4 lands here, with no publish
             * button and one door to the page that sells a tier.
             *
             * #912 — **that door is now the pay modal, not `/pricing`.** `/pricing` sells a
             * subscription; it does not put a card on file, so the band sent the payer to a page that
             * could not resolve the thing it refused. The modal is the surface that takes the card,
             * and a draft that came through the flow has the session and the staged invitation it
             * needs. A draft with no session cannot open it at all (`payHref === null`), so the
             * pricing link stays as that case's door rather than being deleted from under it.
             */
            <DetailPanel
              title={publishGateCopy.heading}
              hooks={{ "data-publish-gate": "method-required" }}
            >
              <p className={DETAIL_MUTED}>{sectionBody(publishGateCopy)}</p>
              {payHref === null ? (
                <a
                  className="text-sm font-medium text-action underline underline-offset-4"
                  href={PRICING_PATH}
                  data-publish-gate-link="pricing"
                >
                  {itemLabel(publishGateCopy, "plans")}
                </a>
              ) : (
                <a
                  className="inline-flex h-9 items-center justify-center rounded-md bg-action px-3 text-sm font-semibold text-action-foreground hover:bg-action-hover"
                  href={payHref}
                  data-publish-gate-link="pay-modal"
                  data-invite-members="true"
                >
                  {itemLabel(publishGateCopy, "invite-members")}
                </a>
              )}
            </DetailPanel>
          ) : null}

          {publishableNow && relationship.hasPaymentMethod ? (
            <DetailPanel title={publishCopy.heading}>
              <p className={DETAIL_MUTED}>{sectionBody(publishCopy)}</p>
              {/*
                #912 — **Invite Members, beside the act it belongs to.** On the detail screen the
                publish panel *is* "Publish to Counterparty"; this is the other half of the pair the
                card asks for, and it is the pay modal rather than a capture. It sits above the
                fields because the money decision comes before the counterparty's address, and it is
                a plain link: the modal owns the card, this screen owns nothing payment-shaped.

                A relationship with no session has no invitation to shape, so the control is not
                drawn here — `payHref` is the same fact the list's card reads.
              */}
              {payHref === null ? null : (
                <a
                  href={payHref}
                  data-invite-members="true"
                  className="inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                >
                  {itemLabel(publishCopy, "invite-members")}
                </a>
              )}
              <div className="space-y-4">
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
                  <p className="text-sm text-muted-foreground">
                    {itemLabel(publishCopy, "mode-help")}
                  </p>
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
                  <p className="text-sm text-muted-foreground">
                    {itemLabel(publishCopy, "setting-help")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" onClick={publish} disabled={pending}>
                    {pending
                      ? itemLabel(publishCopy, "publishing")
                      : itemLabel(publishCopy, "submit")}
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
              </div>
            </DetailPanel>
          ) : null}

          {offersRepublish ? (
            <DetailPanel title={republishCopy.heading}>
              <p className={DETAIL_MUTED}>{sectionBody(republishCopy)}</p>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={republish} disabled={pending}>
                  {pending
                    ? itemLabel(republishCopy, "working")
                    : itemLabel(republishCopy, "submit")}
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
            </DetailPanel>
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
            <DetailPanel
              title={completionCopy.heading}
              hooks={{
                "data-completion-gate": gate.phase,
                "data-completion-sealed": gate.sealed ? "true" : "false",
              }}
            >
              <p className={DETAIL_MUTED}>{sectionBody(completionCopy)}</p>
              <div className="space-y-3">
                <p
                  data-completion-amount={gate.amountCents}
                  className="text-sm text-muted-foreground"
                >
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
                  <p
                    data-completion-charged={gate.chargedAt ?? "true"}
                    className="text-sm font-medium"
                  >
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
                      {/*
                        #912 — **the payer's route into the one capture.** #748 made this a button
                        that opened a dialog on this band; the dialog is deleted, because a card
                        taken in place is a second way to pay. What is left is a link to the pay
                        modal, which is the same plan card and the same Stripe frame the dialog drew,
                        on the surface that owns them.

                        `payHref` is `null` only for a relationship with no session, and this band
                        cannot render for one (`gate` is `null` without a session), so the null arm
                        is unreachable here — it is drawn as the honest sentence rather than as a
                        link to nowhere.
                      */}
                      {gate.hasMethod ? null : payHref === null ? (
                        <p data-capture-unavailable="true" className="text-sm">
                          {itemLabel(completionCopy, "capture-unavailable")}
                        </p>
                      ) : (
                        <a
                          href={payHref}
                          data-capture-method="true"
                          data-invite-members="true"
                          className="inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                        >
                          {itemLabel(completionCopy, "capture")}
                        </a>
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
                    {completeOutcome?.ok === true ? (
                      <p
                        data-completion-done={completeOutcome.status}
                        className="text-sm font-medium"
                      >
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
                  </>
                )}
              </div>
            </DetailPanel>
          ) : null}

          {shownLink === null ? null : (
            <DetailPanel
              title={linkCopy.heading}
              hooks={{ "data-invite-link": shownLink.expiresAt }}
            >
              <p className={DETAIL_MUTED}>{sectionBody(linkCopy)}</p>
              <p className="break-all font-mono text-sm">{shownLink.url}</p>
              <p className="text-sm text-muted-foreground">
                {fillLabel(itemLabel(publishCopy, "expiry"), { instant: shownLink.expiresAt })}
              </p>
            </DetailPanel>
          )}

          {relationship.closed ? (
            <DetailPanel title={closedCopy.heading} hooks={{ "data-relationship-closed": "true" }}>
              <p className={DETAIL_MUTED}>{sectionBody(closedCopy)}</p>
            </DetailPanel>
          ) : null}
        </>
      }
    >
      {/* #795 — the content column's first section: where this stands. The invitation's state, the
          trial and the seat the reader holds are facts about *this* relationship, and they were a
          stack of chips in a card before the shell pulled them into one sentence-shaped section. */}
      <DetailPanel title={viewCopy.heading} hooks={{ "data-relationship-view": relationship.view }}>
        <div className="flex flex-wrap items-center gap-2">
          <Chip variant="soft" data-relationship-invite={relationship.view}>
            {viewSentence(relationship.view)}
          </Chip>
          {relationship.trialEndsAt === null ? null : (
            <Chip variant="neutral">
              {pageItemOf(copy, "trial").label}
              <span aria-hidden className="mx-1.5">
                —
              </span>
              {formatDate(relationship.trialEndsAt)}
            </Chip>
          )}
        </div>
        <p className={DETAIL_MUTED}>{sectionBody(viewCopy)}</p>
        {trialAlone ? (
          <p data-trial-without-invite className="text-sm font-medium">
            {itemLabel(viewCopy, "trial-running-no-invite")}
          </p>
        ) : null}
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
        {/* #706 — the sentence that stands in for the three absent bands, so a Counterparty reads
            why this screen has no editor, no publish panel and no reissue control.

            #873 — **the sentence is not the dead end it used to be.** It named three destinations
            in prose and linked to none, so a Counterparty who reached this page had nothing to
            press. The one door that exists in every state is My Relationships
            (`RELATIONSHIPS_PATH`) — the list that carries the relationship *and* its assessment, so
            it is both the way back and the way to the answer for a published one. It is drawn with
            the page's own `back`/`all` string ("All relationships"), never new copy: the fixture is
            the only place these words live, and the id already exists on this route. */}
        {relationship.isInitiator ? null : (
          <div
            data-relationship-read-only="counterparty"
            className="space-y-2 rounded-md border border-gray-300 bg-gray-50 p-3 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800/60 dark:text-gray-200"
          >
            <p>{itemLabel(viewCopy, "counterparty-read-only")}</p>
            <a
              className="inline-flex h-11 items-center font-medium text-action underline underline-offset-4"
              href={RELATIONSHIPS_PATH}
              data-relationship-read-only-open="relationships"
            >
              {itemLabel(backCopy, "all")}
            </a>
          </div>
        )}
        {copy.subtitle === undefined ? null : (
          <p className="text-xs text-muted-foreground">{copy.subtitle}</p>
        )}
      </DetailPanel>

      {/* The Aspects: the initiator's editor while the relationship is `draft`/`pending`, and the
          frozen list for everyone else — a counterparty answers against these words, so the screen
          that invites them shows them. */}
      <DetailSection
        title={aspectCopy.heading}
        body={sectionBody(aspectCopy)}
        hooks={{ "data-relationship-aspects": "true" }}
      >
        {editable ? (
          <div className="mt-4 space-y-4">
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
          </div>
        ) : (
          <ol className="mt-4 grid gap-3">
            {aspects.map((aspect, index) => (
              <li
                key={aspect.id ?? `row-${String(index + 1)}`}
                data-relationship-aspect={aspect.id ?? `row-${String(index + 1)}`}
                className="rounded-lg border border-border bg-card p-6"
              >
                <p className="text-sm font-semibold text-foreground">{aspect.prompt}</p>
                <p className={`mt-2 ${DETAIL_MUTED}`}>
                  <span className="font-medium text-foreground">
                    {itemLabel(aspectCopy, "left")}
                  </span>
                  <span aria-hidden className="mx-1.5">
                    —
                  </span>
                  {aspect.leftValue}
                </p>
                <p className={DETAIL_MUTED}>
                  <span className="font-medium text-foreground">
                    {itemLabel(aspectCopy, "right")}
                  </span>
                  <span aria-hidden className="mx-1.5">
                    —
                  </span>
                  {aspect.rightValue}
                </p>
              </li>
            ))}
          </ol>
        )}
      </DetailSection>
    </RecordDetailShell>
  );
}
