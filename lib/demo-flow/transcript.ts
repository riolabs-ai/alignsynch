/**
 * `/how-it-works` reads the recorded demo flow (#898 card 2).
 *
 * The recording is `docs/qa/demo-flow/transcript.json`, written by `pnpm demo:flow`
 * (`scripts/demo-flow.mjs`) and kept honest by `pnpm demo:flow:check`. This module is the page's
 * reader: it parses that file through the shape the file's own `$doc` block documents, resolves the
 * paths/steps/findings the stepper renders, and answers the one question a screenshot needs — where
 * the committed file is, and how big it is.
 *
 * **The transcript owns the shape; this module does not re-invent it.** The zod schema below models
 * exactly the fields a reader consumes, strips what it does not (`$doc`, `base`, `seed`, the per-step
 * `sha256`), and fails loudly on a field it needs and does not get. Nothing here writes the file, and
 * nothing here recomputes a step: a page that derived its own idea of the flow would be the drift the
 * check exists to prevent.
 *
 * **Read at request time, not build time.** `/how-it-works` is `force-dynamic` (the session is
 * per-request), so `pnpm build` with no database and no auth env never calls `readDemoFlow()` — the
 * same reason the gate has never needed a connection. `outputFileTracingIncludes` in
 * `next.config.mjs` names the directory, because the path is a constant the build-time tracer cannot
 * follow, exactly as `/admin/review` names `docs/review/`.
 *
 * **The screenshots are served, never re-captured.** `app/qa-demo-flow/[...shot]/route.ts` reads the
 * committed PNG by the relative path this module hands it, and answers 404 for any path the
 * transcript does not name — so the images on the page are the bytes the run wrote, and a request for
 * the page never drives a browser.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { z } from "zod";

import type { DemoFlow, DemoFlowFinding, DemoFlowPath, DemoFlowStep } from "./types";

/** The committed recording, relative to the repository root. */
export const DEMO_FLOW_DIR = "docs/qa/demo-flow";

/** The transcript itself — the one file the page's steps come from. */
export const DEMO_FLOW_TRANSCRIPT = `${DEMO_FLOW_DIR}/transcript.json`;

/** The prefix a served screenshot answers under (`/qa-demo-flow/<path>/<n>-<slug>-1440.png`). */
export const DEMO_FLOW_SHOT_URL = "/qa-demo-flow";

/**
 * The paths the walk covers, as a value the fixture's labels are keyed by. A fourth path is a
 * deliberate change to the driver *and* to `data/pages/how-it-works.ts`; it must not appear as a
 * blank tab here, so the reader refuses it by name instead.
 */
const PATH_NAMES = ["create-published", "create-draft", "unpaid"] as const;

const zPathName = z.enum(PATH_NAMES);

const zAction = z.enum(["fill", "click", "assert"]);

/**
 * One step as the file carries it. `values` is a flat record of what was typed, keyed by the form
 * field the run filled in; `actual` is present only on a step that did not hold.
 */
const zStep = z.object({
  step: z.number().int().positive(),
  path: zPathName,
  route: z.string().min(1),
  action: zAction,
  values: z.record(z.string(), z.string()),
  shot: z.string().min(1),
  expect: z.string().min(1),
  ok: z.boolean(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});

const zPath = z.object({
  path: zPathName,
  terminal: z.string().min(1),
  reached: z.boolean(),
  steps: z.number().int().nonnegative(),
});

const zFinding = z.object({
  n: z.number().int().positive(),
  path: zPathName,
  title: z.string().min(1),
  /** `null` when the finding was not seen on a screen the run captured. */
  shot: z.string().min(1).nullable(),
  expected: z.string().min(1),
  actual: z.string().min(1),
  note: z.string().min(1).nullable(),
});

/** A parsed step, as the file carries it — the reader's input, not the page's shape. */
type RawStep = z.infer<typeof zStep>;

const zTranscript = z.object({
  paths: z.array(zPath).min(1),
  steps: z.array(zStep).min(1),
  findings: z.array(zFinding),
  summary: z.object({
    paths: z.number().int().nonnegative(),
    reached: z.number().int().nonnegative(),
    steps: z.number().int().nonnegative(),
    findings: z.number().int().nonnegative(),
  }),
  cleanup: z.object({
    leftover: z.object({
      records: z.number().int().nonnegative(),
      relationships: z.number().int().nonnegative(),
      sessions: z.number().int().nonnegative(),
    }),
    unchanged: z.boolean(),
  }),
});

/**
 * The one failure the page can meet: the transcript it must read is absent, unparseable, or no
 * longer the shape above. A broken tree rather than an unknown route — so it throws, and the
 * request answers 500 with the reason instead of rendering an empty walkthrough that would read as
 * "the product did nothing".
 */
export class DemoFlowUnreadable extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = "DemoFlowUnreadable";
    this.reason = reason;
  }
}

