"use client";

/**
 * The v1 prototype's in-browser store — the thing that makes `/v1/**` behave like a
 * shipped app instead of a gallery of screens.
 *
 * A React context over `localStorage`, seeded from `data/v1/fixtures.ts` (typed with the
 * real model, so shapes survive wiring). Mutations are local and instant: a template the
 * editor saves is a template the library reads, with no server action and no `lib/db/**`
 * anywhere in this graph — which is also the guarantee E34 (the client→server walk) keeps
 * honest: importing `pg` here would fail the build the moment it was typed.
 *
 * This file owns the **template** slice only — the editor's surface. The `/v1/**` card
 * (`t_6271a7a3`) extends this same provider with relationships, parties, the persona and
 * the report, so one context carries the whole prototype and nothing has two stores.
 *
 * `localStorage` is read only after hydration: the first render seeds from the fixtures,
 * then the persisted copy replaces it, so the server and the client never disagree about
 * the first paint (React hydration rule #418).
 */
import { zAssessment, type Assessment } from "@/content/assessment";
import { v1Templates } from "@/data/v1/fixtures";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

/** The key this prototype writes its templates under; versioned so a shape change re-seeds. */
const STORAGE_KEY = "alignsynch.v1.templates.v1";

/** A store a surface may read from, and write templates through. */
export interface V1Store {
  readonly templates: readonly Assessment[];
  readonly saveTemplate: (template: Assessment) => void;
  readonly deleteTemplate: (id: string) => void;
  readonly resetTemplates: () => void;
}

const V1StoreContext = createContext<V1Store | null>(null);

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

export function V1StoreProvider({ children }: { children: ReactNode }) {
  const [templates, setTemplates] = useState<readonly Assessment[]>(v1Templates);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setTemplates(loadTemplates());
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

  const value = useMemo(
    () => ({ templates, saveTemplate, deleteTemplate, resetTemplates }),
    [templates, saveTemplate, deleteTemplate, resetTemplates],
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
