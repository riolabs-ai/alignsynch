/**
 * template-ancestor: components/assessment-flow/accept-session.tsx   (variation: the same single-outcome shape — a status sentence over a next-step list — for a screen whose outcome is already committed; what a decision screen draws as two seats, this one draws as the invitation's own timeline)
 *
 * `SentState` — stage 5, **Connect** (#691, named by #735).
 *
 * The screen `POST /assessment/new` lands on. The relationship exists and the invitation has gone
 * out; what is left to draw is *what happens next*, *who was invited*, *where the invitation
 * stands*, and the door into the relationship itself.
 *
 * **The status sentence is derived, never a badge.** `screen.invite.state` is
 * `inviteStateOf()`'s answer over the row's `claimed_at` / `expires_at` / `revoked_at` and the
 * instant the read carried (#266), so `unclaimed`, `expired`, `claimed` and `revoked` each get
 * their own sentence and the screen never says "waiting" about an invitation that has died. The
 * `status` band has exactly those four items, the absent-row sentence `none` (#976 — a relationship
 * whose invitation was never written) and the address, and `readFlowScreen()` withholds
 * `invite.link` in every state but `unclaimed` — the screen cannot offer a link the claim path
 * would refuse.
 *
 * **A state this build has no sentence for renders, it does not 500 (#998).** The state is a value
 * the read produced, so its id is not a literal `data:check` can resolve against the fixture: the
 * next status `inviteStateOf()` grows would meet `itemOf`'s throw inside a server render, at
 * request time, while every gate stayed green. The lookups keyed on a runtime value therefore go
 * through `itemLabelOr`, and the band carries one neutral fallback row (`unknown`) for a status it
 * does not describe — the timeline and the next-step list still draw. The two `?query=` keys
 * (`resendRefusal`, `inviteNotice`) are runtime values of the same kind and read the same way: a
 * code the band does not carry draws no sentence at all, which is what the route's own filter
 * already does for a value it does not know.
 *
 * **The timeline is the variation.** A decision screen (`accept-session.tsx`) draws two seats
 * because the question is "who is in"; this one draws the invitation's three moments, because the
 * question is "where is the link". Each moment's wording is chosen by the fact that decided it —
 * `waiting` / `waiting-expired` / `waiting-revoked` — so an expired invitation reads as a date
 * rather than as silence, and the marks (`data-state`) are the same `done` / `current` / `todo`
 * vocabulary the rail above it uses.
 *
 * **Resend is the shipped mechanism, not a second one.** `ReinviteForm` posts to
 * `reinvitePath()` — the same `POST /assessment/instances/[id]/invite` the relationship screen
 * uses, with the same cooldown, the same lifetime cap and the same refusals — and it is drawn only
 * where the store would accept the write (Initiator, invitation not yet claimed), because a
 * control that is certain to be refused teaches nothing. `returnTo` is the one addition: the form
 * carries a hidden field so the endpoint's 303 comes back to *this* screen instead of dropping the
 * person onto stage 6 mid-action.
 *
 * **Signed out is behind them, not in front.** The person reached this screen by committing a
 * relationship, which needs no account (#659). Nothing here asks for one: the `go` band's
 * `browser-note` is drawn instead, and it says plainly where the relationship lives until they
 * sign in. There is no redirect and no disabled control.
 *
 * Literal-free: every word is `data/pages/assessment-sent.ts` — which *references* the shared
 * `invite` band and the six stage names rather than copying them — except the model's own
 * `formatDate()` over the ISO instants the read handed down.
 */
import Link from "next/link";
import { formatDate } from "@/content/core";
import type { PageCopy, PageCopySection } from "@/content/pages";
import type { FlowScreen } from "@/lib/flow/screen";
import { SENT_RETURN_VALUE } from "@/lib/flow/paths";
import { fillLabel, itemLabel, itemLabelOr, sectionBody, sectionOf } from "@/lib/page-copy";
import { InviteLink } from "./invite-link";
import { ReinviteForm } from "./reinvite-form";
import { StageColumn } from "./stage-column";
import { StageRail } from "./stage-rail";

/** The three moments the timeline draws, in order. */
const TIMELINE_MOMENTS = ["sent", "waiting", "accepted"] as const;

/** The one `?invite=` value that means the email carried the link (#220). */
const INVITE_SENT_NOTICE = "sent";

/** The `?invite=` values the create redirect writes, or `undefined` for anything else. */
export function sentNoticeOf(value: string | undefined): "sent" | "unset" | "failed" | undefined {
  if (value === "sent" || value === "unset" || value === "failed") return value;
  return undefined;
}

