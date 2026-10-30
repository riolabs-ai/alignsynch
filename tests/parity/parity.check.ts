/**
 * Brand parity — both brands render the seven routes, and a hash mismatch fails with the route,
 * the brand, the two hashes and an HTML artifact (#171).
 *
 * What is committed is deliberately small: `manifest.txt` (one `route | brand | sha256` line per
 * route per brand — the drift detector) and `summaries/<brand>/<slug>.txt` (the structural summary
 * a reviewer reads in a diff). What is **not** committed is HTML. Fourteen full-page snapshots
 * were 1.4 MB, and any card that touched a shared class, a shared string or one of the seven
 * routes had to regenerate them: a 300 KB diff and merge conflicts nobody should resolve by hand.
 *
 * So the gate compares two things:
 *
 *   1. the **hash** of the normalised render against the manifest — byte-exact, catches everything;
 *   2. the **summary** against its committed file — the same render, described in a form a reviewer
 *      can read, which also makes a stale summary a failure instead of decoration.
 *
 * When either moves, the full normalised HTML for that route is written to `tests/parity/artifacts/`
 * (gitignored, uploaded by CI on failure) and named in the failure message. The bytes that were
 * hashed are the bytes on disk: the artifact is the render, not a re-render.
 *
 * ## Running it
 *
 * One brand per process, because a brand *is* a build constant — `data/brand.ts` resolves
 * `process.env.BRAND` once at import, the same way `next.config.mjs` inlines it. Two brands in one
 * process would need a module-registry reset per brand, and a renderer holding a second copy of
 * React is a test that fails for its own reasons. So:
 *
 *   `pnpm parity`                              both brands, two processes — what the gate runs
 *   `pnpm parity:update --reason "…"`          rewrite the manifest and the summaries
 *
 * `pnpm test` does not run this file: it is named `*.check.ts`, not `*.test.ts`, and it needs its
 * own config (`vitest.parity.mts`).
 *
 * ## Updating is a review event, not a refresh
 *
 * `pnpm parity:update` refuses to run without a stated reason, prints which routes moved, and the
 * PR carries the same sentence. A caller who cannot say why a route moved has not finished
 * investigating it; widening the harness to make a diff go away is not a fix.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it, vi } from "vitest";

import { freezeClock, normalize, renderRoute } from "./harness";
import { parityRoutes, type ParityRoute } from "./routes";
import { absentRender, summarize } from "./summary";
import { isEnabled } from "@/lib/flags";

/**
 * The brand this process is. Set by `scripts/parity.mjs`, alongside `BRAND` — which is what
 * `data/brand.ts` actually reads. Unset means "not a parity run", and the suite refuses rather
 * than picking a brand the caller did not ask for.
 */
const PARITY_BRAND = process.env.PARITY_BRAND;

if (PARITY_BRAND === undefined) {
  throw new Error(
    "PARITY_BRAND is not set: run `pnpm parity` (which runs one process per brand), not vitest directly",
  );
}

/** `PARITY_UPDATE=1` rewrites the manifest and summaries instead of comparing them. */
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
 * `usePathname` answers the route under test, so the sidebar's active item is in the render.
 * Everything else is inert — except `notFound`, which is the *real* function: a fixture that
 * stops resolving throws Next's `NEXT_HTTP_ERROR_FALLBACK;404` and fails this run, instead of
 * hashing an empty page and calling it parity.
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
 * holds, which is the surface this summary pins. A signed-in profile is a different URL (the
 * owner's), and `tests/profile-handle.test.ts` covers that path.
 */
vi.mock("@/lib/db/user-profiles", () => ({
  readUserProfileByHandle: async () => null,
  readUserProfileByUserId: async () => null,
}));

const PARITY_ROOT = fileURLToPath(new URL(".", import.meta.url));
const MANIFEST = `${PARITY_ROOT}manifest.txt`;
const SUMMARIES = `${PARITY_ROOT}summaries`;

/**
 * Where a failing render's full HTML goes. Not committed, not `summaries/`: it exists only to be
 * read when a leg is red, which is why CI uploads it and `.gitignore` drops it.
 */
const ARTIFACTS = process.env.PARITY_ARTIFACT_DIR ?? `${PARITY_ROOT}artifacts`;

const HEX64 = /^[0-9a-f]{64}$/;

/** `route | brand | sha256` → `route\u0000brand` → sha256. Comments and blank lines are ignored. */
async function readManifest(): Promise<Map<string, string>> {
  const text = await readFile(MANIFEST, "utf8");
  const map = new Map<string, string>();
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const [route, brand, sha] = trimmed.split("|").map((part) => part.trim());
    if (route === undefined || brand === undefined || sha === undefined || !HEX64.test(sha)) {
      throw new Error(`manifest.txt: cannot read "${trimmed}" — expected "route | brand | sha256"`);
    }
    map.set(`${route}\u0000${brand}`, sha);
  }
  return map;
}

async function readSummary(brand: string, slug: string): Promise<string | undefined> {
  try {
    return await readFile(`${SUMMARIES}/${brand}/${slug}.txt`, "utf8");
  } catch {
    return undefined;
  }
}

function hash(document: string): string {
  return createHash("sha256").update(document, "utf8").digest("hex");
}

/** Every route this process computed, in `routes.ts` order — the manifest fragment `parity.mjs` merges. */
const computed: { route: string; brand: string; sha: string }[] = [];

/**
 * Does this route answer 404 right now?
 *
 * Only asked for a route that declares `disabledByFlag` in `routes.ts`, and only Next's own
 * not-found counts: any other throw (a fixture that stopped resolving, a render error) propagates
 * and fails the run, which is the guard that keeps a broken page from being pinned as "absent".
 */
