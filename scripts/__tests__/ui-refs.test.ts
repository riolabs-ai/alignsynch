/**
 * ui-refs tests — the two spellings of a destination, and the line between them.
 *
 * `data:check` E10 resolves every literal the UI navigates to against `content/routes.ts`. Until
 * #542 phase 2 that meant `href="…"` attributes only, and the file that holds the rail's menu says
 * so: a menu moved into a table of records takes every route reference out of the gate without
 * failing anything. The answer was not to keep the rows in JSX — it was to teach the extractor the
 * property form (`{ href: "/x" }`) and scan the descriptor file by name.
 *
 * So the cases here are the pair that keeps that extension honest:
 *
 *   - a `href:` property **is** a destination, wherever it is written;
 *   - a property that merely ends in `href` (`data-href`, `xhref`) is **not**, and neither is a
 *     `href` key inside a comment's prose — a false positive is a red build on correct code.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SourceFile } from "../ui-refs";
import { findDeadLinks, navigationReferences } from "../ui-refs";

const file = (source: string, path = "lib/menu.ts"): SourceFile => ({ path, source });

const deadIn = (source: string) =>
  findDeadLinks([file(source)], (route) => route === "/dashboard").map((ref) => ref.value);

describe("navigationReferences", () => {
  it("reads an href attribute, in both spellings the tree uses", () => {
    const values = navigationReferences([
      file('<Link href="/dashboard">x</Link>', "components/a.tsx"),
      file('<Link href={"/dashboard"}>x</Link>', "components/b.tsx"),
    ]).map((ref) => ref.value);
    assert.deepEqual(values, ["/dashboard", "/dashboard"]);
  });

  it("reads an href property — the descriptor form (#542 phase 2)", () => {
    const values = navigationReferences([
      file('{ id: "console", href: "/admin/console", icon: "console" }'),
    ]).map((ref) => ref.value);
    assert.deepEqual(values, ["/admin/console"]);
  });

  it("does not read a property that only ends in `href`", () => {
    const values = navigationReferences([
      file('{ "data-href": "/x", xhref: "/y", hrefish: "/z" }'),
    ]).map((ref) => ref.value);
    assert.deepEqual(values, []);
  });

  it("keeps the line of the literal, so the diagnostic is clickable", () => {
    const [ref] = navigationReferences([file('const a = 1;\n{ href: "/dashboard" }')]);
    assert.equal(ref.line, 2);
  });
});

describe("findDeadLinks", () => {
  it("fails a descriptor row the manifest cannot resolve", () => {
    assert.deepEqual(deadIn('{ href: "/nowhere" }'), ["/nowhere"]);
  });

  it("passes a descriptor row that resolves, and passes nothing to report", () => {
    assert.deepEqual(deadIn('{ href: "/dashboard" }'), []);
  });

  it("still ignores what is not a destination — schemes, fragments and templates", () => {
    assert.deepEqual(
      deadIn('{ href: "https://example.com" }\n{ href: "#top" }\n{ href: "/x/${id}" }'),
      [],
    );
  });
});
