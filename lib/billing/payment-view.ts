/**
 * The Payment surface's whole derivation (#1132) — one pure function from rows to panels.
 *
 * The screen is the last place a billing fact should be computed: four panels, five states and two
 * readers (the initiating account and the invited one) is exactly the shape where a component
 * starts comparing `gap === 1` of its own. So this module answers everything the view draws — which
 * state a relationship is in, which fields its `dl` carries, which note it says, which actions it
 * offers — and `components/billing/payment-view.tsx` holds no rule at all, only copy ids and
 * markup. `tests/payment-panels.test.ts` is the table over this function.
 *
 * **State is read, never passed in.** The trial comes from `trialStateOf()`
 * (`lib/billing/trial.ts`, the one read of the week's clock), the pause from `pauseOf()`
 * (`lib/relationship/pause.ts`, #1121), the lapse from `membershipOf()`'s answer already carried on
 * the row, and the invitation from the row's own `invite` fact. There is no `?state=` here — the
 * bundle's prototype toggles the review states through query strings and the brief says so
 * explicitly (`IMPLEMENTATION-PROMPT.md`, "Prototype mechanics that must not be ported").
 *
 * **The Counterparty never reaches a money fact.** Panels are drawn for relationships the viewer
 * **initiated** — the only reader for whom the trial, the price, the card and the free week are
 * true statements. A relationship they were invited into contributes one `{ initiator }` to the
 * coverage band and nothing else: no state is resolved for it at all, so there is nothing to leak
 * by accident. When every relationship the viewer is party to is one they were invited into, the
 * page's role is `counterparty` and it draws the bundle's single sentence.
 *
 * **Two states the bundle does not draw, and why they are drawn anyway.** An account with a **paid**
 * subscription has no countdown and no pause, and a lapse caused by a cancelled or failed payment is
 * *not* the trial ending (`pauseOf()` deliberately answers `running` for it, because offering a
 * free trial to somebody who already paid is wrong). Neither has a prototype panel; leaving them
 * out would draw a paying member an empty list and a failed payment a relationship that looks fine.
 * They are drawn as `paid` and `paused`/`other`, each with the words its state needs and no new
 * control.
 *
 * Pure: no `pg`, no React, no `process.env`, **no clock** (`now` is an argument). `formatDate` and
 * `formatCurrency` are the copy layer's own pure formatters.
 */
import { formatCurrency, formatDate } from "@/content/core";
import { billingPlan, type BillingPlan } from "@/data/billing-plans";
import { TRIAL_PLAN_ID, trialStateOf, type TrialState } from "@/lib/billing/trial";
import type { Subscription } from "@/lib/billing/types";
import { createInviteForPath, relationshipPath } from "@/lib/flow/paths";
import type { MemberRelationshipRow } from "@/lib/member/relationships";
import type { Membership } from "@/lib/relationship/membership";
import { pauseOf, type Pause } from "@/lib/relationship/pause";

/* ------------------------------------------------------------------ *
 * The plan the panels price
 * ------------------------------------------------------------------ */

/**
 * The tier a relationship's membership is sold at, and its monthly figure.
 *
 * `TRIAL_PLAN_ID` (Basic, month) is the trial's own tier (`lib/billing/trial.ts`), so the price a
 * panel prints is the price the trial converts to — not a second number typed on this page. The
 * amount has one home (`data/billing-plans.ts`); this module names the tier and formats what the
 * fixture carries, exactly as `lib/template-catalogue.ts` does for the catalogue's cards.
 */
const MEMBERSHIP_PLAN: BillingPlan = (() => {
  const plan = billingPlan(TRIAL_PLAN_ID);
  if (plan === undefined) {
    throw new Error(
      `data/billing-plans.ts has no "${TRIAL_PLAN_ID}" plan to price a membership from`,
    );
  }
  return plan;
})();

/**
 * The monthly figure, formatted once so two panels cannot disagree.
 *
 * It is read from the plan fixture rather than typed: since #1127's approved catalogue the Basic
 * plan's month is `$9.99`, which happens to be the figure the bundle's prototype drew as mock
 * data — the number moved, the rule (derived, never typed) did not.
 */
export function membershipPrice(): string {
  return formatCurrency(MEMBERSHIP_PLAN.monthlyCents);
}

