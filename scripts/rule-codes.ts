/**
 * The rule-code registry — one code, one rule.
 *
 * `data:check` prints findings as `[E14] …`, and the whole point of the number is
 * that it names exactly one invariant: a log line, a doc table row and a negative
 * case all have to mean the same thing by it. That property was violated once —
 * `E17` was the media registry's "no component writes a `public/` asset path"
 * (PR #65) and, at the same time, the promotion slot guard added by PR #41 — so
 * `grep '[E17]'` could not say which rule fired, and a doc table could only record
 * the collision instead of describing a rule. Issue #103 renumbered the slot guard
 * to `E28`.
 *
 * This file is the fix that outlives the incident: every code is declared **once**,
 * under exactly one owner, together with the modules allowed to name it. The checks
 * that read it live in `scripts/__tests__/rule-codes.test.ts`, which scans
 * `scripts/*.ts` and fails when
 *
 *   - two owners declare the same code (the `E17` collision),
 *   - a module emits a code another owner's module was declared for,
 *   - a code is emitted that nobody declared,
 *   - or a declared code is emitted nowhere (a rename that forgot a site).
 *
 * It earned its keep on the day it landed: the scan found a **second** collision
 * already on `main` — `E27` was the battle-mode rule (`scripts/mode-invariants.ts`,
 * PR #92) and, from PR #99, the next/image size rule in `scripts/data-check.ts`.
 * The image rule moved to `E29`, by the same rule as the first: the later claim
 * yields and takes the next free code.
 *
 * The extraction (`codeMentions`) and the rules (`ruleCodeProblems`) are pure and
 * take their input as arguments, so the negative cases exercise them without a
 * filesystem — the same split as `scripts/ui-refs.ts`.
 */

/** One owner and the codes it mints. */
export interface RuleCodeGroup {
  /** Who owns the codes, in the words a reviewer checks the validator against. */
  readonly owner: string;
  /** The `scripts/` modules allowed to name these codes, relative to `scripts/`. */
  readonly files: readonly string[];
  /** Code → what it means, one line each. */
  readonly codes: Readonly<Record<string, string>>;
}

/** A quoted code literal found in a source file. */
export interface CodeMention {
  readonly code: string;
  /** Path relative to `scripts/`, e.g. `data-check.ts`. */
  readonly file: string;
  /** 1-based line in the source. */
  readonly line: number;
}

/**
 * Every diagnostic code `data:check` can print. Adding a rule means adding its code
 * to the one group that owns it — and adding a negative case, because a rule nobody
 * can violate in a test is a comment.
 */
