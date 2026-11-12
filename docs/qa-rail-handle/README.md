# #875 — the rail's collapse handle

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › Rail collapse handle · prev [#542 phase 2](../qa-542-phase2/README.md) · next [Brand lockup](../qa-brand-lockup/README.md)

<!-- docs-nav:end -->

Evidence for the card. Captured against a **production build** (`pnpm build` → `pnpm start`) on
`:4518`, `BRAND=alignsynch`, the demo env from the main checkout, at `/news` — a shell route that
renders on a signed-out session. The rail is the shell: it draws the same chrome on
`/dashboard/relationships`, which 307s to `/login` without a session.

Widths 1440 / 1024 / 768 / 390, headless Chrome over the DevTools protocol
(`Emulation.setDeviceMetricsOverride` → asserts → `Page.captureScreenshot`). Every number below is
read from `getBoundingClientRect()` **before** the shutter and is kept in
[`measurements.json`](./measurements.json).

## What was wrong

The control was a form:

```html
<form action="javascript:throw new Error('A React form was unexpectedly submitted…')">
  <button type="submit" aria-label="Collapse the rail">
```

That `action` is not a mistake by the author: React writes it for _any_ function `action` once the
tree hydrates, and replays the submission from a document-level `submit` listener (the SSR HTML
carries `action=""` plus `$ACTION_ID_…`). So the control had two paths and only one of them
collapsed the rail — the one React replayed. The owner's report is the other one.

## What changed

1. **The function.** `<form>` → `<button type="button" onClick>`, calling the same server action
   (`toggleRail`) inside `startTransition`. One path. `aria-expanded` carries the rail's state
   (`true` expanded, `false` collapsed) and the accessible name is the action (`Collapse the rail` /
   `Expand the rail`). A button is Enter- and Space-activatable natively; both are measured below.
2. **The icon-only rail.** The collapsed top row kept `lg:px-4` (32px) beside the 40px monogram
   window — 72px in a 64px column, so the mark's box ran to x=80 on a 64px rail
   (`before-1440-collapsed.png`). The narrow form now centres the mark on the 8px padding the `md`
   rail already used (11.5 → 51.5), and the "opens in a new tab" glyph — 12px that had no room —
   is dropped from the 64px column only. Every menu row is one 40px icon with `title` and
   `aria-label` intact, and **no text node** (measured: `rowText=0` for all six sampled rows).
3. **The placement.** The handle is `absolute -right-3 size-6`, so its 24px box is centred on the
   rail's own 1px trailing border: half inside the rail, half over the page header. Nothing clips it
   (the rail has no `overflow-hidden`, and `tests/rail-responsive.test.ts` holds that), and because
   it is out of the flex flow it takes no width from the row.
4. **The row's arithmetic.** The 12px that crosses the border lands in the header's own left gutter:
   the search starts **13px** clear of the handle's right edge at 1440, 1024 and 768. It never
   wraps, never overlaps, and cannot push the handle off the rail — the handle is out of flow.

## The numbers

Expanded rail, at the width each still is:

| width |         rail | handle box (x…x+w) | centre | rail border | search left |  gap |
| ----: | -----------: | -----------------: | -----: | ----------- | ----------: | ---: |
|  1440 |          250 |       237 … 261 px |    249 | 249 – 250   |         274 | 13px |
|  1024 |          250 |       237 … 261 px |    249 | 249 – 250   |         274 | 13px |
|   768 |           64 |         51 … 75 px |     63 | 63 – 64     |          88 | 13px |
|   390 | 250 (drawer) |     hidden (`0×0`) |      — | —           | n/a (`<md`) |    — |

The handle's centre sits within half a pixel of the border's centre line: `-right-3` is 12px from
the padding box, and the border is the 1px outside it. `1440: rail-1440-expanded.png`,
`1024: rail-1024-expanded.png`, `768: rail-768-expanded.png`, `390: rail-390-drawer.png`.

**Both directions, measured at 1440 and 1024** (rail width after each act):

| act                               | 1440 | 1024 |
| --------------------------------- | ---: | ---: |
| focus the handle, press **Enter** |   64 |   64 |
| click the handle (pointer)        |  250 |  250 |
| press **Space**                   |   64 |   64 |

At **768** the rail is 64px whatever the cookie says — the viewport forces the icon column — so the
control changes the reader's stored preference and nothing on screen. That is the one width where
this control is a no-op, and it is the viewport's rule (`railClassName`), not the control's.

At **390** the handle is not rendered (`0×0`, `hidden md:inline-flex`): the rail is a 250px overlay
drawer there, so a control that narrows it means nothing, and half a handle would hang over the
scrim (`rail-390-drawer.png` shows the open drawer with its labelled rows and no handle).

Collapsed at 1440 (`rail-1440-collapsed.png`): rail 64px, six sampled rows all `40×40` with
`title` + `aria-label`, zero text nodes, brand window 11.5 → 51.5 inside 0 → 64.

## Console

Both runs: `Runtime.consoleAPICalled` + `Log.entryAdded` + `Runtime.exceptionThrown` enabled for the
whole page lifetime, and both are **empty** of application entries (the only line the dev server
emits is React's DevTools notice; the production build emits nothing).

- before: no error on a clean click, but the DOM carries the `javascript:throw …` action above, and
  React's replay `<script>` is the only thing standing between a native submit and that throw.
- after: no form in the rail at all (`forms=0` at every width), no action attribute to throw from,
  and no entry in the console through Enter, click and Space.

## Reproducing

```bash
pnpm build && pnpm start --port 4518        # a signed-out shell route renders the rail
# headless Chrome over CDP: set the viewport, read the rects, press Enter/Space, screenshot
```

The driver is a throwaway script (no Playwright in this tree); the asserts it made are the table
above, and `measurements.json` is its output, verbatim.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › Rail collapse handle · prev [#542 phase 2](../qa-542-phase2/README.md) · next [Brand lockup](../qa-brand-lockup/README.md)

<!-- docs-nav:end -->
