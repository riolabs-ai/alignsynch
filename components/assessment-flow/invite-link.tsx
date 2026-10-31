/**
 * The invitation link's copy control (#257).
 *
 * When no email carried the invitation, this screen prints the link and, until this unit,
 * stopped there: the only way to get a second person into the product was to select the URL
 * with a mouse. The link is the one thing that matters here, so the control accelerates it
 * and never replaces it — the URL stays a `<code>` the reader can always select themselves,
 * whether or not the button works in their browser.
 *
 * Three rules, each one a way this goes wrong:
 *
 *   - **Nothing is written on render.** A clipboard write without a user gesture is denied by
 *     every browser and is a hostile default, so `writeText` is reachable only from the click
 *     handler: this module has no effect, and `tests/invite-copy.test.tsx` mounts it with a
 *     stubbed clipboard and asserts zero calls after the mount settles.
 *   - **The exact string is copied.** `link` is the prop the screen already drew — the whole
 *     invitation URL, unrebuilt: no prefix, no truncation, no tracking parameter appended. The
 *     test compares the argument `writeText` received with the `<code>`'s text and with the
 *     prop, character for character, and checks the length as well, so a prefix or a suffix
 *     cannot pass.
 *   - **A refusal is drawn, not swallowed.** `navigator.clipboard` absent, `writeText` missing,
 *     or a rejected promise all land in the same branch: the link's own text is selected with a
 *     `Range`, and the sentence says that is what happened. When even the selection fails the
 *     reader is told to select it themselves instead of being told a selection exists. The
 *     confirmation is a `role="status"` / `aria-live="polite"` region that is present and empty
 *     from first paint — the sentence is announced to a screen reader and stays on screen, so
 *     it is not a toast that vanishes before it is read.
 *
 * The words are `data/pages/assessment-instance.ts` (E23); this file holds none. The token is
 * copied to the clipboard and nowhere else — no log, no analytics event, no query parameter.
 */
"use client";

import type { PageCopySection } from "@/content/pages";
import { fillLabel, itemLabel } from "@/lib/page-copy";
import { useRef, useState } from "react";

/**
 * What the control has to report, and nothing else:
 *
 *   idle                 nothing has been attempted — the live region is empty
 *   copied               the browser put the URL on the clipboard
 *   selected             the browser refused, and the link's text is selected for the reader
 *   select-it-yourself   the browser refused and the selection could not be made either
 */
type CopyOutcome = "idle" | "copied" | "selected" | "select-it-yourself";

/**
 * Put `text` on the clipboard, and answer whether the browser actually took it.
 *
 * Every refusal is a `false`, never a throw: a missing API (`navigator.clipboard` is
 * `undefined` in a page served over plain HTTP, and in a browser that predates the API), a
 * missing method, and a rejected promise are the same fact to the reader — the link is not on
 * the clipboard — and they are the same branch in `copyLink()`.
 */
async function writeToClipboard(text: string): Promise<boolean> {
  const clipboard = navigator.clipboard;
  if (clipboard === undefined || typeof clipboard.writeText !== "function") return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Select the element's own text, and answer whether the selection now holds exactly that.
 *
 * The comparison is the point: a browser can expose `getSelection()` and still refuse a range
 * (a read-only selection, an element detached by a re-render), and reporting "it is selected
 * above" when it is not sends the reader to paste nothing. `textContent` is the URL here, so
 * "the selection covers the whole link" is `selection.toString() === textContent`.
 */
function selectContents(node: HTMLElement | null): boolean {
  if (node === null || typeof window.getSelection !== "function") return false;
  const selection = window.getSelection();
  if (selection === null) return false;
  const range = document.createRange();
  range.selectNodeContents(node);
  selection.removeAllRanges();
  selection.addRange(range);
  return selection.toString() === node.textContent;
}

/** The sentence the region carries in each outcome; empty until something is attempted. */
function outcomeMessage(
  copy: PageCopySection,
  outcome: CopyOutcome,
  counterpartyName: string,
): string {
  switch (outcome) {
    case "idle":
      return "";
    case "copied":
      return fillLabel(itemLabel(copy, "copy-done"), { counterparty: counterpartyName });
    case "selected":
      return itemLabel(copy, "copy-manual");
    case "select-it-yourself":
      return itemLabel(copy, "copy-unavailable");
  }
}

export function InviteLink({
  link,
  copy,
  counterpartyName,
}: {
  /** The invitation URL exactly as the screen drew it — copied verbatim, never rebuilt. */
  link: string;
  /** The `invite` band: `copy`, `copy-done`, `copy-manual`, `copy-unavailable` (E23). */
  copy: PageCopySection;
  /** Who the invitation is for, for the confirmation's sentence. */
  counterpartyName: string;
}) {
  const textRef = useRef<HTMLElement | null>(null);
  const [outcome, setOutcome] = useState<CopyOutcome>("idle");

  const copyLink = async (): Promise<void> => {
    if (await writeToClipboard(link)) {
      setOutcome("copied");
      return;
    }
    setOutcome(selectContents(textRef.current) ? "selected" : "select-it-yourself");
  };

  return (
    <>
      {/* The link itself, unchanged: a reader who never presses the button still has the URL
          on screen and selectable. `break-all` keeps a 43-character token from widening the
          column it sits in. */}
      <code ref={textRef} className="break-all text-xs text-primary">
        {link}
      </code>
      <button
        type="button"
        onClick={() => void copyLink()}
        data-copy-control="true"
        className="ml-2 rounded-md border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        {itemLabel(copy, "copy")}
      </button>
      {/* Present from first paint so the sentence is announced when it appears; it stays on
          screen afterwards, because the reader may be looking at the link, not at the button. */}
      <span
        role="status"
        aria-live="polite"
        data-copy-outcome={outcome}
        className="mt-1 block text-xs text-gray-600 dark:text-gray-300"
      >
        {outcomeMessage(copy, outcome, counterpartyName)}
      </span>
    </>
  );
}
