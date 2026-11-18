/**
 * The additive template import's **decision**, as a pure function (#1099).
 *
 * `scripts/db-templates-import.mjs` is the IO — connect, print the target, open the transaction,
 * ask the guard, commit or roll back. Everything that decides *what* to write lives here, so it can
 * be tested without a branch, and so the rules the card constrains are readable in one screen:
 *
 *   * **Add and converge; never delete.** A template the database lacks is inserted. A platform
 *     template whose row has drifted from the fixture (a stale `draft`, a missing item, no
 *     `template_version`) is updated in place. Nothing is ever removed — not a template, not an
 *     item, not a version — so the import cannot reach a relationship.
 *   * **An authored row is not ours to take.** If a template's slug already belongs to an account
 *     (`author_user_id` not null), the import refuses that slug and the caller aborts: the row is
 *     somebody's, the slug is unique, and "make room for the platform's copy" is exactly the
 *     authorship change the card forbids.
 *   * **Templates are the only thing that may move.** `NON_TEMPLATE_TABLES` is the guard set the
 *     importer measures before and after — a write that touched any of them is rolled back, not
 *     reported.
 *
 * The shapes are deliberately narrow: `templates` is `data/assessments.ts`'s published records
 * (`lib/platform-templates.ts`), and `existing` is one row per template-looking record the
 * database already holds, in the shape the importer's own query returns.
 */

/**
 * The tables a template import must leave **exactly** as it found them.
 *
 * `record`, `item` and `template_version` are the write's own subject and are expected to move;
 * these five are the product's live data — a session is somebody's in-progress sheet, an opinion a
 * completed answer, a relationship the thing both sit inside — and the seed's destructive phase is
 * why this import exists instead of `pnpm db:seed`. Measured on the demo branch, that seed would
 * have removed 19 records / 23 relationships / 102 opinions and nulled 6 `party` references.
 */
export const NON_TEMPLATE_TABLES = ["session", "relationship", "opinion", "party", "profile"];

/** `["a","b"]` from either order — item-id sets are compared, not sequences. */
function sameSet(left, right) {
  if (left.length !== right.length) return false;
  const a = [...left].sort();
  const b = [...right].sort();
  return a.every((value, index) => value === b[index]);
}

/**
 * What the import would do, per slug.
 *
 * `existing` rows may come back in any order and may include slugs the fixtures no longer author —
 * those are reported as `strays` and never touched (a record the platform stopped offering is a
 * product decision, not an import's).
 */
export function planTemplateImport({ templates, existing }) {
  const bySlug = new Map(existing.map((row) => [row.slug, row]));
  const fixtureSlugs = new Set(templates.map((template) => template.slug));

  const create = [];
  const update = [];
  const unchanged = [];
  const refuse = [];

  for (const template of templates) {
    const row = bySlug.get(template.slug);
    if (row === undefined) {
      create.push(template.slug);
      continue;
    }
    if (row.authorUserId !== null && row.authorUserId !== undefined) {
      refuse.push({
        slug: template.slug,
        reason: `the slug belongs to a template authored by user ${row.authorUserId} — the import never reassigns authorship, and the slug is unique`,
      });
      continue;
    }
    if ((row.sessions ?? 0) > 0) {
      refuse.push({
        slug: template.slug,
        reason: `the slug names a session (${row.sessions} session row(s)), not a template — rewriting it would overwrite a relationship's own record`,
      });
      continue;
    }

    const reasons = [];
    if (row.status !== template.status) {
      reasons.push(`status ${row.status} → ${template.status}`);
    }
    const fixtureItems = template.items.map((item) => item.id);
    if (!sameSet(row.itemIds ?? [], fixtureItems)) {
      const missing = fixtureItems.filter((id) => !(row.itemIds ?? []).includes(id));
      reasons.push(
        missing.length > 0
          ? `items missing: ${missing.join(", ")}`
          : `items differ (database has ${(row.itemIds ?? []).length}, fixture ${fixtureItems.length})`,
      );
    }
    if ((row.versionCount ?? 0) === 0) {
      reasons.push("no template_version — the create route refuses a template with none");
    }

    if (reasons.length === 0) unchanged.push(template.slug);
    else update.push({ slug: template.slug, reasons });
  }

  const strays = existing
    .filter(
      (row) =>
        !fixtureSlugs.has(row.slug) &&
        (row.authorUserId ?? null) === null &&
        (row.sessions ?? 0) === 0,
    )
    .map((row) => row.slug);

  return {
    create,
    update,
    unchanged,
    refuse,
    strays,
    /** Anything to write at all? A second run of a converged branch answers `false`. */
    writes: create.length + update.length,
  };
}

/**
 * The guard: which `NON_TEMPLATE_TABLES` counts moved between two censuses.
 *
 * Returns `[]` when nothing outside the write's subject changed — the only answer the importer
 * commits on. `before` and `after` are `{ session: 24, relationship: 24, … }` as the importer's
 * `census()` reads them; a table missing from `after` counts as drifted, because a measurement
 * the run cannot take is not a measurement that agreed.
 */
export function nonTemplateDrift(before, after) {
  const drifted = [];
  for (const table of NON_TEMPLATE_TABLES) {
    const from = before[table];
    const to = after[table];
    if (from !== to) drifted.push(`${table} ${String(from)} → ${String(to)}`);
  }
  return drifted;
}

/**
 * The census line the importer prints before and after: the tables the write owns, plus the one
 * number the card asks for — **templates a signed-out visitor can resolve**, which is the
 * published-platform-template count, not the record count.
 */
export function censusLine(census) {
  return [
    `record ${census.record}`,
    `templates ${census.template}`,
    `served ${census.served}`,
    `item ${census.item}`,
    `template_version ${census.template_version}`,
  ].join(" · ");
}

/** The five guarded tables, as one line — printed on both sides of the write. */
export function guardLine(census) {
  return NON_TEMPLATE_TABLES.map((table) => `${table} ${census[table]}`).join(" · ");
}
