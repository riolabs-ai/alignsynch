/**
 * The recorded demo flow, as the page consumes it — **types only, no runtime**.
 *
 * `docs/qa-demo-flow/transcript.json` is written by `pnpm demo:flow` (`scripts/demo-flow.mjs`) and
 * its shape belongs to that script: the file's own `$doc` block is the schema, and this module is a
 * reader's view of it, never a second definition. A field this page does not need is not modelled
 * here; a field the script adds lands in `values` as a key the page renders verbatim.
 *
 * **Why the types are their own module.** The reader (`lib/demo-flow/transcript.ts`) imports `node:fs`
 * and `zod`; the stepper is a client component and may not value-import either. It imports these
 * types with `import type`, which is erased at build, so the props cross the boundary as plain JSON
 * (E34 walks that graph and fails a value import).
 */

/** The three paths the walk covers. A state, not a happy path. */
export type DemoFlowPathName = "create-published" | "create-draft" | "unpaid";

/** What the walk did at a step: typed into a form, pressed a control, or read the screen. */
export type DemoFlowAction = "fill" | "click" | "assert";

/** One value the persona entered, verbatim, with the transcript's own key for it. */
export interface DemoFlowValue {
  /** The transcript's key (`title`, `counterpartyFirst`, …) — a handle, not a sentence. */
  key: string;
  /** What was entered. Committed as the run wrote it, including `<DEMO_PIN>` normalisation. */
  value: string;
}

/** One screen: what happened, what was entered, and the image the run captured. */
export interface DemoFlowStep {
  /** 1..n, contiguous across the three paths — the transcript's own numbering. */
  step: number;
  path: DemoFlowPathName;
  /** Where it happened, with run-specific ids already normalised to `<instance>` / `<token>`. */
  route: string;
  action: DemoFlowAction;
  values: DemoFlowValue[];
  /** The assertion this step proved, in the run's words — also the image's accessible name. */
  expect: string;
  /** Whether it held. `false` is a finding the page must not smooth over. */
  ok: boolean;
  /** The served URL of the committed screenshot, and its intrinsic size. */
  shot: { src: string; width: number; height: number };
}

/** One path: the screens it ran through, and whether it reached the last one. */
export interface DemoFlowPath {
  path: DemoFlowPathName;
  /** The screen the path must end on, in the run's words. */
  terminal: string;
  reached: boolean;
  steps: DemoFlowStep[];
}

/** Behaviour the walk met that was not the driver's to fix — a report, never a failure. */
export interface DemoFlowFinding {
  n: number;
  path: DemoFlowPathName;
  title: string;
  expected: string;
  actual: string;
  note: string | null;
  /** The screen the finding was seen on, served like a step's, or none if it was not a screen. */
  shot: { src: string; width: number; height: number } | null;
}

/** What the run did about the demo dataset, and what it left behind. */
export interface DemoFlowRun {
  /** The commit-time facts the page prints as its strip: three paths, N steps, N findings. */
  paths: number;
  steps: number;
  findings: number;
  /** Records and relationships the run created and then removed — 0 on a clean run. */
  leftBehind: number;
  /** Whether the branch's row counts were identical before and after the walk. */
  unchanged: boolean;
}

/** The whole replay, resolved once per request. */
export interface DemoFlow {
  /** Every screenshot the transcript names, as a repo-relative path — the only files served. */
  shots: readonly string[];
  paths: readonly DemoFlowPath[];
  findings: readonly DemoFlowFinding[];
  run: DemoFlowRun;
}
