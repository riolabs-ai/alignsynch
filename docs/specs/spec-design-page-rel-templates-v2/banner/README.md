# Admin notice banner · V2 package

<!-- docs-nav:begin -->

[Docs hub](../../../README.md) › **Specs & design briefs** › Admin notice banner (V2 package) · prev [/admin/brand (V2 package)](../admin-brand/README.md) · next [V2 brand and audience profile (handoff)](../brand-profile/README.md)

<!-- docs-nav:end -->

**Added:** 12 November 2026 · issue #903
**Status:** Spec. No page exists yet; this file is what the build card clones.
**Authority:** the package's tokens and this file. The mockups in `home/` and `brand-profile/`
draw neither the banner nor anything to contradict it — nothing here restyles a single pixel they
own.

---

## 1. What it is

One row at the top of the viewport, drawn only for a signed-in admin, whose whole content is **one
item: a link to `/admin/brand`**.

It is a _door_, not a notice system. There is no count, no badge, no changelog, no promotion, no
"what's new". If the row ever reads as a second navigation, it has grown past this spec and the
growth is a new card.

The bar is drawn because `/admin/brand` has no other entrance: the console's sidebar is the
operator's working set (relationships, templates, instances, audit), and a brand story is
reference, not work. A sidebar row would put a page nobody clicks above five pages somebody clicks
every day; a banner reaches the one person who wants it and costs everyone else nothing, because
everyone else never renders it.

## 2. Placement