/* ------------------------------------------------------------------ *
 * What a panel draws
 * ------------------------------------------------------------------ */

/**
 * A piece of text: either the copy fixture's words by id (with the record's placeholders), or a
 * literal this module derived (a date, a price).
 *
 * The distinction is the point — a view may not type a sentence, and a fixture may not hold a
 * fact. `lib/billing/payment-view.ts` returns `copy` for everything editorial and `text` for the
 * two things only the rows know.
 */
export type PanelText =
  | {
      readonly kind: "copy";
      readonly id: string;
      readonly values?: Readonly<Record<string, string | number | PanelText>>;
    }
  | { readonly kind: "text"; readonly text: string };

/** One `dt`/`dd` pair. `label` is a fixture id; the value is a `PanelText`. */
export interface PanelField {
  readonly label: string;
  readonly value: PanelText;
}

/** The three actions a panel may carry. The view maps each to a control, never to a new one. */
export const PANEL_ACTIONS = ["add-card", "continue-setup", "get-week"] as const;

export type PanelAction = (typeof PANEL_ACTIONS)[number];

/** The five states a panel can be in. */
export const PANEL_STATES = ["trial", "invite-sent", "draft", "paused", "paid"] as const;

export type PanelState = (typeof PANEL_STATES)[number];

/** Why a paused panel is paused — it renames fields, never the state. */
export type PausedKind = "trial" | "extra-week" | "other";

export interface BillingPanel {
  readonly relationshipId: string;
  /** The relationship's own title (stage 1's answer), never the template's. */
  readonly title: string;
  /** The other person's name, for the `With {name}` line — or the fixture's stand-in. */
  readonly partner: PanelText;
  /** Where the title goes — the relationship's own screen. */
  readonly href: string;
  /**
   * The pay walk's address (`?instance=`), when the relationship has a session to open it on.
   * `null` for a draft with no session: there is genuinely nothing for the modal to open, and the
   * Continue Setup action falls back to the relationship's screen instead of linking into a refusal.
   */
  readonly payHref: string | null;
  readonly state: PanelState;
  /** `trial` / `extra-week` / `other` while `state` is `paused`; `null` otherwise. */
  readonly pausedKind: PausedKind | null;
  readonly badge: PanelText;
  readonly fields: readonly PanelField[];
  readonly note: PanelText;
  readonly actions: readonly PanelAction[];
}

/** One Counterparty band: whose membership covers the relationship. */
export interface CoverageBand {
  readonly initiator: string;
}

export interface BillingView {
  readonly role: "initiator" | "counterparty";
  /** `"$8.95"` — the monthly figure the subtitle and every price row print. */
  readonly price: string;
  readonly panels: readonly BillingPanel[];
  readonly coverage: readonly CoverageBand[];
  /** Does the account hold a card? Read from the subscription's own provider, never guessed. */
  readonly cardOnFile: boolean;
  /** A viewer with nothing to bill — the Memberships list's one sentence. */
  readonly empty: boolean;
}

/** The facts the view is a function of. Every one of them is a row or an instant. */
export interface BillingFacts {
  /** Every relationship the viewer is a party to — `listMyRelationships()`'s rows. */
  readonly rows: readonly MemberRelationshipRow[];
  /** The account's live subscription, or `null`. One row covers the whole account. */
  readonly subscription: Subscription | null;
  /** When the one free week was claimed, or `null`. Per account, so it hides every panel's offer. */
  readonly trialExtendedAt: Date | null;
  readonly now: Date;
}

/* ------------------------------------------------------------------ *
 * Little readers
 * ------------------------------------------------------------------ */

/** A copy-backed text. */
function copy(id: string, values?: Record<string, string | number | PanelText>): PanelText {
  return values === undefined ? { kind: "copy", id } : { kind: "copy", id, values };
}

/** A derived text — a date or a price. */
function text(value: string): PanelText {
  return { kind: "text", text: value };
}

/**
 * The first name of a person, for the sentences that address somebody.
 *
 * The bundle says "use the other person's first name" and draws `Tomás`: a sentence that read
 * "Trial Starts When Tomás Álvarez Accepts" would be a different sentence. A seat with no name at
 * all answers `undefined`, so the caller chooses the stand-in — `partner-generic` from the fixture,
 * never an empty string in the middle of a sentence.
 */
