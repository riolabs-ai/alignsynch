/**
 * data/v1/persona-surfaces.ts — the persona × surface matrix of #384 §1, keyed by review route.
 *
 * This is the **single source** of "who is this screen for". `lib/v1/review.ts::REVIEW_SCREENS`
 * names the screens and their URLs; this module names, for each of those exact routes, the
 * matrix surface it instantiates, the template ancestor it varies, and what each of the five
 * personas can do there. Nothing here is hard-coded in a component: `components/v1/review-list.tsx`
 * reads this module and renders its rows.
 *
 * ## The five personas and the three access levels
 *
 * The matrix has exactly five personas — `visitor · initiator · counterparty · coach · admin`.
 * The prototype's sixth persona, `service` (`data/v1/fixtures.ts`), is deliberately absent from
 * the matrix, so its one surface (`/v1/service`) is flagged below as being in no persona's
 * navigation rather than folded into a column the owner did not write. Access is the matrix's
 * three marks, nothing more:
 *
 *   - `use`   — `✓` "can use"
 *   - `view`  — `view` "can see, cannot act"
 *   - `absent` — `—` "not present in their navigation at all"
 *
 * ## Persona-scoped routes
 *
 * The matrix is a table of *surfaces*, and the prototype instantiates some of them as one route
 * per persona. "Dashboard overview" is `— ✓ ✓ ✓ ✓`: every signed-in persona has a dashboard,
 * and the prototype gives each its own route (`/v1/initiator`, `/v1/counterparty`, `/v1/coach`,
 * with the admin's console `/v1/admin` doubling as the admin's landing). The same holds for
 * "Relationships" (`their own / ones they are party to / ones they coach / all`): the
 * initiator's own list is `/v1/initiator/relationships`, and everyone opens the shared detail at
 * `/v1/relationships/[id]`. On a persona-scoped route the owning persona is `use` and the others
 * are `absent` — they reach the same surface through their own route, which is exactly what the
 * matrix's per-persona scoping says.
 *
 * ## One mapping the matrix did not name
 *
 * `/v1/relationships/[id]/accept` is the session-acceptance step of the corrected model (#340):
 * each party records acceptance, and only then does the blind rule lift. #384's matrix has no
 * "accept a session" row — its "Accept membership" row (counterparty-only) is the invitation
 * claim, which the prototype does on the counterparty's landing instead. This screen is mapped to
 * "Answer a session": it is the closing move of the two parties' own side, which is why only
 * initiator and counterparty are `use` (rule 3: the coach and admin never answer, and never
 * accept, on someone's behalf).
 *
 * Imported through relative paths on purpose: `tsconfig.datacheck.json` compiles this file under
 * `module: commonjs`, and the `@/` alias is not resolved there. Nothing here is a component,
 * nothing reads a clock, and nothing reaches `lib/db/**`.
 */
import { REVIEW_SCREENS } from "../../lib/v1/review";

/* ------------------------------------------------------------------ *
 * The five personas and the three access levels
 * ------------------------------------------------------------------ */

export type ReviewPersona = "visitor" | "initiator" | "counterparty" | "coach" | "admin";

/** The five personas in render order — the same order the matrix's header spells them. */
export const REVIEW_PERSONAS: readonly ReviewPersona[] = [
  "visitor",
  "initiator",
  "counterparty",
  "coach",
  "admin",
];

/** The display name of each persona, one source for the review row and the filter. */
export const REVIEW_PERSONA_LABELS: Readonly<Record<ReviewPersona, string>> = {
  visitor: "Visitor",
  initiator: "Initiator",
  counterparty: "Counterparty",
  coach: "Coach",
  admin: "Admin",
};

export type PersonaAccess = "use" | "view" | "absent";

/** One persona's cell in the matrix: the mark, and the action it can take, in one phrase. */
export interface PersonaCell {
  readonly access: PersonaAccess;
  /** What this persona can do here, in one phrase. Empty exactly when `access` is `absent`. */
  readonly action: string;
}

/* ------------------------------------------------------------------ *
 * The surface record
 * ------------------------------------------------------------------ */

