# Orchestration rules — how the orchestrator behaves

Companion to `docs/ENV-SPEC.md` (which owns runtime, gates and repo ops). This file owns the
*behaviour* of the orchestrating agent: how it asks, how it queues work, and how it recovers.

## 1. Decisions go in a form, never in prose

Any time the operator must choose, answer, replay, or give an opinion, fire the `clarify` tool —
not a bulleted list in the message body.

- recommended option **first**, at most four choices, every option carries its consequence
- several *independent* questions in **one** call; dependent ones get their own call
- `multi_select` only when the answers are genuinely additive
- free text is always available — never force a choice where "something else" is plausible

In the message that accompanies a form, put the call-out on its own line so it survives a
transcript, a phone screen, or a notification:

```
⚑ YOUR INPUT NEEDED — <one-line question>
```

A prose options list is not a gate. Nothing gets clicked, the work stalls, and the question is
never actually asked.

## 2. Blocked cards carry the question, in a fixed shape

When a worker blocks and needs a human, re-issue its question on the card as:

```
❓ DECISION REQUIRED #<n> — <the question, one line>
WHY:      <what forces the decision>
OPTIONS:  A) … B) … C) …
DEFAULT:  <which one the orchestrator will take if nobody answers>
AFFECTS:  <the cards/PRs/phase this gates>
ANSWER:   hermes kanban comment <task> "<choice>"  →  hermes kanban unblock <task>
```

The `reason` field's **first line** is the question — that is what the board renders. One decision
per block; split multiples. A blocked card never merges anything while blocked.

## 3. Block kinds mean different things — say which

| Kind | Meaning | Must contain |
|---|---|---|
| `needs_input` | the operator's call | a `❓ DECISION REQUIRED` block |
| `capability` | hard wall, workaround applied | `NO ACTION NEEDED —` + the wall |
| `transient` | flaky, will be retried | `NO ACTION NEEDED —` + retry state |
| `dependency` | waiting on a parent | `NO ACTION NEEDED —` + parent id |
| *superseded* | replaced by another card | **archive it**, never block it |

Never leave a `blocked` card with no question in it — `blocked` reads as "waiting on you".

## 4. The board must not idle silently

When the ready/running queues drain, the orchestrator **cards the next wave itself** and reports
what it created. Operator's standing instruction (2026-10-29): keep carding, report, ask only at
scope changes.

Autonomy ends at scope. Ask first for anything that adds a domain, adds a dependency, crosses a
phase gate (P1→P2→P3→P4), or changes repo policy. Everything inside an approved phase is fair game.

## 5. Never put a PR URL in a kanban comment

The dispatcher's respawn guard holds any card **24 h** after a comment containing a PR link
(`_RESPAWN_GUARD_PR_WINDOW = 86400` in `hermes_cli/kanban_db_dispatch.py`), releasing it only on a
handoff to a different profile, `changes_requested`, or `review_reopened`. Re-promoting, editing the
model pin, or dragging to `todo` all stay guarded. **Bodies are not scanned** — put PR links in the
body or the issue. A card frozen this way gets replaced, not nudged.

## 6. After a reboot

The board is durable; worker claims are not. A reboot kills every worker but leaves its claim lock,
so cards still read `running` with nothing behind them and the dispatcher reports `reclaimed: 0`
(it honours the lock, not the pid).

1. `systemctl --user is-active project-manager project-manager-proxy project-manager-refresh.timer hermes-dashboard`
   and check ports `9119`, `9120`, `9122`, `8317`, `9177`. All are `Restart=always` units now.
2. For every card left `running`: `hermes kanban reclaim <id>`, then `hermes kanban dispatch`.
   Do this *before* reading any status, or you will "continue" work no process is doing.
3. The dispatcher lives inside the gateway (60 s tick) and logs
   `kanban dispatcher [alignsynch]: spawned=N …` — use that line to confirm it is alive.
4. Expect `crashed=N auto_blocked=N` on the first post-reboot tick: those are reboot kills, not real
   failures. `hermes kanban unblock <id>` them instead of investigating diffs.

## 7. Model pins are a routing decision, not a preference

Mechanical work (rebases, deletes, retargets, copy moves) runs `deepseek-flash` / low. Verdicts
(review, design, semantic conflicts) run `deepseek-v4-pro` / high. Never switch model mid-task — it
voids the prefix cache that makes a 19-minute worker session cost ~$0.07.

## 8. Report shape

Per finished item: what changed, how it was verified (command + result), what is left. End with
board counts and open-PR count. Claims about merges cite the head sha and the CI conclusion — "it
was green earlier" is not evidence.

## 9. Every card gets its own worktree

Create cards with `--workspace worktree --branch wt/<slug>`. A `scratch` workspace is an **empty
directory**, so the worker falls back to the board's `default_workdir` — the operator's checkout —
and runs `git checkout <its-branch>` there.

That is not cosmetic. It has already cost this repo a day:
`git pull` fails on the operator's tree ("no tracking information"), local gate results are
meaningless because the tree holds someone else's in-progress edits, two writers share one index,
and a `git add -A` can sweep the operator's unrelated change into a card's PR.

Worktree cards spawn at `<repo>/.worktrees/<task-id>` on their own branch, which is real isolation.
Before acting on any status, confirm with `git worktree list` and `git branch --show-current` that
the **primary checkout is on `main`** — if it is on a card branch, a card is violating this rule.
