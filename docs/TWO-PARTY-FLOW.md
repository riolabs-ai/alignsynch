# The two-party flow (#146)

The first version two people use: an Initiator creates an Instance from a published Template,
invites the Counterparty, both answer Feel and Wish on every Aspect, and the Gap unlocks for both
at the instant both have submitted.

`AGENTS.md` documents the database layer and the gate; this page documents only what #146 added.

## The routes

| Route                                        | Method | What it does                                                              |
| -------------------------------------------- | ------ | ------------------------------------------------------------------------- |
| `/assessment`                                | GET    | the published Templates, each with its own create form                    |
| `/assessment/new`                            | POST   | create an Instance (one transaction), then 303 to the screen              |
| `/assessment/instances/[instanceId]`         | GET    | the one screen both parties share — answer, waiting, or report            |
| `/assessment/instances/[instanceId]/answers` | POST   | one party's whole sheet, or **409** when the answers are frozen           |
| `/invite/[token]`                            | GET    | what the invitation says; **claims nothing**                              |
| `/invite/[token]/claim`                      | POST   | spend the single-use invitation, bind the Counterparty, 303 to the screen |

`/invite/[token]` is inert on purpose: the token is single-use, and a GET that consumed it would
be consumed by the first mail client to preview the link.

## What the database holds

`db/migrations/0002_two_party_flow.sql` adds three things to #145's six tables:

- `party.access_token_hash` — who is asking, as a SHA-256 digest. The token itself is never stored.
- `instance_invite` — the invitation: email, the Counterparty's name, `token_hash`, `expires_at`
  (seven days), `claimed_at` (set by the one claim that consumed it), and — since #258 —
  `initiator_email`, the address the unlock notice reaches the other party at
  (`0008_initiator_email.sql`; NULL for a create nobody was signed in for).
- the two indexes that make both lookups a key read.

**No `status` column.** The instance's status (`awaiting_counterparty` / `answering` / `complete`)
is a function of rows that already exist, and `instanceStatusOf()` in `lib/flow/state.ts`
computes it on every read. A column would be a second authored copy of that fact — the same defect
a stored Gap would be, which is why there is none of those either.

**The copy is `INSERT … SELECT`.** Creating an Instance copies the Template's `item` rows into rows
owned by the instance record (#145 already made a record own its items). Nothing joins an instance's
copy back to its Template to render it, so a Template edited afterwards cannot reach an answered
Instance; `pnpm flow:e2e` proves it by editing the Template mid-run.

## The blind rule and the freeze

Both are decisions of the read path, not of the markup:

- `visibleRoles(viewer, status)` (`lib/flow/state.ts`) is the only place that decides which
  parties' Opinions may be read, and `lib/flow/store.ts` reads exactly those rows. Before both
  parties submit, the other party's scores are not in memory.
- `submitAnswers()` takes `FOR UPDATE` on the instance row, recomputes the status under the lock,
  and refuses a write once both parties have submitted. The refusal is **409** (an unanswered
  Aspect is 409 too; a browser that is not a party is 403). A silent no-op would be the bug.

## Identity, and why not Neon Auth

There is no auth wall in this version. Neon Auth is not enabled on the database branch
(`GET /auth` on the branch answers 404), and #145 landed `party` as `(role, name)` — no user
column. So a party proves itself with the token that instance gave it: a random 32-byte token in
an `httpOnly` cookie, whose SHA-256 is the row in `party.access_token_hash`. The Invitation token
is the second bearer credential; the Initiator's browser also keeps a copy of it so the screen can
show the link when no email was sent.

## Email

`lib/flow/email.ts` posts to Resend when `RESEND_API_KEY` is set (`RESEND_FROM`, default
`onboarding@resend.dev`; `NEXT_PUBLIC_BASE_URL`, default `http://localhost:3000`). A send has
three outcomes, and the creation redirect carries whichever one happened as
`?invite=sent|unset|failed` (#220):

- `sent` — the provider accepted the message; the screen names the address it went to.
- `unset` — no credential is configured on this deployment, so **no send was attempted**. The
  screen says there is no mail sender here and offers the link; it never names the variable,
  which is a deployment detail a reader cannot act on.
- `failed` — a send **was** attempted and refused (a non-2xx, or the provider unreachable). The
  screen says only that the invitation could not be sent: it does not guess a cause, because a
  429, an unverified sending domain and a bad recipient are indistinguishable to the reader.

`unset` and `failed` are kept apart because they need opposite responses from whoever debugs
them, and the server gets one log line with the fact: the provider's status (`HTTP 429`) or the
transport's error code (`ECONNREFUSED`), never the response body (it can echo the request),
never the token and never the link. The instance screen prints the invitation link in all three
outcomes — email is attempted after the transaction commits, so a mailer that breaks is a
degraded path, never a failed creation and never an unshareable invitation.

### The unlock notice (#258)

The second message goes the other way. When a submit makes an instance `complete`, the party who
did **not** just submit is emailed once: `lib/flow/unlock-notice.ts` composes it, the answers route
sends it after `submitAnswers` has committed, and `sendMail()` in `lib/flow/email.ts` is the same
transport the invitation uses — one provider, one set of outcomes, no new dependency.

- **Once, on the transition only.** `submitAnswers` returns `status: "complete"` on the write that
  filled the last missing answer; the submit before it says `answering` and the submit after it is
  refused `frozen` by the row lock. There is no `notified_at` column and no queue, because the
  freeze already makes "complete" a one-shot event.
- **What it carries.** The instance's title, the two party names, and a link to
  `/assessment/instances/<id>`. No answer, no score, no Gap value and no token: buying a mailbox is
  not the same as being a party, so the blind rule travels with the message.
- **Who holds the addresses.** `instance_invite.email` is the Counterparty's (typed into the create
  form); `instance_invite.initiator_email` is the creator's, taken from their session at creation
  (`db/migrations/0008_initiator_email.sql`) and NULL when they created it signed out. A seat with
  no address gets no message and one operator line — the in-app marker from #252 is the delivery.
- **A mail failure never fails a submit.** The record has already committed; `sendMail()` never
  throws, the route wraps the attempt in a `catch` that logs only the error's name, and the person
  lands on the same 303 and the same report either way. With no `RESEND_API_KEY` the notice reports
  `unset` and nothing is sent, exactly as the invitation does.

`RESEND_ENDPOINT` is the one knob that exists for the proof rather than for production: it lets
the flow be driven against a local capture server, so the message above can be shown without
claiming a send that never happened. Nothing sets it on a real deployment.

## The proof

`pnpm flow:e2e` (not a gate step — the gate stays database-free) drives the running app over HTTP
with three cookie jars: create, invite, a stranger's 404, the claim, a second claim refused, the
Initiator answering alone (no Gap on the Counterparty's page), the Counterparty answering, the
report (`data-feel-gap="3"` where Feel 2 meets Feel 5), a post-completion submit answering 409 with
the rows unchanged, a Template edit that does not reach the Instance, and the hash-only columns.
