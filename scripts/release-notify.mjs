#!/usr/bin/env node
// scripts/release-notify.mjs — the stakeholder release note, sent once per tag (#548).
//
//   node --import ./scripts/ts-modules.mjs scripts/release-notify.mjs --tag v1.4.0
//   node --import ./scripts/ts-modules.mjs scripts/release-notify.mjs --tag v1.4.0 --dry-run
//   node --import ./scripts/ts-modules.mjs scripts/release-notify.mjs --changelog /path/to/CHANGELOG.md
//
// What it does, in the order it matters:
//
//   1. Reads `CHANGELOG.md` and takes the section for the tag (`lib/email/release-note.ts`), which
//      already carries the Known limits block — the mail includes it verbatim, and a section
//      without one is refused rather than sent.
//   2. Renders it through the band (`lib/email/band.ts`), **text first**, HTML derived from it.
//   3. Checks the `release-mail` ledger for this tag. A tag that is already recorded sends
//      nothing: a re-run, a re-pushed workflow or a manually replayed job is a no-op that says so.
//   4. Sends through Resend — the same endpoint and the same request shape `lib/contact/mail.ts`
//      and `lib/flow/email.ts` use, no client, no dependency — from `RESEND_FROM` to
//      `STAKEHOLDERS` (comma-separated).
//   5. **No `RESEND_API_KEY` is not a failure.** The fully rendered mail is printed and the script
//      exits 0: a fork, a secret-less clone or a local run must not go red, and it must not go
//      quiet either — the printed mail is the evidence. The same is true of `--dry-run`, which
//      never sends and never records.
//
// **The ledger is a repository issue, and it is the idempotency record.** Chosen over a row in
// `email_event` because the workflow has no database credential and should not get one for this:
// a delivery row is about one message to one address, while this is about one *tag* and belongs
// next to the release it describes. The issue is titled `release-mail · sent tags`, is found by
// exact title (paged, not searched — GitHub's search index lags and a lagged lookup would send
// twice), and carries one comment per sent tag marked `<!-- release-mail: v1.4.0 -->`. The ledger
// title can be overridden with `RELEASE_MAIL_LEDGER_TITLE` (a rehearsal must not consume the
// release it is rehearsing) and the repository with `GITHUB_REPOSITORY` or `RELEASE_MAIL_REPO`.
//
// Exit: 0 sent · 0 already sent · 0 dry run (printed, nothing sent) · 1 refused.
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { brand } from "@/data/brand";
import { renderEmail } from "@/lib/email/band";
import { changelogSection, releaseNoteDocument, versionOfTag } from "@/lib/email/release-note";
import { mailKeyMode } from "@/lib/email/key-mode";
import { DEFAULT_FROM, mailEndpoint } from "@/lib/flow/email";

const DEFAULT_LEDGER_TITLE = "release-mail · sent tags";

/** `--flag value` pairs and bare flags, without a dependency. */
function parseArgs(argv) {
  const args = { dryRun: false, tag: undefined, changelog: undefined, htmlOut: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--tag") {
      args.tag = argv[index + 1];
      index += 1;
    } else if (arg === "--changelog") {
      args.changelog = argv[index + 1];
      index += 1;
    } else if (arg === "--html-out") {
      args.htmlOut = argv[index + 1];
      index += 1;
    } else {
      fail(`unknown argument ${arg}`);
    }
  }
  return args;
}

function say(line = "") {
  console.log(line);
}

function fail(message) {
  console.error(`release-notify: ${message}`);
  process.exit(1);
}

function summary(markdown) {
  const path = process.env.GITHUB_STEP_SUMMARY;
  if (!path) return;
  appendFileSync(path, `${markdown}\n`);
}

