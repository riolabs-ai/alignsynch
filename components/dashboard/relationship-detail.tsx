"use client";

// template-ancestor: components/assessment-flow/record-detail-shell.tsx   (variation: a relationship's working panels in the actions slot, the record's frozen Aspects in the content column, and no template CTAs)

/**
 * `/dashboard/relationships/[id]` — one relationship, from draft to a live invitation (#533 phase 2),
 * re-cast onto the shared record detail shell by #795.
 *
 * **#1124 — the content column is a six-tab layer.** Discussion · Aspects · Members · Details ·
 * Settings · Payment, in the approved bundle's order, hash-addressable (`#aspects`) and driven by
 * `relationship-tabs.tsx`; the five panels this page did not already draw come from
 * `relationship-panels.tsx`. The shell's regions are unchanged — band, facts, actions, content —
 * and no write moved: the layer decides which section of the record is in front, nothing else.
 *
 * **One shell with the template page, two declared axes.** `components/assessment-flow/
 * record-detail-shell.tsx` draws the identity band, the facts card, the back link and the section
 * order; this file supplies only what a *relationship* says — exactly as the template page supplies
 * only what a template says. The artifact (`docs/reference/mockups/one-card-one-detail-v2.html` §5, approved
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
import { FlowEntryLink } from "@/components/assessment-flow/flow-entry-link";
import {
  DetailsPanel,
  DiscussionPanel,
  MembersPanel,
  PaymentPanel,
  SettingsPanel,
} from "@/components/dashboard/relationship-panels";
import { RelationshipTabs } from "@/components/dashboard/relationship-tabs";
import {
  DetailBand,
  DetailFacts,
  DetailPanel,
  DetailSection,
  DETAIL_CARD,
  DETAIL_MUTED,
  RecordDetailShell,
  type DetailFact,
} from "@/components/assessment-flow/record-detail-shell";
import { relationshipTypeOf } from "@/components/assessment-flow/template-card";
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
import { Chip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PageCopy, PageCopySection } from "@/content/pages";
import { aspectStatesOf, buildTemplateRecord } from "@/lib/admin/template-draft";
import { formatDate } from "@/content/core";
import {
  refusalSentence,
  type AbandonOutcome,
  type AspectsOutcome,
  type CancelInviteOutcome,
  type CompleteOutcome,
  type ExtensionOutcome,
  type ForkOutcome,
  type LeaveOutcome,
  type PublishOutcome,
  type RemovalRequestOutcome,
  type RepublishOutcome,
  type ResendInviteOutcome,
} from "@/lib/member/outcomes";
import type { MemberRelationshipView } from "@/lib/member/relationships";
import type { AlignmentSummary } from "@/lib/member/alignment-summary";
import { opinionKindsFor, type AssessmentMode } from "@/content/assessment";
import {
  ASPECT_EDITOR_SECTION,
  ASPECTS_LIVE_SECTION,
  RELATIONSHIP_EDIT_SECTION,
  RELATIONSHIP_GLANCE_SECTION,
} from "@/data/pages/dashboard-relationship-detail";
import { REALM_GROUP } from "@/data/relationship-types";
import type { AspectDraft } from "@/lib/flow/aspects";
import {
  fillLabel,
  itemLabel,
  itemLabelOr,
  itemOf,
  pageItemOf,
  sectionBody,
  sectionOf,
} from "@/lib/page-copy";
import {
  RELATIONSHIPS_PATH,
  answerSheetPath,
  createInviteForPath,
  reportPath,
} from "@/lib/flow/paths";
import { useRouter } from "next/navigation";
import { ArrowRight, MessageSquare, Pause, X } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";

/** One Aspect while it is being edited. `id` is absent only for a row added in this edit. */
interface AspectState {
  readonly id?: string;
  readonly prompt: string;
  readonly leftValue: string;
  readonly rightValue: string;
}

/**
 * #1121 — the no-pause answer, for a view literal that carries no pause facts.
 *
 * `readMyRelationship()` always fills `pause`; a suite that builds a `MemberRelationshipView` by
 * hand (the seven that predate this card) does not, and the screen draws a running Stage 6 for one
 * rather than inventing a pause nobody derived. Identical to `pauseOf()`'s answer for an open
 * membership with no window — one shape, one meaning.
 */
const RUNNING = {
  state: "running",
  paused: false,
  endsAt: null,
  daysLeft: null,
  extended: false,
  extensionAvailable: false,
} as const;

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

/**
 * #1135 — **the neutral confirm**, one component for the four destructive verbs.
 *
 * The rule is #1119 D-E's, and bundle 03 states it as a locked rule: a destructive action is a
 * **graphite outline button with an ×**, behind a confirm that says what survives (never a red
 * button, never a red word). One component rather than four, because the four would otherwise drift
 * apart — and because the neutral shape is the point, not the particular verb.
 *
 * The `hook` is a stable test handle (`data-destructive-action`) keyed on the verb, so a suite can
 * find "the Leave button" without matching copy that the owner may reword.
 */
