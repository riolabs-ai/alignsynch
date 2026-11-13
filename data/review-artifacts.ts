/**
 * The review artifacts this build publishes (#667, page #665).
 *
 * One authored row per artifact, and the row is the *manifest entry*, not a copy of the file:
 * `path` names the committed page, `version` names which revision the capture is a picture of,
 * and `capturedAt` is the instant the picture was taken. The viewer renders `path`; nothing here
 * holds HTML, so a prototype can be revised ten times without this fixture changing.
 *
 * **Why a fixture and not a row somebody types into a database.** The artifact list is what the
 * product *offers* to review — the same reason `data/assessments.ts` authors the templates and
 * `data/billing-plans.ts` authors the plans. `pnpm db:seed` mirrors this file into
 * `review_artifact`, so editing here is one seed away from the page, and `db:verify` can ask
 * whether the database still says what the file says. Todo items and issues are the opposite
 * kind of fact — people write them at runtime — and they live only in the database.
 *
 * **The first artifact is the prototype the owner asked for**, published beside the docs it
 * describes (`docs/review/artifacts/`) rather than attached to a card, so the manifest points at
 * a versioned file that a scratch cleanup cannot delete. The file itself is #665's; this row is
 * the entry that makes it renderable.
 *
 * `capturedAt` is the day the capture was taken, authored here rather than read from a clock: a
 * fixture that asks the wall clock what time it is renders two different pages on two machines.
 */
import type { ReviewArtifact } from "@/content/review";

