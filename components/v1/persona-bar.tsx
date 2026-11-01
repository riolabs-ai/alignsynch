// template-ancestor: components/layout/header.tsx   (variation: a notice strip — one-line env/version/persona context with compact controls, not the account header's search and menu)
"use client";

import { PERSONA_META, PERSONAS, V1_VERSION, type Persona } from "@/data/v1/fixtures";
import { useV1Store } from "@/lib/v1/store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { ReviewChip } from "@/components/v1/review-chip";
import { useRouter } from "next/navigation";

/**
 * The persona bar — the auth stand-in, rendered as a notice banner rather than a toolbar. No
 * password, no session, no gate: this strip says who the browser is pretending to be and where
 * the prototype is running, and switching the persona re-enters the app as another persona.
 *
 * The one line is a context string, far-left, driven by real values and never hard-coded:
 *
 *   `Prototype [LOCAL] [V1] | Counterparty [Sam Carter]`
 *
 *   - `[LOCAL]` — from the `V1_ENV` build flag (inlined by `next.config.mjs`), rendered only
 *     when the value is `local`. A deployed prototype has it unset and claims no environment.
 *   - `[V1]` — `V1_VERSION`, the prototype's own version, from the fixture.
 *   - the persona's label, name and surname — all from `PERSONA_META`, so a rename follows the
 *     fixture and not this component.
 *
 * The chosen persona is stored in the store and mirrored to the `v1_persona` localStorage key and
 * cookie by the store's `setPersona`. The strip is sticky and persistent across every `/v1` screen.
 */
export function PersonaBar() {
  const { persona, setPersona, resetStore } = useV1Store();
  const router = useRouter();

  const meta = PERSONA_META[persona];
  /** `Sam Carter` when a surname exists, `Visitor` when the persona is a role word. */
  const fullName = meta.surname ? `${meta.name} ${meta.surname}` : meta.name;

  const onSwitch = (next: Persona) => {
    setPersona(next);
    router.push(PERSONA_META[next].landing);
  };

  /** `[LOCAL]` only for a local prototype run; a deployed build claims nothing. */
  const isLocal = (process.env.V1_ENV ?? "") === "local";

  return (
    <div className="sticky top-0 z-30 border-b border-border bg-muted/60 backdrop-blur">
      <div className="flex items-center gap-3 px-4">
        {/*
          The context string — one line, far-left, truncating the persona name with an ellipsis
          on narrow screens rather than wrapping. 12px (text-xs), the smallest text in the shell;
          the page's own copy is untouched.
        */}
        <p className="min-w-0 flex-1 truncate py-1 text-xs leading-5 text-muted-foreground">
          Prototype{" "}
          {isLocal && (
            <span className="font-semibold uppercase tracking-wider text-action">[LOCAL]</span>
          )}
          {isLocal && " "}
          <span className="font-semibold uppercase tracking-wider text-foreground">
            [{V1_VERSION}]
          </span>{" "}
          <span aria-hidden="true">|</span> {meta.label}{" "}
          <span className="font-semibold text-foreground">[{fullName}]</span>
        </p>

        {/* Desktop controls — compact (11px, 32px visual) with a 44px hit area via outer padding. */}
        <div className="hidden shrink-0 items-center gap-1 sm:flex">
          <label htmlFor="v1-persona-switch" className="sr-only">
            Switch persona
          </label>
          {/*
            A native select cannot split its visual height from its hit area, so it stays a 32px
            compact control and the full-size equivalent lives on the persona picker page (the
            "Persona picker" link beside it) — the fallback the card allows when a 44px target
            cannot be honoured at banner size.
          */}
          <select
            id="v1-persona-switch"
            value={persona}
            onChange={(event) => onSwitch(event.target.value as Persona)}
            className="h-8 rounded-md border border-input bg-card px-1.5 text-[11px] text-foreground"
          >
            {PERSONAS.map((id) => (
              <option key={id} value={id}>
                {PERSONA_META[id].label}
              </option>
            ))}
          </select>
          <Link href="/v1" className="flex items-center px-1 py-1.5">
            <span className="inline-flex h-8 items-center rounded-md border border-border bg-card px-2 text-[11px] font-medium text-foreground transition-colors hover:bg-muted">
              Persona picker
            </span>
          </Link>
          <button type="button" onClick={resetStore} className="flex items-center px-1 py-1.5">
            <span className="inline-flex h-8 items-center rounded-md border border-border bg-card px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted">
              Reset demo
            </span>
          </button>
          <ReviewChip className="hidden sm:inline-flex" />
        </div>

        {/* Mobile controls — one menu button at `sm` and below, so the line never wraps. */}
        <div className="flex shrink-0 items-center sm:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-8 items-center gap-1 rounded-md border border-border bg-card px-2 text-[11px] font-medium text-foreground"
              >
                {meta.label}
                <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {PERSONAS.map((id) => (
                <DropdownMenuItem key={id} onSelect={() => onSwitch(id)}>
                  <span className="font-medium">{PERSONA_META[id].label}</span>
                  <span className="ml-auto text-muted-foreground">{PERSONA_META[id].name}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/v1">Persona picker</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => resetStore()}>Reset demo</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