export const RULE_CODE_GROUPS: readonly RuleCodeGroup[] = [
  {
    owner: "collection rules in scripts/data-check.ts (schema, identity, joins, routes)",
    files: ["data-check.ts"],
    codes: {
      E0: "per-record schema — every record parses, every object strict",
      E1: "ids unique across the four content kinds and the category table",
      E2: "`kind/slug` unique — a slug is URL identity",
      E3: "question ids unique across quizzes; `selectQuizCard()` output parses",
      E4: "category scope: a record only references its own vocabulary",
      E5: "contact refs, notification links and icon keys resolve",
      E6: "conversation → contact refs resolve",
      E7: "`content/routes.ts` and `app/` agree in both directions",
      E8: "every search row names a real quiz / category / curated page",
      E9: "one `Quiz` type: `content/quiz.ts` exists, no module re-declares it",
      E10: "dead metadata exports, and every literal `href` / `public/` asset in `components/**` + `app/**` resolves",
      E11: "every shelf id resolves to a record; authoring-card projections parse",
      E12: "one record per subject: no two records share a normalised title",
      E13: "every analytics key names a record",
      E20: "no component types a label the model already owns",
      E21: "no module-scope record arrays or fixture text pasted into the bound surfaces",
      E22: "no metric literal — a rendered quantity comes from a `MetricSnapshot`",
      E25: "the metrics fixture is honest: keys resolve, tables add up",
      E26: "`data/generated/` holds quizzes only, and they load",
      W1: "a published record with no questions",
      W2: "a published record with no `publishedAt`",
      W3: "a quiz category tile the app cannot draw, or a generated default no category owns",
      W4: "a reward with no limited-time window",
      W5: "a browse record no shelf renders (dead card)",
    },
  },
  {
    owner: "the media registry (PR #65)",
    files: ["data-check.ts"],
    codes: {
      E17: "no `components/**` or `app/**` file writes a `public/` asset path — read `data/media.ts`",
      E18: "registry ⇄ disk is a bijection, and the map's own keys and dimensions hold",
      E19: "every fixture `ImageRef.src` equals a registry `src`",
    },
  },
  {
    owner: "the promotion overlays (B-01, issue #27; slot guard renumbered by issue #103)",
    files: ["data-check-promotions.ts"],
    codes: {
      E14: "every `promotions[].quizId` resolves; `id` and `(quizId, slot)` are unique; content keys are rejected",
      E15: "the window and the prize: `endsAt > startsAt`, a slot window never extends the catalog's, a prize is bounded",
      E16: "concurrent overlays for one quiz agree on every engagement key they both set",
      E28: "every `promotions[].slot` parses, indexes a position a shelf renders, and that position renders the overlay's quiz",
      E30: "every promotion's window covers the fixture clock (`startsAt <= DEMO_NOW_ISO < effective end`) — an overlay that is never live renders nowhere",
      W6: "a campaign staged outside the quiz's published life",
    },
  },
  {
    owner: "page copy (WU-9)",
    files: ["copy-refs.ts"],
    codes: {
      E23: "no copy literal on a migrated route — copy lives in `data/pages/` and only goes down in budget",
    },
  },
  {
    owner: "people, leaderboards and quiz activity (WU-1 / WU-2)",
    files: ["data-check-people.ts", "data-check.ts"],
    codes: {
      E24: "the people/leaderboard/activity fixtures resolve: ids, ranks, orderings and instants",
    },
  },
  {
    owner: "battle modes and daily-challenge rewards (WU-10)",
    files: ["mode-invariants.ts"],
    codes: {
      E27: "a mode is a record the page renders: ids, ranges and wiring match the surfaces",
    },
  },
  {
    owner: "the next/image size rule (WU-11, PR #99 — renumbered by issue #103)",
    files: ["data-check.ts"],
    codes: {
      E29: "every `<Image>` has exactly one size source, and never `fill` beside `width`/`height`",
    },
  },
  {
    owner: "the record model — one record type, two templates (issue #128)",
    files: ["data-check.ts"],
    codes: {
      E31: "an assessment instance names a template that exists, and its Aspects are that template's Aspects — a copy that drifted is not a copy",
      E32: "the committed demo bundle is the canonical export of `data/assessments.ts`",
      E33: "an imported tenant store parses, and the active assessment set passes E0/E1/E2/E31 against itself",
    },
  },
  {
    owner: "the client/server import boundary (scripts/client-graph.ts — issue #228)",
    // Two files for the same reason the bundle group has two: the code is *minted* where the
    // rule lives (a finding carries `rule: "E34"`), and `data-check.ts` mints it once more for
    // the coverage guard — "the walk read 0 client entries" is a failure of the same rule.
    files: ["client-graph.ts", "data-check.ts"],
    codes: {
      E34: 'no `"use client"` module reaches a server-only module (`lib/db/**`, `pg`, a Node builtin) — the browser graph cannot load it and the route 500s at request time',
    },
  },
  {
    owner: "bundle import/export (scripts/bundles.ts, content/bundle.ts — issue #147)",
    // Two files, because the refusal is authored in the model and raised by the CLI: the
    // codes are *minted* where the rule lives (`content/bundle.ts` detects B1–B4/B6) and B5
    // is the one the CLI mints, because a bundle cannot collide with a store it does not
    // know. Declaring both keeps "one code, one owner" true without pretending the model
    // module is a script.
    files: ["bundles.ts", "../content/bundle.ts"],
    codes: {
      B1: "envelope shape — not one JSON object, a bad `format`/`kind`/`appVersion`, an unknown top-level key",
      B2: "payload record — a `zAssessment` / `zAssessmentInstance` issue, or an unknown key on one, path included",
      B3: "dataset collection — an id or a slug twice, a `templateId` outside the bundle, or a copy that drifted",
      B4: "forbidden key — a key that names a credential (`token`, `secret`, `password`, `apiKey`, `key`), wherever it sits",
      B5: "a template import colliding with the active store's id or `type/slug` — the import refuses rather than rewriting",
      B6: "`bundleVersion` — this build reads exactly 1",
    },
  },
];

