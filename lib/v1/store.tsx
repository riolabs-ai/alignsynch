"use client";

/**
 * The v1 prototype's in-browser store — the thing that makes `/v1/**` behave like a
 * shipped app instead of a gallery of screens.
 *
 * A React context over `localStorage`, seeded from `data/v1/fixtures.ts` (typed with the
 * real model, so shapes survive wiring). Mutations are local and instant: a template the
 * editor saves is a template the library reads, a relationship the initiator creates is the
 * one the counterparty claims, with no server action and no `lib/db/**` anywhere in this
 * graph — which is also the guarantee E34 (the client→server walk) keeps honest: importing
 * `pg` here would fail the build the moment it was typed.
 *
 * Three slices, three keys:
 *
 *   - **templates** (`alignsynch.v1.templates.v1`) — the editor's surface, unchanged from the
 *     card that added it (#343): `saveTemplate` / `deleteTemplate` / `resetTemplates`.
 *   - **relationships** (`alignsynch.v1.relationships.v1`) — the flow the `/v1/**` card adds:
 *     relationships, accounts, tickets. A relationship copies a template's Aspects and holds
 *     each party's answers as a map keyed by Aspect id, so an invitation can sit unclaimed
 *     without violating the real instance schema.
 *   - **persona** (`v1_persona`) — who the browser is pretending to be, mirrored to a cookie
 *     so the persona survives a reload and is visible to the server if it ever needs it.
 *
 * `localStorage` is read only after hydration: the first render seeds from the fixtures,
 * then the persisted copy replaces it, so the server and the client never disagree about
 * the first paint (React hydration rule #418).
 */
import {
  zAssessment,
  zInstanceName,
  INSTANCE_NAME_MAX,
  type AlignmentSetting,
  type Aspect,
  type Assessment,
  type AssessmentMode,
  type Opinions,
} from "@/content/assessment";
import {
  PERSONA_META,
  SEED_VERSION,
  zPersona,
  v1Templates,
  seedAccounts,
  seedRelationships,
  seedThreadReadAt,
  seedTickets,
  type Persona,
  type SubscriptionPlan,
  type V1Account,
  type V1Payment,
  type V1Relationship,
  type V1SessionRecord,
  type V1ThreadReadAt,
  type V1Ticket,
} from "@/data/v1/fixtures";
import { seedNotifications, type V1Notification } from "@/data/v1/notifications";
import { subscriptionPlan } from "@/data/v1/plans";
import type { RelationshipType } from "@/data/v1/relationship-types";
import {
  authoredStepOf,
  closeSteps,
  deriveSteps,
  stepsToAdd,
  withStepStatus,
  withStepText,
  type StepStatus,
} from "@/content/steps";
import type { ReviewStatus } from "@/lib/v1/review";
import { unlockedAtOf } from "@/lib/v1/derive";
import { resolveThreadId, authorRoleOf } from "@/lib/v1/chat";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/** The key this prototype writes its templates under; versioned so a shape change re-seeds. */
const STORAGE_KEY = "alignsynch.v1.templates.v1";

/** The key the flow slice (relationships, accounts, tickets) persists under. */
const FLOW_STORAGE_KEY = "alignsynch.v1.relationships.v1";

/** The persona's own key — `v1_persona` in localStorage and mirrored to a cookie of that name. */
const PERSONA_KEY = "v1_persona";

/** The key the review checklist persists under. */
const REVIEW_STORAGE_KEY = "alignsynch.v1.review.v1";

/** The key the social slice (notifications + chat read watermarks) persists under. */
const SOCIAL_STORAGE_KEY = "alignsynch.v1.social.v1";

/**
 * The key the admin console's slice persists under — the templates an operator has **disabled**.
 *
 * It is its own key rather than a field on the template record for a structural reason: a
 * template in this store is an `Assessment` from `content/assessment.ts`, the *content* model,
 * and `.strict()` means a console-only field added to it would be a schema change to the thing
 * the gate validates. Disablement is an operator decision about a record, not a property of the
 * record — the same split `lib/admin/instance-registry.ts` keeps between a stage (derived) and
 * an account a seat may or may not hold.
 */
const ADMIN_STORAGE_KEY = "alignsynch.v1.admin.v1";

/** One row's mutable state: its approval status and the reviewer's note. */
export interface ReviewEntry {
  readonly status: ReviewStatus;
  readonly note: string;
}

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

let idCounter = 0;

/** A kebab-case id unique within the session: `rel-m<ts36>-1`, `inv-…`, `cmt-…`. */
function uid(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

/** A kebab-case slug from a title, the same fold the template editor uses for a saved set. */
function slugFor(title: string): string {
  const folded = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return folded === "" ? "saved-set" : folded;
}

/* ------------------------------------------------------------------ *
 * Persistence
 * ------------------------------------------------------------------ */

/** The flow slice, persisted under `FLOW_STORAGE_KEY`. */
interface PersistedFlow {
  readonly version: number;
  readonly relationships: readonly V1Relationship[];
  readonly accounts: readonly V1Account[];
  readonly tickets: readonly V1Ticket[];
}

const toPersistedFlow = (
  relationships: readonly V1Relationship[],
  accounts: readonly V1Account[],
  tickets: readonly V1Ticket[],
): PersistedFlow => ({ version: SEED_VERSION, relationships, accounts, tickets });

/** The persisted templates, or the fixtures when nothing has been saved yet. */
function loadTemplates(): readonly Assessment[] {
  if (typeof window === "undefined") return v1Templates;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return v1Templates;
    const parsed = zAssessment.array().safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : v1Templates;
  } catch (error) {
    console.warn("v1 store: could not read persisted templates, re-seeding", error);
    return v1Templates;
  }
}

/** The persisted flow, or the seeds when nothing has been written yet. */
function loadFlow(): {
  relationships: readonly V1Relationship[];
  accounts: readonly V1Account[];
  tickets: readonly V1Ticket[];
} {
  if (typeof window === "undefined") {
    return { relationships: seedRelationships, accounts: seedAccounts, tickets: seedTickets };
  }
  try {
    const raw = window.localStorage.getItem(FLOW_STORAGE_KEY);
    if (raw === null) {
      return { relationships: seedRelationships, accounts: seedAccounts, tickets: seedTickets };
    }
    const parsed = JSON.parse(raw) as PersistedFlow;
    if (parsed.version !== SEED_VERSION) {
      return { relationships: seedRelationships, accounts: seedAccounts, tickets: seedTickets };
    }
    return {
      relationships: parsed.relationships,
      accounts: parsed.accounts,
      tickets: parsed.tickets,
    };
  } catch (error) {
    console.warn("v1 store: could not read persisted flow, re-seeding", error);
    return { relationships: seedRelationships, accounts: seedAccounts, tickets: seedTickets };
  }
}

