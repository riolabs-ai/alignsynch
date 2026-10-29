#!/usr/bin/env python3
"""Recompute the gate baseline from CI history (see docs/GATE.md).

Needs an authenticated `gh` (repo read scope). No third-party packages.

    python3 docs/gate-baseline.py

Reports: CI job p50/p95, first-pass yield (head SHAs whose first run was green),
retries per PR branch.
"""

import json
import subprocess
from collections import Counter, defaultdict
from datetime import datetime

REPO = "riolabs-ai/alignsynch"


def gh(*args: str) -> str:
    return subprocess.run(["gh", *args], capture_output=True, text=True, check=True).stdout


def secs(start: str, end: str) -> float:
    a = datetime.fromisoformat(start.replace("Z", "+00:00"))
    b = datetime.fromisoformat(end.replace("Z", "+00:00"))
    return (b - a).total_seconds()


runs = json.loads(
    gh(
        "run", "list", "--repo", REPO, "--workflow=ci.yml", "--limit", "100",
        "--json", "databaseId,conclusion,headSha,headBranch,event,createdAt,updatedAt",
    )
)

durations = sorted(secs(r["createdAt"], r["updatedAt"]) for r in runs)


def pct(values: list[float], q: float) -> float:
    return values[min(len(values) - 1, max(0, int(round(q * len(values))) - 1))]


print(f"runs: {len(runs)}  queue+run p50={pct(durations, .5):.0f}s p95={pct(durations, .95):.0f}s")

by_sha: dict[str, list] = defaultdict(list)
for r in runs:
    by_sha[r["headSha"]].append(r)
first = [sorted(rs, key=lambda r: r["createdAt"])[0] for rs in by_sha.values()]
green = sum(1 for r in first if r["conclusion"] == "success")
print(f"first-pass yield: {green}/{len(first)} = {100 * green / len(first):.1f}%")
print(f"first-run conclusions: {dict(Counter(r['conclusion'] for r in first))}")

by_branch: dict[str, list] = defaultdict(list)
for r in runs:
    by_branch[r["headBranch"]].append(r)
retries = (len(runs) - len(by_branch)) / len(by_branch)
print(f"retries per PR branch: {retries:.2f} ({len(runs)} runs / {len(by_branch)} branches)")

job_secs = []
for r in sorted(runs, key=lambda r: r["createdAt"], reverse=True)[:10]:
    for job in json.loads(
        gh("run", "view", str(r["databaseId"]), "--repo", REPO, "--json", "jobs")
    ).get("jobs", []):
        if job.get("conclusion") not in (None, "skipped"):
            job_secs.append(secs(job["startedAt"], job["completedAt"]))
if job_secs:
    job_secs.sort()
    print(
        f"CI job p50={pct(job_secs, .5):.0f}s p95={pct(job_secs, .95):.0f}s (n={len(job_secs)})"
    )
