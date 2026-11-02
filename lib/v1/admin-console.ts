/**
 * template-ancestor: lib/admin/instance-registry.ts   (variation: the v1 store's registry — seat state derived from an invite token rather than a `party` row, an archived column the DB registry does not have, and a session list that prints only whether a sheet is scored)
 *
 * The admin console's derivations, as one pure module — the v1 store's answer to
 * `lib/admin/instance-registry.ts`, which does the same job over Postgres rows.
 *
 * **What this module may carry, and what it may not.** `lib/admin/instance-registry.ts` decided
 * one thing and this file inherits it unchanged: an operator sees *that* a session was scored,
 * never a party's answer values, a Gap or a report figure. `AdminRelationshipRow` has a `stage`
 * (the one measure derived from opinions, and only on a complete sheet, through
 * `stageOfRelationship`) and no field that could hold an opinion, a Gap, a count of answered
 * Aspects or a per-Aspect row. `AdminSessionRow` is `state`, `scored`, `completedAt` and an
 * Aspect **count** — the blueprint's size, which every party already sees — and nothing else.
 * There is no argument on any function here through which `initiatorAnswers` or
 * `counterpartyAnswers` could reach a screen, which is what makes the limit structural rather
 * than a rule the console is trusted to remember.
 *
 * **The counts are predicates, not totals.** `adminCounts()` is the only place the overview's
 * figures are computed, and each one is a filter over the same rows the list it links to renders
 * (`filterAdminRows`) — so "3 past due" and the three rows the `past_due` filter draws cannot
 * disagree. `adminCounts` takes the rows, the templates and the accounts; it derives nothing it
 * was not handed and invents no number.
 *
 * **Two reversible states, and why they live in different places.** An archived relationship is a
 * field on the relationship (`archivedAt`) because it is a fact about that row and the store
 * already persists the row. A disabled template is a *set of ids* in the store's admin slice
 * (`lib/v1/store.tsx`) because a template is an `Assessment` — the strict content model — and an
 * operator decision about a record is not a property of the record.
 *
 * **No clock.** `now` is an argument, exactly as it is in `lib/admin/instance-registry.ts`: the
 * invite's `expired` state is derived from it, and a module that read `Date.now()` itself could
 * not be tested against a fixed day.
 *
 * Imported by client components only, so it must stay free of `lib/db/**` and `pg` (E34 walks
 * the graph and fails on the crossing).
 */
import type { AlignmentSetting, Assessment, AssessmentMode } from "@/content/assessment";
import { stepProgressOf } from "@/content/steps";
import type { RelationshipStage } from "@/content/stages";
import type {
  Persona,
  SubscriptionPlan,
  SubscriptionStatus,
  V1Account,
  V1Relationship,
  V1Session,
} from "@/data/v1/fixtures";
import {
  bothAcceptedOf,
  bothSubmittedOf,
  inviteStateOf,
  relationshipNameOf,
  sessionCompleteOf,
  stageOfRelationship,
} from "@/lib/v1/derive";

/* ------------------------------------------------------------------ *
 * Routes — one spelling each, read by the console, the cards and the rows
 * ------------------------------------------------------------------ */

/** The console's landing: the overview with the counts. */
export const ADMIN_CONSOLE_PATH = "/v1/admin/console";
/** The relationship registry — every relationship, filtered. */
export const ADMIN_RELATIONSHIPS_PATH = `${ADMIN_CONSOLE_PATH}/relationships`;
/** The template registry — every template and who started from it. */
export const ADMIN_TEMPLATES_PATH = `${ADMIN_CONSOLE_PATH}/templates`;
/** The users list — the two seats and the members. */
export const ADMIN_USERS_PATH = `${ADMIN_CONSOLE_PATH}/users`;

/** One relationship's console page. */
export function adminRelationshipPath(relationshipId: string): string {
  return `${ADMIN_RELATIONSHIPS_PATH}/${relationshipId}`;
}

/** One template's console page. */
export function adminTemplatePath(templateId: string): string {
  return `${ADMIN_TEMPLATES_PATH}/${templateId}`;
}

/* ------------------------------------------------------------------ *
 * The registry filter — the same vocabulary the overview's cards link with
 * ------------------------------------------------------------------ */

/**
 * The registry's query, exactly as the cards spell it. Every field is optional; an absent field
 * is "no constraint", which is why the overview's "Relationships" card links to the bare path.
 */
export interface AdminRegistryQuery {
  readonly stage?: RelationshipStage | null;
  readonly subscription?: SubscriptionStatus | null;
  /** `archived` is the only non-default state: live rows are the default list. */
  readonly state?: "archived" | null;
  /** `awaiting-answers` is the "sessions awaiting answers" card's filter. */
  readonly filter?: "awaiting-answers" | null;
}

