#!/usr/bin/env node
/**
 * scripts/gen-email-bodies.mjs — `content/email-bodies.md` becomes the bodies the app sends.
 *
 * **Why a generator and not a reader.** The markdown is the pen; a committed module is what the
 * build imports. Reading `content/email-bodies.md` at render time would put a file read on the
 * request path of every mail, and a mailbox is the one surface with no second render. So the
 * markdown is parsed here, once, and written whole to `lib/email/bodies.generated.ts` — committed,
 * because `pnpm build` and CI must work with no extra step. `--check` re-derives the file and
 * compares it byte for byte, which is the same shape `docs/glossary.md` + `glossary:check` has and
 * the same reason: a generated page that is not regenerated is a page that lies.
 *
 * **The findings, each with its own message and exit 1.** The card this file belongs to names six
 * proof cases, and each is a rule here rather than a promise:
 *
 *   1. a registered template with no section            -> `no section`
 *   2. a section with no fenced body                    -> `has no fenced text block`
 *   3. an empty body                                    -> `body is empty`
 *   4. a body still carrying the retired marker         -> `still carries the retired marker`
 *   5. a section naming a template that does not exist  -> `not a registered template`
 *   6. two sections naming the same template            -> `section appears twice`
 *
 * Two more, for the reasons the first six do not cover:
 *
 *   7. a `{{name}}` the template does not hold          -> `placeholder the template does not hold`
 *   8. the committed module disagreeing with this run   -> `is stale` (what `--check` exists for)
 *
 * **The retired marker is named here, and nowhere else.** `lib/email/band.ts` used to export a
 * `{{…}}` token that a template printed where its prose had not been written. Every body now has a
 * pen, so the token is gone from the tree — and a rule that cannot name the thing it refuses is not
 * a rule, so this file spells it once, in the one file the acceptance grep does not cover
 * (`--include=*.ts --include=*.md`). Nothing under `lib/`, `app/`, `components/`, `tests/` or
 * `content/` may carry it again.
 *
 * **Write mode writes first, then reports.** The module is a pure function of the sections, so it
 * is written as soon as the sections parse; a wiring finding (an orphan section, a template with no
 * section) is reported afterwards and the exit code is still non-zero. That is what makes the
 * bootstrap honest: the first run writes a file that mirrors the markdown exactly, and the second
 * run — after the register is wired — is the one that goes green.
 *
 * NO CLOCK, NO NETWORK, NO DATABASE. It imports the register (which imports `data/brand.ts`) and
 * reads one markdown file.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = "content/email-bodies.md";
const TARGET = "lib/email/bodies.generated.ts";

/** The token the band used to print where prose was unwritten. Named once — see the header. */
const RETIRED = "content_to_refine";

/** A `{{name}}` in a body: lower-case, digits and underscores, because that is what a fact is. */
const PLACEHOLDER = /\{\{\s*([a-z0-9_]+)\s*\}\}/g;

/** The fence a body must be: a language tag is required, and `text` is the one that means prose. */
const FENCE_OPEN = /^\s*```(\S*)\s*$/;
const FENCE_CLOSE = /^\s*```\s*$/;
const SECTION = /^##\s+(.+?)\s*$/;

/**
 * The markdown's sections, in file order.
 *
 * Fences win over headings, so a body may carry a `## ` heading of its own; anything before the
 * first `## ` is the file's own preamble and its fences are examples, not bodies. A section is a
 * heading plus the fenced blocks under it, and the body is the first of those.
 */
export function parseSections(markdown) {
  const findings = [];
  const sections = [];
  const lines = markdown.split("\n");
  let current = null;
  let fence = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const at = index + 1;

    if (fence !== null) {
      if (FENCE_CLOSE.test(line)) {
        if (current !== null)
          current.fences.push({ tag: fence.tag, at: fence.at, body: fence.lines.join("\n") });
        fence = null;
        continue;
      }
      fence.lines.push(line);
      continue;
    }

    const opened = FENCE_OPEN.exec(line);
    if (opened) {
      fence = { tag: opened[1] ?? "", at, lines: [] };
      continue;
    }

    const heading = SECTION.exec(line);
    if (heading) {
      current = { id: heading[1] ?? "", at, fences: [] };
      sections.push(current);
    }
  }

  if (fence !== null) {
    findings.push({ at: fence.at, message: "a fenced block is never closed" });
  }

  for (const section of sections) {
    if (section.fences.length === 0) {
      findings.push({
        id: section.id,
        at: section.at,
        message: `"${section.id}" has no fenced text block — a body is one \`\`\`text fence under the heading`,
      });
      continue;
    }
    if (section.fences.length > 1) {
      findings.push({
        id: section.id,
        at: section.fences[1].at,
        message: `"${section.id}" has ${section.fences.length} fenced blocks — a body is exactly one`,
      });
    }
  }

  for (const section of sections) {
    const body = section.fences[0];
    if (body === undefined) continue;
    if (body.tag !== "text") {
      findings.push({
        id: section.id,
        at: body.at,
        message: `"${section.id}" opens its body with \`\`\`${body.tag || "(no tag)"} — a body is \`\`\`text`,
      });
    }
    if (body.body.trim() === "") {
      findings.push({
        id: section.id,
        at: body.at,
        message: `"${section.id}" body is empty — a blank fence is a hole with a fence around it`,
      });
    }
    if (body.body.includes(RETIRED)) {
      findings.push({
        id: section.id,
        at: body.at,
        message: `"${section.id}" still carries the retired marker {{${RETIRED}}} — write the sentence or leave a TODO(owner) above the fence`,
      });
    }
  }

  const seen = new Map();
  for (const section of sections) {
    const first = seen.get(section.id);
    if (first !== undefined) {
      findings.push({
        id: section.id,
        message: `"${section.id}" section appears twice — the first is at line ${first} and the second at line ${section.at}`,
      });
    } else {
      seen.set(section.id, section.at);
    }
  }

  return { sections, findings };
}