function DestructiveConfirm({
  hook,
  label,
  heading,
  body,
  keepLabel,
  pendingLabel,
  pending,
  onConfirm,
}: {
  hook: string;
  label: string;
  heading: string;
  body: string;
  keepLabel: string;
  pendingLabel: string;
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={pending}
          data-destructive-action={hook}
        >
          <X aria-hidden="true" className="h-4 w-4" />
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{heading}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{keepLabel}</AlertDialogCancel>
          {/*
           * The confirm is the same neutral outline as the trigger: the dialog is where the act is
           * read, not where it turns red. `onConfirm` closes the dialog by letting the caller's
           * transition run — the panel below it draws the outcome.
           */}
          <AlertDialogAction
            onClick={onConfirm}
            className="gap-2 border border-border bg-background text-foreground hover:bg-muted"
            data-confirm-action={hook}
          >
            <X aria-hidden="true" className="h-4 w-4" />
            {pending ? pendingLabel : label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function RelationshipDetail({
  copy,
  relationship,
  editTrigger,
  settings,
  alignment,
  round,
  planPrice,
  onSaveAspects,
  onPublish,
  onRepublish,
  onComplete,
  onFork,
  onClaimExtension,
  onCancelInvite,
  onResendInvite,
  onAbandon,
  onLeave,
  onRequestRemoval,
  arrival,
  templatesHref,
  align,
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
  /**
   * #1124 — **the Settings tab's two values**, read by the page from the relationship's own edit
   * state (`readRelationshipEditState()`, #623) and passed down rather than imported: the module
   * that reads them reaches Postgres, and a `"use client"` value-import of it is E34's failure
   * mode (#228).
   *
   * Absent is a fact, not a gap — a Counterparty, or a relationship the read refuses to open for
   * editing, gets the panel's sentence about who sets these instead of two invented defaults.
   */
  settings?: { readonly mode: string; readonly setting: string };
  /**
   * The v2 rectification register's **At a Glance** tally: this round's alignment, computed by the
   * page with `alignmentSummaryOf()` over both seats' opinion rows.
   *
   * Absent (`undefined`) is a view literal written before the read existed, and the card is then
   * not drawn — never a zero, which would claim every Aspect is In Synch about answers nobody gave.
   * `null` is a relationship with no round, or a round only one side has answered: real, and the
   * page says so by drawing no tally.
   */
  alignment?: AlignmentSummary | null;
  /** The latest round's ordinal and start, from the relationship read (same rule as `alignment`). */
  round?: { readonly ordinal: number; readonly startedAt: string } | null;
  /**
   * The price after the trial, from the billing plan (`membershipPrice()`, read by the page).
   *
   * A prop, not an import: `lib/billing/payment-view.ts` is a server module and a `"use client"`
   * value-import of it is E34's failure mode (#228). Absent means the Payment tab draws no price
   * row rather than a typed one that could drift from what the plan charges.
   */
  planPrice?: string;
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
   * #1121 — the Initiator's one free week. A server action, passed in for the same reason every
   * other write on this screen is: the component may not value-import `lib/member/trial-extension`
   * (E34).
   */
  onClaimExtension: (payload: {
    relationshipId?: string;
    reason?: string;
  }) => Promise<ExtensionOutcome>;
  /**
   * #1135 — **the five ending verbs, as server actions passed in** (E34 again: this file may not
   * value-import `lib/member/relationship-close`).
   *
   * The page hands them over only for the reader the read says may use them (`relationship.hygiene`),
   * and each action re-asks the seat inside its transaction. The component's job is the confirm, the
   * pending state and the refusal sentence — never the rule.
   *
   * Optional, with a refusal as the default: a suite that builds this screen by hand draws no panel
   * (its view literal carries no `hygiene`), and a page that forgot one of them gets "the change did
   * not go through" rather than a button that silently succeeds.
   */
  onCancelInvite?: (payload: {
    relationshipId?: string;
    reason?: string;
  }) => Promise<CancelInviteOutcome>;
  onResendInvite?: (payload: { sessionRecordId?: string }) => Promise<ResendInviteOutcome>;
  onAbandon?: (payload: { relationshipId?: string; reason?: string }) => Promise<AbandonOutcome>;
  onLeave?: (payload: { relationshipId?: string; reason?: string }) => Promise<LeaveOutcome>;
  onRequestRemoval?: (payload: {
    relationshipId?: string;
    reason?: string;
  }) => Promise<RemovalRequestOutcome>;
  /**
   * #1121 — **an arrival, not a state.**
   *
   * `?from=extend` is the one query string the port keeps (§ "Prototype mechanics"): everything
   * else about a pause is derived from rows, but *"7 More Days Added"* is news about a click that
   * just landed, and a banner that appeared every visit would be a permanent claim that something
   * had just happened. `null` for every ordinary load — and the banner is the only thing it draws.
   */
  arrival?: "extend" | null;
  /**
   * Where the forked copy landed, passed in rather than imported: the constant lives beside a module
   * that reaches Postgres, which a `"use client"` file may not value-import (E34).
   */
  templatesHref: string;
  /**
   * #rect-04 — **the pair's alignment, once both sheets are in.**
   *
   * `guides/shared/results-and-align.md`: *"When you've both answered, Align puts your answers side
   * by side."* The read behind it (`readMemberAlignments` + `alignmentSummaryOf`) reaches Postgres,
   * so the page computes it and passes the finished summary: this file may only take the *type*,
   * because a `"use client"` value-import of that module is E34's failure mode (#228), and the
   * arithmetic is not duplicated here for the same reason.
   *
   * `null`/absent is the state the page is in before both have answered (and the state every suite
   * that builds this screen by hand is in): the summary is not drawn, and the rail keeps the
   * "Start/Continue Your Assessment" Next Step. A summary is never invented over answers nobody
   * gave — a bar of zeroes reads as agreement the pair never reached.
   */
  align?: AlignmentSummary | null;
}) {
  const identityCopy = sectionOf(copy, "identity");
  /** #873 — the page's own way-back string, reused as the Counterparty notice's one door. */
  const backCopy = sectionOf(copy, "back");
  const viewCopy = sectionOf(copy, "view");
  const statusCopy = sectionOf(copy, "status");
  const aspectCopy = sectionOf(copy, "aspects");
  const publishCopy = sectionOf(copy, "publish");
  const republishCopy = sectionOf(copy, "republish");
  const linkCopy = sectionOf(copy, "link");
  const closedCopy = sectionOf(copy, "closed");
  const refusals = sectionOf(copy, "refusals");
  const completionCopy = sectionOf(copy, "completion");
  /** #785 — the Counterparty's one action: the fork of this relationship's template. */
  const forkCopy = sectionOf(copy, "fork");
  /** #1121 — Stage 6's pause: the badge, the line, the Next Step and the free week. */
  const pauseCopy = sectionOf(copy, "pause");
  /* #1135 — the three panels this card adds, and their own fixtures. */
  const hygieneCopy = sectionOf(copy, "hygiene");
  const closeCopy = sectionOf(copy, "close");
  const abandonCopy = sectionOf(copy, "abandon");
  /**
   * #1124 — the tab strip's own words. `tabs` is the fixture's order, unfiltered: the six sections
   * are the record's, so every seat sees all six and the seat decides what is *inside* a panel,
   * never whether the panel exists.
   */
  const tabCopy = sectionOf(copy, "tabs");
  const tabs = (tabCopy.items ?? []).map((item) => ({ id: item.id, label: item.label }));
  /** #1133 — the live Aspects band's two sentences (the rule, and why the pencils are gone). */
  const liveAspectCopy = sectionOf(copy, ASPECTS_LIVE_SECTION);

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
  /*
   * #1135 — the five ending verbs' outcomes, plus the one client fact on the panel ("Link Copied").
   *
   * Each outcome is the server's answer, never a local guess: a refusal carries the code this page's
   * own fixture has a sentence for, and a success is drawn from the row the action just wrote.
   */
  const [cancelOutcome, setCancelOutcome] = useState<CancelInviteOutcome | null>(null);
  const [resendOutcome, setResendOutcome] = useState<ResendInviteOutcome | null>(null);
  const [abandonOutcome, setAbandonOutcome] = useState<AbandonOutcome | null>(null);
  const [leaveOutcome, setLeaveOutcome] = useState<LeaveOutcome | null>(null);
  const [removalOutcome, setRemovalOutcome] = useState<RemovalRequestOutcome | null>(null);
  const [copied, setCopied] = useState(false);
  /** The optional reason the Counterparty may leave for support, and the one for an abandonment. */
  const [removalReason, setRemovalReason] = useState("");
  const [abandonReason, setAbandonReason] = useState("");
  /**
   * #912 — **where the pay modal is, and nothing else.** This screen never captures a card: this is
   * the pay walk's address (`createInviteForPath`, #794's two handles), and `null` when the
   * relationship has no session — with no session there is no invitation for stage 5 to shape, so
   * the publish panel draws no door rather than a link that would bounce the reader back to stage 1.
   *
   * **#975 D10 (`t_90026133`) — the address is entered by a flow entry, not a document load.** This
   * page declares the create flow's `@flow` slot (`app/(mainlayout)/dashboard/relationships/
   * layout.tsx`), so a *soft* navigation to this address is intercepted and stage 5 renders as a
   * dialog over this relationship. A bare `<a>` is a document load: the interception never runs,
   * the reader loses the page they were reading, and the stage draws as a page whose `Cancel`
   * leaves to the template library. The one door drawn to this address is therefore a
   * `FlowEntryLink` — the same one the list's card already used — which also remembers this page as
   * the flow's origin, so the dialog's close returns here instead of to the library.
   */
  const payHref =
    relationship.sessionRecordId === null
      ? null
      : createInviteForPath(relationship.templateSlug, relationship.sessionRecordId);
  const [completeOutcome, setCompleteOutcome] = useState<CompleteOutcome | null>(null);
  /** #785 — the fork's answer: the copy's title, and whether it was one they already had. */
  const [forkOutcome, setForkOutcome] = useState<ForkOutcome | null>(null);
  /** #1121 — the free week's answer, so the arrival banner can name the end the write committed. */
  const [extensionOutcome, setExtensionOutcome] = useState<ExtensionOutcome | null>(null);

  const editable = relationship.aspectsEditable;
  const publishableNow = relationship.publishable;
  const offersRepublish = relationship.offersRepublish;
  const trialAlone = relationship.trialWithoutLiveInvite;

  /*
   * #1121 — **Stage 6's pause, and the four things the screen may say about it.**
   *
   * `relationship.pause` is server-derived (`pauseOf()`), so nothing here decides a state: this
   * block only chooses words. The two seats read differently on purpose — the Initiator is told what
   * expired and what brings it back, the Counterparty is told who is holding it and that nothing is
   * lost — and the Counterparty's half never names a trial, a card, an extension or a price, which
   * is the promise the whole screen is measured against (`tests/trial-pause-no-leak.test.ts`).
   */
  const pause = relationship.pause ?? RUNNING;
  const paused = pause.paused;
  /** Who to wait on / who is covered by. The initiating account's name, never a placeholder. */
  const initiatorLabel = relationship.initiatorName ?? pageItemOf(copy, "role-initiator").label;
  const pauseBadge = relationship.isInitiator
    ? itemLabel(pauseCopy, "badge")
    : fillLabel(itemLabel(pauseCopy, "badge-waiting"), { initiator: initiatorLabel });
  const pauseLine = relationship.isInitiator
    ? itemLabel(pauseCopy, "line")
    : fillLabel(itemLabel(pauseCopy, "line-waiting"), { initiator: initiatorLabel });
  /** The Next Step: what this pause is, and the one action (or two) out of it. */
  const nextStepHeading = relationship.isInitiator
    ? itemLabel(
        pauseCopy,
        pause.state === "extra-week-ended" ? "extra-ended-heading" : "trial-ended-heading",
      )
    : fillLabel(itemLabel(pauseCopy, "waiting-heading"), { initiator: initiatorLabel });
  const nextStepBody = relationship.isInitiator
    ? itemLabel(
        pauseCopy,
        pause.state === "extra-week-ended" ? "extra-ended-body" : "trial-ended-body",
      )
    : itemLabel(pauseCopy, "waiting-body");
  /**
   * #1121 — the Counterparty's one door out of a pause is *reading*, not paying.
   *
   * The results the pause froze are still theirs to read (`reportPath`), which is what the issue
   * means by "both parties keep reading". A relationship whose session is not readable falls back to
   * the list — the same door the read-only notice already uses, so the control is never dead.
   */
  const resultsHref =
    relationship.sessionRecordId === null
      ? RELATIONSHIPS_PATH
      : reportPath(relationship.sessionRecordId);
  /**
   * #1121 — the facts card's membership row, in the owner's four values.
   *
   * Initiator: the window while it runs (`Free Trial · Ends <date>` / `Extra Week · Ends <date>`),
   * then the pause (`Paused · Trial Ended` / `Paused · Extra Week Ended`). Counterparty: `Covered by
   * <name>` — the one membership fact that is theirs to have, and the one that carries no price.
   */
  const membershipFact: DetailFact | null = (() => {
    if (relationship.closed) return null;
    if (!relationship.isInitiator) {
      return {
        id: "membership",
        label: pageItemOf(copy, "membership").label,
        value: fillLabel(itemLabel(pauseCopy, "membership-covered"), {
          initiator: initiatorLabel,
        }),
      };
    }
    if (paused) {
      return {
        id: "membership",
        label: pageItemOf(copy, "membership").label,
        value: itemLabel(
          pauseCopy,
          pause.extended ? "membership-extra-ended" : "membership-trial-ended",
        ),
      };
    }
    if (relationship.trialEndsAt === null) return null;
    return {
      id: "membership",
      label: pageItemOf(copy, "membership").label,
      value: fillLabel(
        itemLabel(pauseCopy, pause.extended ? "membership-extra" : "membership-trial"),
        { instant: formatDate(relationship.trialEndsAt) },
      ),
    };
  })();
  /**
   * #1121 — the Initiator's countdown pill, under the status line, mirroring the Payment tab.
   *
   * Only in a running window: a paused one has no days left to count, and a pill reading *0 Days
   * Left* would be the defect the pill exists to prevent. The bundle draws it as a link to
   * `#payment`; there is no Payment tab on this route yet (#1132 owns that page), so it is drawn as
   * the badge it is — the number without a door that would go nowhere.
   */
  const trialPill: string | null =
    relationship.isInitiator && !paused && pause.daysLeft !== null
      ? fillLabel(itemLabel(pauseCopy, pause.extended ? "pill-extra" : "pill-trial"), {
          days: String(pause.daysLeft),
        })
      : null;
  /** The free week's refusal, in the page's own sentence for its code. */
  const extensionRefusal =
    extensionOutcome !== null && !extensionOutcome.ok
      ? sentenceFor(refusals, extensionOutcome)
      : null;

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
    if (known === undefined) return view;
    // #1135 — `invite-declined` names the person who said no; every other state has no placeholder.
    return fillLabel(known.label, {
      counterparty:
        relationship.counterpartyName ?? relationship.counterpartySeatName ?? "The other person",
    });
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
    // `aspectStatesOf`, not the raw list: a row that is still `new-N` is one the record does not
    // hold, and its placeholder must not become the item id (#936).
    const answer = await onSaveAspects({
      relationshipId: relationship.id,
      record: buildRecord(aspectStatesOf(next)),
      saveAs: "draft",
    });
    setAspectsOutcome(answer);
    return answer.ok ? { ok: true } : { ok: false, problem: answer.code };
  }

  /** The rows the person is looking at, kept so a status change writes them rather than the mount. */
  function mirrorAspects(next: readonly AspectDraft[]): void {
    // One function for both writers: the status buttons and the row's own Save must agree about
    // what a `new-` id means, or a saved row comes back named as unsaved (#936).
    setAspects(aspectStatesOf(next));
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
   * a card capture in place is a second way to pay and the pay modal is the only one. The publish
   * panel draws a link to the modal (`payHref`) and nothing else: the plan card, Stripe's fields and
   * the record of the method all live on the one surface that owns them — stage 5's walk, which
   * mounts `components/billing/stripe-frame.tsx`.
   */

  /**
   * #739 — **complete and open the Gap.** One click: the fee is taken against the method on file
   * and both parties can read the report.
   *
   * A refusal that names the fee is not a dead end and not an error: it carries the capture's url,
   * so the screen prints the sentence and a working link rather than a button the person cannot get
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

  /**
   * #1121 — **claim the one free week.** One click, and the page re-renders from the rows: Stage 6
   * runs again because the subscription's period moved, not because a client flag flipped. A
   * refusal is a sentence from this page's own fixture (`not-paused`, `no-trial`,
   * `extension-used`), and the button is gone on the very next server read.
   */
  function claimExtension(): void {
    setExtensionOutcome(null);
    startTransition(async () => {
      const answer = await onClaimExtension({ relationshipId: relationship.id });
      setExtensionOutcome(answer);
      if (answer.ok) router.refresh();
    });
  }

  /*
   * #1135 — Copy Invite Link. The clipboard is the browser's, so this is the one handler with no
   * server call: it copies the link the page is holding, and says so. `navigator.clipboard` is
   * absent on an insecure origin, which is why the failure is a sentence (`copy-failed`) and not a
   * thrown error.
   */
  async function copyInviteLink(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  /**
   * #1135 — **Resend Invite.** The write is #275's `resendInvite()`: a new token, a new window, the
   * old link dead. `mail` comes back `sent|unset|failed` and the panel prints the matching sentence,
   * because "resent" and "emailed" are two different claims.
   */
  function resendInvite(): void {
    setResendOutcome(null);
    setCopied(false);
    startTransition(async () => {
      const answer = await onResendInvite?.({
        ...(relationship.sessionRecordId === null
          ? {}
          : { sessionRecordId: relationship.sessionRecordId }),
      });
      setResendOutcome(answer ?? null);
      if (answer?.ok === true) router.refresh();
    });
  }

  /** #1135 — **Cancel Invite.** Behind the neutral confirm; the panel says the link is dead after. */
  function cancelInvite(): void {
    setCancelOutcome(null);
    startTransition(async () => {
      const answer = await onCancelInvite?.({ relationshipId: relationship.id });
      setCancelOutcome(answer ?? null);
      if (answer?.ok === true) router.refresh();
    });
  }

  /** #1135 — **Abandon Draft**, with the optional reason that lands on the row's `void_reason`. */
  function abandonDraft(): void {
    setAbandonOutcome(null);
    startTransition(async () => {
      const answer = await onAbandon?.({
        relationshipId: relationship.id,
        reason: abandonReason.trim(),
      });
      setAbandonOutcome(answer ?? null);
      if (answer?.ok === true) router.refresh();
    });
  }

  /** #1135 — **Leave Relationship.** Either seat; Stage 6 closes for both. */
  function leaveRelationship(): void {
    setLeaveOutcome(null);
    startTransition(async () => {
      const answer = await onLeave?.({ relationshipId: relationship.id });
      setLeaveOutcome(answer ?? null);
      if (answer?.ok === true) router.refresh();
    });
  }

  /** #1135 — **Request My Removal.** One audit row; the reason is support's alone. */
  function requestMyRemoval(): void {
    setRemovalOutcome(null);
    startTransition(async () => {
      const answer = await onRequestRemoval?.({
        relationshipId: relationship.id,
        reason: removalReason.trim(),
      });
      setRemovalOutcome(answer ?? null);
      if (answer?.ok === true) router.refresh();
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

  /*
   * #1135 — **the five ending verbs.** `hygiene` is the server's answer for *this* reader; absent
   * (a hand-built view literal) means none of them is drawn. Each refusal is a sentence from this
   * page's own fixture, so no panel ever prints a raw code.
   */
  const hygiene = relationship.hygiene;
  /**
   * Each ending verb is drawn only when the read allows it **and** the page handed the writer over:
   * a screen that mounted no action must not draw a control that has nothing to run, and a page that
   * forgot one loses the panel rather than shipping a dead button.
   */
  const canCancelInvite = hygiene?.canCancelInvite === true && onCancelInvite !== undefined;
  const canResendInvite = hygiene?.canResendInvite === true && onResendInvite !== undefined;
  const canAbandon = hygiene?.canAbandon === true && onAbandon !== undefined;
  const canLeave = hygiene?.canLeave === true && onLeave !== undefined;
  const canRequestRemoval = hygiene?.canRequestRemoval === true && onRequestRemoval !== undefined;
  /**
   * The four confirm hooks, **derived from the fixture ids** rather than typed here: E23 counts a
   * literal written in a component against the route's page-copy budget, and a hook is a handle a
   * test and the fixture should agree on anyway.
   */
  const hooks = {
    cancelInvite: itemOf(hygieneCopy, "cancel").id,
    abandon: itemOf(abandonCopy, "submit").id,
    leave: itemOf(closeCopy, "leave").id,
    removal: itemOf(closeCopy, "request").id,
  } as const;
  const cancelRefusal =
    cancelOutcome !== null && !cancelOutcome.ok ? sentenceFor(refusals, cancelOutcome) : null;
  const resendRefusal =
    resendOutcome !== null && !resendOutcome.ok ? sentenceFor(refusals, resendOutcome) : null;
  const abandonRefusal =
    abandonOutcome !== null && !abandonOutcome.ok ? sentenceFor(refusals, abandonOutcome) : null;
  const leaveRefusal =
    leaveOutcome !== null && !leaveOutcome.ok ? sentenceFor(refusals, leaveOutcome) : null;
  const removalRefusal =
    removalOutcome !== null && !removalOutcome.ok ? sentenceFor(refusals, removalOutcome) : null;
  /**
   * The most recent link this page holds: the resend's, else the publish's or the republish's, else
   * `null`. **A token is never stored**, so a link exists on this screen only in the response to a
   * mint — which is why Copy Invite Link is drawn beside a link and not in its absence.
   */
  const linkToCopy =
    resendOutcome?.ok === true ? resendOutcome.inviteLink : (shownLink?.url ?? null);
  const removalRequestedAt = hygiene?.removalRequestedAt ?? null;

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
  /**
   * #975 D9 — **the heading is the relationship's, not its template's.**
   *
   * `relationship.title` is the record the relationship was configured from, so every relationship
   * made from one template is headed by that template's name: five rows, one `<h1>`, and nothing on
   * the page says which of them the reader opened. `relationshipTitle` is the title the creator's
   * stage 1 wrote (the flow derives `Avery B – Rowan` from the two seats, `lib/flow/names.ts`), and
   * it is the same field the list and the card already print (`row.relationshipTitle ?? row.title`)
   * — the detail page was the one surface that ignored it. The fallback keeps a pre-#841 row, whose
   * session copy carries no title of its own, headed by the template rather than by nothing.
   */
  const heading = relationship.relationshipTitle ?? relationship.title;
  /**
   * #975 D9 — **the two seats, named, under the heading.**
   *
   * A relationship whose creator kept stage 1's default title reads the template's name, and two of
   * those are indistinguishable however the heading is read — so the band's roles line names who
   * holds each seat, in the artifact's own shape (`Daniel — payer`, §11 of
   * `prototype-relationship-lifecycle-v9`). The nouns stay the catalogue type's where the slug names
   * one (`Spouse A / Spouse B`), and fall back to the product's two words otherwise, which is the
   * state every relationship made from a non-catalogue template is in.
   *
   * The Counterparty's name is the **seat's** first: `counterpartySeatName` is the account in the
   * seat, `counterpartyName` is what the initiator typed on the invitation. A draft names nobody
   * yet, which is why the noun is the fallback rather than an empty half.
   */
  const seatLabel = (name: string | null | undefined, noun: string): string =>
    name === null || name === undefined || name === "" ? noun : `${name} — ${noun}`;
  const rolesLine = fillLabel(itemLabel(identityCopy, "roles"), {
    initiator: seatLabel(
      relationship.initiatorName,
      type?.roles.initiator ?? pageItemOf(copy, "role-initiator").label,
    ),
    counterparty: seatLabel(
      relationship.counterpartyName ?? relationship.counterpartySeatName,
      type?.roles.counterparty ?? pageItemOf(copy, "role-counterparty").label,
    ),
  });

  /**
   * #1115 task 5 — the Connection cell. The *state* comes from `connectionOf()` on the server read
   * (`MemberRelationshipView.connection`); this function only chooses which of the fixture's two
   * sentences draws it, so the screen can never disagree with `content/stages.ts` about whether the
   * pair is connected. When they are not, the sentence names the person whose seat is still empty —
   * the seat's name first, the invitation's second, the role's own noun last, the same order
   * `rolesLine` uses above.
   */
  const connectionValue = (row: MemberRelationshipView): ReactNode => {
    const connection = row.connection;
    if (connection === undefined) return null;
    if (connection.connected) {
      return (
        <Chip variant="soft" data-connection="connected">
          {pageItemOf(copy, "connected").label}
        </Chip>
      );
    }
    const name =
      connection.waitingOn === "initiator"
        ? (row.initiatorName ?? pageItemOf(copy, "role-initiator").label)
        : (row.counterpartySeatName ??
          row.counterpartyName ??
          pageItemOf(copy, "role-counterparty").label);
    return (
      <span data-connection="waiting">
        {fillLabel(pageItemOf(copy, "waiting").label, { name })}
      </span>
    );
  };

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
    /* #1115 task 5 — the derived state, drawn from the read and never computed here. Absent only
       for a view literal that predates the field; the page always supplies it. */
    ...(relationship.connection === undefined
      ? []
      : [
          {
            id: "connection",
            label: pageItemOf(copy, "connection").label,
            value: connectionValue(relationship),
          },
        ]),
    /* #1121 — the membership row, when this seat has one to read (see `membershipFact`). */
    ...(membershipFact === null ? [] : [membershipFact]),
  ];

  /**
   * Bundle 03's **At a Glance** card — the rectification register's most repeated delta on this
   * screen. It is a summary of reads the page already performs, never a fourth arithmetic:
   *
   *   the tally   `alignmentSummaryOf()` over both seats' opinions, keyed by the round the read
   *               names — the same function the Start page's bar and the Align screen use, so
   *               three screens cannot print three counts about one relationship
   *   Mode        the Settings tab's own two values (`settings`), plus the opinion count the mode
   *               asks — `opinionKindsFor()`, so "2 Opinions" cannot drift from Basic Mode
   *   Round       the ordinal and start the relationship read carries
   *
   * Every part is optional and the panel is absent when none of them is known: a view literal
   * written before these reads existed (the suites) draws the screen it always drew, and a draft —
   * no round, no answers, no Settings row — gets no card headed with three em dashes.
   */
  const glanceCopy = sectionOf(copy, RELATIONSHIP_GLANCE_SECTION);
  /* The mode's *short* name lives in the edit band's items ("Basic" against the publish panel's
     long gloss), and the glance card's row is a value, not a definition. */
  const modeCopy = sectionOf(copy, RELATIONSHIP_EDIT_SECTION);
  const modeValue: AssessmentMode | null =
    settings === undefined
      ? null
      : settings.mode === "basic" || settings.mode === "advanced"
        ? settings.mode
        : null;
  const modeRow =
    modeValue === null
      ? null
      : `${itemLabelOr(modeCopy, `mode-${modeValue}`) ?? modeValue} · ${fillLabel(
          itemLabel(glanceCopy, "opinions"),
          { count: opinionKindsFor(modeValue).length },
        )}`;
  const toleranceRow =
    settings === undefined
      ? null
      : (itemLabelOr(glanceCopy, `tolerance-${settings.setting}`) ?? null);
  const roundRow =
    round === undefined || round === null
      ? null
      : fillLabel(itemLabel(glanceCopy, "round-value"), {
          round: round.ordinal,
          date: formatDate(round.startedAt),
        });
  /* The report the round opened, when it exists: a relationship with an unanswered sheet has no
     Gap to open, so the reference's one control is drawn only where it leads somewhere. */
  const glanceAlignHref =
    relationship.sessionRecordId === null ? null : reportPath(relationship.sessionRecordId);
  const glanceRows: readonly {
    readonly id: string;
    readonly label: string;
    readonly value: string;
  }[] = [
    ...(modeRow === null
      ? []
      : [{ id: "mode", label: itemLabel(glanceCopy, "mode"), value: modeRow }]),
    ...(toleranceRow === null
      ? []
      : [{ id: "tolerance", label: itemLabel(glanceCopy, "tolerance"), value: toleranceRow }]),
    ...(roundRow === null
      ? []
      : [{ id: "round", label: itemLabel(glanceCopy, "round"), value: roundRow }]),
  ];
  const glancePanel =
    alignment == null && glanceRows.length === 0 ? null : (
      <section
        data-relationship-glance="true"
        data-glance-alignment={alignment === null || alignment === undefined ? "absent" : "present"}
        className={`space-y-3 ${DETAIL_CARD}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-base font-semibold leading-tight tracking-tight">
            {glanceCopy.heading ?? ""}
          </h2>
          {glanceAlignHref === null || alignment === null || alignment === undefined ? null : (
            <a
              href={glanceAlignHref}
              data-glance-align="true"
              className="text-xs font-medium text-action underline underline-offset-4"
            >
              {itemLabel(glanceCopy, "open-align")}
            </a>
          )}
        </div>
        {alignment === null || alignment === undefined ? null : (
          <div className="space-y-2" data-glance-tally="true">
            <p className="text-2xl font-bold tabular-nums">
              {fillLabel(itemLabel(glanceCopy, "aligned"), {
                aligned: alignment.aligned,
                total: alignment.total,
              })}
            </p>
            {/* One mark per Aspect, in the model's own severity colours: the legend below spells
                the counts out, so the strip is decoration and says so (`aria-hidden`). */}
            <div className="flex gap-1" aria-hidden="true">
              {alignment.aspects.map((aspect) => (
                <span
                  key={aspect.itemId}
                  title={aspect.prompt}
                  data-glance-mark={aspect.status}
                  data-glance-aspect={aspect.itemId}
                  className={`flex h-6 flex-1 rounded-md ${
                    aspect.status === "gap"
                      ? "bg-gap-mark"
                      : aspect.status === "in-synch"
                        ? "bg-synch-mark"
                        : "bg-small-gap-mark ring-1 ring-inset ring-small-gap"
                  }`}
                />
              ))}
            </div>
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {(
                [
                  ["in-synch", alignment.tally.inSynch, "bg-synch-mark"],
                  [
                    "small-gap",
                    alignment.tally.smallGap,
                    "bg-small-gap-mark ring-1 ring-inset ring-small-gap",
                  ],
                  ["gap", alignment.tally.gap, "bg-gap-mark"],
                ] as const
              ).map(([id, count, mark]) => (
                <span key={id} data-glance-legend={id} className="inline-flex items-center gap-1">
                  <span className={`size-2.5 rounded-full ${mark}`} aria-hidden="true" />
                  {fillLabel(itemLabel(glanceCopy, id), { count })}
                </span>
              ))}
            </p>
          </div>
        )}
        {glanceRows.length === 0 ? null : (
          <dl className="divide-y border-t text-sm">
            {glanceRows.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="text-right font-medium" data-glance-row={row.id}>
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    );

  /**
   * #1128 — **the Next Step while the relationship is answering, and the door #1128 says was
   * missing.**
   *
   * The bundle draws one Next Step per state, and the state a live session is in before both
   * sheets are sealed is *answer it*: `Start Your First Assessment` with the three-minute promise,
   * one button into `/assessment/instances/[id]/answer`. The verb is the reader's own answered
   * count (`viewerAnswered`, read from their `opinion` rows), so a return visit says `Continue`.
   *
   * It is drawn instead of the pause panel, never beside it (`paused` wins). A sealed sheet still
   * gets it: the answer screen is the one that decides whether it draws the sheet or the record, and
   * a reader who wants their own answers should not have to guess a URL to find them.
   */
  const assessmentCopy = sectionOf(copy, "assessment");
  /** #rect-04 — the Align summary's own words (bundle 04's reference, verbatim). */
  const alignCopy = sectionOf(copy, "align");
  const answerHref =
    relationship.sessionRecordId === null ? null : answerSheetPath(relationship.sessionRecordId);
  const answered = relationship.viewerAnswered ?? 0;
  /*
   * **Once both sheets are in, the answering Next Step is over** (#rect-04).
   *
   * `align !== null` is the read's own answer to "has the pair finished?" — `readMemberAlignments`
   * only projects a session whose two sheets are complete. Holding the *Continue Your Assessment*
   * band up over five answered Aspects is the delta the register names, so the band is dropped for
   * the summary below rather than drawn beside it: one Next Step per state, never two, and never a
   * verb the state has outgrown.
   */
  const bothAnswered = align !== null && align !== undefined;
  const assessmentPanel =
    paused || relationship.closed || answerHref === null || bothAnswered ? null : (
      <section
        data-next-step-assessment={answered > 0 ? "continue" : "start"}
        className={`space-y-3 ${DETAIL_CARD}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Chip variant="soft">{itemLabel(assessmentCopy, "next-step")}</Chip>
        </div>
        <h2 className="text-base font-semibold">
          {itemLabel(assessmentCopy, answered > 0 ? "continue-heading" : "start-heading")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {fillLabel(itemLabel(assessmentCopy, "body"), { count: relationship.aspectCount })}
        </p>
        <p className="text-sm text-muted-foreground">
          {fillLabel(itemLabel(assessmentCopy, "progress"), {
            answered,
            count: relationship.aspectCount,
          })}
        </p>
        <a
          href={answerHref}
          data-start-assessment="true"
          className="inline-flex h-9 items-center gap-2 rounded-md bg-action px-3 text-sm font-semibold text-action-foreground hover:bg-action-hover"
        >
          {itemLabel(assessmentCopy, answered > 0 ? "continue" : "start")}
        </a>
      </section>
    );

  /*
   * #rect-04 — **the Align summary, drawn once both sheets are in.**
   *
   * This is the screen `guides/shared/results-and-align.md` promises and bundle 04's reference
   * photographs: the heading, the tally in the reference's own line — *"3 of 5 Aspects Aligned"* with
   * one count per status word — and the Next Step band naming the widest Gap with one door into the
   * Discussion. Before this card the page reached that state and said *"Continue Your Assessment"*,
   * with the results behind a separate *"Complete and open the Gap"* act.
   *
   * Every figure is `alignmentSummaryOf()`'s: the tally, the width, the Aspect' prompt and the kind
   * all come off the same `AlignmentSummary`, so the sentence, the counts and the Aspect named
   * cannot describe three different relationships. `nextStep === null` is a finished Align — every
   * Gap inside the Alignment Tolerance — and the band is simply absent rather than offering a
   * conversation about nothing.
   */
  const nextStep = align?.nextStep ?? null;
  const conversationCount = align === null || align === undefined ? 0 : align.total - align.aligned;
  const alignPanel =
    align === null || align === undefined ? null : (
      <section
        data-align-summary={nextStep === null ? "nothing-left" : "next-step"}
        className={DETAIL_CARD}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Chip variant="soft" data-align-stage="live">
            {itemLabel(alignCopy, "stage")}
          </Chip>
          <Chip variant="soft">{itemLabel(alignCopy, "live")}</Chip>
        </div>
        <div className="mt-2 space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-primary">{alignCopy.heading}</h2>
          <p className="text-base text-foreground">{sectionBody(alignCopy)}</p>
        </div>
        <div className="mt-4 grid gap-6 rounded-lg border border-status-line bg-status p-5 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-deep">
              {itemLabel(alignCopy, "summary")}
            </p>
            <div>
              <p className="text-3xl font-bold tracking-tight text-primary" data-align-tally="true">
                {fillLabel(itemLabel(alignCopy, "aligned"), {
                  aligned: align.aligned,
                  total: align.total,
                })}
              </p>
              <p className="mt-1 text-sm text-muted-foreground" data-align-headline="true">
                {nextStep === null
                  ? itemLabel(alignCopy, "headline-all")
                  : fillLabel(itemLabel(alignCopy, "headline"), { count: conversationCount })}
              </p>
            </div>
            {/* The three status words, each with its own count and mark — icon plus word, never colour
              alone (rule 2), and the reference's own three words. */}
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <div className="flex items-center gap-2" data-align-count="in-synch">
                <span aria-hidden="true" className="size-2.5 rounded-full bg-synch-mark" />
                <span className="text-lg font-bold leading-none text-foreground">
                  {align.tally.inSynch}
                </span>
                <span className="text-xs text-muted-foreground">
                  {itemLabel(alignCopy, "in-synch")}
                </span>
              </div>
              <div className="flex items-center gap-2" data-align-count="small-gap">
                <span aria-hidden="true" className="size-2.5 rounded-full bg-small-gap-mark" />
                <span className="text-lg font-bold leading-none text-foreground">
                  {align.tally.smallGap}
                </span>
                <span className="text-xs text-muted-foreground">
                  {itemLabel(alignCopy, "small-gap")}
                </span>
              </div>
              <div className="flex items-center gap-2" data-align-count="gap">
                <span aria-hidden="true" className="size-2.5 rounded-full bg-gap-mark" />
                <span className="text-lg font-bold leading-none text-foreground">
                  {align.tally.gap}
                </span>
                <span className="text-xs text-muted-foreground">{itemLabel(alignCopy, "gap")}</span>
              </div>
            </div>
          </div>
          {nextStep === null ? null : (
            <div
              data-align-next-step={nextStep.itemId}
              className="rounded-lg bg-action p-4 text-action-foreground"
            >
              {/* A link out of this screen that stays inside the app: the Discussion is a hash on this
                page (#1124), so it is a plain anchor with the 44px target and no leaving marker. */}
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-action-foreground/80">
                <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
                {itemLabel(alignCopy, "next-step")}
              </p>
              <h3 className="mt-1 text-base font-semibold">
                {itemLabel(alignCopy, "next-heading")}
              </h3>
              <p className="mt-1 text-sm text-action-foreground/90">
                {fillLabel(itemLabel(alignCopy, "next-body"), {
                  aspect: nextStep.prompt,
                  gap: nextStep.gap,
                })}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href="#discussion"
                  data-align-conversation="true"
                  className="inline-flex h-11 items-center gap-2 rounded-md bg-background px-3 text-sm font-medium text-primary transition-colors hover:bg-mist lg:h-9"
                >
                  <MessageSquare className="size-4 shrink-0" aria-hidden="true" />
                  {itemLabel(alignCopy, "start")}
                </a>
              </div>
            </div>
          )}
        </div>
      </section>
    );

  /*
   * #1121 — **the pause block, above the facts card in the rail.**
   *
   * The bundle draws it as the aside's first element (gauge, badge, one status line, one Next Step),
   * and the shell puts `facts` above `actions` — so the block and the facts card share the facts
   * slot rather than being pushed below the working panels. One status line, one Next Step: the two
   * buttons inside it are the same decision seen twice (*add a card* / *take the free week*), which
   * is why they sit in one block rather than in two panels.
   */
  const pausePanel = !paused ? null : (
    <section
      data-stage-pause={pause.state}
      data-stage-pause-role={relationship.isInitiator ? "initiator" : "counterparty"}
      className={`space-y-3 ${DETAIL_CARD}`}
    >
      <p className="flex flex-wrap items-center gap-2">
        <Chip variant="soft" data-pause-badge="paused">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="mr-1 size-3.5 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
          {pauseBadge}
        </Chip>
      </p>
      <p className="text-sm text-muted-foreground">{pauseLine}</p>
      <div
        data-pause-next-step={relationship.isInitiator ? pause.state : "waiting"}
        className="space-y-2 rounded-b-lg bg-action p-4 text-action-foreground"
      >
        <h2 className="text-base font-semibold">{nextStepHeading}</h2>
        <p className="text-sm text-action-foreground/80">{nextStepBody}</p>
        <div className="flex flex-wrap gap-2">
          {/*
              #1121 — *Add a Card* is the existing checkout, not a second one: `payHref` is the pay
              modal's address (the same door #912 left on the publish panel), and a relationship with
              no session has none to offer, so the button is absent rather than dead.
            */}
          {relationship.isInitiator && payHref !== null ? (
            <FlowEntryLink
              href={payHref}
              data-pause-add-card="true"
              className="inline-flex h-9 items-center gap-2 rounded-md bg-background px-3 text-sm font-medium text-foreground hover:bg-muted"
            >
              {itemLabel(pauseCopy, "add-card")}
            </FlowEntryLink>
          ) : null}
          {/*
              #1121 — the free week, drawn only while the server says it is available: once it has
              been used the flag is false for good, and the control is not drawn at all rather than
              drawn-and-refused. The write re-asks under a lock (`claimTrialExtension`).
            */}
          {relationship.canClaimExtension ? (
            <button
              type="button"
              onClick={claimExtension}
              disabled={pending}
              data-pause-extend="true"
              className="inline-flex h-9 items-center rounded-md border border-action-foreground/50 px-3 text-sm font-medium text-action-foreground transition-colors hover:bg-action-foreground/10 disabled:opacity-50"
            >
              {pending ? itemLabel(pauseCopy, "extending") : itemLabel(pauseCopy, "extend")}
            </button>
          ) : null}
          {/* The Counterparty's one action is to keep reading — never a card, never a price. */}
          {relationship.isInitiator ? null : (
            <a
              href={resultsHref}
              data-pause-see-results="true"
              className="inline-flex h-9 items-center rounded-md border border-action-foreground/50 px-3 text-sm font-medium text-action-foreground transition-colors hover:bg-action-foreground/10"
            >
              {itemLabel(pauseCopy, "see-results")}
            </a>
          )}
        </div>
        {extensionRefusal === null ? null : (
          <p
            data-pause-refusal={extensionOutcome?.ok === false ? extensionOutcome.code : ""}
            className="text-sm text-action-foreground/90"
          >
            {extensionRefusal}
          </p>
        )}
      </div>
    </section>
  );

  /**
   * #1121 — the arrival: *"7 More Days Added · Stage 6 is running again. Your extra week ends
   * <date>."*
   *
   * Two ways to get it, and they are the same event seen from two sides: the click that just
   * succeeded in this session (`extensionOutcome`) and a `?from=extend` arrival from somewhere else.
   * Both print the end the **rows** carry — the write's own `endsAt`, or the moved period end — so
   * the sentence cannot claim a date the subscription does not have.
   */
  const extensionEndsAt =
    extensionOutcome?.ok === true
      ? extensionOutcome.endsAt
      : arrival === "extend"
        ? relationship.trialEndsAt
        : null;
  const extensionBanner =
    extensionEndsAt === null
      ? null
      : fillLabel(itemLabel(pauseCopy, "added"), { instant: formatDate(extensionEndsAt) });

  /**
   * #1124 — **the tab layer's six panels**, assembled here because five of them read this
   * component's copy and one of them *is* the Aspects section the page already owned.
   *
   * The Aspects panel is that section unchanged — same `AspectList`, same two writes, same
   * refusal sentences — so editing an Aspect is still this page's business and not a tab's. The
   * other five are drawn by `relationship-panels.tsx` from the same read the screen already has,
   * and none of them writes: the writes this screen owns did not move, and the ones it does not
   * own yet (#921's thread, #1135's invitation hygiene) are not faked behind a tab.
   */
  const panels: Readonly<Record<string, ReactNode>> = {
    discussion: <DiscussionPanel copy={copy} relationship={relationship} />,
    aspects: (
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
          <>
            {/*
              #1133 — **the live band.** Once Stage 6 is running the Aspects are locked, and the
              screen says so instead of leaving a person to wonder where the pencils went. It is
              the panel's own copy (`aspects-live`), not a sentence written here: E23, and because
              the same two sentences are the contract the write layer enforces (`saveAspects`
              refuses `not-editable` inside its transaction).
            */}
            {relationship.status === "active" ? (
              <div
                data-relationship-aspects-live="true"
                className="mt-4 rounded-lg border border-border bg-mist p-4"
              >
                <p className="flex items-start gap-2 text-sm font-medium text-foreground">
                  <span aria-hidden="true">🔒</span>
                  <span>{itemLabel(liveAspectCopy, "locked-now")}</span>
                </p>
                <p className={`mt-1 pl-6 ${DETAIL_MUTED}`}>{itemLabel(liveAspectCopy, "rule")}</p>
              </div>
            ) : null}
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
          </>
        )}
      </DetailSection>
    ),
    members: <MembersPanel copy={copy} relationship={relationship} />,
    details: (
      <DetailsPanel
        copy={copy}
        relationship={relationship}
        invitationSentence={viewSentence(relationship.view)}
      />
    ),
    settings: <SettingsPanel copy={copy} settings={settings} />,
    payment: <PaymentPanel copy={copy} relationship={relationship} planPrice={planPrice} />,
  };

  return (
    <RecordDetailShell
      scope="relationship"
      band={
        <DetailBand
          scope="relationship"
          type={type}
          title={heading}
          summary={relationship.summary}
          groupLabel={groupLabel}
          rolesLine={rolesLine}
        />
      }
      facts={
        <>
          {/* #1121 — the pause block first, then the facts card: the bundle's aside order. */}
          {assessmentPanel}
          {pausePanel}
          {/* The v2 rectification — bundle 03's **At a Glance** card, above the record's own facts. */}
          {glancePanel}
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
        </>
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

          {publishableNow ? (
            <DetailPanel title={publishCopy.heading}>
              <p className={DETAIL_MUTED}>{sectionBody(publishCopy)}</p>
              {/*
                #912 — **Invite Members, beside the act it belongs to.** On the detail screen the
                publish panel *is* "Publish to Counterparty"; this is the other half of the pair the
                card asks for, and it is the pay modal rather than a capture. It sits above the
                fields because the money decision comes before the counterparty's address, and it is
                a flow entry — the modal owns the card, this screen owns nothing payment-shaped, and
                opening the modal must not navigate this page away (#975 D10, `t_90026133`).

                A relationship with no session has no invitation to shape, so the control is not
                drawn here — `payHref` is the same fact the list's card reads.
              */}
              {payHref === null ? null : (
                <FlowEntryLink
                  href={payHref}
                  data-invite-members="true"
                  className="inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                >
                  {itemLabel(publishCopy, "invite-members")}
                </FlowEntryLink>
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

          {/*
            #1135 — **Invitation hygiene**, drawn for the Initiator while the link is live
            (bundle 03's Members panel: Copy Invite Link · Resend Invite · Cancel Invite).

            Copy is drawn **beside a link** and not in its absence: a token is never stored, so the
            only link this page can hold is one a mint in this session returned. That is the same
            rule the publish and republish panels already follow, and the one reason a fresh load
            offers Resend instead of a stale copy.
          */}
          {canCancelInvite || canResendInvite ? (
            <DetailPanel title={hygieneCopy.heading} hooks={{ "data-invite-hygiene": "true" }}>
              <p className={DETAIL_MUTED}>{sectionBody(hygieneCopy)}</p>
              <div className="space-y-3">
                {linkToCopy === null ? null : (
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void copyInviteLink(linkToCopy)}
                      data-copy-invite-link="true"
                    >
                      {itemLabel(hygieneCopy, "copy")}
                    </Button>
                    <p className="min-w-0 break-all text-sm text-muted-foreground">{linkToCopy}</p>
                    <p data-copied={copied ? "true" : "false"} className="text-sm">
                      {copied
                        ? itemLabel(hygieneCopy, "copied")
                        : itemLabel(hygieneCopy, "copy-failed")}
                    </p>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  {canResendInvite ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resendInvite}
                      disabled={pending}
                      data-resend-invite="true"
                    >
                      {pending
                        ? itemLabel(hygieneCopy, "resending")
                        : itemLabel(hygieneCopy, "resend")}
                    </Button>
                  ) : null}
                  {canCancelInvite ? (
                    <DestructiveConfirm
                      hook={hooks.cancelInvite}
                      label={itemLabel(hygieneCopy, "cancel")}
                      heading={itemLabel(hygieneCopy, "cancel")}
                      body={itemLabel(hygieneCopy, "cancel-confirm")}
                      keepLabel={itemLabel(hygieneCopy, "keep")}
                      pendingLabel={itemLabel(hygieneCopy, "cancelling")}
                      pending={pending}
                      onConfirm={cancelInvite}
                    />
                  ) : null}
                </div>
                {resendOutcome?.ok === true ? (
                  <p data-resend-outcome={resendOutcome.mail} className="text-sm">
                    {resendOutcome.mail === "sent"
                      ? fillLabel(itemLabel(hygieneCopy, "resent"), {
                          instant: resendOutcome.inviteExpiresAt,
                        })
                      : itemLabel(
                          hygieneCopy,
                          resendOutcome.mail === "unset" ? "resent-unset" : "resent-failed",
                        )}
                  </p>
                ) : null}
                {resendRefusal === null ? null : (
                  <p
                    data-resend-refusal={resendOutcome?.ok === false ? resendOutcome.code : ""}
                    className="text-sm"
                  >
                    {resendRefusal}
                  </p>
                )}
                {cancelOutcome?.ok === true ? (
                  <p data-cancel-invite={cancelOutcome.revokedAt} className="text-sm">
                    {fillLabel(itemLabel(hygieneCopy, "cancelled"), {
                      instant: cancelOutcome.revokedAt,
                    })}
                  </p>
                ) : null}
                {cancelRefusal === null ? null : (
                  <p
                    data-cancel-refusal={cancelOutcome?.ok === false ? cancelOutcome.code : ""}
                    className="text-sm"
                  >
                    {cancelRefusal}
                  </p>
                )}
              </div>
            </DetailPanel>
          ) : null}

          {/*
            #1135 — **Abandon Draft**, drawn only for a draft nobody was invited to. The lifecycle
            has exactly two edges into `void` for a person (`draft → void`, `pending → void`), and
            the read draws the control off the same status pair.
          */}
          {canAbandon ? (
            <DetailPanel title={abandonCopy.heading} hooks={{ "data-abandon-draft": "true" }}>
              <p className={DETAIL_MUTED}>{sectionBody(abandonCopy)}</p>
              <div className="space-y-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="abandon-reason">{itemLabel(abandonCopy, "reason")}</Label>
                  <Input
                    id="abandon-reason"
                    value={abandonReason}
                    onChange={(event) => setAbandonReason(event.target.value)}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <DestructiveConfirm
                    hook={hooks.abandon}
                    label={itemLabel(abandonCopy, "submit")}
                    heading={itemLabel(abandonCopy, "submit")}
                    body={itemLabel(abandonCopy, "confirm")}
                    keepLabel={itemLabel(abandonCopy, "keep")}
                    pendingLabel={itemLabel(abandonCopy, "abandoning")}
                    pending={pending}
                    onConfirm={abandonDraft}
                  />
                  {abandonOutcome?.ok === true ? (
                    <p data-abandoned={abandonOutcome.completedAt} className="text-sm">
                      {fillLabel(itemLabel(abandonCopy, "done"), {
                        instant: abandonOutcome.completedAt,
                      })}
                    </p>
                  ) : null}
                </div>
                {abandonRefusal === null ? null : (
                  <p
                    data-abandon-refusal={abandonOutcome?.ok === false ? abandonOutcome.code : ""}
                    className="text-sm"
                  >
                    {abandonRefusal}
                  </p>
                )}
              </div>
            </DetailPanel>
          ) : null}

          {relationship.isInitiator && gate !== null && !relationship.closed ? (
            /*
             * #739 — **the completion band, and since #1010 there is nothing to pay on it.**
             *
             * The membership bought at stage 5 covers this relationship, so sealing it is one click
             * on a free act: the band draws the seal's state and the button, and nothing about
             * money — no amount, no deadline, no method, and no door to a card. `gate` is the read's
             * own answer (`readCompletionGate()`), and the write re-reads the row under a lock, so
             * this is a courtesy and not the rule.
             *
             * Initiator only: completion belongs to the account that owns the relationship, and the
             * server action re-asks under the row lock (`not-the-payer`).
             */
            <DetailPanel
              title={completionCopy.heading}
              hooks={{ "data-completion-gate": gate.sealed ? "sealed" : "open" }}
            >
              <p className={DETAIL_MUTED}>{sectionBody(completionCopy)}</p>
              {/* The reference's one sentence about what completing does not do: the Gap stays
                  readable until the relationship itself closes. */}
              <p className="text-sm text-muted-foreground" data-completion-align-live="true">
                {itemLabel(completionCopy, "live-until-closes")}
              </p>
              <div className="space-y-3">
                {gate.sealed ? (
                  <p data-completion-sealed="true" className="text-sm font-medium">
                    {itemLabel(completionCopy, "sealed")}
                  </p>
                ) : (
                  <p data-completion-seal="open" className="text-sm text-muted-foreground">
                    {itemLabel(completionCopy, "not-sealed")}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3">
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
                  <p data-completion-done={completeOutcome.status} className="text-sm font-medium">
                    {fillLabel(itemLabel(completionCopy, "completed"), {
                      instant: completeOutcome.completedAt,
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

          {/*
            #1135 — **Close This Relationship.** One panel, two roles, and no "Delete Relationship"
            anywhere (#1119 D-E): either party may Leave, and the Counterparty's own ask (a ghost
            control whose reason only support reads) rides beneath it. The confirm is where the rule
            is said to the reader — Stage 6 closes for both, the answers stay readable.
          */}
          {(canLeave || canRequestRemoval || removalRequestedAt !== null) && (
            <DetailPanel title={closeCopy.heading} hooks={{ "data-close-relationship": "true" }}>
              <p className={DETAIL_MUTED}>{sectionBody(closeCopy)}</p>
              <div className="space-y-3">
                {canLeave ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <DestructiveConfirm
                      hook={hooks.leave}
                      label={itemLabel(closeCopy, "leave")}
                      heading={itemLabel(closeCopy, "leave")}
                      body={itemLabel(closeCopy, "leave-confirm")}
                      keepLabel={itemLabel(closeCopy, "keep")}
                      pendingLabel={itemLabel(closeCopy, "leaving")}
                      pending={pending}
                      onConfirm={leaveRelationship}
                    />
                    {leaveOutcome?.ok === true ? (
                      <p data-left-at={leaveOutcome.completedAt} className="text-sm">
                        {fillLabel(itemLabel(closeCopy, "left"), {
                          instant: leaveOutcome.completedAt,
                        })}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {leaveRefusal === null ? null : (
                  <p
                    data-leave-refusal={leaveOutcome?.ok === false ? leaveOutcome.code : ""}
                    className="text-sm"
                  >
                    {leaveRefusal}
                  </p>
                )}

                {removalRequestedAt === null ? null : (
                  <p data-removal-requested={removalRequestedAt} className="text-sm font-medium">
                    {fillLabel(itemLabel(closeCopy, "requested-at"), {
                      instant: removalRequestedAt,
                    })}
                  </p>
                )}

                {canRequestRemoval ? (
                  <>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="removal-reason">
                        {itemLabel(closeCopy, "request-reason")}
                      </Label>
                      <Input
                        id="removal-reason"
                        value={removalReason}
                        onChange={(event) => setRemovalReason(event.target.value)}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <DestructiveConfirm
                        hook={hooks.removal}
                        label={itemLabel(closeCopy, "request")}
                        heading={itemLabel(closeCopy, "request")}
                        body={itemLabel(closeCopy, "request-confirm")}
                        keepLabel={itemLabel(closeCopy, "keep")}
                        pendingLabel={itemLabel(closeCopy, "requesting")}
                        pending={pending}
                        onConfirm={requestMyRemoval}
                      />
                      {removalOutcome?.ok === true ? (
                        <p data-removal-outcome={removalOutcome.requestedAt} className="text-sm">
                          {itemLabel(closeCopy, "requested")}
                        </p>
                      ) : null}
                    </div>
                  </>
                ) : null}
                {removalRefusal === null ? null : (
                  <p
                    data-removal-refusal={removalOutcome?.ok === false ? removalOutcome.code : ""}
                    className="text-sm"
                  >
                    {removalRefusal}
                  </p>
                )}
              </div>
            </DetailPanel>
          )}
        </>
      }
    >
      {/* #1121 — the arrival banner: news about the click that just landed, above everything the
          page says about where this relationship stands. */}
      {extensionBanner === null ? null : (
        <p
          data-stage-pause-arrival="extend"
          className="rounded-md border border-border bg-muted/50 p-3 text-sm font-medium text-foreground"
        >
          {extensionBanner}
        </p>
      )}

      {/* #1121 — **read-only while paused, said once, at the top of what the reader came for.**
          The bundle replaces the Discussion composer with this sentence; this route has no composer
          yet (#1124 adds the tab layer), so the sentence is drawn as the state bar it becomes —
          dashed, quiet, and above the sections rather than inside one. */}
      {paused ? (
        <p
          data-stage-pause-read-only="true"
          className="flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/30 p-3 text-sm text-foreground"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-4 shrink-0 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          {itemLabel(pauseCopy, "read-only")}
        </p>
      ) : null}

      {/* #795 — the content column's first section: where this stands. The invitation's state, the
          trial and the seat the reader holds are facts about *this* relationship, and they were a
          stack of chips in a card before the shell pulled them into one sentence-shaped section. */}
      <DetailPanel title={viewCopy.heading} hooks={{ "data-relationship-view": relationship.view }}>
        <div className="flex flex-wrap items-center gap-2">
          <Chip variant="soft" data-relationship-invite={relationship.view}>
            {viewSentence(relationship.view)}
          </Chip>
          {relationship.trialEndsAt === null || !relationship.isInitiator ? null : (
            <Chip variant="neutral">
              {pageItemOf(copy, "trial").label}
              <span aria-hidden className="mx-1.5">
                —
              </span>
              {formatDate(relationship.trialEndsAt)}
            </Chip>
          )}
          {/* #1121 — the Initiator's countdown pill. Never drawn for the Counterparty: a number of
              days left is a fact about somebody else's trial, and their column of the issue's table
              has nothing in it but "waiting". */}
          {trialPill === null ? null : (
            <Chip variant="neutral" data-trial-chip={pause.extended ? "extra" : "trial"}>
              {trialPill}
            </Chip>
          )}
        </div>
        <p className={DETAIL_MUTED}>{sectionBody(viewCopy)}</p>
        {trialAlone ? (
          <p data-trial-without-invite className="text-sm font-medium">
            {itemLabel(viewCopy, "trial-running-no-invite")}
          </p>
        ) : null}
        {/* #533 phase 3 — the lapse line, per seat since #1224. It says Stage 6 is paused and who
            moves next, never a bare "expired"; the words themselves are chosen by the read
            (`lapseSentenceOf()`), so the Counterparty's half cannot carry a billing word and the
            Initiator's half cannot name a trial length that disagrees with the constants.

            Status is an icon plus a word on the status ground, never colour alone (locked rule 2),
            and it takes the `status` tokens rather than a raw amber step — this is "where you
            stand", not a warning.

            `paused` is the trial's own pause, and the pause panel above already tells both seats
            that story in the owner's words — so this line draws for the reasons the panel does
            *not* name (a failed payment, a cancelled subscription), which is where the shared
            sentence used to hand the Counterparty a payment word. */}
        {relationship.lapseSentence === null || paused ? null : (
          <p
            data-membership-sentence="lapsed"
            className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-md border border-status-line bg-status p-3 text-sm text-foreground"
          >
            <span className="inline-flex items-center gap-1 whitespace-nowrap font-semibold">
              <Pause className="size-4 shrink-0" aria-hidden="true" />
              {itemLabel(pauseCopy, "badge")}
            </span>
            <span>{relationship.lapseSentence}</span>
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
            data-relationship-read-only={relationship.viewerRole}
            className="space-y-2 rounded-md border border-gray-300 bg-gray-50 p-3 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800/60 dark:text-gray-200"
          >
            {/* #975 D2 — the sentence is chosen by the **seat**, the same value the chip above
                prints, so one screen cannot state two roles. The band exists because the controls
                are gone (`isInitiator` is false); it no longer claims a role from that fact. */}
            <p>
              {itemLabel(
                viewCopy,
                relationship.viewerRole === "counterparty"
                  ? "counterparty-read-only"
                  : "controls-belong-to-starter",
              )}
            </p>
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

      {/*
        #1124 — **the six-tab layer.** The five sections this page grew up with (where it stands,
        the Aspects) are joined by the four the approved bundle draws (Members, Details, Settings,
        Payment) and the Discussion thread's honest empty state, and the whole set is behind one
        strip: Discussion · Aspects · Members · Details · Settings · Payment.

        Nothing above this line moved. The shell still draws the band, the facts card and the
        working panels in the same order, and the writes this screen owns — Aspects, publish,
        reissue, complete, the Counterparty's fork — are still where they were; the layer only
        decides which section of the record is in front, and it says so in the URL (`#aspects`).
      */}
      <RelationshipTabs
        label={tabCopy.heading ?? ""}
        emptyLabel={pageItemOf(copy, "tabs-empty").label}
        tabs={tabs}
        panels={panels}
      />
      {/* #rect-04 — the Align summary sits above the tab layer: it is the record's own answer to
          "where do we stand", and the six tabs are how you go and look at the parts of it. */}
      {alignPanel}
    </RecordDetailShell>
  );
}
