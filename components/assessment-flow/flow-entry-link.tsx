"use client";

// template-ancestor: components/layout/leaving-link.tsx   (variation: the in-product door into the create flow — a soft navigation that remembers the control and the page it was pressed on, so the flow's dialog can close back onto them, instead of a link that leaves the app in a new tab)

/**
 * The **in-product** door into the create flow (#979 B).
 *
 * One anchor, two facts, and both of them are why this file exists:
 *
 *   **a soft navigation.** `next/link`, not a bare `<a>`. The flow's dialog is mounted by an
 *   *intercepted* route (`@flow/(...)templates/relationship/[slug]/create/**` in each host's
 *   segment), and an interception only happens on a client-side navigation — a plain anchor is a
 *   document load, so the route renders as a page and the page the person was standing on is gone.
 *   That is the whole difference between "opens in place" and "navigates", and it is one attribute.
 *
 *   **the origin, remembered by the control.** The dialog's address is the stage's own, so nothing
 *   in the URL says which page it was opened over. This anchor remembers it — and *itself* — at the
 *   click, which is what lets `Esc`, the X and the overlay close back onto the page underneath with
 *   focus on the control that opened it (`lib/flow/dialog-origin.ts`).
 *
 * **`window.location.pathname` at the click, not `usePathname()` at render.** A render hook here
 * would put a Next router requirement on every server render that draws a catalogue card — the same
 * trap `RelationshipFlowShell` documents for the page mounting — and the address at the moment of
 * the click *is* the page the person is on, so nothing is lost by reading it then.
 *
 * **What is deliberately not here.** No stage name, no template argument, no copy. `href` is built
 * by the caller (`createRelationshipPath()`), so the dialog is a mounting choice and never a second
 * argument parser: a control that passes a template keeps passing the same template, in the same
 * address, with the same `?problem=` codes coming back.
 *
 * The marketing surfaces do **not** use this: a dialog over a crawlable page breaks its first paint
 * and its back button, so `app/(marketing)/**` keeps navigating to the wizard route (issue #979,
 * card `t_ce4796c3`).
 */
import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";
import { rememberFlowOrigin } from "@/lib/flow/dialog-origin";

/** Everything a `Link` takes, minus the click handler this component owns. */
type FlowEntryLinkProps = Omit<ComponentProps<typeof Link>, "onClick">;

export function FlowEntryLink({ href, children, ...rest }: FlowEntryLinkProps) {
  /**
   * Remember the page and the control **before** the navigation starts. `currentTarget` is the
   * anchor, which is what receives focus back when the dialog closes; the pathname is read here
   * rather than passed in so a surface cannot remember somebody else's page.
   */
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    rememberFlowOrigin(window.location.pathname, event.currentTarget);
  };

  return (
    <Link href={href} onClick={onClick} data-flow-entry="true" {...rest}>
      {children}
    </Link>
  );
}
