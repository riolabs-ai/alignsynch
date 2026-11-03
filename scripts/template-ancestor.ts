/**
 * template-ancestor — every component names the surface it varies (#336).
 *
 * The repo is a base core webapp: QuizHub is the template, AlignSynch is a brand variation of it,
 * and a third is coming. The doctrine is in `docs/TEMPLATE-DOCTRINE.md`, and the audit that
 * proved it was not being followed is `docs/UI-DIVERGENCE.md` — twenty-seven files read, six
 * hand-built surfaces with a named ancestor sitting beside them, and zero variations actually
 * derived from one. Documentation did not stop it, so the claim becomes mechanical: **every file
 * under `components/` that returns JSX states, in its first comment block, which file is its
 * template and what varies.**
 *
 * ```
 * // template-ancestor: components/quiz/quiz-play.tsx   (variation: five-notch opinion bands, no timer)
 * // template-ancestor: none — approved #336
 * ```
 *
 * Three things make that a rule rather than a convention:
 *
 *   - **the walk is over JSX, not over a list.** `exportsJsx` strips comments and strings, then
 *     looks for a JSX element (`<Name …>`, `</Name>`, `<div attr=…>`, `<>`). A file that renders
 *     is in scope whether or not anybody remembered to add it to a document, and a TypeScript
 *     generic (`Promise<Quiz>`, `useState<Record<string, string>>`) is not a JSX element, because
 *     no type parameter ever carries an attribute or a closing tag.
 *   - **the header is checked, not just counted.** An ancestor path must exist on disk, must be a
 *     component, must not be the file itself, and must carry a `(variation: …)` that says
 *     something. A fabricated or circular ancestry is a failure — the point of the header is that
 *     a reviewer can open the named file and see the pattern being copied.
 *   - **the exemptions are code.** `TEMPLATE_ANCESTOR_EXEMPTIONS` below is the only place a
 *     `none` is allowed, every row carries the issue that approved it, and a row that no longer
 *     matches its file (because the rebuild landed) is a failure. The list can only shrink.
 *
 * `components/ui/**` is **excluded from the walk, deliberately**. Those are vendored shadcn
 * primitives: they are the bottom of every ancestry chain, so requiring them to name an ancestor
 * would make them name each other. They are still legal *targets* — `components/ui/card.tsx` is
 * the honest ancestor of a card grid, and most of this tree's components name one.
 *
 * The extraction (`firstCommentBlock`, `readAncestorHeader`, `exportsJsx`) and the rules
 * (`templateAncestorFindings`, `ancestorCensus`) are pure and take their inputs as arguments, so
 * `scripts/__tests__/template-ancestor.test.ts` drives every shape — a missing header, a
 * fabricated ancestor, a self-reference, an unapproved `none`, an exemption that outlived its
 * rebuild, a cycle — with no filesystem. The same split as `scripts/client-graph.ts`, and its last
 * section asserts the real tree is clean.
 */

/** The census assertion: a walk that silently found nothing is worth nothing. */
export const TEMPLATE_ANCESTOR_MIN_WALKED = 100;

/** One approved `none`, with the issue that approved it. */
export interface TemplateAncestorExemption {
  /** Repo-relative component path, exactly as the header spells it. */
  readonly file: string;
  /** The issue the approval is recorded on. Named in the header, never inferred. */
  readonly issue: number;
  /** What the surface is, in the words of the issue that approved it. */
  readonly reason: string;
}

/**
 * The approved exceptions — **this list must only shrink.**
 *
 * Every row is a surface with no template ancestor, approved in writing on issue #336, or one of
 * the bespoke files `docs/UI-DIVERGENCE.md` measured and the rebuild cards own. Adding a row for a
 * surface that merely *looks* new is the hand-bake this rule exists to stop: the approval comes
 * first, on the issue, and the row is the record of it.
 *
 * The rows exist to be deleted. When a rebuild card lands a real variation, it deletes its row and
 * the header changes to the ancestor it now copies; `templateAncestorFindings` fails on a row that
 * no longer matches its file, so the deletion cannot be forgotten. The count in the census is the
 * whole point: six today, zero when the rebuild queue drains.
 *
 * The list has already shrunk once. It opened with eight rows — the five component rows
 * `docs/UI-DIVERGENCE.md` flagged as bespoke (the sixth, `app/(marketing)/layout.tsx`, is outside
 * this rule's walk) plus #336's three no-ancestor surfaces. `components/marketing/marketing-header.tsx`
 * and `…/marketing-footer.tsx` left it when #335 landed the public chrome: the header composes
 * `PublicNav` and its row became an ancestor header, and the footer was deleted rather than kept as
 * a second one. That is the work this array is for.
 */
