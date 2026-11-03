#!/usr/bin/env node
/**
 * scripts/release-limits.mjs — does the candidate Known limits block name anything the tree
 * does not carry?
 *
 * `scripts/release.sh --limits <file>` ships hand-written prose straight into public release
 * notes, and until this module existed nothing re-derived a single claim in it. v1.3.0 published
 * a bullet naming `lib/flow/paths.ts::answerPath` — the file exists, the binding never did — and
 * asserted that the navigation greys two routes no nav row names. Both were false, and both were
 * the GitHub Release body.
 *
 * `scripts/release.sh --check-limits <file>` runs this over the **candidate** block (the file a
 * human is about to hand to `--limits`), not over a published entry: `git show v<tag>:CHANGELOG.md`
 * is fixed text, and a check that can only report it cannot prevent it.
 *
 * What it resolves, and what it deliberately does not:
 *
 *   1. every file path the block names — a token ending in a known source extension, which is what
 *      makes it a path rather than a route, a version or a sentence — must exist in this tree, from
 *      the root;
 *   2. a `path::symbol` pair must resolve to a **binding** — the file may exist and still export
 *      nothing by that name, which is exactly the v1.3.0 failure, so file existence is not the
 *      test;
 *   3. a bare App Router fragment (`accept/page.tsx`) is not a root-relative path: it is a
 *      suffix match under `app/**`, and a fragment that matches more than one route file is a
 *      finding rather than a pass, because the bullet did not say which one;
 *   4. a glob that ends in such an extension (`components/**\/*.tsx`) must match at least one file;
 *   5. route claims are out of scope. "The block names a route that exists" needs
 *      `content/routes.ts` normalised over the `lib/flow/paths.ts` builders, and without that
 *      every correct bullet naming `/assessment/instances/<id>/answer` reads as a false positive.
 *      Absolute paths (`/assessment/...`), URLs and anything with whitespace inside its backticks
 *      are skipped, not judged;
 *   6. a rendered consequence — a nav row that greys, a CTA that is absent — is not a name in the
 *      tree and no file check can make it. The release note has to be honest about that.
 *
 * A retracted claim is a **struck-through** token: `~~`lib/flow/paths.ts::answerPath`~~` reads as
 * retracted to a human and is skipped here. That is the only way to name a symbol the tree does
 * not carry, it is deliberate (a strike is not typed by accident) and it is visible in the
 * rendered notes — an HTML comment would not be.
 *
 * CLI (the shell reads the stream *and* the exit status — same contract as release-version.mjs):
 *
 *   node scripts/release-limits.mjs check <file>    one `status<TAB>token<TAB>detail` line per
 *                                                   token; exit 0 none bad, 1 findings, 2 usage/IO
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Extensions a backticked token must end in to be read as a path in this repository.
 *
 * Deliberately a whitelist: `1.2.0`, `alignsynch.com/api/version` and `lib/flow/paths.ts::...`
 * are one token each only if the shape says so, and a bare `.env.local` (gitignored) must not be
 * read as a tracked file.
 */
const SOURCE_EXTENSIONS = new Set([
  "cjs",
  "css",
  "js",
  "json",
  "jsx",
  "md",
  "mdx",
  "mjs",
  "png",
  "scss",
  "sh",
  "sql",
  "svg",
  "toml",
  "ts",
  "tsx",
  "woff2",
  "yaml",
  "yml",
]);

/**
 * Next.js App Router special files.
 *
 * These are *segments*, not paths: `accept/page.tsx` is not `./accept/page.tsx` and never has
 * been. A bullet naming one means "the route whose last segment is this", so it is matched as a
 * suffix under `app/` — and a suffix that matches twice is a finding, because the bullet did not
 * say which route it meant.
 */
const ROUTE_FILES = new Set([
  "default.tsx",
  "error.tsx",
  "global-error.tsx",
  "layout.tsx",
  "loading.tsx",
  "not-found.tsx",
  "page.tsx",
  "route.ts",
  "template.tsx",
]);

/** Directories never walked: build output, dependencies, and this run's own caches. */
const SKIP_DIRECTORIES = new Set([
  ".datacheck",
  ".git",
  ".next",
  ".vercel",
  "coverage",
  "node_modules",
]);

const EXTENSION = /\.([A-Za-z0-9]+)$/;

