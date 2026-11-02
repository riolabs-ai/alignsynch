"use client";

// template-ancestor: components/auth/login-view.tsx

import { PersonaPicker } from "@/components/v1/persona-picker";
import { DEMO_SEED, demoRelationships, installDemoSeed } from "@/lib/v1/demo-seed";
import { useState } from "react";

/**
 * `/v1` — the persona picker, the prototype's stand-in for `/login`.
 *
 * The page is a client component for one reason and it is at the bottom of this file: the demo
 * seed control writes `localStorage` and then reloads, which cannot be a server component. The
 * picker itself is unchanged.
 *
 * **The control is dev tooling and is gated at build time.** `process.env.NODE_ENV` is inlined by
 * Next, so in a production build `DEV_TOOLS` is the literal `false`, the branch is dead and the
 * panel is not rendered — no authored sample data reaches a production surface, which is why this
 * generator is allowed to exist at all.
 */
const DEV_TOOLS = process.env.NODE_ENV !== "production";

/** What the seeder writes, counted once per render rather than re-derived in the copy. */
const DEMO_ROW_COUNT = demoRelationships().length;

/**
 * The dev-only seed panel: one button, one true sentence about what it does. It writes the flow
 * payload `lib/v1/store.tsx` reads and reloads, because the store loads that key on hydration and
 * a live context would otherwise keep the rows it already has.
 */
function DemoSeedPanel() {
  const [notice, setNotice] = useState<string | null>(null);

  const seed = () => {
    try {
      const written = installDemoSeed(window.localStorage);
      setNotice(`Seeded ${written} relationships — reloading…`);
      window.location.reload();
    } catch (error) {
      setNotice(`Could not write the demo flow: ${String(error)}`);
    }
  };

  return (
    <div className="border-t border-dashed border-slate-300 bg-slate-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-900 sm:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Dev only — demo seed
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {DEMO_ROW_COUNT} relationships, one per catalogue type, across all four stages, both
            modes and both settings — deterministic from seed {DEMO_SEED}. Writes this
            browser&apos;s store and reloads. Never rendered in a production build.
          </p>
        </div>
        <button
          type="button"
          onClick={seed}
          className="inline-flex shrink-0 items-center justify-center rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:border-action"
        >
          Seed demo data
        </button>
      </div>
      {notice === null ? null : <p className="mt-2 text-xs text-muted-foreground">{notice}</p>}
    </div>
  );
}

export default function V1HomePage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      <div className="flex flex-1 flex-col">
        <PersonaPicker />
      </div>
      {DEV_TOOLS ? <DemoSeedPanel /> : null}
    </div>
  );
}
