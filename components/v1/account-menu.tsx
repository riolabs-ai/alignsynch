// template-ancestor: components/identity/account-home.tsx   (variation: the prototype's account chip — the persona's avatar and name opening their Profile / Settings / Notifications, not a sign-out form)
"use client";

import { GeneratedAvatar } from "@/components/media/generated-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PERSONA_META, type Persona } from "@/data/v1/fixtures";
import { isDashboardPersona, sectionHref } from "@/lib/v1/persona";
import { ChevronDown } from "lucide-react";
import Link from "next/link";

/**
 * The prototype's account menu — the profile chip the notice banner's right side carries beside
 * the review chip (#384). It is the dashboard's stand-in for `AccountHome`: instead of a page of
 * identity facts, it is a compact chip (avatar + name) that opens the persona's Profile, Settings
 * and Notifications. For a persona with no dashboard (visitor, service) there is no chip to draw,
 * exactly as there is no sidebar for them.
 *
 * The avatar is generated from the persona's name (the same `GeneratedAvatar` the real shell
 * uses), never a shared PNG, so the chip reads the fixture and not a hard-coded image.
 */
export function AccountMenu({ persona }: { persona: Persona }) {
  if (!isDashboardPersona(persona)) return null;

  const meta = PERSONA_META[persona];
  const fullName = meta.surname ? `${meta.name} ${meta.surname}` : meta.name;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-1.5 text-foreground transition-colors hover:bg-muted"
          aria-label={`Account menu for ${fullName}`}
        >
          <GeneratedAvatar name={meta.name} seed={persona} size={20} />
          <span className="text-[11px] font-medium">{meta.name}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-sm font-semibold">{fullName}</span>
          <span className="block text-xs text-muted-foreground">{meta.label}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={sectionHref(persona, "profile")}>Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={sectionHref(persona, "settings")}>Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={sectionHref(persona, "notifications")}>Notifications</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