/** The persisted review checklist, or an empty record when nothing has been decided yet. */
function loadReviews(): Readonly<Record<string, ReviewEntry>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(REVIEW_STORAGE_KEY);
    if (raw === null) return {};
    const parsed = JSON.parse(raw) as Record<string, ReviewEntry>;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const next: Record<string, ReviewEntry> = {};
    for (const [route, entry] of Object.entries(parsed)) {
      if (
        entry !== null &&
        typeof entry === "object" &&
        (entry.status === "unreviewed" ||
          entry.status === "changes requested" ||
          entry.status === "approved") &&
        typeof entry.note === "string"
      ) {
        next[route] = { status: entry.status, note: entry.note };
      }
    }
    return next;
  } catch (error) {
    console.warn("v1 store: could not read persisted reviews, re-seeding", error);
    return {};
  }
}

function parsePersona(raw: string | null | undefined): Persona | null {
  if (raw === null || raw === undefined) return null;
  const result = zPersona.safeParse(raw);
  return result.success ? result.data : null;
}

/** The admin slice, persisted: the template ids an operator has disabled. */
interface PersistedAdmin {
  readonly version: number;
  readonly disabledTemplateIds: readonly string[];
}

/**
 * The persisted admin slice, or an empty set when nothing has been disabled yet. A store written
 * before this slice existed (or at an older `SEED_VERSION`) reads as "nothing disabled", which is
 * the seed state — an operator decision is never invented from a missing key.
 */
function loadAdmin(): { disabledTemplateIds: readonly string[] } {
  if (typeof window === "undefined") return { disabledTemplateIds: [] };
  try {
    const raw = window.localStorage.getItem(ADMIN_STORAGE_KEY);
    if (raw === null) return { disabledTemplateIds: [] };
    const parsed = JSON.parse(raw) as PersistedAdmin;
    if (parsed.version !== SEED_VERSION || !Array.isArray(parsed.disabledTemplateIds)) {
      return { disabledTemplateIds: [] };
    }
    return {
      disabledTemplateIds: parsed.disabledTemplateIds.filter(
        (entry): entry is string => typeof entry === "string" && entry.length > 0,
      ),
    };
  } catch (error) {
    console.warn("v1 store: could not read persisted admin slice, re-seeding", error);
    return { disabledTemplateIds: [] };
  }
}

/** The social slice, persisted — notifications (with their read flags) and chat read watermarks. */
interface PersistedSocial {
  readonly version: number;
  readonly notifications: readonly V1Notification[];
  readonly threadReadAt: V1ThreadReadAt;
}

/** The persisted social slice, or the seeds when nothing has been written yet. */
function loadSocial(): {
  notifications: readonly V1Notification[];
  threadReadAt: V1ThreadReadAt;
} {
  if (typeof window === "undefined") {
    return { notifications: seedNotifications, threadReadAt: seedThreadReadAt };
  }
  try {
    const raw = window.localStorage.getItem(SOCIAL_STORAGE_KEY);
    if (raw === null) {
      return { notifications: seedNotifications, threadReadAt: seedThreadReadAt };
    }
    const parsed = JSON.parse(raw) as PersistedSocial;
    if (parsed.version !== SEED_VERSION) {
      return { notifications: seedNotifications, threadReadAt: seedThreadReadAt };
    }
    return { notifications: parsed.notifications, threadReadAt: parsed.threadReadAt };
  } catch (error) {
    console.warn("v1 store: could not read persisted social slice, re-seeding", error);
    return { notifications: seedNotifications, threadReadAt: seedThreadReadAt };
  }
}

/* ------------------------------------------------------------------ *
 * Context
 * ------------------------------------------------------------------ */

/** The inputs the relationship form collects (#404 §6). */
export interface RelationshipInput {
  readonly templateId: string;
  /** The relationship's own name — optional, ≤ `INSTANCE_NAME_MAX`; absent means the template's. */
  readonly name?: string;
  readonly initiatorName: string;
  /**
   * The name the initiator typed for the counterparty's seat. It is **display-only**: the
   * counterparty is `invited` until they claim the link (`claimInvite`), because the blind rule
   * waits for their own submission and a name typed by someone else is not a party.
   */
  readonly inviteeName?: string;
  /** Fixed for the relationship's life — a post-hoc change would invalidate the answer shape. */
  readonly mode: AssessmentMode;
  /** The tolerance the report's verdict is judged against; the Initiator or an admin may move it. */
  readonly setting: AlignmentSetting;
}

/** Everything a new relationship row carries, from whichever entry created it. */
interface RelationshipDraft {
  readonly templateId: string;
  readonly name?: string;
  readonly items: readonly Aspect[];
  readonly mode: AssessmentMode;
  readonly setting: AlignmentSetting;
  readonly initiatorName: string;
  readonly inviteeName: string | null;
  readonly now: string;
}

/**
 * A catalogue type, folded into a library template — a clone the editor can open and a
 * relationship can copy from. The id is deterministic per type, so starting or cloning the same
 * type twice reuses one template rather than stacking copies. The summary names only the type's
 * `name`, which every type shape carries, so a clone keeps its own identity in the editor.
 */
function templateFromType(type: RelationshipType): Assessment {
  return {
    id: `assessment-${type.id}`,
    slug: type.id,
    type: "assessment",
    status: "published",
    date: new Date().toISOString(),
    title: type.name,
    summary: `Relationship Type: ${type.name} — cloned from the relationship catalogue.`,
    items: type.aspects.map((item) => ({ ...item, scale: { ...item.scale } })),
  };
}

/**
 * A new relationship's row, from one draft — the single statement of what a relationship looks
 * like when it is created.
 *
 * Four entry points create one (the catalogue's `startFromType`, the store's `createRelationship`,
 * the create entry's `createRelationshipFromType`, and `cloneRelationship`, which starts from
 * another row instead), and every one of them has to agree about the sixteen fields that describe
 * "nothing has happened yet": no claims, no answers, no invite, no subscription, no sessions and no
 * Steps. Written once so a field added to the model cannot be forgotten by three of the four.
 */
function newRelationship(draft: RelationshipDraft): V1Relationship {
  return {
    id: uid("rel"),
    templateId: draft.templateId,
    name: draft.name?.trim() || undefined,
    items: draft.items.map((item) => ({ ...item, scale: { ...item.scale } })),
    deletedAspects: [],
    mode: draft.mode,
    setting: draft.setting,
    initiatorName: draft.initiatorName.trim() || PERSONA_META.initiator.name,
    // The seat is named, not claimed: `counterpartyName` stays null until the invite is claimed.
    counterpartyName: null,
    inviteeName: draft.inviteeName,
    initiatorAnswers: {},
    counterpartyAnswers: {},
    initiatorSubmitted: false,
    counterpartySubmitted: false,
    initiatorAccepted: false,
    counterpartyAccepted: false,
    initiatorAcceptedAt: null,
    counterpartyAcceptedAt: null,
    inviteToken: null,
    inviteExpiresAt: null,
    // A new relationship is live: only the admin console's archive writes this field.
    archivedAt: null,
    sharedWithCoach: false,
    coachComments: [],
    comments: [],
    aspectComments: {},
    // Nothing has been measured yet, so there is nothing to agree on: Steps are derived from the
    // Gaps at completion (`content/steps.ts`), never guessed at creation.
    steps: [],
    openedSessions: 0,
    completedSessions: 0,
    // A new relationship starts unsubscribed — the shop's checkout (subscribe) is the path
    // that gives it a plan. The counterparty pays nothing, ever.
    subscription: null,
    history: [],
    lastSessionAt: null,
    createdAt: draft.now,
    modifiedAt: draft.now,
  };
}

