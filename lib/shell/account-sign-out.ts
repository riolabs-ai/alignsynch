/**
 * Where a sign-out lands, and what it is allowed to say about it (#1136).
 *
 * `endSession()` (`lib/auth/sign-out.ts`) is the one step every sign-out control runs — it revokes
 * the session server-side. This module is the *other* half of the action, and it is deliberately
 * separate because the two halves answer different questions: the revoke is the same on every
 * brand, and the landing is chrome.
 *
 * **The v2 bundle names AlignSynch's landing** (`docs/specs/v2-bundles/11-…/settings.html` and its
 * implementation map): Sign Out goes to the public catalog `/relationship-templates` and confirms
 * with "You’re signed out." That is where a person who has just ended a session should be able to
 * go on reading — not on the front page of a marketing site, and not on a dashboard that is about
 * to answer `/login`.
 *
 * **QuizHub keeps the destination it shipped** (`/`, the marketing front page) and no toast: the
 * bundles are the alignment build's visual authority, and a card about that surface does not get to
 * move the quiz product's session exit.
 *
 * The sentence is not spelled here — `toast` names the fixture item the caller resolves out of
 * `data/pages/shell.ts`, so the words stay in the copy layer (E23) and a brand without a toast says
 * nothing rather than borrowing one.
 */
import type { BrandId } from "@/data/brand";

export interface AccountSignOut {
  /** Where the browser goes once the session is gone. Always a route this build serves. */
  readonly href: string;
  /** The fixture item to announce on arrival, or `undefined` when this brand says nothing. */
  readonly toast?: "logout-toast";
}

export function accountSignOutFor(brandId: BrandId): AccountSignOut {
  switch (brandId) {
    case "quizhub":
      return { href: "/" };
    case "alignsynch":
      return { href: "/relationship-templates", toast: "logout-toast" };
    default: {
      const unhandled: never = brandId;
      throw new Error(`no sign-out landing for brand ${String(unhandled)}`);
    }
  }
}