function packageVersion() {
  return JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")).version;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The repository the ledger lives in. `GITHUB_REPOSITORY` is set by Actions, `RELEASE_MAIL_REPO` wins. */
function repository() {
  const configured = (process.env.RELEASE_MAIL_REPO ?? process.env.GITHUB_REPOSITORY ?? "").trim();
  if (configured !== "") return configured;
  try {
    return execFileSync("gh", ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"], {
      encoding: "utf8",
      env: ghEnv(),
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    fail(
      "no repository for the release-mail ledger — set GITHUB_REPOSITORY (Actions does) or RELEASE_MAIL_REPO, and make `gh` available",
    );
  }
}

function ghEnv() {
  const token = (process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? "").trim();
  return token === "" ? process.env : { ...process.env, GH_TOKEN: token };
}

/** One `gh api` call, parsed. A failure is a refusal: the ledger check cannot be skipped. */
function ghApi(path, { method = "GET", fields } = {}) {
  const argv = ["api", "--method", method, path];
  for (const [key, value] of Object.entries(fields ?? {})) {
    argv.push("-f", `${key}=${value}`);
  }
  try {
    const out = execFileSync("gh", argv, {
      encoding: "utf8",
      env: ghEnv(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    return JSON.parse(out === "" ? "null" : out);
  } catch (error) {
    const detail = error instanceof Error ? error.message.split("\n")[0] : String(error);
    fail(
      `the release-mail ledger is unreachable (${detail}) — refusing to send without a way to record it`,
    );
  }
}

/** Every row of a paged list endpoint. Not search: the index lags and a lagged lookup double-sends. */
function ghPaged(path) {
  const rows = [];
  for (let page = 1; page <= 20; page += 1) {
    const separator = path.includes("?") ? "&" : "?";
    const chunk = ghApi(`${path}${separator}per_page=100&page=${page}`);
    if (!Array.isArray(chunk))
      fail(`the release-mail ledger answered an unexpected shape for ${path}`);
    rows.push(...chunk);
    if (chunk.length < 100) break;
  }
  return rows;
}

/** The ledger issue, created on first use. Returns its number and url. */
function ledgerIssue(repo, title) {
  const issues = ghPaged(`repos/${repo}/issues?state=all`);
  const existing = issues.find(
    (issue) => issue.title === title && issue.pull_request === undefined,
  );
  if (existing) return { number: existing.number, url: existing.html_url, created: false };
  const created = ghApi(`repos/${repo}/issues`, {
    method: "POST",
    fields: {
      title,
      body: [
        "One comment per tag whose release note went out, written by `.github/workflows/release-notify.yml`.",
        "",
        "A tag with a `release-mail: <tag>` comment below it is never mailed twice — that is the whole record.",
        "Do not delete a comment to force a resend; re-run the workflow with `RELEASE_MAIL_LEDGER_TITLE` set to a rehearsal ledger instead.",
      ].join("\n"),
    },
  });
  return { number: created.number, url: created.html_url, created: true };
}

/** The comment that records this tag, if there is one. */
function sentComment(repo, number, tag) {
  const marker = new RegExp(`<!--\\s*release-mail:\\s*${escapeRegExp(tag)}\\s*-->`);
  const comments = ghPaged(`repos/${repo}/issues/${number}/comments`);
  return comments.find((comment) => marker.test(comment.body ?? ""));
}

/** The provider id, or a refusal — a send with no id cannot be recorded, and an unrecorded send repeats. */
function providerId(body) {
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed?.id === "string" && parsed.id !== "") return parsed.id;
  } catch {
    // fall through to the refusal below
  }
  return undefined;
}

async function send({ from, to, subject, text, html, key }) {
  const response = await fetch(mailEndpoint(), {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to, subject, text, html }),
  });
  const body = await response.text();
  if (!response.ok) {
    // The provider echoes the request in its error body, so only the status reaches the log.
    fail(`the mail provider refused the message (HTTP ${response.status}) — nothing was recorded`);
  }
  const id = providerId(body);
  if (id === undefined)
    fail("the provider accepted the message but returned no id — nothing was recorded");
  return id;
}

function recipients() {
  return (process.env.STAKEHOLDERS ?? "")
    .split(",")
    .map((address) => address.trim())
    .filter((address) => address !== "");
}

function printMail(subject, text) {
  say("---8<--- rendered mail (text/plain, the source the HTML is derived from) ---8<---");
  say(`Subject: ${subject}`);
  say("");
  say(text.replace(/\n$/, ""));
  say("---8<--- end of mail ---8<---");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const tag = (args.tag ?? process.env.RELEASE_TAG ?? `v${packageVersion()}`).trim();
  const version = versionOfTag(tag);
  const changelogPath = args.changelog ?? join(process.cwd(), "CHANGELOG.md");

  say(`release-notify: tag ${tag} · version ${version} · brand ${brand.name}`);

  const changelog = readFileSync(changelogPath, "utf8");
  const section = changelogSection(changelog, version);
  if (section === undefined) {
    fail(`${changelogPath} carries no "## [${version}] - <date>" section — nothing to send`);
  }
  const document = releaseNoteDocument(section);
  const mode = mailKeyMode(process.env);
  const rendered = renderEmail(document, { emailClass: "transactional", mode });

  if (args.htmlOut) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(args.htmlOut, rendered.html, "utf8");
    say(`release-notify: html written to ${args.htmlOut}`);
  }

  const key = (process.env.RESEND_API_KEY ?? "").trim();
  if (mode === "unset" || args.dryRun) {
    printMail(document.subject, rendered.text);
    if (mode === "unset") {
      say("");
      say(
        "release-notify: dry run — RESEND_API_KEY is not set, so nothing was sent and nothing was recorded. The mail above is the evidence.",
      );
    } else {
      say("");
      say(
        "release-notify: dry run — --dry-run was given, so nothing was sent and nothing was recorded.",
      );
    }
    summary(
      [
        `### Release note ${tag} — dry run`,
        "",
        "No `RESEND_API_KEY` was available (or `--dry-run` was given), so the rendered mail is in the job log and nothing was sent.",
      ].join("\n"),
    );
    return 0;
  }

  const repo = repository();
  const ledgerTitle = (process.env.RELEASE_MAIL_LEDGER_TITLE ?? DEFAULT_LEDGER_TITLE).trim();
  const ledger = ledgerIssue(repo, ledgerTitle);
  say(`release-notify: ledger ${ledgerTitle} · ${ledger.url}${ledger.created ? " (created)" : ""}`);

  const already = sentComment(repo, ledger.number, tag);
  if (already !== undefined) {
    const stamp = (already.created_at ?? "").replace("T", " ").replace("Z", " UTC");
    const id = /id:\s*`?([^`\s]+)`?/.exec(already.body ?? "")?.[1] ?? "unknown";
    say(
      `release-notify: already sent for ${tag} · provider id ${id} · recorded ${stamp} — nothing sent`,
    );
    summary(
      [
        `### Release note ${tag} — already sent`,
        "",
        `Provider id \`${id}\`, recorded ${stamp}. This run sent nothing.`,
      ].join("\n"),
    );
    return 0;
  }

  const to = recipients();
  if (to.length === 0) {
    // Owner decision (2026-11-04): an unset recipient list is a rehearsal, not a failure — the same
    // evidence rule as a missing key. Print the whole mail, say what is missing, exit 0. A note that
    // goes nowhere has to be visible in the log, never a green tick over a send that never ran.
    printMail(document.subject, rendered.text);
    say("");
    say(
      "release-notify: dry run — RESEND_API_KEY is set but STAKEHOLDERS is empty, so nothing was sent and nothing was recorded. Add the comma-separated recipient list as a repository secret to send. The mail above is the evidence.",
    );
    summary(
      [
        `### Release note ${tag} — dry run`,
        "",
        "`STAKEHOLDERS` is not set, so there is no recipient list and nothing was sent. The rendered mail is in the job log.",
      ].join("\n"),
    );
    return 0;
  }
  const from = (process.env.RESEND_FROM ?? "").trim() || DEFAULT_FROM;

  printMail(document.subject, rendered.text);
  say("");
  say(
    `release-notify: sending · class transactional · mode ${mode} · from ${from} · ${to.length} recipient(s)`,
  );

  const id = await send({
    from,
    to,
    subject: document.subject,
    text: rendered.text,
    html: rendered.html,
    key,
  });
  const stamp = new Date().toISOString();
  say(`release-notify: sent ${tag} · provider id ${id}`);

  ghApi(`repos/${repo}/issues/${ledger.number}/comments`, {
    method: "POST",
    fields: {
      body: [
        `<!-- release-mail: ${tag} -->`,
        `Sent ${stamp} · \`${document.subject}\` · id: \`${id}\` · mode ${mode} · ${to.length} recipient(s).`,
      ].join("\n"),
    },
  });
  say(`release-notify: recorded ${tag} in ${ledger.url} — a re-run for this tag will send nothing`);

  summary(
    [
      `### Release note ${tag} — sent`,
      "",
      `Provider id \`${id}\` · ${to.length} recipient(s) · mode ${mode}.`,
    ].join("\n"),
  );
  return 0;
}

main().then((code) => process.exit(code));
