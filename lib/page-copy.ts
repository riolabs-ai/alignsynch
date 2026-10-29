/**
 * Reading a `PageCopy` fixture — the half that ships to the browser.
 *
 * The shape and its zod schema live in `content/pages.ts`; they are build-time
 * (data:check) and would drag zod into every client component that renders a
 * heading. The readers are five pure functions over the parsed object, so they live
 * here instead, with a type-only import that is erased at build.
 *
 * The contract they encode: a component never owns the words and never guesses an
 * id. `sectionOf`/`itemOf` throw with the ids that *do* exist, and `data:check` E23
 * resolves the same ids at build time — so a rename in the fixture is a red build,
 * not a blank heading in production.
 */
import type { PageCopy, PageCopyItem, PageCopySection } from "@/content/pages";

/** A section by id. Throws rather than returning `undefined`: a blank band is the bug. */
export function sectionOf(copy: PageCopy, id: string): PageCopySection {
  const section = copy.sections?.find((candidate) => candidate.id === id);
  if (!section) {
    const available = (copy.sections ?? []).map((candidate) => candidate.id).join(", ") || "none";
    throw new Error(`PageCopy: no section "${id}" in this route's copy (have: ${available})`);
  }
  return section;
}

/** An item by id — the whole pair, for a view that renders `value` over `label`. */
export function itemOf(section: PageCopySection, id: string): PageCopyItem {
  const item = section.items?.find((candidate) => candidate.id === id);
  if (!item) {
    const available = (section.items ?? []).map((candidate) => candidate.id).join(", ") || "none";
    throw new Error(
      `PageCopy: section "${section.id}" has no item "${id}" (have: ${available}) — add it to the fixture, do not write the string in the view`,
    );
  }
  return item;
}

/** The words of an item, with `{placeholders}` left for `fillLabel` when they are dynamic. */
export function itemLabel(section: PageCopySection, id: string): string {
  return itemOf(section, id).label;
}

/**
 * The paragraph an item carries (`"Join tournaments, climb the leaderboards, …"`).
 * Throws when the item is a bare label: a card whose description silently renders
 * empty is the bug this reader exists to prevent.
 */
export function itemBody(section: PageCopySection, id: string): string {
  const item = itemOf(section, id);
  if (item.body === undefined) {
    throw new Error(`PageCopy: item "${id}" in section "${section.id}" has no body`);
  }
  return item.body;
}

/**
 * An item declared on the *page* rather than in a band — a search field's placeholder,
 * a sort option, the label a wall of cards repeats. Same contract as `itemOf`: the id
 * must exist in `data/pages/<route>.ts` and E23 resolves it at build time.
 */
export function pageItemOf(copy: PageCopy, id: string): PageCopyItem {
  const item = copy.items?.find((candidate) => candidate.id === id);
  if (!item) {
    const available = (copy.items ?? []).map((candidate) => candidate.id).join(", ") || "none";
    throw new Error(
      `PageCopy: this route declares no page item "${id}" (have: ${available}) — add it to the fixture, do not write the string in the view`,
    );
  }
  return item;
}

/** A stat's value (`"10k+"`). Throws when the item carries a label only. */
export function itemValue(section: PageCopySection, id: string): string {
  const item = itemOf(section, id);
  if (item.value === undefined) {
    throw new Error(`PageCopy: item "${id}" in section "${section.id}" has no value`);
  }
  return item.value;
}

/**
 * Replace `{name}` placeholders with what the record supplies, e.g.
 * `"Only {count} spots left"` + `{ count: 12 }`. An unknown placeholder is left as
 * written, so it renders (and shows up in a screenshot) instead of becoming "".
 */
export function fillLabel(label: string, values: Record<string, string | number>): string {
  return label.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
    key in values ? String(values[key]) : placeholder,
  );
}

/** The lines of a `heading` that spells a hard break as `\n`; the view joins them with `<br />`. */
export function headingLines(heading: string): string[] {
  return heading.split("\n");
}