export interface PersonaSurface {
  /** The review route this entry covers — exactly one `ReviewScreen.route`. */
  readonly route: string;
  /** The matrix surface (#384 §1) this screen instantiates, or a named non-matrix surface. */
  readonly surface: string;
  /** The template ancestor the screen varies — its page's `template-ancestor:` header, verbatim. */
  readonly ancestor: string;
  /**
   * Position in the persona navigation (the matrix's own row order). `null` for a screen in no
   * persona's navigation: those are flagged, never ordered.
   */
  readonly order: number | null;
  /** Non-null when the matrix places this screen in no persona's navigation — the flag's reason. */
  readonly flag: string | null;
  /** The five persona cells, keyed by `REVIEW_PERSONAS` — complete by type, no fallback text. */
  readonly personas: Readonly<Record<ReviewPersona, PersonaCell>>;
}

/** A cell for a persona who can use the screen — `use` with a one-phrase action. */
const use = (action: string): PersonaCell => ({ access: "use", action });
/** A cell for a persona who can see but not act — `view` with a one-phrase action. */
const view = (action: string): PersonaCell => ({ access: "view", action });
/** A cell for a persona whose navigation does not carry this screen at all. */
const absent: PersonaCell = { access: "absent", action: "" };

/* ------------------------------------------------------------------ *
 * The matrix, keyed by review route, in the matrix's own order
 * ------------------------------------------------------------------ */

