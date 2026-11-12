/**
 * template-ancestor: components/my-quizzes/quiz-statistics.tsx   (variation: the statistics page's labelled stat cards become four read-only health panels — the numbers come from one recorded artifact and this checkout instead of a quiz's stats, every card carries its own source line, and the release/deploy disagreement replaces the tabs)
 *
 * `/admin/health` — the platform-health screen, for an operator (#508).
 *
 * **The template, and the axes it varies.** This is `QuizStatistics`'s "Quiz Info" band: a card
 * with a `CardHeader`, then a `grid grid-cols-2 gap-4 sm:grid-cols-4` of `label / value` pairs, and
 * one `Card` per subject under it.
 *
 *   quiz-statistics             this screen
 *   --------------------------  -------------------------------------------------
 *   a quiz's plays/score/time   four platform measurements, one card each
 *   value, then nothing         value, then its **source** — the rule this card is
 *                               about; a number with no source is a defect
 *   tabs over one record        no tabs: the four cards are always all visible,
 *                               because an operator opening this page is asking
 *                               "is anything wrong" and a hidden panel is not
 *                               an answer
 *   coloured chart fills        status badges only (`success` / `destructive` /
 *                               `warning` / `muted`), never a palette step
 *
 * **No `"use client"`.** Every value is decided on the server (a file read, a git call, one
 * recorded artifact) and passed down as props; nothing here holds state, and the screen ships no
 * JavaScript. That is also what lets the parity harness render it: a client component would need a
 * provider the harness does not mount.
 *
 * **The alarm is not a colour.** A mismatch renders a `Card` with a destructive border, a badge and
 * the sentences that disagree — and when the three values agree the card says so in words, because
 * an operator cannot tell "all clear" from "the panel failed to render" otherwise.
 */
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTimeLong } from "@/content/core";
import type { PageCopy, PageCopySection } from "@/content/pages";
import type { HealthFacts, Measured, ReleaseMismatch } from "@/lib/admin/platform-health";
import type { PlatformHealthDbVerify } from "@/content/platform-health";
import { fillLabel, itemBody, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import { AlertTriangle, Database, GitBranch, Rocket, Timer } from "lucide-react";
import type { ReactNode } from "react";

/**
 * One stat: a caption, the number, and where it was measured.
 *
 * The ancestor's `text-sm text-muted-foreground` / `text-2xl font-bold` pair, plus the source line
 * that turns a number into a fact. `tabular-nums` keeps four cards' counts on one optical column.
 */
function Stat({
  label,
  value,
  source,
  small,
  tone,
}: {
  label: string;
  value: string;
  source: string;
  small?: boolean;
  tone?: "destructive";
}) {
  const valueClass = small
    ? "text-sm font-medium"
    : tone === "destructive"
      ? "text-2xl font-bold tabular-nums text-destructive"
      : "text-2xl font-bold tabular-nums";
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={valueClass}>{value}</p>
      <p className="text-xs text-muted-foreground">{source}</p>
    </div>
  );
}

/**
 * A fact's provenance, in the copy's own words.
 *
 * `live` names the command this checkout answered with; `recorded` names the instant the artifact
 * was written. There is no third branch — a value with no `Measured` cannot reach this function,
 * which is the type doing the card's rule.
 */
function sourceText(copy: PageCopy, measured: Measured<string | number>): string {
  const sources = sectionOf(copy, "sources");
  if (measured.origin === "live") {
    return fillLabel(itemLabel(sources, "live"), { command: measured.command });
  }
  return fillLabel(itemLabel(sources, "recorded"), { at: formatDateTimeLong(measured.recordedAt) });
}

/** The record's own instant, for a value whose measurement is the recorded run itself. */
function recordedText(copy: PageCopy, iso: string): string {
  return sourceText(copy, { origin: "recorded", value: 0, recordedAt: iso });
}

/** A badge for the script's verdict. `not-run` is muted on purpose: absence is not a pass. */
function resultVariant(result: PlatformHealthDbVerify["result"]) {
  if (result === "pass") return "success" as const;
  if (result === "fail") return "destructive" as const;
  if (result === "error") return "warning" as const;
  return "muted" as const;
}

