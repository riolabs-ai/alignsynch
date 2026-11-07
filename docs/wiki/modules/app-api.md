# Module: `app/api`

Thirteen route handlers — the HTTP surface that is neither a page nor a server action. They exist
where the acceptance is a `curl`, where the answer must be a status code, or where a third party
(a payment provider, a mail provider, a scheduler) has to be able to call in.

## Responsibilities

- Proxy Neon Managed Auth so the browser never holds a second origin.
- Take money events in and out: checkout, method capture, the provider's webhook, the cron job.
- Accept provider and public form posts: the Resend inbound webhook, the contact form, the news
  signup, the profile write, the tour's seen-marker.
- Report which build is answering, unauthenticated.

## Key files

| Route                             | What it does                                                                                                               |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `auth/[...path]/route.ts`         | Every Managed Auth path, resolved per request through `lib/auth/server.ts::authRoutes()`. Throttles credential POSTs only. |
| `auth/google/finish/route.ts`     | Spends Neon's `neon_auth_session_verifier` and turns a Google sign-in into a session.                                      |
| `billing/checkout/route.ts`       | A plan card's button → where the browser goes.                                                                             |
| `billing/payment/route.ts`        | Capture a method for a relationship. **Charges nothing** (`lib/billing`).                                                  |
| `billing/payment/return/route.ts` | The hosted capture's return: reads the session back from the provider, then records the method.                            |
| `billing/webhook/route.ts`        | The provider's deliveries. Fixed public path — moving it is a silent 404.                                                  |
| `billing/payment-jobs/route.ts`   | The scheduled job: reminders, retries, expiry. Bearer or `x-vercel-cron`, 503 when unconfigured.                           |
| `resend/webhook/route.ts`         | Inbound mail → the support inbox. Fixed public path.                                                                       |
| `contact/route.ts`                | The public contact form → `lib/contact/submit.ts`, then a 303.                                                             |
| `news/subscribe/route.ts`         | The footer's signup, stored and confirmed, rate-limited through the form guard.                                            |
| `profile/route.ts`                | The identity surface's only write.                                                                                         |
| `tour/route.ts`                   | The first-run tour's per-person seen state.                                                                                |
| `version/route.ts`                | Which build is answering, unauthenticated.                                                                                 |

## Public API

Signatures are Next 16 route-handler signatures: `(request: Request, context)` returning a `Response`.
The two outbound-facing shapes worth reading are `POST /api/billing/payment-jobs` — whose JSON body is
the run's own report (`{ now, scanned, results }`) — and `GET /api/version`, which the deploy scripts
read.

## Internal structure

Every handler is thin on purpose: it reads the request, resolves the actor from the session (never
from the body), calls one library function, and maps the result to a status. The decisions live in
`lib/` — `lib/member/payment.ts`, `lib/flow/store.ts`, `lib/contact/submit.ts`, `lib/forms/guard.ts`.

## Dependencies

- **Used by:** the browser, payment and mail providers, `vercel.json`'s cron, and scripts
  (`scripts/billing-smoke.mjs`, `pnpm demo:verify`).
- **Uses:** [`lib/billing/`](../../../lib/billing), [`lib/member/`](lib-member.md),
  [`lib/flow/`](lib-flow.md), [`lib/forms/`](../../../lib/forms), [`lib/db/`](lib-db.md).

## Notable patterns / gotchas

- **A webhook path is a public contract.** `billing/webhook` and `resend/webhook` are pasted into
  provider dashboards; a rename is an outage, not a refactor.
- **The payment job fails closed.** With no `PAYMENT_JOB_SECRET` (or `CRON_SECRET`) it answers 503 and
  mutates nothing — an unauthenticated endpoint that expires relationships and moves money would be a
  public button.
- **A mail failure never fails a committed write.** The notice is sent _after_ the transaction and the
  route reports `pending-delivery` rather than rolling anything back.
