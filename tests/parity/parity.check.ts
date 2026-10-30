/**
 * Brand parity — both brands render the committed snapshot, and a drift fails with a diff (#171).
 *
 * The repo ships two brands and, before this file, CI compiled one. "QuizHub is unchanged" held
 * five times because a worker checked by hand; a convention is not a gate. This is the gate: for
 * each of the seven routes in `routes.ts`, the page is rendered inside the real shell, normalised
 * (`harness.ts`) and compared byte for byte with `snapshots/<brand>/<route>.html`.
 *
 * ## Running it
 *
 * One brand per process, because a brand *is* a build constant — `data/brand.ts` resolves
 * `process.env.BRAND` once at import, which is the same reason `next.config.mjs` inlines it. Two
 * brands in one process would need a module-registry reset per brand, and a renderer holding a
 * second copy of React is a test that fails for its own reasons. So:
 *
 *   `pnpm parity`          both brands, two processes — what the gate runs
 *   `pnpm parity:update`   rewrite the snapshots, and print which routes moved
 *
 * `pnpm test` does not run this file: it is named `*.check.ts`, not `*.test.ts`, and it needs
 * its own config (`vitest.parity.mts`) — a brand is a build constant, so both brands need one
 * process each and `scripts/parity.mjs` is what spawns them.
 *
 * ## Updating a snapshot is a review event, not a refresh
 *
 * `pnpm parity:update` is the only way to change a committed snapshot, and the PR that carries
 * it must state which routes changed and why — that sentence is the part a reviewer reads. Widen
 * nothing to make a diff go away: if a mask would be needed, the header of `harness.ts` says
 * where the boundary is and the PR says why it moved.
 *
 * ## What this proves that the unit tests do not
 *
 * The other tests assert a projection (a copy object, a card model). This one asserts the
 * rendered document: shell, layout, page, every string and every class the browser is handed.
 * A shared component that stops reading the brand, a palette applied to one page, a surface that
 * drifts under the other skin — all of them are a line in the diff here.
 */
import { describe, expect, it, vi } from "vitest";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { freezeClock, normalize, renderRoute } from "./harness";
import { parityRoutes } from "./routes";

/**
 * The brand this process is. Set by `scripts/parity.mjs`, alongside `BRAND` — which is what
 * `data/brand.ts` actually reads. Unset means "not a parity run", and the suite skips rather
 * than picking a brand the caller did not ask for.
 */
const PARITY_BRAND = process.env.PARITY_BRAND;

if (PARITY_BRAND === undefined) {
  throw new Error(
    "PARITY_BRAND is not set: run `pnpm parity` (which runs one process per brand), not vitest directly",
  );
}

/** `PARITY_UPDATE=1` rewrites the snapshots instead of comparing them (`pnpm parity:update`). */
const UPDATE = process.env.PARITY_UPDATE === "1";

/** The product name each brand's output must carry, and the one it must not. */
const NAMES = {
  quizhub: { own: "QuizHub", other: "AlignSynch" },
  alignsynch: { own: "AlignSynch", other: "QuizHub" },
} as const;

type BrandId = keyof typeof NAMES;

/**
 * `next/navigation`: no router exists in a node process.
 *
 * `usePathname` answers the route under test, so the sidebar's active item is in the snapshot.
 * Everything else is inert — except `notFound`, which is the *real* function: a fixture that
 * stops resolving throws Next's `NEXT_HTTP_ERROR_FALLBACK;404` and fails this run, instead of
 * snapshotting an empty page and calling it parity.
 */
vi.mock("next/navigation", async () => {
  const actual = await vi.importActual<typeof import("next/navigation")>("next/navigation");
  const harness = await import("./harness");
  return {
    ...actual,
    usePathname: () => harness.navigation.pathname,
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({}),
    useRouter: () => ({
      push: () => {},
      replace: () => {},
      refresh: () => {},
      back: () => {},
      forward: () => {},
      prefetch: () => {},
    }),
  };
});

/**
 * `next/image`: Next's component needs the Next runtime for its srcset, and it throws on a
 * missing `width` — the pitfall `AGENTS.md` records and `/` has today. The harness measures
 * markup; the gate's `next build` (both brands) compiles the real component.
 */