function SectionCard({
  section,
  icon,
  children,
}: {
  section: PageCopySection;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {section.heading ?? ""}
        </CardTitle>
        <CardDescription>{sectionBody(section)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">{children}</CardContent>
    </Card>
  );
}

/** The loud state: a destructive panel with the sentences that disagree, or the quiet sentence. */
function Alarm({
  heading,
  quiet,
  quietText,
  children,
}: {
  heading: string;
  quiet: boolean;
  quietText: string;
  children: ReactNode;
}) {
  if (quiet) return <p className="text-sm text-muted-foreground">{quietText}</p>;
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <AlertTriangle className="h-4 w-4" />
        {heading}
      </p>
      {children}
    </div>
  );
}

/**
 * The record's age (#599).
 *
 * A stale record is drawn as a **failure**, above the panels it invalidates, because the incident
 * #599 records was exactly the other thing: four-day-old numbers laid out like current ones. A
 * fresh record still gets one muted line, so the age is always visible and never something a
 * reader has to infer from the sources card at the bottom.
 *
 * The instant is not read here: `facts.freshness` was derived from the one clock the page takes
 * per request, which keeps this component clock-free (`#418`).
 */
function FreshnessNotice({ copy, facts }: { copy: PageCopy; facts: HealthFacts }) {
  const section = sectionOf(copy, "freshness");
  const { freshness } = facts;
  const values = {
    at: formatDateTimeLong(freshness.recordedAt),
    hours: freshness.ageHours === null ? "?" : String(freshness.ageHours),
    window: freshness.window.hours,
  };

  if (!freshness.stale) {
    return (
      <p className="text-sm text-muted-foreground">
        {fillLabel(itemLabel(section, "fresh-line"), values)}
      </p>
    );
  }

  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          {itemLabel(section, "stale-heading")}
        </CardTitle>
        <CardDescription>{sectionBody(section)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm">{fillLabel(itemLabel(section, "stale-body"), values)}</p>
        <p className="text-sm font-semibold">{itemLabel(section, "stale-action")}</p>
        {freshness.window.problem === null ? null : (
          <p className="text-sm text-destructive">
            {fillLabel(itemLabel(section, "window-problem"), {
              problem: freshness.window.problem,
            })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Panel 1 — the last `db:verify` run, its failing rule codes exactly as the script prints them. */
function DbVerifyCard({ copy, facts }: { copy: PageCopy; facts: HealthFacts }) {
  const section = sectionOf(copy, "db-verify");
  const run = facts.record.dbVerify;
  const recordPath = itemLabel(sectionOf(copy, "sources"), "record");
  const resultLabels: Record<PlatformHealthDbVerify["result"], string> = {
    error: itemLabel(section, "result-error"),
    fail: itemLabel(section, "result-fail"),
    "not-run": itemLabel(section, "result-not-run"),
    pass: itemLabel(section, "result-pass"),
  };

  return (
    <SectionCard icon={<Database className="h-5 w-5" />} section={section}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat
          label={itemLabel(section, "result-label")}
          source={recordedText(copy, run.ranAt)}
          value={resultLabels[run.result]}
        />
        <Stat
          label={itemLabel(section, "ran-at-label")}
          source={recordPath}
          value={formatDateTimeLong(run.ranAt)}
        />
        <Stat
          label={itemLabel(section, "database-label")}
          small
          source={recordPath}
          value={run.database}
        />
        <Stat
          label={fillLabel(itemLabel(section, "exit-code-label"), { code: run.exitCode ?? "-" })}
          source={recordedText(copy, run.ranAt)}
          value={run.exitCode === null ? "-" : String(run.exitCode)}
        />
      </div>
      <div className="space-y-3">
        <Badge variant={resultVariant(run.result)}>{run.summary}</Badge>
        {run.violations.length === 0 ? (
          <div>
            <p className="text-sm font-medium">{itemLabel(section, "violations-none")}</p>
            <p className="text-sm text-muted-foreground">{itemBody(section, "violations-none")}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {run.violations.map((violation) => (
              <li
                className="rounded-md border border-destructive/40 bg-destructive/5 p-3"
                key={`${violation.code}-${violation.message}`}
              >
                <Badge variant="destructive">
                  {fillLabel(itemLabel(section, "rule"), { code: violation.code })}
                </Badge>
                <p className="mt-2 text-sm">{violation.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {recordedText(copy, run.ranAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SectionCard>
  );
}

/** Panel 2 — the last gate lane, its duration, and the CI yield beside it. */
function GateCard({ copy, facts }: { copy: PageCopy; facts: HealthFacts }) {
  const section = sectionOf(copy, "gate");
  const gate = facts.record.gate;
  const yieldBlock = gate.yield;

  return (
    <SectionCard icon={<Timer className="h-5 w-5" />} section={section}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat
          label={itemLabel(section, "lane-label")}
          source={recordedText(copy, gate.measuredAt)}
          value={gate.lane}
        />
        <Stat
          label={itemLabel(section, "duration-label")}
          source={recordedText(copy, gate.measuredAt)}
          value={fillLabel(itemLabel(section, "duration-value"), { seconds: gate.seconds })}
        />
        <Stat
          label={itemLabel(section, "yield-label")}
          source={recordedText(copy, yieldBlock.measuredAt)}
          value={fillLabel(itemLabel(section, "yield-value"), {
            percent: yieldBlock.percent,
            runs: yieldBlock.runs,
            successes: yieldBlock.successes,
          })}
        />
        <Stat
          label={fillLabel(itemLabel(section, "window-label"), { window: yieldBlock.window })}
          source={recordedText(copy, yieldBlock.measuredAt)}
          value={yieldBlock.window}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {fillLabel(itemLabel(section, "latency-label"), {
          p50: yieldBlock.runP50Seconds,
          p95: yieldBlock.runP95Seconds,
        })}
      </p>
      <div className="space-y-1">
        <p className="text-sm font-medium">{yieldBlock.command}</p>
        <p className="text-xs text-muted-foreground">{recordedText(copy, yieldBlock.measuredAt)}</p>
      </div>
    </SectionCard>
  );
}

/** Panel 3 — the tag, the file and production, with the loud mismatch state (#443). */
function ReleaseCard({ copy, facts }: { copy: PageCopy; facts: HealthFacts }) {
  const section = sectionOf(copy, "release");
  const { release, tree } = facts;
  const mismatch = release.mismatches.length > 0;

  const sentence: Record<ReleaseMismatch, string> = {
    "production-commit": fillLabel(itemLabel(section, "mismatch-production-commit"), {
      commit: release.productionCommit.value,
      main: release.mainSha.value,
    }),
    "production-version": fillLabel(itemLabel(section, "mismatch-production-version"), {
      served: release.productionVersion.value,
      version: release.packageVersion.value,
    }),
    "version-tag": fillLabel(itemLabel(section, "mismatch-version-tag"), {
      tag: release.latestTag.value,
      version: release.packageVersion.value,
    }),
  };

  return (
    <Card className={mismatch ? "border-destructive" : undefined}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          {mismatch ? <AlertTriangle className="h-5 w-5" /> : <GitBranch className="h-5 w-5" />}
          {section.heading ?? ""}
        </CardTitle>
        <CardDescription>{sectionBody(section)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat
            label={itemLabel(section, "package-label")}
            source={sourceText(copy, release.packageVersion)}
            value={release.packageVersion.value}
          />
          <Stat
            label={itemLabel(section, "tag-label")}
            source={sourceText(copy, release.latestTag)}
            value={release.latestTag.value}
          />
          <Stat
            label={itemLabel(section, "production-label")}
            source={sourceText(copy, release.productionVersion)}
            value={release.productionVersion.value}
          />
          <Stat
            label={itemLabel(section, "main-label")}
            source={sourceText(copy, tree.mainSha)}
            value={tree.mainSha.value.slice(0, 7)}
          />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">
            {itemLabel(section, "production-commit-label")}
          </p>
          <p className="text-sm font-medium">{release.productionCommit.value}</p>
          <p className="text-xs text-muted-foreground">
            {sourceText(copy, release.productionCommit)}
          </p>
        </div>
        <Alarm
          heading={itemLabel(section, "alarm-heading")}
          quiet={!mismatch}
          quietText={itemLabel(section, "quiet")}
        >
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {release.mismatches.map((id) => (
              <li key={id}>{sentence[id]}</li>
            ))}
          </ul>
        </Alarm>
      </CardContent>
    </Card>
  );
}

/** Panel 4 — what production answered, and the alarm when it trails `main` past the limit. */
function DeployCard({ copy, facts }: { copy: PageCopy; facts: HealthFacts }) {
  const section = sectionOf(copy, "deploy");
  const sources = sectionOf(copy, "sources");
  const production = facts.record.production;
  const { drift } = facts;
  const behind = drift.behind.value;
  const limit = drift.limit.limit;

  const limitSource =
    drift.limit.origin === "env"
      ? fillLabel(itemLabel(sources, "config-env"), { variable: drift.limit.variable })
      : fillLabel(itemLabel(sources, "config-default"), { variable: drift.limit.variable });

  return (
    <Card className={drift.exceeded ? "border-destructive" : undefined}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5" />
          {section.heading ?? ""}
        </CardTitle>
        <CardDescription>{sectionBody(section)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat
            label={itemLabel(section, "state-label")}
            source={sourceText(copy, {
              origin: "recorded",
              value: production.state,
              recordedAt: production.measuredAt,
            })}
            value={itemLabel(
              section,
              production.state === "answering" ? "state-answering" : "state-unreachable",
            )}
          />
          <Stat
            label={itemLabel(section, "version-label")}
            source={sourceText(copy, {
              origin: "recorded",
              value: production.version,
              recordedAt: production.measuredAt,
            })}
            value={production.version}
          />
          <Stat
            label={itemLabel(section, "probe-label")}
            small
            source={sourceText(copy, {
              origin: "recorded",
              value: production.status,
              recordedAt: production.measuredAt,
            })}
            value={formatDateTimeLong(production.measuredAt)}
          />
          <Stat
            label={itemLabel(section, "limit-label")}
            source={limitSource}
            value={fillLabel(itemLabel(section, limit === 1 ? "limit-value-one" : "limit-value"), {
              limit,
            })}
          />
        </div>
        <Stat
          label={itemLabel(section, "behind-label")}
          source={sourceText(copy, drift.behind)}
          tone={drift.exceeded ? "destructive" : undefined}
          value={fillLabel(itemLabel(section, behind === 1 ? "behind-value-one" : "behind-value"), {
            behind,
          })}
        />
        {drift.limit.problem === null ? null : (
          <p className="text-sm font-medium text-destructive">
            {fillLabel(itemLabel(section, "limit-problem"), { problem: drift.limit.problem })}
          </p>
        )}
        <Alarm
          heading={itemLabel(section, "alarm-heading")}
          quiet={!drift.exceeded}
          quietText={fillLabel(itemLabel(section, behind === 1 ? "quiet-one" : "quiet"), {
            behind,
            limit,
          })}
        >
          <p className="mt-2 text-sm">
            {fillLabel(itemLabel(section, behind === 1 ? "alarm-one" : "alarm"), {
              behind,
              commit: production.commit,
              limit,
            })}
          </p>
        </Alarm>
      </CardContent>
    </Card>
  );
}

/** The page. `unreadable` replaces the four panels rather than filling them with zeroes. */
export function PlatformHealth({
  copy,
  facts,
  unreadable,
}: {
  copy: PageCopy;
  facts: HealthFacts | null;
  unreadable: string | null;
}) {
  const sources = sectionOf(copy, "sources");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{copy.heading}</h1>
        {copy.subtitle === undefined ? null : (
          <p className="text-muted-foreground">{copy.subtitle}</p>
        )}
      </div>

      {facts === null ? (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {sectionOf(copy, "unreadable").heading ?? ""}
            </CardTitle>
            <CardDescription>{sectionBody(sectionOf(copy, "unreadable"))}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {fillLabel(itemLabel(sectionOf(copy, "unreadable"), "reason"), {
                reason: unreadable ?? "",
              })}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <FreshnessNotice copy={copy} facts={facts} />
          <DbVerifyCard copy={copy} facts={facts} />
          <GateCard copy={copy} facts={facts} />
          <ReleaseCard copy={copy} facts={facts} />
          <DeployCard copy={copy} facts={facts} />
          <Card>
            <CardHeader>
              <CardTitle>{sources.heading ?? ""}</CardTitle>
              <CardDescription>{sectionBody(sources)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <p>{itemLabel(sources, "record")}</p>
              <p>
                {fillLabel(itemLabel(sources, "recorder"), {
                  command: facts.record.recorder,
                })}
              </p>
              <p>{recordedText(copy, facts.record.recordedAt)}</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
