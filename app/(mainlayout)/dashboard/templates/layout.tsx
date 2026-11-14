/**
 * `/dashboard/templates` drew a create door that navigated away from the shelf; this segment makes
 * it a dialog (#979 B).
 *
 * **Why a slot per segment, and not one on the product shell.** An interception applies to
 * navigation *from the segment that declares it*, which is what makes this safe: declared at
 * `(mainlayout)/layout.tsx` it would also catch one stage page navigating to the next — stage 3's
 * "Continue" is a link — and the flow would draw a modal over itself. Declared here it covers the
 * member's shelf (and the private editor under `[id]`, which renders no create door), and nothing
 * that is already the flow.
 *
 * **A `layout` because a slot needs one.** It draws nothing of its own: `children` is the page and
 * `flow` is the dialog, which positions itself; `@flow/default.tsx` draws nothing when no
 * intercepted route matched.
 */
import type { ReactNode } from "react";

export default function MemberTemplatesLayout({
  children,
  flow,
}: {
  children: ReactNode;
  flow: ReactNode;
}) {
  return (
    <>
      {children}
      {flow}
    </>
  );
}
