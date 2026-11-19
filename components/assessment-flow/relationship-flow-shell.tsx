"use client";

// template-ancestor: components/assessment-flow/stage-shell.tsx   (variation: the frame plus the column and the rail, mounted either as a stage route's own overlay or as a dialog over the page the flow was started from)

/**
 * `RelationshipFlowShell` — **the** shell of the create flow (#979 B, decision B).
 *
 * The five stages were already one flow that rendered as one overlay; what they were not was
 * *mountable*. Every entry into the flow was a navigation, so a person who pressed "Create
 * relationship" on `/dashboard/relationships` lost the page they were standing on, and the flow —
 * five screens later — handed them back to a place they had not chosen. This component is the
 * answer to "where are the stages mounted", and only that question: the stages themselves, their
 * fields, their order, their words and their prices are untouched.
 *
 * **Two mountings, one tree.**
 *
 *   `page`    the stage's own address draws the flow in place. A refresh, a shared link and an
 *             invitation link all land here, and the stage is in the server's HTML (#709).
 *   `dialog`  the same frame, the same column and the same rail, drawn over the page the flow was
 *             started from — mounted by the intercepted route at
 *             `app/(mainlayout)/dashboard/relationships/@flow/**`, so the address stays the stage's
 *             own while the page underneath stays put.
 *
 * Both delegate to `StageShell`, which owns the panel, the close and the two scroll behaviours, and
 * both draw the *same* `FlowStageBody` — one element tree for the column and the rail, so the dialog
 * cannot number or order a screen differently from the page it claims to be. What this file adds is
 * the two behaviours a dialog over a live page needs and a page render does not: form submission,
 * and the return trip.
 *
 * **The `page` mounting calls no hook at all.** Not tidiness: a stage address answers a plain GET,
 * and that render is `renderToStaticMarkup`'d by several suites and by the server itself. A
 * `usePathname()` on that path would make every one of them depend on a Next router a static render
 * does not have (`tests/flow-dialog-shell.test.tsx` holds the page mount to zero hooks). The hooks
 * therefore live in `FlowDialogMount`, which only a hydrated click can reach.
 *
 * **A form inside the dialog must not reload the document.** Every stage advances by posting a form
 * (stage 1 → `POST /assessment/new/who` → 303 to stage 2, and so on). A native submit is a document
 * navigation: the dashboard page would be torn down, and the dialog would be gone before stage 2
 * drew — the exact defect this mounting exists to remove. So the dialog captures its own submits,
 * posts the same body with `fetch`, reads where the answer points, and hands that to `router.push` —
 * a soft navigation, which is what keeps the page underneath, the scroll position and the dialog. A
 * refusal is not special-cased: the endpoint answers 303 to the stage with `?problem=…`, the shell
 * pushes that address, and the stage renders its own refusal band. One code path, both outcomes.
 *
 * **Closing returns to where the flow was opened, with focus.** `Esc`, the X and a click on the
 * overlay all dismiss; each closes onto `takeFlowOrigin()`'s path — the page the trigger was pressed
 * on, remembered by the trigger itself — and hands focus back to that control **after** the panel has
 * left the document. Three things about that are measured rather than assumed:
 *
 *   - **The close is a pop, not a push.** A `router.push` back to the page under an active
 *     interception is a no-op in Next's router — the address and the panel both stay where they
 *     were. Each stage advance is a history entry, so the dismissal pops exactly the entries the
 *     flow pushed (`flowEntriesSinceOrigin()`), landing on the origin page in one step from any
 *     stage, and leaving no trail for the browser's Back to walk into.
 *   - **The focus comes after the panel leaves.** While it stands, its focus trap pulls an outside
 *     focus straight back in, so a focus aimed at the trigger is undone and the navigation then
 *     drops focus on `<body>` (`tests/flow-dialog-keyboard.test.tsx`).
 *   - **The trigger may not still exist.** The intercepted render re-renders the page underneath,
 *     and the chooser that holds the Create control comes back closed — so the origin carries a
 *     fallback selector for an always-mounted control, and focus goes to whichever of the two is
 *     still in the document.
 *
 * The draft is untouched: the Account stage writes it, a dismissal has never discarded anything, and
 * no "discard?" prompt is invented for a screen the spec does not draw.
 *
 * **A dialog does not outlive its address.** If the flow navigates somewhere that is not a stage of
 * this flow — the send's own confirmation, the plans page, the template library via `Cancel` — the
 * shell renders nothing and the page underneath takes over. Radix keeps a slot's last active subpage
 * across soft navigations, so without this guard a modal would stay standing over a screen it no
 * longer describes.
 */