export const PERSONA_SURFACE_ROWS: readonly PersonaSurface[] = [
  {
    route: "/v1/pricing",
    surface: "Marketing home, pricing, service",
    ancestor: "components/marketing/marketing-landing.tsx",
    order: 1,
    flag: null,
    personas: {
      visitor: use("browse the public plan tiers"),
      initiator: use("browse the public plan tiers"),
      counterparty: use("browse the public plan tiers"),
      coach: use("browse the public plan tiers"),
      admin: use("browse the public plan tiers"),
    },
  },
  {
    route: "/v1/support",
    surface: "Marketing home, pricing, service",
    ancestor: "components/marketing/marketing-landing.tsx",
    order: 2,
    flag: null,
    personas: {
      visitor: use("read the public help centre"),
      initiator: use("read the public help centre"),
      counterparty: use("read the public help centre"),
      coach: use("read the public help centre"),
      admin: use("read the public help centre"),
    },
  },
  {
    route: "/v1/templates",
    surface: "Template library (browse)",
    ancestor: "components/explore/explore-quiz-list.tsx",
    order: 3,
    flag: null,
    personas: {
      visitor: use("browse the six relationship types"),
      initiator: use("browse, then start a relationship from a type"),
      counterparty: use("browse the six relationship types"),
      coach: view("browse the catalogue, read-only"),
      admin: use("browse every relationship type"),
    },
  },
  {
    route: "/v1/templates/[type]",
    surface: "Template library (browse)",
    ancestor: "components/marketing/marketing-landing.tsx",
    order: 4,
    flag: null,
    personas: {
      visitor: use("read a type's Aspects, walkthrough and price"),
      initiator: use("read the type, then start a relationship from it"),
      counterparty: use("read a type's Aspects, walkthrough and price"),
      coach: view("read the type, read-only"),
      admin: use("read any type"),
    },
  },
  {
    route: "/v1/templates/[type]/demo",
    surface: "Template demo (public preview)",
    ancestor: "components/assessment/assessment-report.tsx",
    order: 5,
    flag: null,
    personas: {
      visitor: use("read a finished example report"),
      initiator: use("read a finished example report before paying"),
      counterparty: use("read a finished example report"),
      coach: view("read a finished example report, read-only"),
      admin: use("read any finished example report"),
    },
  },
  {
    route: "/v1/initiator",
    surface: "Dashboard overview",
    ancestor: "components/console/overview.tsx",
    order: 6,
    flag: null,
    personas: {
      visitor: absent,
      initiator: use("see their template and relationship counts"),
      counterparty: absent,
      coach: absent,
      admin: absent,
    },
  },
  {
    route: "/v1/counterparty",
    surface: "Dashboard overview",
    ancestor: "none — prototype screen, approved for /v1",
    order: 7,
    flag: null,
    personas: {
      visitor: absent,
      initiator: absent,
      counterparty: use("claim invitations, open joined relationships"),
      coach: absent,
      admin: absent,
    },
  },
  {
    route: "/v1/coach",
    surface: "Dashboard overview",
    ancestor: "none — prototype screen, approved for /v1",
    order: 8,
    flag: null,
    personas: {
      visitor: absent,
      initiator: absent,
      counterparty: absent,
      coach: use("observe shared relationships, leave advice"),
      admin: absent,
    },
  },
  {
    route: "/v1/initiator/relationships",
    surface: "Relationships (side menu, top)",
    ancestor: "components/assessment-flow/my-instances.tsx",
    order: 9,
    flag: null,
    personas: {
      visitor: absent,
      initiator: use("invite, re-invite and open their own relationships"),
      counterparty: absent,
      coach: absent,
      admin: absent,
    },
  },
  {
    route: "/v1/relationships/[id]",
    surface: "Relationships (side menu, top)",
    ancestor: "components/assessment-flow/instance-view.tsx",
    order: 10,
    flag: null,
    personas: {
      visitor: absent,
      initiator: use("open their own relationship's timeline"),
      counterparty: use("open a relationship they are party to"),
      coach: use("open a relationship they coach"),
      admin: use("open any relationship"),
    },
  },
  {
    route: "/v1/initiator/templates/new",
    surface: "Aspects CRUD / reorder / clone",
    ancestor: "components/create/quiz-editor.tsx",
    order: 11,
    flag: null,
    personas: {
      visitor: absent,
      initiator: use("author a template's Aspects"),
      counterparty: absent,
      coach: absent,
      admin: absent,
    },
  },
  {
    route: "/v1/initiator/templates",
    surface: "Aspects CRUD / reorder / clone",
    ancestor: "components/assessment-flow/template-library.tsx",
    order: 12,
    flag: null,
    personas: {
      visitor: absent,
      initiator: use("clone a template into a relationship"),
      counterparty: absent,
      coach: absent,
      admin: absent,
    },
  },
  {
    route: "/v1/relationships/[id]/accept",
    surface: "Answer a session (Feel/Wish/Think/Guess)",
    ancestor: "components/assessment-flow/instance-view.tsx",
    order: 13,
    flag: null,
    personas: {
      visitor: absent,
      initiator: use("record acceptance to unlock the report"),
      counterparty: use("record acceptance to unlock the report"),
      coach: absent,
      admin: absent,
    },
  },
  {
    route: "/v1/relationships/[id]/answer",
    surface: "Answer a session (Feel/Wish/Think/Guess)",
    ancestor: "components/assessment-flow/answer-form.tsx",
    order: 14,
    flag: null,
    personas: {
      visitor: absent,
      initiator: use("answer every Aspect from their side"),
      counterparty: use("answer every Aspect from their side"),
      coach: absent,
      admin: absent,
    },
  },
  {
    route: "/v1/relationships/[id]/report",
    surface: "Report / four opinions + gap",
    ancestor: "components/assessment/assessment-report.tsx",
    order: 15,
    flag: null,
    personas: {
      visitor: absent,
      initiator: use("read the report when the session is scored"),
      counterparty: use("read the report when the session is scored"),
      coach: view("read the report once scored, read-only"),
      admin: use("read any report when scored"),
    },
  },
  {
    route: "/v1/admin",
    surface: "Admin console (records, relationships, templates, users)",
    ancestor: "components/admin/instance-registry.tsx",
    order: 16,
    flag: null,
    personas: {
      visitor: absent,
      initiator: absent,
      counterparty: absent,
      coach: absent,
      admin: use("inspect every relationship, template and user"),
    },
  },
  // The four screens the matrix places in no persona's navigation — flagged, never ordered.
  {
    route: "/v1",
    surface: "Sign-in gate (persona picker)",
    ancestor: "components/auth/login-view.tsx",
    order: null,
    flag: "the sign-in gate — a persona is chosen here, so no persona carries it in their navigation",
    personas: {
      visitor: absent,
      initiator: absent,
      counterparty: absent,
      coach: absent,
      admin: absent,
    },
  },
  {
    route: "/v1/service",
    surface: "Service queue (ops)",
    ancestor: "components/support/support-page.tsx",
    order: null,
    flag: "the ops queue — the Service persona is not one of the five matrix personas, so no persona carries it in their navigation",
    personas: {
      visitor: absent,
      initiator: absent,
      counterparty: absent,
      coach: absent,
      admin: absent,
    },
  },
  {
    route: "/v1/privacy",
    surface: "Privacy policy (legal)",
    ancestor: "components/legal/legal-page.tsx",
    order: null,
    flag: "a legal footer page, not in any persona's navigation",
    personas: {
      visitor: absent,
      initiator: absent,
      counterparty: absent,
      coach: absent,
      admin: absent,
    },
  },
  {
    route: "/v1/terms",
    surface: "Terms of service (legal)",
    ancestor: "components/legal/legal-page.tsx",
    order: null,
    flag: "a legal footer page, not in any persona's navigation",
    personas: {
      visitor: absent,
      initiator: absent,
      counterparty: absent,
      coach: absent,
      admin: absent,
    },
  },
  {
    route: "/v1/profile/[handle]",
    surface: "Profile",
    ancestor: "components/identity/member-profile.tsx",
    order: 17,
    flag: null,
    personas: {
      visitor: use("read a member's public profile"),
      initiator: use("read another member's profile; their own carries the actions"),
      counterparty: use("read another member's profile; their own carries the actions"),
      coach: use("read another member's profile"),
      admin: use("read another member's profile"),
    },
  },
];

