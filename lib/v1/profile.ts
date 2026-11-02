/**
 * lib/v1/profile.ts — the /v1 profile's derivations, all pure.
 *
 * A persona's profile is a **relationship history**, never a quiz history (#384): the activity
 * feed, the milestones and the member-since date are computed from the fixture store's
 * relationships and completed sessions (`data/v1/fixtures.ts`). Every row is an instant a record
 * actually carries — `createdAt`, an acceptance date, a session's `completedAt` — so the feed
 * never dates an event it cannot prove, and a fact the fixtures do not hold has no row at all.
 *
 * The milestones are the three the product can defend: first session scored, three sessions
 * scored, coach joined. Each is emitted only when the store's own counts earn it. There is no
 * locked-badge grid, no rarity, no certificate and no "top 1%" — a badge that is not earned is
 * not drawn dimmed, it is absent.
 *
 * Nothing here reads a clock, React, or `lib/db/**` — the client store imports it, so it stays
 * out of the server graph for the same reason `lib/v1/derive.ts` does. `PERSONA_META`, the
 * relationship rows and the session rows are already client-safe.
 */
import type { Assessment } from "@/content/assessment";
import type { V1Relationship, V1Session } from "@/data/v1/fixtures";
import { relationshipNameOf } from "@/lib/v1/derive";
import { relationshipsVisibleTo, type DashboardPersona } from "@/lib/v1/persona";

/* ------------------------------------------------------------------ *
 * Names
 * ------------------------------------------------------------------ */

/** The relationship's display name: its own, else the template it copies, else its id. */
function nameOf(rel: V1Relationship, templates: readonly Assessment[]): string {
  const template = templates.find((candidate) => candidate.id === rel.templateId);
  return relationshipNameOf(rel, template?.title ?? rel.templateId);
}

/* ------------------------------------------------------------------ *
 * Member since
 * ------------------------------------------------------------------ */

/**
 * When the persona joined the platform — the earliest instant any relationship they are party to
 * was created. Derived, never authored: a relationship's `createdAt` is the only join-shaped date
 * the store carries, so the profile reads it rather than inventing a birthday for the persona.
 * Returns `null` when the persona has no relationships yet.
 */
export function memberSinceOf(
  persona: DashboardPersona,
  relationships: readonly V1Relationship[],
): string | null {
  const visible = relationshipsVisibleTo(persona, relationships);
  if (visible.length === 0) return null;
  let earliest = visible[0]?.createdAt ?? null;
  for (const rel of visible) {
    if (earliest === null || rel.createdAt < earliest) earliest = rel.createdAt;
  }
  return earliest;
}

/* ------------------------------------------------------------------ *
 * Activity — relationship history, not quiz history
 * ------------------------------------------------------------------ */

/** The dated events a profile feed renders, in the vocabulary the product's own flow emits. */
export type ProfileActivityKind = "joined" | "invited" | "accepted" | "scored";

export interface ProfileActivityEvent {
  readonly id: string;
  readonly kind: ProfileActivityKind;
  readonly relationshipId: string;
  readonly relationshipName: string;
  /** The party who performed the event, or null for a relationship-level event. */
  readonly actor: string | null;
  /** The ISO instant the store actually carries — never a synthesized one. */
  readonly at: string;
  readonly text: string;
}

/** The honest counts the feed's header states — relationships and sessions, not follower totals. */
export interface ProfileActivitySummary {
  readonly relationshipCount: number;
  readonly sessionsAnswered: number;
  readonly sessionsScored: number;
}

export interface ProfileActivity {
  readonly events: readonly ProfileActivityEvent[];
  readonly summary: ProfileActivitySummary;
}

/**
 * The row that dates the relationship's birth, worded by the viewer's role in it. The counterparty
 * reads "Invited to …" rather than "Joined …", because `createdAt` is the invite's instant — the
 * store carries no separate claim timestamp, and dating a join at a moment nobody recorded is
 * exactly the invented instant this module refuses.
 */