async function rendersNotFound(route: ParityRoute): Promise<boolean> {
  try {
    await renderRoute(route.page, route.params, route.route);
    return false;
  } catch (error) {
    const digest = (error as { digest?: unknown }).digest;
    return typeof digest === "string" && digest.startsWith("NEXT_HTTP_ERROR_FALLBACK;404");
  }
}

type Artifact = { document: string; summary: string; extension: string };

/**
 * Write the render (or the declared 404) that failed, so the failure is diagnosable from the CI
 * artifact rather than only from a 64-character hash. Both paths are named in the assertion
 * message; the summary is the same text the committed file carries.
 */
async function writeArtifacts(brand: string, slug: string, artifact: Artifact): Promise<string[]> {
  await mkdir(`${ARTIFACTS}/${brand}`, { recursive: true });
  const documentFile = `${ARTIFACTS}/${brand}/${slug}.${artifact.extension}`;
  const summaryFile = `${ARTIFACTS}/${brand}/${slug}.summary.txt`;
  await writeFile(documentFile, artifact.document, "utf8");
  await writeFile(summaryFile, artifact.summary, "utf8");
  return [documentFile, summaryFile];
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
    it(`${route.route} — ${brand}`, async () => {
      freezeClock();

      let artifact: Artifact;

      if (route.disabledByFlag !== undefined) {
        // A surface that is off (#175). The two halves of the claim are asserted separately:
        // the flag resolver says off, and the page really throws `notFound()` — a page that
        // silently rendered an empty shell would pass a hash comparison and fail a user.
        const flag = route.disabledByFlag;
        expect(
          isEnabled(flag),
          `${brand} ${route.route}: data/flags.ts now has "${flag}" on, so the route renders ` +
            "again — drop `disabledByFlag` from tests/parity/routes.ts and run " +
            '`pnpm parity:update --reason "…"` so the hash pins the page instead of the 404',
        ).toBe(false);

        expect(
          await rendersNotFound(route),
          `${brand} ${route.route} declares disabledByFlag "${flag}" but the route rendered — ` +
            "either the page stopped honouring the flag (a defect) or the declaration is stale",
        ).toBe(true);

        const absent = absentRender(route.route, brand, flag);
        artifact = { ...absent, extension: "txt" };
      } else {
        const html = await renderRoute(route.page, route.params, route.route);
        expect(html).toContain(NAMES[brand].own);
        expect(html).not.toContain(NAMES[brand].other);

        // The same tree rendered twice must produce the same bytes. Without this the manifest is
        // a flaky comparison, and the failure would be blamed on the next honest commit instead of
        // on the clock: `/quiz/[id]` is the route that reads it, which is `freezeClock()`'s job.
        const document = normalize(html);
        expect(normalize(await renderRoute(route.page, route.params, route.route))).toBe(document);

        artifact = {
          document,
          summary: summarize(document, route.route, brand),
          extension: "html",
        };
      }

      const sha = hash(artifact.document);
      computed.push({ route: route.route, brand, sha });

      const summaryFile = `${SUMMARIES}/${brand}/${route.slug}.txt`;

      if (UPDATE) {
        await mkdir(dirname(summaryFile), { recursive: true });
        await writeFile(summaryFile, artifact.summary, "utf8");
        console.log(`updated  ${brand} ${route.route} ${sha.slice(0, 12)}`);
        return;
      }

      const committed = await readManifest();
      const expected = committed.get(`${route.route}\u0000${brand}`);

      if (expected === undefined) {
        const [documentFile] = await writeArtifacts(brand, route.slug, artifact);
        throw new Error(
          `${brand} ${route.route} has no line in tests/parity/manifest.txt (computed ${sha}). ` +
            `Run \`pnpm parity:update --reason "…"\` and say in the PR which routes moved and why. ` +
            `Render: ${documentFile}`,
        );
      }

      if (expected !== sha) {
        const [documentFile, summaryArtifact] = await writeArtifacts(brand, route.slug, artifact);
        expect(
          sha,
          `${brand} ${route.route} drifted: rendered ${sha}, manifest says ${expected}. ` +
            `A rendered byte changed. If it is intended, run \`pnpm parity:update --reason "…"\` ` +
            `and say in the PR which routes moved and why; if it is not, this is the bug. ` +
            `Render: ${documentFile} · summary: ${summaryArtifact}`,
        ).toBe(expected);
      }

      const committedSummary = await readSummary(brand, route.slug);
      expect(
        committedSummary,
        `${brand} ${route.route} has a matching hash but no committed summary — run ` +
          `\`pnpm parity:update --reason "…"\` (the summary is generated from the same render)`,
      ).toBeDefined();

      expect(
        artifact.summary,
        `${brand} ${route.route} renders the same bytes as the manifest but its summary ` +
          `(headings, landmarks, links, counts) is stale — run \`pnpm parity:update --reason "…"\``,
      ).toBe(committedSummary);
    });
  }

  /**
   * The fragment `scripts/parity.mjs` merges into `manifest.txt` after both brands have run: one
   * process can only speak for its own brand, and the merged file is written once, by the caller,
   * so two processes can never race on it.
   */
  afterAll(async () => {
    await mkdir(ARTIFACTS, { recursive: true });
    const lines = computed.map((entry) => `${entry.route} | ${entry.brand} | ${entry.sha}`);
    await writeFile(`${ARTIFACTS}/manifest.${brand}.txt`, `${lines.join("\n")}\n`, "utf8");
  });
});
