# `/admin/brand` — the brand and audience profile, as a page · V2 package

<!-- docs-nav:begin -->

[Docs hub](../../../README.md) › **Product** › /admin/brand (V2 package) · prev [Admin notice banner (V2 package)](../banner/README.md) · next [AS2 templates redesign (handoff)](../../spec-as2-style-templates-redesign/README.md)

<!-- docs-nav:end -->

**Added:** 12 November 2026 · issue #903
**Status:** Spec. The route does not exist yet; this file is what the build card clones.
**Clone source:** `brand-profile/brand-and-audience-profile.html` in this package. **The page is
that document rendered in the app** — same sections, same order, same words, same hierarchy. The
mockup is the authority; where this file and the mockup disagree, the mockup wins and this file is
wrong.

---

## 1. What it is, and why it is a page

The company story — positioning, who the product is for, how the flow works, and the three reusable
profile descriptions — currently lives in a private HTML file that only the people holding the
folder can read. `/admin/brand` puts it behind the console's gate so an operator can read the
canonical wording while writing a page, a release note or a support reply, and so the wording has
one home that is not a copy in someone's downloads folder.

It is a **reference page**, not a marketing page and not a settings screen. It has no form, no save
button, no edit affordance and no server action: the words are read-only, and the place to change
them is the canon (section 8).

## 2. The eleven sections, in order

Every one of these is a heading in the mockup. This table is the clone contract: the build renders
these eleven, in this order, with these words, as these elements.

| #   | Element | Words                                                | Block id       | What the block carries                                                                                        |
| --- | ------- | ---------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | `h1`    | Bring expectations into the open at work.            | `positioning`  | eyebrow (with dot) · lede · two actions · brand-promise strip · the two-seat figure                           |
| 2   | `h2`    | Start with the working relationship in front of you. | `positioning`  | eyebrow "The story" · the two-paragraph story copy                                                            |
| 3   | `h3`    | Start with a working relationship.                   | `positioning`  | value card 1, label "01 / Business first"                                                                     |
| 4   | `h3`    | Make room for personal reflection.                   | `positioning`  | value card 2, label "02 / Personal growth"                                                                    |
| 5   | `h3`    | Open the report when both are ready.                 | `positioning`  | value card 3, label "03 / Shared by choice"                                                                   |
| 6   | `h2`    | Business first. Personal growth, too.                | `audiences`    | eyebrow "Who it is for" · lede · two audience cards · counselor note · participant note                       |
| 7   | `h3`    | For working relationships across a company.          | `audiences`    | audience card 1, category "Primary · Business & corporate"                                                    |
| 8   | `h3`    | For people building relationship skills.             | `audiences`    | audience card 2, category "Personal growth · Relationships & friendships"                                     |
| 9   | `h2`    | A simple process. A clear privacy gate.              | `workflow`     | eyebrow "How it works" · lede · four numbered steps, 01–04                                                    |
| 10  | `h2`    | One story across company and app descriptions.       | `profile-copy` | eyebrow "Reusable profile copy" · lede · three copy cards (Short description / Company profile / App profile) |
| 11  | `h2`    | Start with a business relationship.                  | `closing`      | eyebrow "Primary call to action" · lede · one primary action                                                  |

The hero's **two-seat figure** is part of block 1, not a section of its own: two participant cards
("Participant A", "Participant B", each with a `Private` chip), a connector, a "Shared report" card
and the caption "Two people answer separately. The shared report opens when both accept." It is the
privacy story drawn — dropping it because it is fiddly would drop the one picture that explains the
product, so it is cloned. Its two token problems are named in section 6.

Four numbered steps (block 9), verbatim: 01 Choose a relationship template · 02 Invite the other
person · 03 Answer and review privately · 04 Accept, then open the report. Each has a lead line and
a sentence; both are fixture strings.

**The check that keeps this honest:** the build card prints a diff of the eleven heading strings
extracted from the rendered page against the eleven extracted from the mockup — same text, same
order. Paraphrase is a defect, and it is the defect this page exists to prevent.

## 3. Route and gate

- **File:** `app/(mainlayout)/admin/brand/page.tsx` — the shell's group, because this is the
  console family, not the marketing group.
- **Route manifest:** `"/admin/brand"` joins `STATIC_ROUTES` in `content/routes.ts` (beside
  `/admin/health`), and **not** `INDEXABLE_PAGES` — no admin route is indexable, and the empty
  intersection today is the invariant, not an oversight.
- **Gate, in this order, before any read:**

```ts
requireAdminProduct(); // lib/brand-boundary.ts:160
requireAlignmentProduct(); // lib/brand-boundary.ts:100
await requireAdmin({ next: "/admin/brand" }); // lib/auth/require-role.ts:181
```