/** The registry's href for a query — empty fields produce no parameter at all. */
export function adminRegistryHref(query: AdminRegistryQuery = {}): string {
  const params = new URLSearchParams();
  if (query.stage !== undefined && query.stage !== null) params.set("stage", query.stage);
  if (query.subscription !== undefined && query.subscription !== null) {
    params.set("subscription", query.subscription);
  }
  if (query.state !== undefined && query.state !== null) params.set("state", query.state);
  if (query.filter !== undefined && query.filter !== null) params.set("filter", query.filter);
  const search = params.toString();
  return search === "" ? ADMIN_RELATIONSHIPS_PATH : `${ADMIN_RELATIONSHIPS_PATH}?${search}`;
}

/** A query read off `searchParams`, with anything unrecognised dropped rather than trusted. */
export function adminRegistryQueryOf(raw: {
  readonly stage?: string;
  readonly subscription?: string;
  readonly state?: string;
  readonly filter?: string;
}): AdminRegistryQuery {
  const stage =
    raw.stage === "invited" ||
    raw.stage === "connected" ||
    raw.stage === "sharing" ||
    raw.stage === "aligned"
      ? raw.stage
      : null;
  const subscription =
    raw.subscription === "active" ||
    raw.subscription === "past_due" ||
    raw.subscription === "lapsed"
      ? raw.subscription
      : null;
  const state = raw.state === "archived" ? ("archived" as const) : null;
  const filter = raw.filter === "awaiting-answers" ? ("awaiting-answers" as const) : null;
  return { stage, subscription, state, filter };
}

/* ------------------------------------------------------------------ *
 * Seats
 * ------------------------------------------------------------------ */

/**
 * What a seat is, from an operator's side — the v1 store's four states, not the DB registry's
 * five. There is no `seat` state here: in this prototype a party row is always either the
 * initiator's account, a claimed invitation, or nobody. `not-invited` is the one addition, and it
 * is the honest name for a relationship whose invite was never sent.
 */
export const ADMIN_SEAT_STATES = ["claimed", "invited", "expired", "not-invited"] as const;

export type AdminSeatState = (typeof ADMIN_SEAT_STATES)[number];

/** One seat as the registry draws it: the role, the party's own name, and what the seat is. */
export interface AdminSeat {
  readonly role: "initiator" | "counterparty";
  readonly name: string | null;
  readonly state: AdminSeatState;
}

/**
 * A seat's state, derived from the fields the relationship already carries.
 *
 * `claimed` is `counterpartyName !== null` — the one fact that separates a relationship that has
 * two people in it from one waiting for the second. With no name, the invite's own state decides
 * between `not-invited`, `expired` and `invited`; `inviteStateOf` owns the expiry rule, so the
 * console cannot disagree with the list the counterparty sees.
 */
export function adminSeatStateOf(
  rel: V1Relationship,
  role: "initiator" | "counterparty",
  now: number,
): AdminSeat {
  if (role === "initiator") {
    return { role, name: rel.initiatorName, state: "claimed" };
  }
  if (rel.counterpartyName !== null) {
    return { role, name: rel.counterpartyName, state: "claimed" };
  }
  if (rel.inviteToken === null) return { role, name: null, state: "not-invited" };
  return { role, name: null, state: inviteStateOf(rel, now) === "expired" ? "expired" : "invited" };
}

/* ------------------------------------------------------------------ *
 * The registry row
 * ------------------------------------------------------------------ */

/** A subscription's state on the row, with `none` for a relationship the shop has not sold yet. */
export type AdminSubscriptionState = SubscriptionStatus | "none";

/**
 * One relationship, as the registry renders it. Every field is a fact the row already holds or a
 * derivation of one — and no field can hold an answer (the header says why).
 */