export function firstNameOf(name: string | null | undefined): string | undefined {
  if (name === null || name === undefined) return undefined;
  const trimmed = name.trim();
  if (trimmed === "") return undefined;
  return trimmed.split(/\s+/)[0];
}

/**
 * Two initials from a display name, for a panel's avatar.
 *
 * The bundle draws the other party's initials in a tinted disc (, ); the first and last
 * word of the name is the rule that produces them from whatever the row holds, and an empty name
 * answers an empty string so the disc is drawn empty rather than with somebody else's letters.
 */
export function initialsOf(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part !== "");
  if (parts.length === 0) return "";
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return `${first}${last}`.toUpperCase();
}

/** The other person's name on this row, as a seat first and as an invitation second. */
function partnerNameOf(row: MemberRelationshipRow): string | undefined {
  const name =
    row.viewerRole === "initiator"
      ? (row.counterpartySeatName ?? row.counterpartyName)
      : (row.initiatorName ?? row.counterpartyName);
  const trimmed = name?.trim() ?? "";
  return trimmed === "" ? undefined : trimmed;
}

/** The account's trial, read once for the whole page. */
function trialOf(subscription: Subscription | null, now: Date): TrialState {
  return trialStateOf(subscription, now);
}

/**
 * Is a card on file?
 *
 * A `mock` row is the card-free trial (#1115 D2: no provider subscription exists during the week),
 * so the honest answer for it is "no card". Anything else is a provider subscription somebody had
 * to put a card behind. `livemode` is deliberately not consulted: test mode is not "no card", it is
 * "no charge", and the two would read the same to a member if this returned `false` for a Stripe
 * test card.
 */
export function cardOnFileOf(subscription: Subscription | null): boolean {
  return subscription !== null && subscription.provider !== "mock";
}

/* ------------------------------------------------------------------ *
 * One panel
 * ------------------------------------------------------------------ */

/** The rows of a panel, in the order the bundle draws them. */
function fieldsFor(input: {
  readonly state: PanelState;
  readonly pausedKind: PausedKind | null;
  readonly endsAt: string | null;
  readonly extensionAvailable: boolean;
  readonly cardOnFile: boolean;
  readonly partnerFirst: PanelText;
  readonly daysLeft: number | null;
}): PanelField[] {
  const price = text(membershipPrice());

  switch (input.state) {
    case "draft":
      return [
        { label: "status", value: copy("badge-not-started") },
        { label: "trial", value: copy("starts-when", { name: input.partnerFirst }) },
        { label: "after-trial", value: price },
        { label: "card", value: copy("card-not-needed") },
      ];
    case "invite-sent":
      return [
        { label: "status", value: copy("badge-accept", { name: input.partnerFirst }) },
        { label: "after-trial", value: price },
        { label: "card", value: copy("card-not-needed") },
      ];
    case "trial": {
      const fields: PanelField[] = [
        { label: "status", value: copy("badge-trial", { days: input.daysLeft ?? 0 }) },
      ];
      if (input.endsAt !== null) {
        fields.push({ label: "trial-ends", value: text(input.endsAt) });
      }
      fields.push({ label: "after-trial", value: price });
      fields.push({
        label: "card",
        value: copy(input.cardOnFile ? "card-on-file" : "card-none"),
      });
      return fields;
    }
    case "paid":
      return [
        { label: "status", value: copy("badge-paid") },
        { label: "after-trial", value: price },
        { label: "card", value: copy("card-on-file") },
      ];
    case "paused": {
      const fields: PanelField[] = [{ label: "status", value: copy("badge-paused") }];
      if (input.endsAt !== null) {
        fields.push({
          label: input.pausedKind === "trial" ? "trial-ended" : "ended",
          value: text(input.endsAt),
        });
      }
      if (input.pausedKind === "trial" && input.extensionAvailable) {
        fields.push({ label: "extra-week", value: copy("extra-week-available") });
      }
      fields.push({ label: "after-resume", value: price });
      return fields;
    }
  }
}

