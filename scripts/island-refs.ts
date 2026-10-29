/**
 * island-refs — the fixtures a component writes into itself.
 *
 * `docs/P2-INVENTORY.md` counted 68 literals in WU-3 alone: a search page carrying 8 quizzes,
 * 6 categories, 4 creators and 4 pages, plus a chat component carrying 5 contacts and 6
 * messages. None of those rows existed in `data/`; none of them could be edited by changing a
 * fixture. Two checks make that shape impossible to reintroduce:
 *
 *   moduleRecordArrays()  `const rows = [ {…}, {…} ]` at module scope: an island — a record
 *                         array a component owns, instead of importing one from `data/`.
 *   copiedFixtureText()   a value that lives in a fixture appearing verbatim in a component,
 *                         whether as a string literal, a JSX text node or a comment.
 *
 * Deliberately structural and static, like `ui-refs.ts`: no TypeScript program, no evaluation,
 * no filesystem. `scripts/data-check.ts` walks the UI tree and passes the sources in, and
 * `scripts/__tests__/island-refs.test.ts` exercises the scanners directly — including the
 * function-scoped arrays and single-object arrays that must *not* be flagged, because a check
 * that cannot tell `useState([...])` from a fixture is a check someone deletes.
 */
import type { SourceFile, UiReference } from "./ui-refs";

export interface RecordArray extends UiReference {
  /** The declaration name, so the diagnostic can say what to delete or move. */
  name: string;
  /** Number of top-level object literals inside the array. */
  records: number;
}

/** `const x = [`, `export const x: T[] = [`. Arrow bodies (`= () => [`) never match. */
const DECLARATION = /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*(?::[^=\n]+)?=\s*\[/gm;

/**
 * Walk from `[` (at `start`) to its matching `]`, counting `{` at depth 1. Strings, template
 * literals and comments are skipped so a `{` inside a message body is not a record.
 */
function scanArray(source: string, start: number): { records: number; end: number } | undefined {
  let depth = 0;
  let records = 0;

  for (let i = start; i < source.length; i++) {
    const char = source[i];
    const next = source[i + 1];

    if (char === "/" && next === "/") {
      const newline = source.indexOf("\n", i);
      if (newline === -1) return { records, end: source.length };
      i = newline;
      continue;
    }
    if (char === "/" && next === "*") {
      const close = source.indexOf("*/", i + 2);
      if (close === -1) return { records, end: source.length };
      i = close + 1;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      for (let j = i + 1; j < source.length; j++) {
        if (source[j] === "\\") {
          j++;
          continue;
        }
        if (source[j] === char) {
          i = j;
          break;
        }
        if (char !== "`" && source[j] === "\n") {
          // An unterminated quote on one line: stop here rather than swallow the file.
          i = j - 1;
          break;
        }
      }
      continue;
    }

    if (char === "[") depth++;
    else if (char === "]") {
      depth--;
      if (depth === 0) return { records, end: i };
    } else if (char === "{" && depth === 1) records++;
  }

  return undefined;
}

function lineAt(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (source.charCodeAt(i) === 10) line++;
  return line;
}

/**
 * Every module-scope array of record objects. One object is a lookup, zero is a label list;
 * two or more is a collection, and a collection belongs in `data/`.
 */
export function moduleRecordArrays(files: SourceFile[]): RecordArray[] {
  const found: RecordArray[] = [];

  for (const file of files) {
    DECLARATION.lastIndex = 0;
    for (
      let match = DECLARATION.exec(file.source);
      match !== null;
      match = DECLARATION.exec(file.source)
    ) {
      const open = match.index + match[0].length - 1;
      const scanned = scanArray(file.source, open);
      if (!scanned || scanned.records < 2) continue;
      found.push({
        file: file.path,
        line: lineAt(file.source, match.index),
        name: match[1],
        records: scanned.records,
        value: match[1],
      });
    }
  }

  return found.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

/**
 * Fixture values that appear verbatim in a UI file. `minLength` exists so a category called
 * `Art` is not a hit on every `"Art"` in the tree — a copied row is a sentence, not a word.
 */
export function copiedFixtureText(
  files: SourceFile[],
  values: readonly string[],
  minLength = 12,
): UiReference[] {
  const needles = [...new Set(values.map((value) => value.trim()))].filter(
    (value) => value.length >= minLength,
  );
  const found: UiReference[] = [];

  for (const file of files) {
    for (const needle of needles) {
      for (let at = file.source.indexOf(needle); at !== -1; at = file.source.indexOf(needle, at)) {
        found.push({ file: file.path, line: lineAt(file.source, at), value: needle });
        at += needle.length;
      }
    }
  }

  return found.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}
