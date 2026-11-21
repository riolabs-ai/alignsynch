/**
 * The activity feed's vocabulary, its identity rule and its derivations — as pure functions.
 *
 * The table is `db/migrations/0044_activity_event.sql`; the writer is `lib/db/activity-events.ts`;
 * the two callers are `scripts/db-seed.mjs` (source `seed`) and `scripts/demo-simulate-activity.mjs`
 * (source `simulate`). Nothing in this module reads a clock, opens a connection or imports `pg`, so
 * every rule the feed rests on can be proved without a database — the same split
 * `scripts/demo-verify-rules.mjs` uses for the demo check, and for the same reason.
 *
 * **Two sources, and no third.** `seed` is the dataset's own timeline, written inside the seed's
 * phase-2 transaction and replaced on every run. `simulate` is an explicit action that plays a live
 * timeline just now. There is **no `cron`**: the tree carries no scheduler, and a Vercel cron entry
 * runs on production deployments while the demo is a branch deployment (`vercel.json` has no
 * `crons` block; measured, not assumed). `db:verify` V35 reads the table's CHECK definition and
 * fails if the word ever appears there.
 *
 * **`activityIdempotencyKey()` is the row's identity.** Every writer is re-runnable, and neither may
 * duplicate: the key is derived from what the row *is* — source, relationship, kind and actor — so a
 * second run collides on the UNIQUE constraint and the `ON CONFLICT DO NOTHING` writes nothing. A
 * random key would make the constraint decorative.
 */

/** The two writers that exist. Ordered as the CHECK in `0044` spells them. */
export const ACTIVITY_SOURCES = ["seed", "simulate"] as const;

export type ActivitySource = (typeof ACTIVITY_SOURCES)[number];

/**
 * The feed's nouns: the five acts the product performs and the one closure.
 *
 * A shorter list than "everything that ever happens" on purpose — every kind here has a sentence the
 * feed shows and a screenshot an owner has approved. A seventh word is a migration and a copy
 * decision, not a string a writer may invent.
 */
export const ACTIVITY_KINDS = [
  "relationship.created",
  "invite.sent",
  "invite.claimed",
  "answers.submitted",
  "report.published",
  "relationship.closed",
] as const;

export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

/** The two seats the model has. A coach is v2.0 and is not a value here either. */
export const ACTIVITY_PARTY_ROLES = ["initiator", "counterparty"] as const;

export type ActivityPartyRole = (typeof ACTIVITY_PARTY_ROLES)[number];

/** One row, as a writer supplies it. `id` and `created_at` belong to the table. */
export interface ActivityEventWrite {
  readonly source: ActivitySource;
  readonly kind: ActivityKind;
  readonly relationshipId: string;
  /** The seat that did it, or `null` for an event nobody did (a closure). Both halves or neither. */
  readonly sessionRecordId: string | null;
  readonly partyRole: ActivityPartyRole | null;
  readonly summary: string;
  readonly occurredAt: string;
  readonly idempotencyKey: string;
}

/**
 * The row's identity: `<source>/<relationship>/<kind>/<actor>`.
 *
 * The actor is the seat's role, or `-` for a closure. Everything that makes two rows *different
 * facts* is in the key, and everything that makes them the *same* fact is not — which is what lets
 * the seed rewrite a timeline every run and the simulate action be pressed twice.
 */
export function activityIdempotencyKey(event: {
  readonly source: ActivitySource;
  readonly relationshipId: string;
  readonly kind: ActivityKind;
  readonly partyRole: ActivityPartyRole | null;
}): string {
  return [event.source, event.relationshipId, event.kind, event.partyRole ?? "-"].join("/");
}

/**
 * The lifecycle facts a timeline is derived from — the shape `content/assessment.ts`
 * `seededLifecycleOf()` answers, declared structurally so this module imports nothing (and so the
 * derivation stays provable with a literal instead of a fixture).
 */
export interface ActivityLifecycleShape {
  readonly status: string;
  readonly invite: "created" | "sent" | "claimed";
  readonly seats: "initiator" | "both";
  readonly answers: "none" | "initiator" | "both";
  readonly publishedAt: string | null;
  readonly completedAt: string | null;
  readonly expiredAt: string | null;
  readonly voidReason: string | null;
  readonly lapseReason: string | null;
}

/**
 * What the derivation reads from a session: its id (which names the relationship
 * `relationship-<id>`), its fixture instant, and the two names the feed says.
 *
 * `parties` is the **fixture's** list, not the seats the seed writes: a `pending` relationship has
 * one party row and still knows who it was sent to, and the invitation's sentence names them.
 */
export interface ActivitySeedSession {
  readonly id: string;
  readonly date: string;
  readonly parties: readonly {
    readonly role: ActivityPartyRole;
    readonly name: string;
  }[];
}

