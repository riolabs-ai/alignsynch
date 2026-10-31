# Expired-invitation recovery: re-invite (revoke-and-replace), no void

**Recommendation: one action — "Send a new invitation" (re-invite) — which mints a new token,
overwrites the invitation row's `token_hash`/`expires_at`/`email`, and thereby kills the old link.
Available to the initiator whenever the invite is unclaimed (expired or not), with a 24 h cooldown
and a lifetime cap of 3 resends per instance. Void is deliberately not built: the re-invite action
already covers its only security motivation, and a void-without-replace strands the instance in an
unprogressable state. The initiator's screen finally learns expiry (SPEC-DRIFT §6 quick win 2 is
closed by the same change).**

---

## 1. The dead end, verified

- `db/migrations/0002_two_party_flow.sql`: `instance_invite` = one row per instance
  (`instance_record_id` PK), `token_hash UNIQUE NOT NULL`, `created_at`, `expires_at` (+7 days,
  `INVITE_TTL_MS` in `lib/flow/tokens.ts`), `claimed_at`.
- `lib/flow/store.ts` `claimInvite` enforces expiry (`expired` refusal) and has six named refusals
  (`lib/flow/claim.ts`).
- The recipient's expired page is honest (`data/pages/invite.ts` "expired" band: "Invitations last
  seven days. Ask {initiator} to start a new instance with you.").
- The initiator never learns expiry: `readInstanceBundle` selects `email, counterparty_name,
  claimed_at` and **omits `expires_at`** — SPEC-DRIFT §6 quick win 2.
- No re-invite, no void, no email correction, no reminder. `data/pages/assessment-instance.ts`
  invite band has only `sent|unset|failed|link-label|copy|claimed|unclaimed` sentences.

## 2. The obvious approaches, argued against

**A. Extend the expiry in place (same token, new `expires_at`).** Slack's "Extend invitation".
Zero UI cost, but fixes none of the real failure modes: a lost email still points at a mailbox the
recipient never reads; a typo'd address still receives nothing; and nothing new is delivered, so
the recipient has no reason to look again. The old link staying live after the initiator's action
also means the initiator can silently keep a link alive forever — the nag case, with no delivery.

**B. Re-send the same token (regenerate the email only).** Must also extend expiry (else the
resent link is instantly expired), so it degenerates into A plus an email. Keeps "one token per
relationship" but cannot fix a wrong address without also changing the token semantics.

**C. Mint a new token, invalidate the old (revoke-and-replace).** The industry default for
link-based invitations (see sources). One action covers all three failure modes uniformly —
expiry, lost email, typo'd address — and the old link dies at the moment of the action, which is
the property that makes abuse and leakage self-limiting.

**D. Void as a separate action, three flavours, all rejected.**
- _Void-then-nothing:_ leaves the instance in `awaiting_counterparty` forever, in the initiator's
  list, unprogressable — a worse dead end than the expiry it was meant to fix. The only honest
  terminal state for a relationship is "the invite is dead and a new one was issued" (that is C)
  or "the instance is gone" (no delete exists anywhere in the product; out of scope).
- _Void = delete the instance:_ the product has no delete/abandon path at all; inventing one for
  invitations alone creates the asymmetry the repo's comments refuse (an instance is one
  relationship's private copy; deletion semantics need their own decision).
- _Void = re-invite to a discarded token:_ hacky, indistinguishable from C in storage, and the
  initiator who wants the relationship dead can simply stop — the invite self-destructs in ≤ 7
  days, which is the built-in void.
  Security motivation of void (a mistyped address holding a working link for a week) is fully
  covered by C: correcting the address mints a new token and kills the one the wrong address
  holds.

**E. Invite history rows (append-only `instance_invite` generations).** Would let the old link
answer "superseded" instead of "unknown", but requires changing the PK (`instance_record_id`),
every read (`readInstanceBundle`, `previewInvite`, `readUnlockFacts` all assume at most one row),
and adds a history table nobody reads. The honest-enough answer for a dead link is the existing
`unknown` band ("This link does not name an invitation"), which is what MirrorWeb ships for
expired links and what Claude's "the link no longer works" accomplishes. Rejected: complexity for
a sentence.

## 3. The recommended model

