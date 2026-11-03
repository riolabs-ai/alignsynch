<!--
  #336 — a PR that leaves this blank is not reviewed. `data:check` E35 enforces the header in
  code (every component under `components/` that renders JSX carries one); these three questions
  are the same claim in the place a reviewer reads it, with room to say why.
-->

## 1 · Ancestor

The file this copies — the path, not the idea:

`components/`

## 2 · Variation

What changes against it: the axis (columns, filters, row actions, empty state, detail panel,
data source), and anything a reviewer would otherwise read as a hand-bake.

## 3 · If the ancestor is `none`

Link the approval (issue #336 records them, and `TEMPLATE_ANCESTOR_EXEMPTIONS` in
`scripts/template-ancestor.ts` carries the row). A `none` with no link is the thing this repo is
trying to stop — say which issue approved the surface and why no ancestor exists.

Approval:
