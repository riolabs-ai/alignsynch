/**
 * `/admin/health` — the platform-health screen's copy (#508).
 *
 * Every word on the screen is here, and the rule the fixture encodes is the card's: **a number
 * without a source is a defect**. So the items come in pairs — a value template and the source
 * template beside it — and the view has no sentence of its own to fall back on:
 *
 *   - `sources/live` and `sources/recorded` are the two provenances the read can produce. A live
 *     fact prints the command that measured it and the words "this checkout"; a recorded one
 *     prints the artifact and the instant it was written. There is no third option, because there
 *     is no third place a value comes from.
 *   - `mismatch-*` is the loud state #443 asks for, one sentence per disagreement, and its
 *     placeholders are filled from the facts — this fixture never names a version.
 *   - `alarm` and `quiet` are the two answers to production-behind, and they differ **only** in
 *     whether the count crossed the limit. The count is in both, so the quiet state is a measurement
 *     too rather than an absence of one.
 *
 * `violations-none` is a sentence, not an empty list: "no violation on the last recorded run" is a
 * fact about a run, and a table with no rows would read as a page that failed to load one.
 *
 * **`stale-action` hands an operator a command, so it is the one line here that must run (#696).**
 * It printed `pnpm health:record --db --gate`, and `--gate` without `--carry` (or a `--ci` window)
 * throws `gate: this run did not measure it and --carry was not given` — a remedy that stops is the
 * worst answer to a stuck operator, and since #961 `release.sh --tag-only` refuses the cut on a
 * record naming the wrong version, so this line is the documented fix for the exact failure the
 * release path refuses on. Its `body` therefore names the environment too: the record is written
 * from the demo branch and nothing else, so a shell holding production credentials is stopped by
 * name rather than left to guess. `tests/admin-health-stale-remedy.test.ts` holds the command to
 * `package.json` and to the recorder's own flags, so the two cannot drift again.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const adminHealthPageCopy: PageCopy = zPageCopy.parse({
  heading: "Platform health",
  subtitle:
    "The four measurements the last two incidents were diagnosed by hand: what db:verify said, what the gate cost, whether the release is one release, and how far production trails main. This screen reads; it has no action that writes.",
  sections: [
    {
      id: "freshness",
      heading: "Record freshness",
      body: "The four measurements below come from one committed record, so their age is part of their meaning. The window is declared (PLATFORM_HEALTH_FRESHNESS_HOURS, default 72 hours) and the age is measured against the instant this page was requested — a record past its window is drawn as a failure, never as status.",
      items: [
        { id: "stale-heading", label: "The record is stale — nothing below is current" },
        {
          id: "stale-body",
          label:
            "This record was written at {at}, {hours} h before this page was requested, which is past the {window} h freshness window. Every measurement below is history: a stale record is a failed check, not a quiet one.",
        },
        {
          id: "stale-action",
          label:
            "Re-record before acting: `pnpm health:record --db --gate --carry`, run from a checkout holding the demo branch's credentials.",
          body: "Those credentials are that branch's `DATABASE_URL` in `.env.local` at the repo root, which `neon env pull` writes. The record is written from the demo branch and nothing else: the recorder refuses a production connection string, a copy of demo, and a shell with no `DATABASE_URL` — naming the fact that refused it, before it measures anything — so production credentials stop the command rather than writing a partial record. `--carry` keeps the CI-yield block this run did not measure; `--ci <the completed UTC day>` re-derives it instead. Then commit `data/health/platform-health.json`: this page renders the committed file.",
        },
        {
          id: "fresh-line",
          label: "Recorded {at} — {hours} h old, inside the {window} h freshness window.",
        },
        { id: "window-problem", label: "{problem}" },
      ],
    },
    {
      id: "db-verify",
      heading: "Database checks",
      body: "The last recorded run of `pnpm db:verify`. The rule code is the one the script prints, so a failing line here can be pasted into an incident beside the run that produced it — nothing on this page executes the script.",
      items: [
        { id: "result-label", label: "Result" },
        { id: "result-pass", label: "Pass" },
        { id: "result-fail", label: "Fail" },
        { id: "result-error", label: "Error" },
        { id: "result-not-run", label: "Not run" },
        { id: "ran-at-label", label: "Last run" },
        { id: "database-label", label: "Database" },
        { id: "exit-code-label", label: "Exit code {code}" },
        { id: "violations-label", label: "Failing rules" },
        {
          id: "violations-none",
          label: "No violation was recorded on the last run.",
          body: "An empty list here is the script's own verdict, not a check that did not happen — the run and its time are above.",
        },
        { id: "rule", label: "Rule {code}" },
      ],
    },
    {
      id: "gate",
      heading: "Gate health",
      body: "The last verification run this machine recorded, and the CI first-pass yield beside it. The yield is head SHAs whose first run was green, over the head SHAs that ran at all — the definition docs/operations/gate.md gives, re-derived by the command printed under it.",
      items: [
        { id: "lane-label", label: "Lane" },
        { id: "duration-label", label: "Duration" },
        { id: "duration-value", label: "{seconds} s" },
        { id: "yield-label", label: "CI first-pass yield" },
        {
          id: "yield-value",
          label: "{successes} of {runs} head SHAs green on their first run ({percent}%)",
        },
        { id: "window-label", label: "Window {window}" },
        { id: "latency-label", label: "A run including queue: p50 {p50} s, p95 {p95} s" },
      ],
    },
    {
      id: "release",
      heading: "Release truth",
      body: "The tag, the file and production, side by side. These three agreed by hand-checking for two days; the alarm below is what makes a disagreement impossible to read past.",
      items: [
        { id: "package-label", label: "package.json version" },
        { id: "tag-label", label: "Latest tag" },
        { id: "production-label", label: "Production version" },
        { id: "production-commit-label", label: "Production commit" },
        { id: "main-label", label: "origin/main commit" },
        { id: "quiet", label: "The tag, package.json and production name the same release." },
        { id: "alarm-heading", label: "This is not one release" },
        {
          id: "mismatch-version-tag",
          label:
            "The latest tag is {tag} and package.json says {version} — a tag was cut ahead of the file, or the file was bumped without one.",
        },
        {
          id: "mismatch-production-version",
          label: "Production serves {served} while package.json says {version}.",
        },
        {
          id: "mismatch-production-commit",
          label: "Production is on {commit}, not origin/main's {main}.",
        },
      ],
    },
    {
      id: "deploy",
      heading: "Deploy state",
      body: "What production answered the last time it was probed, and the distance from that commit to main. The distance is counted by the command printed under it; the alarm fires only when the count passes the limit, and the limit is an operator setting with a default of five.",
      items: [
        { id: "state-label", label: "Production" },
        { id: "state-answering", label: "Answering" },
        { id: "state-unreachable", label: "Unreachable" },
        { id: "probe-label", label: "Probed" },
        { id: "version-label", label: "Version" },
        { id: "behind-label", label: "Behind main" },
        { id: "behind-value", label: "{behind} commits" },
        { id: "behind-value-one", label: "{behind} commit" },
        { id: "limit-label", label: "Alarm above" },
        { id: "limit-value", label: "{limit} commits" },
        { id: "limit-value-one", label: "{limit} commit" },
        { id: "alarm-heading", label: "Production is behind" },
        {
          id: "alarm",
          label:
            "Production is {behind} commits behind main, over the {limit}-commit limit — the last deploy on record is {commit}.",
        },
        {
          id: "alarm-one",
          label:
            "Production is {behind} commit behind main, over the {limit}-commit limit — the last deploy on record is {commit}.",
        },
        {
          id: "quiet",
          label: "Production is {behind} commits behind main, inside the {limit}-commit limit.",
        },
        {
          id: "quiet-one",
          label: "Production is {behind} commit behind main, inside the {limit}-commit limit.",
        },
        { id: "limit-problem", label: "{problem}" },
      ],
    },
    {
      id: "sources",
      heading: "Where every number came from",
      body: "Each value on this page carries its own source. A live one was measured in this checkout and names the command; a recorded one comes from the artifact below and names the instant it was written. There is no value on this screen without one of the two.",
      items: [
        { id: "live", label: "{command} · this checkout" },
        { id: "recorded", label: "recorded {at}" },
        { id: "record", label: "data/health/platform-health.json" },
        { id: "recorder", label: "Written by {command}" },
        { id: "config-env", label: "{variable} · this environment" },
        { id: "config-default", label: "default · {variable} is not set" },
      ],
    },
    {
      id: "unreadable",
      heading: "The health record could not be read",
      body: "This screen renders one recorded artifact, and this request did not get it. No number below was guessed or reused, and nothing here is a zero standing in for a measurement.",
      items: [{ id: "reason", label: "{reason}" }],
    },
  ],
});
