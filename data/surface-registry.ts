/**
 * The surface registry — one honest status per relationship-product surface (issue #409).
 *
 * R1 ships four **read** surfaces into the app and says plainly what is not wired in the rest. A
 * missing page and a page that was never built look identical to a reader — a 404 reads as a bug
 * — so a surface that is not finished is still *shown*: it renders with its real heading, its
 * real body, and one inline notice naming what it cannot do yet
 * (`components/shell/in-progress-surface.tsx`). That is the owner's decision, and it is a
 * decision about honesty rather than access: greying a surface and re-enabling it later is the
 * UI churn, while "in progress" states the truth once.
 *
 * **This file labels; nothing gates on it.** No route is disabled, no nav row is hidden, no link
 * is refused because of a status here. The registry exists so the notice on a page and any future
 * surface listing read the *same* sentence, and so a status is a claim the build can check
 * instead of a comment somebody wrote. `components/layout/nav-menus.tsx` does not import it.
 *
 * **The honest-action rule.** A control that cannot work yet must say so *at the point of
 * action* — a disabled button with "Not wired yet" beside it, or the notice inside the form — and
 * must never be a silent no-op. Rendering the in-progress UI is wanted; faking the behaviour is
 * the defect this registry exists to prevent. `needs` is written for that sentence: the missing
 * capability, in plain words, in the form a page can print.
 *
 * **`live` is a claim the tree has to keep.** A surface is live only when its route exists,
 * renders real rows, and needs nothing from this file to explain itself. That is why
 * `surfaceRegistryProblems()` refuses `live` for a route `content/routes.ts` does not carry, and
 * why a live row may not carry a `reason` or `needs` — a live surface with an excuse is a
 * pending one with a better story. The four live entries below are `#409`'s four reads, and they
 * are the only rows this card may call live (`card R1-A`).
 *
 * **`pending` is not a 404 and not a redaction.** It means the surface is declared, its route is
 * the address it will own, and `needs` names the capability that is missing in plain words. A
 * pending route does **not** have to exist yet — cards R1-B and R1-C create the pages these
 * entries point at — which is why only `live` rows are checked against the route manifest.
 *
 * **No fabricated status.** `/admin/instances` and `/admin/gaps` do read Postgres, and they are
 * deliberately *not* live entries here: the shell cannot offer them (`lib/nav.ts::navViewer`
 * reads no role, so no viewer carries `admin-console`), and the console has no index. The admin
 * row below names that missing capability rather than calling a working read shipped, and rather
 * than calling a working read broken.
 *
 * Validated the way every fixture is: the schema is `strict()`, so an unknown key is a red
 * build, and a `status` outside the three literals is a TypeScript error the moment it is
 * written (the const is typed `readonly Surface[]`). `data:check` runs the schema again and then
 * the invariants (`E36`), so a row that parses but cannot be true — two rows for one route, a
 * pending entry with no `needs`, a live entry on a route the manifest does not carry — fails the
 * gate too.
 */
import { z } from "zod";

/** Which product area a surface belongs to — the three the shell speaks in. */
export const zSurfaceArea = z.enum(["relationships", "comms", "admin"]);

/**
 * `live`    shipped and reading real rows — nothing missing
 * `preview` reachable but not the shipped surface — a stated partial, never a promise
 * `pending` declared, not wired — the surface renders with its own in-progress notice
 */
export const zSurfaceStatus = z.enum(["live", "preview", "pending"]);

/**
 * One surface. `.strict()` because every object in this repo is: a key nobody validates is a key
 * nobody can trust, and this file is the product's own statement about itself.
 */
export const zSurface = z
  .object({
    /** The route pattern the surface owns, exactly as `content/routes.ts` spells it. */
    route: z.string().startsWith("/"),
    /** The surface's name, in the product's words. The heading the in-progress panel renders. */
    label: z.string().min(1),
    area: zSurfaceArea,
    status: zSurfaceStatus,
    /** Why it is not live, in one sentence a reader can act on. Required when it is not live. */
    reason: z.string().min(1).optional(),
    /** The missing capability, in plain words. Required when the surface is not live. */
    needs: z.array(z.string().min(1)).min(1).optional(),
  })
  .strict();

export type Surface = z.infer<typeof zSurface>;
export type SurfaceArea = z.infer<typeof zSurfaceArea>;
export type SurfaceStatus = z.infer<typeof zSurfaceStatus>;

/**
 * The registry. Annotated `readonly Surface[]` on purpose: `status: "done"` is not a runtime
 * surprise here, it is a compile error in the file that wrote it.
 *
 * Order is the product's reading order — the two things a person does first (their
 * relationships, the template catalogue), then the surfaces that write, then the operator's.
 */
