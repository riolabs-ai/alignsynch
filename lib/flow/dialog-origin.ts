/**
 * Where the create flow's dialog was opened from, what opened it, and how far the flow has walked
 * the history since (#979 B).
 *
 * **Why this is module state and not a search param.** The dialog is mounted by an intercepted
 * route: the address is the stage's own (`/templates/relationship/<slug>/create/…`), which is what
 * makes a refresh, a shared link and the back button land on the same screen. The *origin* is the
 * page underneath, and nothing in the URL carries it — stamping a `?from=` onto every stage address
 * would put a second fact in an address whose whole job is to name one screen, and a person who
 * refreshed would then see a parameter that no longer means anything.
 *
 * **Why the trigger is remembered, and why a fallback comes with it.** Radix restores focus to
 * whatever held it when the content mounted, and a route change is not a click: by the time the
 * dialog mounts, the element the person pressed is one navigation behind. Remembering the control is
 * what makes "`Esc` returns focus to the trigger" a fact rather than a hope. But the intercepted
 * render re-renders the page underneath, and a disclosure that was open before the click can be
 * closed by that render — measured: the Create control is **not in the document** while the dialog
 * stands (`docs/qa/979-flow-parity/report.json`, `opened.triggerPresent: false`). So the caller
 * nominates a second, always-mounted target as well, and focus goes to the first of the two that is
 * still in the document. Without that, "focus returns to the trigger" would silently return it to
 * `<body>`.
 *
 * **Why the entry index is remembered.** Closing must *pop* the flow's own history entries rather
 * than push a new address: the dialog is an intercepted route, and a `router.push` back to the page
 * it stands over is a no-op in Next's router — measured, in `docs/qa-979-flow-parity/`, as a push
 * that leaves the address and the dialog exactly as they were. Popping needs a count, and the count
 * is `window.navigation.currentEntry.index`'s difference from the index the flow was opened at;
 * `history.length` cannot answer it because it never shrinks.
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
  /** A control to fall back on when the trigger is no longer in the document. */
  readonly fallback: string | null;
  /** The session-history index the flow was opened at, when the browser exposes one. */
  readonly entry: number | null;
}

let origin: FlowOrigin | null = null;

/**
 * The control that reopens the chooser — the **fallback** focus target for a dismissal.
 *
 * Measured: the intercepted render re-renders the page underneath, and the disclosure that was open
 * when the flow was entered comes back closed, so the Create control is not in the document while
 * the dialog stands. This marker is on the always-mounted control beside it, which is the door back
 * into the flow; the page that mounts the flow puts the attribute on and hands this selector to
 * `rememberFlowOrigin`.
 */
export const FLOW_ORIGIN_FALLBACK_SELECTOR = "[data-relationships-start-toggle]";

/** The Navigation API's index for this entry — `null` where the browser has no Navigation API. */
function historyIndex(): number | null {
  if (typeof window === "undefined") return null;
  const navigation = (window as unknown as { navigation?: { currentEntry?: { index?: number } } })
    .navigation;
  const index = navigation?.currentEntry?.index;
  return typeof index === "number" ? index : null;
}

/**
 * Called by the control that opens the flow, immediately before it navigates.
 *
 * `fallback` is a selector for a control that stays mounted while the dialog stands — the door that
 * leads back into the flow — used when the trigger itself has been re-rendered away.
 */
export function rememberFlowOrigin(
  path: string,
  trigger: HTMLElement | null = null,
  fallback: string | null = null,
): void {
  origin = { path, trigger, fallback, entry: historyIndex() };
}

/**
 * Where closing goes. The remembered page, or the member's relationship list when the flow was
 * reached without a trigger — the one page every person who starts a relationship is standing on.
 */
export function flowOriginPath(fallback: string = RELATIONSHIPS_PATH): string {
  return origin?.path ?? fallback;
}

/**
 * Resolve the control to give focus back to: the trigger while it is in the document, else the
 * caller's fallback, else `null` — a detached element cannot be focused, and focusing nothing is
 * better than focusing `<body>` silently (the shell's own effect leaves the document's focus alone
 * when this is `null`).
 */
function resolveFocusTarget(
  trigger: HTMLElement | null,
  fallback: string | null,
): HTMLElement | null {
  if (trigger?.isConnected === true) return trigger;
  if (fallback === null || typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>(fallback);
}

/**
 * **How many history entries the flow itself pushed.**
 *
 * `Esc` closes by going back, and one back press walks back one stage — so the dismissal has to pop
 * exactly the entries the flow created, or a person three stages in would land on stage 2. The count
 * comes from the Navigation API's entry index, captured when the flow was opened; `null` means the
 * browser does not expose it, and the caller falls back to a single `router.back()`.
 */
export function flowEntriesSinceOrigin(): number | null {
  const openedAt = origin?.entry ?? null;
  const now = historyIndex();
  if (openedAt === null || now === null) return null;
  return Math.max(0, now - openedAt);
}

/** Forget the origin — after the dialog has closed onto it. */
export function clearFlowOrigin(): void {
  origin = null;
}

/**
 * Read where the flow was opened from, and forget it.
 *
 * **Why this hands the trigger back instead of focusing it.** Focus cannot be returned to the
 * trigger while the dialog is still in the document: the panel is a modal, its own focus trap owns
 * the page, and a focus that lands outside it is pulled straight back in — measured, on this
 * component, in `tests/flow-dialog-keyboard.test.tsx`. So the trigger is *returned*, and the shell
 * that owns the panel gives it focus in the effect that runs once the panel has left. A caller that
 * focused it here would be asking the trap to undo it, and would then navigate away from a document
 * whose focus had been dropped on `<body>`.
 *
 * The navigation is likewise the caller's: this module knows where the flow came from and how far
 * it walked, not how the router should record it.
 */
export interface FlowOriginTarget {
  /** The page underneath — where closing returns. */
  readonly path: string;
  /** How many entries to pop to be back on the origin page; `null` when it cannot be counted. */
  readonly entries: number | null;
  /**
   * Resolve the control to focus, **at the moment of asking**: the trigger while it is still in the
   * document, else the caller's fallback. A function and not an element because the render that
   * closes the dialog can also re-create the page underneath — the element captured a moment ago can
   * be gone by the time the panel has left, and an element cannot re-find itself.
   */
  readonly focus: () => HTMLElement | null;
}

export function takeFlowOrigin(fallback: string = RELATIONSHIPS_PATH): FlowOriginTarget {
  const path = flowOriginPath(fallback);
  const trigger = origin?.trigger ?? null;
  const selector = origin?.fallback ?? null;
  const entries = flowEntriesSinceOrigin();
  clearFlowOrigin();
  return {
    path,
    entries,
    focus: () => resolveFocusTarget(trigger, selector),
  };
}
