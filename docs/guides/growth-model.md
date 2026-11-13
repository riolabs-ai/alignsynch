# The growth model

<!-- docs-nav:begin -->

[Docs hub](README.md) › **Operations** › The growth model · prev [Demo auth](DEMO-AUTH.md) · next [Resend inbound](RESEND-INBOUND.md)

<!-- docs-nav:end -->

A demonstration business, computed rather than pasted: **36 monthly cohorts on the way to a $3M
run-rate**, the aggregate series an operator reads on `/admin/growth`, and a ~5k-relationship sample
of the operational rows behind it. Issue #920; the model lives in `content/growth-model.ts`, the
artifact in `data/demo/growth-model.json`.

## Two artifacts, one distribution

| path                                       | committed? | what                                                                  |
| ------------------------------------------ | ---------- | --------------------------------------------------------------------- |
| `data/demo/growth-model.json`              | **yes**    | the 36-cohort aggregate — the only thing the page reads               |
| `data/generated/growth/relationships.json` | no         | 5,000 sampled relationships: cohort month, plan, state, churn instant |
| `data/generated/growth/sessions.json`      | no         | one session per relationship                                          |
| `data/generated/growth/payments.json`      | no         | one invoice per live month, with the failed attempt and its retry     |
| `data/generated/growth/churn-events.json`  | no         | the relationships that left, and when                                 |

`data/generated/` is gitignored (the `pnpm gen` convention). The sample is **drawn** from the model
rather than scaled down from it: cohort sizes follow the model's own signup distribution, plans
follow that cohort's mix, and a relationship's churn age is drawn against its plan's monthly logo
churn. That is what lets a chart say "about 55 % Basic" and the rows an operator clicks say the same
number.

**Nothing near 3M rows is materialised.** The Neon demo branch is at its ceiling (#909), so the scale
is modelled and a sample is written; `--rows` above 50,000 is refused rather than accepted quietly.

## The commands

```bash
export PATH="$HOME/.nvm/versions/node/v24.22.0/bin:$PATH"

pnpm growth                                              # seed 42, 36 months, $3M, 5000 rows
pnpm growth --seed 42 --months 36 --target-arr 3000000 --rows 5000
pnpm growth --no-sample                                  # the model only
pnpm growth:check                                        # the gate's proof (see below)
```

`pnpm growth` prints the cohort count, the first and last month, the final ARR and its distance from
the target, the solved acquisition index and pass count, the signup/account/invoice totals, the model
`sha256`, and the sampled-vs-model comparison for plan mix and monthly signups. Two runs print the
**same** sha256.

`--target-arr` is in whole dollars; the artifact stores integer cents, the tree's money convention.

## Why the numbers can be trusted twice

- **The target is solved.** Revenue is linear in the acquisition index, so `solveGrowthModel`
  iterates `index ← index × target / actual` until the final month lands inside ±1 %, and records the
  index and the pass count in `solve`. Retuning the curve keeps the target; a magic constant would
  not.
- **Determinism is the feature.** No `Math.random()`, no `Date` construction, no `fs`. Every month
  instant is derived from `DEMO_NOW_ISO` (`content/core.ts`) — the last month is the fixture clock's
  own month, so nothing is dated after "now" — and every sampled row's noise comes from a
  `mulberry32` stream keyed by `(seed, cohort, plan, row)`, so retuning one cohort does not move
  another's invoices. Rates are integer basis points, money is integer cents.
- **The page cannot drift from the gate.** `pnpm growth:check` is a `scripts/verify.sh` step (never a
  CI-only one): it regenerates the model from the committed file's own parameters, compares value by
  value, and exits 1 naming the **first field path** that differs
  (`months[17].plans[1].mrrCents`), with both values. A parameter edited without regenerating is a
  red gate, not a page describing a business the code no longer computes.

## The screens

`/admin/growth` is the console's business surface: the MRR → ARR ramp with the $3M target drawn on
it, cohort retention curves, the plan mix as the base matures, the two churn rates (logo and
revenue), and the final month's invoice table. It reads the artifact through `lib/admin/growth.ts`,
which validates with `zGrowthModel` — a missing or unparseable file draws a panel with the reason and
the command that writes it, never a page of zeroes. Gates: `requireAdminProduct()` then
`requireAdmin()`, the same order as `/admin/health`.

Charts are `recharts` through `components/ui/chart.tsx`; no dependency was added.

## Limits, stated

- **The sample is not in the database.** `data/generated/growth/` is the artifact this change owns;
  mirroring 5,000 synthetic relationships into the demo branch's `relationship` / `party` /
  `assessment_instance` tables is a separate decision — it needs a ruling on what a synthetic
  relationship's items and opinions are, and it would change what `pnpm demo:verify` expects. Until
  that decision, the model and the sample are proven locally and the page charts the model.
- **No marketing surface reads this.** A public "trusted by N" claim built from synthetic data would
  be dishonest; the console is admin-only and `robots` is `noindex`.
- **No Gap column exists or will.** The model aggregates over relationships; the Gap stays a
  function.

<!-- docs-nav:begin -->

[Docs hub](README.md) › **Operations** › The growth model · prev [Demo auth](DEMO-AUTH.md) · next [Resend inbound](RESEND-INBOUND.md)

<!-- docs-nav:end -->
