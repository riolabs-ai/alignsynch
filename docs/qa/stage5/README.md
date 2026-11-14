# Stage 5, both states (#870)

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Records & QA** › Stage 5, both states · prev [Relationship detail — the edit form is asked for](../rel-detail-edit/README.md) · next [swiper 12](../swiper-12/README.md)

<!-- docs-nav:end -->

Four stills of the create flow's fifth stage, taken against a dev server on this branch
(`alignsynch/t_603d4f49-…`, based on `main` after `2e87eac3`) on **port 3002**, at **1440** and
**390** CSS px, `deviceScaleFactor: 1`.

The card's report was that stage 5 drew a yellow band and nothing else — no plan, no card, no pay,
no **Send**, no **Continue as Draft**, no link out. These are the two states that replace it.

| File                       | State                                    | What it shows                                                       |
| -------------------------- | ---------------------------------------- | ------------------------------------------------------------------- |
| `stage5-not-entitled-1440` | Free account, **Advanced Mode** chosen   | the trial notice, the plan radio group, **Send**, **Keep as draft** |
| `stage5-not-entitled-390`  | the same, at phone width                 | no horizontal overflow, controls stacked and reachable              |
| `stage5-entitled-1440`     | the same account after a paid row exists | the plan **summary** — "Your plan" + tier — instead of radios       |
| `stage5-entitled-390`      | the same, at phone width                 | as above, narrowed                                                  |

## How they were taken

No Playwright in this tree; headless Chrome over CDP, per `docs/qa-ia/README.md`.

1. A throwaway account through the app's own `POST /api/auth/sign-up/email` (Node, not the page — the
   browser `Origin` is refused by the trusted-domain list).
2. The four create stages posted over HTTP as a person would (`/assessment/new/who` → `/mode` →
   `/aspects` → `/assessment/new` with `draft=1`), landing on the invite URL. Same posts
   `scripts/flow-e2e.mjs` makes, so the stills and the e2e cannot disagree about how the flow is
   entered.
3. The session's cookies handed to Chrome with `Network.setCookie`, then `Emulation.setDeviceMetricsOverride`,
   assert, `Page.captureScreenshot`.
4. The entitled state is the row a completed checkout leaves — `billing_subscription`, provider
   `mock`, `livemode false`, `principal/monthly`, `status active`. Nothing was charged and no
   checkout was faked; the plan summary reads the same reader the real subscription does.

## Asserted before every shutter

Written to `capture-report.json` beside the images, per shot:

- `innerWidth === 1440 | 390`, and `scrollWidth <= innerWidth` (no horizontal overflow);
- `data-pay-step` present (the walk is rendered, not just the band);
- `data-create-send="true"` and `data-create-keep-draft="true"` — the two acts the report said
  were missing;
- `data-create-problem` **absent** (a clean stage 5 draws no refusal);
- `data-pay-plan-included` present **only** in the entitled pair, and the plan radio group present
  **only** in the not-entitled pair — an account that already pays is not asked to choose again;
- `data-create-notice` present when the account is not entitled and Advanced Mode was chosen, absent
  when it is — the notice is the trial sentence (#835), not a general banner;
- `document.body.innerText` carries none of `postgres://`, `npg_`, `sk_test`, `DATABASE_URL`.

The account, its relationship and its subscription row were removed after the last shutter; the
demo branch is shared and a stray active relationship makes `pnpm db:seed` refuse.

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Records & QA** › Stage 5, both states · prev [Relationship detail — the edit form is asked for](../rel-detail-edit/README.md) · next [swiper 12](../swiper-12/README.md)

<!-- docs-nav:end -->
