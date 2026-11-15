# Release-train card template

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Operations** › Release-train card template · prev [Orchestration rules](orchestration.md) · next [Releasing](releasing.md)

<!-- docs-nav:end -->

```markdown
**DO NOT MERGE** — each child publishes to exact-head green and stops. The lead merges. The version cuts in its own session.

**Wave:** <name> · **Milestone:** <#n> · **Train card:** <id>

## Children

| Card | Issue | Depth | Branch | Files in scope |
| ---- | ----- | ----- | ------ | -------------- |

## Sequence

<collision order: which child must land before which, and why>

## Cutoff

<what must be true before `release_boundary.py` runs: every child merged or dropped, no open PR, tree clean>

## Proof

`bash scripts/verify.sh` · `pnpm release:check` · `bash scripts/release.sh` · `/api/version` prints the tag
```

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Operations** › Release-train card template · prev [Orchestration rules](orchestration.md) · next [Releasing](releasing.md)

<!-- docs-nav:end -->
