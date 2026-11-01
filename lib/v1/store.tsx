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
  zV1FlowDraft,
  v1Templates,
  seedAccounts,
  seedRelationships,
  seedTickets,
  type Persona,
  type V1Account,
  type V1FlowDraft,
  type V1Relationship,
  type V1Ticket,
} from "@/data/v1/fixtures";
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

/** The key the relationship-flow drafts persist under — an abandoned flow resumes from here. */
const DRAFTS_STORAGE_KEY = "alignsynch.v1.drafts.v1";

/** Drafts are versioned apart from the flow slice, so a draft shape change re-seeds only drafts. */
const DRAFTS_VERSION = 1;

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

let idCounter = 0;

/** A kebab-case id unique within the session: `rel-m<ts36>-1`, `inv-…`, `cmt-…`. */
function uid(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
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

function parsePersona(raw: string | null | undefined): Persona | null {
  if (raw === null || raw === undefined) return null;
  const result = zPersona.safeParse(raw);
  return result.success ? result.data : null;
}

/** The persisted drafts, or an empty list when none have been written yet. */
function loadDrafts(): readonly V1FlowDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DRAFTS_STORAGE_KEY);
    if (raw === null) return [];
    const parsed = JSON.parse(raw) as { version: number; drafts: readonly V1FlowDraft[] };
    if (parsed.version !== DRAFTS_VERSION) return [];
    const result = zV1FlowDraft.array().safeParse(parsed.drafts);
    return result.success ? result.data : [];
  } catch (error) {
    console.warn("v1 store: could not read persisted drafts, re-seeding", error);
    return [];
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
  readonly drafts: readonly V1FlowDraft[];

  readonly setPersona: (persona: Persona) => void;
  readonly createRelationship: (input: RelationshipInput) => V1Relationship;
  readonly startDraft: (templateId: string) => V1FlowDraft;
  readonly updateDraft: (
    draftId: string,
    patch: Partial<
      Pick<
        V1FlowDraft,
        "step" | "counterpartyName" | "counterpartyEmail" | "aspects" | "purchase" | "inviteToken"
      >
    >,
  ) => void;
  readonly removeDraft: (draftId: string) => void;
  readonly commitDraft: (draftId: string) => V1Relationship;
  readonly sendInvite: (relationshipId: string) => void;
  readonly claimInvite: (relationshipId: string) => void;
  readonly submitAnswers: (
    relationshipId: string,
    role: "initiator" | "counterparty",
    answers: Readonly<Record<string, Opinions>>,
  ) => void;
  readonly addCoachComment: (relationshipId: string, body: string) => void;
  readonly toggleShareWithCoach: (relationshipId: string) => void;
  readonly resolveTicket: (ticketId: string) => void;
  readonly resetStore: () => void;
}

const V1StoreContext = createContext<V1Store | null>(null);

