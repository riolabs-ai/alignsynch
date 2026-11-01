// template-ancestor: components/auth/login-view.tsx   (variation: choosing a persona instead of signing in)
"use client";

import { PERSONA_META, PERSONAS, type Persona } from "@/data/v1/fixtures";
import { marketingPageCopy } from "@/data/pages/marketing";
import { useV1Store } from "@/lib/v1/store";
import { OnboardingPanel } from "@/components/v1/onboarding-panel";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

/**
 * The `/v1` persona picker — the prototype's stand-in for `/login`. It borrows the login view's
 * split: a brand panel on the left (the onboarding panel, the product's own words from
 * `data/pages/marketing.ts` paced as a stepped wizard) and, on the right, a card of the six
 * personas instead of an email/password form. Choosing a persona writes `v1_persona` and lands
 * that persona on their own screen; there is no password, no session and no gate — the bar this
 * component feeds is the whole of "authentication".
 */
export function PersonaPicker() {
  const { setPersona } = useV1Store();
  const router = useRouter();

  const enter = (persona: Persona) => {
    setPersona(persona);
    router.push(PERSONA_META[persona].landing);
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col lg:flex-row">
      {/* Left — the onboarding panel, borrowed from the login view's split. */}
      <OnboardingPanel />

      {/* Right — the six personas, one card each. */}
      <div className="flex flex-1 flex-col justify-center gap-4 p-6 sm:p-10">
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-foreground">Enter as</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a persona. There is no login — the persona bar is the session.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {PERSONAS.map((persona) => {
            const meta = PERSONA_META[persona];
            return (
              <button
                key={persona}
                type="button"
                onClick={() => enter(persona)}
                className="group flex min-h-28 flex-col justify-between rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-action"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {meta.label}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {meta.name}
                    </span>
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{meta.blurb}</p>
                </div>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-action">
                  Enter as {meta.label}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {marketingPageCopy.items?.find((item) => item.id === "footer-note")?.label}
        </p>
      </div>
    </div>
  );
}
