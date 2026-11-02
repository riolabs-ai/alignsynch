/**
 * lib/v1/persona.ts — the persona × surface matrix from #384, in one pure module.
 *
 * The sidebar, the dashboard overview and every `/v1/[persona]` stub read the same table, so
 * a surface the sidebar hides cannot be reached by URL and a surface the sidebar shows is never
 * a `notFound()`. The matrix is the spec: `✓` means the persona navigates there, `—` means the
 * route answers `notFound()` for them.
 *
 * No React, no store, no clock. Its one dependency is the persona fixture
 * (`data/v1/fixtures.ts`), which is already client-safe — no `lib/db/**`, no `pg`, no Node
 * builtin — so E34 (the client→server walk) stays green.
 */
import { PERSONA_META, type Persona, type V1Relationship } from "@/data/v1/fixtures";

/** The four personas that own a dashboard; `visitor` and `service` have none. */
export const DASHBOARD_PERSONAS = ["initiator", "counterparty", "coach", "admin"] as const;

export type DashboardPersona = (typeof DASHBOARD_PERSONAS)[number];

const DASHBOARD_SET: ReadonlySet<string> = new Set(DASHBOARD_PERSONAS);

/** Is this `[persona]` URL segment one of the four that owns a dashboard? */
export function isDashboardPersona(value: string): value is DashboardPersona {
  return DASHBOARD_SET.has(value);
}

/** The dashboard persona a `/v1/…` pathname is under, or `null` on a non-dashboard route. */
export function personaFromPathname(pathname: string): DashboardPersona | null {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "v1") return null;
  const persona = parts[1];
  return persona !== undefined && isDashboardPersona(persona) ? persona : null;
}

/** The side-menu sections, in render order: Relationships first, Chat second (#384). */
export const NAV_SECTIONS = [
  "relationships",
  "chat",
  "templates",
  "shop",
  "profile",
  "settings",
  "notifications",
  "admin",
] as const;

export type NavSection = (typeof NAV_SECTIONS)[number];

const NAV_SET: ReadonlySet<string> = new Set(NAV_SECTIONS);

export function isNavSection(value: string): value is NavSection {
  return NAV_SET.has(value);
}

/** Which personas may reach each section — the `✓` rows of the #384 matrix. */
const SECTION_PERSONAS: Readonly<Record<NavSection, readonly DashboardPersona[]>> = {
  relationships: ["initiator", "counterparty", "coach", "admin"],
  chat: ["initiator", "counterparty", "coach", "admin"],
  templates: ["initiator", "admin"],
  shop: ["initiator"],
  profile: ["initiator", "counterparty", "coach", "admin"],
  settings: ["initiator", "counterparty", "coach", "admin"],
  notifications: ["initiator", "counterparty", "coach", "admin"],
  admin: ["admin"],
};

/** May this persona reach this section? The one source for the sidebar and for `notFound()`. */
export function sectionAllowedFor(persona: DashboardPersona, section: NavSection): boolean {
  return SECTION_PERSONAS[section].includes(persona);
}

/** `/v1/<persona>` — the persona's dashboard overview. */
export function overviewHref(persona: DashboardPersona): string {
  return `/v1/${persona}`;
}

/** The section's href under a persona; the admin section is the console, not a route under `/v1/admin`. */
export function sectionHref(persona: DashboardPersona, section: NavSection): string {
  if (section === "admin") return "/v1/admin/console";
  return `/v1/${persona}/${section}`;
}

/**
 * Switching personas keeps the section when the new persona has it, else falls back to that
 * persona's overview (#384's persona-switcher rule). A non-section path (`/v1`, `/v1/pricing`,
 * the old flat routes) also falls back to the overview.
 */
export function sameSectionHref(persona: DashboardPersona, pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  // Expect `/v1/<persona>[/<section>…]`.
  if (parts[0] !== "v1") return overviewHref(persona);
  const section = parts[2];
  if (section !== undefined && isNavSection(section) && sectionAllowedFor(persona, section)) {
    return sectionHref(persona, section);
  }
  return overviewHref(persona);
}

/** The relationships this persona can see — their own, the ones they are party to, the ones they coach, or all. */
export function relationshipsVisibleTo(
  persona: Persona,
  relationships: readonly V1Relationship[],
): readonly V1Relationship[] {
  switch (persona) {
    case "initiator":
      return relationships.filter((rel) => rel.initiatorName === PERSONA_META.initiator.name);
    case "counterparty":
      return relationships.filter((rel) => rel.counterpartyName === PERSONA_META.counterparty.name);
    case "coach":
      return relationships.filter((rel) => rel.sharedWithCoach);
    case "admin":
      return relationships;
    default:
      return [];
  }
}

/** One line describing what will live in each stub, for `components/v1/section-stub.tsx`. */
export const SECTION_SUMMARIES: Readonly<Record<NavSection, string>> = {
  relationships: "Your relationships, status-led: stage, next session, and the session count.",
  chat: "One thread per relationship, plus per-Aspect threads, with unread state.",
  templates: "The template library with start, clone and edit actions.",
  shop: "The per-relationship subscription and checkout — initiator only.",
  profile: "Your public profile and relationship history.",
  settings: "Account, appearance, notifications, privacy and connected accounts.",
  notifications: "Invite accepted, session scored, new comment, payment failed.",
  admin: "The admin console: records, relationships, templates and users.",
};