export interface AdminRelationshipRow {
  readonly id: string;
  /** The relationship's own name when it has one, the template's title when it does not. */
  readonly name: string;
  readonly templateId: string;
  readonly templateTitle: string;
  readonly stage: RelationshipStage;
  readonly mode: AssessmentMode;
  readonly setting: AlignmentSetting;
  readonly initiator: AdminSeat;
  readonly counterparty: AdminSeat;
  readonly subscription: AdminSubscriptionState;
  readonly subscriptionPlan: SubscriptionPlan | null;
  readonly archivedAt: string | null;
  readonly archived: boolean;
  /** Both seats exist, the sheet is not fully answered, and the row is live. */
  readonly awaitingAnswers: boolean;
  /** Both answered, neither accepted — the session's closing move is outstanding. */
  readonly awaitingAcceptance: boolean;
  /**
   * Sessions the console's own list draws: completed and scored, from the store's history plus
   * the fixture timeline. Derived from the same rows `adminSessionRows()` returns, never from the
   * store's `completedSessions` counter — two numbers with one meaning is exactly the drift the
   * registry exists to avoid (the seed: `rel-sharing-unmet` has a scored session in its timeline
   * and a counter of 0, and the console prints the session it can show).
   */
  readonly sessionsScored: number;
  /** `1` when a sheet is open (answered or not), `0` when the last session is complete. */
  readonly sessionsOpen: number;
  /**
   * The Steps for Improving the Relationship the row holds (#404 §7): how many were derived at
   * completion, and how many the parties have ticked. A count, never a Step's words — the words are
   * a party's plan and the console's job is to say the plan exists.
   */
  readonly stepsRecorded: number;
  readonly stepsDone: number;
  /** ISO instants: rows cross to a client component, so no `Date` objects. */
  readonly createdAt: string;
  readonly lastActivity: string;
}

/** One relationship's row. `templateTitle` is the title of the template it was started from. */
export function adminRelationshipRow(
  rel: V1Relationship,
  templateTitle: string,
  now: number,
  archivedSessions: readonly V1Session[] = [],
): AdminRelationshipRow {
  const counterparty = adminSeatStateOf(rel, "counterparty", now);
  const submitted = bothSubmittedOf(rel);
  const accepted = bothAcceptedOf(rel);
  const live = rel.archivedAt === null;
  const sessions = adminSessionRows(rel, archivedSessions);
  const progress = stepProgressOf(rel.steps);
  return {
    id: rel.id,
    name: relationshipNameOf(rel, templateTitle),
    templateId: rel.templateId,
    templateTitle,
    stage: stageOfRelationship(rel),
    mode: rel.mode,
    setting: rel.setting,
    initiator: adminSeatStateOf(rel, "initiator", now),
    counterparty,
    subscription: rel.subscription?.status ?? "none",
    subscriptionPlan: rel.subscription?.plan ?? null,
    archivedAt: rel.archivedAt,
    archived: !live,
    // "Awaiting answers" is about a *live* session with two seats in it: an invited
    // relationship is waiting for a person, not for an answer, and an archived one is waiting
    // for nobody. The two predicates are what the overview's two cards count.
    awaitingAnswers: live && counterparty.state === "claimed" && !submitted,
    awaitingAcceptance: live && counterparty.state === "claimed" && submitted && !accepted,
    sessionsScored: sessions.filter((session) => session.scored).length,
    sessionsOpen: sessions.filter((session) => !session.scored).length,
    stepsRecorded: progress.total,
    stepsDone: progress.done,
    createdAt: rel.createdAt,
    lastActivity: rel.modifiedAt,
  };
}

/**
 * Every relationship's row, in the store's own order (the store appends, so oldest first).
 *
 * `sessions` is the whole fixture timeline; each row is handed only its own slice, so a caller
 * cannot accidentally give one relationship another one's history. Omitting it is correct for a
 * screen that prints no session count (the overview), and wrong for one that does (the registry).
 */
export function adminRelationshipRows(
  relationships: readonly V1Relationship[],
  templateTitles: ReadonlyMap<string, string>,
  now: number,
  sessions: readonly V1Session[] = [],
): readonly AdminRelationshipRow[] {
  return relationships.map((rel) =>
    adminRelationshipRow(
      rel,
      templateTitles.get(rel.templateId) ?? rel.templateId,
      now,
      sessions.filter((session) => session.relationshipId === rel.id),
    ),
  );
}

/**
 * The registry's one filter. Archive state first (a live row is the default list), then the two
 * derived counts, then the two fields the rows carry verbatim. Every branch is a predicate over
 * the row, never a second read — which is what lets the counts and the list agree.
 */
export function filterAdminRows(
  rows: readonly AdminRelationshipRow[],
  query: AdminRegistryQuery = {},
): readonly AdminRelationshipRow[] {
  return rows.filter((row) => {
    if (query.state === "archived" ? !row.archived : row.archived) return false;
    if (query.stage !== undefined && query.stage !== null && row.stage !== query.stage)
      return false;
    if (
      query.subscription !== undefined &&
      query.subscription !== null &&
      row.subscription !== query.subscription
    ) {
      return false;
    }
    if (query.filter === "awaiting-answers" && !row.awaitingAnswers) return false;
    return true;
  });
}

