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
];