/* ------------------------------------------------------------------ *
 * Lookups and the per-persona navigation
 * ------------------------------------------------------------------ */

/** The surface a review route resolves to — never `undefined` for a review screen. */
export function personaSurfaceFor(route: string): PersonaSurface {
  const found = PERSONA_SURFACE_ROWS.find((surface) => surface.route === route);
  if (found === undefined) {
    throw new Error(`persona-surfaces: no surface authored for review route "${route}"`);
  }
  return found;
}

/**
 * What a persona sees, in the order their navigation presents it: every surface whose cell is
 * not `absent`, ordered by the matrix's row order (`order`). This is the review filter's list.
 */
export function personaScreens(persona: ReviewPersona): readonly PersonaSurface[] {
  return PERSONA_SURFACE_ROWS.filter((surface) => surface.personas[persona].access !== "absent")
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/* ------------------------------------------------------------------ *
 * Validate at import — drift between the review list and the matrix is a red build
 * ------------------------------------------------------------------ */

function assertValid(): void {
  const rows = new Set(PERSONA_SURFACE_ROWS.map((surface) => surface.route));
  for (const screen of REVIEW_SCREENS) {
    if (!rows.has(screen.route)) {
      throw new Error(`persona-surfaces: no entry for review screen "${screen.route}"`);
    }
  }
  for (const surface of PERSONA_SURFACE_ROWS) {
    if (!REVIEW_SCREENS.some((screen) => screen.route === surface.route)) {
      throw new Error(
        `persona-surfaces: "${surface.route}" is not a route in REVIEW_SCREENS (lib/v1/review.ts)`,
      );
    }
    for (const persona of REVIEW_PERSONAS) {
      const cell = surface.personas[persona];
      if (cell === undefined) {
        throw new Error(`persona-surfaces: "${surface.route}" is missing a cell for "${persona}"`);
      }
      if (cell.access === "absent" ? cell.action !== "" : cell.action.trim() === "") {
        throw new Error(
          `persona-surfaces: "${surface.route}" "${persona}" has access "${cell.access}" and an action "${cell.action}" — ` +
            `an absent cell has no action, a use/view cell states one`,
        );
      }
    }
    if (surface.order === null && surface.flag === null) {
      throw new Error(
        `persona-surfaces: "${surface.route}" has no order and no flag — a screen is either in ` +
          `a persona's navigation or flagged as in none`,
      );
    }
    if (surface.order !== null && surface.flag !== null) {
      throw new Error(
        `persona-surfaces: "${surface.route}" has both an order and a flag — it cannot be in a ` +
          `persona's navigation and outside it`,
      );
    }
  }
}

assertValid();
