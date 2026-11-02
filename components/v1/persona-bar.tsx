// template-ancestor: components/layout/header.tsx   (variation: a notice strip — one-line env/version/persona context, the drawer hamburger, the account menu and compact controls, not the account header's search)
"use client";

import { PERSONA_META, PERSONAS, V1_VERSION, type Persona } from "@/data/v1/fixtures";
import { isDashboardPersona, personaFromPathname, sameSectionHref } from "@/lib/v1/persona";
import { useV1Store } from "@/lib/v1/store";
import { useV1Sidebar } from "@/components/v1/v1-sidebar";
import { AccountMenu } from "@/components/v1/account-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Menu } from "lucide-react";
import Link from "next/link";
import { ReviewChip } from "@/components/v1/review-chip";
import { usePathname, useRouter } from "next/navigation";

/**
 * The persona bar — the auth stand-in, rendered as a notice banner rather than a toolbar. No
 * password, no session, no gate: this strip says who the browser is pretending to be and where
 * the prototype is running, and switching the persona re-enters the app as another persona.
 *
 * The one line is a context string, far-left, driven by real values and never hard-coded:
 *
 *   `Prototype [LOCAL] [V1] | Counterparty [Sam Carter]`
 *
 * The right side carries the controls: the hamburger that opens the sidebar drawer below `xl`
 * (the sidebar card added), the persona switch, and — beside the review chip — the account menu
 * (`components/v1/account-menu.tsx`), the profile chip that opens the persona's Profile, Settings
 * and Notifications.
 */
export function PersonaBar() {
  const { persona: storePersona, setPersona, resetStore } = useV1Store();
  const { openMobile } = useV1Sidebar();
  const router = useRouter();
  const pathname = usePathname();

  // The URL is the source of truth for which persona's dashboard this is; the store persona is
  // only the remembered "last choice" for the picker. On a dashboard route the bar shows the URL
  // persona, so a fresh visit to `/v1/initiator` reads "Initiator", not the default "Visitor".
  const persona: Persona = personaFromPathname(pathname) ?? storePersona;

  const meta = PERSONA_META[persona];
  /** `Sam Carter` when a surname exists, `Visitor` when the persona is a role word. */
  const fullName = meta.surname ? `${meta.name} ${meta.surname}` : meta.name;

  /**
   * Switching personas keeps the current section when the new persona has it, else lands on that
   * persona's overview (#384). A persona with no dashboard (visitor, service) keeps its own
   * landing, which is not a section.
   */
  const onSwitch = (next: Persona) => {
    setPersona(next);
    const target = isDashboardPersona(next)
      ? sameSectionHref(next, pathname)
      : PERSONA_META[next].landing;
    router.push(target);
  };

  /** `[LOCAL]` only for a local prototype run; a deployed build claims nothing. */
  const isLocal = (process.env.V1_ENV ?? "") === "local";

  return (
    <div className="sticky top-0 z-30 border-b border-border bg-muted/60 backdrop-blur">
      <div className="flex items-center gap-2 px-3 sm:px-4">
        {/* The drawer hamburger — below `xl` the sidebar is off-canvas, and this is the one
            control that opens it, so Relationships and Chat stay a tap away on a phone. */}
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-card text-foreground xl:hidden"
          onClick={openMobile}
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* The context string — one line, truncating on narrow screens rather than wrapping. */}
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
          <AccountMenu persona={persona} />
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
