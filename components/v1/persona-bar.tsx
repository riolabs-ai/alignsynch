// template-ancestor: none — prototype screen, approved for /v1
"use client";

import { PERSONA_META, PERSONAS, type Persona } from "@/data/v1/fixtures";
import { useV1Store } from "@/lib/v1/store";
import { ReviewChip } from "@/components/v1/review-chip";
import { useRouter } from "next/navigation";
import Link from "next/link";

/**
 * The persona bar — the auth stand-in, and the whole of the prototype's chrome.
 *
 * No password, no session, no gate: this bar says who the browser is pretending to be, and
 * switching it re-enters the app as another persona. It is persistent (every /v1 screen mounts
 * it), small, and sticky, and it is the only "identity" mechanism the prototype has. The chosen
 * persona is stored in the store and mirrored to the `v1_persona` localStorage key and cookie by
 * the store's `setPersona`.
 *
 * It also carries the prototype's one always-visible marker — `Prototype · V1` — so a screen can
 * never be mistaken for the shipped product, and the shell's only navigation: the persona picker,
 * the review list and the demo reset. Every one of them is a `/v1` destination; there is no link
 * out to the real app. Below `sm` it also draws the review-status chip inline (the desktop chip
 * floats bottom-right from `v1-shell.tsx`), so the mobile chip is reachable without covering the
 * answer sheet's sticky action bar.
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
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="whitespace-nowrap rounded bg-action px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-action-foreground">
            Prototype · V1
          </span>
          <ReviewChip className="sm:hidden" />
          <span className="truncate text-xs font-medium text-muted-foreground">
            Signed in as{" "}
            <span className="font-semibold text-foreground">
              {PERSONA_META[persona].label} ({PERSONA_META[persona].name})
            </span>
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
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
          <Link
            href="/v1/review"
            className="inline-flex h-11 items-center rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted"
          >
            Review
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
