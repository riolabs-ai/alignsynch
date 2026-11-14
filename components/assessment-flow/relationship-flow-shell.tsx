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
 * overlay all dismiss; each closes onto `flowOriginPath()` — the page the trigger was pressed on,
 * remembered by the trigger itself — and focuses that control before the dialog leaves the document,
 * so the return is a keyboard-visible fact rather than a scroll to the top. The draft is untouched:
 * the Account stage writes it, a dismissal has never discarded anything, and no "discard?" prompt is
 * invented for a screen the spec does not draw.
 *
 * **A dialog does not outlive its address.** If the flow navigates somewhere that is not a stage of
 * this flow — the send's own confirmation, the plans page, the template library via `Cancel` — the
 * shell renders nothing and the page underneath takes over. Radix keeps a slot's last active subpage
 * across soft navigations, so without this guard a modal would stay standing over a screen it no
 * longer describes.
 */
import { usePathname, useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import type { PageCopy } from "@/content/pages";
import { closeFlowToOrigin } from "@/lib/flow/dialog-origin";
import { StageColumn } from "./stage-column";
import { StageRail } from "./stage-rail";
import { StageShell } from "./stage-shell";

/** Which of the flow's five stages this render is. `undefined` is the "nothing to copy" screen. */
export type FlowStage = 1 | 2 | 3 | 4 | 5;

/** How the shell is mounted. `page` is today's behaviour; `dialog` is the mounting #979 B adds. */
export type FlowMount = "page" | "dialog";

/**
 * Is this pathname one of the flow's own stage addresses?
 *
 * The dialog only describes the flow while the address belongs to it. Derived from the address
 * rather than from a flag, because the address is the fact the whole mounting is built on: a
 * refresh of it renders the stage as a page, and a soft navigation away from it closes the dialog.
 */
export function isFlowStagePath(pathname: string): boolean {
  return /\/templates\/relationship\/[^/]+\/create(\/(mode|aspects|commit|invite))?\/?$/.test(
    pathname,
  );
}

/** What both mountings receive. */
export interface FlowShellProps {
  /** `page` renders in place on the stage's own route; `dialog` renders over the origin page. */
  mount?: FlowMount;
  /** Which stage is current — the rail's fact. Omitted on the "nothing to copy" screen. */
  stage?: FlowStage;
  /** The screen's fixture: the rail's five words come from its `stages` section. */
  copy: PageCopy;
  /** The dialog's accessible name — the stage's own heading, already resolved by the caller. */
  title: string | undefined;
  /** The close control's accessible name, from the caller's fixture. */
  closeLabel: string;
  /** Where `Cancel` leaves to. The address the flow was started from is what *closing* uses. */
  closeHref: string;
  /** The stage: its heading, its bands and its body. Never re-drawn here. */
  children: ReactNode;
}

/**
 * The column and the rail above the stage — **one element tree, both mountings**.
 *
 * The rail is drawn here rather than by each stage for the reason #825 gives: one progress pattern,
 * one count, one place a rename hides. `stage === undefined` is the refusal screen that has no stage
 * to number, and it draws no rail rather than a rail claiming to stand on a stage it is not.
 */
function FlowStageBody({
  stage,
  copy,
  children,
}: {
  stage: FlowStage | undefined;
  copy: PageCopy;
  children: ReactNode;
}) {
  return (
    <StageColumn>
      <div className="space-y-6">
        {/* Above the stage's own heading, on every stage that has one (#687, #825). */}
        {stage === undefined ? null : <StageRail copy={copy} current={stage} />}
        {children}
      </div>
    </StageColumn>
  );
}

/** The panel's own props, as the dialog mounting passes them to the frame. */
type FrameProps = Pick<FlowShellProps, "title" | "closeLabel" | "closeHref">;

/**
 * The dialog mounting: `StageShell`'s frame, portalled over the page underneath, carrying the two
 * behaviours a page render does not need.
 *
 * A separate component and not a branch inside `RelationshipFlowShell`, because hooks cannot be
 * conditional and a static render of a stage address must not ask for a router (see the file note).
 */
function FlowDialogMount({ title, closeLabel, closeHref, body }: FrameProps & { body: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);

  // The address stopped being a stage of this flow — the page underneath is the screen now.
  if (!isFlowStagePath(pathname)) return null;

  /** Leave the flow: back to the page it was opened from, with focus on the control that opened it. */
  const dismiss = () => {
    // One code path for `Esc`, the X and the overlay, and it is `lib/flow/dialog-origin.ts`'s:
    // focus the trigger, forget the origin, push the page underneath.
    closeFlowToOrigin((path) => router.push(path));
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
      presentation="dialog"
      onDismiss={dismiss}
    >
      <div data-flow-mount="dialog" aria-busy={busy} onSubmitCapture={submit}>
        {body}
      </div>
    </StageShell>
  );
}

export function RelationshipFlowShell({
  mount = "page",
  stage,
  copy,
  title,
  closeLabel,
  closeHref,
  children,
}: FlowShellProps) {
  const body = (
    <FlowStageBody stage={stage} copy={copy}>
      {children}
    </FlowStageBody>
  );

  if (mount === "dialog") {
    return (
      <FlowDialogMount title={title} closeLabel={closeLabel} closeHref={closeHref} body={body} />
    );
  }

  return (
    <StageShell title={title} closeLabel={closeLabel} closeHref={closeHref}>
      {body}
    </StageShell>
  );
}
