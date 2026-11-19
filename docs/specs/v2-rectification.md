# v2 rectification register — every doc's reference, beside the live screen

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Specs & design briefs** › v2 rectification register — every delta, named · prev [v2 coverage matrix — the 23 screens, measured](v2-coverage-matrix.md)

<!-- docs-nav:end -->

**Measured:** 19 November 2026 · **Tree:** `wt/design-audit` at `03e4984` · **Live:** the demo
branch, `demo.alignsynch.com` (`2.0.0-rc1.3`) · **Evidence:** `tests/design-captures/manifest.json`

**Staleness is a column, not a footnote.** Each row prints the `code:` sha its own frontmatter was
written against, and compares it with the tree the capture was taken on: **40 of 51 rows are stale**
— measured at `main @ 601ce26`, which is 21 commits before `03e4984` — and `origin/main` has moved
again since. A verdict against an old sha is a stale verdict, so it is flagged in the row rather than
softened in prose. Re-running `node scripts/design-audit.mjs --capture` after the docs are re-checked
is what clears a flag; editing this page is not.

67 markdown docs under `spec-docs-v2`; **51** of them carry a build status.
Of those, **33** say `· design deltas open` and **not one of them names a
delta**. That is the defect this page ends: the gap was asserted 33 times and
enumerated 0 times, so no card could accept it and nobody could schedule it.

**This page fixes nothing.** It is a register: every row says what the screen draws, what its
reference draws, and — where they differ — the difference in words specific enough to become acceptance
criteria.

## The counts

Two axes, both derived from the docs at run time — never a hardcoded list.

**Status — the word in each doc's frontmatter:**

| status word                        | docs   |
| ---------------------------------- | ------ |
| `· design deltas open`             | 33     |
| `Built` (no delta)                 | 11     |
| `Designed`                         | 4      |
| `Planned`                          | 3      |
| _(local-only / generated / draft)_ | 16     |
| **total docs**                     | **67** |

**Verdict — the register's four words, one per row:**

| verdict        | rows   |
| -------------- | ------ |
| `deltas`       | 33     |
| `matches`      | 6      |
| `not-built`    | 3      |
| `unverifiable` | 9      |
| **total rows** | **51** |

**Where the verdicts move away from the status, and why.** 33 / 11 / 4 / 3 is the status split and
it is exact — the classifier reads the words each doc's frontmatter actually uses, so
`reference/states/… · glossary deltas open` and `Built … · chat does not persist yet` each land in the
bucket whose meaning they carry. The verdict column is not a renaming of it, and the arithmetic
reconciles row for row:

