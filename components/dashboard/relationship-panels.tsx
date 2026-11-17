// template-ancestor: components/assessment-flow/record-detail-shell.tsx   (variation: the six panels of one record's tab layer, each a card drawn from the read that already exists, where the template page draws one list per section)
/**
 * The five panels #1124 adds to `/dashboard/relationships/[id]`, one file.
 *
 * **The tab layer is a re-view, not a second screen.** Every panel here reads the same
 * `MemberRelationshipView` the page already rendered and re-states it in the approved bundle's
 * shape (`docs/specs/v2-bundles/03-spec-design-page-relationship-detail-v2/`): Members is the two
 * seats and what happened to the invitation, Details is the record's own facts and its timeline,
 * Settings is the two values the assessment was configured with, Payment is the membership with
 * the Counterparty's no-leak rule, and Discussion is the thread's one honest empty state. None of
 * them writes: the writes this screen owns (Aspects, publish, reissue, complete, the Counterparty's
 * fork) already exist and did not move.
 *
 * **Two rules decided the shape, and both come from the owner.**
 *
 *   no-leak    the Counterparty never reads a plan, a price, a card ask, a trial countdown or an
 *              extension. Payment therefore branches on the seat before it renders anything, and
 *              the Counterparty's whole tab is one sentence naming who pays.
 *   no second  Discussion has no model yet (#921 owns the thread). A composer here would be a
 *   model      control that writes nowhere, so the panel draws the heading and the empty state,
 *              and the tab exists for the day the thread lands.
 *
 * **Copy arrives from the route's fixture.** This module is in the page's import closure, so E23
 * counts every literal in it against a budget of zero: a label typed here is a red `data:check`.
 * That is why every string is a `itemLabel(...)` over a `PageCopy` section and not a word of
 * English is written in this file.
 */
import { Chip } from "@/components/ui/badge";
import {
  DETAIL_CARD,
  DETAIL_FACT_LABEL,
  DETAIL_MUTED,
  DetailSection,
} from "@/components/assessment-flow/record-detail-shell";
import { formatDate } from "@/content/core";
import type { PageCopy } from "@/content/pages";
import type { MemberRelationshipView } from "@/lib/member/relationships";
import {
  fillLabel,
  itemLabel,
  itemLabelOr,
  pageItemOf,
  sectionBody,
  sectionOf,
} from "@/lib/page-copy";
import type { ReactNode } from "react";