/* ------------------------------------------------------------------ *
 * The counts — five figures, each one a filter the cards link to
 * ------------------------------------------------------------------ */

/** The overview's figures. `templates` and `users` come from the store's own lengths. */
export interface AdminCounts {
  /** Live relationships — `rows.filter((row) => !row.archived).length`. */
  readonly relationships: number;
  /** Archived relationships — the same filter, inverted. */
  readonly archived: number;
  /** Live relationships by derived stage — the four cards under "relationships by stage". */
  readonly byStage: Readonly<Record<RelationshipStage, number>>;
  /** Live, two-seat relationships whose sheet is not fully answered. */
  readonly awaitingAnswers: number;
  /** Live relationships whose subscription reads `past_due`. */
  readonly pastDue: number;
  /** Every template in the store, disabled ones included — the list shows both. */
  readonly templates: number;
  /** The disabled ids that still name a template in the store. */
  readonly disabledTemplates: number;
  /** Every account in the store — the two seats and the members. */
  readonly users: number;
}

/**
 * The five counts. Nothing here is authored: each figure is the length of a filtered view of the
 * rows the registry renders, or the length of a collection the store already holds.
 */
export function adminCounts(
  rows: readonly AdminRelationshipRow[],
  templates: readonly Assessment[],
  accounts: readonly V1Account[],
  disabledTemplateIds: readonly string[],
): AdminCounts {
  const live = rows.filter((row) => !row.archived);
  const byStage: Record<RelationshipStage, number> = {
    invited: 0,
    connected: 0,
    sharing: 0,
    aligned: 0,
  };
  for (const row of live) byStage[row.stage] += 1;
  const knownTemplateIds = new Set(templates.map((template) => template.id));
  return {
    relationships: live.length,
    archived: rows.length - live.length,
    byStage,
    awaitingAnswers: live.filter((row) => row.awaitingAnswers).length,
    pastDue: live.filter((row) => row.subscription === "past_due").length,
    templates: templates.length,
    disabledTemplates: disabledTemplateIds.filter((id) => knownTemplateIds.has(id)).length,
    users: accounts.length,
  };
}

/* ------------------------------------------------------------------ *
 * Sessions — scored or not, and nothing a party answered
 * ------------------------------------------------------------------ */

/**
 * A session's state on the console.
 *
 *   open-answers     two seats, the sheet is not fully answered  → not scored
 *   open-acceptance  both answered, acceptance outstanding       → not scored
 *   scored           both accepted: the sheet is complete
 *
 * The open states never say *who* answered. "One of the two has answered" is a progress leak in
 * a blind relationship, so the console does not print it: it says the session is open, and
 * `scored` is the only thing about a sheet it is allowed to know.
 */
export type AdminSessionState = "open-answers" | "open-acceptance" | "scored";

/** One row of a relationship's session list — no answers, no Gaps, no report content. */
export interface AdminSessionRow {
  readonly id: string;
  readonly state: AdminSessionState;
  readonly scored: boolean;
  /** The completion instant, or `null` for the open sheet. */
  readonly completedAt: string | null;
  /** How many Aspects the sheet asks — the blueprint's size, never an answered count. */
  readonly aspectCount: number;
}

/**
 * A relationship's sessions, newest first: the open sheet when there is one, then every archived
 * session the store and the seed fixture hold.
 *
 * `archivedSessions` is the fixture timeline (`data/v1/fixtures.ts::seedSessions`) filtered to
 * this relationship — passed in rather than imported so this module holds no fixture of its own
 * and a test can drive it with two invented rows.
 */
export function adminSessionRows(
  rel: V1Relationship,
  archivedSessions: readonly V1Session[],
): readonly AdminSessionRow[] {
  const rows: AdminSessionRow[] = [];
  if (!sessionCompleteOf(rel)) {
    rows.push({
      id: `${rel.id}-open`,
      state: bothSubmittedOf(rel) ? "open-acceptance" : "open-answers",
      scored: false,
      completedAt: null,
      aspectCount: rel.items.length,
    });
  }
  const archived: AdminSessionRow[] = [
    ...rel.history.map(
      (session: V1Relationship["history"][number]): AdminSessionRow => ({
        id: session.id,
        state: "scored",
        scored: true,
        completedAt: session.completedAt,
        aspectCount: rel.items.length,
      }),
    ),
    ...archivedSessions.map(
      (session: V1Session): AdminSessionRow => ({
        id: session.id,
        state: "scored",
        scored: true,
        completedAt: session.completedAt,
        aspectCount: Object.keys(session.initiatorAnswers).length,
      }),
    ),
  ].sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  return [...rows, ...archived];
}