/** A store a surface may read from, and write every slice through. */
export interface V1Store {
  readonly templates: readonly Assessment[];
  readonly saveTemplate: (template: Assessment) => void;
  readonly deleteTemplate: (id: string) => void;
  readonly resetTemplates: () => void;

  readonly persona: Persona;
  readonly hydrated: boolean;
  readonly relationships: readonly V1Relationship[];
  readonly accounts: readonly V1Account[];
  readonly tickets: readonly V1Ticket[];
  readonly notifications: readonly V1Notification[];
  /** `threadId -> lastReadAt` per persona — the chat's read watermarks, persisted. */
  readonly threadReadAt: V1ThreadReadAt;

  readonly setPersona: (persona: Persona) => void;
  readonly createRelationship: (input: RelationshipInput) => V1Relationship;
  /**
   * The create entry's one action (#404 §6): fold a catalogue type into the library template the
   * editor can open (`assessment-<typeId>`, deterministic) and create the relationship from it in
   * the same write, with the Mode and Setting the initiator chose.
   *
   * The two steps are one call on purpose: `createRelationship` reads the library from the render it
   * was created in, so cloning and creating in two calls within one event would look for a template
   * that state had not published yet.
   *
   * **The Initiator is the persona, and no argument can say otherwise.** Every `/v1/<persona>` page
   * is gated by `relationshipsVisibleTo()` on the persona's own name, so a row created under another
   * name would exist in the store with no page its creator could open. The name is therefore not an
   * input here: this entry point *is* "I am the Initiator", and it writes the persona's name.
   */
  readonly createRelationshipFromType: (
    type: RelationshipType,
    input: {
      readonly name?: string;
      readonly inviteeName?: string;
      readonly mode: AssessmentMode;
      readonly setting: AlignmentSetting;
    },
  ) => V1Relationship;
  /**
   * Rename a relationship (#404 §7). The Initiator and an admin may; the Counterparty and the
   * Coach may not, and no surface offers it to them. Returns a refusal sentence, or null on success.
   * An empty name clears it, so the template's title is the display name again.
   */
  readonly renameRelationship: (relationshipId: string, name: string) => string | null;
  /**
   * Move a relationship's Setting (#404 §7: "change in maintenance"). The Initiator and an admin
   * may; it re-derives the stage and the verdict on read and changes no answer, no Aspect and no
   * question. Refused while a session is open — the bar a party is being measured against may not
   * move underneath them. Returns a refusal sentence, or null on success.
   */
  readonly setRelationshipSetting: (
    relationshipId: string,
    setting: AlignmentSetting,
  ) => string | null;
  /**
   * Tick a Step off, or put it back (#404 §7, Decision 3). A party does this for their own
   * relationship; the coach reads. The row it writes is the one the completion derived.
   */
  readonly markStepDone: (relationshipId: string, stepId: string, status: StepStatus) => void;
  /**
   * Reword a Step — a party's own words in `text`, with the sentence the product proposed kept in
   * `suggestedText` (#404, decision 2 on PR #406). Empty text is refused: a Step with no words is
   * not a Step. Returns a refusal sentence, or null on success.
   */
  readonly setStepText: (relationshipId: string, stepId: string, text: string) => string | null;
  /**
   * Add a Step a party wrote from nothing, on one Aspect. It came from no Gap, so it names no kind
   * and carries no suggestion; it is `open`. Returns a refusal sentence, or null on success.
   */
  readonly addStep: (relationshipId: string, aspectId: string, text: string) => string | null;
  /** Start a relationship from a catalogue type — clone its Aspects into the library and create
   * the relationship unsubscribed (the shop's checkout is the subscribe path). */
  readonly startFromType: (type: RelationshipType) => V1Relationship;
  /** Clone a catalogue type into the initiator's own template library (idempotent per type). */
  readonly cloneType: (type: RelationshipType) => Assessment;
  readonly sendInvite: (relationshipId: string) => void;
  readonly claimInvite: (relationshipId: string) => void;
  readonly submitAnswers: (
    relationshipId: string,
    role: "initiator" | "counterparty",
    answers: Readonly<Record<string, Opinions>>,
  ) => void;
  readonly acceptSession: (relationshipId: string, role: "initiator" | "counterparty") => void;
  /** Archive the complete session and reset the sheet; returns a refusal sentence, or null. */
  readonly requestNewSession: (relationshipId: string) => string | null;
  readonly addComment: (
    relationshipId: string,
    author: "initiator" | "counterparty",
    body: string,
  ) => void;
  readonly addAspectComment: (
    relationshipId: string,
    itemId: string,
    author: "initiator" | "counterparty",
    body: string,
  ) => void;
  readonly addAspect: (
    relationshipId: string,
    input: { readonly prompt: string; readonly leftValue: string; readonly rightValue: string },
  ) => void;
  readonly renameAspect: (
    relationshipId: string,
    itemId: string,
    patch: { readonly prompt?: string; readonly leftValue?: string; readonly rightValue?: string },
  ) => void;
  readonly moveAspect: (relationshipId: string, itemId: string, direction: "up" | "down") => void;
  /** Soft-delete: the Aspect leaves `items` but stays restorable from `deletedAspects`. */
  readonly deleteAspect: (relationshipId: string, itemId: string) => void;
  readonly restoreAspect: (relationshipId: string, itemId: string) => void;
  /** Copy the relationship into a fresh, unclaimed one with the same Aspects. */
  readonly cloneRelationship: (relationshipId: string) => V1Relationship;
  /**
   * The admin console's reversible archive. `archiveRelationship` stamps `archivedAt`, and
   * `restoreRelationship` clears it; neither touches a party, an Aspect, an answer or a session.
   * On an already-archived row both are no-ops, so a double click cannot re-stamp the instant.
   */
  readonly archiveRelationship: (relationshipId: string) => void;
  readonly restoreRelationship: (relationshipId: string) => void;
  /** The template ids an operator has disabled — the admin console's second reversible state. */
  readonly disabledTemplateIds: readonly string[];
  readonly disableTemplate: (templateId: string) => void;
  readonly enableTemplate: (templateId: string) => void;
  /** Turn the relationship's Aspects into a reusable library entry (a "my saved set"). */
  readonly saveAspectSetToLibrary: (relationshipId: string) => Assessment;
  readonly restoreSubscription: (relationshipId: string) => void;
  /** The shop's checkout: subscribe (or re-subscribe) one relationship to a plan — a mock, no
   * charge — and record the purchase in that relationship's payment history. */
  readonly subscribe: (relationshipId: string, plan: SubscriptionPlan) => void;
  readonly addCoachComment: (relationshipId: string, body: string) => void;
  readonly toggleShareWithCoach: (relationshipId: string) => void;
  readonly resolveTicket: (ticketId: string) => void;
  readonly markThreadRead: (threadId: string, persona: Persona) => void;
  readonly markNotificationRead: (notificationId: string) => void;
  readonly markAllNotificationsRead: (persona: Persona) => void;
  /** Send a chat message as `persona`; returns a refusal sentence, or null on success. */
  readonly sendChatMessage: (
    relationshipId: string,
    threadId: string,
    body: string,
    persona: Persona,
  ) => string | null;
  readonly reviews: Readonly<Record<string, ReviewEntry>>;
  readonly setReview: (route: string, patch: Partial<ReviewEntry>) => void;
  readonly resetStore: () => void;
}

