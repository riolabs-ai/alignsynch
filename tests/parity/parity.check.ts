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
import { quizOnlyRoutes } from "./boundary";
import { absentRender, summarize } from "./summary";
import { QUIZ_PRODUCT_FLAG, quizProductShipped } from "@/lib/brand-boundary";
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

/**
 * Anything the boundary assertion can render: a page, its concrete params and the pattern it is
 * printed under. Both `ParityRoute` and `QuizOnlyRoute` satisfy it, so one helper serves the
 * snapshot loop and the boundary loop.
 */
type GateTarget = {
  readonly page: import("./routes").ParityPage;
  readonly params: Record<string, string>;
  readonly route: string;
};

/**
 * What a gated route answers on this brand, for the boundary assertion (#300).
 *
 * Three outcomes, and the difference between the last two is the whole test:
 *
 *   `"404"`       the page threw Next's not-found — the surface is closed on this brand.
 *   `"render"`    the page produced a tree — the surface is open. (Whether the HTML is *right* is
 *                 the snapshot's question, for the routes it covers, and `next build`'s for the
 *                 rest; this assertion is about the boundary, not the page.)
 *   `"error: …"`  the page threw something else. Reported rather than swallowed, because "it did
 *                 not answer 404" and "it rendered" are not the same claim and a test that
 *                 conflates them would pass over a broken page.
 */
async function answerOf(target: GateTarget): Promise<string> {
  try {
    await renderRoute(target.page, target.params, target.route);
    return "render";
  } catch (error) {
    const digest = (error as { digest?: unknown }).digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_HTTP_ERROR_FALLBACK;404"))
      return "404";
    return `error: ${error instanceof Error ? error.message : String(error)}`;
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

      /**
       * Is this route on the brand boundary (#300)? `/quiz/[id]` is: it is one of the seven
       * snapshot routes **and** quiz-only, so on a build that does not ship the quiz product its
       * committed artifact is the declared 404 rather than a render. The check is the flag's own
       * answer, not the brand's name, so `FLAG_PRODUCT_QUIZ_SURFACES=1` on the alignment build
       * falls through to the render branch exactly as the route itself would.
       */
      const onQuizBoundary = quizOnlyRoutes.some((entry) => entry.route === route.route);
      const closedByBrand = onQuizBoundary && !quizProductShipped();

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
      } else if (closedByBrand) {
        // The brand boundary (#300). One claim, and it is the one that can fail: the surface
        // exists and this brand does not ship it, so the page must answer not-found. A page that
        // renders here is a page that forgot `requireQuizProduct()`.
        expect(
          await rendersNotFound(route),
          `${brand} ${route.route} is a quiz-only route and this build does not ship the quiz ` +
            "product, but the route rendered — the page does not call `requireQuizProduct()` " +
            "(lib/brand-boundary.ts) before it reads",
        ).toBe(true);

        const absent = absentRender(route.route, brand, QUIZ_PRODUCT_FLAG, "brand");
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
   * The brand boundary (#300) — what the harness never asked, and the reason fifty-two statements
   * about quizzes were served under the AlignSynch name.
   *
   * The seven routes above are a *snapshot*: they pin what a page renders. This block is a
   * *status*: for every route the quiz product owns, does this brand serve it at all. The two
   * questions are complementary — a hash cannot answer the second one, because both brands used
   * to render the same page.
   *
   * The list lives in `boundary.ts` and is the same list the card's route decision names, so a
   * route joining the product joins one file. `/quiz/[id]` is in both: this block asks whether the
   * route is open, the snapshot loop above pins what it renders when it is (and pins its declared
   * 404 on the brand that does not ship it).
   */
  describe("quiz product boundary", () => {
    /**
     * The list's premise, stated once: if the brand this process resolved disagrees with what the
     * gate says, every assertion below is either vacuous or wrong on one of the two runs.
     */
    it(`the quiz product is ${brand === "quizhub" ? "shipped" : "not shipped"} by this brand`, () => {
      expect(quizProductShipped()).toBe(brand === "quizhub");
    });

    for (const route of quizOnlyRoutes) {
      it(`${route.route} — ${brand}`, async () => {
        freezeClock();
        /**
         * Flags other cards use to close this same surface (#291's `commerce.affiliate` on
         * `/affiliate`) are opened for the duration of the case, so the answer measured is the
         * brand gate's rather than a mock flag's. Without this, a route that two flags close would
         * assert "404 on alignsynch" for the wrong reason and "render on quizhub" would fail.
         */
        for (const flag of route.openFlags ?? []) {
          vi.stubEnv(`FLAG_${flag.replace(/[.-]/g, "_").toUpperCase()}`, "1");
        }

        const answer = await answerOf(route);
        vi.unstubAllEnvs();

        if (brand === "quizhub") {
          /**
           * The quiz brand ships the product, so the route must be **open**. `"render"` rather
           * than "not a 404": a page that threw for some other reason has not shown that it
           * serves the surface, and that distinction is the difference between this test and a
           * test that passes over a broken page.
           *
           * The one exception is documented rather than forgiven: `/dashboard/user` resolves a
           * session, and this process has no auth environment — the shell's own layout renders
           * signed-out here for the same reason (`harness.ts`). Its gate is still asserted on the
           * alignment brand, and its 200 is on the `curl` table the PR carries.
           */
          if (route.route === "/dashboard/user") {
            expect(
              answer,
              `${brand} ${route.route}: this brand ships the quiz product, so the route must not ` +
                `answer 404 — got ${answer}.`,
            ).not.toBe("404");
            return;
          }

          expect(
            answer,
            `${brand} ${route.route}: this brand ships the quiz product, so the route must be ` +
              `open — got ${answer}. A 404 here means the page's gate closed on the brand that ` +
              "sells the surface (data/flags.ts's `templates`, or the helper's flag name).",
          ).toBe("render");
        } else {
          /**
           * The alignment brand does not ship it, so every one of these must answer Next's
           * not-found — the same 404 an unknown URL gets, not a 403 and not an empty shell. This
           * is the assertion the card's deliberate un-gate breaks: remove `requireQuizProduct()`
           * from any page below and exactly that line goes red.
           */
          expect(
            answer,
            `${brand} ${route.route}: this brand does not ship the quiz product, so the route ` +
              `must answer 404 via ${QUIZ_PRODUCT_FLAG} — got ${answer}. The page's first ` +
              "statement is missing `requireQuizProduct()` (lib/brand-boundary.ts).",
          ).toBe("404");
        }
      });
    }
  });

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
