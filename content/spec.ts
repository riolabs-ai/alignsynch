/**
 * The project spec's validation register — the model (#1252).
 *
 * **One file, generated, never hand-edited.** `data/spec/validation.json` is the output of
 * `scripts/spec-validation-json.py` over `spec-scope-v2/VALIDATION.csv` (a register that lives
 * outside this repo, because the CSV carries an agreement quote per row). The JSON in the repo is
 * the *quote-free* projection: `quotesIncluded: false` and `quote: null` on every row, which is
 * what makes it publishable from a public repository at all (AS-10).
 *
 * **The schema refuses the private file.** `quotesIncluded` is `z.literal(false)` and `quote` is
 * `z.literal(null)` rather than `string | null`: a JSON-Schema "may be null" is not a rule, and a
 * file written with `--with-quotes` is exactly the file that must never land in a commit. A
 * private copy parses against `data/spec/validation.schema.json`, not against this module.
 *
 * **The counts are derived, never typed.** `specTotalsOf`, `specScopesOf` and `specSectionsOf`
 * are the only source of every figure the page prints — 44 of 76 met, WEB 7/13, 28 / 20 / 13 / 27
 * — so the acceptance line is checkable after an edit to the register instead of copied from a
 * screenshot.
 *
 * **Two vocabularies, two homes.** The *register's*: section order, the six statuses and the four
 * check glyphs, which the JSON carries as data and the schema pins as enums. And the *agreement's*:
 * the eleven story groups in the order the agreement reads, which no row carries — `group` is a
 * label on a row, and the reading order plus the story numbers are a decision the register does
 * not express. `SPEC_STORY_GROUPS` is that decision, and `data:check` E42 holds it equal to the
 * register: every non-Beyond group appears once, and no name is invented.
 *
 * **Pure, and it stays that way.** No React, no `fs`, no credentials: `scripts/data-check.ts`
 * compiles this module under `tsconfig.datacheck.json` and runs it in plain node, so a fixture can
 * be validated without a server. The read is `lib/spec/file.ts`, a different module.
 */
import { z } from "zod";

/* ------------------------------------------------------------------ *
 * The register's vocabulary
 * ------------------------------------------------------------------ */

/**
 * The four sections, in the agreement's order. The index into this array **is** the number the
 * page draws (`1 … 4`), and the enum below is derived from it, so the order cannot drift from the
 * order a row is allowed to name.
 */
export const SPEC_SECTIONS = [
  "Unfinished Work: TBD",
  "Over-Spec Deliverables in v2.0",
  "Under-Spec or Moved to a Future Version",
  "Delivered as Specified",
] as const;

export type SpecSectionName = (typeof SPEC_SECTIONS)[number];

/**
 * The six statuses. `Delivered`, `Over-Delivered` and `Offset` are the three that **count as met**
 * (the gauge's own caption says so, and `SPEC_MET_STATUSES` is the one place that is decided);
 * `Partial` and `Tentative` are open work; `Out of Scope` is a row that is neither.
 */
export const SPEC_STATUSES = [
  "Delivered",
  "Over-Delivered",
  "Partial",
  "Offset",
  "Tentative",
  "Out of Scope",
] as const;

export type SpecStatus = (typeof SPEC_STATUSES)[number];

/** Met = Delivered + Over-Delivered + Offset. One constant, so the gauge and the counts agree. */
export const SPEC_MET_STATUSES: ReadonlySet<SpecStatus> = new Set<SpecStatus>([
  "Delivered",
  "Over-Delivered",
  "Offset",
]);

/**
 * The check glyph the register prints in a row's box: met, partial, open, moved. It is the CSV's
 * own column, so a row states its own mark and the view never infers one from the status.
 */
export const SPEC_CHECKS = ["☑", "◐", "☐", "→"] as const;

export type SpecCheck = (typeof SPEC_CHECKS)[number];

/**
 * The mark a status chip draws before its word — the agreement prototype's own set, not a second
 * spelling of the box glyph: a chip says `★ Over-Delivered` where the box says `☑`. Kept here
 * rather than in a component so a status's appearance is one table, and a status added to the
 * schema is a `tsc` error in this record instead of a chip with no mark.
 */