export function V1StoreProvider({ children }: { children: ReactNode }) {
  const [templates, setTemplates] = useState<readonly Assessment[]>(v1Templates);
  const [relationships, setRelationships] = useState<readonly V1Relationship[]>(seedRelationships);
  const [accounts, setAccounts] = useState<readonly V1Account[]>(seedAccounts);
  const [tickets, setTickets] = useState<readonly V1Ticket[]>(seedTickets);
  const [drafts, setDrafts] = useState<readonly V1FlowDraft[]>([]);
  const [persona, setPersonaState] = useState<Persona>("visitor");
  const [hydrated, setHydrated] = useState(false);
  const hydratedRef = useRef(false);

  // One mount: adopt the persisted copies once, for every slice, then mark hydrated.
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const nextPersona = parsePersona(window.localStorage.getItem(PERSONA_KEY)) ?? "visitor";
    const flow = loadFlow();
    setTemplates(loadTemplates());
    setRelationships(flow.relationships);
    setAccounts(flow.accounts);
    setTickets(flow.tickets);
    setDrafts(loadDrafts());
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
      window.localStorage.setItem(
        DRAFTS_STORAGE_KEY,
        JSON.stringify({ version: DRAFTS_VERSION, drafts }),
      );
    } catch (error) {
      console.warn("v1 store: could not persist drafts (private mode?)", error);
    }
  }, [drafts, hydrated]);

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
        previous.map((rel) => (rel.id === relationshipId ? patch(rel) : rel)),
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
      const relationship: V1Relationship = {
        id: uid("rel"),
        templateId: input.templateId,
        name: input.name?.trim() || undefined,
        items,
        mode: input.mode,
        setting: input.setting,
        initiatorName: input.initiatorName.trim() || PERSONA_META.initiator.name,
        counterpartyName: null,
        counterpartyDisplayName: null,
        initiatorAnswers: {},
        counterpartyAnswers: {},
        initiatorSubmitted: false,
        counterpartySubmitted: false,
        inviteToken: null,
        sharedWithCoach: false,
        coachComments: [],
        openedSessions: 0,
        completedSessions: 0,
        purchase: null,
        lastSessionAt: null,
        createdAt: new Date().toISOString(),
      };
      setRelationships((previous) => [...previous, relationship]);
      return relationship;
    },
    [templates],
  );

  const startDraft = useCallback(
    (templateId: string): V1FlowDraft => {
      const template = templates.find((candidate) => candidate.id === templateId);
      if (template === undefined) {
        throw new Error(`no template "${templateId}" in the library`);
      }
      const draft: V1FlowDraft = {
        id: uid("draft"),
        templateId,
        step: "name",
        counterpartyName: "",
        counterpartyEmail: "",
        aspects: template.items.map((item) => ({
          id: item.id,
          prompt: item.prompt,
          leftValue: item.leftValue,
          rightValue: item.rightValue,
        })),
        mode: "advanced",
        setting: "soft",
        purchase: null,
        inviteToken: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setDrafts((previous) => [...previous, draft]);
      return draft;
    },
    [templates],
  );

  const updateDraft = useCallback(
    (
      draftId: string,
      patch: Partial<
        Pick<
          V1FlowDraft,
          "step" | "counterpartyName" | "counterpartyEmail" | "aspects" | "purchase" | "inviteToken"
        >
      >,
    ) => {
      setDrafts((previous) =>
        previous.map((draft) =>
          draft.id === draftId
            ? { ...draft, ...patch, updatedAt: new Date().toISOString() }
            : draft,
        ),
      );
    },
    [],
  );

  const removeDraft = useCallback((draftId: string) => {
    setDrafts((previous) => previous.filter((draft) => draft.id !== draftId));
  }, []);

  const commitDraft = useCallback(
    (draftId: string): V1Relationship => {
      const draft = drafts.find((candidate) => candidate.id === draftId);
      if (draft === undefined) {
        throw new Error(`no draft "${draftId}"`);
      }
      const items: Aspect[] = draft.aspects.map((aspect) => ({
        id: aspect.id,
        prompt: aspect.prompt.trim(),
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: aspect.leftValue.trim(),
        rightValue: aspect.rightValue.trim(),
      }));
      const relationship: V1Relationship = {
        id: uid("rel"),
        templateId: draft.templateId,
        name: undefined,
        items,
        mode: draft.mode,
        setting: draft.setting,
        initiatorName: PERSONA_META.initiator.name,
        counterpartyName: null,
        counterpartyDisplayName: draft.counterpartyName.trim() || null,
        initiatorAnswers: {},
        counterpartyAnswers: {},
        initiatorSubmitted: false,
        counterpartySubmitted: false,
        inviteToken: draft.inviteToken,
        sharedWithCoach: false,
        coachComments: [],
        openedSessions: 0,
        completedSessions: 0,
        purchase: draft.purchase,
        lastSessionAt: null,
        createdAt: new Date().toISOString(),
      };
      setRelationships((previous) => [...previous, relationship]);
      setDrafts((previous) => previous.filter((candidate) => candidate.id !== draftId));
      return relationship;
    },
    [drafts],
  );

  const sendInvite = useCallback(
    (relationshipId: string) => {
      patchRelationship(relationshipId, (rel) => ({
        ...rel,
        inviteToken: uid("inv"),
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

  const resetStore = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(FLOW_STORAGE_KEY);
      window.localStorage.removeItem(PERSONA_KEY);
    } catch (error) {
      console.warn("v1 store: could not clear the store (private mode?)", error);
    }
    setTemplates(v1Templates);
    setRelationships(seedRelationships);
    setAccounts(seedAccounts);
    setTickets(seedTickets);
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
      drafts,
      setPersona,
      createRelationship,
      startDraft,
      updateDraft,
      removeDraft,
      commitDraft,
      sendInvite,
      claimInvite,
      submitAnswers,
      addCoachComment,
      toggleShareWithCoach,
      resolveTicket,
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
      drafts,
      setPersona,
      createRelationship,
      startDraft,
      updateDraft,
      removeDraft,
      commitDraft,
      sendInvite,
      claimInvite,
      submitAnswers,
      addCoachComment,
      toggleShareWithCoach,
      resolveTicket,
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
