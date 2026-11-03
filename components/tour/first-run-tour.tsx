"use client";

// template-ancestor: components/ui/popover.tsx   (variation: the stage — a cut-out over a real element with a callout anchored to it, stepped through by driver.js; no trigger and no Radix primitive, because the tour owns when it opens and the callout is its own chrome)

/**
 * The first-run tour's shell (#455) — driver.js driven over the anchors a page already renders.
 *
 * **What it is.** Six steps from `data/pages/tour.ts`, each pointing at an element that carries
 * `data-tour="<id>"` on a surface the page really draws: the console's counts band, the
 * relationships link, the template card, the empty-state card's action and its blind-rule
 * sentence, and the rail's Support row. `lib/tour/steps.ts` joins fixture to markup and **skips a
 * step whose target is absent** (not in this page, or in it but not rendered) rather than aiming a
 * tooltip at nothing.
 *
 * **When it opens, and that it opens only once.** The page decides: it reads the viewer's
 * `tour_seen_at` mark (`lib/db/tour.ts`) and passes `start`. Completing *or dismissing* the tour
 * writes that mark through `POST /api/tour`, so it does not reappear on the next visit; `/help`'s
 * replay control (#458) clears the mark. This component never reads the session and never touches
 * the database — the crossing is one `fetch`, in `lib/tour/mark.ts`.
 *
 * **Why the engine is imported inside the effect.** `driver.js` reads `document` and `window` on
 * its first call, so a static import would be a module the server render executes — the
 * `window is not defined` failure the issue names. `await import("driver.js")` keeps the library
 * out of the server graph and out of the client's first chunk; the module is fetched when a tour
 * actually starts. The stylesheet is a static import because a CSS module is inert on the server
 * and Next needs it at build time to emit the route's stylesheet.
 *
 * **Accessibility, spelled out** (each is a line below, not a hope):
 *
 *   - `Escape` closes the tour and returns focus — the engine's own keyup handler destroys it and
 *     refocuses the element that was focused when the tour started; `returnFocusTo` is the
 *     fallback for the case where that was `body` and a caller (the `/help` replay control, S4)
 *     had a real trigger focused.
 *   - `Next`, `Back` and the close control are driver.js's real `<button>`s, in the callout's
 *     tab order; the engine keeps `Tab` inside the callout and the highlighted element, and the
 *     close button is always one of them — so focus is contained, never trapped.
 *   - every step change writes one sentence into a `aria-live="polite"` region rendered here, so
 *     the step is announced whether or not the reader is looking at the callout.
 *   - `prefers-reduced-motion: reduce` turns the engine's animation and smooth scrolling off
 *     (`animate`, `smoothScroll`) and the token layer's `@media` query turns the stylesheet's
 *     fade off too, so there is nothing left to animate.
 *
 * **No reader-visible string lives in this file.** Titles, paragraphs, the three button labels,
 * the progress line and the announcement sentence are all `data/pages/tour.ts` — E23 holds the
 * budget at 0 for `components/tour/**`, which is what stops the next sentence being typed here.
 *
 * **No server import.** This is a `"use client"` module whose value imports are `lib/page-copy`,
 * `lib/tour/steps` and `driver.js`; `data:check` E34 walks the graph and fails the crossing that
 * would 500 every route behind the shell.
 */
import "driver.js/dist/driver.css";

import type { PageCopy } from "@/content/pages";
import { fillLabel, pageItemOf } from "@/lib/page-copy";
import { sendTourMark } from "@/lib/tour/mark";
import { runnableSteps } from "@/lib/tour/steps";
import type { Config, Driver } from "driver.js";
import { useEffect, useRef, useState } from "react";