export const SPEC_STATUS_MARKS: Readonly<Record<SpecStatus, string>> = {
  Delivered: "✓",
  "Over-Delivered": "★",
  Partial: "◐",
  Offset: "⇄",
  Tentative: "◌",
  "Out of Scope": "⊘",
};

/**
 * The row-ID scopes, as the register's ID prefixes: `WEB-08` is a website requirement, `APP-46` a
 * user-app one. The label is what the page prints beside the prefix, and the prefix is the only
 * thing the register carries. `B-01` (Beyond the Agreement) is deliberately absent: those twelve
 * rows are outside the agreement's count and are not a scope.
 */
export const SPEC_SCOPES = [
  { prefix: "WEB", label: "Website" },
  { prefix: "APP", label: "User App" },
  { prefix: "ADMIN", label: "Admin" },
  { prefix: "OPS", label: "Operations" },
] as const;

/**
 * The group the register carries that is **not** a story: twelve rows the build delivered beyond
 * what the agreement asked for. They are in section 2 and they are counted in none of the story
 * figures — which is why the gauge's denominator is 76 and the register's length is 88. The name
 * is a fact of the source file, so it is a constant here; `data:check` E42 fails if the register
 * stops carrying it.
 */
export const SPEC_BEYOND_GROUP = "Beyond the Agreement";

/* ------------------------------------------------------------------ *
 * The agreement's order — the eleven stories
 * ------------------------------------------------------------------ */

/**
 * The eleven story groups, in the order the agreement reads them, as drawn.
 *
 * **This is the one ordering the register cannot answer.** `rows[].group` names a group but no
 * number, and the register's own order is the CSV's — which files `Opinions` last while the
 * agreement reads it fourth, between `Invite` and `Share and Results`. The rail, the overview
 * cards and `/admin/spec/<slug>` all read this table, so the story number a reader sees is the
 * story number in the agreement, not an accident of how the CSV was sorted.
 *
 * `slug` is the `[group]` route segment (`/admin/spec/07-billing`), number-prefixed so a link
 * reads as the story it opens. A slug is a handle, never copy: renaming one moves a URL, so it is
 * changed only with a redirect.
 */
export const SPEC_STORY_GROUPS = [
  { number: "01", slug: "01-play-with-aspects", name: "Play with Aspects" },
  { number: "02", slug: "02-register", name: "Register" },
  { number: "03", slug: "03-invite", name: "Invite" },
  { number: "04", slug: "04-opinions", name: "Opinions" },
  { number: "05", slug: "05-share-and-results", name: "Share and Results" },
  { number: "06", slug: "06-discuss", name: "Discuss" },
  { number: "07", slug: "07-plans-and-billing", name: "Plans and Billing" },
  { number: "08", slug: "08-coaches-and-professionals", name: "Coaches and Professionals" },
  { number: "09", slug: "09-admin", name: "Admin" },
  { number: "10", slug: "10-website", name: "Website" },
  { number: "11", slug: "11-launch-and-operations", name: "Launch and Operations" },
] as const;

export type SpecStoryGroup = (typeof SPEC_STORY_GROUPS)[number];

/** `1 … 6` are the Story half of the rail, `7 … 11` are Around the Story. */
export const SPEC_STORY_LAST_OF_STORY = 6;

/** One story by its route segment, or `undefined` for a segment no story claims. */
export function specStoryOf(slug: string): SpecStoryGroup | undefined {
  return SPEC_STORY_GROUPS.find((group) => group.slug === slug);
}

/* ------------------------------------------------------------------ *
 * The register, as the schema reads it
 * ------------------------------------------------------------------ */

const zIsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "generatedAt is a `YYYY-MM-DD` date");

/** One release column of a row: what v2.0.0 says, then rc2, rc3 and the beta. */
export const zSpecRelease = z
  .object({ v200: z.string(), rc2: z.string(), rc3: z.string(), beta: z.string() })
  .strict();

/** One citation: a repo path with an optional `:line`, or a docs page. */
export const zSpecEvidence = z
  .object({
    kind: z.enum(["code", "docs"]),
    ref: z.string().min(1),
  })
  .strict();

