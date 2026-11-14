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
 *
 * **The door is named, because closing replaces it.** Measured in the browser (card `t_ce4796c3`,
 * `docs/qa/979-flow-entries/`): the pop that ends the interception re-renders the page underneath,
 * and React does not keep the anchor — the remembered element is detached by the time the shell's
 * focus is handed back, so focus fell to `<body>` on five of six doors. So each door carries
 * `data-flow-entry-id` (its `href`, which names one destination) and hands that selector to
 * `rememberFlowOrigin` as the fallback: the re-rendered door is a different node but the same
 * control, which is what "focus returns to the trigger" has to mean once the trigger is replaced.
 */
import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";
import { rememberFlowOrigin } from "@/lib/flow/dialog-origin";

/** Everything a `Link` takes, minus the click handler this component owns. */
type FlowEntryLinkProps = Omit<ComponentProps<typeof Link>, "onClick">;

/** The attribute a door carries, and the selector that finds it again after a re-render. */
const DOOR_ID = "data-flow-entry-id";

/** `[data-flow-entry-id="<href>"]`, with the characters that would close the string escaped. */
function doorSelector(href: FlowEntryLinkProps["href"]): string | null {
  if (typeof href !== "string" || href === "") return null;
  return `[${DOOR_ID}="${href.replace(/["\\]/g, "\\$&")}"]`;
}

export function FlowEntryLink({ href, children, ...rest }: FlowEntryLinkProps) {
  /**
   * Remember the page and the control **before** the navigation starts. `currentTarget` is the
   * anchor, which is what receives focus back when the dialog closes; the pathname is read here
   * rather than passed in so a surface cannot remember somebody else's page. The fallback is the
   * same door by name, for the render that replaces this node.
   */
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    rememberFlowOrigin(window.location.pathname, event.currentTarget, doorSelector(href));
  };

  return (
    <Link
      href={href}
      onClick={onClick}
      data-flow-entry="true"
      {...(typeof href === "string" ? { [DOOR_ID]: href } : {})}
      {...rest}
    >
      {children}
    </Link>
  );
}
