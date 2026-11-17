/**
 * The public header's own words — the four strings no existing fixture owns.
 *
 * Chrome copy has one home today: `data/pages/shell.ts`, projected per brand by
 * `lib/shell-copy.ts`. Three of the public header's strings already live there — the row labels
 * (`templates`, `how-it-works`, `pricing`) and the visitor's ghost action (`account`'s
 * `signed-out`, "Sign In") — and this file deliberately does **not** repeat them: a second copy of
 * a label is how two surfaces start disagreeing about one word.
 *
 * What is left is what the bundle names and nothing in the tree did:
 *
 *   nav-name     the accessible name on the desktop `<nav>` ("Main");
 *   menu-name    the same on the small-screen panel ("Main mobile");
 *   menu-open    the disclosure button's label while closed;
 *   menu-close   the same while open — a toggle whose name does not change tells a screen reader
 *                nothing about what pressing it did;
 *   start-free   the header's one primary action, into the catalogue's shelf (`#catalog`).
 *
 * `start-free` is the owner's label from issue #1127 ("one primary **Start Free**"), kept verbatim.
 * It is not the shell's `sign-up`: the visitor's action here opens the catalogue and the wizard's
 * stage 1, and the account is created at stage 4 — a button labelled "Sign Up" would promise a form
 * this door does not open.
 *
 * Plain data, no zod and no React, so both the server layout and a test can read it; the component
 * that draws it holds no literal of its own (E23 budget 0 on `components/layout/**`).
 */
export const publicChromeWords = {
  navName: "Main",
  menuName: "Main mobile",
  menuOpen: "Open menu",
  menuClose: "Close menu",
  startFree: "Start Free",
} as const;
