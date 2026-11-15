/**
 * The member's relationship list, plus the one slot the create flow's dialog is drawn in (#979 B).
 *
 * **Why this segment owns the slot.** The dialog is an *intercepted* route: pressing "Create
 * relationship" on this page soft-navigates to the stage's own address, and the stage renders in
 * `@flow` while this page stays in `children` — the mounting the owner chose (decision B: one
 * dialog shell hosting the five existing stages, the wizard routes kept for deep links). The
 * interception is declared here rather than at a higher layout on purpose: an interception only
 * applies to navigation from the segment that declares it, so a slot on the whole product shell
 * would open this flow over every screen in the app — the opposite of a card that proves one entry.
 *
 * **A `layout` because a slot needs one to be rendered into.** It draws nothing of its own: no
 * wrapper element, no chrome. `children` is the page and `flow` is the dialog, which positions
 * itself.
 */
import type { ReactNode } from "react";

export default function MemberRelationshipsLayout({
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
