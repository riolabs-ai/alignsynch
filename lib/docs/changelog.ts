/**
 * The CHANGELOG parse, as one module — `CHANGELOG.md` is the source of truth, and this is the
 * only reader that turns it into structure (#893).
 *
 * **Why it moved out of `scripts/changelog-view.mjs`.** Two callers now need the same reading:
 * the generator that copies each entry into `docs/changelog/` (byte for byte, `--check` fails on
 * drift) and the `/admin/docs` features index, which groups `feat(<area>)` scopes out of the same
 * entries. A second parse would be a second opinion about what an entry is, and the day the two
 * disagreed nobody could say which one was right — so the parser lives here, the generator imports
 * it, and `scripts/changelog-view.mjs` keeps only what it alone does: rendering and the `--check`
 * diff.
 *
 * **Pure, and that is a contract.** No `fs`, no `node:` import, no clock, no network: the text
 * arrives as an argument, so `tests/` can drive every malformed shape without a tree, and a page
 * can build a view of the file the reader in `lib/docs/tree.ts` opened. This module is safe to
 * import from the browser graph for the same reason (nothing here touches a socket), which is why
 * `lib/docs/features.ts` and `lib/docs/releases.ts` can be pure derivations over its output.
 *
 * **What an entry is, exactly.** `scripts/release.sh` writes `## [1.17.1] - 2026-11-13`, then the
 * intro prose, then `### <Section>` blocks of bullets, and closes the file with a link footer
 * (`[1.6.0]: https://…`). A section's `lines` are the entry's own lines, verbatim — no re-wrapping,
 * no bullet re-ordering — because the generator copies them character for character. The one thing
 * this module *derives* rather than copies is `pullRequests`, `hasLimits` and the scoped commits:
 * counts and classifications, never prose.
 */

/** `scripts/release.sh` writes this file; `pnpm release:check` owns it. */
export const CHANGELOG_PATH = "CHANGELOG.md";

/** The block every entry must end with. A release that does not say what it cannot do is a claim. */
export const LIMITS_SECTION = "Known limits";

/** The one place the repository's address is spelled. */
export const REPO_URL = "https://github.com/riolabs-ai/alignsynch";

/** `## [1.6.0] - 2026-11-07` — the one heading shape `scripts/release.sh` emits. */
const ENTRY_HEADING = /^## \[([0-9][^\]]*)\] - (\d{4}-\d{2}-\d{2})$/;

/** `[1.6.0]: https://github.com/...` — the link footer after the last entry, not an entry. */
const LINK_FOOTER = /^\[[^\]]+\]: \S+$/;

/** `### Added` — a section of the entry. */
const SECTION_HEADING = /^### (.+)$/;

