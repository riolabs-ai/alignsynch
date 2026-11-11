# IA v2 — four operator groups with submenus (stills)

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › IA v2 — four operator groups · prev [Home hero polish](../qa-home-polish/README.md) · next [Lockup 2rem](../qa-lockup-2rem/README.md)

<!-- docs-nav:end -->

Card: kanban `t_7d8282d3`, issue **#731**. The review artifact at `/admin/review/ia` on branch
`feat/app-ia`, revised to the owner's feedback: the member rail keeps its approved patterns, and
operator work reduces to **four groups** — Users · Templates · Billing · System — each a main item
whose pages are its submenu. `/admin/console` is no longer a destination; its pages are those
submenus.

Captured from a **local dev server of the branch** (`next dev --turbo`, demo env), driven by
headless Chrome over the DevTools protocol: `Emulation.setDeviceMetricsOverride` per width and
`Page.captureScreenshot`, with `Runtime.evaluate` reading the numbers back **before each shutter**.
Port 3000 and the operator's review worktree were not touched.

## What each still is

The **current** capture (`fcaf19ef`, port 4317) is the `ia-v2-*` set; it is the one
`capture-report.json` beside it describes, number for number.

| File                                    | Viewport  | What it shows                                                                                   |
| --------------------------------------- | --------- | ----------------------------------------------------------------------------------------------- |
| `ia-v2-1440.png`                        | 1440×5992 | the whole revised screen, full page: heading, the rail band, every group with Templates open    |
| `ia-v2-390.png`                         | 390×8944  | the same screen at phone width, full page                                                       |
| `ia-v2-templates-submenu-clip-1440.png` | 257×416   | **the Templates group, expanded** — its seven submenu rows, including the two authoring actions |
| `ia-v2-templates-submenu-clip-390.png`  | 353×416   | the same crop at phone width                                                                    |

The **first** capture (`8659e9d5`, port 3100) is kept as the earlier evidence: it frames the screen
at viewport height rather than full page, so the diff table below the fold is not in it.

| File                       | Viewport | What it shows                                                                                   |
| -------------------------- | -------- | ----------------------------------------------------------------------------------------------- |
| `ia-1440.png`              | 1440×900 | the revised screen, from the top: heading, the rail band, the diff table                        |
| `ia-390.png`               | 390×844  | the same screen at phone width                                                                  |
| `templates-group-1440.png` | 348×408  | **the Templates group, expanded** — its seven submenu rows, including the two authoring actions |
| `templates-group-390.png`  | 348×408  | the same crop at phone width                                                                    |

The crop is taken from a full-page capture and cut at the group's measured rectangle, because
`Page.captureScreenshot` with a `clip` returned a blank frame for a region below the fold (both with
and without `captureBeyondViewport`).

`capture-report.json`'s `file` fields name the workspace the capture ran in
(`.worktrees/t_b8bb102c`), not this directory; the bytes are the same PNGs.

## Asserts made before every shutter

| Check                           | 1440                                                                                           | 390        |
| ------------------------------- | ---------------------------------------------------------------------------------------------- | ---------- |
| `innerWidth` == requested       | 1440                                                                                           | 390        |
| `scrollWidth` == `innerWidth`   | 1440 — no horizontal overflow                                                                  | 390 — none |
| heading present                 | "Four operator groups, and one console inside them"                                            | same       |
| Templates group `aria-expanded` | `true`                                                                                         | `true`     |
| Templates submenu element       | present                                                                                        | present    |
| proposed rows inside Templates  | `template-clone`, `template-publish`                                                           | same       |
| Templates anchors               | `/admin/templates`, `/admin/console/templates`, `/admin/review`, `/templates/relationship/new` | same       |
| Templates buttons               | `Clone → draft`, `Publish revision`                                                            | same       |
| an anchor to `/admin/console`   | none                                                                                           | none       |

The last four rows are the acceptance criteria photographed: the group names create / clone /
publish-revision, the two proposed actions are **buttons**, and the console hub is not a link
anywhere. `/templates/relationship/new` is the address authoring moved to in #794;
`/assessment/templates/new` is only a `308` to it and the rail does not draw it.

## The session the stills were taken in

The demo branch has no `demo_account` rows — its `db:seed` refuses because the branch holds
assessment rows the seed does not author — so the `/login` role buttons cannot sign anyone in. The
session is a throwaway account created through the app's own `POST /api/auth/sign-up/email`, promoted
by the **allowlist path** on its first session read (`grantAdminIfAllowlisted()` against a local
`ADMIN_EMAILS`), which is the same code that promotes an operator in production. No SQL, no hand-set
role, no credential in a shell.

## Related

- [UI-MAPPING.md](../UI-MAPPING.md) — the surface map `/admin/review/ia` is a variation of.
- [ui-registry.md](../ui-registry.md) — the route and what it draws.
- [ux-reference-patterns.md](../specs/ux-reference-patterns.md) — the stills the pattern was read from.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › IA v2 — four operator groups · prev [Home hero polish](../qa-home-polish/README.md) · next [Lockup 2rem](../qa-lockup-2rem/README.md)

<!-- docs-nav:end -->