function birthText(persona: DashboardPersona, name: string): string {
  switch (persona) {
    case "initiator":
      return `Started ${name}`;
    case "counterparty":
      return `Invited to ${name}`;
    case "coach":
      return `Started coaching ${name}`;
    case "admin":
      return `Relationship created — ${name}`;
  }
}

/**
 * Relationships whose current sheet this persona has answered themselves. The store holds a
 * submitted flag per party and no per-answer instant, so "sessions answered" is a count over the
 * relationships the persona has answered — it is never a dated row, because there is no date to
 * print.
 */
function answeredCount(persona: DashboardPersona, visible: readonly V1Relationship[]): number {
  if (persona === "initiator") return visible.filter((rel) => rel.initiatorSubmitted).length;
  if (persona === "counterparty") return visible.filter((rel) => rel.counterpartySubmitted).length;
  // The coach and the admin answer nothing, by the #384 matrix — they observe.
  return 0;
}

/** Sessions scored in the relationships this persona can see — a property of the relationship. */
function scoredCount(visible: readonly V1Relationship[]): number {
  return visible.reduce((sum, rel) => sum + rel.completedSessions, 0);
}

/**
 * The persona's relationship history, newest first.
 *
 * Four kinds of row, each anchored to a field the record carries:
 *
 *  - **joined / invited / created** — `createdAt`, worded by the viewer's role.
 *  - **invited (sent)** — the same instant on the initiator's and the admin's feed, naming who
 *    was invited. The counterparty and the coach do not get a second row for it: for the
 *    counterparty their birth row already says "Invited to …".
 *  - **accepted** — each party's `initiatorAcceptedAt` / `counterpartyAcceptedAt`.
 *  - **scored** — one row per completed session, dated by that session's `completedAt`, so a
 *    relationship with four sessions prints four dates and one with none prints none. Sessions
 *    are read only where the relationship's own `completedSessions` counter agrees with the
 *    session fixture, so the feed cannot out-count the record.
 */
export function profileActivityOf(
  persona: DashboardPersona,
  relationships: readonly V1Relationship[],
  templates: readonly Assessment[],
  sessions: readonly V1Session[] = [],
): ProfileActivity {
  const visible = relationshipsVisibleTo(persona, relationships);
  const events: ProfileActivityEvent[] = [];

  for (const rel of visible) {
    const name = nameOf(rel, templates);
    const id = (kind: string) => `${rel.id}:${kind}`;

    events.push({
      id: id("joined"),
      kind: "joined",
      relationshipId: rel.id,
      relationshipName: name,
      actor: persona === "initiator" ? rel.initiatorName : null,
      at: rel.createdAt,
      text: birthText(persona, name),
    });

    if ((persona === "initiator" || persona === "admin") && rel.inviteToken !== null) {
      const invitee = rel.counterpartyName ?? "a counterparty";
      events.push({
        id: id("invited"),
        kind: "invited",
        relationshipId: rel.id,
        relationshipName: name,
        actor: rel.initiatorName,
        at: rel.createdAt,
        text:
          persona === "initiator"
            ? `Invited ${invitee} to ${name}`
            : `${rel.initiatorName} invited ${invitee} to ${name}`,
      });
    }

    if (rel.initiatorAcceptedAt !== null) {
      events.push({
        id: id("accepted-initiator"),
        kind: "accepted",
        relationshipId: rel.id,
        relationshipName: name,
        actor: rel.initiatorName,
        at: rel.initiatorAcceptedAt,
        text: `${rel.initiatorName} accepted the session in ${name}`,
      });
    }
    if (rel.counterpartyAcceptedAt !== null) {
      events.push({
        id: id("accepted-counterparty"),
        kind: "accepted",
        relationshipId: rel.id,
        relationshipName: name,
        actor: rel.counterpartyName,
        at: rel.counterpartyAcceptedAt,
        text: `${rel.counterpartyName} accepted the session in ${name}`,
      });
    }

    if (rel.completedSessions > 0) {
      const scored = sessions
        .filter((session) => session.relationshipId === rel.id)
        .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
      // Only trust the session rows when they account for every scored session the record claims;
      // otherwise fall back to the record's own latest instant rather than print a wrong count.
      if (scored.length === rel.completedSessions) {
        scored.forEach((session, index) => {
          events.push({
            id: id(`scored-${index + 1}`),
            kind: "scored",
            relationshipId: rel.id,
            relationshipName: name,
            actor: null,
            at: session.completedAt,
            text: `Session ${index + 1} of ${scored.length} scored in ${name}`,
          });
        });
      } else if (rel.lastSessionAt !== null) {
        events.push({
          id: id("scored"),
          kind: "scored",
          relationshipId: rel.id,
          relationshipName: name,
          actor: null,
          at: rel.lastSessionAt,
          text: `${rel.completedSessions} session${rel.completedSessions === 1 ? "" : "s"} scored in ${name}`,
        });
      }
    }
  }

  events.sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));

  return {
    events,
    summary: {
      relationshipCount: visible.length,
      sessionsAnswered: answeredCount(persona, visible),
      sessionsScored: scoredCount(visible),
    },
  };
}

