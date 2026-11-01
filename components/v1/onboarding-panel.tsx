"use client";

// template-ancestor: components/create/quiz-editor.tsx   (variation: a stepped wizard — one beat at a time with a Next/Back control and a Step N of 3 progress line, instead of the author's tab panels)

import { marketingPageCopy } from "@/data/pages/marketing";
import { sectionOf } from "@/lib/page-copy";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

/**
 * The `/v1` onboarding panel — the left, blue half of the persona picker, borrowed from the
 * login view's split. It is the product's own words (`data/pages/marketing.ts`, the
 * "how-it-works" beats) paced one step at a time instead of listed: three steps, one visible,
 * each with its number, title and sentence, a Next/Back control, a `Step N of 3` progress line,
 * and the last step's forward action pointing at the template catalogue. No assistant, no model
 * call and no generated copy — the static explainer turned into a wizard; #375 carries the rest.
 */
export function OnboardingPanel() {
  const howItWorks = sectionOf(marketingPageCopy, "how-it-works");
  const steps = howItWorks.items ?? [];
  const [stepIndex, setStepIndex] = useState(0);

  const step = steps[stepIndex];
  const total = steps.length;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === total - 1;

  const next = () => setStepIndex((index) => Math.min(index + 1, total - 1));
  const back = () => setStepIndex((index) => Math.max(index - 1, 0));

  return (
    <div className="relative flex flex-col justify-center overflow-hidden bg-action p-8 text-white lg:w-2/5 lg:p-12">
      <div className="relative z-10">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
          <Check className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-3xl font-bold">{marketingPageCopy.heading}</h2>
        <p className="mt-4 text-lg leading-relaxed text-white/90">{marketingPageCopy.subtitle}</p>

        {step === undefined ? null : (
          <div className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
              Step {stepIndex + 1} of {total}
            </p>
            <div className="mt-2 flex gap-1.5" aria-hidden="true">
              {steps.map((candidate, index) => (
                <span
                  key={candidate.id}
                  className={`h-1 flex-1 rounded-full ${
                    index <= stepIndex ? "bg-white" : "bg-white/25"
                  }`}
                />
              ))}
            </div>

            <div className="mt-6 flex gap-4" aria-live="polite">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">
                {stepIndex + 1}
              </span>
              <div>
                <p className="text-base font-semibold">{step.label}</p>
                {step.body !== undefined && (
                  <p className="mt-1 text-sm leading-relaxed text-white/80">{step.body}</p>
                )}
              </div>
            </div>

            <div className="mt-8 flex items-center gap-3">
              {!isFirst && (
                <button
                  type="button"
                  onClick={back}
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md border border-white/40 px-4 text-sm font-medium text-white transition-colors hover:bg-white/10"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              )}
              {isLast ? (
                <Link
                  href="/v1/templates"
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md bg-white px-4 text-sm font-semibold text-action transition-colors hover:bg-white/90"
                >
                  View templates
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={next}
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md bg-white px-4 text-sm font-semibold text-action transition-colors hover:bg-white/90"
                >
                  Next
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="absolute right-12 top-12 h-28 w-28 rounded-full bg-white/10 blur-xl" />
      <div className="absolute bottom-12 left-12 h-20 w-20 rounded-full bg-white/10 blur-xl" />
    </div>
  );
}
