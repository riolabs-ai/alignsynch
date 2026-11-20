# The demo walkthrough: ten steps, two widths, one assertion each

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Operations** › Demo walkthrough · prev [Deploying](deploying.md) · next [Env stores](env-stores.md)

<!-- docs-nav:end -->

The demo is a product claim, and a claim needs a walk somebody can repeat. This page is the walk:
**ten named steps** a visitor actually takes — the public pages, the PIN gate, the three demo seats,
the dashboard, a relationship, stage 1 of the create flow — walked by a headless browser, captured at
**390** and **1280** pixels, and **asserted on the text each screen must say**.

The runner is `scripts/demo-walkthrough.mjs`. It is the only thing that walks these steps, and the
table below is generated from its manifest, so a step cannot be described here and not taken there.

```text
node scripts/demo-walkthrough.mjs          walk the ten steps, write 20 captures + a run report
node scripts/demo-walkthrough.mjs --check  offline: the table below is what the manifest renders
node scripts/demo-walkthrough.mjs --write  regenerate the table from the manifest
```

## A screenshot is not proof

The failure mode a capture harness invites is a **green run that photographs the wrong screen**: a
route that redirected to `/login`, a session that never arrived, a 404 wearing the app's chrome. Each
one produces a beautiful PNG and exit 0. Every step therefore carries three kinds of assertion, and a
step that misses one exits **1**:

| assertion  | what it proves                                                                    |
| ---------- | --------------------------------------------------------------------------------- |
| `expect`   | the strings the screen must say — the difference between the right page and a 404 |
| `absent`   | what it must **not** say; the create rail must not name an `Ongoing` stage        |
| DOM checks | `selectors`, `roles`, `field`, `routePattern` — the control exists, and it held   |

A failed step still writes its capture: the image is the evidence of what the screen _did_ say, and
the assertion is what decides whether the run passed. A step whose route is chosen at run time —
step 8 opens whichever relationship the dashboard lists first — declares its shape and carries a
`routePattern` the observed path must match.

## Running it against the demo branch

The walk needs the demo PIN, and the PIN enters the process the way every repo secret does — through
`bin/withenv.sh`, which loads `.env` and `.env.local` into the child without copying a value into the
tree:

```text
~/.hermes/profiles/alignsynch/bin/withenv.sh "$PWD" \
  ~/.hermes/profiles/alignsynch/bin/node24.sh node scripts/demo-walkthrough.mjs
```

`BASE_URL` selects the origin and defaults to `https://demo.alignsynch.com`; a production origin is
**refused** before Chrome launches, because this walk signs in and types into forms. `DEMO_PIN` is
required, `CHROME_BIN` defaults to `/usr/bin/google-chrome`, and `--out <dir>` moves the capture
directory.

## Zero new dependencies, and the capture is not committed

There is no Playwright, no Puppeteer and no Selenium in `package.json`, and nothing here adds one.
Chrome is already on the host and Node 24 has a global `WebSocket`, so the browser is driven over the
DevTools Protocol through `scripts/cdp.mjs` — the one client this repo has, shared with
`scripts/demo-flow.mjs` and `scripts/qa-atlas.mjs`. `scripts/design-audit.mjs` proves the smaller
`google-chrome --headless=new --screenshot=…` form; that form cannot read a DOM, and every step here
asserts on text, so the run keeps one session it can interrogate between clicks.

Captures land in `.artifacts/demo-walkthrough/` beside the run's own `report.json`, and **neither is
committed**. A committed PNG is ~10 MB of bytes nobody can re-verify; the assertion is the part that
can be re-run. `docs/qa/` is also the wrong shelf for them: `scripts/capture-retention.mjs` requires
every capture directory to carry a register row, a live pointer or an open issue, and a `keep` row's
weight must equal the directory **exactly** — a directory that changes every run would fail
`pnpm docs:check` on its second run. The runner refuses an output directory under `docs/qa/` and says
this in the refusal.

## The counterparty steps are declared, not captured

One run is **one session**: an anonymous visitor who signs in through the demo gate and stays as the
Initiator. A second identity per step would make the walk's order depend on a question the parent card
(`t_2e61c4c8`) owns — _is the counterparty seat bound to a relationship whose Gap is computable?_
Measured on 2026-11-20 against the demo branch: `/login`'s demo panel **does** draw a `counterparty`
role button and it signs a browser in as the seeded counterparty, so the door exists. What is not yet
answered is the binding, so the three counterparty screens are listed at the foot of the table as
**declared, not captured** — named so nothing implies the two-party half was covered, and scored
nowhere.

Until that answer lands, those three stay blocked and the walk claims nothing about them.