/** Which state a relationship is in, in the order the product asks the question. */
export function panelStateOf(input: {
  readonly row: MemberRelationshipRow;
  readonly membership: Membership;
  readonly trial: TrialState;
  readonly pause: Pause;
  readonly subscription: Subscription | null;
}): { readonly state: PanelState; readonly pausedKind: PausedKind | null } {
  const { row, membership, trial, pause } = input;

  // 1. Nothing has gone out yet. A `pending` relationship is "ready to publish" — the bundle's
  //    draft, because its note is "Send the invite" and that is still the next thing to do.
  if (row.status === "draft" || row.status === "pending") {
    return { state: "draft", pausedKind: null };
  }

  // 2. An invitation exists and nobody has taken it: the week has not opened and no day is spent
  //    (`grantAcceptanceTrial()` runs inside the claim, and only there).
  if (row.status === "published" && row.invite !== null && !row.invite.claimed) {
    return { state: "invite-sent", pausedKind: null };
  }

  // A published relationship with **no** invitation row is a defect the detail screen names; its
  // next action is still the invite, so it draws the draft panel rather than claiming a week.
  if (row.status === "published" && row.invite === null) {
    return { state: "draft", pausedKind: null };
  }

  // 3. Read-only. `pauseOf()` distinguishes the trial's lapse (one free week available) from the
  //    extra week's (used), and `membershipOf()` names a cancelled or failed payment — which this
  //    module must not dress as a free week.
  if (membership.state === "lapsed") {
    if (pause.paused) {
      return {
        state: "paused",
        pausedKind: pause.state === "extra-week-ended" ? "extra-week" : "trial",
      };
    }
    return { state: "paused", pausedKind: "other" };
  }

  // 4. The week is running — the bundle's headline panel.
  if (trial.state === "active" || trial.state === "ending") {
    return { state: "trial", pausedKind: null };
  }

  // 5. Somebody is paying. Nothing counts down and nothing is paused.
  if (input.subscription !== null && input.subscription.status !== "trialing") {
    return { state: "paid", pausedKind: null };
  }

  // 6. A live row with no trial and no paying subscription is drift (`membershipOf()` reads it as
  //    lapsed when it can, and did not here). Read-only, no offer, because nothing about this row
  //    can pay a card.
  return { state: "paused", pausedKind: "other" };
}

/** One relationship the viewer initiated, as a panel. */
export function panelOf(
  row: MemberRelationshipRow,
  facts: Pick<BillingFacts, "subscription" | "trialExtendedAt" | "now">,
): BillingPanel {
  const partner = partnerNameOf(row);
  const first = firstNameOf(partner);
  const partnerFirst: PanelText = first === undefined ? copy("partner-generic") : text(first);
  const trial = trialOf(facts.subscription, facts.now);
  const endsAtDate =
    facts.subscription !== null && facts.subscription.status === "trialing"
      ? new Date(facts.subscription.currentPeriodEnd)
      : null;
  const pause = pauseOf({
    membership: row.membership,
    endsAt: endsAtDate,
    trialExtendedAt: facts.trialExtendedAt,
    now: facts.now,
  });
  const { state, pausedKind } = panelStateOf({
    row,
    membership: row.membership,
    trial,
    pause,
    subscription: facts.subscription,
  });
  const cardOnFile = cardOnFileOf(facts.subscription);
  const daysLeft = trial.state === "active" || trial.state === "ending" ? trial.daysLeft : null;
  // The window a paused panel dates: the trial's end, or the extra week's (the period the claim
  // moved). `null` when the row holds no readable end, and then the panel prints no date at all
  // rather than a date it made up.
  /*
   * The window a paused panel dates. The subscription's period end is the trial's own answer; when
   * the row holds none (a subscription that was cancelled rather than merely lapsed) the membership
   * already carries the instant it ended, and that is the honest date — a panel that printed no
   * date there would leave a read-only relationship undated.
   */
  const endsAt =
    endsAtDate !== null && !Number.isNaN(endsAtDate.getTime())
      ? formatDate(endsAtDate.toISOString())
      : row.membership.endedAt !== null
        ? formatDate(row.membership.endedAt.toISOString())
        : null;

  const fields = fieldsFor({
    state,
    pausedKind,
    endsAt,
    extensionAvailable: pause.extensionAvailable,
    cardOnFile,
    partnerFirst,
    daysLeft,
  });

  return {
    relationshipId: row.id,
    title: row.relationshipTitle ?? row.title,
    partner: partner === undefined ? copy("partner-generic") : text(partner),
    href: relationshipPath(row.id),
    payHref:
      row.sessionRecordId === null
        ? null
        : createInviteForPath(row.templateSlug, row.sessionRecordId),
    state,
    pausedKind,
    badge: fields[0].value,
    fields,
    note: noteOf({
      state,
      pausedKind,
      endsAt,
      cardOnFile,
      partnerFirst,
      extensionAvailable: pause.extensionAvailable,
    }),
    actions: actionsOf({ state, cardOnFile, extensionAvailable: pause.extensionAvailable }),
  };
}

