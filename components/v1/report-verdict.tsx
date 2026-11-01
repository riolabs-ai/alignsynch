"use client";

// template-ancestor: components/quiz/quiz-results.tsx   (variation: a run percentage becomes a relationship verdict — aligned or unmet gaps, confetti on aligned only)

/**
 * The relationship report's verdict hero — the result hero made honest.
 *
 * The ancestor ends a run with a percentage and a celebration. A relationship has one
 * answer, not a run, so the hero ends the report with the verdict instead: aligned, or
 * how many Gaps exceed the Setting and which Aspect carries the widest one. Confetti
 * fires on **aligned only** — never on a partial — and the actions are "back to
 * relationships" and "share", with no "play again", because a relationship is answered
 * once.
 *
 * Every word comes from `data/pages/assessment-report.ts` (the `verdict` section), read
 * through `fillLabel`/`itemLabel`, and the numbers are the projection's own
 * (`report.verdict.unmet.length`, `report.widest.gap`), so the hero cannot disagree with
 * the report it sits above. It renders the same `data-verdict` / `data-setting` /
 * `data-unmet-gaps` hooks the report's own band carries, so a test can read the state
 * off the markup.
 *
 * The mount owns the two destinations: `relationshipsHref` names where "back to
 * relationships" goes (this component never hardcodes a route, so it stays reusable), and
 * `onShare` overrides the Web Share fallback.
 */
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { SETTING_DEFINITIONS, SETTING_LABELS } from "@/content/assessment";
import { assessmentReportPageCopy } from "@/data/pages/assessment-report";
import type { AssessmentReport } from "@/lib/assessment-report";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import { AlertTriangle, ArrowLeft, CheckCircle2, Share2 } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

/** The report's own verdict words: the aligned sentence, the two unmet sentences, the Setting. */
const VERDICT_COPY = sectionOf(assessmentReportPageCopy, "verdict");

export interface ReportVerdictProps {
  /** The projected report — its `verdict` is what this hero draws. */
  report: AssessmentReport;
  /** Where "back to relationships" goes. The mount names it; never hardcoded here. */
  relationshipsHref: string;
  /** Optional share handler; without one, the Web Share API with a clipboard fallback. */
  onShare?: () => void;
}

export function ReportVerdict({ report, relationshipsHref, onShare }: ReportVerdictProps) {
  const aligned = report.verdict.aligned;
  const unmet = report.verdict.unmet.length;
  const setting = SETTING_LABELS[report.setting];
  const widest = report.widest;

  // Confetti on aligned only, never on a partial: the one state worth celebrating is the
  // one with no unmet Gap.
  useEffect(() => {
    if (!aligned) return;
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;
    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) return clearInterval(interval);
      const particleCount = 50 * (timeLeft / duration);
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      });
    }, 250);
    return () => clearInterval(interval);
  }, [aligned]);

  const sentence = aligned
    ? fillLabel(itemLabel(VERDICT_COPY, "aligned"), { setting })
    : fillLabel(itemLabel(VERDICT_COPY, unmet === 1 ? "unmet-one" : "unmet-many"), {
        setting,
        count: unmet,
        gap: widest?.gap ?? 0,
        prompt: widest?.prompt ?? "",
      });

  const share = () => {
    if (onShare) {
      onShare();
      return;
    }
    const url = window.location.href;
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      void navigator.share({ title: report.title, text: sentence, url }).catch(() => {});
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(url);
    }
  };

  return (
    <Card className="mb-8 overflow-hidden border-2 shadow-lg">
      <div
        data-verdict={aligned ? "aligned" : "unmet"}
        data-setting={report.setting}
        data-unmet-gaps={unmet}
        className={cn(
          "p-6 text-center",
          aligned
            ? "bg-action text-action-foreground"
            : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
        )}
      >
        <div
          className={cn(
            "mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full",
            aligned ? "bg-white/20" : "bg-amber-100 dark:bg-amber-900",
          )}
        >
          {aligned ? <CheckCircle2 className="h-7 w-7" /> : <AlertTriangle className="h-7 w-7" />}
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
          {VERDICT_COPY.heading ?? ""}
        </p>
        <h2 className="mt-1 text-2xl font-bold">{sentence}</h2>
      </div>

      <CardContent className="p-6">
        <p className="text-sm text-muted-foreground">
          {fillLabel(itemLabel(VERDICT_COPY, "setting"), {
            setting,
            definition: SETTING_DEFINITIONS[report.setting],
          })}
        </p>
      </CardContent>

      <CardFooter className="flex flex-col gap-3 p-6 pt-0 sm:flex-row">
        <Button variant="outline" className="w-full sm:w-auto" asChild>
          <Link href={relationshipsHref}>
            <ArrowLeft className="h-4 w-4" />
            Back to relationships
          </Link>
        </Button>
        <Button variant="action" className="w-full sm:w-auto" onClick={share}>
          <Share2 className="h-4 w-4" />
          Share
        </Button>
      </CardFooter>
    </Card>
  );
}
