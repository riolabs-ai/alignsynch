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
   * six stages (`Details · Settings · Aspects · Invite · Completed · Align`) and is binding on the
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
];