export function SentState({
  copy,
  screen,
  inviteNotice,
  resendRefusal,
  resendAction,
  openHref,
  signedIn,
}: {
  copy: PageCopy;
  screen: FlowScreen;
  /** `?invite=sent|unset|failed` — the create's own outcome, one visit's sentence. */
  inviteNotice?: "sent" | "unset" | "failed";
  /** `?resend=<code>` — the re-invite endpoint's refusal, carried through its 303. */
  resendRefusal?: string;
  /** The instance's re-invite endpoint (`reinvitePath()`). */
  resendAction: string;
  /** The relationship itself — stage 6, `Align`, one click away. */
  openHref: string;
  /** Whether this request carries a session, which decides which `go` note is drawn. */
  signedIn: boolean;
}) {
  const status = sectionOf(copy, "status");
  const timeline = sectionOf(copy, "timeline");
  const next = sectionOf(copy, "next");
  const go = sectionOf(copy, "go");
  const inviteBand = sectionOf(copy, "invite");

  const invite = screen.invite;
  const counterparty = invite?.counterpartyName ?? screen.counterpartyName ?? "";
  // The Initiator is the only seat the store lets re-invite, and `claimed` is terminal: the seat is
  // taken, so the panel says so and offers nothing. The store is the authority; this only decides
  // what is drawn, exactly as the instance screen's panel does.
  const canReinvite =
    invite !== null && invite.state !== "claimed" && screen.viewer.role === "initiator";

  const values = { counterparty, email: invite?.email ?? "" };

  /**
   * The one state sentence. A screen with no invitation row at all says so rather than borrowing
   * `unclaimed` — "the link has not been claimed" and "there is no link" are different facts.
   *
   * The lookup is the optional reader, not `itemLabel` (#998): `stateId` is a value the read
   * produced, so a status this build has no sentence for renders the band's fallback row instead
   * of throwing inside a server render. That fallback id is spelled as a literal so E23 resolves it
   * against this route's fixture at build time — deleting the row is a red `data:check`, never the
   * throw the row exists to prevent.
   */
  const stateId = invite === null ? "none" : invite.state;
  const stateRow = itemLabelOr(status, stateId);
  const stateSentence = fillLabel(stateRow ?? itemLabel(status, "unknown"), values);

  /** A band row named by a runtime value, filled when the band carries it and absent when it does not. */
  const filledRuntimeRow = (section: PageCopySection, id: string): string | undefined => {
    const label = itemLabelOr(section, id);
    return label === undefined ? undefined : fillLabel(label, values);
  };

  // `?resend=` and `?invite=` are runtime values too: the page narrows them to this build's
  // vocabulary, and a code the band does not carry draws no sentence rather than a 500 (#998).
  const resendSentence =
    resendRefusal === undefined ? undefined : filledRuntimeRow(inviteBand, resendRefusal);

  const noticeSentence =
    inviteNotice === undefined ? undefined : filledRuntimeRow(inviteBand, inviteNotice);

  /**
   * One moment's wording and mark. The three cases are read off the invitation's own state:
   *
   *   sent       always done, dated when the row carries `created_at` (it always does in
   *              production; the fallback is for a projection written before the field existed).
   *   waiting    the live question — unclaimed, expired or withdrawn — or `claimed` once the seat
   *              is filled, which is the same moment read after the fact.
   *   accepted   done only when the seat is filled: an invitation is the acceptance.
   */
  function momentOf(moment: (typeof TIMELINE_MOMENTS)[number]): {
    readonly sentence: string;
    readonly state: "done" | "current" | "todo";
  } {
    const sentAt = invite?.sentAt;
    const claimedAt = invite?.claimedAt ?? null;

    if (moment === "sent") {
      return {
        sentence:
          sentAt === undefined
            ? itemLabel(timeline, "sent-undated")
            : fillLabel(itemLabel(timeline, "sent"), { date: formatDate(sentAt) }),
        state: "done",
      };
    }

    if (moment === "waiting") {
      if (invite === null)
        return { sentence: itemLabel(timeline, "waiting-pending"), state: "todo" };
      switch (invite.state) {
        case "claimed":
          return {
            sentence: fillLabel(itemLabel(timeline, "waiting-claimed"), values),
            state: "done",
          };
        case "expired":
          return {
            sentence: fillLabel(itemLabel(timeline, "waiting-expired"), {
              date: formatDate(invite.expiresAt),
            }),
            state: "current",
          };
        case "revoked":
          return { sentence: itemLabel(timeline, "waiting-revoked"), state: "current" };
        case "unclaimed":
          return {
            sentence: fillLabel(itemLabel(timeline, "waiting"), {
              counterparty,
              date: formatDate(invite.expiresAt),
            }),
            state: "current",
          };
      }
    }

    return claimedAt === null
      ? { sentence: itemLabel(timeline, "accepted-pending"), state: "todo" }
      : {
          sentence: fillLabel(itemLabel(timeline, "accepted"), { date: formatDate(claimedAt) }),
          state: "done",
        };
  }

  return (
    <StageColumn>
      <div className="space-y-6">
        {/*
          Where the person is in the five stages: the relationship exists and its invitation is
          out, so this is stage 5 — **Invite**, the stage whose act produced this confirmation.
          The confirmation is unnumbered in the *count* — it is not a sixth stage — but it is
          still inside the sheet, so it draws the same band the artifact draws around it.
        */}
        <StageRail copy={copy} current={5} />

        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            {copy.heading}
          </h1>
          {copy.subtitle === undefined ? null : (
            <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-300">
              {fillLabel(copy.subtitle, values)}
            </p>
          )}
        </div>

        {/* The outcome, as one sentence over one fact: the state the row derives. */}
        <section
          data-sent-status={stateId}
          data-sent-status-fallback={stateRow === undefined ? "" : undefined}
          className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
        >
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{stateSentence}</p>
          {invite === null ? null : (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {fillLabel(itemLabel(status, "email"), values)}
            </p>
          )}
          {noticeSentence === undefined ? null : (
            <p className="mt-2 text-xs text-gray-600 dark:text-gray-300" data-sent-notice>
              {noticeSentence}
            </p>
          )}
          {resendSentence === undefined ? null : (
            <p
              className="mt-2 text-xs font-medium text-gray-700 dark:text-gray-200"
              data-sent-refusal
            >
              {resendSentence}
            </p>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-7">
            {/* The invitation's own history — the variation this screen was carded for. */}
            {invite === null ? null : (
              <section
                aria-labelledby="sent-timeline-heading"
                className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
              >
                <h2
                  id="sent-timeline-heading"
                  className="text-lg font-semibold text-gray-900 dark:text-gray-100"
                >
                  {timeline.heading}
                </h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  {sectionBody(timeline)}
                </p>
                <ol
                  aria-label={itemLabel(timeline, "label")}
                  className="mt-3 space-y-2"
                  data-sent-timeline={invite.state}
                >
                  {TIMELINE_MOMENTS.map((moment) => {
                    const { sentence, state } = momentOf(moment);
                    return (
                      <li
                        key={moment}
                        data-moment={moment}
                        data-state={state}
                        aria-current={state === "current" ? "true" : undefined}
                        className="flex items-start gap-3"
                      >
                        <span
                          aria-hidden="true"
                          className={
                            state === "done"
                              ? "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-action text-[10px] font-semibold text-action-foreground"
                              : state === "current"
                                ? "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-action text-[10px] font-semibold text-action"
                                : "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gray-300 text-[10px] font-semibold text-gray-500 dark:border-gray-600 dark:text-gray-400"
                          }
                        >
                          {state === "done" ? "✓" : TIMELINE_MOMENTS.indexOf(moment) + 1}
                        </span>
                        <span
                          className={
                            state === "todo"
                              ? "text-sm text-gray-500 dark:text-gray-400"
                              : "text-sm text-gray-800 dark:text-gray-200"
                          }
                        >
                          {sentence}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}

            <section
              aria-labelledby="sent-next-heading"
              className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
            >
              <h2
                id="sent-next-heading"
                className="text-lg font-semibold text-gray-900 dark:text-gray-100"
              >
                {next.heading}
              </h2>
              <ol className="mt-3 space-y-2">
                {["1", "2", "3"].map((id) => (
                  <li key={id} className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gray-300 text-[10px] font-semibold text-gray-600 dark:border-gray-600 dark:text-gray-300"
                    >
                      {id}
                    </span>
                    <span className="text-sm text-gray-700 dark:text-gray-200">
                      {fillLabel(itemLabel(next, id), { count: screen.aspects.length })}
                    </span>
                  </li>
                ))}
              </ol>

              {/* The link the email carried, when the browser holds it: still the one way in
                  while no message arrived (#220), and never drawn once the invitation is spent. */}
              {invite?.link == null ? null : (
                <div className="mt-4 border-t border-gray-200 pt-3 dark:border-gray-700">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    {fillLabel(itemLabel(inviteBand, "link-label"), values)}
                  </p>
                  <div className="mt-1">
                    <InviteLink
                      link={invite.link}
                      copy={inviteBand}
                      counterpartyName={counterparty}
                    />
                  </div>
                </div>
              )}

              {/* Resend: the shipped form, and only where the store would accept it. */}
              {!canReinvite || invite === null ? null : (
                <ReinviteForm
                  copy={copy}
                  action={resendAction}
                  email={invite.email}
                  counterpartyName={counterparty}
                  returnTo={SENT_RETURN_VALUE}
                />
              )}
            </section>
          </div>

          {/* The door into stage 6 — the reason this screen exists rather than a receipt. */}
          <aside className="lg:col-span-5">
            <section
              aria-labelledby="sent-go-heading"
              className="rounded-lg border border-action bg-white p-4 dark:bg-gray-900"
            >
              <h2
                id="sent-go-heading"
                className="text-lg font-semibold text-gray-900 dark:text-gray-100"
              >
                {go.heading}
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{sectionBody(go)}</p>
              <Link
                href={openHref}
                className="mt-3 flex min-h-[44px] items-center justify-center rounded-md bg-action px-4 text-sm font-semibold text-action-foreground hover:bg-action-hover"
              >
                {itemLabel(go, "open")}
              </Link>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {signedIn ? itemLabel(go, "note") : itemLabel(go, "browser-note")}
              </p>
            </section>
          </aside>
        </div>
      </div>
    </StageColumn>
  );
}