export const surfaceRegistry: readonly Surface[] = [
  /* ---- live: the four reads R1 ships (#409) ---------------------------------- */
  {
    route: "/assessment/instances",
    label: "Your relationships",
    area: "relationships",
    status: "live",
  },
  {
    route: "/assessment/instances/[instanceId]",
    label: "Relationship",
    area: "relationships",
    status: "live",
  },
  {
    route: "/assessment/templates",
    label: "Template catalogue",
    area: "relationships",
    status: "live",
  },
  {
    route: "/assessment/templates/[templateId]",
    label: "Template",
    area: "relationships",
    status: "live",
  },

  /* ---- pending: the write surfaces R2 takes ---------------------------------- */
  {
    route: "/assessment/instances/new",
    label: "Start a relationship",
    area: "relationships",
    status: "pending",
    reason:
      "An instance is written by a POST route and read on the detail screen; there is no create surface in the app to start one from.",
    needs: ["needs authenticated writes", "needs the store's create rules enforced on the server"],
  },
  {
    route: "/assessment/instances/[instanceId]/answer",
    label: "Answer sheet",
    area: "relationships",
    status: "pending",
    reason:
      "A party's answers are a POST endpoint with no screen of their own, so a reader can open the relationship but cannot fill one in.",
    needs: [
      "needs a write path for a party's opinions",
      "needs the blind rule enforced server-side, never in a reducer",
    ],
  },
  {
    route: "/assessment/instances/[instanceId]/accept",
    label: "Acceptance",
    area: "relationships",
    status: "pending",
    reason:
      "Accepting is a write, and no screen asks for it; nothing on the detail page can stand in for consent.",
    needs: [
      "needs authenticated writes",
      "needs both parties bound to the instance before the write lands",
    ],
  },
  {
    route: "/assessment/instances/[instanceId]/report",
    label: "Report",
    area: "relationships",
    status: "pending",
    reason:
      "The comparison is not a page yet, and the values it shows must be read from stored opinions rather than computed at render time.",
    needs: [
      "needs the per-Aspect comparison read over stored opinions",
      "needs the blind rule to withhold the report until both parties accept",
    ],
  },

  /* ---- pending: comms ---------------------------------------------------------- */
  {
    route: "/chat",
    label: "Conversations",
    area: "comms",
    status: "pending",
    reason:
      "The app's chat is the quiz product's and answers 404 on this brand; the relationship product has no conversation surface.",
    needs: ["needs authenticated writes", "needs message delivery"],
  },
  {
    route: "/notifications",
    label: "Notifications",
    area: "comms",
    status: "pending",
    reason:
      "No notification surface exists for the relationship product; the header's drawer lists quiz events only.",
    needs: ["needs authenticated writes", "needs delivery"],
  },
  {
    route: "/profile/[username]",
    label: "Profile",
    area: "comms",
    status: "pending",
    reason:
      "This route serves the quiz product's people; the relationship product's profile is not ported.",
    needs: ["needs the profile read for a party", "needs authenticated writes to edit it"],
  },
  {
    route: "/settings",
    label: "Settings",
    area: "comms",
    status: "pending",
    reason:
      "Account settings exist; the relationship product's own preferences — template defaults and party identity — are not ported.",
    needs: ["needs authenticated writes"],
  },
  {
    route: "/shop",
    label: "Shop",
    area: "comms",
    status: "pending",
    reason: "No shop surface exists in the app yet.",
    needs: [
      "needs authenticated writes",
      "needs the store's purchase rules enforced on the server",
    ],
  },

  /* ---- pending: admin ---------------------------------------------------------- */
  {
    route: "/admin/console",
    label: "Admin console",
    area: "admin",
    status: "pending",
    reason:
      "The console has no index: /admin/instances and /admin/gaps answer only a session the shell cannot grant, because lib/nav.ts reads no role into the admin-console capability.",
    needs: [
      "needs the operator role read on the session",
      "needs the console's reads offered in navigation",
    ],
  },
];

/** The surface a route pattern names, if the registry declares one. */
export function surfaceFor(route: string): Surface | undefined {
  return surfaceRegistry.find((surface) => surface.route === route);
}

/** The same lookup, for a page that has no honest render without it. */
export function requireSurface(route: string): Surface {
  const surface = surfaceFor(route);
  if (surface === undefined) {
    throw new Error(
      `no surface registered for "${route}" — add the row to data/surface-registry.ts`,
    );
  }
  return surface;
}

/**
 * The invariants a single row cannot see. Pure: the route manifest arrives as a predicate, so
 * the negative cases drive every branch without a filesystem (`scripts/__tests__/
 * surface-registry.test.ts`), and `data:check` supplies `ROUTE_PATTERNS.includes`.
 *
 * The rules, each one a claim this file would otherwise make without evidence:
 *
 *   - **one route, one row** — two statuses for one address means one place says "in progress"
 *     while another says "shipped", and nothing in the build can tell which page is right.
 *   - **not live ⇒ `reason` and `needs`.** A pending surface that does not say what is missing is
 *     a 404 with extra steps.
 *   - **live ⇒ neither.** A live surface with an excuse is a pending one wearing the wrong status,
 *     and its page would carry a notice it should not.
 *   - **live ⇒ the route manifest carries it.** `E7` already holds the manifest and `app/` to each
 *     other, so this is the whole of "renders real rows": a live route exists as a page.
 */
export function surfaceRegistryProblems(
  rows: readonly Surface[],
  resolves: (route: string) => boolean,
): string[] {
  const problems: string[] = [];
  if (rows.length === 0) {
    problems.push(
      "the surface registry is empty — a registry that declares nothing has nothing to be honest about",
    );
    return problems;
  }

  const seen = new Map<string, number>();
  rows.forEach((row, index) => {
    const at = `surface[${index}] ${row.route}`;
    const first = seen.get(row.route);
    if (first !== undefined) {
      problems.push(
        `${at}: route declared twice (also surface[${first}]) — one route has one status`,
      );
    } else {
      seen.set(row.route, index);
    }

    if (row.status === "live") {
      if (row.reason !== undefined || row.needs !== undefined) {
        problems.push(
          `${at}: a live surface carries a reason or needs — that is a pending row with the wrong status`,
        );
      }
      if (!resolves(row.route)) {
        problems.push(
          `${at}: declared live but content/routes.ts does not carry it — a surface is live only if its route exists`,
        );
      }
      return;
    }

    if (row.reason === undefined) {
      problems.push(
        `${at}: ${row.status} without a reason — a stated surface says why, or it is a 404`,
      );
    }
    if (row.needs === undefined) {
      problems.push(
        `${at}: ${row.status} without needs — the page cannot tell a reader what is missing`,
      );
    }
  });

  return problems;
}