/**
 * A quoted code literal — the shape every emit site uses, the first argument of
 * `err()` / `error()` / `warn()` / `formatBundleIssue()`.
 *
 * `B*` is the bundle group (#147): those codes are minted in `content/bundle.ts`, which the
 * registry scans alongside `scripts/*.ts` (see `scripts/__tests__/rule-codes.test.ts`), so
 * the same one-code-one-rule property holds for a refusal a person reads as `[B4] …`.
 */
const CODE_LITERAL = /"(E[0-9]+|W[0-9]+|B[0-9]+)"/g;

/**
 * Every quoted code literal in the given sources. Comment lines — a leading `//`,
 * or a block opener `*` / slash-star — are skipped: a comment may name a code in
 * prose, which is not an emit site.
 */
export function codeMentions(sources: readonly { file: string; source: string }[]): CodeMention[] {
  const mentions: CodeMention[] = [];
  for (const { file, source } of sources) {
    source.split("\n").forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*")) {
        return;
      }
      for (const match of line.matchAll(CODE_LITERAL)) {
        mentions.push({ code: match[1], file, line: index + 1 });
      }
    });
  }
  return mentions;
}

/**
 * The registry's own invariants, as problems instead of throws so the negative cases
 * can assert the message a real violation produces.
 */
export function ruleCodeProblems(
  groups: readonly RuleCodeGroup[],
  mentions: readonly CodeMention[],
): string[] {
  const problems: string[] = [];
  const owners = new Map<string, string[]>();
  /** `data-check.ts` → `scripts/data-check.ts`; a model module keeps its own path. */
  const sourceName = (file: string): string =>
    file.startsWith("../") ? file.slice(3) : `scripts/${file}`;

  for (const group of groups) {
    for (const code of Object.keys(group.codes)) {
      owners.set(code, [...(owners.get(code) ?? []), group.owner]);
    }
  }

  for (const [code, claimants] of owners) {
    if (claimants.length > 1) {
      problems.push(
        `${code} is claimed by ${claimants.length} owners (${claimants.join(" / ")}) — one code must name one rule, so the later claim takes the next free code`,
      );
    }
  }

  const declaredFiles = new Map<string, { owners: string[]; files: string[] }>();
  for (const group of groups) {
    for (const code of Object.keys(group.codes)) {
      const entry = declaredFiles.get(code) ?? { owners: [], files: [] };
      // Union on purpose: a code two owners claim is first and foremost a collision,
      // so its emit sites must not also be reported as foreign files. Duplicate
      // owners are reported once, above.
      entry.owners = [...entry.owners, group.owner];
      entry.files = [...new Set([...entry.files, ...group.files])];
      declaredFiles.set(code, entry);
    }
  }

  for (const mention of mentions) {
    const declared = declaredFiles.get(mention.code);
    if (declared === undefined) {
      problems.push(
        `${sourceName(mention.file)}:${mention.line} emits "${mention.code}", which no rule-code group declares — add it to scripts/rule-codes.ts with its owner`,
      );
      continue;
    }
    if (!declared.files.includes(mention.file)) {
      problems.push(
        `${sourceName(mention.file)}:${mention.line} emits "${mention.code}", which belongs to ${declared.owners.join(" / ")} (${declared.files.map(sourceName).join(", ")}) — a second rule cannot share the code`,
      );
    }
  }

  const emitted = new Set(mentions.map((mention) => mention.code));
  for (const [code, claimants] of owners) {
    if (!emitted.has(code)) {
      problems.push(
        `scripts/rule-codes.ts declares "${code}" (${claimants.join(" / ")}), but no emit site names it — a rename that missed a site, or a code that was retired without the row`,
      );
    }
  }

  return problems;
}