## Committed report, generated table

The rows between the two markers belong to the script. `--check` fails when they are not what the
manifest renders, and `tests/demo-walkthrough.test.ts` holds the same comparison inside `pnpm test`,
alongside the invariants — ten steps, two widths each, at least one expected string per step, and no
counterparty step inside the walk. Editing a step without regenerating this table is a red gate, not a
stale document.

<!-- demo-walkthrough:begin -->

---

| #   | step                                                               | who       | route                                             | captures (390 · 1280)                                      | the screen must say                                                                         |
| --- | ------------------------------------------------------------------ | --------- | ------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | Signed out, the home page names the promise                        | visitor   | `/`                                               | `01-home-390.png` · `01-home-1280.png`                     | "Bring expectations into the open at work." · "Explore business templates"                  |
| 2   | The template gallery, with a worked example                        | visitor   | `/relationship-templates`                         | `02-templates-390.png` · `02-templates-1280.png`           | "RELATIONSHIP TEMPLATES" · "See Where You Agree. Talk About the Rest." · "Search Templates" |
| 3   | Pricing, in the visitor's words                                    | visitor   | `/pricing`                                        | `03-pricing-390.png` · `03-pricing-1280.png`               | "Simple Pricing. Start Free." · "The person you invite never pays."                         |
| 4   | How it works, replayed from the recorded walk                      | visitor   | `/how-it-works`                                   | `04-how-it-works-390.png` · `04-how-it-works-1280.png`     | "One relationship, six moves" · "pnpm demo:flow"                                            |
| 5   | The demo gate asks for the PIN                                     | visitor   | `/demo`                                           | `05-demo-gate-390.png` · `05-demo-gate-1280.png`           | "Demo sign-in" · "Demo PIN"                                                                 |
| 6   | The PIN unlocks three demo seats                                   | visitor   | `/login`                                          | `06-demo-unlocked-390.png` · `06-demo-unlocked-1280.png`   | "Demo accounts"                                                                             |
| 7   | Signed in as the Initiator, the dashboard is the next step         | initiator | `/dashboard`                                      | `07-dashboard-390.png` · `07-dashboard-1280.png`           | "Welcome Back" · "Your Next Steps" · "Active Relationships"                                 |
| 8   | A relationship opens from the dashboard                            | initiator | `/dashboard/relationships/<relationship>`         | `08-relationship-390.png` · `08-relationship-1280.png`     | "At a Glance" · "Discussion" · "Initiator"                                                  |
| 9   | Stage 1 of 5: Details, with the six-cell rail and no Ongoing stage | initiator | `/dashboard/templates/relationship-basics/create` | `09-create-stage-1-390.png` · `09-create-stage-1-1280.png` | "STAGE 1 OF 5" · "Relationship Details" · "Starts when they join"                           |
| 10  | Stage 1 takes a typed title and offers stage 2                     | initiator | `/dashboard/templates/relationship-basics/create` | `10-stage-1-typed-390.png` · `10-stage-1-typed-1280.png`   | "Continue to Stage 2"                                                                       |

Beyond the text, a step also proves:

- **1 Signed out, the home page names the promise** — `h1`
- **5 The demo gate asks for the PIN** — `#demo-pin`
- **6 The PIN unlocks three demo seats** — initiator · counterparty · admin
- **8 A relationship opens from the dashboard** — the open path matches the declared shape
- **9 Stage 1 of 5: Details, with the six-cell rail and no Ongoing stage** — no "Ongoing"; `#create-title`
- **10 Stage 1 takes a typed title and offers stage 2** — `#create-title` holds what was typed

**Declared, not captured — a counterparty session:**

- **The counterparty opens the invitation and accepts** — would prove the invitation link lands on the accept screen for the other seat
- **The counterparty answers the same sheet** — would prove the second seat can submit, and neither sheet is readable before both submit
- **The counterparty reads the Gap once both sheets are sealed** — would prove the report renders for the counterparty, not only for the Initiator

Captures land in `.artifacts/demo-walkthrough/`, beside the run's own `report.json`.

<!-- demo-walkthrough:end -->

## Exit codes

| code | meaning                                                                                         |
| ---- | ----------------------------------------------------------------------------------------------- |
| `0`  | every step held and every capture was written                                                   |
| `1`  | a step did not hold, printed with what was measured — or `--check` found a stale table          |
| `2`  | refused: a production origin, no `DEMO_PIN`, no Chrome, or a capture directory under `docs/qa/` |

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Operations** › Demo walkthrough · prev [Deploying](deploying.md) · next [Env stores](env-stores.md)

<!-- docs-nav:end -->