/** One labelled value in a panel's fact list — the same anatomy the shell's facts card uses. */
function FactRows({ rows }: { rows: readonly { label: string; value: ReactNode }[] }) {
  return (
    <dl className="mt-4 grid gap-3 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label}>
          <dt className={DETAIL_FACT_LABEL}>{row.label}</dt>
          <dd className={DETAIL_MUTED}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Discussion — the heading, the one-line body, and the empty state.
 *
 * The thread is #921's model and nobody else's. What this panel refuses to do is draw a composer
 * over a table that does not exist: a person who typed there would lose the words on reload and
 * the screen would have promised a feature the database cannot keep.
 */
export function DiscussionPanel({ copy }: { copy: PageCopy }) {
  const discussion = sectionOf(copy, "discussion");
  return (
    <DetailSection
      title={discussion.heading}
      body={sectionBody(discussion)}
      framed
      hooks={{ "data-relationship-discussion": "empty" }}
    >
      <p className={`mt-4 ${DETAIL_MUTED}`} data-discussion-empty="true">
        {itemLabel(discussion, "empty")}
      </p>
    </DetailSection>
  );
}

/**
 * Members — the two seats, then the invitation's history.
 *
 * **The seat is the fact, not the invitation.** A relationship carries the initiator's account and
 * a Counterparty seat that may be bound without any invitation row (the demo branch's four are),
 * so the name printed is the seat's name with the invitation's as the fallback — the same order
 * `relationship-detail.tsx` uses in the band's roles line.
 *
 * The history is a list, not a control: at most four sentences, plain `<li>` rows, no scroll box
 * and no focus trap. It never grows an action either — cancel, resend and leaving are #1135's, and
 * a second control here would be a second place invitations die.
 */
export function MembersPanel({
  copy,
  relationship,
}: {
  copy: PageCopy;
  relationship: MemberRelationshipView;
}) {
  const members = sectionOf(copy, "members");
  const history = itemLabel(members, "history");
  const you = itemLabel(members, "you");

  /** The Counterparty's name: the bound seat first, what the initiator typed second. */
  const counterparty = relationship.counterpartySeatName ?? relationship.counterpartyName;
  const rows = [
    {
      id: "initiator",
      role: pageItemOf(copy, "role-initiator").label,
      name: relationship.initiatorName ?? pageItemOf(copy, "role-initiator").label,
      viewer: relationship.viewerRole === "initiator",
      party: "initiator" as const,
    },
    {
      id: "counterparty",
      role: pageItemOf(copy, "role-counterparty").label,
      name: counterparty ?? itemLabel(members, "seat-empty"),
      viewer: relationship.viewerRole === "counterparty",
      party: "counterparty" as const,
    },
  ];

  /*
   * One sentence per thing that has happened, in the order it happened. `publishedAt` is the only
   * instant the invitation has — `invite.claimed` is a boolean and no row records when — so a
   * claimed seat says so without inventing a date, and an expired link prints the instant it
   * stops working, which is the one date the read does carry.
   */
  const events: string[] = [];
  /* `?? null` rather than `=== null`: the read always answers a row or `null`, but a projection
     built by a test or by an older caller may simply omit the field, and a panel must not throw on
     a fact it can state as absent. */
  const invite = relationship.invite ?? null;
  if (invite === null) {
    events.push(itemLabel(members, "no-invite"));
  } else {
    if (relationship.publishedAt !== null) {
      events.push(
        fillLabel(itemLabel(members, "sent"), { date: formatDate(relationship.publishedAt) }),
      );
    }
    if (invite.claimed) events.push(itemLabel(members, "claimed"));
    if (invite.revoked) events.push(itemLabel(members, "revoked"));
    events.push(
      fillLabel(itemLabel(members, "expires"), {
        date: formatDate(new Date(invite.expiresAt).toISOString()),
      }),
    );
  }

  return (
    <section className={`space-y-4 ${DETAIL_CARD}`} data-relationship-members="true">
      <h2 className="text-xl font-semibold text-foreground">{members.heading}</h2>
      <ul className="space-y-3">
        {rows.map((row) => (
          <li
            key={row.id}
            data-relationship-member={row.party}
            className={`flex flex-wrap items-center gap-2 rounded-md border p-4 ${
              row.party === "initiator"
                ? "border-initiator-line bg-initiator-tint"
                : "border-counterparty-line bg-counterparty-tint"
            }`}
          >
            <span
              className={`text-sm font-semibold ${
                row.party === "initiator" ? "text-initiator-ink" : "text-counterparty-ink"
              }`}
            >
              {row.name}
            </span>
            <Chip variant="soft">{row.role}</Chip>
            {row.viewer ? (
              <span className="text-xs text-muted-foreground" data-relationship-member-you="true">
                {you}
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      <h3 className="text-base font-semibold text-foreground">{history}</h3>
      {/*
        A plain list, not a scroll box. The history is at most four sentences (sent, joined,
        revoked, stops working) and a `max-h` region over four lines would be a scroll container
        that never scrolls — with a `tabIndex={0}` nobody needs, which is the focusable
        non-interactive element both `noNoninteractiveTabindex` and the axe pass refuse.
      */}
      <ul
        data-invitation-history={invite === null ? "none" : "present"}
        className="space-y-1 text-sm text-muted-foreground"
      >
        {events.map((event) => (
          <li key={event}>{event}</li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Details — the record's own facts, then its timeline.
 *
 * **These are the facts the aside does not already print.** The four in the aside (State, Started,
 * Published, Invited) are the record's numbers; these are what it is made of — the template whose
 * words the pair answers, how many Aspects that is, what the invitation is doing, and which seat
 * the reader holds. One fact, one place: a Details tab that repeated the aside would be the
 * "said twice in two ways" defect #975 D2 exists to prevent.
 */
export function DetailsPanel({
  copy,
  relationship,
  invitationSentence,
}: {
  copy: PageCopy;
  relationship: MemberRelationshipView;
  /** The band's own sentence for `relationship.view`, resolved by the page. */
  invitationSentence: string;
}) {
  const details = sectionOf(copy, "details");
  const timeline = itemLabel(details, "timeline");
  const seat =
    relationship.viewerRole === "initiator"
      ? pageItemOf(copy, "role-initiator").label
      : pageItemOf(copy, "role-counterparty").label;

  const events: string[] = [
    fillLabel(itemLabel(details, "created"), { date: formatDate(relationship.createdAt) }),
  ];
  if (relationship.publishedAt !== null) {
    events.push(
      fillLabel(itemLabel(details, "published"), { date: formatDate(relationship.publishedAt) }),
    );
  }

  return (
    <div className="space-y-6">
      <section className={`space-y-2 ${DETAIL_CARD}`} data-relationship-details="true">
        <h2 className="text-xl font-semibold text-foreground">{details.heading}</h2>
        <FactRows
          rows={[
            { label: itemLabel(details, "template"), value: relationship.template.title },
            {
              label: pageItemOf(copy, "aspects").label,
              value: String(relationship.aspectCount),
            },
            { label: itemLabel(details, "invitation"), value: invitationSentence },
            { label: itemLabel(details, "seat"), value: seat },
          ]}
        />
      </section>

      <section className={`space-y-2 ${DETAIL_CARD}`} data-relationship-timeline="true">
        <h3 className="text-base font-semibold text-foreground">{timeline}</h3>
        <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
          {events.map((event) => (
            <li key={event}>{event}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}

/**
 * Settings — the two values, and when a change would take effect.
 *
 * **Read-only on purpose.** The editor that writes Mode and Alignment Tolerance is this
 * relationship's own edit panel (#623), mounted from the page's `editTrigger`; a second set of
 * selects here would be a second answer to "who may move the Setting", and the write re-asks the
 * seat under its own lock precisely because a screen is a courtesy. So the panel states the two
 * values while the read can produce them, and says who owns them when it cannot (a Counterparty,
 * a closed relationship).
 */
export function SettingsPanel({
  copy,
  settings,
}: {
  copy: PageCopy;
  settings?: { readonly mode: string; readonly setting: string };
}) {
  const settingsCopy = sectionOf(copy, "settings");
  const publishCopy = sectionOf(copy, "publish");
  const none = pageItemOf(copy, "none").label;

  const mode =
    settings === undefined
      ? none
      : (itemLabelOr(publishCopy, `mode-${settings.mode}`) ?? settings.mode);
  const tolerance =
    settings === undefined
      ? none
      : (itemLabelOr(publishCopy, `setting-${settings.setting}`) ?? settings.setting);

  return (
    <section className={`space-y-2 ${DETAIL_CARD}`} data-relationship-settings="true">
      <h2 className="text-xl font-semibold text-foreground">{settingsCopy.heading}</h2>
      <FactRows
        rows={[
          { label: itemLabel(settingsCopy, "mode"), value: mode },
          { label: itemLabel(settingsCopy, "setting"), value: tolerance },
        ]}
      />
      <p className="text-sm font-medium text-foreground">{itemLabel(settingsCopy, "next-round")}</p>
      {settings === undefined ? (
        <p className={DETAIL_MUTED}>{itemLabel(settingsCopy, "by-starter")}</p>
      ) : null}
    </section>
  );
}

/**
 * Payment — the membership, and the one axis that is not symmetrical.
 *
 * **The Counterparty's whole tab is one sentence and it names no money.** Not a plan, not a price,
 * not a card, not a countdown, not the word for any of them: they are never charged for a
 * relationship somebody else started, and a screen that showed them a number would be inventing a
 * bill. The Initiator reads the membership state, the billing owner, and when their trial ends.
 *
 * Billing itself is #1132's surface, and this panel adds **no control**: adding a card, the extra
 * week and the resume walk are decisions that live on the page that owns the subscription, so
 * there is still exactly one place money moves.
 */
export function PaymentPanel({
  copy,
  relationship,
}: {
  copy: PageCopy;
  relationship: MemberRelationshipView;
}) {
  const payment = sectionOf(copy, "payment");
  /* The seat, not the permission: a reader whose seat says Initiator and whose account column
     names somebody else is still not the payer here, and `isInitiator` is the permission. */
  const isPayer = relationship.viewerRole === "initiator";

  if (!isPayer) {
    return (
      <section className={`space-y-2 ${DETAIL_CARD}`} data-relationship-payment="counterparty">
        <h2 className="text-xl font-semibold text-foreground">{payment.heading}</h2>
        <p className={DETAIL_MUTED}>
          {fillLabel(itemLabel(payment, "covered"), {
            name: relationship.initiatorName ?? pageItemOf(copy, "role-initiator").label,
          })}
        </p>
      </section>
    );
  }

  return (
    <section className={`space-y-2 ${DETAIL_CARD}`} data-relationship-payment="initiator">
      <h2 className="text-xl font-semibold text-foreground">{payment.heading}</h2>
      <FactRows
        rows={[
          {
            label: itemLabel(payment, "membership"),
            value: (
              <Chip
                variant="soft"
                data-membership-state={
                  relationship.membership.state === "lapsed" ? "lapsed" : "open"
                }
              >
                {relationship.membership.state === "lapsed"
                  ? itemLabel(payment, "lapsed")
                  : itemLabel(payment, "open")}
              </Chip>
            ),
          },
          { label: itemLabel(payment, "billing-owner"), value: itemLabel(payment, "you") },
          {
            label: pageItemOf(copy, "trial").label,
            value:
              relationship.trialEndsAt === null
                ? itemLabel(payment, "no-trial")
                : fillLabel(itemLabel(payment, "trial-ends"), {
                    date: formatDate(relationship.trialEndsAt),
                  }),
          },
        ]}
      />
    </section>
  );
}