import { usePathname, useRouter } from "next/navigation";
import type { FormEvent, MouseEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { takeFlowOrigin } from "@/lib/flow/dialog-origin";
import { StageColumn } from "./stage-column";
import { WizardProgress } from "./wizard-progress";
import { WizardRail, type WizardRailStep, type WizardRailSummaryRow } from "./wizard-rail";
import { StageShell } from "./stage-shell";

/**
 * The v2 wizard rail's facts, **already resolved by the caller** (#1123).
 *
 * The rail is the aside the bundle draws beside the stage card: the setup gauge, one row per stage
 * with its status word, the dashed Align preview and the live relationship summary. Every word in
 * it is a `data/pages/assessment-create.ts` string the caller filled, so the rail assembles no
 * sentence of its own (E23) and a rename lands in one fixture.
 *
 * Absent on a screen with no stage to number — the "nothing to copy" refusal — which falls back to
 * the pre-v2 single column rather than drawing a rail that would number a stage the screen is not.
 */
export interface FlowRail {
  /** The nav's accessible name. */
  readonly label: string;
  readonly steps: readonly WizardRailStep[];
  /** `Stage 3 of 5`, already filled with this stage. */
  readonly count: string;
  /** This stage's own name, from `data/pages/lifecycle.ts`. */
  readonly name: string;
  /** `Stage 6 Align starts when <name> joins`. */
  readonly alignNote: string;
  /** The dashed preview row's word. */
  readonly alignPreviewLabel: string;
  /** `Starts when <name> joins`. */
  readonly alignPreviewNote: string;
  readonly summaryHeading: string;
  readonly summary: readonly WizardRailSummaryRow[];
}

/** The v2 flow header's two words: its title, and the label on the control that leaves the flow. */
export interface FlowHeader {
  readonly label: string;
  readonly exitLabel: string;
}

/** Which of the flow's five stages this render is. `undefined` is the "nothing to copy" screen. */
export type FlowStage = 1 | 2 | 3 | 4 | 5;

/** How the shell is mounted. `page` is today's behaviour; `dialog` is the mounting #979 B adds. */
export type FlowMount = "page" | "dialog";

/**
 * The `dialog` mounting, as a **value**.
 *
 * A JSX attribute written `presentation="dialog"` is a string literal to `data:check` E23, which
 * counts every literal a create surface still renders and gives these five routes a budget of **0** —
 * copy belongs in the fixture. This is not copy: it is which frame to draw, so it is named once here
 * and handed to the shell as an expression.
 */
export const FLOW_MOUNT_DIALOG = "dialog" as const;

/**
 * Is this pathname one of the flow's own stage addresses?
 *
 * The dialog only describes the flow while the address belongs to it. Derived from the address
 * rather than from a flag, because the address is the fact the whole mounting is built on: a
 * refresh of it renders the stage as a page, and a soft navigation away from it closes the dialog.
 *
 * The segments are the dashboard's since #1109 phase 2 moved the flow out of the retired template
 * noun: `/dashboard/templates/<slug>/create` and its four stages. `<slug>` is one segment, so
 * `/dashboard/templates/<id>` — the member's editor — is deliberately not a stage address.
 */
export function isFlowStagePath(pathname: string): boolean {
  return /\/dashboard\/templates\/[^/]+\/create(\/(mode|aspects|commit|invite))?\/?$/.test(
    pathname,
  );
}

/** What both mountings receive. */
export interface FlowShellProps {
  /** `page` renders in place on the stage's own route; `dialog` renders over the origin page. */
  mount?: FlowMount;
  /** Which stage is current — the rail's fact. Omitted on the "nothing to copy" screen. */
  stage?: FlowStage;
  /** The dialog's accessible name — the stage's own heading, already resolved by the caller. */
  title: string | undefined;
  /** The close control's accessible name, from the caller's fixture. */
  closeLabel: string;
  /**
   * Where `Cancel` leaves to **on the stage's own page** — the template library the flow was started
   * from. The dialog mounting has one exit instead, and it is the dismissal: `Esc`, the X, the
   * overlay and `Cancel` all land on the page the flow was opened from (#975 D10). `Cancel` keeps
   * this href in the page mounting, where it is right: a reader who followed a stage address is on a
   * page, and leaving it goes to the library.
   */
  closeHref: string;
  /** The stage: its heading, its bands and its body. Never re-drawn here. */
  children: ReactNode;
  /**
   * **The v2 rail beside the stage card (#1123).** Present on the five stages, absent on a screen
   * with no stage to number. It is also what widens the panel: a 260px rail and a readable stage
   * card do not fit in the 880px reading cap, so the frame's wide variant is an inference from the
   * rail rather than a second flag a caller could set on its own.
   */
  rail?: FlowRail;
  /** The v2 flow header — the title on the left, the exit word on the right. */
  header?: FlowHeader;
}

/**
 * The rail, the stage column and the mobile progress line — **one element tree, both mountings**.
 *
 * The rail is drawn here rather than by each stage for the reason #825 gives: one progress pattern,
 * one count, one place a rename hides. `rail === undefined` is the refusal screen that has no stage
 * to number, and it draws the pre-v2 single column rather than a rail claiming to stand on a stage
 * it is not.
 *
 * Below `lg` the aside is off-canvas and `WizardProgress` is the one line that says where the person
 * is: the same count and the same Align note, from the same resolved props, so the two cannot
 * disagree about which stage this is.
 */
function FlowStageBody({
  stage,
  rail,
  children,
}: {
  stage: FlowStage | undefined;
  rail?: FlowRail;
  children: ReactNode;
}) {
  if (rail === undefined || stage === undefined) {
    return <StageColumn>{children}</StageColumn>;
  }

  return (
    <div className="min-h-full bg-mist">
      <div className="mx-auto w-full px-4 py-5 lg:px-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
          <aside className="hidden space-y-4 lg:sticky lg:top-20 lg:block lg:self-start">
            <WizardRail
              label={rail.label}
              steps={rail.steps}
              count={rail.count}
              name={rail.name}
              alignNote={rail.alignNote}
              alignPreviewLabel={rail.alignPreviewLabel}
              alignPreviewNote={rail.alignPreviewNote}
              summaryHeading={rail.summaryHeading}
              summary={rail.summary}
            />
          </aside>
          <div className="min-w-0 space-y-4">
            <WizardProgress
              step={stage}
              count={rail.count}
              name={rail.name}
              alignNote={rail.alignNote}
            />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The panel's own props, as the dialog mounting passes them to the frame. */
type FrameProps = Pick<FlowShellProps, "title" | "closeLabel" | "closeHref" | "header"> & {
  /** The wide panel variant the v2 rail needs. Derived from `rail` by the caller. */
  readonly wide: boolean;
};

/**
 * The dialog mounting: `StageShell`'s frame, portalled over the page underneath, carrying the two
 * behaviours a page render does not need.
 *
 * A separate component and not a branch inside `RelationshipFlowShell`, because hooks cannot be
 * conditional and a static render of a stage address must not ask for a router (see the file note).
 */
function FlowDialogMount({
  title,
  closeLabel,
  closeHref,
  header,
  wide,
  body,
}: FrameProps & { body: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  /** How to give focus back to the control that opened the flow, once the panel has left. */
  const returnFocusTo = useRef<(() => HTMLElement | null) | null>(null);

  /**
   * **Focus goes back to the control that opened the flow when the dialog leaves.**
   *
   * Two measurements make this the shape it is. First, the return cannot happen while the panel
   * stands: it is modal, its focus trap owns the document, and a focus aimed at a control outside it
   * is pulled straight back in — so a focus given during the dismissal is undone, and the navigation
   * then drops focus on `<body>`. Second, the close **unmounts this component**: the slot's subpage
   * is the stage's intercepted route, so the pop discards it and the slot renders its default — the
   * panel never renders again with a different `pathname`. So the return belongs in this effect's
   * cleanup, which is the last moment the dialog has anything to say about the document.
   *
   * One retry, and only if the first focus did not survive: closing lands in more than one commit —
   * the slot closes, then the page underneath re-renders — and that second render can re-create the
   * control. The target is re-resolved rather than remembered as an element for that reason.
   */
  useEffect(() => {
    return () => {
      const resolve = returnFocusTo.current;
      if (resolve === null) return;
      returnFocusTo.current = null;

      const first = resolve();
      first?.focus();
      if (typeof requestAnimationFrame !== "function") return;
      requestAnimationFrame(() => {
        if (document.activeElement === first) return;
        resolve()?.focus();
      });
    };
  }, []);

  // The address stopped being a stage of this flow — the page underneath is the screen now.
  if (!isFlowStagePath(pathname)) return null;

  /** Leave the flow: back to the page it was opened from, with focus on the control that opened it. */
  const dismiss = () => {
    // One code path for `Esc`, the X and the overlay. Where to go, how far back, and what to focus
    // are `lib/flow/dialog-origin.ts`'s; the focus itself is the effect above, after the panel leaves.
    const origin = takeFlowOrigin();
    returnFocusTo.current = origin.focus;
    /*
     * **Closing is a pop, not a push.** The dialog is an intercepted route standing over a page the
     * address no longer names, and in Next's router a `push` back to that page is a no-op while an
     * interception is active — measured, the address and the panel both stayed exactly where they
     * were. Going *back* is what ends an interception: each stage advance was a history entry, so
     * popping every entry the flow pushed lands on the page it was opened from, and the flow's own
     * trail does not survive the dismissal (so the browser's Back does not walk back into it).
     */
    if (origin.entries !== null && origin.entries > 0) {
      window.history.go(-origin.entries);
      return;
    }
    // No Navigation API: one back press is the best a browser will tell us, and it is still a pop.
    router.back();
  };

  /**
   * **`Cancel` leaves the flow the way a dismissal does whenever the flow is a dialog (#975 D10).**
   *
   * The stage foot's `Cancel` is a link to `closeHref` — the template library, the gallery the
   * artifact closes onto — and on a stage's own page that is right: the reader followed an address
   * and `Cancel` takes them to the library. Inside the dialog it is wrong, and it gave one modal two
   * exits to two different pages: `Esc`, the X and the overlay close onto `takeFlowOrigin()` (the
   * page underneath), while `Cancel` a row below them navigated off that page entirely. Measured on
   * `/dashboard/relationships/<id> → Open the payment step` (#975 D10): the payment arrives as a
   * dialog over the relationship, and `Cancel` threw the reader out to the library.
   *
   * So the foot's control is caught before the link acts and handed to `dismiss()` — one exit, one
   * destination, no second address. The href is untouched, because the page mounting still renders
   * that same link, and a modified click (a new tab, a copied address) is left to the browser: it
   * lands on the stage's own address, which is a page and is supposed to behave like one.
   */
  const leaveFlow = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element) || target.closest("[data-create-cancel]") === null) return;
    event.preventDefault();
    dismiss();
  };

  /**
   * Post the stage's own form and follow the answer softly.
   *
   * The body is posted exactly as the browser would post it — `application/x-www-form-urlencoded`,
   * the same fields, the same order — so the endpoint cannot tell the two apart and no route learns
   * a second input shape. The redirect is followed rather than followed by hand, so the answer's own
   * address is read (`response.url`): a refusal answers the *stage* with its codes and an advance
   * answers the next stage, and guessing which one happened would throw the refusal away.
   */
  const submit = async (event: FormEvent<HTMLDivElement>) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const fields = new URLSearchParams();
      for (const [name, value] of new FormData(form)) {
        if (typeof value === "string") fields.append(name, value);
      }
      const response = await fetch(form.action, {
        method: (form.method === "" ? "post" : form.method).toUpperCase(),
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: fields.toString(),
        credentials: "same-origin",
        redirect: "follow",
      });
      const destination = new URL(response.url, window.location.origin);
      // A destination off this origin is not a stage — that is a real document navigation.
      if (destination.origin !== window.location.origin) {
        window.location.assign(destination.toString());
        return;
      }
      router.push(`${destination.pathname}${destination.search}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <StageShell
      title={title}
      closeLabel={closeLabel}
      closeHref={closeHref}
      wide={wide}
      {...(header === undefined ? {} : { header })}
      presentation={FLOW_MOUNT_DIALOG}
      onDismiss={dismiss}
    >
      <div
        data-flow-mount="dialog"
        aria-busy={busy}
        onSubmitCapture={submit}
        onClickCapture={leaveFlow}
      >
        {body}
      </div>
    </StageShell>
  );
}

export function RelationshipFlowShell({
  mount = "page",
  stage,
  title,
  closeLabel,
  closeHref,
  rail,
  header,
  children,
}: FlowShellProps) {
  const body = (
    <FlowStageBody stage={stage} rail={rail}>
      {children}
    </FlowStageBody>
  );

  if (mount === "dialog") {
    return (
      <FlowDialogMount
        title={title}
        closeLabel={closeLabel}
        closeHref={closeHref}
        wide={rail !== undefined}
        {...(header === undefined ? {} : { header })}
        body={body}
      />
    );
  }

  return (
    <StageShell
      title={title}
      closeLabel={closeLabel}
      closeHref={closeHref}
      wide={rail !== undefined}
      {...(header === undefined ? {} : { header })}
    >
      {body}
    </StageShell>
  );
}