export const zSpecRow = z
  .object({
    id: z
      .string()
      .regex(/^(WEB|APP|ADMIN|OPS)-\d{2}$|^B-\d{2}$/, "an ID is WEB|APP|ADMIN|OPS|B + two digits"),
    section: z.enum(SPEC_SECTIONS),
    group: z.string().min(1),
    check: z.enum(SPEC_CHECKS),
    status: z.enum(SPEC_STATUSES),
    pdfPages: z.string().nullable(),
    /** Always `null` in this tree: the register's quote-free projection (AS-10). */
    quote: z.literal(null),
    requirement: z.string().min(1),
    definitionOfDone: z.string().min(1),
    today: z.string().min(1),
    release: zSpecRelease,
    evidence: z.array(zSpecEvidence),
    parity: z.enum(["Yes", "No", "n.a."]),
    parityBasis: z.string(),
    review: z.object({ pm: z.string(), design: z.string() }).strict(),
    approval: z.object({ jaden: z.string(), walt: z.string() }).strict(),
    next: z.string().nullable(),
    note: z.string().nullable(),
  })
  .strict();

export type SpecRow = z.infer<typeof zSpecRow>;

/**
 * The document. `version` is the shape's version, `main` the commit the citations were checked
 * against, `source.sha256` the CSV digest the output was made from — so a regenerated file is
 * distinguishable from an edited one, and the page can print the register it is reading.
 */
export const zSpecValidation = z
  .object({
    version: z.literal(1),
    release: z.string().min(1),
    main: z.string().regex(/^[0-9a-f]{7,40}$/, "main is a commit sha"),
    generatedAt: zIsoDate,
    source: z
      .object({ file: z.string().min(1), sha256: z.string().regex(/^[0-9a-f]{64}$/) })
      .strict(),
    /** `false` and only `false`: this module describes the repo copy, never the private one. */
    quotesIncluded: z.literal(false),
    rows: z.array(zSpecRow).min(1),
  })
  .strict();

export type SpecValidation = z.infer<typeof zSpecValidation>;

/* ------------------------------------------------------------------ *
 * The derivations
 * ------------------------------------------------------------------ */

/** A group of rows inside one section, in first-appearance order. */
export interface SpecSectionGroup {
  readonly name: string;
  /** `null` for a story that is not in `SPEC_STORY_GROUPS` — `Beyond the Agreement` is the only one. */
  readonly story: SpecStoryGroup | null;
  readonly rows: readonly SpecRow[];
  readonly met: number;
}

export interface SpecSection {
  /** The number the page draws, `1 … 4`. */
  readonly number: number;
  readonly name: SpecSectionName;
  readonly groups: readonly SpecSectionGroup[];
  readonly rows: number;
}

/** Status → how many rows, over the rows it is given. Every status is present, zero included. */
export function specStatusCounts(rows: readonly SpecRow[]): Readonly<Record<SpecStatus, number>> {
  const counts = Object.fromEntries(SPEC_STATUSES.map((status) => [status, 0])) as Record<
    SpecStatus,
    number
  >;
  for (const row of rows) counts[row.status] += 1;
  return counts;
}

/** Met, total, and the percentage the gauge draws — `Math.round`, as the ring's arc is drawn. */
export interface SpecTotals {
  readonly met: number;
  readonly total: number;
  readonly percent: number;
}

export function specTotalsOf(rows: readonly SpecRow[]): SpecTotals {
  const met = rows.filter((row) => SPEC_MET_STATUSES.has(row.status)).length;
  return {
    met,
    total: rows.length,
    percent: rows.length === 0 ? 0 : Math.round((met / rows.length) * 100),
  };
}

/** One scope's meter: `7/13` over the WEB rows. A scope the register has no rows for is dropped. */
export interface SpecScopeTotal {
  readonly prefix: string;
  readonly label: string;
  readonly met: number;
  readonly total: number;
}

export function specScopesOf(rows: readonly SpecRow[]): readonly SpecScopeTotal[] {
  return SPEC_SCOPES.map((scope) => {
    const scoped = rows.filter((row) => row.id.startsWith(`${scope.prefix}-`));
    return { ...scope, ...specTotalsOf(scoped) };
  }).filter((scope) => scope.total > 0);
}

