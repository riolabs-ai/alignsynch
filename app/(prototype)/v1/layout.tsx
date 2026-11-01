// template-ancestor: none — prototype screen, approved for /v1
import { V1Shell } from "@/components/v1/v1-shell";
import type { ReactNode } from "react";

/**
 * The /v1 layout — the prototype's own chrome, and the only chrome a `/v1/**` route gets.
 *
 * The prototype used to live inside `(mainlayout)` and `(marketing)`, so its pages inherited
 * the real product's shell and public header/footer — the sidebar nav (`/dashboard`,
 * `/assessment/templates`, `/`), the account menu and the footer's link columns. A reviewer one
 * click from the real app cannot tell which build they are judging, so the whole `/v1` tree now
 * lives in this `(prototype)` group and renders only `V1Shell`: the persona bar, the
 * `Prototype · V1` marker, and the review-status chip. Every link a `/v1` screen draws is either
 * a `/v1/**` destination or an external release link — there is no escape hatch back to the real
 * app, because a dead-end inside a prototype is honest and an escape is confusing.
 */
export default function V1Layout({ children }: { children: ReactNode }) {
  return <V1Shell>{children}</V1Shell>;
}
