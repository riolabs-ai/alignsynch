# The transactional email lifecycle: two senders are the complete set

**Recommendation: ship no new email types. The two senders that exist — `invite` (creation and
re-invite) and `unlock` (the other party, once, when a submit completes the instance) — are the
whole lifecycle. Every other event in the product is in-app or nothing. The only new
email-shaped work anywhere is the re-invite send, and that is the invitation sender again, not a
third type.**

The rule, in one sentence: **email only (a) when the recipient cannot see the fact in the app
because they are not in it yet — the invitation — or (b) when the event's value expires unless
the person returns and the app cannot pull them back — the unlock notice.** Everything else
lands on a screen the person already opens. A relationship tool that emails more than these two
gets muted, and a muted tool delivers none of them.

---

## 1. What the spec asks for, and what exists

The website spec (p. 71 of the PDF, "WRITTEN ANALYSIS and GENERATED EMAIL TERMS") lists eleven
email artefacts. Two exist in the build (`lib/flow/email.ts`, senders `invite` and `unlock`).
Nine are dispositioned below — most were already dead on arrival because of the §4.1 freeze
ruling and §5 scope cuts (SPEC-DRIFT):

| spec email (p.71)                        | disposition (this spec)                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------- |
| Counterparty Invitations Email (Stage 3) | **built** — `sender: "invite"` (#146)                                                 |
| Counterparty Shared Email (Stage 5)      | **built** — `sender: "unlock"` (#258), to the other seat only                         |
| Initiator Registered Email               | Neon Auth's own verification mail; not the app's to build                             |
| Initiator Interest Email (weekly)        | rejected — §5: marketing/retention out of scope                                       |
| Counterparty Registered Email (both)     | rejected — see row "claimed" below (no action, in-app state)                          |
| Coach Invitation / Coach Registered      | rejected — §5: Coach is out of scope                                                  |
| Aspect Change Email                      | rejected — §4.1: no Changes/Approvals system                                          |
| Daily Opinion Change Email               | rejected — §4.1: opinions frozen at completion                                        |
| Weekly Relationship Emails               | rejected — §5: retention; §2 evidence (fatigue)                                       |
| Congratulations Email (Stage 6)          | rejected — the unlock notice _is_ the completion email                                |
| Analysis Email (Stage 5, gap values!)    | rejected — blind rule: a mailbox is not a party (and SPEC-DRIFT §7 already defers it) |

## 2. Every event, who receives it, which channel, why

| #   | event                                      | recipient    | channel                                       | why                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------ | ------------ | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Invitation issued                          | counterparty | **email** (+ in-app link on initiator screen) | recipient is not a user; no in-app surface exists for them; the link must reach a person                                                                                                                                                                                         |
| 2   | Invitation re-sent (re-invite)             | counterparty | **email** (sender `invite`)                   | same message type, new token — see flow-reinvite.md; initiator-only, capped/cooldowned                                                                                                                                                                                           |
| 3   | Invite mail outcome (sent/unset/failed)    | initiator    | **in-app**                                    | already built (`?invite=` notice); a send outcome is a fact about this session's action                                                                                                                                                                                          |
| 4   | Counterparty claimed                       | initiator    | **in-app only**                               | no action for the initiator (nothing unlocks on claim); the panel's `claimed` sentence and the status change (`awaiting_counterparty` → `answering`) already say it on their next visit. Spec's "To Initiator: your counterparty has registered" email is noise per relationship |
| 5   | Invite nearing expiry (warning)            | initiator    | **in-app only**                               | static sentence on the invite panel ("expires in N days", from the now-selected `expires_at`); a scheduled warning needs a scheduler and must be cancelled on claim — infrastructure for a fact the screen already shows                                                         |
| 6   | Invite expired                             | initiator    | **in-app only**                               | the panel's `expired` state + re-invite form (flow-reinvite.md); an email saying "your partner didn't respond" is shame-by-mail, and the action it would prompt (re-invite) lives on the same screen                                                                             |
| 7   | Pre-expiry reminder to recipient           | counterparty | **none**                                      | a day-3 nudge is the product nagging the initiator's intimate on their behalf without their consent — the mute reflex, automated; no scheduler exists; the initiator has the human channel. "Do nothing" beats "notify more" here                                                |
| 8   | Unlock: other party submitted; Gap is open | other party  | **email + in-app marker**                     | the one event whose value expires: the party who answered first may never return; the email reaches them once (#258), `party.unlock_seen_at` (#252) is the channel of record                                                                                                     |
| 9   | Congratulations / "now Aligned"            | both         | **none**                                      | the submitter is already looking at the report; the other party just got the unlock notice. A third message per completion is two extra emails per relationship                                                                                                                  |
| 10  | Analysis / written-report email            | both         | **none**                                      | would put scores and Gap values in a mailbox; the blind rule stops at no browser (`readUnlockFacts` reads no `opinion` row and the invitation carries nothing but the link); SPEC-DRIFT §7 defers it to v3-00-0                                                                  |
| 11  | Aspect / Opinion change notices            | —            | **none**                                      | §4.1 freeze: there are no changes to notify about                                                                                                                                                                                                                                |
| 12  | Registration / verification mails          | —            | **none (ours)**                               | Neon Auth owns identity and its own mail; the app builds no second auth flow                                                                                                                                                                                                     |
| 13  | Weekly retention / marketing               | —            | **none**                                      | §5 out of scope; §2 evidence: the fastest way to be muted                                                                                                                                                                                                                        |

**Recommended set: rows 1, 2, 8 (two senders, three call sites) plus rows 3, 4, 5, 6 as in-app
states. Rows 7, 9–13 are rejected, explicitly.**

## 3. Why the bias against volume is load-bearing

The evidence, and what each piece is used for here:

- **Unily Digital Noise Impact Report** (https://www.peoplemanagement.co.uk/article/1878015/three-quarters-employees-distracted-notifications-workplace-research-finds):
  77% of employees call digital-tool notifications a distraction; 66% turn off email or
  messaging notifications to focus. → In this product the counterparty is a consumer, not an
  employee, and the initiator is their partner, not their admin: every message competes with a
  real conversation. The bar is higher, not lower.
- **HelpLama via MagicBell** (https://www.magicbell.com/blog/help-your-users-avoid-notification-fatigue):
  64% of users delete an app receiving 5+ notifications a week; 61% stay if notifications match
  their preferences. → A relationship with invitation + claimed + warning + expired + unlock +
  congratulations emails is 4–6 messages for one relationship, most weeks, before the first
  report is read.
- **SuprSend, alert fatigue** (https://www.suprsend.com/post/alert-fatigue): 47% disable
  notifications entirely within the first week if unhelpful; 60% unsubscribe from irrelevant
  alerts; notification volume up 97% since 2020. → Default-off, not default-on, is the rational
  baseline for every type that is not carrying an action.
- **Microsoft WorkLab 2025** (via https://www.saner.ai/blogs/digital-overwhelm-statistics):
  117 emails/day per worker on average. → A relationship tool's mail competes with 117 others;
  the two senders here are chosen to survive that inbox.
- **DevOps Daily, "In-App, Email and Push From One Event"** (https://devops-daily.com/posts/in-app-email-and-push-from-one-event):
  in-app is exact and reversible; email is irreversible, at-least-once, and the provider talks
  back (bounces, complaints) — hard bounces and spam complaints must suppress the address. →
  Channel-selection principle: email for the two irreversible, action-bearing events; in-app for
  every state change; and (follow-up, not now) bounce suppression before volume grows.
- **925studios, notification system design** (https://www.925studios.co/blog/notification-system-design):
  "In-app is the safest place for information that matters but doesn't justify interruption." →
  That is exactly the claimed/expired/warning set.
- **dev.to/lunealabs, team invite email template** (https://dev.to/lunealabs/team-invite-email-template-what-to-include-and-how-to-send-it-96e):
  recommends one day-3 reminder, cancelled on accept — the closest thing to evidence for
  reminders, and it is written for workspace admins onboarding strangers. An intimate is not a
  stranger: the reminder channel is the initiator's own words, not a product cron. Rejected
  accordingly.

## 4. Rejected alternatives (summary)

- **Claimed/registered notice to the initiator by email** (spec rows "Counterparty Registered,
  To Initiator"): no action is triggered by a claim; the screen state change is the delivery.
- **Expiry warning / expired notice by email**: needs a scheduler; duplicates a fact the
  initiator's screen will show permanently (post flow-reinvite.md); "your partner ignored you"
  is the message a relationship tool must never send by mail.
- **Pre-expiry reminder to the recipient**: the product nagging the initiator's partner on the
  initiator's behalf — automated pressure in a tool whose premise is voluntary mutual answers.
  No scheduler exists in this codebase (the unlock notice rides the submit transaction, which is
  the pattern to keep: **every send is triggered by a write in a request, never by a clock**).
- **Congratulations email**: completion already produces exactly one message to the person who
  needs it; a second to each is ceremony, not function.
- **Analysis/report email**: violates the blind rule's send-path reading (a mailbox is not a
  party); deferred by SPEC-DRIFT §7 anyway.
- **Change-notification emails**: moot under the §4.1 freeze; no Changes system exists.
- **Marketing/retention/weekly**: §5 out of scope, and contradicted by every fatigue number
  above.

## 5. Sources

- Unily Digital Noise Impact Report — https://www.peoplemanagement.co.uk/article/1878015/three-quarters-employees-distracted-notifications-workplace-research-finds
- MagicBell — https://www.magicbell.com/blog/help-your-users-avoid-notification-fatigue
- SuprSend, alert fatigue — https://www.suprsend.com/post/alert-fatigue
- Microsoft WorkLab 2025 (via saner.ai aggregation) — https://www.saner.ai/blogs/digital-overwhelm-statistics
- DevOps Daily, in-app vs email guarantees — https://devops-daily.com/posts/in-app-email-and-push-from-one-event
- 925studios, notification system design — https://www.925studios.co/blog/notification-system-design
- dev.to/lunealabs, team invite email template — https://dev.to/lunealabs/team-invite-email-template-what-to-include-and-how-to-send-it-96e
- Spec PDF in-repo: `docs/AlignSynch.com - Website Specs.pdf`, "WRITTEN ANALYSIS and GENERATED
  EMAIL TERMS" (p. 71) — the eleven-artefact list dispositioned above.
- In-repo: `lib/flow/email.ts` (the two senders, `sent|unset|failed`, no retry, no queue),
  `lib/flow/unlock-notice.ts` (#258), `db/migrations/0007_party_unlock_seen.sql` (#252),
  `docs/SPEC-DRIFT.md` §4.1/§5/§7.

## 6. Implementation sketch (what a card would touch)

- **No new migration, no new sender.** `MailSender` in `lib/flow/email.ts` stays
  `"invite" | "unlock"`; the re-invite route (flow-reinvite.md) calls `sendInvitation` as-is.
- **Initiator-side states (the real work):** `readInstanceBundle` selects `expires_at,
  resent_at, resent_count` (flow-reinvite.md §6); the invite panel draws pending/expired/claimed;
  copy items added to `data/pages/assessment-instance.ts` (E23). No email call sites are added.
- **Unlock path unchanged:** `sendUnlockNotice` remains the only post-submit send, triggered by
  the `ok && complete` transition, other-seat-only via `otherRoleOf`, no-opinion read via
  `readUnlockFacts`.
- **Docs:** `docs/TWO-PARTY-FLOW.md` "Email" section gains the channel table above;
  `docs/SPEC-DRIFT.md` §7's "~10 spec email types" entry is replaced with this disposition (the
  rejection record).
- **Explicitly out of scope, named so they stop reappearing:** bounce webhooks and address
  suppression, delivery tracking, a scheduler/queue, per-event opt-outs, and marketing mail.
  When (not if) invitation volume grows, the first piece is Resend bounce/complaint suppression,
  not more types.

## 7. Acceptance criteria

1. `MailSender` remains exactly `"invite" | "unlock"` — a third sender value anywhere in
   `lib/flow/email.ts` or a caller fails this criterion (grep-verifiable).
2. The only code paths that call `sendMail`/`sendInvitation` are: instance creation, re-invite
   (same sender), and `sendUnlockNotice`; the claimed/expired/warning state changes perform no
   fetch and no send (asserted by the flow-resend store tests that their paths touch no
   transport).
3. Every message the app composes is built from fixture copy with a fixed placeholder set
   (`invitation-email` band: `{initiator} {counterparty} {template} {link}`; `unlock-email`
   band: `{recipient} {other} {template} {link}`) — any `{score}` or `{gap}` placeholder renders
   literally, so no message can leak; and the unlock read (`readUnlockFacts`) selects no
   `opinion` row.
4. On the completing submit, exactly one unlock notice goes to the other seat and never to the
   submitter (`otherRoleOf` is total over the two roles), and a failed send never fails the
   committed submit (existing #258 behavior, existing tests green).
5. The initiator learns "claimed", "expires in N days" and "expired" from the instance screen's
   invite panel and the list states — with zero emails sent for any of them.
6. No scheduler, queue or cron is introduced; every send remains triggered by a request's write
   (creation, resend, completing submit), and no pre-expiry reminder exists for the recipient.
7. The spec's Analysis, Congratulations, Change, Daily, Weekly, Interest, Coach and
   Counterparty-Registered emails remain absent, and `docs/SPEC-DRIFT.md` + `docs/TWO-PARTY-FLOW.md`
   record that disposition (rejection is a document, not a hope).
8. Gate stays green and dependency-free: `bash scripts/verify.sh` passes with no new package and
   no database access; `pnpm data:check` still validates the new copy items (E23/E10).
