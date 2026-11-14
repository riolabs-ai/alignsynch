# #976 — the Sent screen with no invitation row

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › The Sent screen with no invitation row, #976 · prev [A relationship with no initiator member, #958](../qa-958-no-initiator-member/README.md) · next [The welcome tiles on /register too, #971](../qa-971-tiles/README.md)

<!-- docs-nav:end -->

`/assessment/instances/<id>/sent` answered **HTTP 500** for a relationship whose `session_invite`
row does not exist. The invitation was never written — a legitimate state, not a bad id — and the
copy fixture had no words for it:

```
PageCopy: section "status" has no item "none"
  at itemOf    lib/page-copy.ts:31:11
  at itemLabel lib/page-copy.ts:40:10
  at SentState components/assessment-flow/sent-state.tsx:108
```

`SentState` asks the `status` band for `"none"` when the read hands it no invitation, and the band
carried only the four derived states (`unclaimed`, `claimed`, `expired`, `revoked`). The throw is
correct — a copy lookup that silently returns a placeholder is a screen that says the wrong
sentence forever — so the fix is the missing fixture item, not the throw:

```
Not sent — no invitation was created for this relationship yet
```

Its shape matches the four beside it (`Invited — …`, `Withdrawn — the invitation was cancelled
before it was used`), and it says what the component's own docstring asks for: _"the link has not
been claimed" and "there is no link" are different facts._

## How the state was produced

Every seeded instance on the demo branch carries a `session_invite` row, so the absent state was
made for the length of one capture: the row for `assessment-instance-avery-rowan` was dumped to a
scratch file, deleted, the captures taken, and the row re-inserted with every column it had
(`q976-invite-row.mjs`). Afterwards the page reads `Accepted — Rowan claimed the invitation`
again, `200`, which is what it said before.

## The captures

`capture.mjs` — one headless Chrome over raw CDP, signed in as `initiator@demo.alignsynch.test`
through the branch's own `/api/auth/sign-in/email`, cookies installed with `Network.setCookie`.
It records the HTTP status from Node (a screenshot cannot be asserted on) and the document's own
`data-sent-status` band, then shoots 1440 and 390.

| phase  | width | HTTP | `data-sent-status` | document                                     |
| ------ | ----- | ---- | ------------------ | -------------------------------------------- |
| before | 1440  | 500  | —                  | "This page couldn't load" (the render threw) |
| before | 390   | 500  | —                  | "This page couldn't load"                    |
| after  | 1440  | 200  | `none`             | "Invitation sent" + the sentence above       |
| after  | 390   | 200  | `none`             | "Invitation sent" + the sentence above       |

Stills: `976-{before,after}-{1440,390}.png`; the machine-readable form is
`{before,after}-report.json`.

Re-running it needs a dev server on the branch with `DEMO_AUTH=1` and a seeded demo branch:

```bash
pnpm dev --port 3438
node docs/qa-976-sent-none/capture.mjs --phase after --base http://localhost:3438
```

`--base` must be `localhost`, not `127.0.0.1` — Neon Auth refuses the sign-in with
`INVALID_ORIGIN` otherwise.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › The Sent screen with no invitation row, #976 · prev [A relationship with no initiator member, #958](../qa-958-no-initiator-member/README.md) · next [The welcome tiles on /register too, #971](../qa-971-tiles/README.md)

<!-- docs-nav:end -->
