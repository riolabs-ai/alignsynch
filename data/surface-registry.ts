/**
 * The surface registry — one honest status per relationship-product surface (issue #409).
 *
 * R1 ships four **read** surfaces into the app and greys everything else. A missing page and a
 * page that was never built look identical to a reader — a 404 reads as a bug — so the product
 * states the difference instead: every surface is declared here with one of three statuses, the
 * nav disables the ones that are not wired (`components/layout/nav-menus.tsx`), and the one
 * shared panel explains them (`components/shell/pending-surface.tsx`).
 *
 * **`live` is a claim the tree has to keep.** A surface is live only when its route exists,
 * renders real rows, and needs nothing from this file to explain itself. That is why
 * `surfaceRegistryProblems()` refuses `live` for a route `content/routes.ts` does not carry, and
 * why a live row may not carry a `reason` or `needs` — a live surface with an excuse is a
 * pending one with a better story. The live entries below are `#409`'s reads, the report R1-C
 * shipped, the acceptance R2 wired and — since the console moved out of `/v1` (#478) — the
 * operator console's index, and they are the only rows that may be called live.
 *
 * **`preview` is a shipped screen whose actions are not wired.** R1 ships create, answer and
 * accept as real layouts with every write control disabled and labelled "Not wired yet"; the
 * route exists and the page renders, so they are neither live (nothing they offer is recorded)
 * nor pending (there is a page, and it is the address they own). `takesClick` treats them like
 * pending on purpose: a preview surface never gains a nav destination it cannot honour.
 *
 * **`pending` is not a 404 and not a redaction.** It means the surface is declared, its route is
 * the address it will own, and `needs` names the capability that is missing in plain words. The
 * page a pending route renders says exactly that; nothing here decides what a page renders, it
 * only says what is true. A pending route does **not** have to exist yet — cards R1-B and R1-C
 * create the pages these entries point at — which is why only `live` rows are checked against
 * the route manifest.
 *
 * **No fabricated status.** `/admin/instances` and `/admin/gaps` do read Postgres, and they are
 * not rows here: the shell offers them to an `admin` (`lib/nav.ts::navViewer` maps the role onto
 * `admin-console`), so there is no missing capability for this file to name. The one admin row it
 * carried was the console's **index**, declared pending because the console had no landing page;
 * #478 moved the six console pages out of `/v1` to `/admin/console`, so that route now exists,
 * renders the operator's rows behind `requireAdmin()`, and the row is live. An operator's console
 * that reads the in-browser store rather than Postgres says so in `data/ui-registry.ts`, which is
 * the file that describes what is behind a screen; this one says only that nothing is missing.
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
 * `pending` declared, not wired — the page says so and the nav disables it
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
    /** The surface's name, in the product's words. Rendered by the panel and the nav. */
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
  /* ---- live: the read surfaces R1 ships (#409) ------------------------------- */
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
  {
    route: "/assessment/instances/[instanceId]/report",
    label: "Report",
    area: "relationships",
    status: "live",
  },

  /* ---- preview: the write surfaces R2 takes — real screens, no write path ----- */
  {
    route: "/assessment/templates/[templateId]/create",
    label: "Create a relationship",
    area: "relationships",
    status: "preview",
    reason:
      "Not wired yet — this screen is not connected to the create path, so submitting it cannot create a relationship. Nothing was saved.",
    needs: ["needs authenticated writes", "needs the store's create rules enforced on the server"],
  },
  {
    route: "/assessment/instances/[instanceId]/answer",
    label: "Answer sheet",
    area: "relationships",
    status: "preview",
    reason:
      "Not wired yet — this sheet does not save. Anything you mark here is not recorded, and the submit button stays disabled until the write path ships.",
    needs: [
      "needs a write path for a party's opinions",
      "needs the blind rule enforced server-side, never in a reducer",
    ],
  },
  {
    route: "/assessment/instances/[instanceId]/accept",
    label: "Acceptance",
    area: "relationships",
    // Live since R2 (#427): `POST …/accepts` records one seat's acceptance in `party.accepted_at`,
    // and the second acceptance completes the session, opens the report and derives the Steps.
    // Nothing on the page is a disabled control any more, so the row carries no `reason`/`needs`.
    status: "live",
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

  /* ---- live: admin ---------------------------------------------------------- */
  {
    route: "/admin/console",
    label: "Admin console",
    // Live since #478: the six console pages moved out of `/v1` to `/admin/console`, under the
    // app shell, and the subtree's layout gates them with `requireAdmin()` — a signed-out visitor
    // is sent to `/login`, a member gets the 404 a URL that never existed returns.
    status: "live",
    area: "admin",
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

/** Whether the nav should draw a row for this href as a destination or as a stated pending one. */
export function takesClick(route: string): boolean {
  return (surfaceFor(route)?.status ?? "live") === "live";
}

/**
 * The invariants a single row cannot see. Pure: the route manifest arrives as a predicate, so
 * the negative cases drive every branch without a filesystem (`scripts/__tests__/
 * surface-registry.test.ts`), and `data:check` supplies `ROUTE_PATTERNS.includes`.
 *
 * The rules, each one a claim this file would otherwise make without evidence:
 *
 *   - **one route, one row** — two statuses for one address is the drift the registry exists to
 *     end (a nav that disables what the page says is live).
 *   - **not live ⇒ `reason` and `needs`.** A pending surface that does not say what is missing is
 *     a 404 with extra steps.
 *   - **live ⇒ neither.** A live surface with an excuse is a pending one wearing the wrong
 *     status, and the nav would not disable it.
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
      "the surface registry is empty — a registry that declares nothing cannot grey anything",
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