/** A full-width PR link, as `release.sh` writes one: `([#634](https://…/pull/634))`. */
const PR_LINK = /\(\[#(\d+)\]\(https:\/\/github\.com\/[^)]+\/pull\/\1\)\)/g;

/** A bullet of a section: `- …`. Markdown allows `*`; the generator only ever writes `-`. */
const BULLET = /^\s*[-*]\s+(.+)$/;

/**
 * The conventional-commit scope a bullet opens with — `` `feat(flow)` `` (and, for the one bullet
 * written by hand, a bare `feat(demo)`). The backticks are optional because a bullet that forgot
 * them is still the commit it names, and the type is matched as written rather than being coerced.
 */
const SCOPED_PREFIX = /^`?([a-z][a-z0-9]*)\(([^)]+)\)`?/;

/** What separates a scope from its description: `—`, `·` (before a bare issue number) and `-`. */
const SEPARATOR = /^\s*[·—–-]\s*/;

/** One `### Section` of an entry: its title and its own lines, verbatim. */
export interface ChangelogSection {
  readonly title: string;
  /** The entry's lines, exactly as published — trailing blank lines trimmed. */
  readonly lines: readonly string[];
}

/** One `## [x.y.z] - date` block. */
export interface ChangelogEntry {
  readonly version: string;
  /** `YYYY-MM-DD`, the entry's own instant. Never read from a clock. */
  readonly date: string;
  /** The prose between the heading and the first `###`, verbatim. */
  readonly intro: readonly string[];
  readonly sections: readonly ChangelogSection[];
  /** Does the entry carry a `Known limits` block with at least one line? */
  readonly hasLimits: boolean;
  /** How many distinct pull requests the entry's bullets name. */
  readonly pullRequests: number;
}

/**
 * One bullet that opens with a conventional-commit scope — the unit the features index groups.
 *
 * `type` is the commit type (`feat`, `fix`, `chore`, …), not a filter: the index asks for `feat`
 * and the release column of the same page asks for every type. Deriving the whole set once means
 * the two cannot disagree about what a bullet is.
 */
export interface ScopedCommit {
  readonly version: string;
  readonly date: string;
  readonly type: string;
  /** The `(…)` — `flow`, `admin`, `ui`. The features index's grouping key. */
  readonly scope: string;
  /** The description with the scope, the issue reference and the PR link removed. */
  readonly summary: string;
  /** The issue the bullet names (`#906`), or `null` when it names none. */
  readonly issue: string | null;
  /** The pull request the bullet links (`#947`), or `null`. */
  readonly pullRequest: string | null;
}

/**
 * Every release entry in `CHANGELOG.md`, newest first — the order the file holds.
 *
 * A section's `lines` are the entry's own lines, verbatim, with trailing blank lines trimmed.
 * Sections therefore keep their prose, their bullets and their wrapping exactly as published; this
 * function classifies nothing but where one section ends and the next begins.
 */
export function parseChangelog(text: string): ChangelogEntry[] {
  const entries: {
    version: string;
    date: string;
    intro: string[];
    sections: { title: string; lines: string[] }[];
    hasLimits: boolean;
    pullRequests: number;
  }[] = [];
  let current: (typeof entries)[number] | null = null;
  let section: { title: string; lines: string[] } | null = null;

  const closeSection = () => {
    if (current && section) {
      // A section's body is the entry's own lines verbatim; only the blank line the heading is
      // written with is layout, so both ends are trimmed and nothing inside is touched.
      while (section.lines.length > 0 && section.lines.at(-1)?.trim() === "") section.lines.pop();
      while (section.lines.length > 0 && section.lines[0]?.trim() === "") section.lines.shift();
      current.sections.push(section);
    }
    section = null;
  };

  for (const line of text.split("\n")) {
    const heading = ENTRY_HEADING.exec(line);
    if (heading) {
      closeSection();
      current = {
        version: heading[1] ?? "",
        date: heading[2] ?? "",
        intro: [],
        sections: [],
        hasLimits: false,
        pullRequests: 0,
      };
      entries.push(current);
      continue;
    }
    if (!current) continue;
    if (LINK_FOOTER.test(line)) {
      closeSection();
      current = null;
      continue;
    }
    const sub = SECTION_HEADING.exec(line);
    if (sub) {
      closeSection();
      section = { title: (sub[1] ?? "").trim(), lines: [] };
      continue;
    }
    if (section) section.lines.push(line);
    else current.intro.push(line);
  }
  closeSection();

  for (const entry of entries) {
    while (entry.intro.length > 0 && entry.intro.at(-1)?.trim() === "") entry.intro.pop();
    while (entry.intro.length > 0 && entry.intro[0]?.trim() === "") entry.intro.shift();
    const limits = entry.sections.find((candidate) => candidate.title === LIMITS_SECTION);
    entry.hasLimits = Boolean(limits) && (limits?.lines.length ?? 0) > 0;
    const prs = new Set<string>();
    for (const found of entry.sections) {
      for (const line of found.lines)
        for (const match of line.matchAll(PR_LINK)) prs.add(match[1] ?? "");
    }
    entry.pullRequests = prs.size;
  }

  return entries;
}

/** `1.6.0` → `v1.6.0` — the tag, as the release page links it. */
export function tagOf(version: string): string {
  return `v${version}`;
}

/** The GitHub release's address. Derived from the version, never stored. */
export function tagUrl(version: string): string {
  return `${REPO_URL}/releases/tag/${tagOf(version)}`;
}

/**
 * `1.6.0` → `v1-6-0.md` — a release's page under `docs/changelog/`.
 *
 * Derived from the version and never stored, so the page name and the entry cannot disagree about
 * a filename. `lib/docs/releases.ts` turns this into the address a reader opens.
 */
export function pageOf(version: string): string {
  return `v${version.replaceAll(".", "-")}.md`;
}

/** `1.6.0` → `changelog/v1-6-0.md` — the page's path *relative to `docs/`*, which is the join. */
export function releasePathOf(version: string): string {
  return `changelog/${pageOf(version)}`;
}

/** The `Known limits` section of an entry, or `null` when it carries none. */
export function limitsOf(entry: ChangelogEntry): ChangelogSection | null {
  return entry.sections.find((candidate) => candidate.title === LIMITS_SECTION) ?? null;
}

/** The section titles of an entry, in the order the entry holds them. */
export function sectionTitles(entry: ChangelogEntry): string[] {
  return entry.sections.map((candidate) => candidate.title);
}

/**
 * The description one bullet carries, with the three decorations stripped.
 *
 * A bullet in an entry looks like
 * `` - `feat(admin)` — the sticky notice bar and /admin/brand (#906) ([#947](…)) ``
 * and the readable sentence is what is left once the scope, the issue and the PR link go. They are
 * stripped from the *end* only, so a sentence that quotes an issue in the middle keeps it.
 */
function describe(rest: string): string {
  let text = rest.trim();
  const trailing = /(\(\[#\d+\]\([^)]*\)\)|\(#\d+\))$/;
  // Two decorations can stack (`(#906) ([#947](…))`); strip until neither is there.
  while (trailing.test(text)) text = text.replace(trailing, "").trim();
  return text;
}

/**
 * The conventional-commit scopes a bullet opens with, or `null` when it opens with none.
 *
 * A bullet is the unit; a bullet may wrap across lines in the file (a long commit subject shipped
 * wrapped), so the *first* line is what is classified and the sentence continues to be read from
 * the same bullet's joined lines.
 */
function scopeOf(bullet: string): { type: string; scope: string; rest: string } | null {
  const match = SCOPED_PREFIX.exec(bullet);
  if (!match) return null;
  const rest = describe(bullet.slice(match[0].length).replace(SEPARATOR, ""));
  return { type: match[1] ?? "", scope: (match[2] ?? "").trim(), rest };
}

/** The issue a bullet names, preferring the one in parentheses at the end. */
function issueOf(line: string): string | null {
  const matches = [...line.matchAll(/\(#(\d+)\)/g)];
  return matches.at(-1)?.[1] ?? null;
}

/** The pull request a bullet links. */
function pullRequestOf(line: string): string | null {
  return [...line.matchAll(PR_LINK)].at(-1)?.[1] ?? null;
}

/**
 * Every scoped bullet of one entry, in the order the entry holds it.
 *
 * Continuation lines of a wrapped bullet are joined with a space, so a scope's summary is the whole
 * sentence rather than its first line. A bullet with no scope prefix is skipped rather than guessed
 * at: an unclassifiable bullet is a commit whose subject did not follow the convention, and putting
 * it in a made-up scope is the one thing this module must not do.
 */
export function scopedCommits(entry: ChangelogEntry): ScopedCommit[] {
  const commits: ScopedCommit[] = [];
  for (const section of entry.sections) {
    if (section.title === LIMITS_SECTION) continue;
    let joined: string | null = null;
    const flush = () => {
      if (joined === null) return;
      const scope = scopeOf(joined);
      if (scope !== null && scope.type !== "" && scope.scope !== "") {
        commits.push({
          version: entry.version,
          date: entry.date,
          type: scope.type,
          scope: scope.scope,
          summary: scope.rest,
          issue: issueOf(joined),
          pullRequest: pullRequestOf(joined),
        });
      }
      joined = null;
    };
    for (const line of section.lines) {
      const bullet = BULLET.exec(line);
      if (bullet) {
        flush();
        joined = bullet[1] ?? "";
        continue;
      }
      // A non-bullet line continues the bullet above it only when there is one to continue.
      if (joined !== null && line.trim() !== "") joined = `${joined} ${line.trim()}`;
    }
    flush();
  }
  return commits;
}

/** Every release's scoped commits, newest release first — the whole file, classified once. */
export function allScopedCommits(entries: readonly ChangelogEntry[]): ScopedCommit[] {
  return entries.flatMap((entry) => scopedCommits(entry));
}
