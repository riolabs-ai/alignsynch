# AlignSynch V1 Prototype

The whole product, clickable, at `/v1/**` — six personas, no authentication, and an
in-browser store that keeps every flow working on reload. It is a _prototype_: every mutation is
local, every screen renders as the chosen persona, and the gap and stage arithmetic is the real
model (`content/gaps.ts`, `content/stages.ts`) rather than a re-implementation.

The tree is **additive and open**: `/v1/**` lives in its own route groups and its own component
domain, it touches no existing product file, and it is not flag-gated — it is a separate tree the
production routes never render.

## Personas → screens → flows

| persona          | landing                | screens                                                                                                                 | primary flow                                                                  |
| ---------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Visitor**      | `/v1` (persona picker) | pricing, support, terms, privacy, the picker                                                                            | read marketing, then "Enter as Initiator"                                     |
| **Initiator**    | `/v1/initiator`        | templates (`/templates`, `/templates/new`), relationships (`/relationships`), relationship detail, answer sheet, report | author a template → create a relationship → invite → answer → read the report |
| **Counterparty** | `/v1/counterparty`     | claimable invitations, their relationships, answer sheet, report                                                        | claim → answer → read the report                                              |
| **Coach**        | `/v1/coach`            | shared relationships, advice thread (read-only)                                                                         | observe, comment — no scoring, no answering                                   |
| **Admin**        | `/v1/admin`            | every relationship, gap aggregates, every template                                                                      | inspect any relationship, open any report                                     |
| **Service user** | `/v1/service`          | the support queue (invitations, accounts, stuck relationships)                                                          | resolve a stuck invite, view an account                                       |

The persona bar at the top of every `/v1` screen is the auth stand-in: it shows who you are and a
`Switch persona` select. Choosing a persona writes `v1_persona` to `localStorage` and a cookie;
there is no password, no session and no gate.

## The store — why it behaves like a full implementation

`lib/v1/store.tsx` is a React context seeded from `data/v1/fixtures.ts` (typed with `z.infer` of
the real model schemas) and persisted to `localStorage`. Mutations are local and instant:

- **create template** → appears in the library and the initiator's console.
- **create relationship from a template** → appears in both parties' lists, stage `invited`.
- **send invite** → the counterparty sees a claimable invitation; **re-invite** rotates the token.
- **claim** → stage moves to `connected`.
- **both parties answer** (own + prediction) → stage `sharing`.
- **both submitted** → the report unlocks; gaps compute with the real eight kinds; `aligned` when
  every gap meets the Setting.

Gap and stage are never re-derived by hand: `lib/v1/derive.ts` wraps `gapKindsOf` /
`instanceAlignment` (the eight gap kinds) and `stageOf` (the four stages). A relationship holds its
own copy of the Aspects, so a mid-flight invite — which the real `zAssessmentInstance` cannot hold —
still sits on real shapes.

## Coach is prototype-only

`party.role` is structurally `initiator | counterparty`; a third party does not exist in the model.
The Coach screens are rendered and labelled **Prototype — not represented in the schema** in the UI.
No coach column, table or enum was added anywhere.

## What is mocked

- **Identity.** The persona bar replaces login; there is no session, no password, no role check.
- **Persistence.** The store is `localStorage`, not Postgres. Reload keeps state; a new browser does
  not.
- **Sessions and the Manage dashboard.** `openedSessions`, `completedSessions`, `purchase` and
  `lastSessionAt` are seeded numbers — there is one purchase, never a running total. Average
  alignment is the real mean Gap once the report exists; completion and purchase are seeded.
- **The service queue.** Tickets and accounts are fixtures; "resolve" only mutates the local store.
- **Coaching.** The advice thread is local and has no counterpart in the schema.
- **Marketing inside `/v1`.** Home, pricing, support, terms and privacy reuse the copy in
  `data/pages/**` and `data/billing-plans.ts`; pricing CTAs are disabled (nothing is purchasable).

## What a real wiring needs

1. **Identity + roles.** Replace the persona bar with the real session; resolve `party.role` from
   the signed-in user instead of the persona. Add the Coach as a real `shared_with` row (a decision
   the schema must make, not the prototype).
2. **Store → Postgres.** Point `lib/v1/store.tsx` mutations at `lib/db/**` behind `/api` handlers;
   the relationships, templates, invitations, answers and comments all become rows.
3. **Sessions.** Model `opened_sessions` / `completed_sessions` and a `purchase` row once billing
   exists; the Manage dashboard's seeded numbers become real reads.
4. **Support queue.** Back the tickets and accounts with a real table and a resolve endpoint.
5. **The report** is already real arithmetic — it wires unchanged.

## Click-through

Start on `/v1`. The exact order of clicks:

1. Click **Enter as Initiator**.
2. **Author a template** (New template) → fill Title + three Aspects (each a prompt, a Left Value,
   a Right Value) → **Save** (lands on the library, the new template present).
3. On the new template card click **Create relationship** → **Create and open**.
4. On the relationship screen click **Send invite** (a live token appears).
5. In the persona bar, switch to **Counterparty** → the invitation is **Claimable** → **Claim**.
6. Open the relationship → **Answer Feel & Wish** → answer every Aspect → **Submit answers**.
7. Switch back to **Initiator** → open the relationship → **Answer Feel & Wish** → **Submit answers**.
8. **Read the report** — the Gap per Aspect, grouped by the eight kinds, with the Setting's verdict.

Final state: stage **sharing**, the report unlocked, gaps computed. (With the two parties answering
differently, the verdict is **Not yet aligned**.)
