# Resend inbound — bounces, complaints and the suppression marks (#439b)

The app sends mail through Resend (`lib/flow/email.ts`). A `2xx` from the send API means the provider
**accepted** the message; it says nothing about whether a mailbox took it. Bounces and complaints
arrive later, on a webhook, and before this endpoint nothing recorded them — so an address that
never accepted mail stayed on `news_signup` forever and the broadcast surface (#507) had no row to
read before sending.

This note is the operator's half; the code is `app/api/resend/webhook/route.ts` →
`lib/email/webhook.ts` → `lib/db/email-events.ts` → `db/migrations/0027_email_event.sql`.

## The endpoint

`POST https://<host>/api/resend/webhook` — the path is fixed; point the provider's webhook endpoint
at exactly it, subscribe `email.bounced`, `email.complained` and `email.delivered`, and stop the old
`contact.*` subscription that posts at the site root.

`RESEND_WEBHOOK_SECRET` is the **endpoint's** signing secret (`whsec_…`) from the provider's webhook
detail page — not the account's API key, and not a secret from a different endpoint. Unset means the
route answers `503` to every delivery; it never accepts an unsigned one "temporarily".

## What it answers, and why

| Status | When                                                                               | Written |
| ------ | ---------------------------------------------------------------------------------- | ------- |
| `200`  | stored; a redelivery of one `svix-id`; or an event type this build does not act on | 0 or 1  |
| `400`  | the body is not a JSON object with a `type`                                        | nothing |
| `401`  | no signature, a signature that does not match, or a timestamp outside 300 s        | nothing |
| `429`  | this client spent its delivery budget for the window (`Retry-After: 60`)           | nothing |
| `503`  | `RESEND_WEBHOOK_SECRET` is unset, or the store did not answer                      | nothing |

A type the receiver does not act on is `200`, never `4xx`: a `4xx` makes the provider retry an event
we deliberately ignore, for days.

## What it writes

One row per delivery in `email_event` — `provider_event_id` (the `svix-id` header) is `UNIQUE`, so a
redelivery writes nothing and answers `200`. The insert and the mark share one transaction.

| Event                            | Row | `news_signup` mark                                         |
| -------------------------------- | --- | ---------------------------------------------------------- |
| `email.bounced` (`Permanent`)    | yes | `bounced_at` = event instant                               |
| `email.bounced` (`Transient`)    | yes | none — a soft bounce may deliver tomorrow                  |
| `email.bounced` (`Undetermined`) | yes | none — "cannot tell" is not a reason to cut an address off |
| `email.complained`               | yes | `complained_at` = event instant                            |
| `email.delivered`                | yes | none                                                       |

`bounced_at` / `complained_at` are written with `COALESCE(column, $2)`: the first instant wins, and a
repeated complaint does not move it. A bounce for an address that never joined the list is a row and
no mark (`rowCount = 0` on the update) — which is correct, and visible in the endpoint's log line.

## Proving it

The signed cases, the replay and the marks are `tests/resend-webhook.test.ts` (28 cases, no HTTP and
no database). The live proof is a signed `curl` against a running server plus two SQL reads:

```bash
BODY='{"type":"email.bounced","created_at":"2026-11-03T12:00:00.000Z","data":{"to":["fixture@example.test"],"subject":"Fixture","created_at":"2026-11-03T11:58:31.000Z","bounce":{"type":"Permanent","subType":"General","message":"550"}}}'
ID=msg_fixture_1; TS=$(date +%s)
SIG=$(node -e 'const {createHmac}=require("node:crypto");const k=Buffer.from(process.env.RESEND_WEBHOOK_SECRET.replace(/^whsec_/,""),"base64");process.stdout.write(createHmac("sha256",k).update(`${process.argv[1]}.${process.argv[2]}.${process.argv[3]}`).digest("base64"))' "$ID" "$TS" "$BODY")

curl -sS -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/resend/webhook \
  -H 'content-type: application/json' -H "svix-id: $ID" -H "svix-timestamp: $TS" -H "svix-signature: v1,$SIG" \
  --data "$BODY"
```

Sign the **exact bytes** you send: the signature covers the raw body, so a re-quoted or re-indented
payload never verifies. Then:

```sql
SELECT id, provider_event_id, type, recipient, occurred_at FROM email_event ORDER BY id DESC LIMIT 3;
SELECT email, bounced_at, complained_at FROM news_signup WHERE bounced_at IS NOT NULL OR complained_at IS NOT NULL;
```

Replay the same `ID` and `BODY` and the count stays at one; drop the `svix-signature` header and the
answer is `401` with no row; unset `RESEND_WEBHOOK_SECRET` and it is `503` with no row.

`pnpm db:verify` V24 checks the table, the `UNIQUE (provider_event_id)` constraint, the `jsonb`
payload and the two marks on `news_signup`, so a database migrated without `0027` fails by name
rather than 500ing on the first bounce.

## What never reaches a log

The payload contains the recipient's address. The endpoint's log lines carry the event type and the
`svix-id` and nothing else — no body, no subject, no address, no signature, no secret. The store logs
a driver **code** on failure, never the driver's message, because a `pg` CHECK violation quotes the
failing row's values.
