/**
 * Terminology — the fixtures may not hand a reader the word **instance**.
 *
 * The database already speaks the target vocabulary: `relationship`, `relationship_member`,
 * `session`, `session_invite`, `party`. Only the copy lagged, and one page contradicted itself —
 * a heading reading "Your instance" over bands that already said relationship and session.
 * This test is the ratchet that stops the word coming back, and it is deliberately narrower than
 * a grep: **code handles are not copy.** A fixture's `id`, a `cta.href`, a route segment and the
 * `{placeholder}` tokens the view fills are all handles — the reader never sees them as words —
 * so they are skipped here even when they spell `instance`. `scripts/` still renames none of them
 * (that is a later card, a mechanical rename across `app/`, `lib/` and `db/`); this file only
 * holds the surface a person reads.
 *
 * The vocabulary the mapping was made against, from `data/pages/assessment-instances.ts`'s own
 * docstring:
 *
 *   template     the definition (Aspects, roles, price) — never has sessions
 *   relationship the published template between two people, bought once, holding every cycle
 *   session      one cycle of answering inside a published relationship
 *   assessment   the scored Gap analysis a finished session produces
 *
 * So a row label about one cycle says **session**, and a label about the purchased container or a
 * member's collection of them says **relationship**. There is no third case: a string that cannot
 * say one of those is a string that has not been thought about, which is why this fails rather
 * than warning.
 *
 * Each fixture module in `data/pages/` is imported and walked, so a *new* fixture is covered the
 * day it lands — there is no list to keep in step. `index.ts` (the copy table) and `budget.ts`
 * (route patterns, file paths and literal counts) are the two modules in that directory that are
 * not copy, and they are named rather than pattern-matched.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const DIRECTORY = "data/pages";

/** The modules in the directory that carry no reader-visible copy. */
const NOT_COPY = new Set(["index.ts", "budget.ts"]);

/**
 * Keys whose value is a handle rather than a word: an item's `id` (the id the view looks up),
 * a link's `href` (checked against `content/routes.ts`, never printed), and the budget's own
 * bookkeeping. Skipping the key skips the whole subtree, so `cta: { label, href }` still has its
 * `label` read.
 */
const HANDLE_KEYS = new Set(["id", "href", "page", "dirs", "mounts", "fixture", "budget", "slug"]);

/**
 * A string with its placeholders masked: `{count}` is filled by `fillLabel` from the rows, and
 * `<instance-id>` inside the cookie names in `legal.ts` is a column the browser sets, not a word
 * the reader reads. Masking both keeps the token names out of the comparison while leaving every
 * actual word in place.
 */
function maskPlaceholders(value: string): string {
  return value.replace(/\{[^}]*\}/g, "{}").replace(/<[^>]*>/g, "<>");
}

const OFFENDER = /\binstances?\b/i;

/** One reader-visible string and where it lives. */
type Visible = { path: string; value: string };

/** Every reader-visible string in a copy value, with its key path (`sections[2].items[0].label`). */
function visibleStrings(value: unknown, path: string, out: Visible[]): void {
  if (typeof value === "string") {
    out.push({ path, value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      visibleStrings(entry, `${path}[${index}]`, out);
    });
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (HANDLE_KEYS.has(key)) continue;
      visibleStrings(entry, path ? `${path}.${key}` : key, out);
    }
  }
}

/** The strings in one module's exports that still say instance, as the failure message a writer reads. */
function offendersIn(file: string, exports: Record<string, unknown>): string[] {
  const strings: Visible[] = [];
  visibleStrings(exports, "", strings);
  return strings
    .filter((entry) => OFFENDER.test(maskPlaceholders(entry.value)))
    .map(
      (entry) =>
        `${file}: ${entry.path} says "${entry.value}" — a relationship has sessions; a template has neither.`,
    );
}

/** The copy fixtures, imported — `index.ts` and `budget.ts` excluded, the rest discovered. */
async function copyFixtures(): Promise<Array<{ file: string; exports: Record<string, unknown> }>> {
  const files = readdirSync(DIRECTORY)
    .filter((name) => name.endsWith(".ts") && !NOT_COPY.has(name))
    .sort();

  const fixtures = [];
  for (const name of files) {
    const url = pathToFileURL(join(process.cwd(), DIRECTORY, name)).href;
    const exports = (await import(/* @vite-ignore */ url)) as Record<string, unknown>;
    fixtures.push({ file: `${DIRECTORY}/${name}`, exports });
  }
  return fixtures;
}

describe("terminology: a reader is never told about an 'instance'", () => {
  it("no copy fixture hands a reader the word instance", async () => {
    const fixtures = await copyFixtures();

    // A walk that finds no fixtures, or a fixture that exports nothing walkable, would pass
    // silently — so both counts are asserted before the rule is.
    expect(fixtures.length).toBeGreaterThan(60);

    const visible = fixtures.reduce((count, fixture) => {
      const strings: Visible[] = [];
      visibleStrings(fixture.exports, "", strings);
      return count + strings.length;
    }, 0);
    expect(visible).toBeGreaterThan(2_000);

    const offenders = fixtures.flatMap((fixture) => offendersIn(fixture.file, fixture.exports));
    expect(offenders, "reader-visible copy still says instance").toEqual([]);
  });

  /**
   * The page this card exists for. `/assessment/instances` lists the member's relationships, and
   * its copy already agreed — heading, subtitle and every band said relationship or session. The
   * word survives here only in the module comment and in the export handle
   * `myInstancesPageCopy`, which `data/pages/index.ts` and the page read; neither is a word a
   * reader sees, and neither is renamed in this pass. This case holds both halves: the handle
   * stays, and nothing visible says instance.
   */
  it("the relationship list agrees with itself", async () => {
    const file = `${DIRECTORY}/assessment-instances.ts`;
    const exports = (await import(
      /* @vite-ignore */ pathToFileURL(join(process.cwd(), file)).href
    )) as Record<string, unknown>;

    expect(Object.keys(exports)).toContain("myInstancesPageCopy");
    expect(offendersIn(file, exports)).toEqual([]);

    const strings: Visible[] = [];
    visibleStrings(exports, "", strings);
    const headings = strings
      .filter((entry) => entry.path.endsWith(".heading"))
      .map((entry) => entry.value);
    expect(headings).toContain("Your relationships");
    expect(strings.filter((entry) => OFFENDER.test(maskPlaceholders(entry.value)))).toEqual([]);
  });

  /**
   * The rule's own negative case: without it, a walker that returned nothing would be
   * indistinguishable from a clean tree. Three strings, three verdicts — a word is caught, a
   * handle is not, a placeholder is not.
   */
  it("catches the word, and only the word", () => {
    const copy = {
      heading: "Start an instance",
      sections: [
        {
          id: "list",
          items: [
            { id: "no-such-instance", label: "No session answers to that link." },
            { id: "outcome", label: "{aligned} of {instances} aligned under Soft." },
          ],
        },
      ],
    };

    const offenders = offendersIn("data/pages/example.ts", copy);
    expect(offenders).toHaveLength(1);
    expect(offenders[0]).toBe(
      'data/pages/example.ts: heading says "Start an instance" — a relationship has sessions; a template has neither.',
    );
  });
});