vi.mock("next/image", async () => {
  const React = await import("react");
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      const {
        fill: _fill,
        priority: _priority,
        quality: _quality,
        placeholder: _placeholder,
        blurDataURL: _blurDataURL,
        unoptimized: _unoptimized,
        ...rest
      } = props;
      return React.createElement("img", rest);
    },
  };
});

/**
 * `/assessment/[slug]` reads Postgres at request time, and the gate has no `DATABASE_URL` on
 * purpose. This answers from `data/assessments.ts` — the collection `pnpm db:seed` writes *from*
 * and `pnpm db:verify` holds the rows to — so the render is the record a seeded database returns.
 */
vi.mock("@/lib/db/assessments", async () => {
  const { assessments, assessmentInstances } = await import("@/data/assessments");
  return {
    readAssessmentScreenBySlug: async (slug: string) => {
      const instance = assessmentInstances.find((entry) => entry.slug === slug);
      if (instance === undefined) return undefined;
      const template = assessments.find((entry) => entry.id === instance.templateId);
      if (template === undefined) return undefined;
      return { instance, template };
    },
  };
});

/**
 * `/profile/[username]` reads `user_profile` at request time (`readUserProfileByHandle`, #164), and
 * the gate has no `DATABASE_URL` on purpose — the same reason the assessment read above is answered
 * from a fixture. `pnpm db:seed` writes assessments and leaves `user_profile` empty, so the answer a
 * freshly seeded database gives is "no row": the page then renders the demo account its own fixture
 * holds, which is the surface this snapshot pins. A signed-in profile is a different URL (the
 * owner's), and `tests/profile-handle.test.ts` covers that path.
 */
vi.mock("@/lib/db/user-profiles", () => ({
  readUserProfileByHandle: async () => null,
  readUserProfileByUserId: async () => null,
}));

const SNAPSHOT_ROOT = fileURLToPath(new URL("./snapshots", import.meta.url));

function snapshotFile(brand: string, slug: string): string {
  return `${SNAPSHOT_ROOT}/${brand}/${slug}.html`;
}

async function readSnapshot(brand: string, slug: string): Promise<string | undefined> {
  try {
    return await readFile(snapshotFile(brand, slug), "utf8");
  } catch {
    return undefined;
  }
}

describe("brand parity", () => {
  const brand = PARITY_BRAND as BrandId;

  it(`this run is ${brand}, and renders that brand's name`, async () => {
    // A harness that resolved one brand twice would pass every comparison below trivially, so the
    // first assertion is about identity: the env var this process was started with is the brand
    // the tree resolved, and the render carries its name and not the other one's.
    const { brand: resolved } = await import("@/data/brand");
    expect(resolved.name).toBe(NAMES[brand].own);

    freezeClock();
    const html = normalize(
      await renderRoute(parityRoutes[0].page, parityRoutes[0].params, parityRoutes[0].route),
    );
    expect(html).toContain(NAMES[brand].own);
    expect(html).not.toContain(NAMES[brand].other);
  });

  for (const route of parityRoutes) {
    it(`${route.route}`, async () => {
      freezeClock();

      const html = await renderRoute(route.page, route.params, route.route);
      expect(html).toContain(NAMES[brand].own);
      expect(html).not.toContain(NAMES[brand].other);

      // The same tree rendered twice must produce the same bytes — otherwise the snapshot is a
      // flaky comparison and the failure would be blamed on the next honest commit. `/quiz/[id]`
      // is the route that reads the clock, so this is the assertion the clock freeze exists for.
      expect(normalize(await renderRoute(route.page, route.params, route.route))).toBe(
        normalize(html),
      );

      const document = normalize(html);
      const committed = await readSnapshot(brand, route.slug);

      if (UPDATE) {
        await mkdir(dirname(snapshotFile(brand, route.slug)), { recursive: true });
        await writeFile(snapshotFile(brand, route.slug), document, "utf8");
        console.log(`${committed === document ? "unchanged" : "WROTE"}    ${brand} ${route.route}`);
        return;
      }

      expect(
        committed,
        `${brand} ${route.route} has no committed snapshot — run pnpm parity:update and say in the PR which routes moved and why`,
      ).toBeDefined();

      expect(
        document,
        `${brand} ${route.route} drifted from its snapshot — if this is intended, run pnpm parity:update and say in the PR which routes moved and why`,
      ).toBe(committed);
    });
  }
});
