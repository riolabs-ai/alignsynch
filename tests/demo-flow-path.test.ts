/**
 * The recorded walk `/how-it-works` replays is joined to the page by a path constant, and nothing
 * checked that constant against the tree.
 *
 * That is how PR #996 shipped red **and** broken. `lib/demo-flow/transcript.ts` said
 * `docs/qa-demo-flow`; #965 (`d50b2f30`) had moved the walk to `docs/qa/demo-flow/`. The transcript
 * exists, the reader exists, and nothing joined them — so the page answered with its own
 * `could not be read: ENOENT` message and three assertions in `tests/how-it-works-auth.test.ts`
 * failed on a path, not on a behaviour.
 *
 * **The second half is the one the gate cannot see.** `next.config.mjs`'
 * `outputFileTracingIncludes` carries the same directory for `/how-it-works` and
 * `/qa-demo-flow/[...shot]`, because the path is a constant the build-time tracer cannot follow.
 * A glob naming a directory that no longer exists does not fail the build — it traces nothing. So
 * `pnpm build` stays green, the gate stays green, and the deployed page 500s on its first request
 * because neither the transcript nor its 55 PNGs made it into the output. A test that checked only
 * the constant would have left that in place; the cases below check both halves against each other,
 * which is the pair that has to agree.
 *
 * **Nothing here asserts a byte of the recording.** Whether the walk is *fresh* is
 * `pnpm demo:flow:check`'s question, and what the transcript says about itself is
 * `pnpm demo:flow:verify`'s. This file answers one question, the one no other check asks: does the
 * path the code names exist, and does the build trace the same directory it reads?
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import nextConfig from "@/next.config.mjs";
import { DEMO_FLOW_DIR, DEMO_FLOW_TRANSCRIPT, readDemoFlow } from "@/lib/demo-flow/transcript";

const ROOT = process.cwd();

/** The two routes that read the recording — one the page, one the screenshots it names. */
const DEMO_FLOW_ROUTES = ["/how-it-works", "/qa-demo-flow/[...shot]"] as const;

/** `next.config.mjs`'s tracing table, or a readable failure when the block has been renamed. */
function tracedPathsFor(route: string): string[] {
  const includes = (
    nextConfig as unknown as { outputFileTracingIncludes?: Record<string, string[] | undefined> }
  ).outputFileTracingIncludes;

  expect(includes, "next.config.mjs carries no `outputFileTracingIncludes`").toBeDefined();

  const traced = includes?.[route];
  expect(traced, `${route} is not named in \`outputFileTracingIncludes\``).toBeDefined();
  return traced ?? [];
}

/**
 * `./docs/qa/demo-flow/**\/*.png` → `docs/qa/demo-flow`.
 *
 * The part before the first `*` is the part a tracer needs to exist: a glob whose base is missing
 * matches nothing and reports nothing, which is the whole failure mode this file is about.
 */
function tracedBase(glob: string): string {
  const relative = glob.replace(/^\.\//, "");
  const wildcard = relative.indexOf("*");
  const base = wildcard === -1 ? relative : relative.slice(0, wildcard);
  return base.replace(/\/+$/, "");
}

describe("the constant does resolve to the tree", () => {
  it("DEMO_FLOW_DIR names a directory that exists", () => {
    const dir = join(ROOT, DEMO_FLOW_DIR);

    // A path constant no test checks is how #996 shipped: the walk existed, the reader existed,
    // and the page rendered "could not be read: ENOENT" at the first request.
    expect(
      existsSync(dir),
      `DEMO_FLOW_DIR is "${DEMO_FLOW_DIR}", which does not exist under ${ROOT} — the recorded walk ` +
        "was moved and this reader was not (see docs/qa/demo-flow/)",
    ).toBe(true);
    expect(statSync(dir).isDirectory()).toBe(true);
  });

  it("carries the transcript the reader parses", () => {
    expect(existsSync(join(ROOT, DEMO_FLOW_TRANSCRIPT))).toBe(true);

    // Parsed through the real reader: a directory that exists but no longer holds a transcript the
    // schema accepts is the same defect one step later.
    const recording = readDemoFlow();
    expect(recording.paths.length).toBe(3);
    expect(recording.paths[0]?.steps.length).toBeGreaterThan(0);
  });

  it("carries a PNG on disk for every shot the transcript names", () => {
    const { shots } = readDemoFlow();

    expect(shots.length).toBeGreaterThan(0);

    const missing = shots.filter((shot) => !existsSync(join(ROOT, DEMO_FLOW_DIR, shot)));
    // Named, not counted: the useful failure is the path, not the number.
    expect(
      missing,
      `the transcript names shots that are not committed: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("is not also reachable at the directory the move retired", () => {
    const retired = join(ROOT, "docs", "qa-demo-flow");

    // Two locations is worse than either: a reader that still works from the old path is a second
    // copy nobody re-records, and the next move would leave it behind silently.
    expect(
      existsSync(retired),
      "docs/qa-demo-flow exists again — the walk lives at docs/qa/demo-flow since #965 and must not " +
        "have a second home",
    ).toBe(false);
  });
});

describe("the build traces the directory the reader reads", () => {
  for (const route of DEMO_FLOW_ROUTES) {
    it(`${route} traces into DEMO_FLOW_DIR`, () => {
      const traced = tracedPathsFor(route);

      expect(traced.length).toBeGreaterThan(0);

      for (const glob of traced) {
        const base = tracedBase(glob);

        // The pairing this file exists for: the config names the directory the constant names.
        expect(
          base === DEMO_FLOW_DIR || base.startsWith(`${DEMO_FLOW_DIR}/`),
          `${route} traces "${glob}", which is outside DEMO_FLOW_DIR ("${DEMO_FLOW_DIR}") — the ` +
            "build would carry a directory the reader never opens",
        ).toBe(true);

        // …and the directory it names has to exist, or the glob traces nothing and says nothing.
        expect(
          existsSync(join(ROOT, base)),
          `${route} traces "${glob}", whose path does not exist — a tracing glob with no directory ` +
            "behind it stays green in `next build` and 500s the page at the first request",
        ).toBe(true);
      }
    });
  }

  it("names the transcript itself, not only its neighbours", () => {
    const traced = DEMO_FLOW_ROUTES.flatMap((route) => tracedPathsFor(route)).map(tracedBase);

    expect(traced).toContain(DEMO_FLOW_TRANSCRIPT);
  });

  it("covers every committed PNG, which is what the `**/*.png` glob is for", () => {
    const glob = DEMO_FLOW_ROUTES.flatMap((route) => tracedPathsFor(route)).find((entry) =>
      entry.endsWith("**/*.png"),
    );

    expect(
      glob,
      "no route traces `**/*.png` — the 55 screenshots would not be in the output",
    ).toBeDefined();

    // The glob's base is the directory, and the screenshots are its subdirectories.
    const base = tracedBase(glob ?? "");
    const pngs = readdirSync(join(ROOT, base), { recursive: true, withFileTypes: true }).filter(
      (entry) => entry.isFile() && entry.name.endsWith(".png"),
    );

    expect(pngs.length).toBe(readDemoFlow().shots.length);
  });
});