/** `docs/qa/demo-flow/create-draft/24-….png` → `/qa-demo-flow/create-draft/24-….png`. */
export function demoFlowShotUrl(shot: string): string {
  const prefix = `${DEMO_FLOW_DIR}/`;
  if (!shot.startsWith(prefix)) {
    throw new DemoFlowUnreadable(`transcript names a screenshot outside ${DEMO_FLOW_DIR}: ${shot}`);
  }
  return `${DEMO_FLOW_SHOT_URL}/${shot.slice(prefix.length)}`;
}

/** The absolute path of a committed screenshot, from the relative part the route matched. */
export function demoFlowShotPath(relative: string): string {
  return join(process.cwd(), DEMO_FLOW_DIR, relative);
}

/** One parse per process: the file is committed, so it cannot change under a running server. */
let cached: DemoFlow | null = null;

/**
 * The recording, parsed and resolved into what the stepper renders. Throws `DemoFlowUnreadable`
 * rather than returning a partial: a page that silently dropped the steps it could not read would
 * be a walkthrough nobody can trust.
 */
export function readDemoFlow(): DemoFlow {
  if (cached !== null) return cached;

  let text: string;
  try {
    text = readFileSync(join(process.cwd(), DEMO_FLOW_TRANSCRIPT), "utf8");
  } catch (error) {
    throw new DemoFlowUnreadable(
      `${DEMO_FLOW_TRANSCRIPT} could not be read: ${(error as Error).message} — run \`pnpm demo:flow\` to record the walk`,
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new DemoFlowUnreadable(
      `${DEMO_FLOW_TRANSCRIPT} is not JSON: ${(error as Error).message}`,
    );
  }

  const parsed = zTranscript.safeParse(json);
  if (!parsed.success) {
    throw new DemoFlowUnreadable(
      `${DEMO_FLOW_TRANSCRIPT} is not the shape \`pnpm demo:flow\` writes: ${parsed.error.issues
        .slice(0, 3)
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; ")}`,
    );
  }

  const { paths, steps, findings, summary, cleanup } = parsed.data;

  /** Intrinsic sizes, by shot — a finding names a screen the run already captured. */
  const sizes = new Map(steps.map((step) => [step.shot, { w: step.w, h: step.h }]));

  const byPath = new Map<string, RawStep[]>(PATH_NAMES.map((name) => [name, []]));
  for (const step of steps) byPath.get(step.path)?.push(step);

  const resolveStep = (step: RawStep): DemoFlowStep => ({
    step: step.step,
    path: step.path,
    route: step.route,
    action: step.action,
    values: Object.entries(step.values).map(([key, value]) => ({ key, value })),
    expect: step.expect,
    ok: step.ok,
    shot: {
      src: demoFlowShotUrl(step.shot),
      width: step.w,
      height: step.h,
    },
  });

  const resolvedPaths: DemoFlowPath[] = paths.map((path) => ({
    path: path.path,
    terminal: path.terminal,
    reached: path.reached,
    steps: (byPath.get(path.path) ?? []).map(resolveStep),
  }));

  const resolvedFindings: DemoFlowFinding[] = findings.map((finding) => {
    const size = finding.shot === null ? undefined : sizes.get(finding.shot);
    return {
      n: finding.n,
      path: finding.path,
      title: finding.title,
      expected: finding.expected,
      actual: finding.actual,
      note: finding.note,
      // A shot no step captured has no intrinsic size, and `next/image` refuses to guess one — the
      // finding is still drawn, with its text, and no frame.
      shot:
        finding.shot === null || size === undefined
          ? null
          : { src: demoFlowShotUrl(finding.shot), width: size.w, height: size.h },
    };
  });

  cached = {
    shots: [...sizes.keys()].map((shot) => shot.slice(`${DEMO_FLOW_DIR}/`.length)),
    paths: resolvedPaths,
    findings: resolvedFindings,
    run: {
      paths: summary.paths,
      steps: summary.steps,
      findings: summary.findings,
      leftBehind:
        cleanup.leftover.records + cleanup.leftover.relationships + cleanup.leftover.sessions,
      unchanged: cleanup.unchanged,
    },
  };
  return cached;
}
