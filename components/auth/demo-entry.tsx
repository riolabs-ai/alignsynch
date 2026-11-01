/**
 * template-ancestor: components/ui/button.tsx   (variation: a plain anchor styled by hand where components/ui/button.tsx asChild would do)
 *
 * The demo entry point — a real anchor from `/login` to the PIN gate (#218).
 *
 * Without it the gate is reachable only by typing the URL, which means the demo is usable only by
 * people who already know it exists. Two constraints shape this component:
 *
 *   **It is a server decision, passed down.** The page asks `demoMode()` (the same call `/demo`
 *   makes before it 404s) and renders this only in the `entry` state. There is no client fetch and
 *   no `NEXT_PUBLIC_` flag, so a deployment with demo mode off ships no link at all — not a
 *   disabled one, not a greyed one, not a teaser pointing at a 404.
 *   **It is an anchor.** A plain `<a href="/demo">`, not a `next/link` and not a form submit: it is
 *   in the server HTML, so it works before hydration and with JavaScript disabled, the destination
 *   can be copied, and it cannot be mistaken for the sign-in button beside it. There is nothing to
 *   prefetch — `/demo` is a 404 in every deployment that is not in demo mode, and in the ones that
 *   are, a full page load is what makes the gate's request-time answer the gate's answer.
 *
 * The words are the `/login` fixture's (`data/pages/login.ts`, section `demo-entry`), because this
 * file renders inside the `/login` surface and E23 holds that surface's literals at zero. The note
 * is *outside* the anchor's text, and wired with `aria-describedby`, so the link's accessible name
 * is exactly its visible text — "Demo sign-in" — while a screen reader still hears that a PIN is
 * required.
 */
import type { PageCopy } from "@/content/pages";
import { itemLabel, sectionOf } from "@/lib/page-copy";

/** The id the note carries, so the anchor can describe itself with it. */
const NOTE_ID = "demo-entry-note";

export function DemoEntry({ copy }: { copy: PageCopy }) {
  const entry = sectionOf(copy, "demo-entry");

  return (
    <div className="rounded-lg border border-amber-500/60 bg-amber-50 p-4 text-sm text-amber-900">
      <a
        href="/demo"
        className="font-medium text-amber-900 underline underline-offset-4"
        aria-describedby={NOTE_ID}
      >
        {itemLabel(entry, "link")}
      </a>
      <p id={NOTE_ID} className="mt-1 text-xs text-amber-900/80">
        {itemLabel(entry, "note")}
      </p>
    </div>
  );
}