/** `relationship-<session id>` — the one place that derivation is spelled, as `db-seed` does. */
export function relationshipIdOf(sessionId: string): string {
  return `relationship-${sessionId}`;
}

/** An ISO instant shifted by whole minutes. Pure arithmetic: no clock, no locale, no `Date.now`. */
function minutesAfter(instant: string, minutes: number): string {
  return new Date(new Date(instant).getTime() + minutes * 60_000).toISOString();
}

/** The name on one seat, or a neutral word when the fixture names nobody there. */
function nameOf(session: ActivitySeedSession, role: ActivityPartyRole): string {
  return session.parties.find((party) => party.role === role)?.name ?? role;
}

/**
 * The timeline a seeded relationship's lifecycle implies — the **whole** derivation, so the count
 * `pnpm demo:verify` asserts is a property of the dataset and not of a list kept beside it.
 *
 * One row per act the lifecycle records, and no row for an act it does not:
 *
 *   created      every relationship — the initiator started it.
 *   invite.sent  invite is `sent` or `claimed` (a claimed invitation was sent first).
 *   invite.claimed  invite is `claimed` — the counterparty took the seat.
 *   answers.submitted  once per side `answers` says filled their sheet in.
 *   report.published  `completedAt` — the subscription finished, so both of them have a report.
 *   relationship.closed  the two terminal outcomes, and the only rows with no actor: an operator
 *                        voided it, or the timetable lapsed it. Nobody's seat did either.
 *
 * Instants are offsets from the session's own fixture `date` (which is the relationship's
 * `created_at`) and from the lifecycle's `publishedAt`/`completedAt`/`expiredAt` — never a
 * wall-clock read, because a seed has to be byte-identical on a second run and `data:check` E10
 * rejects a fixture that reads a clock. The offsets are fixed so the feed reads in order: the
 * invitation goes out when the relationship is published, the claim an hour later, the sheets after
 * that.
 */
export function seedActivityEvents(
  sessions: readonly {
    readonly session: ActivitySeedSession;
    readonly lifecycle: ActivityLifecycleShape;
  }[],
): ActivityEventWrite[] {
  const events: ActivityEventWrite[] = [];
  const push = (
    session: ActivitySeedSession,
    kind: ActivityKind,
    partyRole: ActivityPartyRole | null,
    occurredAt: string,
    summary: string,
  ) => {
    const relationshipId = relationshipIdOf(session.id);
    events.push({
      source: "seed",
      kind,
      relationshipId,
      sessionRecordId: partyRole === null ? null : session.id,
      partyRole,
      summary,
      occurredAt,
      idempotencyKey: activityIdempotencyKey({
        source: "seed",
        relationshipId,
        kind,
        partyRole,
      }),
    });
  };

  for (const { session, lifecycle } of sessions) {
    const initiator = nameOf(session, "initiator");
    const counterparty = nameOf(session, "counterparty");
    // `publishedAt` is non-null for every lifecycle word but `draft`; the fallbacks keep the
    // offsets honest rather than inventing an instant out of `now()`.
    const published = lifecycle.publishedAt ?? session.date;

    push(
      session,
      "relationship.created",
      "initiator",
      session.date,
      `${initiator} started this relationship.`,
    );

    if (lifecycle.invite !== "created") {
      push(
        session,
        "invite.sent",
        "initiator",
        published,
        `${initiator} sent the invitation to ${counterparty}.`,
      );
    }

    if (lifecycle.invite === "claimed") {
      push(
        session,
        "invite.claimed",
        "counterparty",
        minutesAfter(published, 60),
        `${counterparty} joined and started their sheet.`,
      );
    }

    if (lifecycle.answers === "initiator" || lifecycle.answers === "both") {
      push(
        session,
        "answers.submitted",
        "initiator",
        minutesAfter(published, 120),
        `${initiator} filled in their sheet.`,
      );
    }

    if (lifecycle.answers === "both") {
      push(
        session,
        "answers.submitted",
        "counterparty",
        minutesAfter(published, 180),
        `${counterparty} filled in their sheet — both sheets are in.`,
      );
    }

    if (lifecycle.completedAt !== null) {
      push(
        session,
        "report.published",
        "initiator",
        lifecycle.completedAt,
        "The report is published for both of you.",
      );
    }

    if (lifecycle.status === "void") {
      push(
        session,
        "relationship.closed",
        null,
        minutesAfter(published, 1440),
        lifecycle.voidReason === null
          ? "Closed by support."
          : `Closed by support — ${lifecycle.voidReason}`,
      );
    }

    if (lifecycle.status === "expired") {
      push(
        session,
        "relationship.closed",
        null,
        lifecycle.expiredAt ?? minutesAfter(published, 1440),
        lifecycle.lapseReason === null
          ? "The invitation lapsed."
          : `The invitation lapsed — ${lifecycle.lapseReason}`,
      );
    }
  }

  return events;
}