/** The one sentence under the panel's rows — what to do, or what is happening. */
function noteOf(input: {
  readonly state: PanelState;
  readonly pausedKind: PausedKind | null;
  readonly endsAt: string | null;
  readonly cardOnFile: boolean;
  readonly partnerFirst: PanelText;
  readonly extensionAvailable: boolean;
}): PanelText {
  switch (input.state) {
    case "draft":
      return copy("note-draft", { name: input.partnerFirst });
    case "invite-sent":
      return copy("note-accept", { name: input.partnerFirst });
    case "paid":
      return copy("note-paid");
    case "trial":
      return input.cardOnFile
        ? copy("note-trial-card", { date: input.endsAt ?? "" })
        : copy("note-trial", { date: input.endsAt ?? "" });
    case "paused":
      if (input.pausedKind === "trial") {
        return input.extensionAvailable ? copy("note-paused") : copy("note-paused-extended");
      }
      if (input.pausedKind === "extra-week") return copy("note-paused-extended");
      return copy("note-paused-payment");
  }
}

/**
 * The controls a panel carries.
 *
 * **The free week is drawn only while the server says it is available.** `pauseOf()` answers
 * `extensionAvailable: false` for good once the claim row exists, so the button is absent rather
 * than drawn-and-refused — the rule #1121 already follows on the relationship screen, and the
 * bundle's "one time only". `claimTrialExtension()` re-asks under a row lock regardless.
 */
function actionsOf(input: {
  readonly state: PanelState;
  readonly cardOnFile: boolean;
  readonly extensionAvailable: boolean;
}): PanelAction[] {
  switch (input.state) {
    case "draft":
      return ["continue-setup"];
    case "invite-sent":
    case "paid":
      return [];
    case "trial":
      // A card on file means the trial converts on its own; there is nothing to add.
      return input.cardOnFile ? [] : ["add-card"];
    case "paused":
      return input.extensionAvailable ? ["add-card", "get-week"] : ["add-card"];
  }
}

/* ------------------------------------------------------------------ *
 * The page
 * ------------------------------------------------------------------ */

/**
 * The whole surface, from the rows.
 *
 * The role is derived, not passed: a viewer who initiated nothing and was invited into something
 * is the Counterparty, and their page is one sentence per covering account. A viewer who initiated
 * something sees their panels **and** the coverage bands for anything they were invited into —
 * their own billing facts are theirs to see, and the band a joined relationship draws holds no
 * fact about them at all.
 */
export function billingViewOf(facts: BillingFacts): BillingView {
  const price = membershipPrice();
  const panels: BillingPanel[] = [];
  const coverage: CoverageBand[] = [];
  const seenInitiators = new Set<string>();

  for (const row of facts.rows) {
    // A closed relationship is not a billing question: nothing is counting down, nothing is owed,
    // and the bundle draws no panel for it.
    if (row.membership.state === "closed") continue;

    if (row.viewerRole === "initiator") {
      panels.push(panelOf(row, facts));
      continue;
    }

    const initiator = row.initiatorName?.trim();
    const name = initiator === undefined || initiator === "" ? "The initiator" : initiator;
    if (seenInitiators.has(name)) continue;
    seenInitiators.add(name);
    coverage.push({ initiator: name });
  }

  return {
    role: panels.length === 0 && coverage.length > 0 ? "counterparty" : "initiator",
    price,
    panels,
    coverage,
    cardOnFile: cardOnFileOf(facts.subscription),
    empty: panels.length === 0,
  };
}
