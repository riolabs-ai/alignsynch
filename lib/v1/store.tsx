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

/** The inputs the relationship form collects. */
export interface RelationshipInput {
  readonly templateId: string;
  readonly name?: string;
  readonly initiatorName: string;
  readonly counterpartyName: string;
  readonly mode: AssessmentMode;
  readonly setting: AlignmentSetting;
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
    setTemplates(loadTemplates());
    setRelationships(flow.relationships);
    setAccounts(flow.accounts);
    setTickets(flow.tickets);
    setNotifications(social.notifications);
    setThreadReadAt(social.threadReadAt);
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
      const items = template.items.map((item) => ({ ...item, scale: { ...item.scale } }));
      const now = new Date().toISOString();
      const relationship: V1Relationship = {
        id: uid("rel"),
        templateId: input.templateId,
        name: input.name?.trim() || undefined,
        items,
        deletedAspects: [],
        mode: input.mode,
        setting: input.setting,
        initiatorName: input.initiatorName.trim() || PERSONA_META.initiator.name,
        counterpartyName: null,
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
        sharedWithCoach: false,
        coachComments: [],
        comments: [],
        aspectComments: {},
        openedSessions: 0,
        completedSessions: 0,
        // A new relationship starts unsubscribed — the shop's checkout (subscribe) is the path
        // that gives it a plan. The counterparty pays nothing, ever.
        subscription: null,
        history: [],
        lastSessionAt: null,
        createdAt: now,
        modifiedAt: now,
      };
      setRelationships((previous) => [...previous, relationship]);
      return relationship;
    },
    [templates],
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
    const items = template.items.map((item) => ({ ...item, scale: { ...item.scale } }));
    const now = new Date().toISOString();
    const relationship: V1Relationship = {
      id: uid("rel"),
      templateId: template.id,
      items,
      mode: "basic",
      setting: "soft",
      initiatorName: PERSONA_META.initiator.name,
      counterpartyName: null,
      initiatorAnswers: {},
      counterpartyAnswers: {},
      initiatorSubmitted: false,
      counterpartySubmitted: false,
      initiatorAccepted: false,
      counterpartyAccepted: false,
      initiatorAcceptedAt: null,
      counterpartyAcceptedAt: null,
      inviteToken: null,
      sharedWithCoach: false,
      coachComments: [],
      comments: [],
      aspectComments: {},
      openedSessions: 0,
      completedSessions: 0,
      subscription: null,
      history: [],
      lastSessionAt: null,
      createdAt: now,
    };
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
        // report unlocks at that instant.
        if (!wasComplete && isComplete) {
          return { ...next, completedSessions: next.completedSessions + 1, lastSessionAt: now };
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
        sharedWithCoach: false,
        coachComments: [],
        comments: [],
        aspectComments: {},
        openedSessions: 0,
        completedSessions: 0,
        subscription: { plan: "monthly", status: "active", periodEnd, startedAt: now },
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
    } catch (error) {
      console.warn("v1 store: could not clear the store (private mode?)", error);
    }
    setTemplates(v1Templates);
    setRelationships(seedRelationships);
    setAccounts(seedAccounts);
    setTickets(seedTickets);
    setNotifications(seedNotifications);
    setThreadReadAt(seedThreadReadAt);
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