export const TEMPLATE_ANCESTOR_EXEMPTIONS: readonly TemplateAncestorExemption[] = [
  {
    file: "components/console/gap-analysis.tsx",
    issue: 336,
    reason: "bespoke console surface — rebuild onto stat-card-grid, ui/table and ui/alert",
  },
  {
    file: "components/console/overview.tsx",
    issue: 336,
    reason: "bespoke console surface — a copied identity header and a hand-written failure panel",
  },
  {
    file: "components/marketing/marketing-landing.tsx",
    issue: 336,
    reason: "bespoke landing bands — hand-rolled boxes where ui/card and ui/button exist",
  },
  {
    file: "components/assessment-flow/invite-view.tsx",
    issue: 336,
    reason:
      "the claim page — a single-use token has no quiz analogue (#336's first no-ancestor surface)",
  },
  {
    file: "components/assessment-flow/instance-view.tsx",
    issue: 336,
    reason: "the stage machine — derived stages over a blind sheet have no quiz analogue",
  },
  {
    file: "components/assessment/assessment-report.tsx",
    issue: 336,
    reason: "the blind rule — rendering the absence of a score has no ancestor to copy",
  },
];

/** A component the walk read. */
export interface AncestorSource {
  /** Repo-relative path, reported verbatim in diagnostics. */
  readonly path: string;
  readonly source: string;
}

/** What a header says. `malformed` keeps the raw payload so the diagnostic can quote it. */
export type AncestorHeader =
  | { readonly kind: "ancestor"; readonly ancestor: string; readonly variation: string }
  | { readonly kind: "none"; readonly issue: number }
  | { readonly kind: "malformed"; readonly raw: string };

export interface TemplateAncestorFinding {
  readonly rule: "E35";
  readonly message: string;
}

export interface TemplateAncestorInput {
  /** The components walked — `components/ui/**` already excluded by the caller. */
  readonly files: readonly AncestorSource[];
  /** `TEMPLATE_ANCESTOR_EXEMPTIONS`, passed in so a test can violate it. */
  readonly exemptions: readonly TemplateAncestorExemption[];
  /** Does this repo-relative path exist? Injected: the rules stay filesystem-free. */
  readonly exists: (path: string) => boolean;
}

export interface AncestorCensus {
  /** Components the walk read (the number the census line quotes). */
  readonly walked: number;
  /** Components naming a template ancestor. */
  readonly withAncestor: number;
  /** Components carrying an approved `none`. */
  readonly approved: number;
}