/**
 * A token as it appears in the block, without the punctuation a sentence wraps it in.
 *
 * The backticks are already gone by the time this runs; this strips a trailing `)`/`.`/`"` that a
 * command line inside a span leaves behind (`node scripts/deploy-check.mjs --expect "…")`).
 */
export function tidy(word) {
  return word.replace(/^["'`([{]+/, "").replace(/[)"'`\]}.,;:]+$/, "");
}

/**
 * The path part of a `path::symbol` pair, or the token itself.
 *
 * `::` is the one separator the block uses to claim a binding; everything else is a file claim.
 */
export function pathPart(token) {
  const at = token.indexOf("::");
  return at === -1 ? token : token.slice(0, at);
}

/** The symbol half of a `path::symbol` pair, or "" when the token names no binding. */
export function symbolPart(token) {
  const at = token.indexOf("::");
  return at === -1 ? "" : token.slice(at + 2);
}

/**
 * Is this word a path in this repository at all?
 *
 * The test is a shape, not an existence check: only a token that could name a file (a whitelisted
 * extension, or a glob ending in one) is judged, so a route (`/assessment/...`), a URL, a version,
 * a commit sha and a shell command with spaces in it never become false findings.
 */
export function isPathToken(token) {
  if (!token || /\s/.test(token)) return false;
  if (token.includes("://") || token.includes("${") || token.includes("$(")) return false;
  // An absolute path is a route or a URL path, and route claims are out of scope (rule 5 above).
  if (token.startsWith("/") || token.startsWith("~") || token.startsWith("-")) return false;
  const extension = EXTENSION.exec(pathPart(token))?.[1] ?? "";
  return SOURCE_EXTENSIONS.has(extension.toLowerCase());
}

/** Every backticked span in the block, with the retracted ones marked rather than dropped. */
export function codeSpans(text) {
  const spans = [];
  for (const match of text.matchAll(/`([^`\n]+)`/g)) {
    // `~~` immediately outside the span is the retraction marker, so look at what precedes it.
    const before = text.slice(Math.max(0, match.index - 2), match.index);
    spans.push({ token: match[1].trim(), retracted: before === "~~" });
  }
  return spans;
}

/** `**` across segments, `*` within one — the two wildcards a release note actually uses. */
export function globToRegExp(pattern) {
  let source = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const character = pattern[i];
    if (character === "*") {
      if (pattern[i + 1] === "*") {
        i += 1;
        if (pattern[i + 1] === "/") {
          i += 1;
          source += "(?:[^/]+/)*";
        } else {
          source += ".*";
        }
      } else {
        source += "[^/]*";
      }
      continue;
    }
    if (character === "?") {
      source += "[^/]";
      continue;
    }
    source += character.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${source}$`);
}

/** Every file under `directory`, as root-relative POSIX paths. */
function walk(root, directory, found = []) {
  let entries;
  try {
    entries = readdirSync(join(root, directory), { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const child = directory ? `${directory}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name)) continue;
      walk(root, child, found);
    } else if (entry.isFile()) {
      found.push(child);
    }
  }
  return found;
}

/** The deepest directory a glob can be anchored at, so a `components/**` walk never scans the repo. */
function globAnchor(pattern) {
  const segments = pattern.split("/");
  const fixed = [];
  for (const segment of segments.slice(0, -1)) {
    if (segment.includes("*") || segment.includes("?")) break;
    fixed.push(segment);
  }
  return fixed.join("/");
}

/**
 * Resolve one file claim against the tree.
 *
 * `kind` is `file` (a root-relative path that exists), `route` (a fragment that matched exactly one
 * App Router file), `glob` (matched at least one file), `ambiguous` (a fragment that matched more
 * than one), or `missing`.
 */
export function resolveFile(root, token) {
  const path = pathPart(token);

  if (path.includes("*")) {
    const matcher = globToRegExp(path);
    const anchor = globAnchor(path);
    const files = walk(root, anchor).filter((file) => matcher.test(file));
    if (files.length === 0) return { kind: "missing", token, detail: `matches no file (${path})` };
    return { kind: "glob", token, detail: `${files.length} file(s)` };
  }

  if (isFile(join(root, path))) return { kind: "file", token, path };

  const name = path.split("/").pop() ?? path;
  if (ROUTE_FILES.has(name)) {
    const matches = walk(root, "app").filter(
      (file) =>
        file === path || (file.endsWith(`/${path}`) && file.slice(0, -path.length - 1).length > 0),
    );
    if (matches.length === 1) return { kind: "route", token, path: matches[0] };
    if (matches.length === 0) {
      return { kind: "missing", token, detail: `no file under app/ ends with ${path}` };
    }
    return {
      kind: "ambiguous",
      token,
      detail: `${matches.length} files under app/ end with ${path}: ${matches.slice(0, 4).join(", ")}${matches.length > 4 ? ", …" : ""} — name the parent segment that selects one`,
    };
  }

  return { kind: "missing", token, detail: "no such file in the tree" };
}

function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/**
 * The names a module exports, by declaration and by export list.
 *
 * Comments are stripped first: a doc block that mentions a symbol in prose must not satisfy a
 * claim about a binding. `export * from` is recorded as `*` so a miss can say the check does not
 * follow a re-export rather than pretending the file is bare.
 */
export function exportsOf(source) {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
  const names = new Set();

  const declarations =
    /\bexport\s+(?:declare\s+)?(?:async\s+)?(?:function|const|let|var|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/g;
  for (const match of text.matchAll(declarations)) names.add(match[1]);

  for (const match of text.matchAll(/\bexport\s+(?:type\s+)?\{([^}]*)\}/g)) {
    for (const part of match[1].split(",")) {
      const piece = part.trim().replace(/^type\s+/, "");
      if (!piece) continue;
      const alias = /\bas\s+([A-Za-z_$][\w$]*)$/.exec(piece);
      names.add(alias ? alias[1] : piece);
    }
  }

  if (/\bexport\s+default\b/.test(text)) names.add("default");
  if (/\bexport\s+\*\s+from\b/.test(text)) names.add("*");
  return names;
}

/**
 * Every token verdict for one block, in the order the block writes them.
 *
 * `status` is `ok`, `bad` or `skip`; release.sh owns the glyphs, this module owns the derivation.
 */
export function check(root, text) {
  const verdicts = [];
  const seen = new Set();

  for (const span of codeSpans(text)) {
    for (const raw of span.token.split(/\s+/)) {
      const token = tidy(raw);
      if (!isPathToken(token)) continue;
      if (seen.has(token)) continue;
      seen.add(token);

      if (span.retracted) {
        verdicts.push({
          status: "skip",
          token,
          detail: "struck through — a retracted name, not a claim this block makes",
        });
        continue;
      }

      const resolved = resolveFile(root, token);
      if (resolved.kind === "missing" || resolved.kind === "ambiguous") {
        verdicts.push({ status: "bad", token, detail: resolved.detail });
        continue;
      }

      const symbol = symbolPart(token);
      if (!symbol) {
        verdicts.push({
          status: "ok",
          token,
          detail:
            resolved.kind === "glob"
              ? resolved.detail
              : resolved.kind === "route"
                ? `is ${resolved.path}`
                : "file",
        });
        continue;
      }

      const target = join(root, resolved.path);
      let names;
      try {
        names = exportsOf(readFileSync(target, "utf8"));
      } catch {
        verdicts.push({ status: "bad", token, detail: `${resolved.path} could not be read` });
        continue;
      }

      if (names.has(symbol)) {
        verdicts.push({ status: "ok", token, detail: `exported by ${resolved.path}` });
        continue;
      }

      const listed = [...names].filter((name) => name !== "*").sort();
      const hint =
        listed.length === 0
          ? `${resolved.path} exports nothing`
          : `${resolved.path} exports ${listed.slice(0, 8).join(", ")}${listed.length > 8 ? ", …" : ""}`;
      verdicts.push({
        status: "bad",
        token,
        detail: names.has("*")
          ? `${hint} — and it re-exports \`*\`, which this check does not follow`
          : `${hint} — no binding named ${symbol}`,
      });
    }
  }

  return verdicts;
}

function main(argv) {
  const [mode, file] = argv;
  if (mode !== "check" || !file) {
    process.stderr.write("release-limits: usage: check <file>\n");
    return 2;
  }

  const root = fileURLToPath(new URL("..", import.meta.url));

  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    process.stderr.write(`release-limits: cannot read ${relative(process.cwd(), file) || file}\n`);
    return 2;
  }

  if (text.trim() === "") {
    process.stderr.write("release-limits: an empty file is not a Known limits block\n");
    return 2;
  }

  const verdicts = check(root, text);
  for (const verdict of verdicts) {
    process.stdout.write(`${verdict.status}\t${verdict.token}\t${verdict.detail}\n`);
  }
  return verdicts.some((verdict) => verdict.status === "bad") ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