/* ------------------------------------------------------------------ *
 * Achievements — milestones the fixture can prove
 * ------------------------------------------------------------------ */

export type ProfileMilestoneId = "first-scored" | "three-sessions" | "coach-joined";

export interface ProfileMilestone {
  readonly id: ProfileMilestoneId;
  readonly name: string;
  /** The evidence, in data-derived terms — a count or a relationship name, never a claim. */
  readonly description: string;
}

/**
 * The milestones the store can prove (#384). Each is emitted only when the fixture's own counts
 * earn it, and the evidence line quotes those counts:
 *
 *  - **first-scored** — at least one session has been scored in a relationship the persona is a
 *    party to. (The coach observes sessions rather than scoring them, so their proof is the
 *    coaching relationship itself, below.)
 *  - **three-sessions** — three or more scored sessions across those relationships.
 *  - **coach-joined** — a coach is attached to at least one relationship; for the coach persona
 *    itself the line states how many relationships they coach.
 *
 * The admin is an observer with no personal history, so their list is empty by construction. A
 * persona who has scored nothing gets `[]` — the empty state, not a greyed-out badge.
 */
export function profileMilestonesOf(
  persona: DashboardPersona,
  relationships: readonly V1Relationship[],
  templates: readonly Assessment[],
): readonly ProfileMilestone[] {
  if (persona === "admin") return [];

  const visible = relationshipsVisibleTo(persona, relationships);
  const milestones: ProfileMilestone[] = [];

  if (persona === "initiator" || persona === "counterparty") {
    const scored = scoredCount(visible);
    if (scored >= 1) {
      const names = visible
        .filter((rel) => rel.completedSessions > 0)
        .map((rel) => nameOf(rel, templates));
      milestones.push({
        id: "first-scored",
        name: "First session scored",
        description: `${scored} session${scored === 1 ? "" : "s"} scored in ${names.join(", ")}.`,
      });
    }
    if (scored >= 3) {
      milestones.push({
        id: "three-sessions",
        name: "Three sessions",
        description: `${scored} sessions scored across your relationships.`,
      });
    }
  }

  const coached = visible.filter((rel) => rel.sharedWithCoach);
  if (coached.length > 0) {
    milestones.push({
      id: "coach-joined",
      name: "Coach joined",
      description:
        persona === "coach"
          ? `You are coaching ${coached.length} relationship${coached.length === 1 ? "" : "s"}: ${coached.map((rel) => nameOf(rel, templates)).join(", ")}.`
          : `A coach is attached to ${coached.length} of your relationships.`,
    });
  }

  return milestones;
}
