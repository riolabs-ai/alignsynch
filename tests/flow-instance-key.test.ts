/**
 * The relationship a create-flow stage is about travels in **one** query parameter (#1216).
 *
 * Stage 4's create answers `303 → …/create/invite?instance=<id>` (`lib/flow/paths.ts::
 * createInviteForPath`), and stage 5 reads the id back to find the relationship that was just
 * written. Two things made that address unreadable:
 *
 *   - **the reader asked a different name.** The #1195 noun sweep renamed the reader's parameter to
 *     `?session=` and left the writer emitting `?instance=`, so stage 5 answered `307 → /create`
 *     (`invite.tsx`'s "no relationship named") on a create that had just succeeded — and because
 *     the create consumes the draft cookie, that landing was an **empty stage 1**. No error, no
 *     message, the flow restarts: the loop the owner reported.
 *   - **the way back named nothing at all.** Stage 5's `Back` pointed at the plain commit path, so
 *     stage 4's "the relationship I already wrote" re-entry (its own docstring's `?instance=`) could
 *     never fire, and `Back` fell through to the same empty stage 1.
 *
 * So the assertions here are about a **pair**, not about two call sites that happen to agree today:
 * the writer and the one reader share `FLOW_RELATIONSHIP_PARAM`, and the two stages that read a
 * relationship off an address go through `relationshipIdFromSearch()` rather than naming a key
 * themselves. A future rename has to pass both, which is exactly what this file is for.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  FLOW_RELATIONSHIP_PARAM,
  createCommitForPath,
  createInviteForPath,
  relationshipIdFromSearch,
} from "@/lib/flow/paths";

const SLUG = "colleagues";
/** A relationship id as the create writes it — a bare uuid, nothing to percent-encode. */
const ID = "5a5c760c-5ba6-45e8-83f7-8bec6972d325";

/** The query object a Next page receives, read off the address the writer built. */
function queryOf(path: string): Record<string, string> {
  return Object.fromEntries(new URL(path, "https://alignsynch.test").searchParams);
}

describe("the relationship a create-flow address names", () => {
  it("round-trips: what the writer writes is what the reader reads", () => {
    const invite = createInviteForPath(SLUG, ID);
    expect([...new URL(invite, "https://alignsynch.test").searchParams.keys()]).toEqual([
      FLOW_RELATIONSHIP_PARAM,
    ]);
    expect(relationshipIdFromSearch(queryOf(invite))).toBe(ID);

    // Stage 5's `Back` names the same relationship, or stage 4 cannot re-enter on it.
    const commit = createCommitForPath(SLUG, ID);
    expect(relationshipIdFromSearch(queryOf(commit))).toBe(ID);
    expect(new URL(commit, "https://alignsynch.test").pathname).toBe(
      `/dashboard/templates/${SLUG}/create/commit`,
    );
  });

  it("percent-encodes an id that is not URL-safe, and still reads it back whole", () => {
    const awkward = "a b+c/d";
    const path = createInviteForPath(SLUG, awkward);
    expect(path).not.toContain("a b+c/d");
    expect(relationshipIdFromSearch(queryOf(path))).toBe(awkward);
  });

  it("takes the first of a repeated parameter and trims it", () => {
    expect(relationshipIdFromSearch({ [FLOW_RELATIONSHIP_PARAM]: [ID, "other"] })).toBe(ID);
    expect(relationshipIdFromSearch({ [FLOW_RELATIONSHIP_PARAM]: ` ${ID} ` })).toBe(ID);
  });

  it("answers empty — never undefined — for an address that names no relationship", () => {
    expect(relationshipIdFromSearch({})).toBe("");
    expect(relationshipIdFromSearch({ [FLOW_RELATIONSHIP_PARAM]: undefined })).toBe("");
  });

  it("is the only way the two stages read it", () => {
    // The guard the loop cost: a stage that names its own key can drift from the writer again.
    for (const file of [
      "components/flow/template-create/invite.tsx",
      "components/flow/template-create/commit.tsx",
    ]) {
      const text = readFileSync(join(process.cwd(), file), "utf8");
      expect(text, `${file} must read the id through relationshipIdFromSearch`).toContain(
        "relationshipIdFromSearch",
      );
      // No stage reaches into the query for a key of its own — `query.session` was the drift.
      expect(text, `${file} must not name a query key itself`).not.toMatch(
        /query\.(?:session|instance)\b/,
      );
    }
  });
});