| Question                          | Answer                                                                                                                                                                                                                                                          |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where in the document             | The first element a reader meets: above the marketing header and above the app shell's header, in the same block-level flow.                                                                                                                                    |
| Own row or overlay                | **Own row, in flow.** Not `position: fixed`, not an overlay, not a `translateY` on the shell. Content below it moves down; that is the point.                                                                                                                   |
| Which layouts mount it            | `app/(mainlayout)/layout.tsx` and `app/(marketing)/layout.tsx` — one component, `components/layout/admin-notice-bar.tsx`, mounted as the first child of each.                                                                                                   |
| Why not a third mount in `(auth)` | `app/(auth)` is the signed-out entry (`/login`, `/register`). Section 5 forbids the bar for a signed-out visitor, so a mount there is a component that can never render — dead code, and `data:check` E21 counts unreachable fixture text.                      |
| Double render                     | Impossible by construction: a route belongs to exactly one of the two groups. The membership rule is the group boundary (#317), not a check.                                                                                                                    |
| z-order                           | The bar is `sticky` at `z-40`, above the app header (`z-30`, `components/layout/header.tsx:309`) and the marketing header (`z-10`, `components/marketing/marketing-header.tsx:96`). Nothing the bar paints is content; nothing content-level may paint over it. |

The bar is sticky **because the row it pushes down is sticky**. A bar that scrolls away while the
header sticks has already failed: the admin scrolls 2,000px, the header pinwheels up under the
viewport's top edge and covers the first line of the page. Section 3 is the arithmetic that stops
that.

## 3. Sticky behaviour — the offsets it moves

Today both shells assume the viewport's top edge is theirs. With the bar present it is not, so
every sticky top and every anchor offset moves down by exactly the bar's height, and by nothing
else.

| Surface                                                    | Today                                                       | With the bar                                                                                                                                                     |
| ---------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marketing header `h-20` (80px)                             | `sticky top-0` (`marketing-header.tsx:96`)                  | `sticky top-[var(--admin-notice-h)]`                                                                                                                             |
| App header `h-16` (64px)                                   | `sticky top-0` (`header.tsx:309`)                           | `sticky top-[var(--admin-notice-h)]`                                                                                                                             |
| App sidebar                                                | `md:sticky md:top-0 md:h-screen md:w-16` (`sidebar.tsx:87`) | `md:top-[var(--admin-notice-h)]`, and its height `calc(100vh - var(--admin-notice-h) - 4rem)` — the rail must not run past the bottom edge of a shorter viewport |
| In-page sticky sub-menu (the home's, #904)                 | below the shared header                                     | below header **and** bar; the sub-menu's own `top` is `calc(var(--admin-notice-h) + 5rem)`                                                                       |
| Anchor targets (`scroll-padding-top`, `scroll-margin-top`) | header + a gap                                              | `calc(var(--admin-notice-h) + <header> + 12px)` — one sum, so a jumped-to heading is never under two bars                                                        |
| `--site-header-height` (`app/globals.css:150`, `5rem`)     | the header's height token                                   | **unchanged.** The header is still 80px. A second variable carries the bar; editing the header token to 120px would lie to every reader of the token.            |

### The mechanism, in full

1. One custom property, `--admin-notice-h`, defaults to `0px` on the layout's wrapper element.
2. When the bar renders, that wrapper sets it to the bar's own measured row height — `40px` or
   `56px` per section 4, never a computed value the bar does not also publish.
3. Consumers are the six rows above and nowhere else. **No component hardcodes `40px`**; a literal
   is a red flag in review, because it drifts the moment the row wraps.
4. The bar's box is `height: auto; min-height: var(--admin-notice-h)`, so a label that wraps at 390
   grows the box instead of being clipped — and the published number is the number the wrapped
   label needs, so the two cannot disagree.

`--admin-notice-h: 0px` is the default precisely so a build with the bar switched off renders
byte-identically to today: every `top-[var(--admin-notice-h)]` resolves to `top-0`.

### No content hidden under the two — the proof, not the promise

The rule is asserted by measurement in the build card, at each of the three viewports:

- scroll to the page's midpoint, then to its end;
- the first text line of the page body sits at `y ≥ bar height + header height`;
- the bar and the header never overlap each other (`bar.bottom === header.top`);
- a jump to the page's first anchor lands with its heading at `y ≥ bar + header`.

Numbers, printed. A screenshot alone does not answer this: the failure is 8px and a screenshot
looks fine.

## 4. Height and type

| Viewport | Bar height | Lines | Note                                                                   |
| -------- | ---------- | ----- | ---------------------------------------------------------------------- |
| 1440     | **40px**   | 1     | dot + label + link on one line, content aligned to the page container  |
| 1024     | **40px**   | 1     | same row; the container narrows, the label does not                    |
| 390      | **56px**   | 2     | the label wraps to a second line; the row grows, the text is never cut |
- **Type:** 11px, `letter-spacing: 0.045em`, uppercase label, weight 600 — borrowed from the
  package's own `.private-bar` (`brand-profile/css/…:3`: `min-height:28px`, `font-size:10px`,
  `letter-spacing:.045em`), nudged one step up to 11px because the app's smallest type token is
  12px and 10px is below it everywhere. This is the one place the banner departs from the
  package's number, and it departs upward to stay on the type scale.
- **Dot:** 7px, `rounded-full`, the accent token (`bg-action`), `aria-hidden`. It is decoration: the
  bar's meaning is its words.
- **Band:** full-bleed, `bg-foreground` with `text-background` — the package's graphite band
  (`--graphite #37474f`) has no app token that equals it, and Section 6 says what that costs.
- **Wrapping:** the label wraps. It is never truncated, never `line-clamp`-ed, never `nowrap` with
  an ellipsis. A one-line bar that hides the word an admin needs is worse than a two-line bar.
- **Why 390 is 56 and not 40:** two 20px lines plus two 8px paddings. The number is derived, so a
  build that changes the line-height must change the published height in the same commit — that is
  what the measurement in section 3 catches.

## 5. Contents — one item, and the shape that holds it

The bar is a **row of items** that happens to carry one item today. That is the whole difference
between "a menu with one entry" and "a special-case component for a special-case link".

|              | Value                                                            |
| ------------ | ---------------------------------------------------------------- |
| Items today  | 1 — a link to `/admin/brand`, label from the shell fixture       |
| Item anatomy | label, then the destination; no icon, no arrow glyph, no count   |
| Separator    | a `·` (`aria-hidden`) between items; none when there is one item |
| Order        | the fixture's array order, rendered as given                     |

**Adding a second item later** is one row in the fixture's `items` array: same component, same
band, same type, no prop, no variant, no second colour, no layout change. If a candidate item
needs a shape this table does not describe, it is not a second item — it is a different surface,
and it does not belong in the top edge of every page.

**What the bar may never gain** (each is a feature this card excluded by name): a close button, a
changelog or "what's new" link, a release-note feed, a status light that means something other than
"this is a door", a count of any kind, a CTA button, a second action per item.

## 6. Token mapping

The bar borrows the package's language rather than inventing one:

| Package                                      | App                                                      | Note                                                                                                                                                 |
| -------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.private-bar` graphite band, `#edf3f4` text | `bg-foreground text-background`                          | no token pair equals `#37474f`; this is the legal nearest, and it is a token                                                                         |
| `.private-bar` dot, `--green #8dc63f`        | `bg-action`                                              | the package's green is a status hue; the app's dot uses the brand's action token so the bar repaints with the brand, as `lib/brand-theme.ts` intends |
| `10px / .045em` caps                         | `text-[11px] tracking-[0.045em] uppercase font-semibold` | one step up, section 4                                                                                                                               |
| `--line #d9e0e3`                             | `border-border`                                          | the band's bottom hairline                                                                                                                           |
| `--measure: 1160px`                          | `--container-marketing` (72rem, `globals.css:140`)       | 8px narrower; the container token wins over the mockup's number                                                                                      |

Nothing here is a hex value in a component. `banner` adds no colour, no radius and no shadow: a
bar with a shadow over a header with a border is two elevations for one edge.

## 7. Visibility — the exact predicate

An async server component, three reads, in this order, all server-only:

```ts
adminProductShipped() && // lib/brand-boundary.ts:136
  !quizProductShipped() && // lib/brand-boundary.ts:65
  ADMIN_ROLES.has(await currentRole()); // lib/auth/require-role.ts:141
```

| Read                    | Why it is there                                                                                                                                                          | What it keeps out                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `adminProductShipped()` | the console is a template capability (`product.admin`), not a constant                                                                                                   | a template that sells no console never draws a door into it                                                    |
| `!quizProductShipped()` | `/admin/brand` is the **alignment** product's page — a quiz-only build answers 404 for it (`requireAlignmentProduct()`), so a bar linking there would be a door to a 404 | **never on the QuizHub brand**, by the same switch the page uses, not by a brand name written into a component |
| `currentRole()`         | the role gate, read as a value rather than as a redirect                                                                                                                 | never a signed-out visitor, never a member                                                                     |

Rules that follow:

- **`currentRole()` and not `requireAdmin()`.** The bar decides what to _draw_; `requireAdmin()`
  decides what to _serve_ and answers with `redirect()`/`notFound()`. A component that calls it
  would turn the front page into a login wall. `require-role.ts:130-146` documents `currentRole()`
  as the reader that answers `null` when auth is not configured, which is what keeps a
  `NEON_AUTH_*`-less tree (CI, the parity render) from answering 500 on a marketing page.
- **Never `hiddenNavHrefs()`.** That helper is the nav's half of the quiz flag; the bar is not nav.
- **The bar is not the gate.** `/admin/brand` re-checks everything itself
  (`requireAdminProduct()` → `requireAlignmentProduct()` → `requireAdmin()`). The bar's predicate
  decides visibility; it must never be the only thing standing between a member and the page.
- **This makes both group layouts request-time.** `currentRole()` reads a cookie, so the segments
  under `(mainlayout)` and `(marketing)` render per request. Consequences the build card must
  prove, not assume:
  - `pnpm build` still passes with `DATABASE_URL` and `NEON_AUTH_*` unset (`currentRole()` → `null`);
  - the signed-out render is **byte-identical to today** — `pnpm parity` hashes must not move. If a
    hash moves, the bar leaked into the signed-out HTML and that is the defect, not the hash.

## 8. Dismissibility — stated, and persistent

**The bar is persistent. It has no dismiss control, and a dismissal would be a new card.**

Three reasons, in order of weight:

1. **A dismissal needs storage, and the storage is a write.** A per-session dismissal is a cookie;
   Next 16 refuses `cookies().set()` inside a React Server Component render (the documented trap
   that bounced signed-in people to `/login`), so the write has to happen in a server action. That
   is a mutation path, in the shell, for a bar that carries one link.
2. **A dismissal that forgets is a nag.** Per-session means it returns on the next page load or the
   next tab, which trains an admin to dismiss it without reading — the worst possible outcome for a
   notice that is supposed to be read once.
3. **A dismissal that remembers is a preference**, and a preference needs a home (settings), an
   owner and a reset. None of those exist for this item.

The bar is also cheap to ignore: it is one row, it carries no count, and it appears only for the
people who have `/admin/brand` bookmarked anyway. If the owner later wants it dismissible, the
acceptable shape is a server action writing a cookie and a `useOptimistic` exit — named here so the
next card starts from the constraint instead of rediscovering it.

## 9. Copy and attribution

- **One fixture row, in the shell's fixture.** The bar mounts in the shell, so its words belong to
  `data/pages/shell.ts` — an `items` row (`id: "admin-notice"`, label) beside the header's and the
  footer's strings. `data:check` E23 attributes literals by reachable directory, so a component in
  `components/layout/` holding its own label would raise the shell's measured count above its
  budget of **0**.
- **Rejected:** a new `data/pages/admin-notice.ts`. E23 budgets are keyed by route, the bar has no
  route, and a fixture with no budget row is a surface whose literals are attributed to nobody.
- The label's words are the owner's; the spec does not write them. What it fixes is the shape: one
  row, one id, and the link's destination `/admin/brand`.

## 10. Acceptance for the build card

Run, print, paste:

1. `document.querySelector("[data-admin-notice]").getBoundingClientRect().height` — **40 / 40 / 56**
   at 1440 / 1024 / 390, equal to the number the component publishes for that viewport.
2. The section 3 overlap assertions at all three viewports, printed as `bar.bottom`,
   `header.top`, `first-content-y`.
3. `pnpm parity` — signed-out hashes **unchanged**, every route, both brands.
4. `pnpm data:check` — the shell's E23 budget still **0**, no new warning (W-count stays 0).
5. `bash scripts/verify.sh` — exit 0, lane `code`, both brand legs.
6. Signed-out, member, admin and `BRAND=quizhub` renders of `/`: the bar present in exactly one of
   the four.

## 11. What this spec does not decide

- Whether the bar ever becomes a notification channel. It is not one.
- Any item besides the `/admin/brand` link. One item is the content.
- Where `/admin/brand` is linked from besides this bar (see `../admin-brand/README.md` §3).
- The bar's copy. The owner writes the words; this file fixes the row, the id and the destination.

---

[← Reference UX patterns](../../ux-reference-patterns.md) — the card, token and type rules this
file assumes.

<!-- docs-nav:begin -->

[Docs hub](../../../README.md) › **Specs & design briefs** › Admin notice banner (V2 package) · prev [/admin/brand (V2 package)](../admin-brand/README.md) · next [V2 brand and audience profile (handoff)](../brand-profile/README.md)

<!-- docs-nav:end -->
