// template-ancestor: none — prototype screen, approved for /v1
"use client";

import { PERSONA_META, PERSONAS, type Persona } from "@/data/v1/fixtures";
import { useV1Store } from "@/lib/v1/store";
import { useRouter } from "next/navigation";
import Link from "next/link";

/**
 * The persona bar — the auth stand-in. No password, no session, no gate: this bar says who the
 * browser is pretending to be, and switching it re-renters the app as another persona. It is
 * persistent (every /v1 screen mounts it), small, and sticky, and it is the only "identity"
 * mechanism the prototype has. The chosen persona is stored in the store and mirrored to the
 * `v1_persona` localStorage key and cookie by the store's `setPersona`.
 */
export function PersonaBar() {
  const { persona, setPersona, resetStore } = useV1Store();
  const router = useRouter();

  const onSwitch = (next: Persona) => {
    setPersona(next);
    router.push(PERSONA_META[next].landing);
  };

  return (
    <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded bg-action px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-action-foreground">
            V1
          </span>
          <span className="truncate text-xs font-medium text-muted-foreground">
            Signed in as{" "}
            <span className="font-semibold text-foreground">
              {PERSONA_META[persona].label} ({PERSONA_META[persona].name})
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="v1-persona-switch" className="sr-only">
            Switch persona
          </label>
          <select
            id="v1-persona-switch"
            value={persona}
            onChange={(event) => onSwitch(event.target.value as Persona)}
            className="h-11 rounded-md border border-input bg-card px-2 text-sm text-foreground"
          >
            {PERSONAS.map((id) => (
              <option key={id} value={id}>
                {PERSONA_META[id].label}
              </option>
            ))}
          </select>
          <Link
            href="/v1"
            className="inline-flex h-11 items-center rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted"
          >
            Persona picker
          </Link>
          <button
            type="button"
            onClick={resetStore}
            className="inline-flex h-11 items-center rounded-md border border-border bg-card px-3 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            Reset demo
          </button>
        </div>
      </div>
    </div>
  );
}