| Call                        | Refusal                                                                                          | Why it is in this position                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `requireAdminProduct()`     | `notFound()` — the 404 an unknown URL gets, with no session read                                 | the console is a template capability (`product.admin`); a template that sells no console must not answer a sign-in page for a surface it does not have                                                                                                                                                                                                                      |
| `requireAlignmentProduct()` | `notFound()`                                                                                     | **this is the "never on QuizHub" rule, and it is a capability, not a brand name.** The brand story is the alignment product's; a quiz-only build answering `200` for it is the exact "fifty-two wrong statements" failure `product.quiz-surfaces` exists to stop. Same switch, read from the side that does not ship the quiz catalogue, so the two answers cannot disagree |
| `requireAdmin({ next })`    | signed out → `redirect("/login?next=/admin/brand")`; member → `notFound()`; admin/owner → render | the role gate's three answers, unchanged from every other console page                                                                                                                                                                                                                                                                                                      |

A `notFound()` for a member rather than a 403 is deliberate and documented on `/admin/health`: a
403 confirms the page exists.

**On a tree with no `NEON_AUTH_*` env a request answers the documented 500**
(`NEON_AUTH_BASE_URL is not set`), exactly like `/admin/health`, `/dashboard` and the rest of the
gated set — `currentUser()` builds the auth server outside its `try` on purpose. That is the
expected answer for a fresh clone, not a defect to card, and the gate never issues a request:
`pnpm build` passes with no auth env.

## 4. Metadata — `noindex, nofollow, noarchive`

The mockup carries `<meta name="robots" content="noindex,nofollow,noarchive">`. The page keeps all
three parts, through Next's metadata API:

```ts
export const metadata: Metadata = {
  title: …,
  robots: { index: false, follow: false, noarchive: true },
};
```

