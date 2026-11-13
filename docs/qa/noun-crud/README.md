# Templates and relationships are correctable after creation (#711, S4)

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › Templates and relationships after creation · prev [Lockup 2rem](../qa-lockup-2rem/README.md) · next [recharts 3](../qa-recharts-3/README.md)

<!-- docs-nav:end -->

Evidence for the card. The requirement is [issue #711](https://github.com/riolabs-ai/alignsynch/issues/711);
the binding spec for the flow the revision sits in is [`docs/specs/flow-stages.md`](../specs/flow-stages.md).
This page is what the build does when asked for it — the two stills below are the shipped components,
rendered from the branch's own tree at `next start` (production build, node 24), at 1440 and 390.

**How the stills were made, stated plainly.** The console's template editor and the member's edit
panel both need a session, a Postgres row and an admin account, and this worktree carries no
`DATABASE_URL` and the gate must not need one. So the two surfaces were mounted by a throwaway
`app/qa-noun-crud/**` harness — the real components, the real fixtures, real Tailwind, one fixture
state each, no database — captured with headless Chrome at exactly 1440 and 390 CSS px
(`--force-device-scale-factor=1`, image width checked against the file), and the harness was then
deleted. **No product route was added.** What the stills prove is the rendering of the two surfaces
this card changes; what they do not prove is a live write, and that is what the test suite is for
(`tests/admin-template-crud.test.ts`, `tests/admin-template-publish.test.ts`,
`tests/relationship-edit-panel.test.tsx`).

## The revision flow — the retire band

`revision-1440.png`, `revision-390.png` — `/admin/templates/[id]` on a **published** template with
two versions behind it. Below the publish band, the band this card adds:

- the live state (`Offered in the catalogue`) and `Live version 2`;
- **Archive the template** — a status write. Every relationship bound to v1 or v2 keeps reading the
  version it was created from; no version row is touched (`archiveTemplate()`);
- **Delete permanently**, behind the shipped `AlertDialog`, whose title names the template and whose
  body says what is destroyed and when the server refuses. The dialog is a confirmation, not the
  guard: `deleteTemplate()` refuses `template-in-use` when a relationship was created from the
  template and `template-published` when it has any version, and writes nothing when it refuses;
- on an **archived** row the same band draws **Restore the template** instead of Archive, and
  restoring lands on `draft` on purpose — a retired template must be published again to be offered,
  never silently re-offered.

At 390 the band wraps under the publish controls; the delete confirmation is a modal, so it is not
in a still that shows the closed state.

## The edit panel — answered under version 1

`edit-panel-1440.png`, `edit-panel-390.png` — `RelationshipEditPanel` (the same component the member
dashboard and `/admin/instances/[id]` mount) for a relationship **bound to version 1 while version 2
is the live template**. The line under the two locked settings reads `Answered under version 1`.

That line is the card's first acceptance criterion on screen: a revision is publishable and leaves
bound relationships on their original version. `mode` and `Setting` are still printed as facts, not
controls, with the reason they cannot move — `scripts/db-verify.mjs` V18 fails any `UPDATE session`
whose SET list is not the operator's void pair or the deletion sweep's label, so the lock is the
database's, and the panel's `blocked` refusal names it (`mode-fixed`).

## What is asserted where

| Claim                                                                | Where                                               |
| -------------------------------------------------------------------- | --------------------------------------------------- |
| A publish writes `max+1`, supersedes the rest, never re-binds anyone | `tests/admin-template-publish.test.ts`              |
| Archive / restore / delete each leave exactly one audit row          | `tests/admin-template-crud.test.ts`                 |
| A template with a relationship or a version is refused, not deleted  | `tests/admin-template-crud.test.ts`                 |
| `mode`/`setting` stay locked, with a named reason                    | `tests/relationship-edit.test.ts` (#623, unchanged) |
| The panel prints the bound version, pin control or not               | `tests/relationship-edit-panel.test.tsx`            |
| Every flow `href` still resolves, no new surface copy literal        | `pnpm data:check` (E10, E23)                        |

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › Templates and relationships after creation · prev [Lockup 2rem](../qa-lockup-2rem/README.md) · next [recharts 3](../qa-recharts-3/README.md)

<!-- docs-nav:end -->
