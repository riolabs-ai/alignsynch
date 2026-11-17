"use client";
/**
 * Moves focus to a stage's title when the stage mounts.
 *
 * A wizard that swaps screens in place leaves focus wherever the last control was, so a keyboard or
 * screen-reader user lands nowhere: the heading is on screen and the caret is on a button that no
 * longer exists. `FlowStageCard` gives its `<h2>` `id` + `tabIndex={-1}`; this is the effect that
 * calls `focus()` on it, and it renders nothing.
 *
 * The one client file in this set, and it earns the directive: focus is a DOM effect, and an effect
 * cannot run on the server. Everything it needs is the id.
 */
import { useEffect } from "react";

export function StageTitleFocus({ id }: { id: string }) {
  useEffect(() => {
    document.getElementById(id)?.focus();
  }, [id]);
  return null;
}