**States of an invitation** (derived from the one row, plus two new columns):

| state      | how it is known                                                                        |
| ---------- | -------------------------------------------------------------------------------------- |
| pending    | `claimed_at IS NULL AND expires_at > now` — link live, claimable                       |
| expired    | `claimed_at IS NULL AND expires_at <= now` — recipient page says so, initiator now too |
| claimed    | `claimed_at` set — terminal, both screens say so                                       |
| superseded | the old link simply no longer resolves (`unknown` band) — no stored state needed       |

**What the initiator can do** (only while the invite is unclaimed and the counterparty seat is
empty — the claim's `already-bound` rule is the same gate here):

- **Send a new invitation** (re-invite), optionally with a corrected address. Pre-filled with the
  current `email`. Available on `pending` (lost email, typo) _and_ `expired` (the dead end).
- That is the whole action set. No void, no extend, no delete.

**What happens to the old token:** the row's `token_hash` is overwritten in the same transaction
that writes the new one. The old link immediately resolves to `unknown` via the existing path
(`previewInvite` finds no row for that hash) — the recipient gets the existing "No such
invitation" band, which is the truth: it no longer names an invitation. Exactly one live token
per relationship is structural, not a policy: the PK (`instance_record_id`) allows one row, and
the UPDATE replaces the row's only token. `claimed_at` stays NULL (the invite is still
unclaimed); `expires_at = now + 7 days` (`inviteExpiry()`); `created_at` is untouched (it is the
instance's fact), and `resent_at = now` records the reissue.

**The abuse case — re-invite as a nag button.** The initiator can push this into someone's inbox
repeatedly, and an emotionally motivated initiator will. Guards, all enforced in the store's
single transaction, none in the UI:

- **24 h cooldown** per instance: a second resend within `RESEND_COOLDOWN_MS` is refused with a
  named code. (Leantime's resend cooldown is 240 s — right for workspace admins onboarding many
  people, wrong for a relationship product where every send is to an intimate and the nag
  cadence is daily.)
- **Lifetime cap of 3 resends** per instance (`resent_count`), after which the refusal's copy
  points at creating a new instance — the action that already exists and is honest. A cap is
  needed because a cooldown alone still allows an unbounded drip campaign, and a 3-send budget
  covers every legitimate story (typo, lost email, expiry, one more attempt).
- Both refusals render as sentences on the instance screen (E23 copy), never a silent no-op —
  the repo's standing rule for refusals, and the AppMaster guidance: name the limit and say what
  to do next.
- The recipient-side page is unchanged and never mails the initiator, so no "reply pressure"
  exists on the recipient's channel.

**Named refusals** for `resendInvite` (mirroring `ClaimRefusal`): `not-initiator` (viewer is the
counterparty or nobody — role resolved from cookie/session exactly as `readFlowScreen` does),
`invite-claimed` (`claimed_at` set, or a counterparty party row exists), `cooldown`,
`cap-reached`, `invalid-email`. Only success writes.

**What the initiator's screen learns** (closes SPEC-DRIFT §6 QW2): `readInstanceBundle` selects
`expires_at` (and `resent_at`, `resent_count`), so the invite panel draws three states —
pending-with-link, expired-with-re-invite-form, claimed — instead of the current
`unclaimed|claimed` pair. The `FlowInvite` projection gains the expiry fact; nothing about the
blind rule moves (invite facts carry no opinion).

**Email on re-send:** the existing invitation sender, `sender: "invite"`, is reused — a re-invite
_is_ an invitation, and the `sent|unset|failed` outcome vocabulary and the redirect notice
(`?invite=`) already render on the instance screen. No new mail type (see flow-emails.md).

## 4. Rejected alternatives (summary)

- Extend-expiry-in-place (A): fixes nothing real; keeps a stale link alive.
- Re-send-same-token (B): degenerate A; cannot fix a wrong address.
- Void as a separate action (D): all three flavours strand the instance, duplicate re-invite, or
  invent deletion semantics the product doesn't have.
- Append-only invite history (E): PK change + a table nobody reads, for one sentence.
- Automatic re-invite / auto-reminders: a scheduled nag on the initiator's behalf — rejected in
  flow-emails.md (no scheduler in this product, and the mute reflex).
- Per-account/IP global rate limiting: real gap (the create path has none today either), but it
  is a product-wide anti-abuse infrastructure decision, not part of the smallest complete model;
  noted as follow-up, not silently omitted.

## 5. Sources

- Slack, "Manage pending invitations and invite links"
  (https://slack.com/help/articles/360060363633): invitations expire (30 days); admins **Extend**,
  **Resend** or **Delete**; invite links can be **deactivated** (immediate invalidation) or
  **renewed**. Shows the extend/resend/revoke triad and immediate invalidation on revocation.
- Claude (Anthropic), org invite links (https://support.claude.com/en/articles/13776697):
  **Regenerate** "creates a new link and immediately invalidates the previous one"; **Disable**
  invalidates without replacing; email invites expire in 21 days and are resent from a Pending
  tab. The canonical revoke-and-replace contract.
- MirrorWeb (https://help.mirrorweb.com/en/articles/15204535): "Resending an invitation cancels
  the old link and issues a fresh one with a new 7-day window" — used for both expiry and
  lost-email; expired links show a generic error page. Exactly the single-action design adopted
  here.
- Ramp (https://support.ramp.com/inviting-users-to-ramp): **Resend resets the expiration timer**;
  "the invitee should use the link from the most recent invite email"; for a bounced address:
  "correct the email address, revoke the old invite, and send a new one". Typo-correction via
  revoke + new send, same as this recommendation.
- GitHub orgs (https://docs.github.com/en/organizations/managing-membership-in-your-organization/inviting-users-to-join-your-organization):
  invitations expire after 7 days; **Retry** or **Cancel** expired invitations from a "Failed
  invitations" view; invitations can be edited/cancelled any time before acceptance.
- Discord (https://support.discord.com/hc/en-us/articles/208866998): invite links carry expiry
  and max-uses; removed invites cannot be remade with the same code — revocation is terminal.
- dev.to/lunealabs, "Team invite email template"
  (https://dev.to/lunealabs/team-invite-email-template-what-to-include-and-how-to-send-it-96e):
  "Resend: create a new token and a new expiry, and invalidate the old link. Then a resent invite
  is never already expired"; "a mistyped address should not hold a working link for a week"
  (the void motivation, satisfied by revoke-and-replace).
- Leantime PR #3661 (https://github.com/Leantime/leantime/pull/3661): invite-email spam fixed by
  rate limits enforced inside create **and** resend — per-user/hour, per-installation/day, plus a
  per-invite resend cooldown with a distinct "too soon" code. Evidence that resend is the
  spam vector and that limit-refusal copy must name the limit.
- AppMaster, "Transactional email flows that work"
  (https://appmaster.io/blog/transactional-email-flows-tokens-expiration-deliverability): "A
  resend button turns into a way to spam your system"; guardrails (cooldowns, daily caps per
  address and per user); "when a limit triggers, tell the user exactly what happened and what to
  do next… rather than silently disabling the button."

## 6. Implementation sketch (real files)

- **`db/migrations/0009_invite_resend.sql`** (plain SQL, idempotent, no `gap` column):

  ```sql
  ALTER TABLE instance_invite ADD COLUMN IF NOT EXISTS resent_at TIMESTAMPTZ NULL;
  ALTER TABLE instance_invite ADD COLUMN IF NOT EXISTS resent_count INT NOT NULL DEFAULT 0;
  ALTER TABLE instance_invite DROP CONSTRAINT IF EXISTS invite_resent_after_creation;
  ALTER TABLE instance_invite ADD CONSTRAINT invite_resent_after_creation
    CHECK (resent_at IS NULL OR resent_at >= created_at);
  ```

  `resent_at` = when the live token was (re)issued; `resent_count` = lifetime resends (the cap's
  only stored fact — a fact no existing row carries, so it passes the schema's own bar).
- **`lib/flow/tokens.ts`**: `export const RESEND_COOLDOWN_MS = 24*60*60*1000;` and
  `export const RESEND_LIFETIME_CAP = 3;` beside `INVITE_TTL_MS`. Reuses `mintToken`,
  `hashToken`, `inviteExpiry`.
- **`lib/flow/store.ts`**:
  - `resendInvite(input: { instanceRecordId; email?: string; viewerTokens?; viewerUserId?; now? })`
    → `{ ok: true; inviteToken: string; email: string } | { ok: false; code: ResendRefusal; reason }`.
    One transaction: resolve viewer role (reuse the `partyRoleForTokens`/`partyRoleForUser`
    pattern), `SELECT … FOR UPDATE` on `instance_invite`, check claimed/counterparty/cooldown/cap/
    email shape, then `UPDATE instance_invite SET token_hash=$1, email=$2, expires_at=$3,
    resent_at=$4, resent_count = resent_count + 1 WHERE instance_record_id=$5` (token never
    stored raw — hash only, per `lib/flow/tokens.ts`).
  - `readInstanceBundle`: add `expires_at, resent_at, resent_count` to the invite select; the
    projected `invite` gains `expiresAt` (and the screen derives pending/expired/claimed).
- **New route `app/(mainlayout)/assessment/instances/[instanceId]/invite/route.ts`** (POST,
  plain form, mirrors `assessment/new/route.ts`): resolves the initiator from cookie/session,
  calls `resendInvite`, then reuses `sendInvitation(invitationMessage({ to: newEmail, …,
  token: newToken }))`; redirects 303 back to the instance screen with the same
  `?invite=sent|unset|failed` notice the creation uses — no new outcome vocabulary.
- **`lib/flow/screen.ts` + `components/assessment-flow/instance-view.tsx`**: `FlowInvite` gains
  `expiresAt`; the panel's `data-invite-state` becomes `pending|expired|claimed`, the expired
  state renders the re-invite form (address pre-filled, gated on `viewer.role === "initiator"`),
  and the `cooldown`/`cap-reached` refusals render as sentences from the new copy items.
- **`data/pages/assessment-instance.ts`**: new items in the `invite` band —
  `expired` ("This invitation expired…"), `resend-label`, `resend-submit`, `resend-email`,
  `resend-sent`, `resend-cooldown`, `resend-cap` — all E23 (`fillLabel`/`itemLabel`), no literals
  in the component. **`data/pages/invite.ts`**: the `expired` band body becomes "…Ask
  {initiator} to send it again." (re-invite now exists, so the copy stops directing people to a
  new instance).
- **Tests**: `tests/flow-resend.test.ts` — pure rules (refusal code mapping, cooldown/cap
  arithmetic) plus the store path against a stubbed pool, mirroring
  `tests/flow-store-identity.test.ts`; `scripts/flow-e2e.mjs` gains a leg: create → pin clock →
  expire → old link `unknown` → resend → new link claims once → second resend refused
  (`cooldown`) → `db:verify` stays green.

## 7. Acceptance criteria

1. The initiator's invite panel renders three states — pending, expired, claimed — and the
   expired state shows the re-invite form; `readInstanceBundle` selects `expires_at` (SPEC-DRIFT
   §6 QW2 closed).
2. `resendInvite` overwrites `token_hash`, sets `expires_at = now + 7 days`, writes `resent_at`
   and increments `resent_count`; afterwards the old link previews as `unknown` and the new
   token claims exactly once (all six existing claim refusals unchanged).
3. At most one live token per relationship at every instant — structurally: the UPDATE replaces
   the one row the PK allows and the UNIQUE `token_hash` holds (no code path can produce two
   live links).
4. A resend that posts a different `email` updates the row and sends to the new address, with
   the `sent|unset|failed` outcome rendered by the existing notice; a failed send never fails
   the resend write and never throws.
5. A second resend within 24 h returns the named refusal `cooldown`; a resend with
   `resent_count >= 3` returns `cap-reached` whose copy directs to creating a new instance; both
   render as sentences, never silently.
6. Only the initiator's session can resend (counterparty/nobody → `not-initiator`), and resend
   is refused once `claimed_at` is set or a counterparty party row exists (`invite-claimed`).
7. `0009_invite_resend.sql` applies idempotently via `pnpm db:migrate`, adds no `gap` column or
   table, and `pnpm db:verify` passes; the gate (`bash scripts/verify.sh`) stays database-free
   and green.
8. `scripts/flow-e2e.mjs` proves end-to-end: create → expire → old link dead → resend → old link
   unknown → new link claims → resend refused.
