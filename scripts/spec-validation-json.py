#!/usr/bin/env python3
"""VALIDATION.csv -> data/spec/validation.json — the project spec's register (#1252).

**Run it from the repository root, and never edit the output by hand.** The page reads
`data/spec/validation.json` at request time, and the counts it prints (44 of 76 met, the four
section totals 28 / 20 / 13 / 27, the per-scope meters) are derived from this file — so a hand edit
is a number nobody can regenerate, which is exactly what `data:check` E42 refuses.

    # the register lives outside the repo: it carries one agreement quote per row
    python3 scripts/spec-validation-json.py \\
      ../../project-spec/spec-scope-v2/VALIDATION.csv \\
      data/spec/validation.json

    # `--with-quotes` writes the private file. It is NOT repo-safe: quotes are NDA text, so the
    # private copy is stored outside this tree and `content/spec.ts` refuses it (quote is
    # `z.literal(null)`, quotesIncluded `z.literal(false)`).

**The columns are the CSV's own**, one row per requirement: `section, group, id, check, status,
pdf_pages, agreement_quote, requirement, definition_of_done, v2_today, v2_0_0, rc2, rc3, beta,
evidence, parity, parity_basis, review_pm, review_design, approval_jaden, approval_walt,
next_acceptance, notes`.

**`source.sha256` is the CSV's digest**, so a regenerated file is distinguishable from an edited
one, and the page prints the register it is reading (`<code>data/spec/validation.json</code>`).

`main` is the commit the evidence citations were checked at — the row's `file:line` links are built
from it, so it must be a commit that exists on `origin/main`, never `HEAD` of a working tree.
"""

from __future__ import annotations

import argparse
import csv
import datetime
import hashlib
import json
import pathlib
import sys

DEFAULT_RELEASE = "2.0.0-rc1.2"
DEFAULT_MAIN = "601ce260f"


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("source", type=pathlib.Path, help="the VALIDATION.csv register")
    parser.add_argument("destination", type=pathlib.Path, help="where the JSON is written")
    parser.add_argument("--with-quotes", action="store_true", help="write agreement quotes (private storage only)")
    parser.add_argument("--release", default=DEFAULT_RELEASE, help=f"the register's release label (default {DEFAULT_RELEASE})")
    parser.add_argument("--main", default=DEFAULT_MAIN, help=f"the commit the citations were checked at (default {DEFAULT_MAIN})")
    parser.add_argument("--generated-at", default=None, help="YYYY-MM-DD (default: today, UTC)")
    args = parser.parse_args(argv)

    raw = args.source.read_bytes()
    rows = []
    for record in csv.DictReader(raw.decode("utf-8").splitlines()):
        evidence = [item for item in record["evidence"].split("; ") if item and item != "—"]
        rows.append(
            {
                "id": record["id"],
                "section": record["section"],
                "group": record["group"],
                "check": record["check"],
                "status": record["status"],
                "pdfPages": None if record["pdf_pages"] == "—" else record["pdf_pages"],
                # The quote is NDA text: dropped unless asked for, and a file that carries one is
                # never committed (see the module docstring).
                "quote": (None if record["agreement_quote"] == "—" else record["agreement_quote"])
                if args.with_quotes
                else None,
                "requirement": record["requirement"],
                "definitionOfDone": record["definition_of_done"],
                "today": record["v2_today"],
                "release": {
                    "v200": record["v2_0_0"],
                    "rc2": record["rc2"],
                    "rc3": record["rc3"],
                    "beta": record["beta"],
                },
                # A `.md` citation is a docs page, everything else is a code path with an optional
                # `:line` — the shape the page turns into a link.
                "evidence": [
                    {"kind": "docs" if item.endswith(".md") else "code", "ref": item} for item in evidence
                ],
                "parity": record["parity"],
                "parityBasis": record["parity_basis"],
                "review": {"pm": record["review_pm"], "design": record["review_design"]},
                "approval": {"jaden": record["approval_jaden"], "walt": record["approval_walt"]},
                "next": None if record["next_acceptance"] == "—" else record["next_acceptance"],
                "note": None if record["notes"] == "—" else record["notes"],
            }
        )

    document = {
        "version": 1,
        "release": args.release,
        "main": args.main,
        "generatedAt": args.generated_at or datetime.datetime.now(datetime.UTC).date().isoformat(),
        "source": {"file": args.source.name, "sha256": hashlib.sha256(raw).hexdigest()},
        "quotesIncluded": bool(args.with_quotes),
        "rows": rows,
    }

    args.destination.parent.mkdir(parents=True, exist_ok=True)
    with args.destination.open("w", encoding="utf-8") as handle:
        json.dump(document, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    print(
        f"{len(rows)} rows -> {args.destination} "
        f"(quotes {'IN — private storage only' if args.with_quotes else 'dropped'})"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
