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
  (seven days), `claimed_at` (set by the one claim that consumed it).
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
`onboarding@resend.dev`; `NEXT_PUBLIC_BASE_URL`, default `http://localhost:3000`). With no key it
returns `{ sent: false, reason }`, the creation redirect says `?invite=unsent`, and the instance
screen prints the link. Email is never allowed to block the flow: it is attempted after the
transaction commits, and a Resend failure is a degraded path, not a failed creation.

## The proof

`pnpm flow:e2e` (not a gate step — the gate stays database-free) drives the running app over HTTP
with three cookie jars: create, invite, a stranger's 404, the claim, a second claim refused, the
Initiator answering alone (no Gap on the Counterparty's page), the Counterparty answering, the
report (`data-feel-gap="3"` where Feel 2 meets Feel 5), a post-completion submit answering 409 with
the rows unchanged, a Template edit that does not reach the Instance, and the hash-only columns.