export const reviewArtifacts: readonly ReviewArtifact[] = [
  /**
   * v7 — the six stages in the owner's words (#735). v5/v6 drew `Who · Mode · Aspects · Create ·
   * Sent · Ongoing`; the spec in `docs/specs/flow-stages.md` names them `Details · Settings ·
   * Aspects · Invite · Connect · Align`, with Align live only once an assessment is shared and no
   * `Ongoing` at all. Only the stage words and the counter moved: Details keeps the five fields,
   * Back, Close and Continue the artifact already had.
   */
  {
    id: "review-relationship-lifecycle-v7",
    slug: "prototype-relationship-lifecycle-v7",
    title: "Relationship lifecycle prototype",
    kind: "prototype",
    version: "v7",
    path: "docs/review/artifacts/prototype-relationship-lifecycle-v7.html",
    capturedAt: "2026-11-08T00:00:00.000Z",
  },
  {
    id: "review-relationship-lifecycle-v4",
    slug: "prototype-relationship-lifecycle-v4",
    title: "Relationship lifecycle prototype",
    kind: "prototype",
    version: "v4",
    path: "docs/review/artifacts/prototype-relationship-lifecycle-v4.html",
    capturedAt: "2026-11-07T00:00:00.000Z",
  },
  /**
   * #665 — the three earlier cuts, published beside v4 so every version under review is a row
   * rather than a chat screenshot. They are the same series (`version` distinguishes them) and the
   * same day's capture; the viewer groups them by release from `docs/review/artifacts.json`, which
   * is presentation metadata (release + what to look for) and never a second copy of this record.
   */
  {
    id: "review-relationship-lifecycle-v3",
    slug: "prototype-relationship-lifecycle-v3",
    title: "Relationship lifecycle prototype",
    kind: "prototype",
    version: "v3",
    path: "docs/review/artifacts/prototype-relationship-lifecycle-v3.html",
    capturedAt: "2026-11-07T00:00:00.000Z",
  },
  {
    id: "review-relationship-lifecycle-v2",
    slug: "prototype-relationship-lifecycle-v2",
    title: "Relationship lifecycle prototype",
    kind: "prototype",
    version: "v2",
    path: "docs/review/artifacts/prototype-relationship-lifecycle-v2.html",
    capturedAt: "2026-11-07T00:00:00.000Z",
  },
  {
    id: "review-relationship-lifecycle-v1",
    slug: "prototype-relationship-lifecycle-v1",
    title: "Relationship lifecycle prototype",
    kind: "prototype",
    version: "v1",
    path: "docs/review/artifacts/prototype-relationship-lifecycle-v1.html",
    capturedAt: "2026-11-07T00:00:00.000Z",
  },
  /**
   * v5 — **the approved flow.** The ten screens the flow was built from, six of them numbered
   * stages, templates as pre-stage views, the invite account-free with payment a soft prompt at
   * the invite and a hard gate at publish, the account step after the invite stage, and the two
   * priced plans. It supersedes v1–v4 for the next cut; those stay as the record of how the flow
   * got here. Appended rather than prepended so every existing row — and the assertions written
   * around them — keep their place.
   *
   * **The rail's words are the spec's, not this file's.** `docs/specs/flow-stages.md` names the
   * six stages (`Details · Settings · Aspects · Invite · Connect · Align`) and is binding on the
   * build; the artifact keeps the words it was drawn with, because an approved artifact is never
   * edited to match the code. Read the spec for what the build must say.
   */
  {
    id: "review-relationship-lifecycle-v5",
    slug: "prototype-relationship-lifecycle-v5",
    title: "Relationship lifecycle prototype",
    kind: "prototype",
    version: "v5",
    path: "docs/review/artifacts/prototype-relationship-lifecycle-v5.html",
    capturedAt: "2026-11-08T00:00:00.000Z",
  },
  /**
   * v6 — **the flow as a modal** (#708, the approval gate for release #707 / v1.8.0).
   *
   * v5, unchanged, plus four things: the six stages run inside one fullscreen dialog (`Dialog` at
   * >=1024, a full-height `Sheet` at 390) with the six-word rail inside it; the member dashboard the
   * flow closes onto, with the new relationship under My Relationships; the invite-response path in
   * the same shell; and both viewports drawn. The owner's model is untouched — six stages, no
   * seventh, no renames, templates still the pre-stage, the account gate still the step after Create
   * inside the modal, Alignment still dashboard functionality. Appended rather than prepended for
   * the same reason as v5: the rows before it keep their place.
   *
   * `capturedAt` is a distinct instant from v5's. The console lists `ORDER BY captured_at DESC,
   * a.id`, so two rows sharing v5's midnight capture sort v5 first — the newest artifact would be
   * listed under the one it supersedes. It is the capture, not a sort trick: this one was taken
   * that afternoon.
   */
  {
    id: "review-relationship-lifecycle-v6",
    slug: "prototype-relationship-lifecycle-v6",
    title: "Relationship lifecycle prototype",
    kind: "prototype",
    version: "v6",
    path: "docs/review/artifacts/prototype-relationship-lifecycle-v6.html",
    capturedAt: "2026-11-08T18:00:00.000Z",
  },
  /**
   * v8 — the drawing the reference was cut from (#914). v7 named the six stages; v8 is the same
   * series one revision on, and it is kept because a review artifact is a record of what was drawn,
   * never a file that is rewritten when the model moves. It is **history**, not the approved
   * reference: the title says which one a reviewer is looking at, because the row has no field for
   * "superseded" and inventing one would be a second copy of a fact the series already carries.
   */
  {
    id: "review-relationship-lifecycle-v8",
    slug: "prototype-relationship-lifecycle-v8",
    title: "Relationship lifecycle prototype — earlier drawing",
    kind: "prototype",
    version: "v8",
    path: "docs/review/artifacts/prototype-relationship-lifecycle-v8.html",
    capturedAt: "2026-11-11T00:00:00.000Z",
  },
  /**
   * v9 — **the approved visual reference** (owner, 2026-11-12, #914).
   *
   * The file has been committed since #826 while this catalogue, `docs/review/artifacts.json` and
   * the `review_artifact` table all stopped at v7 — so the link the owner reviews against answered
   * 404, and the cards that build to the reference had nothing to point at. The row is the fix, and
   * it is the *only* fix: the HTML is not edited, because an approved artifact is the thing the
   * build is measured against and the build is what moves.
   *
   * The title carries the approval rather than a `status` field. `content/review.ts` deliberately
   * has no lifecycle column for an artifact (a version *is* the series' state, and the shelf groups
   * by release), so "approved" has to be readable in the one string the list draws beside the
   * version — otherwise the newest row is indistinguishable from the drawing it replaced.
   */
  {
    id: "review-relationship-lifecycle-v9",
    slug: "prototype-relationship-lifecycle-v9",
    title: "Relationship lifecycle prototype — approved visual reference",
    kind: "prototype",
    version: "v9",
    path: "docs/review/artifacts/prototype-relationship-lifecycle-v9.html",
    capturedAt: "2026-11-12T00:00:00.000Z",
  },
  /**
   * comments v1 — the mockup for #921, not a feature. Comments on an aspect opinion, an
   * assessment and a relationship: one `Comment` component with the subject as the only
   * variation axis, drawn in two placements (A inline, B side panel) across every state the
   * issue lists, plus the composer's five.
   *
   * The row exists so the artifact is reachable at `?artifact=prototype-comments-v1`, which is
   * the one thing the issue requires of this phase: an approved artifact is the spec of record,
   * and a file nobody can open is not. Nothing in the feature is built here — no schema, no
   * action, no `db/` change — so the catalogue row is the whole of the deliverable beside the
   * drawing itself.
   *
   * The title says which variant the drawing is, because the row has no field for "decision
   * pending" and inventing one would be a second copy of a fact the series already carries.
   */
  {
    id: "review-comments-v1",
    slug: "prototype-comments-v1",
    title: "Comments on opinions, sessions and relationships — mockup, variants A and B",
    kind: "prototype",
    version: "v1",
    path: "docs/review/artifacts/prototype-comments-v1.html",
    capturedAt: "2026-11-12T00:00:00.000Z",
  },
];