/** The module text a set of sections produces. Pure, so `--check` and a write agree by construction. */
export function renderModule(bodies) {
  const entries = bodies
    .map(([id, body]) => `  ${JSON.stringify(id)}: ${JSON.stringify(body)},`)
    .join("\n");
  return `// GENERATED FILE — do not edit.
//
// Written whole by \`scripts/gen-email-bodies.mjs\` from \`content/email-bodies.md\` and compared byte
// for byte by \`pnpm email:bodies:check\`, which the gate runs in every lane. Editing this file by
// hand is caught: the check re-derives it from the markdown and fails when the two disagree.
export const EMAIL_BODIES = {
${entries}
} as const;

export type EmailBodyId = keyof typeof EMAIL_BODIES;
`;
}

/** Where each finding goes: the section's id when it has one, and the markdown line when it does. */
function label(finding) {
  const where = finding.id === undefined ? "" : `${finding.id}: `;
  return finding.at === undefined
    ? `${where}${finding.message}`
    : `${where}${finding.message} (line ${finding.at})`;
}

async function main() {
  const check = process.argv.includes("--check");
  const markdown = readFileSync(join(ROOT, SOURCE), "utf8");
  const { sections, findings } = parseSections(markdown);

  // The one finding that is about a column rather than the file: the same id twice.
  const ids = sections.map((section) => section.id);
  const unique = [...new Set(ids)];

  const bodies = unique.map((id) => {
    const section = sections.find((candidate) => candidate.id === id);
    return [id, (section?.fences[0]?.body ?? "").replace(/\r\n/g, "\n").replace(/\s+$/, "")];
  });

  const structural = findings.length > 0;
  const rendered = renderModule(bodies);

  if (!check && !structural) {
    writeFileSync(join(ROOT, TARGET), rendered, "utf8");
  }

  let register;
  try {
    register = await import("@/lib/email/templates");
  } catch (error) {
    process.stderr.write(
      `email:bodies — the register could not be imported: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.stderr.write(
      `email:bodies — if ${TARGET} was hand-edited, run \`pnpm email:bodies\` to rewrite it from ${SOURCE}\n`,
    );
    process.exit(1);
  }

  const wired = register.EMAIL_TEMPLATES.filter((template) => template.body !== undefined);

  for (const template of register.EMAIL_TEMPLATES) {
    const hasSection = unique.includes(template.id);
    if (template.body === undefined) {
      if (hasSection) {
        findings.push({
          id: template.id,
          message: `"${template.id}" is registered as carrying its own body in code, but ${SOURCE} has a section for it — one of the two is wrong`,
        });
      }
      continue;
    }
    if (template.body.id !== template.id) {
      findings.push({
        id: template.id,
        message: `"${template.id}" points its body at section "${template.body.id}" — the section must be named by the template's own id`,
      });
    }
    if (!hasSection) {
      findings.push({
        id: template.id,
        message: `"${template.id}" is a registered template with no section in ${SOURCE} — every template that reads its body from this file needs one`,
      });
    }
  }

  for (const id of unique) {
    if (!wired.some((template) => template.id === id)) {
      findings.push({
        id,
        message: `"${id}" is not a registered template — an orphan section is a body nothing will ever send, so it is a finding rather than a warning`,
      });
    }
  }

  for (const template of wired) {
    const section = sections.find((candidate) => candidate.id === template.id);
    const body = section?.fences[0]?.body ?? "";
    const declared = new Set(template.body.placeholders);
    for (const match of body.matchAll(PLACEHOLDER)) {
      const name = match[1];
      if (!declared.has(name)) {
        findings.push({
          id: template.id,
          message: `"${template.id}" body uses {{${name}}}, a placeholder the template does not hold — it holds ${[...declared].join(", ")}`,
        });
      }
    }
  }

  let stale = false;
  if (check && findings.length === 0) {
    let actual = "";
    try {
      actual = readFileSync(join(ROOT, TARGET), "utf8");
    } catch {
      actual = "";
    }
    if (actual !== rendered) {
      stale = true;
      findings.push({
        message: `${TARGET} is stale — it is not what ${SOURCE} generates. Run \`pnpm email:bodies\` and commit the result; never hand-edit it`,
      });
    }
  }

  const census = `${wired.length} templates read a body from ${SOURCE}, ${unique.length} sections, ${register.EMAIL_TEMPLATES.length - wired.length} registered templates carry their own body in code`;
  if (findings.length === 0) {
    process.stdout.write(
      `email:bodies — ${census}; ${check ? `${TARGET} is current` : `${TARGET} written`}\n`,
    );
    process.exit(0);
  }

  process.stderr.write(`email:bodies — ${census}\n`);
  for (const finding of findings) process.stderr.write(`  ✗ ${label(finding)}\n`);
  if (stale) {
    process.stderr.write(`  fix the file above, then run \`pnpm email:bodies\`\n`);
  }
  process.exit(1);
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