/* ------------------------------------------------------------------ *
 * Templates
 * ------------------------------------------------------------------ */

/** One template as the console lists it: its size, its operator state, and who started from it. */
export interface AdminTemplateRow {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly aspectCount: number;
  readonly disabled: boolean;
  /** Live relationships started from this template. */
  readonly startedCount: number;
  /** Archived relationships started from this template — the second half of the usage figure. */
  readonly archivedCount: number;
  /** The live relationships' ids, in store order, for the detail page's list. */
  readonly relationshipIds: readonly string[];
  readonly archivedRelationshipIds: readonly string[];
}

/** Every template with its usage. Usage is derived from the relationship rows, never stored. */
export function adminTemplateRows(
  templates: readonly Assessment[],
  rows: readonly AdminRelationshipRow[],
  disabledTemplateIds: readonly string[],
): readonly AdminTemplateRow[] {
  const disabled = new Set(disabledTemplateIds);
  return templates.map((template) => {
    const started = rows.filter((row) => row.templateId === template.id && !row.archived);
    const archived = rows.filter((row) => row.templateId === template.id && row.archived);
    return {
      id: template.id,
      slug: template.slug,
      title: template.title,
      aspectCount: template.items.length,
      disabled: disabled.has(template.id),
      startedCount: started.length,
      archivedCount: archived.length,
      relationshipIds: started.map((row) => row.id),
      archivedRelationshipIds: archived.map((row) => row.id),
    };
  });
}

/* ------------------------------------------------------------------ *
 * Users — the two seats and the members
 * ------------------------------------------------------------------ */

/**
 * Which accounts are *seats* and which are *members*.
 *
 * A seat is one of the two roles every relationship is built from — the initiator and the
 * counterparty — and an account in one of those roles is what a relationship refers to as a
 * party. A member is everyone else the store knows about: the coach, the admin and the service
 * account. The split is the console's own vocabulary (`docs/ui-registry.md`: "records,
 * relationships, templates and the two seats"), not a permission model.
 */
export const ADMIN_SEAT_PERSONAS: readonly Persona[] = ["initiator", "counterparty"];

/** One account as the users list draws it. `email` is deliberately absent — see the module note. */
export interface AdminUserRow {
  readonly id: string;
  readonly name: string;
  readonly persona: Persona;
  readonly state: V1Account["state"];
  /** `seat` or `member`, the two groups the page renders. */
  readonly group: "seat" | "member";
  readonly lastSignInAt: string;
}

/**
 * The users list, grouped. The **email is not carried**: an operator reads a seat's role and
 * when it last signed in, and this prototype's accounts are demo identities (`@example.com`)
 * that no screen should imply are customers. A row that needed an address would have to argue
 * for it here first.
 */
export function adminUserGroups(accounts: readonly V1Account[]): {
  readonly seats: readonly AdminUserRow[];
  readonly members: readonly AdminUserRow[];
} {
  const rows: AdminUserRow[] = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    persona: account.persona,
    state: account.state,
    group: ADMIN_SEAT_PERSONAS.includes(account.persona) ? "seat" : "member",
    lastSignInAt: account.lastSignInAt,
  }));
  return {
    seats: rows.filter((row) => row.group === "seat"),
    members: rows.filter((row) => row.group === "member"),
  };
}

/* ------------------------------------------------------------------ *
 * The panel that states the limit
 * ------------------------------------------------------------------ */

/**
 * What the console cannot do, authored once and rendered on every console page. Each entry is a
 * limit the reader would otherwise have to infer from an absence, and each names what happens
 * instead — a panel that only listed prohibitions would read as a bug report.
 */
export const ADMIN_LIMITS = [
  {
    id: "answers",
    title: "No answer values",
    body: "An operator sees that a session is scored, and the stage the sheet reached — never a party's answers, a Gap or a report line. The blind rule holds for an admin exactly as it holds for the parties.",
  },
  {
    id: "impersonation",
    title: "No impersonation",
    body: "There is no \"view as\" and no way to answer, accept or comment on either party's behalf. The console reads; the parties' own screens are the only writers of an answer.",
  },
  {
    id: "delete",
    title: "No destructive delete without confirmation",
    body: "Archive a relationship or disable a template only through a confirmation, and both are reversible in the store: archiving stamps one field, disabling is a set of template ids, and neither removes a row, an Aspect or a session.",
  },
] as const;

/** The one sentence every registry screen prints above its rows. */
export const ADMIN_ANSWER_LIMIT_SENTENCE =
  "Read-only for answers: you can see that a session is scored, never a party's answer values.";