/**
 * How many relationships the simulate action touches, and therefore the upper bound of the rows it
 * writes: two seats each. It is a **cap**, not a count — the action says "play a live timeline for
 * the busiest relationships", and how many of them the branch has is a fact about the branch.
 *
 * `data/verify/demo-expectations.json` authors the band `demo:verify` accepts for this source, and
 * `tests/activity-events.test.ts` holds that band's ceiling to this cap. An exact count here would
 * be a check that fails the moment somebody presses the action twice.
 */
export const SIMULATE_MAX_RELATIONSHIPS = 12;

/** The most rows one simulate run can write — the band's ceiling, derived not typed. */
export const SIMULATE_MAX_EVENTS = SIMULATE_MAX_RELATIONSHIPS * ACTIVITY_PARTY_ROLES.length;

/** One seat the simulate action can play, read from the rows (`party`, `session`, `relationship`). */
export interface SimulateSeat {
  readonly relationshipId: string;
  readonly sessionRecordId: string;
  readonly partyRole: ActivityPartyRole;
  readonly partyName: string;
}

/**
 * The timeline the simulate action writes: one `answers.submitted` per seat of the first
 * `SIMULATE_MAX_RELATIONSHIPS` relationships it was handed, at `nowIso` minus a few minutes so the
 * feed reads newest-first instead of every row sharing one instant.
 *
 * `nowIso` is passed in rather than read: the caller is a script (a clock is legal there) and this
 * function stays pure, which is what makes the ordering testable.
 *
 * Every row is `source: "simulate"`, so `db:verify` and the demo check can tell a played timeline
 * from the dataset's own — and so the demo reset never confuses the two.
 */
export function simulateActivityEvents(
  seats: readonly SimulateSeat[],
  nowIso: string,
): ActivityEventWrite[] {
  const relationshipIds: string[] = [];
  for (const seat of seats) {
    if (!relationshipIds.includes(seat.relationshipId)) relationshipIds.push(seat.relationshipId);
  }
  const chosen = new Set(relationshipIds.slice(0, SIMULATE_MAX_RELATIONSHIPS));

  return seats
    .filter((seat) => chosen.has(seat.relationshipId))
    .map((seat, index) => ({
      source: "simulate" as const,
      kind: "answers.submitted" as const,
      relationshipId: seat.relationshipId,
      sessionRecordId: seat.sessionRecordId,
      partyRole: seat.partyRole,
      summary: `${seat.partyName} filled in their sheet just now.`,
      occurredAt: minutesAfter(nowIso, -(index + 1)),
      idempotencyKey: activityIdempotencyKey({
        source: "simulate",
        relationshipId: seat.relationshipId,
        kind: "answers.submitted",
        partyRole: seat.partyRole,
      }),
    }));
}

/** One row as `db:verify` V35 reads it back: the event, and what its seat resolves to. */
export interface ActivitySeatRow {
  readonly id: string;
  readonly relationshipId: string;
  readonly sessionRecordId: string | null;
  readonly partyRole: string | null;
  /** The relationship the seat's session belongs to; `null` when no `party` row matches it. */
  readonly seatRelationshipId: string | null;
}

/**
 * V35's row half: every event whose seat does not resolve, or resolves to another relationship.
 *
 * The table's own FK makes the first case impossible on a database whose constraints are intact,
 * which is exactly why it is checked — the same reason V29 re-states a UNIQUE it also checks exists.
 * The second case the FK **cannot** express (the seat is a real seat on a real session, just not on
 * this relationship's), so this is the only guard there is for it: a feed row that carries one
 * relationship's name over another's seat renders somebody else's act on the wrong screen.
 */
export function activityEventProblems(
  rows: readonly ActivitySeatRow[],
): { code: "V35"; message: string }[] {
  const problems: { code: "V35"; message: string }[] = [];
  for (const row of rows) {
    const hasSeat = row.sessionRecordId !== null && row.partyRole !== null;
    if (!hasSeat && (row.sessionRecordId !== null || row.partyRole !== null)) {
      problems.push({
        code: "V35",
        message: `activity_event ${row.id} carries half a seat reference (${row.sessionRecordId ?? "null"}/${row.partyRole ?? "null"}) — the pair is both or neither`,
      });
      continue;
    }
    if (!hasSeat) continue;
    if (row.seatRelationshipId === null) {
      problems.push({
        code: "V35",
        message: `activity_event ${row.id} names ${row.sessionRecordId}/${row.partyRole}, which is not a party on that session — an event by nobody is an orphan`,
      });
      continue;
    }
    if (row.seatRelationshipId !== row.relationshipId) {
      problems.push({
        code: "V35",
        message: `activity_event ${row.id} is filed under ${row.relationshipId} but its seat belongs to ${row.seatRelationshipId} — the feed would draw one relationship's act on another's screen`,
      });
    }
  }
  return problems;
}
