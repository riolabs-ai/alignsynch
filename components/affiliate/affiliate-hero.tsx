"use client";
import { Button } from "@/components/ui/button";
import {
  formatCompactCount,
  formatCompactCurrency,
  formatMetricDelta,
  formatMetricValue,
  formatPercentValue,
  progressPercentOf,
} from "@/content/metrics";
import type { PageCopy } from "@/content/pages";
import { metric } from "@/data/metrics";
import { fillLabel, headingLines, itemLabel, sectionOf } from "@/lib/page-copy";
import { ArrowRight, CheckCircle } from "lucide-react";

/** Which benefit lines the hero renders, in order. The words are in the fixture. */
const BENEFIT_IDS = [
  "benefit-earn-commission",
  "benefit-monthly-payout",
  "benefit-analytics",
  "benefit-marketing",
] as const;

export function AffiliateHero({ copy }: { copy: PageCopy }) {
  const maxCommission = metric("affiliate.maxCommission");
  const thisMonth = metric("affiliate.thisMonth");
  const goalProgress = progressPercentOf(thisMonth.value, metric("affiliate.monthGoal").value);
  const commissionPct = formatPercentValue(maxCommission.value);
  const hero = sectionOf(copy, "affiliate-hero");
  const [headingLead, headingAccent] = headingLines(copy.heading);

  return (
    <section className="bg-slate-50 dark:bg-slate-900 sm:px-4 lg:px-8 py-10 md:py-16 xl:py-20">
      <div className="container px-4 mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left column - Text content */}
          <div className="max-w-xl mx-auto lg:mx-0">
            <div className="inline-flex items-center px-3 py-1 mb-6 text-sm font-medium rounded-full bg-action/10 text-action">
              <span className="flex h-2 w-2 rounded-full bg-action mr-2"></span>
              {copy.eyebrow}
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 text-slate-900 dark:text-white">
              {headingLead} <span className="text-action">{headingAccent}</span>
            </h1>

            <p className="text-lg text-slate-600 dark:text-slate-300 mb-8">
              {fillLabel(copy.subtitle ?? "", { percent: commissionPct })}
            </p>

            <div className="space-y-4 mb-8">
              {BENEFIT_IDS.map((id, index) => (
                <div key={index} className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-action mt-0.5 mr-3 flex-shrink-0" />
                  <p className="text-slate-700 dark:text-slate-300">
                    {fillLabel(itemLabel(hero, id), { percent: commissionPct })}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-10">
              <Button variant="action">
                {itemLabel(hero, "become-affiliate")}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="border-slate-300 dark:border-slate-700 flex items-center gap-2 px-6 text-base"
              >
                {itemLabel(hero, "learn-more")}
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-md">
              <div className="text-center p-4 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                <div className="text-3xl font-bold text-action">
                  {formatMetricValue(maxCommission)}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {itemLabel(hero, "stat-commission")}
                </div>
              </div>
              <div className="text-center p-4 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                <div className="text-3xl font-bold text-action">
                  {formatCompactCount(metric("affiliate.affiliates").value)}+
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {itemLabel(hero, "stat-affiliates")}
                </div>
              </div>
              <div className="text-center p-4 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
                <div className="text-3xl font-bold text-action">
                  {formatCompactCurrency(metric("affiliate.paidOut").value)}+
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {itemLabel(hero, "stat-paid-out")}
                </div>
              </div>
            </div>
          </div>

          {/* Right column - Illustration */}
          <div className="relative">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-3 sm:p-6 md:p-8 border border-slate-200 dark:border-slate-700">
              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-2 text-slate-900 dark:text-white">
                  {hero.heading}
                </h3>
                <p className="text-slate-600 dark:text-slate-300 text-sm">{hero.body}</p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {itemLabel(hero, "this-month")}
                    </p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {formatMetricValue(thisMonth)}
                    </p>
                  </div>
                  <div className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-sm px-2 py-1 rounded">
                    {formatMetricDelta(thisMonth)}
                  </div>
                </div>

                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full mb-1">
                  <div className="h-2 bg-action rounded-full w-3/4"></div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {fillLabel(itemLabel(hero, "monthly-goal-progress"), {
                    percent: formatPercentValue(goalProgress),
                  })}
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mr-3">
                      <span className="text-blue-600 dark:text-blue-400 text-sm font-medium">
                        1
                      </span>
                    </div>
                    <span className="text-slate-700 dark:text-slate-300">
                      {itemLabel(hero, "new-signups")}
                    </span>
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-white">42</span>
                </div>

                <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-action/10 flex items-center justify-center mr-3">
                      <span className="text-action text-sm font-medium">2</span>
                    </div>
                    <span className="text-slate-700 dark:text-slate-300">
                      {itemLabel(hero, "conversions")}
                    </span>
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-white">18</span>
                </div>

                <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mr-3">
                      <span className="text-green-600 dark:text-green-400 text-sm font-medium">
                        3
                      </span>
                    </div>
                    <span className="text-slate-700 dark:text-slate-300">
                      {itemLabel(hero, "commission-rate")}
                    </span>
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {formatMetricValue(maxCommission)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
