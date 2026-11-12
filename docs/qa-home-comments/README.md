# The header's lockup is a link home — QA (card `t_6425a0a6`)

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Product** › Home review comments — the logo · prev [AS2 home visual QA](../qa-as2-home/README.md)

<!-- docs-nav:end -->

The owner's comment on `/` was four words: _"click logo goes to home page"_. It did not. The public
chrome drew a bare `<Image>` inside a `<span>` that closed immediately after it, so the one control a
visitor presses without reading was the only thing on the page that could not be pressed — and from
`/pricing` the ways back to `/` were the menu's own "Home" row or the address bar.

This folder is the evidence for the fix: four stills, the numbers behind each shutter, the
accessibility tree, and the click-through.

## How the shots were taken

- **Two serving trees, not two commits of one tree.** The claim is about what a visitor's browser
  receives, so `before` served a detached snapshot of `origin/main` (`2e87eac3`) and `after` served
  a detached snapshot of this card's head — `.worktrees/preview-logo-{before,after}`, each with a
  real `pnpm install --frozen-lockfile`.
- `pnpm dev --port 4317` / `4318`, both `BRAND=alignsynch` (the env files' own value), started with
  `withenv.sh` sourcing the main checkout's env — a worktree carries no `.env`. A dev server and not
  `pnpm start` because the change is server-rendered markup with no build-time branch in it; the
  production render is held by `pnpm parity`, whose both-brand hashes moved on `/` and nothing else.
- Headless Chrome 157 over the DevTools protocol — no Playwright, no Puppeteer, the same loop every
  other `docs/qa-*` folder uses. The driver is committed beside the images: `capture.mjs`.
- Viewports **1440** and **390**, `deviceScaleFactor: 1`, mobile emulation below 700.
- The viewport is resized to the measured `document.scrollHeight` before each shutter:
  `captureScreenshot` with a `clip` below the fold returns a blank frame, and `captureBeyondViewport`
  alone still frames only the viewport.

## What was asserted before each shutter

Every row ran at **both widths**; the values are in `capture-report-before.json` and
`capture-report-after.json`.

| Assert                                                           | Why it is on the list                                                           |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `innerWidth === width`                                           | the emulation actually applied                                                  |
| `scrollWidth === innerWidth`                                     | no horizontal overflow introduced by the wrapper                                |
| `img[data-brand-lockup]` is in the header                        | the lockup is found by the hook `app/globals.css` sizes it through, not by slot |
| `alt === "AlignSynch"`                                           | the anchor's accessible name is the image's, and it is the brand's              |
| `before`: the image is inside **no** anchor                      | that absence is the defect being recorded                                       |
| `after`: `a[href="/"]` wraps it, and carries **no** `aria-label` | a second name would be read instead of the `alt`, not as well as it             |
| `after`: the anchor's box equals the image's box, both axes      | the wrapper is not allowed to become a layout participant                       |
| no `DATABASE_URL` / `postgres://` / `npg_` / `sk_test` / `NEON_` | a still must never carry a local env value                                      |
| zero broken images (`complete && naturalWidth === 0`)            | a shutter over undecoded art is not evidence                                    |

## No pixel movement

The same DOM read at both widths, before against after — the lockup's rect, the brand slot's rect,
the header's height and the document's height:

| Width |                 | before                     | after                      |
| ----- | --------------- | -------------------------- | -------------------------- |
| 1440  | lockup rect     | `x 168, y 24, 206.11 × 32` | `x 168, y 24, 206.11 × 32` |
| 1440  | brand slot rect | `x 168, y 24, 206.11 × 32` | `x 168, y 24, 206.11 × 32` |
| 1440  | `header` height | 81                         | 81                         |
| 1440  | document height | 5661                       | 5661                       |
| 390   | lockup rect     | `x 24, y 28, 154.58 × 24`  | `x 24, y 28, 154.58 × 24`  |
| 390   | brand slot rect | `x 24, y 28, 154.58 × 24`  | `x 24, y 28, 154.58 × 24`  |
| 390   | `header` height | 81                         | 81                         |
| 390   | document height | 10178                      | 10178                      |

The only row that differs between the two runs is the anchor's existence. The image keeps
`h-6 w-auto shrink-0 sm:h-7` and the `data-brand-lockup` hook, so 24px at 390 and 2rem at 1440 stay
where they were measured; the wrapper carries none of it.

## The accessible name, out of the browser

`Accessibility.getFullAXTree`, filtered to links whose name contains the brand:

| Run    | nodes                                                                |
| ------ | -------------------------------------------------------------------- |
| before | `[]` — the brand was not a link, and nothing in the tree said it was |
| after  | `[{ "role": "link", "name": "AlignSynch", "ignored": false }]`       |

The anchor itself, read off the live DOM at 1440:

```
{"href":"/","ariaLabel":null,"className":"flex shrink-0 items-center","tabIndex":0,"text":""}
```

Empty `textContent` and no `aria-label`, so the name comes from the one place it should — the
`alt` inside the image. Tab order, walked with real `Input.dispatchKeyEvent` presses from a cleared
focus: the **first** Tab lands on the lockup at both widths (`{"tag":"A","href":"/","isLockup":true}`),
which is also the order a visitor expects — the signature, then the menu.

## The owner's sentence, walked

From `/pricing`, a real `.click()` on the lockup: `{ "from": "/pricing", "landed": "/", "ok": true }`.
An anchor can be present, correct and still not navigate — that is the assertion a still cannot make.

## The footer was left alone, on purpose

`components/layout/footer.tsx` draws the same 818×127 file in its brand block, and it is **not** a
link — before or after this card. That block is the signature _and_ its blurb in one `h-24` row: an
identity panel, not a nav affordance, and the owner's note named the header. Wrapping it is a
separate decision and no part of this change.

## Related

- [AS2 home visual QA](../qa-as2-home/README.md) — the stills of the page this chrome sits on.
- [The flow stages spec](../specs/flow-stages.md) — the shell rules this header is outside of.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Product** › Home review comments — the logo · prev [AS2 home visual QA](../qa-as2-home/README.md)

<!-- docs-nav:end -->
