/**
 * Where the create flow's dialog was opened from, and what opened it (#979 B).
 *
 * **Why this is module state and not a search param.** The dialog is mounted by an intercepted
 * route: the address is the stage's own (`/templates/relationship/<slug>/create/…`), which is what
 * makes a refresh, a shared link and the back button land on the same screen. The *origin* is the
 * page underneath, and nothing in the URL carries it — stamping a `?from=` onto every stage address
 * would put a second fact in an address whose whole job is to name one screen, and a person who
 * refreshed would then see a parameter that no longer means anything.
 *
 * **Why the trigger is remembered too.** Radix restores focus to whatever held it when the content
 * mounted, and a route change is not a click: by the time the dialog mounts, the element the person
 * pressed is one navigation behind. Remembering the control is what makes "`Esc` returns focus to
 * the trigger" a fact rather than a hope — it is the same element that opened the flow, focused
 * before the dialog leaves the document.
 *
 * **Client-only, and deliberately not storage.** This is not a preference: a reload is not a
 * re-entry, and the deep-link path renders the stage page with no dialog at all. Module scope lives
 * exactly as long as the browsing session's JavaScript, which is the same lifetime as the dialog.
 */
import { RELATIONSHIPS_PATH } from "@/lib/flow/paths";

interface FlowOrigin {
  /** The pathname the flow was opened from — where closing returns. */
  readonly path: string;
  /** The control that opened it, or `null` when the flow was reached without one. */
  readonly trigger: HTMLElement | null;
}

let origin: FlowOrigin | null = null;

/** Called by the control that opens the flow, immediately before it navigates. */
export function rememberFlowOrigin(path: string, trigger: HTMLElement | null = null): void {
  origin = { path, trigger };
}

/**
 * Where closing goes. The remembered page, or the member's relationship list when the flow was
 * reached without a trigger — the one page every person who starts a relationship is standing on.
 */
export function flowOriginPath(fallback: string = RELATIONSHIPS_PATH): string {
  return origin?.path ?? fallback;
}

/** The control to give focus back to, when it is still in the document. */
export function flowOriginTrigger(): HTMLElement | null {
  const trigger = origin?.trigger ?? null;
  return trigger?.isConnected ? trigger : null;
}

/** Forget the origin — after the dialog has closed onto it. */
export function clearFlowOrigin(): void {
  origin = null;
}

/**
 * Leave the flow: focus the control that opened it, forget the origin, and go back to that page.
 *
 * The order is the behaviour. Focus lands on the trigger **before** the navigation, because the
 * navigation is what unmounts the dialog: focus after it would be focus on an element that is no
 * longer there, which is the "returns you to the top of the document" defect. The push is handed in
 * rather than taken from a router so this is the same code path in a test as in the shell, and so a
 * dismissal can never be a document navigation.
 */
export function closeFlowToOrigin(
  push: (path: string) => void,
  fallback: string = RELATIONSHIPS_PATH,
): void {
  const path = flowOriginPath(fallback);
  flowOriginTrigger()?.focus();
  clearFlowOrigin();
  push(path);
}