export function FirstRunTour({
  copy,
  start,
}: {
  copy: PageCopy;
  /** Whether this render should open the tour. `false` keeps the live region and nothing else. */
  start: boolean;
}) {
  const [announcement, setAnnouncement] = useState("");
  const tourRef = useRef<Driver | null>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!start) return;

    // Resolved before the engine is fetched: "no step has a target" is not a tour with nothing in
    // it, it is no tour — an empty overlay would be worse than none.
    const steps = runnableSteps(copy, document);
    if (steps.length === 0) return;

    const active = document.activeElement;
    returnFocusTo.current =
      active instanceof HTMLElement && active !== document.body ? active : null;

    const announce = pageItemOf(copy, "announce").label;
    const total = steps.length;
    let disposed = false;

    void import("driver.js").then(({ driver }) => {
      // A cleanup can land while the chunk is in flight (StrictMode's double effect, a fast
      // unmount): starting a tour into a tree that is gone would leave an overlay nobody owns.
      if (disposed) return;

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const config: Config = {
        steps: steps.map((step) => ({
          element: step.element,
          popover: { title: step.heading, description: step.body },
        })),
        animate: !reduceMotion,
        smoothScroll: !reduceMotion,
        allowClose: true,
        allowKeyboardControl: true,
        // Belt to `runnableSteps`' braces: a step whose element disappears between selection and
        // the engine's own pass is skipped by the engine rather than drawn at a dummy position.
        skipMissingElement: true,
        showProgress: true,
        progressText: pageItemOf(copy, "progress").label,
        nextBtnText: pageItemOf(copy, "next").label,
        prevBtnText: pageItemOf(copy, "previous").label,
        doneBtnText: pageItemOf(copy, "done").label,
        closeBtnLabel: pageItemOf(copy, "close").label,
        popoverClass: "tour-popover",
        onHighlightStarted: (_element, _step, opts) => {
          const index = opts.index ?? 0;
          const step = steps[index];
          if (step === undefined) return;
          setAnnouncement(
            fillLabel(announce, {
              current: index + 1,
              total,
              heading: step.heading,
              body: step.body,
            }),
          );
        },
        onHighlighted: () => {
          /**
           * The engine builds the callout in the middle of the stage transition — while it is
           * still `display: none` — so the focus it aims at the first button lands on the page
           * instead, and after a keyboard `Next` the reader is outside the tour. Once the step has
           * settled, put focus inside the callout: from there `Tab` cycles the callout's buttons
           * and the highlighted element (the engine's own trap), and the close control is one of
           * them. A step the reader reached by clicking inside the highlighted element keeps the
           * focus it already has.
           */
          const popovers = Array.from(document.querySelectorAll<HTMLElement>(".driver-popover"));
          const visible = popovers.filter((popover) => popover.offsetWidth > 0).at(-1);
          if (visible === undefined || visible.contains(document.activeElement)) return;
          visible.querySelector<HTMLElement>("button")?.focus();
        },
        onDestroyed: () => {
          setAnnouncement("");
          /**
           * Completing **or dismissing** marks the tour seen (#456): done, close, Escape and a
           * click on the overlay are all "this person has now seen it", and the mark is what stops
           * a second appearance. `/help`'s replay control clears it again (`seen: false`). The
           * write is fire-and-forget — a tour the reader dismissed must not fail in their face
           * because a request did.
           */
          void sendTourMark(true);
          // The engine refocuses what was focused when it started; when that was the document
          // body there is nothing to return to, so a caller that opened the tour from a control
          // gets its control back instead of a screen reader restarting at the top.
          const target = returnFocusTo.current;
          if (target?.isConnected && document.activeElement === document.body) target.focus();
        },
      };

      const instance = driver(config);
      tourRef.current = instance;
      instance.drive();
    });

    return () => {
      disposed = true;
      tourRef.current?.destroy();
      tourRef.current = null;
    };
  }, [copy, start]);

  return (
    /**
     * The announcement channel: a polite live region holding the tour's name and the current
     * step's sentence. `aria-atomic` makes a change announce the whole region, so a reader hears
     * which tour they are in and where they are in it — the same two facts the callout shows.
     */
    <div aria-live="polite" aria-atomic="true" className="sr-only" data-tour-live="">
      <p>{copy.heading}</p>
      {announcement === "" ? null : <p>{announcement}</p>}
    </div>
  );
}