const DIRECTIVE = /^\s*["']use (?:client|server)["'];?\s*$/;

/** Strip the comment furniture so `// x`, `* x` and `/* x` read the same. */
function commentText(line: string): string {
  return line
    .replace(/^\s*\/\*\*?/, "")
    .replace(/^\s*\*\/?/, "")
    .replace(/^\s*\/\/\/?/, "")
    .trim();
}

/**
 * The first comment block of a file, verbatim, or `""` when the file opens with code.
 *
 * A leading `"use client"` / `"use server"` directive is skipped: comment lines above a directive
 * are legal, but putting one there is how a client component stops being one, and the header has
 * no business editing semantics. The block is the first thing after the directive (or the first
 * thing in the file), `/** … *\/`, `/* … *\/` or a run of `//` lines.
 */
export function firstCommentBlock(source: string): string {
  const lines = source.split("\n");
  let index = 0;
  if (DIRECTIVE.test(lines[0] ?? "")) index = 1;
  while (index < lines.length && (lines[index] ?? "").trim() === "") index += 1;

  const first = (lines[index] ?? "").trim();
  if (first.startsWith("/**") || first.startsWith("/*")) {
    const block: string[] = [];
    for (; index < lines.length; index += 1) {
      block.push(lines[index] ?? "");
      if ((lines[index] ?? "").includes("*/")) break;
    }
    return block.join("\n");
  }
  if (first.startsWith("//")) {
    const block: string[] = [];
    for (; index < lines.length; index += 1) {
      if (!(lines[index] ?? "").trim().startsWith("//")) break;
      block.push(lines[index] ?? "");
    }
    return block.join("\n");
  }
  return "";
}

/** `components/x/y.tsx   (variation: what changes)` — the ancestor form. */
const ANCESTOR_FORM = /^(\S+\.tsx)\s+\(variation:\s*(.+)\)$/;
/** `none — approved #336` — the approved-exception form, em dash or hyphen. */
const NONE_FORM = /^none\s+[—-]\s+approved\s+#(\d+)$/i;

/**
 * The header, read out of the first comment block, or `null` when the file carries none.
 *
 * Only the **first** `template-ancestor:` line in that block is read: a second one is a file
 * arguing with itself, and the first is the one a reviewer sees.
 */
export function readAncestorHeader(source: string): AncestorHeader | null {
  const block = firstCommentBlock(source);
  if (block === "") return null;
  const line = block
    .split("\n")
    .map(commentText)
    .find((text) => text.startsWith("template-ancestor:"));
  if (line === undefined) return null;

  const payload = line.slice("template-ancestor:".length).trim();
  const ancestor = ANCESTOR_FORM.exec(payload);
  if (ancestor !== null) {
    return {
      kind: "ancestor",
      ancestor: (ancestor[1] ?? "").trim(),
      variation: (ancestor[2] ?? "").trim(),
    };
  }
  const none = NONE_FORM.exec(payload);
  if (none !== null) return { kind: "none", issue: Number(none[1]) };
  return { kind: "malformed", raw: payload };
}

/**
 * Strip comments and string contents, so a tag named in prose is not a rendered element.
 *
 * A docblock that describes markup (`the body is `<Card>`s`) is the common case: it is how this
 * tree documents itself, and counting it as JSX would put an icon module in scope while letting a
 * real component out of it.
 *
 * A quote only *opens* a string where a string can start — after `=`, `(`, `,`, `{`, `[`, `:`, an
 * operator, or at the beginning of a line. That is what keeps an apostrophe in JSX text
 * (`the player's score`) from swallowing the rest of the file: prose follows a letter, and a
 * string never does.
 */
const STRING_OPENS_AFTER = "=([{,:;!&|?+-*/%<>~^";

/** `return 'x'`, `case 'y'` — a keyword ends a token, and a string may follow it. */
const STRING_OPENS_AFTER_WORD = /(?:^|[^\w$])(?:return|case|typeof|default|await|yield|in|of|new)$/;

function opensString(out: string): boolean {
  for (let index = out.length - 1; index >= 0; index -= 1) {
    const char = out[index] ?? "";
    if (char === " " || char === "\t") continue;
    if (char === "\n") return true;
    if (STRING_OPENS_AFTER.includes(char) || char === ")") return true;
    return STRING_OPENS_AFTER_WORD.test(out.slice(0, index + 1));
  }
  return true;
}

function code(source: string): string {
  let out = "";
  let index = 0;
  let state: "code" | "line" | "block" | "quote" | "template" = "code";
  while (index < source.length) {
    const two = source.slice(index, index + 2);
    const char = source[index] ?? "";
    if (state === "code") {
      if (two === "//") {
        state = "line";
        index += 2;
        continue;
      }
      if (two === "/*") {
        state = "block";
        index += 2;
        continue;
      }
      if ((char === '"' || char === "'") && opensString(out)) {
        state = "quote";
        out += char;
        index += 1;
        continue;
      }
      if (char === "`") {
        state = "template";
        out += char;
        index += 1;
        continue;
      }
      out += char;
      index += 1;
      continue;
    }
    if (state === "line") {
      if (char === "\n") {
        state = "code";
        out += char;
      }
      index += 1;
      continue;
    }
    if (state === "block") {
      if (two === "*/") {
        state = "code";
        index += 2;
        continue;
      }
      if (char === "\n") out += char;
      index += 1;
      continue;
    }
    // Inside a string or a template literal: keep the delimiters, drop the contents.
    if (char === "\\") {
      index += 2;
      continue;
    }
    if (
      (state === "quote" && (char === '"' || char === "'")) ||
      (state === "template" && char === "`")
    ) {
      state = "code";
      out += char;
      index += 1;
      continue;
    }
    if (char === "\n") out += char;
    index += 1;
  }
  return out;
}

/** A closing tag, a fragment, or an opening tag that carries an attribute or closes itself. */
const JSX_ELEMENT = /<\/[A-Za-z][\w.:-]*>|<>|<[A-Za-z][\w.:-]*(\s[^<>]*)?\/>/;

/**
 * Does this file render JSX? The scope of the rule, in one function.
 *
 * Comment- and string-stripped, and deliberately narrow: `Promise<Quiz>` and
 * `useState<Record<string, string>>` are type arguments, and no type argument is followed by an
 * attribute or written as a closing tag. A component whose only element is self-closing without
 * attributes (`<Foo/>`) is caught by the same rule as a closing tag one line down; the tree has
 * none, and a rule that guesses at one would rather be widened than silently wrong.
 */
export function exportsJsx(source: string): boolean {
  return JSX_ELEMENT.test(code(source));
}

/** Which components the rule is measured over. */
export function ancestorCensus(files: readonly AncestorSource[]): AncestorCensus {
  let withAncestor = 0;
  let approved = 0;
  for (const file of files) {
    const header = readAncestorHeader(file.source);
    if (header === null) continue;
    if (header.kind === "ancestor") withAncestor += 1;
    else if (header.kind === "none") approved += 1;
  }
  return { walked: files.length, withAncestor, approved };
}

/** Follow a header's ancestor through the files that were walked. */
function cycleOf(
  files: readonly AncestorSource[],
  headers: ReadonlyMap<string, AncestorHeader>,
): string | null {
  const colours = new Map<string, "open" | "done">();

  const step = (path: string, trail: string[]): string | null => {
    if (colours.get(path) === "done") return null;
    const at = trail.indexOf(path);
    if (colours.get(path) === "open" && at !== -1) {
      return [...trail.slice(at), path].join(" → ");
    }
    const header = headers.get(path);
    if (header === undefined || header.kind !== "ancestor") return null;
    // A self-reference has its own line, so it is not reported twice.
    if (header.ancestor === path) return null;
    colours.set(path, "open");
    const found = step(header.ancestor, [...trail, path]);
    colours.set(path, "done");
    return found;
  };

  for (const file of files) {
    const found = step(file.path, []);
    if (found !== null) return found;
  }
  return null;
}

/**
 * Every violation of the rule, as data. One finding per file, in path order, so a red run lists the
 * work rather than the first item of it.
 */
export function templateAncestorFindings(
  input: TemplateAncestorInput,
): readonly TemplateAncestorFinding[] {
  const findings: TemplateAncestorFinding[] = [];
  const fail = (message: string) => findings.push({ rule: "E35", message });

  if (input.files.length === 0) {
    return [
      {
        rule: "E35",
        message:
          "the template-ancestor walk read 0 components: components/ was not walked, so every header in this tree is unchecked",
      },
    ];
  }

  const walked = new Set(input.files.map((file) => file.path));
  const exemptions = new Map(input.exemptions.map((row) => [row.file, row]));
  const headers = new Map<string, AncestorHeader>();

  for (const file of input.files) {
    const header = readAncestorHeader(file.source);
    if (header === null) {
      fail(
        `${file.path}: no template-ancestor header in its first comment block — name the surface it varies, "template-ancestor: components/<path>.tsx   (variation: what changes)", or record an approval, "template-ancestor: none — approved #<issue>" plus a row in TEMPLATE_ANCESTOR_EXEMPTIONS (#336)`,
      );
      continue;
    }
    headers.set(file.path, header);

    if (header.kind === "malformed") {
      fail(
        `${file.path}: its template-ancestor header reads "${header.raw}", which is neither "components/<path>.tsx   (variation: …)" nor "none — approved #<issue>"`,
      );
      continue;
    }

    if (header.kind === "none") {
      const row = exemptions.get(file.path);
      if (row === undefined) {
        fail(
          `${file.path}: claims an approved exception (#${header.issue}) that TEMPLATE_ANCESTOR_EXEMPTIONS does not carry — the list only shrinks, so a new exception needs the owner's approval on the issue first (#336)`,
        );
      } else if (row.issue !== header.issue) {
        fail(
          `${file.path}: its header is approved on #${header.issue} and TEMPLATE_ANCESTOR_EXEMPTIONS records #${row.issue} — one surface, one approval`,
        );
      }
      continue;
    }

    const row = exemptions.get(file.path);
    if (row !== undefined) {
      fail(
        `${file.path}: names ${header.ancestor} as its template ancestor and is still listed in TEMPLATE_ANCESTOR_EXEMPTIONS (#${row.issue}) — the rebuild landed, so delete the row: the list only shrinks`,
      );
    }
    if (header.ancestor === file.path) {
      fail(
        `${file.path}: names itself as its template ancestor — a variation of itself is the hand-bake this rule exists to catch`,
      );
      continue;
    }
    if (!header.ancestor.startsWith("components/")) {
      fail(
        `${file.path}: names "${header.ancestor}" as its template ancestor, and an ancestor is a component under components/ — name the file the pattern is copied from`,
      );
      continue;
    }
    if (!input.exists(header.ancestor)) {
      fail(
        `${file.path}: names ${header.ancestor} as its template ancestor and no such file exists — a fabricated ancestor is worse than none`,
      );
      continue;
    }
    if (header.variation.replace(/[.\s]/g, "").length < 8) {
      fail(
        `${file.path}: names ${header.ancestor} but its "(variation: …)" says nothing — the variation is the half a reviewer checks, so say what changes`,
      );
    }
  }

  for (const row of input.exemptions) {
    if (!walked.has(row.file)) {
      fail(
        `${row.file}: is in TEMPLATE_ANCESTOR_EXEMPTIONS and the walk did not find it among the components — delete the row (the list only shrinks)`,
      );
    }
  }

  const cycle = cycleOf(input.files, headers);
  if (cycle !== null) {
    fail(
      `${cycle}: a template ancestry that closes on itself — a variation copies a template, so no file can be its own ancestor's ancestor (#336)`,
    );
  }

  return findings;
}
