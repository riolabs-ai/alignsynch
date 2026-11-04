// template-ancestor: components/layout/footer.tsx   (variation: a row that leaves the app — a new tab, the external marker and a name that says so)

import { cn } from "@/lib/utils";
import { NEW_TAB_LABEL } from "@/lib/marketing-routes";
import { ExternalLink } from "lucide-react";
import type React from "react";

/**
 * The link that leaves the app — and the only markup the dashboard should use for one.
 *
 * **The rule it exists for:** anything inside the dashboard shell (`app/(mainlayout)`, the
 * authenticated product) that points at the public marketing site (`app/(marketing)`) opens in a
 * **new tab**, because the reader is leaving the app and must not lose the screen they were on.
 * In-dashboard navigation stays in-tab; this component is only for dashboard → public site.
 *
 * Three things are true of every departure, so they live here rather than at each call site:
 *
 *   - `target="_blank"` **and** `rel="noopener noreferrer"` — both, always. `noopener` because a
 *     page that keeps `window.opener` can navigate the app's own tab, and `noreferrer` because the
 *     public site has no business knowing which in-app screen the reader came from.
 *   - the accessible name ends **"opens in a new tab"**, so a screen reader is told the same thing
 *     the icon shows. No silent new tab.
 *   - the `ExternalLink` marker, because a new tab the reader did not ask for is disorienting if
 *     nothing on screen said it would happen.
 *
 * It renders a plain `<a>`, not `next/link`: a new tab is a document load in another tab, and
 * client-side routing would move the tab the reader is in.
 *
 * `scripts/leaving-links.ts` (E39) enforces what this component cannot enforce for itself: a
 * dashboard module that links to a marketing route must use this component or carry `target` +
 * `rel` on the element itself, and a shared surface (`Footer`, `AppNav`) must be mounted with
 * `leaving`. A component guarantees the pair only where it is used, so the rule reads the call
 * site, not this file.
 */
export function LeavingLink({
  href,
  label,
  className,
  iconClassName,
  onClick,
  title,
  tourAnchor,
  children,
}: {
  /** The marketing destination. A member of the public site, never an in-app route. */
  href: string;
  /** The name the link already had; the "opens in a new tab" suffix is added here. */
  label: string;
  className?: string;
  /** The marker's size/placement, for a band whose type scale is not the footer's. */
  iconClassName?: string;
  /** The shell's own side effect — the drawer's `onNavigate`, which has to close. */
  onClick?: () => void;
  /** The hover text, where the row already carries one. */
  title?: string;
  /** The first-run tour's anchor (#455), for a row the shell draws itself. */
  tourAnchor?: string;
  /** The visible content, when the link is not a plain label (the rail's brand lockup). */
  children?: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} — ${NEW_TAB_LABEL}`}
      title={title}
      onClick={onClick}
      data-tour={tourAnchor}
      className={className}
    >
      {children ?? label}
      <ExternalLink
        aria-hidden="true"
        className={cn("ml-1 inline h-3 w-3 shrink-0", iconClassName)}
      />
    </a>
  );
}