| verdict        | rows | where they come from                                                                                                                                                                                                  |
| -------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deltas`       | 33   | 29 of the 33 `deltas open` + 3 `Designed` copy sheets + 1 `Planned` whose screen in fact renders (`if-a-draft-cant-be-created`)                                                                                       |
| `matches`      | 6    | 5 of the 11 `Built` — `delete-your-account`, `profile-and-password`, `payment`, `invitation`, `release-notes-and-banners` — plus `chat-and-discussion` after this branch (it was the sixth `Built` and read `deltas`) |
| `not-built`    | 3    | 2 `Planned` with no surface (`trial-started`, `plans-and-trial`) + `reference/changelog.md`, a dated list with nothing to build                                                                                       |
| `unverifiable` | 9    | 4 of the 33 `deltas open` + 5 of the 11 `Built`                                                                                                                                                                       |

Five rows therefore do **not** land on the verdict their status word implies, and each is a finding
rather than a filing decision:

- **The three `Designed` copy sheets** (`copy-rules`, `glossary`, `retired-terms`) are counted as
  `deltas`, not `not-built`: they are rules the live copy breaks, and each break below cites a line.
  Counting them `not-built` would have hidden three real findings behind “never built”.
- **`if-a-draft-cant-be-created` is `Planned` and its screen renders** — the status is stale, and the
  one promise the page is missing (**“Nothing was sent and nothing was charged”**) is a `deltas`
  bullet.
- **Five of the 11 `Built` docs are not `matches`.** They draw the thing they describe behind a control
  a capture cannot open — a ⋮ menu, the avatar disclosure, a tab, or an account state the seed cannot
  reach (the seeded instance is already accepted, so the answer sheet renders sealed) — and are
  `unverifiable` with the reason named. A `matches` written off a closed menu is exactly the optimism
  this register exists to end. **`chat-and-discussion` was the sixth and has since been fixed**: its
  panel drew a Discussion heading with no composer, which is a delta and not a plumbing gap, and it
  now reads `matches` on a fresh 390 + 1280 capture.

## How a row was judged

1. **The doc's own promise.** Its _At a Glance_ table and its _For the Build Team_ checklist, quoted
   where the bullet needs it.
2. **The live screen.** `live.txt` — the page's DOM text at 1280 — from the demo branch, signed in as
   the seat that may see it. `landed` under a route is where the navigation actually ended, so a route
   that redirects says so instead of quietly photographing the wrong page.
3. **The reference.** Every bundle ships **the HTML the reference PNGs were photographed from**, so the
   reference's text is exact — `relationship-detail.html?state=live` is the page
   `rd-live-1280.png` is a picture of. `missing.json` per row is the reference's lines that the live
   screen does not carry. Prototype chrome (the state switcher, "PROTOTYPE ONLY"), the reference shell's
   nav labels and the prototype's seed identities (Marcus/Elena) are **excluded**; a difference those
   account for is not claimed.
4. **The pairing** — `side-by-side.png` for 35 rows: the live capture and the reference render at
   1280, one image, for a person to read. 185 images and 35 pairings were written.

**What this register does not measure.** It is text and structure, not pixels: it can say "the reference
draws a trial chip and the live header does not", and it cannot say "the chip is the wrong grey". A
claim that needs the eye is marked `unverifiable` with that reason and the PNGs are on disk. It also
measures one state per screen — the state the seed is in — not every state the bundles draw.

## The register

| doc                                                       | title                                | status                                                                                      | route                                                                                                                                                                            | bundle reference                                                                      | doc checked at                                                                      | verdict        | deltas       | issue               |
| --------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------- | ------------ | ------------------- |
| `guides/account/account-menu.md`                          | Account Menu                         | Built (#1152 via #1170)                                                                     | `/dashboard` <br>↳ `/dashboard`                                                                                                                                                  | `11-spec-design-page-account-settings-v2/reference/account-menu-1280.png`             | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `unverifiable` | reason below | #1136               |
| `guides/account/delete-your-account.md`                   | Delete Your Account                  | Built (#1163, lib/account/purge.ts)                                                         | `/settings` <br>↳ `/settings`                                                                                                                                                    | —                                                                                     | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `matches`      | —            | #1163               |
| `guides/account/profile-and-password.md`                  | Profile and Password                 | Built (#1152 via #1170) · bundle refresh open (#1233)                                       | `/settings` <br>↳ `/settings`                                                                                                                                                    | —                                                                                     | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `matches`      | —            | #1136, #1233        |
| `guides/admin/crud-and-permissions.md`                    | CRUD & Permissions                   | Built (#1157, #1179) · design deltas open                                                   | `/admin/permissions` <br>↳ `/admin/permissions`                                                                                                                                  | `12-spec-design-page-admin-crud-matrix-v2`                                            | —                                                                                   | `deltas`       | 3 named      | —                   |
| `guides/admin/email-templates.md`                         | Email Templates                      | Built (#1167) · design deltas open (#1231, PR #1242)                                        | `/admin/email-templates` <br>↳ `/admin/email-templates`                                                                                                                          | `spec-design-v2-rc1.3-bundle/09-admin-email-templates-1231`                           | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 2 named      | #1138, #1231        |
| `guides/admin/who-sees-the-admin-rail.md`                 | Who Sees the Admin Rail              | Built (#1157, #1167, nav-menu.json)                                                         | `/admin/permissions` <br>↳ `/admin/permissions`                                                                                                                                  | —                                                                                     | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `unverifiable` | reason below | #1126, #1138        |
| `guides/counterparty/accept-or-decline-an-invite.md`      | Accept or Decline an Invite          | Built (#1147) · design deltas open                                                          | `/invite/{token}`                                                                                                                                                                | `02-spec-design-page-onboarding-v2/reference/join-*`                                  | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `unverifiable` | reason below | #1125               |
| `guides/counterparty/ask-to-be-removed.md`                | Ask to Be Removed                    | Built (#1149 via #1170) · no shot                                                           | `/dashboard/relationships/{relationship}` <br>↳ `/dashboard/relationships/relationship-assessment-instance-avery-rowan-flat`                                                     | —                                                                                     | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `unverifiable` | reason below | —                   |
| `guides/counterparty/save-these-aspects-as-a-template.md` | Save These Aspects as a Template     | Built (#1153 via #1170) · design deltas open                                                | `/dashboard/relationships/{review}?tab=aspects` <br>↳ `/dashboard/relationships/relationship-assessment-instance-rowan-avery-review?tab=aspects`                                 | `03-spec-design-page-relationship-detail-v2/reference/rd-live-aspects-counterparty-*` | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 2 named      | #1134               |
| `guides/counterparty/when-a-relationship-pauses.md`       | When a Relationship Pauses           | Built (#1143, #1236) · design deltas open                                                   | `/dashboard/relationships/{trial}` <br>↳ `/dashboard/relationships/relationship-assessment-instance-avery-rowan-trial`                                                           | `03-spec-design-page-relationship-detail-v2/reference`                                | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 3 named      | #1224, #1223        |
| `guides/initiator/add-a-card-or-take-your-extra-week.md`  | Add a Card or Take Your Extra Week   | Built (#1143, #1156 via #1170) · design deltas open                                         | `/dashboard/relationships/{trial}?tab=payment` <br>↳ `/dashboard/relationships/relationship-assessment-instance-avery-rowan-trial?tab=payment`                                   | `03-spec-design-page-relationship-detail-v2/reference`                                | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 2 named      | #1121, #1132        |
| `guides/initiator/copy-resend-or-cancel-an-invite.md`     | Copy, Resend or Cancel an Invite     | Built (#1149 via #1170) · design deltas open                                                | `/dashboard/relationships/{summer}` <br>↳ `/dashboard/relationships/relationship-assessment-instance-avery-rowan-summer`                                                         | `03-spec-design-page-relationship-detail-v2/reference/rd-invited-details-*,`          | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 3 named      | #1135               |
| `guides/initiator/create-your-account.md`                 | Create Your Account                  | Built (#1144, #1190) · design deltas open                                                   | `/dashboard/templates/{wizardTemplate}/create/commit?instance={draftInstance}` <br>↳ `/dashboard/templates/friends/create/commit?instance=assessment-instance-avery-rowan-trial` | `01-spec-design-page-wizard-v2/reference/wizard-stage4-*`                             | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 3 named      | #1123, #1187        |
| `guides/initiator/edit-a-draft-or-sent-invite.md`         | Edit a Draft or Sent Invite          | Built (#1144, #1148) · design deltas open                                                   | `/dashboard/relationships/{flat}` <br>↳ `/dashboard/relationships/relationship-assessment-instance-avery-rowan-flat`                                                             | `01-spec-design-page-wizard-v2/reference/wizard-edit-invited-*`                       | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 2 named      | —                   |
| `guides/initiator/if-a-draft-cant-be-created.md`          | If a Draft Can't Be Created          | Planned (#1226) · #1210 shipped a named 500 without this screen                             | `/assessment/new/failed` <br>↳ `/assessment/new/failed`                                                                                                                          | `spec-design-v2-rc1.3-bundle/04-create-failed-screen-1226/reference`                  | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 3 named      | #1226, #1205        |
| `guides/initiator/my-relationships-and-start.md`          | My Relationships and Start           | Built (#1150 via #1170) · design deltas open                                                | `/dashboard` <br>↳ `/dashboard`                                                                                                                                                  | `05-spec-design-page-start-my-relationships-v2/reference`                             | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 3 named      | #1129               |
| `guides/initiator/my-templates.md`                        | My Templates                         | Built (#1151, #1153 via #1170) · design deltas open                                         | `/dashboard/templates?tab=mine` <br>↳ `/dashboard/templates?tab=mine`                                                                                                            | `06-spec-design-page-templates-v2/reference`                                          | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 2 named      | #1130, #1134        |
| `guides/initiator/payment.md`                             | Payment                              | Built (#1156 via #1170) · Planned: Basic-only price (PR #1241), per-plan price line (#1230) | `/dashboard/payment` <br>↳ `/dashboard/payment`                                                                                                                                  | `08-spec-design-page-payment-v2/reference`                                            | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `matches`      | —            | #1132, #1230        |
| `guides/initiator/pick-a-template.md`                     | Pick a Template                      | Built (#1170, via #1159 / #1127) · design deltas open                                       | `/relationship-templates` <br>↳ `/relationship-templates`                                                                                                                        | `02-spec-design-page-onboarding-v2/reference`                                         | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 3 named      | #1127               |
| `guides/initiator/send-the-invite.md`                     | Send the Invite                      | Built (#1144, #1217) · design deltas open                                                   | `/dashboard/templates/{wizardTemplate}/create/invite?instance={draftInstance}` <br>↳ `/dashboard/templates/friends/create/invite?instance=assessment-instance-avery-rowan-trial` | `01-spec-design-page-wizard-v2/reference/wizard-stage5-*`                             | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 3 named      | #1123, #1115, #1216 |
| `guides/initiator/set-up-details-settings-and-aspects.md` | Set Up Details, Settings and Aspects | Built (#1144, drawer via #1170 / #1133) · design deltas open                                | `/dashboard/templates/{template}/create` <br>↳ `/dashboard/templates/brother-sister/create`                                                                                      | `01-spec-design-page-wizard-v2/reference`                                             | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 3 named      | #1123, #1133        |
| `guides/initiator/when-a-relationship-pauses.md`          | When a Relationship Pauses           | Built (#1143, #1235, #1236) · design deltas open                                            | `/dashboard/relationships/{trial}` <br>↳ `/dashboard/relationships/relationship-assessment-instance-avery-rowan-trial`                                                           | `03-spec-design-page-relationship-detail-v2/reference`                                | —                                                                                   | `deltas`       | 3 named      | —                   |
| `guides/initiator/your-7-days-free.md`                    | Your 7 Days Free                     | Built (#1116, #1117, #1156 via #1170) · design deltas open                                  | `/dashboard/relationships/{trial}?tab=payment` <br>↳ `/dashboard/relationships/relationship-assessment-instance-avery-rowan-trial?tab=payment`                                   | `03-spec-design-page-relationship-detail-v2/reference/rd-live-payment-*`              | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 3 named      | #1115, #1132        |
| `guides/shared/answer-the-assessment.md`                  | Answer the Assessment                | Built (#1173, #1235) · design deltas open                                                   | `/assessment/instances/{instance}/answer` <br>↳ `/assessment/instances/assessment-instance-avery-rowan/answer`                                                                   | `10-spec-design-page-assessment-v2/reference`                                         | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 3 named      | #1128, #1223        |
| `guides/shared/chat-and-discussion.md`                    | Chat and Discussion                  | Built (#1154 via #1170) · chat does not persist yet                                         | `/dashboard/relationships/{relationship}?tab=discussion` <br>↳ `/dashboard/relationships/relationship-assessment-instance-avery-rowan-flat?tab=discussion`                       | `07-spec-design-page-chat-v2/reference`                                               | **fresh** — captured on this branch at 390 + 1280 · **unverified for counterparty** | `matches`      | —            | #1131, #1188        |
| `guides/shared/leave-a-relationship.md`                   | Leave a Relationship                 | Built (#1149 via #1170) · no shot                                                           | `/dashboard/relationships/{closed}` <br>↳ `/dashboard/relationships/relationship-assessment-instance-avery-rowan`                                                                | —                                                                                     | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `unverifiable` | reason below | —                   |
| `guides/shared/propose-a-change.md`                       | Propose a Change                     | Built (#1155 via #1170) · design deltas open                                                | `/dashboard/relationships/{relationship}?tab=aspects` <br>↳ `/dashboard/relationships/relationship-assessment-instance-avery-rowan-flat?tab=aspects`                             | `03-spec-design-page-relationship-detail-v2/reference/modal-propose-*,`               | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `unverifiable` | reason below | #1133               |
| `guides/shared/results-and-align.md`                      | Results and Align                    | Built (#1145, #1148) · design deltas open                                                   | `/dashboard/relationships/{relationship}` <br>↳ `/dashboard/relationships/relationship-assessment-instance-avery-rowan-flat`                                                     | `04-spec-design-page-align-v2/reference`                                              | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 3 named      | #1122, #1124        |
| `reference/changelog.md`                                  | Changelog                            | Designed                                                                                    | —                                                                                                                                                                                | —                                                                                     | —                                                                                   | `not-built`    | —            | —                   |
| `reference/copy/copy-rules.md`                            | Copy Rules                           | Designed                                                                                    | —                                                                                                                                                                                | —                                                                                     | —                                                                                   | `deltas`       | 3 named      | —                   |
| `reference/copy/glossary.md`                              | Glossary                             | Designed                                                                                    | —                                                                                                                                                                                | —                                                                                     | `docs/glossary.md (repo)`                                                           | `deltas`       | 2 named      | —                   |
| `reference/copy/retired-terms.md`                         | Retired Terms                        | Designed                                                                                    | —                                                                                                                                                                                | —                                                                                     | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 2 named      | —                   |
| `reference/emails/counterparty-joined.md`                 | Counterparty Joined Email            | Built · design deltas open (#1227, PR #1240)                                                | —                                                                                                                                                                                | `spec-design-v2-rc1.3-bundle/05-email-counterparty-joined-1227`                       | `lib/email/templates/counterparty-joined.ts`                                        | `deltas`       | 2 named      | —                   |
| `reference/emails/invitation.md`                          | Invitation Email                     | Built                                                                                       | —                                                                                                                                                                                | —                                                                                     | `lib/email/templates/invitation.ts · content/email-bodies.md`                       | `matches`      | —            | —                   |
| `reference/emails/paused-counterparty.md`                 | Paused Email (Counterparty)          | Built (#1168) · design deltas open                                                          | —                                                                                                                                                                                | —                                                                                     | `lib/email/templates/relationship-paused.ts`                                        | `deltas`       | 2 named      | #1139               |
| `reference/emails/paused-initiator.md`                    | Paused Email (Initiator)             | Built (#1168) · design deltas open                                                          | —                                                                                                                                                                                | —                                                                                     | `lib/email/templates/trial-ended-paused.ts`                                         | `deltas`       | 2 named      | #1139               |
| `reference/emails/release-notes-and-banners.md`           | Release Notes and Banners            | Built (#1177, #1193)                                                                        | —                                                                                                                                                                                | —                                                                                     | —                                                                                   | `matches`      | —            | —                   |
| `reference/emails/trial-started.md`                       | Trial Started Line                   | Planned (PR #1240)                                                                          | —                                                                                                                                                                                | `spec-design-v2-rc1.3-bundle/05-email-counterparty-joined-1227`                       | —                                                                                   | `not-built`    | —            | #1227               |
| `reference/stages/stage-1-details.md`                     | Stage 1 · Details                    | Built (#1144) · design deltas open                                                          | `/dashboard/templates/{template}/create` <br>↳ `/dashboard/templates/brother-sister/create`                                                                                      | `01-spec-design-page-wizard-v2/reference`                                             | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 3 named      | —                   |
| `reference/stages/stage-2-settings.md`                    | Stage 2 · Settings                   | Built (#1144) · design deltas open                                                          | `/dashboard/templates/{template}/create/mode` <br>↳ `/dashboard/templates/brother-sister/create/mode`                                                                            | `01-spec-design-page-wizard-v2/reference`                                             | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 3 named      | —                   |
| `reference/stages/stage-3-aspects.md`                     | Stage 3 · Aspects                    | Built (#1144) · design deltas open                                                          | `/dashboard/templates/{template}/create/aspects` <br>↳ `/dashboard/templates/brother-sister/create/aspects`                                                                      | `01-spec-design-page-wizard-v2/reference`                                             | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `unverifiable` | reason below | —                   |
| `reference/stages/stage-4-account.md`                     | Stage 4 · Account                    | Built (#1144) · design deltas open                                                          | `/dashboard/templates/{wizardTemplate}/create/commit?instance={draftInstance}` <br>↳ `/dashboard/templates/friends/create/commit?instance=assessment-instance-avery-rowan-trial` | `01-spec-design-page-wizard-v2/reference`                                             | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 3 named      | —                   |
| `reference/stages/stage-5-invite.md`                      | Stage 5 · Invite                     | Built (#1144) · design deltas open                                                          | `/dashboard/templates/{wizardTemplate}/create/invite?instance={draftInstance}` <br>↳ `/dashboard/templates/friends/create/invite?instance=assessment-instance-avery-rowan-trial` | `01-spec-design-page-wizard-v2/reference`                                             | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 3 named      | —                   |
| `reference/stages/stage-6-align.md`                       | Stage 6 · Align                      | Built (#1144, #1147, #1148) · design deltas open                                            | `/dashboard/relationships/{relationship}` <br>↳ `/dashboard/relationships/relationship-assessment-instance-avery-rowan-flat`                                                     | `03-spec-design-page-relationship-detail-v2/reference`                                | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 2 named      | —                   |
| `reference/states/answer-scale.md`                        | The Answer Scale                     | Built (#1173)                                                                               | `/assessment/instances/{instance}/answer` <br>↳ `/assessment/instances/assessment-instance-avery-rowan/answer`                                                                   | —                                                                                     | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `unverifiable` | reason below | —                   |
| `reference/states/relationship-states-by-role.md`         | Relationship States by Role          | Built (#1148, #1143) · design deltas open                                                   | `/dashboard/relationships` <br>↳ `/dashboard/relationships`                                                                                                                      | —                                                                                     | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 2 named      | —                   |
| `reference/states/status-chips.md`                        | Status Chips                         | Built (#1145, #1150) · design deltas open                                                   | `/dashboard/relationships/{relationship}` <br>↳ `/dashboard/relationships/relationship-assessment-instance-avery-rowan-flat`                                                     | `09-spec-design-system-tokens-v2/reference/patterns-1280.png`                         | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `unverifiable` | reason below | —                   |
| `start/core-concepts.md`                                  | Core Concepts                        | Built (v2.0.0-rc1.2) · glossary deltas open                                                 | `/how-it-works` <br>↳ `/how-it-works`                                                                                                                                            | `09-spec-design-system-tokens-v2/reference`                                           | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 2 named      | —                   |
| `start/plans-and-trial.md`                                | Plans and the Free Trial             | Planned (Basic only: PR #1241) · trial Built (#1116, #1117, #1143)                          | `/pricing` <br>↳ `/pricing`                                                                                                                                                      | `08-spec-design-page-payment-v2/reference`                                            | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `not-built`    | —            | —                   |
| `start/quickstart.md`                                     | Quickstart                           | Built (#1144, #1147, #1173, #1145) · design deltas open                                     | `/dashboard` <br>↳ `/dashboard`                                                                                                                                                  | `01-spec-design-page-wizard-v2/reference`                                             | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 2 named      | —                   |
| `start/what-is-alignsynch.md`                             | What Is AlignSynch                   | Built (v2.0.0-rc1.2 on main) · design deltas open per guide                                 | `/` <br>↳ `/`                                                                                                                                                                    | `02-spec-design-page-onboarding-v2/reference`                                         | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 2 named      | —                   |

## The deltas, named — one bullet per difference a card can accept

Every bullet names the line the reference or the doc draws and the capture that does not carry it.

### `guides/admin/crud-and-permissions.md`

CRUD & Permissions · Built (#1157, #1179) · design deltas open · route `/admin/permissions`

- The reference's row-count line is **"Showing 18 of 169 Rows"** and the page's own copy is **"Pass 10 snapshot · 34 P0 · 23 P1 · 29 P2 · 15 Won't · 2 P0 still open"**; the live page prints `169 Rows` with no "Showing N of M" filter line and none of the P0/P1/P2 breakdown — live `tests/design-captures/admin-crud-and-permissions/live.txt`, reference `spec-design-v2-bundles/12-spec-design-page-admin-crud-matrix-v2/admin-crud-matrix.html`.
- The reference's six **"Rules Every #1119 Child Must Honour"** are absent from the live page: it opens on **Role × Action Rules** and names the epic, and carries none of the six rule sentences (not even the archive-over-delete one) — the doc's §1 "the top of the page repeats the six rules" is not drawn.
- The reference's **Status** and **Priority** filters and its **Conflicts and Decisions** block do not appear in the live text; the live filters it does print are Object, Role and Upstream.

### `guides/admin/email-templates.md`

Email Templates · Built (#1167) · design deltas open (#1231, PR #1242) · route `/admin/email-templates`

- The doc promises **"Save as Draft, then Publish"** and a **Preview** with sample data; the live page text carries the register, its Status column and "Open", and no `Draft`, `Publish` or `Preview` control — live `tests/design-captures/admin-email-templates/live.txt`.
- No reference render exists to pair: rc1.3 bundle 09 (`09-admin-email-templates-1231`) ships only `README.md` and `IMPLEMENTATION-PROMPT.md`. The doc's own frontmatter points at that directory, so the row cannot be paired even by hand.

### `guides/counterparty/save-these-aspects-as-a-template.md`

Save These Aspects as a Template · Built (#1153 via #1170) · design deltas open · route `/dashboard/relationships/{review}?tab=aspects`

- The doc's section heading is **"Keep these Aspects for yourself"** and its action is Title Case **"Save this template to My Templates"**; the live page draws both, but as sentence-case body copy rather than the reference's headed section — copy rule 1 (Title Case for every label, heading and button) is the open delta — live `tests/design-captures/counterparty-save-these-aspects-as-a-template/live.txt`, doc `guides/counterparty/save-these-aspects-as-a-template.md` §For the Build Team.
- The reference draws the relationship's **At a Glance** summary above the tabs ("3 of 5 Aspects Aligned · 1 In Synch · 2 Small Gap · 2 Gap"); the live page at 1280 draws none of it — reference `spec-design-v2-bundles/03-spec-design-page-relationship-detail-v2/relationship-detail.html`.

### `guides/counterparty/when-a-relationship-pauses.md`

When a Relationship Pauses · Built (#1143, #1236) · design deltas open · route `/dashboard/relationships/{trial}`

- The badge the doc promises — **"⏸ Paused · Waiting on Marcus"**, grey with a pause icon and no red — is drawn live as **"Paused · Waiting on Avery"**, so the shape is right and only the name moves; that part **matches**.
- The reference's **"At a Glance"** panel (Mode · Alignment Tolerance · Latest Round · 3 of 5 Aspects Aligned) is absent from the live page, which draws a flat STATE/STARTED/PUBLISHED/INVITED/CONNECTION/MEMBERSHIP metadata card instead — live `tests/design-captures/counterparty-when-a-relationship-pauses/live.txt`.
- The reference's next-step band for this state reads **"Your Trial Ended"** with **"Add a Card"** and **"Get 7 More Days Free"**; the counterparty's live page draws no next-step band at all, which is right for the seat (the Counterparty never sees billing words) but means the reference draws the Initiator's band on the Counterparty's screen — a reference defect, recorded rather than copied.

### `guides/initiator/add-a-card-or-take-your-extra-week.md`

Add a Card or Take Your Extra Week · Built (#1143, #1156 via #1170) · design deltas open · route `/dashboard/relationships/{trial}?tab=payment`

- The doc's confirmation copy **"7 More Days Added · Stage 6 is running again"** is absent from the live page: the buttons **Add a Card** and **Get 7 More Days Free** are both drawn, and the confirmation the doc cites (`data/pages/dashboard-relationship-detail.ts:262`) is not rendered at rest — live `tests/design-captures/initiator-add-a-card-or-take-your-extra-week/live.txt`.
- The reference's **Payment tab** summary — Status, the date the trial ended, the one Extra Week still available, the price after resume and who pays — is absent: the live page draws "Your Trial Ended" and the two actions, and no such table.

### `guides/initiator/copy-resend-or-cancel-an-invite.md`

Copy, Resend or Cancel an Invite · Built (#1149 via #1170) · design deltas open · route `/dashboard/relationships/{summer}`

- The doc's two actions — **"Copy Invite Link"** and **"Resend Invite"** — are absent from the live page at rest; the page draws the STATE/INVITED/CONNECTION/MEMBERSHIP card and the Aspects prose instead — live `tests/design-captures/initiator-copy-resend-or-cancel-an-invite/live.txt`.
- The reference draws the waiting state as **"Waiting on Elena to Join · Invitation sent to `elena.r@example.com` on Nov 16"** with a **Share the Invite Link** next step and a **Copy Invite Link** control; the live page's equivalent is a **STATE · Complete** line, so the waiting-invite state is not the state the seeded relationship is in — the row is measured against a completed relationship, and the delta is that the state the doc describes could not be reproduced from the seed.
- The reference's **"Trial Starts When Elena Accepts"** marker is absent from the live capture.

### `guides/initiator/create-your-account.md`

Create Your Account · Built (#1144, #1190) · design deltas open · route `/dashboard/templates/{wizardTemplate}/create/commit?instance={draftInstance}`

- The heading is the Title Case breach the doc itself flags: the live stage 4 renders **"Create your account"** where the doc's At a Glance says **Create Your Account** — live `tests/design-captures/initiator-create-your-account/live.txt`, source `data/pages/assessment-create.ts:363`.
- The doc's advance control **"Continue to Stage 5"** and its body **"Your answers stay on this device until you sign in."** are both drawn — those **match**.
- The live page carries a paragraph the doc does not describe: **"The relationship exists as a draft. The account it belongs to is the one you are signed in with."** — the doc still describes signing up as what writes the draft.

### `guides/initiator/edit-a-draft-or-sent-invite.md`

Edit a Draft or Sent Invite · Built (#1144, #1148) · design deltas open · route `/dashboard/relationships/{flat}`

- The doc promises **"Continue Setup"** on a draft card and **"Edit this relationship"** on a sent invite; the live page draws **Next Step · Continue Your Assessment** with **5 of 5 Aspects answered** and neither of the doc's two controls — live `tests/design-captures/initiator-edit-a-draft-or-sent-invite/live.txt`.
- The reference's draft state draws **"Waiting on Invite · Elena hasn't been invited yet. Only you can see this relationship."** with **Send Invitation**; the live relationship at this address is a completed one, so the draft state was not photographed — the delta is drawn from the page's own copy, not from the reference's state.

### `guides/initiator/if-a-draft-cant-be-created.md`

If a Draft Can't Be Created · Planned (#1226) · #1210 shipped a named 500 without this screen · route `/assessment/new/failed`

- The screen is drawn: `/assessment/new/failed` heads **"Couldn't Create This Draft"** and offers **Try Again** and **Back to Dashboard**, which is the doc's first two promises — live `tests/design-captures/initiator-if-a-draft-cant-be-created/live.txt`.
- The doc's third promise — **"Nothing was sent and nothing was charged"** — is absent from the page text, and it is the sentence the doc says exists so the person knows the failure cost them nothing.
- The doc's status says `Planned` (issue #1226) while the screen renders; the status is stale, and that is a second, cheap finding on this row.

### `guides/initiator/my-relationships-and-start.md`

My Relationships and Start · Built (#1150 via #1170) · design deltas open · route `/dashboard`

- The doc's **"Your Next Steps"** heading is drawn, and its second job **"Finish and Send the Invite"** is not: the live Start page shows **2 to do** with one Next Step and one **Add a Card to Resume**, and no draft job — live `tests/design-captures/initiator-my-relationships-and-start/live.txt`.
- The doc's filter row is **"All · Live · Waiting · Drafts · Paused"**; the live list draws **Newest | All | 5 | Stage 6 Live | 3 | Waiting on Invite | 1 …** — three of the doc's five filter words (Waiting, Drafts, Paused) are absent and the live set carries counts the doc does not mention.
- The reference's Start band reads **"One thing to talk about, and two small jobs."** with **3 to do**; the live page reads **"Your relationships, and what is next for each."** with **2 to do** — a different headline and a different count.

### `guides/initiator/my-templates.md`

My Templates · Built (#1151, #1153 via #1170) · design deltas open · route `/dashboard/templates?tab=mine`

- The doc's card-menu actions — **"Edit"**, **"Duplicate"**, **"Archive"** — and the Library's **"Save a Copy"** are all absent from the live page text, which draws **Library | 29 | My Templates | 0** and an empty state — live `tests/design-captures/initiator-my-templates/live.txt`.
- The reference draws a populated My Templates grid (**"My Copy · Brother–Sister · Our Version"**, **"2 Edited"**, **"Used in 1"**); the live page draws **No Templates Yet**. The grid cannot be judged from an empty account, so the card-menu delta above is the only one this row claims.

### `guides/initiator/pick-a-template.md`

Pick a Template · Built (#1170, via #1159 / #1127) · design deltas open · route `/relationship-templates`

- The doc promises **Categories** and a **Create Relationship** action on each template page; the live catalog draws a **Family | Couples | Friends | Work** filter row instead of the reference's category grouping, and its per-template action is a link into the wizard rather than a button labelled **Create Relationship** — live `tests/design-captures/initiator-pick-a-template/live.txt`.
- The reference's worked example (**"EXAMPLE · BROTHER–SISTER · Parent Decisions · 1 · Avoided or fought · 5 · Shared and agreed"**) is drawn live as **"EXAMPLE · STAFF–MANAGER"**, a different template: the example slot is live but does not follow the doc's own subject.
- The doc's opening promise that each template page lists **every Aspect with its left (1) and right (5) labels** is not drawn on the catalog; it is drawn on the template page, which this row does not capture.

### `guides/initiator/send-the-invite.md`

Send the Invite · Built (#1144, #1217) · design deltas open · route `/dashboard/templates/{wizardTemplate}/create/invite?instance={draftInstance}`

- The doc's primary action **"Continue with 7 Days Free"** is absent: the live stage 5 draws **Next** and **Continue as Draft** — live `tests/design-captures/initiator-send-the-invite/live.txt`.
- The doc's trial anchor is contradicted on the page: the doc says the 7 days start **when the person accepts**, and the live page says **"The plan is active and the card is on file. Nothing has been charged today — the trial starts when the card is saved."** — a card anchor and a `Thank you` block the doc does not mention.
- **Continue as Draft** _is_ drawn and matches the doc; the **What Elena Sees** preview the doc tells the reader to check is absent, replaced by **What you can do later**.

### `guides/initiator/set-up-details-settings-and-aspects.md`

Set Up Details, Settings and Aspects · Built (#1144, drawer via #1170 / #1133) · design deltas open · route `/dashboard/templates/{template}/create`

- The doc's rail vocabulary — **Done · In Progress · Up Next · Later** — is absent from the live stage-1 page, which draws **STAGE 1 OF 5 · DETAILS** and no per-stage state word — live `tests/design-captures/initiator-set-up-details-settings-and-aspects/live.txt`.
- Stage 2's **Opinions Mode** and **Alignment Setting** are not at this address (they are `/create/mode`); the capture is stage 1 by design, so the stage-2 half of this doc is judged on the `reference/stages/stage-2-settings.md` row instead.
- The doc's stage-1 field inventory (title, both first names, their email, an optional description) **matches** the live page's form exactly — that part is not a delta.

### `guides/initiator/when-a-relationship-pauses.md`

When a Relationship Pauses · Built (#1143, #1235, #1236) · design deltas open · route `/dashboard/relationships/{trial}`

- The doc promises the line **"Stage 6 is paused. Your results and Discussion are saved and read-only."**; the live page draws exactly that sentence — **matches**.
- The doc promises the Paused chip with a pause icon and no red; the live page draws **Paused** and **Your Trial Ended** in text, and the icon is not legible in the DOM text, so the "no red, grey with a pause icon" half is **unverifiable** from a capture — it needs the pixels, which are on disk at `tests/design-captures/initiator-when-a-relationship-pauses/live-1280.png`.
- The reference's At a Glance panel (3 of 5 Aspects Aligned · Mode · Alignment Tolerance · Latest Round) is absent from the live page, which draws the flat STATE/STARTED/PUBLISHED metadata card instead.

### `guides/initiator/your-7-days-free.md`

Your 7 Days Free · Built (#1116, #1117, #1156 via #1170) · design deltas open · route `/dashboard/relationships/{trial}?tab=payment`

- The doc's trial markers — **"Free Trial · 3 Days Left"**, **"Trial Starts When {name} Accepts"** and **"Not needed"** — are all absent from the live relationship page at 1280 — live `tests/design-captures/initiator-your-7-days-free/live.txt`.
- The reference draws the trial chip **"Trial · 3 Days Left"** in the relationship header and the sentence **"Add a card before Nov 19 to keep Stage 6 running."** in the Payment tab; the live page draws **"Your Trial Ended"** only, which is the post-pause state, not the running trial the doc describes.
- The doc's Payment-tab claim — **"Trial Starts When {name} Accepts"** and **"Card: Not needed"** for a waiting invite — is absent from the capture, which photographed the paused relationship.

### `guides/shared/answer-the-assessment.md`

Answer the Assessment · Built (#1173, #1235) · design deltas open · route `/assessment/instances/{instance}/answer`

- The doc promises the progress line **"Round 1 · Aspect 2 of 5"** and the save chip **"Saves as You Go"**; the live answer sheet is the **sealed** state (**"You have accepted this session, so your answers are sealed"**, **"This sheet is the record"**) and carries neither — live `tests/design-captures/shared-answer-the-assessment/live.txt`.
- The reference draws **"ROUND 1 · ASPECT 1 OF 5"**, **"Saved just now"**, the two 1–5 rows (**Feel / How it is now**, **Wish / How you want it**) and **"Next Aspect"**; none of those is on the live page, because the seeded instance is already answered.
- Scope: the answering state is unreachable on the demo seed from the Initiator's seat, so this row's delta is the _sealed_ screen's copy, and the answering screen itself is **unverifiable** until a fresh invite can be walked end to end.

### `guides/shared/chat-and-discussion.md`

Chat and Discussion · Built (#1154 via #1170) · chat does not persist yet · route `/dashboard/relationships/{relationship}?tab=discussion`

**Both deltas are fixed on this branch and the row reads `matches`.** Captured at 390 and 1280 against the demo branch at `relationship-assessment-instance-avery-rowan-flat?tab=discussion` (the one demo relationship still running — `relationship-assessment-instance-avery-rowan` is `complete`, so its Discussion is read-only by design and cannot photograph a composer). The fixed screen carries, in the panel: **Add a Comment** (the composer's label), **Message Rowan** (its placeholder), **Tag an Aspect** with one option per Aspect plus **No Aspect**, **Send**, and the three demo messages as comment cards with their author, seat, timestamp (`Wed 07:02 PM`) and the Aspect each was tagged with. Pasting the fixed capture's text beside the reference's leaves 24 lines the live panel does not carry, and every one of them belongs to `/dashboard/chat` rather than to this tab — the `Chat` heading, the conversation list with its three seeded titles and unread badges, the search field and the prototype bar. That is the second surface of the same thread, not a missing piece of this one.

- ~~The doc promises a composer with **"Message {name}"**, **"Tag an Aspect"** and **"Send"**; the live Discussion panel draws **"Relationship Discussion"**, **"One thread for the two of you, beside the Aspects you are answering."** and **"Nothing has been said here yet."** — no composer, no Send, no tag control — live `tests/design-captures/shared-chat-and-discussion/live.txt`.~~ **Fixed** — the panel draws the composer: `data-discussion-composer`, a `<textarea>` whose placeholder is the doc's **Message {name}** filled from the relationship, a `<select>` labelled **Tag an Aspect** (one option per Aspect plus **No Aspect**) and a **Send** button. The two sentences the doc did not promise stay — the heading and the one-line body are the panel's own, and the empty state still appears when the relationship has no messages.
- ~~The reference draws a threaded conversation with timestamps, an **Add a Comment** box and a **Tag an Aspect** selector; the live panel draws none of the three.~~ **Fixed** — the thread renders as comment cards (`data-discussion-message`), each with the author's mark, their seat chip, a `<time>` label formatted from the fixture instant, the body, and the Aspect chip when the message was tagged. The composer's label is **Add a Comment** and its selector is the Aspect one above.
- **The two states that must not write are pinned, not assumed.** A waiting relationship (invitation unclaimed) draws the waiting sentence and no composer; a paused one draws the read-only band; a `complete`/`void` relationship keeps its Discussion readable and stops taking messages (`data-discussion-read-only`). `tests/discussion-tab.test.tsx` drives all three plus the live case.
- **Roles, named:** the capture is the Initiator's seat at both widths. The panel renders from the relationship's own seats, so the same fixture reads for the Counterparty with their own messages marked **You** and the placeholder naming Avery — and `tests/discussion-tab.test.tsx` pins that reading — but the Counterparty was not captured, so this row carries `unverified for counterparty` beside its `matches` rather than claiming both seats.
- **Still true, and not a delta:** chat does not persist yet. A message composed here joins this session's list and is written nowhere; the thread model is #921's and it has no schema. The panel says so in its own docstring and the fixture says so in the copy's comment — the same limit `/dashboard/chat` carries.

### `guides/shared/results-and-align.md`

Results and Align · Built (#1145, #1148) · design deltas open · route `/dashboard/relationships/{relationship}`

- The doc's three status words — **In Synch**, **Small Gap**, **Gap** — are absent from the live relationship page at 1280, as is any Aspect tally — live `tests/design-captures/shared-results-and-align/live.txt`.
- The page's Next Step band says **"Next Step · Continue Your Assessment"** and **"5 of 5 Aspects answered"** even though all five are answered, and the action that would open the results is a separate **Complete and open the Gap** control — the doc's _"When you've both answered, Align puts your answers side by side"_ is not the state the page is in.
- The reference draws **"Where You Agree, and Where You Differ"**, **"3 of 5 Aspects Aligned · 1 In Synch · 2 Small Gap · 2 Gap"** and a **NEXT STEP · Talk About Parent Decisions** band with **Start the Conversation**; none of those lines is on the live page — reference `spec-design-v2-bundles/04-spec-design-page-align-v2/align.html`.

### `reference/copy/copy-rules.md`

Copy Rules · Designed · route `—`

- Rule 1 (**Title Case**) is broken live: `data/pages/assessment-create.ts:406` still carries the label **"send email to counterparty now"**, and the doc names that exact line as the example that breaks the rule.
- Rule 5 (**say "Stage 6", never "Align is paused"**) is broken live: `lib/relationship/membership.ts:459` returns **"…, so Align is paused."**, and two email subjects carry it — `lib/email/templates/relationship-paused.ts:42` **"Align is paused for now"** and `lib/email/templates/trial-ended-paused.ts:46` **"Your trial ended — Align is paused"**.
- Rule 3 (**no red**) and rule 2 (**status is icon plus word**) cannot be judged from DOM text: they are pixel and semantics claims, so they are **unverifiable** here and need the captures on disk to be read by a person.

### `reference/copy/glossary.md`

Glossary · Designed · route `—`

- The glossary's write-it-as column says **Assessment** where v1 said quiz, and **Relationship** where v1 said session; the live answer sheet still says **"You have accepted this session"** and **"this session sealed"** — live `tests/design-captures/shared-answer-the-assessment/live.txt`, source `data/pages/assessment-accept.ts:28`.
- The glossary's **Extra Week** entry is contradicted in code: `lib/relationship/pause.ts:46` exports **`EXTENSION_DAYS`**, the word the glossary retires — the doc names that line itself.

### `reference/copy/retired-terms.md`

Retired Terms · Designed · route `—`

- The retired term **session** survives in live copy: **"Review and accept this session"** (`data/pages/assessment-accept.ts:28`), **"Accept this session"** (`:59`) and the answer sheet's **"this session sealed"** in `tests/design-captures/shared-answer-the-assessment/live.txt`.
- The retired phrase **"Align is paused"** survives in `lib/relationship/membership.ts:459`, which is the line the doc quotes as its own evidence.

### `reference/emails/counterparty-joined.md`

Counterparty Joined Email · Built · design deltas open (#1227, PR #1240) · route `—`

- The doc's evidence line has moved: it cites `content/email-bodies.md:91` for **"left. Your trial has started, and it runs from the day the invitation was accepted."**, and line 91 now reads **"The invitation has been claimed: that seat belongs to {{joiner}} now, and the answering is what is left."** — the sentence the doc quotes is in no line of the file.
- The delta the doc asserts (the trial stated on every send) is therefore closed and its citation is stale, which is the opposite of what the row's `design deltas open` status claims. The subject is live as documented: `lib/email/templates/counterparty-joined.ts:54` **"{joiner} joined — your assessment can start"**.

### `reference/emails/paused-counterparty.md`

Paused Email (Counterparty) · Built (#1168) · design deltas open · route `—`

- Copy rule 5 says **say "Stage 6", never "Align is paused"**; the live subject is `lib/email/templates/relationship-paused.ts:42` **"Align is paused for now"** and the body is `content/email-bodies.md:125` **"Align is paused for now; you'll hear when it resumes."** — the retired phrase on both surfaces.
- The doc's own "At a Glance" promises the Counterparty learns **Stage 6** is on hold; the word "Stage 6" appears in neither the subject nor the body.

### `reference/emails/paused-initiator.md`

Paused Email (Initiator) · Built (#1168) · design deltas open · route `—`

- The live subject is `lib/email/templates/trial-ended-paused.ts:46` **"Your trial ended — Align is paused"** and the body is `content/email-bodies.md:118` **"Align is paused on {{template}}. Nothing was deleted…"** — both use the phrase copy rule 5 retires in favour of **Stage 6**.
- The doc promises the mail says **nothing is lost** and **how to resume**; the body says the first and carries no resume instruction, which the reference's two actions (**Add a Card**, **Get 7 More Days Free**) would supply.

### `reference/stages/stage-1-details.md`

Stage 1 · Details · Built (#1144) · design deltas open · route `/dashboard/templates/{template}/create`

- The reference heads the stage **"Name Your Relationship"** and asks for **Relationship Title**, **Your Shared Goal** and **Your Role** ("I'm the Brother"); the live stage 1 heads it **"Relationship Details"** and asks for title, both first names, an email and a description — live `tests/design-captures/stages-stage-1-details/live.txt`.
- The reference's advance control is **"Continue to Settings"**; the live one is **"Continue to Stage 2"**. The live label is the one `docs/specs/flow-stages.md` pins, so the reference is the side that is stale — recorded, not followed.
- The reference draws **"Stage 6 Align starts when Elena joins"**; the live rail draws **"Stage 6 Align starts when they join"** — the same sentence with the seed's name removed. That is a name difference, not a design delta, and is not counted.

### `reference/stages/stage-2-settings.md`

Stage 2 · Settings · Built (#1144) · design deltas open · route `/dashboard/templates/{template}/create/mode`

- The doc's **Opinions Mode** and **Alignment Setting** labels are both drawn live, and so are the four option words (**Basic Mode**, **Advanced Mode**, **Soft**, **Full**) — those **match**.
- The reference heads the stage **"Choose How You Compare"** with the sub-line **"Two choices. The defaults suit most first rounds."**; the live stage 2 heads it **"Relationship Settings"** with **"Two independent choices: Mode decides how many Opinion questions each Aspect asks, and Setting decides how strictly the Gap analysis is judged."** — a different heading and a different sentence.
- The live page carries **"Opinions Mode · Fixed at creation"**, which the reference does not draw: a field-state the doc does not describe.

### `reference/stages/stage-4-account.md`

Stage 4 · Account · Built (#1144) · design deltas open · route `/dashboard/templates/{wizardTemplate}/create/commit?instance={draftInstance}`

- Heading case: the doc and `docs/specs/flow-stages.md` say **Create Your Account**, and the live stage 4 renders **"Create your account"** — copy rule 1, Title Case for every label and heading — live `tests/design-captures/stages-stage-4-account/live.txt`, source `data/pages/assessment-create.ts:363`.
- The doc's advance control is **"Continue to Stage 5"** and it is drawn — that part **matches**; so does the doc's body sentence **"Your answers stay on this device until you sign in."**
- The live page adds a paragraph the doc does not describe — **"The relationship exists as a draft. The account it belongs to is the one you are signed in with."** — which is #825's draft-write behaviour arriving on a screen whose doc still describes signing up mid-flow.

### `reference/stages/stage-5-invite.md`

Stage 5 · Invite · Built (#1144) · design deltas open · route `/dashboard/templates/{wizardTemplate}/create/invite?instance={draftInstance}`

- The doc's primary action is **"Continue with 7 Days Free"**; the live page's primaries are **Next** and **Continue as Draft**, and **Continue with 7 Days Free** appears nowhere in the page text — live `tests/design-captures/stages-stage-5-invite/live.txt`.
- The doc's whole reason for that label is the anchor: _"the trial starts when Elena accepts"_. The live page states the opposite — **"The plan is active and the card is on file. Nothing has been charged today — the trial starts when the card is saved."** The trial is anchored on the **card**, not on the acceptance, and that is the single highest-value delta in this register.
- The reference draws the **What Elena Sees** preview panel; the live page draws **What you can do later** and no invitee-facing preview.

### `reference/stages/stage-6-align.md`

Stage 6 · Align · Built (#1144, #1147, #1148) · design deltas open · route `/dashboard/relationships/{relationship}`

- The reference draws Stage 6 as **"Where You Agree, and Where You Differ"** with **In Synch / Small Gap / Gap** chips and a **NEXT STEP** band; the live relationship page draws **Next Step · Continue Your Assessment**, **5 of 5 Aspects answered** and a **Complete and open the Gap** button, and no chips — live `tests/design-captures/stages-stage-6-align/live.txt`.
- The reference's **"Align stays live until the relationship closes"** is not drawn; the live page instead states **"Once both of you have answered every Aspect and accepted the other's answers, completing opens the Gap to both of you."** — the same idea in a sentence the doc does not quote.

### `reference/states/relationship-states-by-role.md`

Relationship States by Role · Built (#1148, #1143) · design deltas open · route `/dashboard/relationships`

- The doc's state vocabulary is **Draft · Invite Sent · Both Joined · Waiting for {name} · Results In · Trial Ended · Extra Week Ended**; the live list draws **Stage 6 Live · Waiting on Invite · Draft · Paused** with counts — different words for overlapping states — live `tests/design-captures/states-relationship-states-by-role/live.txt`.
- Two of the doc's seven states (**Results In**, **Extra Week Ended**) have no live chip at all in the captured list.

### `start/core-concepts.md`

Core Concepts · Built (v2.0.0-rc1.2) · glossary deltas open · route `/how-it-works`

- The doc's concepts are **Stage 6**, **Extra Week**, **Gap** and **Aspect**; the public `/how-it-works` page draws **"One relationship, six moves"** and walks the create flow screen by screen, and its text carries `Gap` but neither **Extra Week** nor a Stage 6 explanation — live `tests/design-captures/start-core-concepts/live.txt`.
- The reference this row is paired with (onboarding bundle, `relationship-templates.html`) is not the page `/how-it-works` replaces — no bundle draws `/how-it-works`, which is why the pairing is a vocabulary comparison and not a screen comparison.

### `start/quickstart.md`

Quickstart · Built (#1144, #1147, #1173, #1145) · design deltas open · route `/dashboard`

- The doc's path starts at **Your Next Steps**; the live `/dashboard` draws it with **2 to do** and one Next Step, and the doc's second job **Finish and Send the Invite** is absent — live `tests/design-captures/start-quickstart/live.txt`.
- The reference's Start band reads **"One thing to talk about, and two small jobs."** with **3 to do**; the live headline is **"Your relationships, and what is next for each."** — the same delta as the `my-relationships-and-start` row, because it is the same screen.

### `start/what-is-alignsynch.md`

What Is AlignSynch · Built (v2.0.0-rc1.2 on main) · design deltas open per guide · route `/`

- The doc's public explainer is the marketing home; the live `/` opens **"For business and corporate relationships"** with **"Explore business templates"**, and its text carries no **In Synch** or **Gap** explainer — live `tests/design-captures/start-what-is-alignsynch/live.txt`.
- No bundle draws `/`; the pair for this row is the pricing/onboarding bundle, so the vocabulary comparison above is the only claim made.

## Matches — the doc's promise is drawn

A match is a comparison that was made, not a row nobody looked at.

- **`guides/account/delete-your-account.md`** — Live `/settings` draws **Delete Account** and the confirm phrase **"delete my account"**, both of which the doc's At a Glance promises; nothing in the doc's two rows is missing from the page text.
- **`guides/account/profile-and-password.md`** — Live `/settings` draws **Profile**, **Display Name**, **Profile URL**, **Save Profile** and the read-only email line the doc describes. The reference's five extra lines are First/Last Name and Current Password, which are the _prototype's_ field set — the doc already says the bundle 11 render is stale, so the reference is the side that moved.
- **`guides/initiator/payment.md`** — Live `/dashboard/payment` draws **Memberships**, **Payment Method**, **After the Trial** and **$9.99 / month** — the four things the doc's two rows promise — and its preamble repeats the doc's own trial sentence.
- **`reference/emails/invitation.md`** — No screen to capture: the subject is `lib/email/templates/invitation.ts:42` **"{inviter} invited you to a {template} assessment"**, which is the sentence the doc quotes, and the reminder subject is `lib/email/templates/invitation-reminder.ts:60`. Verified in source, which is where this doc's subject lives.
- **`reference/emails/release-notes-and-banners.md`** — No screen to capture: `public/og/` holds the three rasters and `lib/email/release-note.ts:64` reads the changelog section, both as the doc states. Verified in source.

## Not built — the surface the doc describes does not exist

Two are `Planned` in their own frontmatter and have no surface at all; the third is a dated list.

- **`reference/changelog.md`** — A dated list of what changed, not a screen: there is nothing to capture and nothing to build. `not-built` here means _no surface_, which is the honest reading of a `Designed` status on a changelog.
- **`reference/emails/trial-started.md`** — Planned (PR #1240). There is no template file to compare: the line the doc describes does not exist in `lib/email/templates/`.
- **`start/plans-and-trial.md`** — Planned (PR #1241): the per-plan price line and the Basic-only plan are not built. The live `/pricing` draws **Basic · 1 relationship · $9.99 / month** and **Test mode: the card checkout runs on test keys**, while the reference still draws **Single**, **Family** and **Single Annual** — the reference is a generation behind the one-plan decision and the planned line is what would close it.

## Unverifiable — and the exact reason

These are rows a capture cannot judge. Naming the reason is the deliverable; a guess would be the defect.

- **`guides/account/account-menu.md`** — The menu is a disclosure behind the avatar. The page at rest carries neither **Account Settings** nor **Sign Out** (they are inside the closed disclosure), so the harness cannot judge them without opening it — and an optimistic `matches` off a closed menu is exactly the optimism this register exists to end.
- **`guides/admin/who-sees-the-admin-rail.md`** — The rail renders as icons at 1280 and collapses to a drawer at 390; the page text carries neither row name (**CRUD & Permissions**, **Email Templates**), so the by-seat claim cannot be judged from a capture. Judging it needs three signed-in seats and a pixel comparison, not a DOM read.
- **`guides/counterparty/accept-or-decline-an-invite.md`** — Needs a live `/invite/{token}`. The demo seed does not publish its waiting invite's token outside the Initiator's copy-link control, so the harness recorded the route as unresolved rather than photographing **"No such invitation"** and calling it the join screen.
- **`guides/counterparty/ask-to-be-removed.md`** — **Leave Relationship**, **Request My Removal** and **Close This Relationship** are all inside the relationship's ⋮ menu and its dialog. The capture is the page at rest, so none of the three appears in its text — a missing delta would be a guess, and the doc itself says there is no render of this flow to pair it with.
- **`guides/shared/leave-a-relationship.md`** — Same reason as `ask-to-be-removed`: the flow is a menu item and a confirm dialog, the capture is the list at rest, and the doc says _"no shot: there is no bundle, QA, spec or prototype render of the leave flow"_. The seeded relationship at this address has in fact been left — the page draws **"This relationship is closed"** — but the dialog that got it there is not capturable this way.
- **`guides/shared/propose-a-change.md`** — The lock copy (**"Aspects are Locked"**, **"Changes are proposed and agreed by both of you."**) and the propose control live on the **Aspects** tab, and the tab is client state with no address: `?tab=aspects` renders the Discussion panel, which is what the capture holds. A delta taken from it would describe the wrong panel.
- **`reference/stages/stage-3-aspects.md`** — Stage 3's own address answers `307 → /create` on every seeded instance, and the flow cannot be driven past stage 2 headlessly: stage 2's advance control is inert until a Mode/Setting choice is recorded, and the harness does not make product choices on a reader's behalf. The row carries **no reference render** on purpose — pairing stage 3's reference with a stage-2 screenshot would be the guess this register exists to avoid.
- **`reference/states/answer-scale.md`** — The 1–5 scale and its two labels are drawn by the _answering_ sheet, and the seeded instance is already accepted, so the capture is the sealed/review sheet. The scale is `unverifiable` until a fresh invite is walked to the answering step.
- **`reference/states/status-chips.md`** — The doc's chip words (**In Synch · Small Gap · Gap**) are drawn by the Aspects/Align panel, which the capture cannot open — `?tab=` is client state, so every tab URL renders the Discussion panel. The page does draw chips (**Paused**, **Your Trial Ended**, **Complete**), so the primitive is live; three of the doc's four words are simply not on this panel.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Specs & design briefs** › v2 rectification register — every delta, named · prev [v2 coverage matrix — the 23 screens, measured](v2-coverage-matrix.md)

<!-- docs-nav:end -->
