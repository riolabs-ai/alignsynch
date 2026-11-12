/**
 * `/dashboard/support` — the member's support surface, inside the dashboard (#542 phase 1).
 *
 * **What was wrong.** The rail's Support row opened `/support`, an account page whose one action
 * was a link to the public help centre: a signed-in member with a question was sent out of the
 * workspace to read a page written for someone who has not bought the product. This route is the
 * work itself — the knowledge base list, one article at
 * `/dashboard/support/articles/[slug]`, and a contact form whose submission is a stored row.
 *
 * **The gate is `requireRole("member")`.** Signed out is `redirect(/login?next=/dashboard/support)`
 * (a 307, the same answer every console route gives), and every signed-in account is at least
 * `member`, so the three surfaces this card adds answer for the role the card names. Nothing here
 * reads a role above `member`, so no admin surface can appear — the route's own read is filtered by
 * the session's id and nothing else.
 *
 * **The confirmation is derived from a row.** The form's server action
 * (`./actions.ts`) stores the message through `lib/contact/submit.ts` and returns with the id the
 * insert produced; this page re-reads that row **by id and by the signed-in address**
 * (`readOwnContactMessage`) and hands it to the view. A `thread` renders "message X, status new";
 * a state with no row renders that state's sentence. No path here prints a success line about a
 * message that does not exist.
 *
 * **A database that cannot answer is the panel, not a 500.** The confirmation read is best-effort:
 * `DatabaseUnavailableError` is caught and the outcome falls back to the state's own sentence —
 * which is honest, because the state came from the action's own store call.
 *
 * `force-dynamic` for the reason every gated console route carries it: the session is per-request
 * and the page reads a row, so `pnpm build` must pass with `DATABASE_URL` and `NEON_AUTH_*` unset.
 */
import type { Metadata } from "next";

import { StageColumn } from "@/components/assessment-flow/stage-column";
import {
  DashboardSupportView,
  type SupportOutcome,
} from "@/components/support/dashboard-support-view";
import { contactStateOf } from "@/lib/contact/validation";
import { readOwnContactMessage } from "@/lib/contact/store";
import { dashboardSupportPageCopy } from "@/data/pages/dashboard-support";
import { requireRole } from "@/lib/auth/require-role";
import { DatabaseUnavailableError } from "@/lib/db/client";
import { DASHBOARD_SUPPORT_PATH } from "@/lib/flow/paths";
import { sendSupportMessage } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: dashboardSupportPageCopy.heading,
  robots: { index: false, follow: false },
};

type SupportParams = {
  readonly contact?: string | string[];
  readonly thread?: string | string[];
};

/** The first value of a search param — Next hands a repeated param back as an array. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DashboardSupportPage({
  searchParams,
}: {
  searchParams: Promise<SupportParams>;
}) {
  const { user } = await requireRole("member", { next: DASHBOARD_SUPPORT_PATH });
  const params = await searchParams;

  const state = contactStateOf(params.contact);
  const threadId = first(params.thread);

  let thread: SupportOutcome["thread"];
  if (state !== undefined && threadId !== undefined) {
    try {
      thread = await readOwnContactMessage(threadId, user.email);
    } catch (error) {
      // The action already stored the message; a read that cannot answer now is a confirmation
      // this render cannot draw, and the state's own sentence is what it draws instead.
      if (!(error instanceof DatabaseUnavailableError)) throw error;
      console.error("dashboard-support: the confirmation could not be read", error);
    }
  }

  const outcome: SupportOutcome | null = state === undefined ? null : { state, thread };

  return (
    <StageColumn>
      <DashboardSupportView
        copy={dashboardSupportPageCopy}
        name={user.name ?? user.email}
        email={user.email}
        startedAt={Date.now()}
        action={sendSupportMessage}
        outcome={outcome}
      />
    </StageColumn>
  );
}
