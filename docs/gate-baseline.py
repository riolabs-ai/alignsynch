#!/usr/bin/env python3
"""Recompute the gate baseline from CI history (see docs/GATE.md).

Needs an authenticated `gh` (repo read scope). No third-party packages.

    python3 docs/gate-baseline.py                       # the last complete UTC day
    python3 docs/gate-baseline.py --window 2026-11-02   # one UTC calendar day
    python3 docs/gate-baseline.py --since 2026-11-01 --until 2026-11-03   # until is exclusive

The window is applied server-side: every `ci.yml` run whose `created_at` falls inside it,
paged, with no `--limit` cap — so the counts are the window's, not a sample of the newest 100.

Definitions (they are what the numbers in docs/GATE.md mean):

  run incl. queue  updated_at - created_at, per run — what a person waits for.
  job wall         started_at -> completed_at, per job. The two brand legs are the work; the
                   third job (`typecheck / lint / build`, no matrix suffix) is the aggregator
                   the branch ruleset requires, and it costs a few seconds.
  first-pass yield head SHAs whose *first* run (earliest created_at) concluded `success`, over
                   head SHAs that ran at all. `cancelled` is not green, and is reported both
                   ways rather than folded into a pass or a failure.
  p50 / p95        nearest rank on the sorted sample: index ceil(q * n) - 1.
"""

import argparse
import json
import math
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta

REPO = "riolabs-ai/alignsynch"
WORKFLOW = "ci.yml"


def gh(*args: str) -> str:
    return subprocess.run(["gh", *args], capture_output=True, text=True, check=True).stdout


def api(path: str, **params: str) -> dict:
    args = ["api", "-X", "GET", path]
    for key, value in params.items():
        args += ["-f", f"{key}={value}"]
    return json.loads(gh(*args))


def runs(created: str) -> list[dict]:
    path = f"repos/{REPO}/actions/workflows/{WORKFLOW}/runs"
    found: list[dict] = []
    page = 1
    while True:
        data = api(path, created=created, per_page="100", page=str(page))
        found += data["workflow_runs"]
        if len(found) >= data["total_count"] or not data["workflow_runs"]:
            return found
        page += 1


def secs(start: str, end: str) -> float:
    a = datetime.fromisoformat(start.replace("Z", "+00:00"))
    b = datetime.fromisoformat(end.replace("Z", "+00:00"))
    return (b - a).total_seconds()


def pct(values: list[float], q: float) -> float:
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, max(0, math.ceil(q * len(ordered)) - 1))]


def main() -> int:
    yesterday = date.today() - timedelta(days=1)
    parser = argparse.ArgumentParser(description="CI gate baseline (docs/GATE.md)")
    parser.add_argument("--window", help="one UTC calendar day, YYYY-MM-DD (default: yesterday)")
    parser.add_argument("--since", help="window start, YYYY-MM-DD")
    parser.add_argument("--until", help="window end, YYYY-MM-DD, exclusive")
    args = parser.parse_args()

    if args.window:
        since = date.fromisoformat(args.window)
        until = since + timedelta(days=1)
    elif args.since:
        since = date.fromisoformat(args.since)
        until = date.fromisoformat(args.until) if args.until else since + timedelta(days=1)
    else:
        since, until = yesterday, yesterday + timedelta(days=1)

    created = f"{since.isoformat()}T00:00:00Z..{until.isoformat()}T00:00:00Z"
    found = runs(created)
    if not found:
        print(f"no {WORKFLOW} runs in created={created}", file=sys.stderr)
        return 1

    print(f"window: {WORKFLOW} runs created={created}")
    print(f"runs: {len(found)}   head SHAs: {len({r['head_sha'] for r in found})}")

    by_sha: dict[str, list[dict]] = defaultdict(list)
    for run in found:
        by_sha[run["head_sha"]].append(run)
    first = [sorted(group, key=lambda r: r["created_at"])[0] for group in by_sha.values()]
    green = sum(1 for run in first if run["conclusion"] == "success")
    cancelled = sum(1 for run in first if run["conclusion"] == "cancelled")
    print(f"first-run conclusions: {dict(Counter(run['conclusion'] for run in first))}")
    print(f"first-pass yield: {green}/{len(first)} = {100 * green / len(first):.1f}%")
    decided = len(first) - cancelled
    if decided:
        print(f"  excluding cancelled: {green}/{decided} = {100 * green / decided:.1f}%")

    waits = [secs(r["created_at"], r["updated_at"]) for r in found]
    print(
        f"CI run incl. queue: p50 {pct(waits, .5):.0f}s  p95 {pct(waits, .95):.0f}s  (n={len(waits)})"
    )

    legs: dict[str, list[float]] = defaultdict(list)
    for run in found:
        jobs = api(f"repos/{REPO}/actions/runs/{run['id']}/jobs", per_page="100")["jobs"]
        for job in jobs:
            if job["status"] != "completed" or job["conclusion"] == "skipped" or not job["started_at"]:
                continue
            legs[job["name"]].append(secs(job["started_at"], job["completed_at"]))
    print("CI job wall, per leg:")
    for name, values in sorted(legs.items()):
        print(f"  {name:<44} p50 {pct(values, .5):.0f}s  p95 {pct(values, .95):.0f}s  n={len(values)}")

    by_branch: dict[str, list[dict]] = defaultdict(list)
    for run in found:
        by_branch[run["head_branch"]].append(run)
    print(f"runs per branch: {len(found) / len(by_branch):.2f} ({len(found)} runs / {len(by_branch)} branches)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