const V1StoreContext = createContext<V1Store | null>(null);

export function V1StoreProvider({ children }: { children: ReactNode }) {
  const [templates, setTemplates] = useState<readonly Assessment[]>(v1Templates);
  const [relationships, setRelationships] = useState<readonly V1Relationship[]>(seedRelationships);
  const [accounts, setAccounts] = useState<readonly V1Account[]>(seedAccounts);
  const [tickets, setTickets] = useState<readonly V1Ticket[]>(seedTickets);
  const [notifications, setNotifications] = useState<readonly V1Notification[]>(seedNotifications);
  const [threadReadAt, setThreadReadAt] = useState<V1ThreadReadAt>(seedThreadReadAt);
  const [disabledTemplateIds, setDisabledTemplateIds] = useState<readonly string[]>([]);
  const [reviews, setReviews] = useState<Readonly<Record<string, ReviewEntry>>>({});
  const [persona, setPersonaState] = useState<Persona>("visitor");
  const [hydrated, setHydrated] = useState(false);
  const hydratedRef = useRef(false);

  // One mount: adopt the persisted copies once, for every slice, then mark hydrated.
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const nextPersona = parsePersona(window.localStorage.getItem(PERSONA_KEY)) ?? "visitor";
    const flow = loadFlow();
    const social = loadSocial();
    const admin = loadAdmin();
    setTemplates(loadTemplates());
    setRelationships(flow.relationships);
    setAccounts(flow.accounts);
    setTickets(flow.tickets);
    setNotifications(social.notifications);
    setThreadReadAt(social.threadReadAt);
    setDisabledTemplateIds(admin.disabledTemplateIds);
    setReviews(loadReviews());
    setPersonaState(nextPersona);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    } catch (error) {
      console.warn("v1 store: could not persist templates (private mode?)", error);
    }
  }, [templates, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        FLOW_STORAGE_KEY,
        JSON.stringify(toPersistedFlow(relationships, accounts, tickets)),
      );
    } catch (error) {
      console.warn("v1 store: could not persist flow (private mode?)", error);
    }
  }, [relationships, accounts, tickets, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(reviews));
    } catch (error) {
      console.warn("v1 store: could not persist reviews (private mode?)", error);
    }
  }, [reviews, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        SOCIAL_STORAGE_KEY,
        JSON.stringify({ version: SEED_VERSION, notifications, threadReadAt }),
      );
    } catch (error) {
      console.warn("v1 store: could not persist social slice (private mode?)", error);
    }
  }, [notifications, threadReadAt, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(
        ADMIN_STORAGE_KEY,
        JSON.stringify({ version: SEED_VERSION, disabledTemplateIds }),
      );
    } catch (error) {
      console.warn("v1 store: could not persist admin slice (private mode?)", error);
    }
  }, [disabledTemplateIds, hydrated]);

  const saveTemplate = useCallback((template: Assessment) => {
    setTemplates((previous) => {
      const at = previous.findIndex((entry) => entry.id === template.id);
      if (at === -1) return [...previous, template];
      const next = [...previous];
      next[at] = template;
      return next;
    });
  }, []);

  const deleteTemplate = useCallback((id: string) => {
    setTemplates((previous) => previous.filter((entry) => entry.id !== id));
  }, []);

  const resetTemplates = useCallback(() => {
    setTemplates(v1Templates);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn("v1 store: could not clear persisted templates", error);
    }
  }, []);

  const setPersona = useCallback((next: Persona) => {
    setPersonaState(next);
    try {
      window.localStorage.setItem(PERSONA_KEY, next);
      document.cookie = `v1_persona=${next}; path=/; max-age=31536000; SameSite=Lax`;
    } catch (error) {
      console.warn("v1 store: could not persist persona (private mode?)", error);
    }
  }, []);

  const patchRelationship = useCallback(
    (relationshipId: string, patch: (rel: V1Relationship) => V1Relationship) => {
      setRelationships((previous) =>
        previous.map((rel) => {
          if (rel.id !== relationshipId) return rel;
          const next = patch(rel);
          // A mutation that changed nothing is not a write: the no-op branches return the row
          // itself, and bumping "Last modified" would date an edit that never happened.
          if (next === rel) return rel;
          // Every mutation is a write: "Last modified" is honest without a per-call setter.
          return next.modifiedAt === rel.modifiedAt
            ? { ...next, modifiedAt: new Date().toISOString() }
            : next;
        }),
      );
    },
    [],
  );

  const createRelationship = useCallback(
    (input: RelationshipInput): V1Relationship => {
      const template = templates.find((candidate) => candidate.id === input.templateId);
      if (template === undefined) {
        throw new Error(`no template "${input.templateId}" in the library`);
      }
      const relationship = newRelationship({
        templateId: input.templateId,
        name: input.name,
        items: template.items,
        mode: input.mode,
        setting: input.setting,
        initiatorName: input.initiatorName,
        inviteeName: input.inviteeName?.trim() || null,
        now: new Date().toISOString(),
      });
      setRelationships((previous) => [...previous, relationship]);
      return relationship;
    },
    [templates],
  );

  /**
   * The create entry (#404 §6). The type is folded into the library template the editor opens and
   * the relationship is copied from it **in one write**, so a caller cannot half-create: either the
   * template and the relationship both exist afterwards, or neither does.
   *
   * The initiator is the persona, never an argument — see the interface note. A created row that the
   * Initiator's own dashboard could not resolve would be a card the form hands back as a 404.
   */
  const createRelationshipFromType = useCallback(
    (
      type: RelationshipType,
      input: {
        readonly name?: string;
        readonly inviteeName?: string;
        readonly mode: AssessmentMode;
        readonly setting: AlignmentSetting;
      },
    ): V1Relationship => {
      const template = templateFromType(type);
      setTemplates((previous) => {
        const at = previous.findIndex((entry) => entry.id === template.id);
        if (at === -1) return [...previous, template];
        const next = [...previous];
        next[at] = template;
        return next;
      });
      const relationship = newRelationship({
        templateId: template.id,
        name: input.name,
        items: template.items,
        mode: input.mode,
        setting: input.setting,
        initiatorName: PERSONA_META.initiator.name,
        inviteeName: input.inviteeName?.trim() || null,
        now: new Date().toISOString(),
      });
      setRelationships((previous) => [...previous, relationship]);
      return relationship;
    },
    [],
  );

  const startFromType = useCallback((type: RelationshipType): V1Relationship => {
    const template = templateFromType(type);
    setTemplates((previous) => {
      const at = previous.findIndex((entry) => entry.id === template.id);
      if (at === -1) return [...previous, template];
      const next = [...previous];
      next[at] = template;
      return next;
    });
    const relationship = newRelationship({
      templateId: template.id,
      items: template.items,
      mode: "basic",
      setting: "soft",
      initiatorName: PERSONA_META.initiator.name,
      inviteeName: null,
      now: new Date().toISOString(),
    });
    setRelationships((previous) => [...previous, relationship]);
    return relationship;
  }, []);

  const cloneType = useCallback((type: RelationshipType): Assessment => {
    const template = templateFromType(type);
    setTemplates((previous) => {
      const at = previous.findIndex((entry) => entry.id === template.id);
      if (at === -1) return [...previous, template];
      const next = [...previous];
      next[at] = template;
      return next;
    });
    return template;
  }, []);

  const sendInvite = useCallback(
    (relationshipId: string) => {
      patchRelationship(relationshipId, (rel) => ({
        ...rel,
        inviteToken: uid("inv"),
        inviteExpiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      }));
    },
    [patchRelationship],
  );

  const claimInvite = useCallback(
    (relationshipId: string) => {
      patchRelationship(relationshipId, (rel) => ({
        ...rel,
        counterpartyName: PERSONA_META.counterparty.name,
      }));
    },
    [patchRelationship],
  );

  /**
   * Rename a relationship (#404 §7). One of the two metadata writes the matrix grants the Initiator
   * and an admin, and the only one with a length rule: `INSTANCE_NAME_MAX` characters, the same
   * limit `content/assessment.ts::zInstanceName` puts on the model's own instance name. An empty
   * name is a clear, not an error — the template's title becomes the display name again.
   */
  const renameRelationship = useCallback(
    (relationshipId: string, name: string): string | null => {
      const rel = relationships.find((candidate) => candidate.id === relationshipId);
      if (rel === undefined) return "This relationship does not exist.";
      const trimmed = name.trim();
      if (trimmed === "") {
        if (rel.name === undefined) return null;
        patchRelationship(relationshipId, (current) => ({ ...current, name: undefined }));
        return null;
      }
      const parsed = zInstanceName.safeParse(trimmed);
      if (!parsed.success) {
        return `A relationship's name is at most ${INSTANCE_NAME_MAX} characters.`;
      }
      if (rel.name === parsed.data) return null;
      patchRelationship(relationshipId, (current) => ({ ...current, name: parsed.data }));
      return null;
    },
    [relationships, patchRelationship],
  );

  /**
   * Move a relationship's Setting (#404 §7, the matrix's strictest cell that still moves).
   *
   * The Setting is a tolerance over the Gaps, so this **changes no number and no question**: the
   * sheet still asks exactly what the Mode asks, and every Opinion is untouched. What moves is the
   * verdict the report prints, because the bar it is judged against moved. It is therefore allowed
   * between sessions and refused while one is open — a bar that moves under a party who has already
   * answered would re-judge a submission they were not shown the terms of.
   */
  const setRelationshipSetting = useCallback(
    (relationshipId: string, setting: AlignmentSetting): string | null => {
      const rel = relationships.find((candidate) => candidate.id === relationshipId);
      if (rel === undefined) return "This relationship does not exist.";
      if (rel.setting === setting) return null;
      const sessionComplete = rel.initiatorAccepted && rel.counterpartyAccepted;
      const openSession = (rel.initiatorSubmitted || rel.counterpartySubmitted) && !sessionComplete;
      if (openSession) {
        return "A session is open. The Setting can move between sessions, not while one is being answered or accepted.";
      }
      patchRelationship(relationshipId, (current) => ({ ...current, setting }));
      return null;
    },
    [relationships, patchRelationship],
  );

  /** Tick a Step off, or put it back — the one write a party makes on the Steps panel. */
  const markStepDone = useCallback(
    (relationshipId: string, stepId: string, status: StepStatus) => {
      patchRelationship(relationshipId, (rel) => {
        const steps = withStepStatus(rel.steps, stepId, status);
        // No such Step, it is already in that state, or it has closed: not a write, so "Last
        // modified" stays put. A closed Step is history and no tick reopens it.
        if (steps === rel.steps) return rel;
        return { ...rel, steps: [...steps] };
      });
    },
    [patchRelationship],
  );

  /**
   * Reword a Step — the party's own words beside the suggestion that explains it.
   *
   * `suggestedText` is never touched: what the product proposed is part of the Step's history, so an
   * edit changes `text` and leaves the suggestion readable. An empty value is refused here rather
   * than silently ignored, because the panel has a Save button a party can press and the honest
   * answer is a sentence, not a no-op.
   */
  const setStepText = useCallback(
    (relationshipId: string, stepId: string, text: string): string | null => {
      const rel = relationships.find((candidate) => candidate.id === relationshipId);
      if (rel === undefined) return "This relationship does not exist.";
      const step = rel.steps.find((candidate) => candidate.id === stepId);
      if (step === undefined) return "That Step is not on this relationship.";
      if (step.status === "closed") return "That Step has closed — it is kept as history.";
      if (text.trim().length === 0) return "A Step needs words of its own.";
      patchRelationship(relationshipId, (current) => {
        const steps = withStepText(current.steps, stepId, text);
        if (steps === current.steps) return current;
        return { ...current, steps: [...steps] };
      });
      return null;
    },
    [relationships, patchRelationship],
  );

  /**
   * Add a Step a party wrote themselves, on one of the relationship's Aspects.
   *
   * The row came from no Gap: `derivedFrom` is empty and there is no `suggestedText`, which is the
   * one place `zStep` allows that. It is `open` — an authored Step is a thing to do, not a tick
   * already earned. The id is numbered past the Aspect's existing Steps, so a second one is a second
   * row rather than an overwrite.
   */
  const addStep = useCallback(
    (relationshipId: string, aspectId: string, text: string): string | null => {
      const rel = relationships.find((candidate) => candidate.id === relationshipId);
      if (rel === undefined) return "This relationship does not exist.";
      if (!rel.items.some((item) => item.id === aspectId)) {
        return "That Aspect is not on this relationship.";
      }
      const trimmed = text.trim();
      if (trimmed.length === 0) return "A Step needs words of its own.";
      const step = authoredStepOf({
        relationshipId,
        aspectId,
        text: trimmed,
        existing: rel.steps,
        createdAt: new Date().toISOString(),
      });
      patchRelationship(relationshipId, (current) => ({
        ...current,
        steps: [...current.steps, step],
      }));
      return null;
    },
    [relationships, patchRelationship],
  );

  const submitAnswers = useCallback(
    (
      relationshipId: string,
      role: "initiator" | "counterparty",
      answers: Readonly<Record<string, Opinions>>,
    ) => {
      patchRelationship(relationshipId, (rel) => {
        if (role === "initiator") {
          return {
            ...rel,
            initiatorAnswers: { ...rel.initiatorAnswers, ...answers },
            initiatorSubmitted: true,
          };
        }
        return {
          ...rel,
          counterpartyAnswers: { ...rel.counterpartyAnswers, ...answers },
          counterpartySubmitted: true,
        };
      });
    },
    [patchRelationship],
  );

  const acceptSession = useCallback(
    (relationshipId: string, role: "initiator" | "counterparty") => {
      patchRelationship(relationshipId, (rel) => {
        const now = new Date().toISOString();
        const next =
          role === "initiator"
            ? { ...rel, initiatorAccepted: true, initiatorAcceptedAt: now }
            : { ...rel, counterpartyAccepted: true, counterpartyAcceptedAt: now };
        const wasComplete = rel.initiatorAccepted && rel.counterpartyAccepted;
        const isComplete = next.initiatorAccepted && next.counterpartyAccepted;
        // The closing event: when the second party accepts, the session flips complete and the
        // report unlocks at that instant. It is also the one moment Steps are derived — from the
        // Gaps of the session just agreed, and then stored, so a party can mark progress and the
        // panel keeps showing what was agreed (`content/steps.ts`).
        if (!wasComplete && isComplete) {
          const input = {
            relationshipId: rel.id,
            items: [...next.items],
            initiatorAnswers: next.initiatorAnswers,
            counterpartyAnswers: next.counterpartyAnswers,
            createdAt: now,
          };
          const derived = deriveSteps(input);
          // Two writes, in this order: **close** what this session's Gaps have closed, then **add**
          // the Steps it newly earns. Neither rewrites a stored row — the dedupe is by the stable
          // per-Aspect id, so a ticked Step keeps its tick and a closed one stays closed.
          const closed = closeSteps(next.steps, input);
          return {
            ...next,
            steps: [...closed, ...stepsToAdd(closed, derived)],
            completedSessions: next.completedSessions + 1,
            lastSessionAt: now,
          };
        }
        return next;
      });
    },
    [patchRelationship],
  );

  const requestNewSession = useCallback(
    (relationshipId: string): string | null => {
      const rel = relationships.find((candidate) => candidate.id === relationshipId);
      if (rel === undefined) return "This relationship does not exist.";
      if (rel.subscription === null) {
        return "There is no subscription on this relationship — subscribe to request a new session.";
      }
      if (rel.subscription.status === "lapsed") {
        return "Your subscription has lapsed. Restore it to request a new session.";
      }
      if (rel.subscription.status === "past_due") {
        return "Your subscription is past due. Update your payment to request a new session.";
      }
      const completedAt = unlockedAtOf(rel) ?? new Date().toISOString();
      const record: V1SessionRecord = {
        id: uid("ses"),
        initiatorAnswers: rel.initiatorAnswers,
        counterpartyAnswers: rel.counterpartyAnswers,
        initiatorAcceptedAt: rel.initiatorAcceptedAt ?? completedAt,
        counterpartyAcceptedAt: rel.counterpartyAcceptedAt ?? completedAt,
        completedAt,
      };
      patchRelationship(rel.id, (current) => ({
        ...current,
        initiatorAnswers: {},
        counterpartyAnswers: {},
        initiatorSubmitted: false,
        counterpartySubmitted: false,
        initiatorAccepted: false,
        counterpartyAccepted: false,
        initiatorAcceptedAt: null,
        counterpartyAcceptedAt: null,
        history: [record, ...current.history],
        openedSessions: current.openedSessions + 1,
      }));
      return null;
    },
    [relationships, patchRelationship],
  );

  const addComment = useCallback(
    (relationshipId: string, author: "initiator" | "counterparty", body: string) => {
      patchRelationship(relationshipId, (rel) => ({
        ...rel,
        comments: [...rel.comments, { id: uid("cmt"), author, body, at: new Date().toISOString() }],
      }));
    },
    [patchRelationship],
  );

  const addAspectComment = useCallback(
    (
      relationshipId: string,
      itemId: string,
      author: "initiator" | "counterparty",
      body: string,
    ) => {
      patchRelationship(relationshipId, (rel) => ({
        ...rel,
        aspectComments: {
          ...rel.aspectComments,
          [itemId]: [
            ...(rel.aspectComments[itemId] ?? []),
            { id: uid("cmt"), author, body, at: new Date().toISOString() },
          ],
        },
      }));
    },
    [patchRelationship],
  );

  const addAspect = useCallback(
    (
      relationshipId: string,
      input: { readonly prompt: string; readonly leftValue: string; readonly rightValue: string },
    ) => {
      const aspect: Aspect = {
        id: uid("aspect"),
        prompt: input.prompt.trim(),
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: input.leftValue.trim(),
        rightValue: input.rightValue.trim(),
      };
      patchRelationship(relationshipId, (rel) => ({ ...rel, items: [...rel.items, aspect] }));
    },
    [patchRelationship],
  );

  const renameAspect = useCallback(
    (
      relationshipId: string,
      itemId: string,
      patch: {
        readonly prompt?: string;
        readonly leftValue?: string;
        readonly rightValue?: string;
      },
    ) => {
      patchRelationship(relationshipId, (rel) => ({
        ...rel,
        items: rel.items.map((item) =>
          item.id === itemId
            ? {
                ...item,
                prompt: patch.prompt !== undefined ? patch.prompt.trim() : item.prompt,
                leftValue: patch.leftValue !== undefined ? patch.leftValue.trim() : item.leftValue,
                rightValue:
                  patch.rightValue !== undefined ? patch.rightValue.trim() : item.rightValue,
              }
            : item,
        ),
      }));
    },
    [patchRelationship],
  );

  const moveAspect = useCallback(
    (relationshipId: string, itemId: string, direction: "up" | "down") => {
      patchRelationship(relationshipId, (rel) => {
        const index = rel.items.findIndex((item) => item.id === itemId);
        if (index === -1) return rel;
        const target = direction === "up" ? index - 1 : index + 1;
        if (target < 0 || target >= rel.items.length) return rel;
        const items = [...rel.items];
        const temp = items[index];
        items[index] = items[target];
        items[target] = temp;
        return { ...rel, items };
      });
    },
    [patchRelationship],
  );

  const deleteAspect = useCallback(
    (relationshipId: string, itemId: string) => {
      patchRelationship(relationshipId, (rel) => {
        // A blueprint with no Aspects says nothing to either party — never soft-delete the last.
        if (rel.items.length <= 1) return rel;
        const item = rel.items.find((candidate) => candidate.id === itemId);
        if (item === undefined) return rel;
        return {
          ...rel,
          items: rel.items.filter((candidate) => candidate.id !== itemId),
          deletedAspects: [...rel.deletedAspects, item],
        };
      });
    },
    [patchRelationship],
  );

  const restoreAspect = useCallback(
    (relationshipId: string, itemId: string) => {
      patchRelationship(relationshipId, (rel) => {
        const item = rel.deletedAspects.find((candidate) => candidate.id === itemId);
        if (item === undefined) return rel;
        return {
          ...rel,
          deletedAspects: rel.deletedAspects.filter((candidate) => candidate.id !== itemId),
          items: [...rel.items, item],
        };
      });
    },
    [patchRelationship],
  );

  const cloneRelationship = useCallback(
    (relationshipId: string): V1Relationship => {
      const rel = relationships.find((candidate) => candidate.id === relationshipId);
      if (rel === undefined) {
        throw new Error(`no relationship "${relationshipId}" to clone`);
      }
      const now = new Date().toISOString();
      const periodEnd = new Date(Date.now() + 30 * 86_400_000).toISOString();
      const clone: V1Relationship = {
        id: uid("rel"),
        templateId: rel.templateId,
        name: rel.name !== undefined ? `${rel.name} (copy)` : undefined,
        items: rel.items.map((item) => ({ ...item, scale: { ...item.scale } })),
        deletedAspects: [],
        mode: rel.mode,
        setting: rel.setting,
        initiatorName: rel.initiatorName,
        counterpartyName: null,
        // A clone names no invitee either: the seat is empty until the initiator fills it in.
        inviteeName: null,
        initiatorAnswers: {},
        counterpartyAnswers: {},
        initiatorSubmitted: false,
        counterpartySubmitted: false,
        initiatorAccepted: false,
        counterpartyAccepted: false,
        initiatorAcceptedAt: null,
        counterpartyAcceptedAt: null,
        inviteToken: null,
        inviteExpiresAt: null,
        // A clone is a fresh, live relationship — an archived original does not clone its
        // archive state, because the archive is a fact about that row, not the blueprint.
        archivedAt: null,
        sharedWithCoach: false,
        coachComments: [],
        comments: [],
        aspectComments: {},
        // A clone has no history, so it has no agreed Steps: they derive from its own sessions.
        steps: [],
        openedSessions: 0,
        completedSessions: 0,
        subscription: {
          plan: "monthly",
          status: "active",
          periodEnd,
          startedAt: now,
          // The prototype charges nothing, so the ledger starts empty and only a checkout
          // appends to it. A subscription with no payments is the honest new-subscriber state.
          payments: [],
        },
        history: [],
        lastSessionAt: null,
        createdAt: now,
        modifiedAt: now,
      };
      setRelationships((previous) => [...previous, clone]);
      return clone;
    },
    [relationships],
  );

  /**
   * Archive a relationship — the admin console's one destructive-looking action, and the reason
   * it is drawn behind an `AlertDialog`: the row keeps every field, its parties, its Aspects, its
   * sessions and its answers, and only `archivedAt` moves. `restoreRelationship` is the same
   * write with `null`, so the archive is reversible in the store and not just in principle.
   *
   * Both are no-ops on the state they would produce (an already-archived row stays stamped at
   * the instant it was archived, a live row stays `null`), so a double click cannot re-date it.
   */
  const archiveRelationship = useCallback(
    (relationshipId: string) => {
      const now = new Date().toISOString();
      patchRelationship(relationshipId, (rel) =>
        rel.archivedAt === null ? { ...rel, archivedAt: now } : rel,
      );
    },
    [patchRelationship],
  );

  const restoreRelationship = useCallback(
    (relationshipId: string) => {
      patchRelationship(relationshipId, (rel) =>
        rel.archivedAt === null ? rel : { ...rel, archivedAt: null },
      );
    },
    [patchRelationship],
  );

  /** Disable a template — an operator decision beside the record, never a field on it. */
  const disableTemplate = useCallback((templateId: string) => {
    setDisabledTemplateIds((previous) =>
      previous.includes(templateId) ? previous : [...previous, templateId],
    );
  }, []);

  const enableTemplate = useCallback((templateId: string) => {
    setDisabledTemplateIds((previous) => previous.filter((entry) => entry !== templateId));
  }, []);

  const saveAspectSetToLibrary = useCallback(
    (relationshipId: string): Assessment => {
      const rel = relationships.find((candidate) => candidate.id === relationshipId);
      if (rel === undefined) {
        throw new Error(`no relationship "${relationshipId}" to save`);
      }
      // Name the source honestly: its own name when it has one, else the template it came from
      // — never the internal template id.
      const templateTitle =
        templates.find((candidate) => candidate.id === rel.templateId)?.title ?? "Relationship";
      const sourceName = rel.name ?? templateTitle;
      const title = `${sourceName} (saved set)`;
      const assessment: Assessment = {
        id: uid("savedset"),
        slug: slugFor(title),
        type: "assessment",
        status: "published",
        date: new Date().toISOString(),
        title,
        summary: `Saved from ${rel.name !== undefined ? `the relationship “${rel.name}”` : `the “${templateTitle}” template`} — ${rel.items.length} Aspects you can start a new relationship from.`,
        items: rel.items.map((item) => ({ ...item, scale: { ...item.scale } })),
      };
      saveTemplate(assessment);
      return assessment;
    },
    [relationships, saveTemplate, templates],
  );

  const restoreSubscription = useCallback(
    (relationshipId: string) => {
      patchRelationship(relationshipId, (rel) => {
        if (rel.subscription === null) return rel;
        const info = subscriptionPlan(rel.subscription.plan);
        const now = new Date().toISOString();
        const periodEnd = new Date(Date.now() + info.periodDays * 86_400_000).toISOString();
        const payment: V1Payment = {
          id: uid("pay"),
          plan: rel.subscription.plan,
          amountCents: info.priceCents,
          paidAt: now,
        };
        return {
          ...rel,
          subscription: {
            ...rel.subscription,
            status: "active",
            periodEnd,
            payments: [...rel.subscription.payments, payment],
          },
        };
      });
    },
    [patchRelationship],
  );

  const subscribe = useCallback(
    (relationshipId: string, plan: SubscriptionPlan) => {
      const info = subscriptionPlan(plan);
      const now = new Date().toISOString();
      const periodEnd = new Date(Date.now() + info.periodDays * 86_400_000).toISOString();
      patchRelationship(relationshipId, (rel) => {
        const payment: V1Payment = {
          id: uid("pay"),
          plan,
          amountCents: info.priceCents,
          paidAt: now,
        };
        return {
          ...rel,
          subscription: {
            plan,
            status: "active",
            periodEnd,
            startedAt: now,
            payments: [...(rel.subscription?.payments ?? []), payment],
          },
        };
      });
    },
    [patchRelationship],
  );

  const addCoachComment = useCallback(
    (relationshipId: string, body: string) => {
      patchRelationship(relationshipId, (rel) => ({
        ...rel,
        coachComments: [
          ...rel.coachComments,
          { id: uid("cmt"), author: "coach", body, at: new Date().toISOString() },
        ],
      }));
    },
    [patchRelationship],
  );

  const toggleShareWithCoach = useCallback(
    (relationshipId: string) => {
      patchRelationship(relationshipId, (rel) => ({
        ...rel,
        sharedWithCoach: !rel.sharedWithCoach,
      }));
    },
    [patchRelationship],
  );

  const resolveTicket = useCallback((ticketId: string) => {
    setTickets((previous) =>
      previous.map(
        (ticket): V1Ticket => (ticket.id === ticketId ? { ...ticket, status: "resolved" } : ticket),
      ),
    );
  }, []);

  const markThreadRead = useCallback((threadId: string, persona: Persona) => {
    setThreadReadAt((previous) => ({
      ...previous,
      [persona]: { ...(previous[persona] ?? {}), [threadId]: new Date().toISOString() },
    }));
  }, []);

  const markNotificationRead = useCallback((notificationId: string) => {
    setNotifications((previous) =>
      previous.map((notification) =>
        notification.id === notificationId ? { ...notification, read: true } : notification,
      ),
    );
  }, []);

  const markAllNotificationsRead = useCallback((persona: Persona) => {
    setNotifications((previous) =>
      previous.map((notification) =>
        notification.persona === persona ? { ...notification, read: true } : notification,
      ),
    );
  }, []);

  const sendChatMessage = useCallback(
    (relationshipId: string, threadId: string, body: string, persona: Persona): string | null => {
      const rel = relationships.find((candidate) => candidate.id === relationshipId);
      if (rel === undefined) return "This relationship does not exist.";
      const resolved = resolveThreadId(rel, threadId);
      if (resolved === null) return "This thread does not exist.";
      const role = authorRoleOf(persona);
      if (role === null) return "This persona can read threads but not send messages.";
      if (role === "coach") {
        if (resolved.kind !== "relationship") {
          return "Coach notes go on the relationship thread, not on a single Aspect.";
        }
        addCoachComment(relationshipId, body);
        return null;
      }
      if (resolved.kind === "aspect") {
        addAspectComment(relationshipId, resolved.itemId, role, body);
        return null;
      }
      addComment(relationshipId, role, body);
      return null;
    },
    [relationships, addComment, addAspectComment, addCoachComment],
  );

  const setReview = useCallback((route: string, patch: Partial<ReviewEntry>) => {
    setReviews((previous) => {
      const current: ReviewEntry = previous[route] ?? { status: "unreviewed", note: "" };
      return {
        ...previous,
        [route]: {
          status: patch.status ?? current.status,
          note: patch.note ?? current.note,
        },
      };
    });
  }, []);

  const resetStore = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(FLOW_STORAGE_KEY);
      window.localStorage.removeItem(PERSONA_KEY);
      window.localStorage.removeItem(REVIEW_STORAGE_KEY);
      window.localStorage.removeItem(SOCIAL_STORAGE_KEY);
      window.localStorage.removeItem(ADMIN_STORAGE_KEY);
    } catch (error) {
      console.warn("v1 store: could not clear the store (private mode?)", error);
    }
    setTemplates(v1Templates);
    setRelationships(seedRelationships);
    setAccounts(seedAccounts);
    setTickets(seedTickets);
    setNotifications(seedNotifications);
    setThreadReadAt(seedThreadReadAt);
    setDisabledTemplateIds([]);
    setReviews({});
    setPersonaState("visitor");
    setHydrated(true);
  }, []);

  const value = useMemo<V1Store>(
    () => ({
      templates,
      saveTemplate,
      deleteTemplate,
      resetTemplates,
      persona,
      hydrated,
      relationships,
      accounts,
      tickets,
      notifications,
      threadReadAt,
      setPersona,
      createRelationship,
      createRelationshipFromType,
      renameRelationship,
      setRelationshipSetting,
      markStepDone,
      setStepText,
      addStep,
      startFromType,
      cloneType,
      sendInvite,
      claimInvite,
      submitAnswers,
      acceptSession,
      requestNewSession,
      addComment,
      addAspectComment,
      addAspect,
      renameAspect,
      moveAspect,
      deleteAspect,
      restoreAspect,
      cloneRelationship,
      archiveRelationship,
      restoreRelationship,
      disabledTemplateIds,
      disableTemplate,
      enableTemplate,
      saveAspectSetToLibrary,
      restoreSubscription,
      subscribe,
      addCoachComment,
      toggleShareWithCoach,
      resolveTicket,
      markThreadRead,
      markNotificationRead,
      markAllNotificationsRead,
      sendChatMessage,
      reviews,
      setReview,
      resetStore,
    }),
    [
      templates,
      saveTemplate,
      deleteTemplate,
      resetTemplates,
      persona,
      hydrated,
      relationships,
      accounts,
      tickets,
      notifications,
      threadReadAt,
      setPersona,
      createRelationship,
      createRelationshipFromType,
      renameRelationship,
      setRelationshipSetting,
      markStepDone,
      setStepText,
      addStep,
      startFromType,
      cloneType,
      sendInvite,
      claimInvite,
      submitAnswers,
      acceptSession,
      requestNewSession,
      addComment,
      addAspectComment,
      addAspect,
      renameAspect,
      moveAspect,
      deleteAspect,
      restoreAspect,
      cloneRelationship,
      archiveRelationship,
      restoreRelationship,
      disabledTemplateIds,
      disableTemplate,
      enableTemplate,
      saveAspectSetToLibrary,
      restoreSubscription,
      subscribe,
      addCoachComment,
      toggleShareWithCoach,
      resolveTicket,
      markThreadRead,
      markNotificationRead,
      markAllNotificationsRead,
      sendChatMessage,
      reviews,
      setReview,
      resetStore,
    ],
  );

  return <V1StoreContext.Provider value={value}>{children}</V1StoreContext.Provider>;
}

/** Read the store, or throw when a surface forgot its `V1StoreProvider`. */
export function useV1Store(): V1Store {
  const store = useContext(V1StoreContext);
  if (store === null) {
    throw new Error("useV1Store must be used within a V1StoreProvider");
  }
  return store;
}
