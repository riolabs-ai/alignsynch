/**
 * `scripts/migration-prefixes-rules.ts` — #1249: a migration number identifies **one** step.
 *
 * The runner (`scripts/db-migrate.mjs`) sorts `db/migrations/*.sql` by filename and keys
 * `schema_migrations` by **full name**, so two files sharing a number apply correctly in sorted
 * order and no database is wrong. The cost is in review: `0042_a.sql` and `0042_b.sql` read as an
 * out-of-order pair, a number stops identifying a step, and a third file joining the number looks
 * like a reordering. So the number is a rule, and the rule is checked in the runner's own
 * preflight rather than in `verify.sh` — a naming defect has to stop the run that would write it,
 * not the gate that never opens a connection.
 *
 * ## Never renumber: freeze the legacy pairs instead
 *
 * Renaming an applied migration changes its ledger key, and the ledger would then apply it a
 * second time. So the four pairs that already exist are **frozen here by name**, each with the
 * evidence for how it happened, and this file is the only place that can grow: a new duplicate is
 * a failed preflight, not an allowlist edit.
 *
 * The freeze is per **pair**, not per number — a third `0042` is not covered by the `0042` row,
 * because the row names the exact files that share it. That is the point: "we already tolerate
 * this number" must never become "this number is tolerated".
 *
 * ## Why the four pairs exist, measured
 *
 * Every one is two branches open at once, each taking the next free number, merged the same day —
 * the sibling PR numbers are in the rows below (`git log --diff-filter=A` on each file). That is
 * the mechanism the rule is written against, and it is why the check names both files: the author
 * of the second branch needs to see the file they collided with, not a count.
 */

/** A migration file name: a numeric prefix, a slug, `.sql`. Nothing else is a migration. */
export const MIGRATION_NAME = /^(\d+)_([a-z0-9][a-z0-9_-]*)\.sql$/;

/** One grandfathered number, frozen to the exact files that share it. */
export type LegacyDuplicate = {
  /** The number, as an integer — `0042` and `42` are the same step number. */
  readonly prefix: number;
  /** The files that share it. A file not in this list is not covered by this row. */
  readonly files: readonly string[];
  /** How this pair came to exist, with the evidence. Never "it was here first". */
  readonly why: string;
};

/**
 * The four pairs that exist on `main`, and the last of them. A new row here is a reviewed lie
 * about the tree; a new duplicate is a red preflight. There is a fifth pair only until someone
 * writes one — do not.
 */
export const LEGACY_DUPLICATE_PREFIXES: readonly LegacyDuplicate[] = [
  {
    prefix: 8,
    files: ["0008_alignment_setting.sql", "0008_initiator_email.sql"],
    why: "both added 2026-10-31 by sibling PRs #262/#264, each branch taking the next free number",
  },
  {
    prefix: 26,
    files: ["0026_billing_control.sql", "0026_template_version.sql"],
    why: "both added 2026-11-03 by sibling PRs #524/#525, each branch taking the next free number",
  },
  {
    prefix: 28,
    files: ["0028_broadcast.sql", "0028_support_inbox.sql"],
    why: "both added 2026-11-03 by sibling PRs #530/#531, each branch taking the next free number",
  },
  {
    prefix: 42,
    files: ["0042_billing_plan_prices.sql", "0042_email_template_version.sql"],
    why: "both added 2026-11-17 by sibling PRs #1167/#1170, each branch taking the next free number",
  },
];

/** What the preflight found in one directory. Empty means every number is one step. */
export type PrefixFinding =
  | { readonly kind: "shared"; readonly prefix: string; readonly files: readonly string[] }
  | { readonly kind: "unnamed"; readonly file: string };

function sameFiles(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((file, index) => file === sortedRight[index]);
}

/**
 * Group the migrations by number and report every group the allowlist does not freeze.
 *
 * The input is whatever `readdirSync` returned: a non-`.sql` entry is not a migration and is
 * ignored, so the caller does not have to filter it and cannot forget to.
 */
export function findMigrationPrefixFindings(
  files: readonly string[],
  allowances: readonly LegacyDuplicate[] = LEGACY_DUPLICATE_PREFIXES,
): PrefixFinding[] {
  const findings: PrefixFinding[] = [];
  const groups = new Map<number, { prefix: string; files: string[] }>();

  for (const file of files.filter((name) => name.endsWith(".sql")).sort()) {
    const named = MIGRATION_NAME.exec(file);
    if (!named) {
      findings.push({ kind: "unnamed", file });
      continue;
    }
    const number = Number(named[1]);
    const group = groups.get(number);
    if (group) group.files.push(file);
    else groups.set(number, { prefix: named[1], files: [file] });
  }

  for (const [number, group] of groups) {
    if (group.files.length < 2) continue;
    const frozen = allowances.some(
      (row) => row.prefix === number && sameFiles(row.files, group.files),
    );
    if (frozen) continue;
    findings.push({ kind: "shared", prefix: group.prefix, files: group.files });
  }

  return findings;
}

/** The allowlist rows a directory actually uses — printed on every run, so the freeze is visible. */
export function grandfatheredPrefixes(
  files: readonly string[],
  allowances: readonly LegacyDuplicate[] = LEGACY_DUPLICATE_PREFIXES,
): string[] {
  const present = new Set(files.filter((name) => name.endsWith(".sql")));
  return allowances
    .filter((row) => row.files.every((file) => present.has(file)))
    .map((row) => MIGRATION_NAME.exec(row.files[0])?.[1] ?? "")
    .filter((prefix) => prefix !== "")
    .map((prefix) => prefix.padStart(4, "0"));
}

/**
 * The refusal, in the words the author needs: both filenames, what the number means, and why the
 * repair is a new number rather than a rename.
 */
export function formatPrefixFindings(
  findings: readonly PrefixFinding[],
  directory = "db/migrations",
): string {
  const lines = findings.map((finding) =>
    finding.kind === "shared"
      ? `  · ${finding.prefix} is shared by ${finding.files.join(" and ")}`
      : `  · ${finding.file} is not named <number>_<slug>.sql`,
  );
  return [
    `${directory} — a migration number identifies one step (#1249):`,
    ...lines,
    "  Give the new file the next free number. Never renumber a file that is already applied:",
    "  renaming one changes its `schema_migrations` key, so the ledger applies it a second time.",
  ].join("\n");
}