If the pinned Next version's `Metadata` type does not carry `noarchive`, the same requirement is
met with `other: { robots: "noindex,nofollow,noarchive" }`. **What is not negotiable is the served
HTML**: the acceptance grep is `noindex` on the response, all three parts present. `noarchive` is
the one that matters most here and the one `/admin/health` does not set — this page is a private
strategy document, and a search engine holding a cached copy of it would outlive the session that
was allowed to read it. `robots` matters behind the gate precisely because a crawler holding an
admin session must not publish the page (`/admin/health`'s docstring makes the same argument for
the build's commit hash).

## 5. Copy — one fixture, budget 0

| Item       | Value                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------- |
| Fixture    | `data/pages/admin-brand.ts`, exporting `adminBrandPageCopy: PageCopy`                          |
| Key        | `"/admin/brand"` in `data/pages/index.ts`                                                      |
| Budget row | `"/admin/brand"` in `data/pages/budget.ts`: `page`, `dirs`, `fixture`, `budget: 0`             |
| Component  | `components/admin/brand-profile.tsx`, in the `components/admin` directory the budget row names |

The `PageCopy` shape (`content/pages.ts`) carries this page with no schema change:

- `eyebrow` — block 1's kicker;
- `heading` — the `h1`, verbatim, with `\n` where the mockup breaks the line;
- `subtitle` — the hero lede;
- `cta` / `secondaryCta` — the two hero actions as `{ label, href }`;
- `sections[]` — five bands, ids `positioning`, `audiences`, `workflow`, `profile-copy`, `closing`,
  each with its own eyebrow as `heading`? No: each band's `h2` is the section `heading`, and its
  eyebrow goes in the band's `items` (below);
- `items[]` — every repeated string that is not a heading: the three value-card labels and bodies,
  the two audience categories and bodies, the counselor note, the participant note, the four steps
  (numeral, lead, sentence), the three copy cards (header label, chip, body), the figure's labels
  (both participant names, both `Private` chips, `Shared report`, the caption), the brand-promise
  strip, and the closing action.

Two rules the fixture must obey:

1. **A fixture is a transcription, never an edit.** If a sentence reads badly while typing it in,
   the sentence is fixed in the canon first, by the owner, in a card that says so. This page is
   proof that the app and the canon say the same thing; a page that "improves" the wording while
   transcribing destroys the only property it has.
2. **Every `href` is root-relative and resolves.** The hero's primary action ("Explore business
   templates") points at the public catalogue, `RELATIONSHIP_TYPES_PATH`
   (`lib/flow/paths.ts:178`, `/relationship-types`) — the mockup's own target is an anchor in the
   home preview, which is a preview artefact, not a route. The secondary action ("Explore personal
   use") points at the `audiences` anchor on this page. E23 checks a fixture `href` against the
   route manifest exactly as E10 checks a literal one, so a link that only exists in the mockup
   fails the build here rather than 404ing in front of an operator.

**Budget 0 means the first literal in the component is a red build.** That is the same ratchet
every other admin surface is on (`/admin/health`, `/admin/instances`), and it is why the figure's
"Participant A" is a fixture item and not a prop default.

**E37 note:** the page is not quiz-gated, so its fixture is inside the brand-word walk. The canon
does not name the template brand and neither may the fixture.

## 6. Token mapping

The mockup is a static preview with its own palette. The page repaints it through the app's token
layer (`lib/brand-theme.ts`, `app/globals.css`, the `tailwind.config.ts` aliases), so it repaints
with the brand:

| Mockup                                                                                      | Token                                                                             | Note                                                                                                               |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `--graphite #37474f` — headings, the closing band, the promise mark                         | `text-foreground`, `bg-foreground` + `text-background` on the band                | no token equals `#37474f`; `foreground` is the legal nearest and it is a token                                     |
| body greys `#59636d`, `#56646b`, `#647178`, `#6a767d`                                       | `text-muted-foreground`                                                           | four greys collapse to one muted role — that collapse is intended                                                  |
| `--mist #f5f7f8`, `--sand` band fills                                                       | `bg-muted`                                                                        |                                                                                                                    |
| `--line #d9e0e3`, plus the hairline `#e2e7e9`                                               | `border-border`                                                                   |                                                                                                                    |
| `--cyan #08add5`, `--cyan-dark #0693b8` — accents, marks, the picked scale dot              | `text-action` / `bg-action`                                                       | through the brand record; the accent is the brand's, never the mockup's hex                                        |
| `--pale-cyan #e5f5fa`, `--pale-green #f0f7e7`                                               | `bg-action/10`, `bg-green-50`                                                     | tints, not roles                                                                                                   |
| `--green #8dc63f` — the participant-B mark, the connector's lower half, the private-bar dot | status hue (`green-*`, outside the brand-token rule)                              | "ready / shared" is a status meaning, and the repo keeps status hues outside the palette rule on purpose           |
| radius `5px` / `8px`                                                                        | `rounded-md` / `rounded-lg` off `--radius: 0.3125rem`                             |                                                                                                                    |
| cards: `1px solid var(--line)`, radius 5, white fill                                        | `Card` — `rounded-lg border bg-card`                                              | **no shadow.** C1 (#715/#722) removed `Card`'s default shadow and the repo treats elevation as a border; see below |
| `--measure: 1160px`                                                                         | `--container-marketing` = `72rem` (1152px, `globals.css:140`)                     | 8px narrower; the container token wins over the mockup's number                                                    |
| type: `h1` `clamp(42px,5vw,64px)/1` · `h2` `clamp(30px,3.7vw,43px)` · body 13px/1.75        | `text-4xl sm:text-5xl lg:text-6xl` · `text-3xl sm:text-4xl` · `text-sm leading-7` | the scale is the app's, not the mockup's clamps                                                                    |

### What the token layer cannot express — named, not invented

These are the six places the mockup draws something the app has no token for. Each is a **declared
divergence**, and the build card must land the divergence rather than a hex value:

1. **The hero gradient.** `linear-gradient(112deg,#f5f7f8 0%,#f5f7f8 55%,#edf6f8 100%)`. Gradients
   live in the token layer (`app/globals.css`), never in a component — that is the rule the brand
   lint enforces by failing `bg-gradient-to-*`. The page draws a flat `bg-muted` hero. A gradient
   token is a change to the token layer and gets its own card.
2. **The two-tone eyebrow rule** (`--cyan` for 68% of a 17px bar, then `--green`) and the
   **connector's cyan→green gradient**. Same class, same answer: flat `bg-action` and a
   `border-action/40` connector. Both are decorative; neither carries meaning the words do not.
3. **The sub-12px type steps.** The mockup's eyebrows are 8–9px and its meta 8px. The app's
   smallest type token is 12px (`text-xs`). The page sets 12px everywhere the mockup sets 8–10 and
   says so here, rather than introducing a 9px step that no other surface has.
4. **The graphite band's exact hue and its `#edf3f4` text.** `bg-foreground text-background` is the
   nearest legal pair. If the owner wants `#37474f` as a role, it is added to the brand record
   (`data/brand.ts` → `lib/brand-theme.ts`), not written in this component.
5. **`box-shadow: 0 15px 42px`** on the mockup's figure, and the shadow on the promise mark. The
   app has no elevation-by-shadow: `Card` is `rounded-lg border bg-card` and a raised surface says
   why it is raised. The figure is drawn as a bordered card with no shadow. This is the mockup's
   one visual behaviour the page deliberately does not copy, and it is copied from the reference
   audit instead, not from taste.
6. **`--header: 68px`** (the mockup's sticky header) and the `.private-bar` 28px strip above it.
   Neither is cloned: the app owns exactly one header (section 7), and the private-draft row above
   the page is the admin notice bar's job (`../banner/README.md`), not a second bar drawn inside
   the page.

## 7. What is not cloned — the preview chrome

The mockup is a standalone document, so it ships a `<head>`, a `site-header` with an on-page anchor
nav and a "View home-page spec" cross-link, a `.private-bar`, a `skip-link`, and a `footer-row`
with the logo and "Back to top". The app already has each of those, once:

| Mockup chrome                                                                            | Why it is not cloned                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<head>` (title, description, `private-bar`)                                             | the app sets metadata; the `noindex` triple moves to `metadata.robots` (section 4)                                                                                                                                              |
| `site-header` and its four anchors (Positioning / Audience / Workflow / Profile copy)    | a page in `(mainlayout)` renders the shell's header; a second header is the "mount a second header" defect the home card (#904) is warned about. The four section `id`s survive, so a link can still reach each band            |
| "View home-page spec" cross-link                                                         | it points at a preview file, not a route; the app's equivalent is `/` itself and needs no announcement                                                                                                                          |
| `.private-bar`                                                                           | the admin notice banner is that row (`../banner/README.md`); two stacked dark rows for one idea is a defect                                                                                                                     |
| `skip-link`                                                                              | the shell's                                                                                                                                                                                                                     |
| `footer-row` (logo, "Private local spec · Product workflow grounded in…", "Back to top") | the app has one footer. Its one transferable sentence — that the wording is grounded in the project brief — moves to the page's `subtitle` region or a `text-xs` provenance line, per the build card; it is not a second footer |

## 8. Files the build card touches

```
app/(mainlayout)/admin/brand/page.tsx          the gate, the metadata, the one read
components/admin/brand-profile.tsx             the sections; receives the fixture as props
data/pages/admin-brand.ts                      the transcription
data/pages/index.ts                            the "/admin/brand" key
data/pages/budget.ts                           the "/admin/brand" row, budget 0
content/routes.ts                              the STATIC_ROUTES entry
```

`components/layout/admin-notice-bar.tsx` and the two group layouts belong to the banner spec, and
that card may land first, second, or in the same PR — but the page does not gate on it: `/admin/brand`
is reachable by URL from the day it lands.

**Template doctrine, the three questions:** (1) the template is `components/legal/legal-page.tsx` —
a long-form prose document rendered inside the shell, with a measure, a title and a section rhythm;
(2) the variation is the section inventory and the fact that four of the five bands are card grids
with a CTA band at the end; (3) nothing new is invented, and the component name carries no brand
noun — `brand-profile` names the document, not the customer.

## 9. Acceptance for the build card

Run, print, paste:

1. **The eleven headings**, extracted from the rendered page in document order, diffed against the
   eleven extracted from `brand-profile/brand-and-audience-profile.html` — no output from the diff.
2. `pnpm data:check` — exit 0, `"/admin/brand"` printed at `0/0 page-copy literals`, warnings still
   **0**.
3. The served HTML's robots content, grepped: `noindex`, `nofollow`, `noarchive` all present.
4. Four renders, one line each: signed-out → `307 /login?next=/admin/brand`; member → `404`;
   admin → `200`; `BRAND=quizhub` + admin → `404` (the `requireAlignmentProduct()` path).
5. `bash scripts/verify.sh` — exit 0, lane `code`, both brand legs; `pnpm parity` unchanged (an
   admin-only page moves no hash, and if one moves, this page leaked into a public render).
6. Screenshots at 1440 / 1024 / 390 with the mockup beside the build, in the PR — the same
   three-viewport rule the home clone is held to. Any band that differs is named and justified
   against section 6, or fixed.

## 10. What this spec does not decide

- **The canon's words.** Editing `AUDIENCE-AND-POSITIONING.md`, the profile HTML or any CSS in this
  package is out of scope by issue #903, and this page must never be the place a wording change
  happens.
- **Publishing.** The page stays behind the console gate; if the owner ever wants a public version,
  that is a marketing surface with its own copy review, not this page with the gate removed.
- **A second entrance.** The banner is the door (`../banner/README.md`). A sidebar row, a console
  card or a "Brand" tab in the admin nav is a separate card, and it would need this page's
  discoverability argument made in it.
- **Editing from the page.** No form, no `lib/admin/act.ts` case, no server action.

---

[← Reference UX patterns](../../ux-reference-patterns.md) — the card, token and type rules this
file assumes.

<!-- docs-nav:begin -->

[Docs hub](../../../README.md) › **Product** › /admin/brand (V2 package) · prev [Admin notice banner (V2 package)](../banner/README.md) · next [AS2 templates redesign (handoff)](../../spec-as2-style-templates-redesign/README.md)

<!-- docs-nav:end -->