/**
 * The register as the Validation page draws it: four sections in the agreement's order, each with
 * its groups in first-appearance order and its own row count. A section the register carries no
 * row for is still drawn with a zero — an absent number is honest, and the audit trail is the
 * register itself.
 */
export function specSectionsOf(rows: readonly SpecRow[]): readonly SpecSection[] {
  return SPEC_SECTIONS.map((name, index) => {
    const sectionRows = rows.filter((row) => row.section === name);
    const groups: SpecSectionGroup[] = [];
    for (const row of sectionRows) {
      const at = groups.findIndex((candidate) => candidate.name === row.group);
      if (at === -1) {
        groups.push({
          name: row.group,
          story: SPEC_STORY_GROUPS.find((story) => story.name === row.group) ?? null,
          rows: [row],
          met: SPEC_MET_STATUSES.has(row.status) ? 1 : 0,
        });
        continue;
      }
      const group = groups[at];
      groups[at] = {
        ...group,
        rows: [...group.rows, row],
        met: group.met + (SPEC_MET_STATUSES.has(row.status) ? 1 : 0),
      };
    }
    return { number: index + 1, name, groups, rows: sectionRows.length };
  });
}

/**
 * The rows the gauge and the story counts are over: every row the eleven stories read, which is
 * the register minus `Beyond the Agreement`. Story pages, cards and the gauge all take this list,
 * so "44 of 76" and the eleven `/nn` figures are one subtraction.
 */
export function specStoryRows(doc: SpecValidation): readonly SpecRow[] {
  return doc.rows.filter((row) => row.group !== SPEC_BEYOND_GROUP);
}

/** One story's rows, in the register's order. A story the register has no row for is empty. */
export function specRowsOfStory(doc: SpecValidation, name: string): readonly SpecRow[] {
  return doc.rows.filter((row) => row.group === name);
}

/** What one story page's chips print, and nothing else: the group's own counts. */
export function specStorySummary(doc: SpecValidation, name: string): SpecTotals {
  return specTotalsOf(specRowsOfStory(doc, name));
}

/** The twelve rows the register carries beyond the agreement — section 2's last group. */
export function specBeyondRows(doc: SpecValidation): readonly SpecRow[] {
  return doc.rows.filter((row) => row.group === SPEC_BEYOND_GROUP);
}

/**
 * What is wrong with a register as *data*, over and above the schema — `data:check` E42's one rule.
 *
 * The schema answers "is this a register"; these are the questions a schema cannot:
 *
 *   - **an ID twice** — two rows would share one anchor, one link target and one count, and the
 *     page would draw one of them and silently drop the other;
 *   - **a group that is neither a story nor `Beyond the Agreement`** — a row the reader can never
 *     reach, because no page and no rail row is built for a name no table carries;
 *   - **a story with no row** — `/admin/spec/04-opinions` would render an empty page while the rail
 *     promised a count, which is the one state the story page draws a panel for and which the
 *     register should therefore never produce.
 *
 * Returns sentences, empty when the register is sound, so the caller prints the code and the
 * reason like every other `data:check` rule.
 */
export function specRegisterProblems(doc: SpecValidation): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const row of doc.rows) {
    if (seen.has(row.id)) problems.push(`the ID ${row.id} appears twice`);
    seen.add(row.id);
  }

  const storyNames = new Set<string>(SPEC_STORY_GROUPS.map((group) => group.name));
  for (const row of doc.rows) {
    if (row.group !== SPEC_BEYOND_GROUP && !storyNames.has(row.group)) {
      problems.push(
        `${row.id} names the group "${row.group}", which is neither a story in SPEC_STORY_GROUPS nor ${SPEC_BEYOND_GROUP}`,
      );
    }
  }

  for (const group of SPEC_STORY_GROUPS) {
    if (!doc.rows.some((row) => row.group === group.name)) {
      problems.push(
        `the story "${group.name}" (${group.slug}) has no row, so its page would be empty`,
      );
    }
  }

  return problems;
}
