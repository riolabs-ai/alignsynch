"use server";

/**
 * The rail's width, written where a server render can read it (#542 phase 2).
 *
 * A server action rather than a client handler, because the thing that must change is the *next
 * request's* render: `app/(mainlayout)/layout.tsx` reads this cookie before any HTML exists, so the
 * rail is the right width in the first paint. `components/layout/sidebar.tsx` submits the form this
 * action backs; nothing in the browser stores the preference.
 *
 * `revalidatePath("/", "layout")` is what re-renders the shell in the same round trip — the form
 * submission is a POST the router follows with a fresh RSC payload for the current page. Without it
 * the cookie would be written and the reader would see the old width until their next navigation,
 * which is the "toggle does nothing" bug in a different costume.
 *
 * The cookie is `httpOnly` on purpose: no script reads it (the width is decided on the server), and
 * a layout preference is not worth handing to the page. `sameSite: lax` because this is a
 * first-party navigation, and `path: "/"` because the rail is on every page behind the shell.
 */
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import {
  RAIL_COOKIE,
  RAIL_COOKIE_MAX_AGE,
  railStateFrom,
  toggledRailState,
} from "@/lib/shell/rail-preference";

export async function toggleRail(): Promise<void> {
  const store = await cookies();
  const next = toggledRailState(railStateFrom(store.get(RAIL_COOKIE)?.value));
  store.set(RAIL_COOKIE, next, {
    path: "/",
    maxAge: RAIL_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
  });
  revalidatePath("/", "layout");
}
