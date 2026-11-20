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

**This page fixes nothing by itself.** It is a register: every row says what the screen draws, what its
reference draws, and — where they differ — the difference in words specific enough to become acceptance
criteria. A rectification card fixes one bundle and flips the rows it closed; those bullets then read
`Fixed (rect-NN)` and the row's verdict is the capture's, not the card's claim.

**Nine rows have since been worked, in `wt/rect-nonpage`.** Each bullet they carry is now marked in
place: `Fixed` (the delta is closed, with the line that closes it), `Open` (still a delta, with the
reason it is not this card's), or `Unverifiable` (a pixels claim, with where a person reads it). Four
rows moved to `matches`, one to `unverifiable`, and the counts below are the post-fix ones. A row only
reads `matches` when the thing it promises was found — in source for the three emails, whose subject
and body are code, and on the rendered page for the create-failed screen.

## The counts

Two axes, both derived from the docs at run time — never a hardcoded list.

**Status — the word in each doc's frontmatter:**

| status word                        | docs   |
| ---------------------------------- | ------ |
| `· design deltas open`             | 30     |
| `Built` (no delta)                 | 15     |
| `Designed`                         | 4      |
| `Planned`                          | 2      |
| _(local-only / generated / draft)_ | 16     |
| **total docs**                     | **67** |

**Verdict — the register's four words, one per row:**

| verdict        | rows   |
| -------------- | ------ |
| `deltas`       | 25     |
| `matches`      | 10     |
| `not-built`    | 3      |
| `unverifiable` | 13     |
| **total rows** | **51** |

**`rect-03` moved two rows** (2026-11-19) to `unverifiable`: `copy-resend-or-cancel-an-invite`,
because the seed at that address is a claimed invite and the controls it names live behind an unclaimed
one, and `add-a-card-or-take-your-extra-week`, because its remaining bullet lives on the **Payment tab**
and the tab set is client state the instrument does not open. Four more `deltas open` rows were
**fixed and re-captured** — `save-these-aspects-as-a-template`, both relationship-pause rows and
`stage-6-align` — and their bullets read `Fixed (rect-03)` with the captured text quoted, but their
verdict stays `deltas`: the status word lives in the doc's own frontmatter under `spec-docs-v2`, and
`--check` refuses `matches` over a doc that still says `· design deltas open`. Clearing that word is a
docs-intake act, not one this register can perform on its own row. `your-7-days-free` stays `deltas`
too: a paused window has no days left to count, so the trial chip cannot be photographed from this seed.
The counts above are the post-`rect-03` figures, read off the table below rather than restated.

**Where the verdicts move away from the status, and why.** 30 / 15 / 4 / 2 is the status split and
it is exact — the classifier reads the words each doc's frontmatter actually uses, so
`reference/states/… · glossary deltas open` and `Built … · chat does not persist yet` each land in
the bucket whose meaning they carry. The verdict column is not a renaming of it, and the arithmetic
reconciles row for row:

| verdict        | rows | where they come from                                                                                                                                                                                                                              |
| -------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deltas`       | 25   | 23 of the 30 `deltas open` + 2 `Designed` copy sheets                                                                                                                                                                                             |
| `matches`      | 10   | 10 of the 15 `Built` — `delete-your-account`, `profile-and-password`, `if-a-draft-cant-be-created`, `payment`, `chat-and-discussion`, `counterparty-joined`, `invitation`, `paused-counterparty`, `paused-initiator`, `release-notes-and-banners` |
| `not-built`    | 3    | 2 `Planned` with no surface + 1 `Designed` with nothing to build — `changelog`, `trial-started`, `plans-and-trial`                                                                                                                                |
| `unverifiable` | 13   | 7 of the 30 `deltas open` + 5 of the 15 `Built`                                                                                                                                                                                                   |

**15 rows therefore do not land on the verdict their status word implies**, and each is a finding
rather than a filing decision:

- **13 rows are `unverifiable`** — 7 their frontmatter calls `· design deltas open`
  (`accept-or-decline-an-invite`, `add-a-card-or-take-your-extra-week`,
  `copy-resend-or-cancel-an-invite`, `answer-the-assessment`, `propose-a-change`, `stage-3-aspects`,
  `status-chips`), 5 it calls `Built` (`account-menu`, `who-sees-the-admin-rail`, `ask-to-be-removed`,
  `leave-a-relationship`, `answer-scale`) and 1 it calls `Designed` (`copy-rules`). Every one of them
  draws what its doc promises behind a control a capture cannot open — a ⋮ menu, the avatar
  disclosure, a tab, or a seed state the demo branch cannot reach — or makes a claim only a person
  reading pixels can settle. A `matches` written off a closed menu is exactly the optimism this
  register exists to end.
- **Two of the three `Designed` copy sheets** (`glossary`, `retired-terms`) are counted `deltas`,
  not `not-built`: they are rules the live copy breaks and each break cites a line. Counting them
  `not-built` would have hidden real findings behind "never built". The third (`copy-rules`) moved to
  `unverifiable` once its two text claims were fixed and its pixel and semantics rules were left to a
  reader.
- **`if-a-draft-cant-be-created` is `Built` and a `matches`** — it read `Planned` while the screen
  rendered, which was the stale status this register caught; the create-failed screen carries its
  heading, **"Try Again Shortly. Nothing was sent and nothing was charged."** and both actions.
- **`chat-and-discussion` is `matches`** on a fresh 390 + 1280 capture: its panel drew a Discussion
  heading with no composer, which was a delta and not a plumbing gap.

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

5. **The bullet's verdict.** A bullet that ends **— fixed** is closed in this tree and says what
   closed it; a bullet that ends **— recorded, reference is the stale side** is a place the reference
   and a binding repo spec disagree, where the spec won; **— closed as a capture-state error** is a
   delta the register itself produced by photographing a seeded state the doc was not about;
   **— not fixed here** names the card that owns it. Bullets with no marker are open.

**Three repairs the fixing cards made to the instrument.** A register is only as good as what it read,
and the first pass read three things without checking them:

- **The width.** `browser.text()` read `innerText` at the browser's default window — ~800 px — where
  every `lg:` element is hidden, the wizard rail among them. It now sets each capture's width before
  reading, so a row's text and its PNG describe the same layout.
- **The sign-in.** The role button was clicked after a fixed 3.8 s wait and the landing was read once.
  On a cold dev server the first POST compiles the action and 3.8 s is a coin toss, which was recorded
  as "no session" on a page that had simply not drawn a button yet. Both are polled now.
- **The wizard drive.** Stages 2–5 were reached by filling the text fields and pressing the advance
  control — but stage 2 pre-selects nothing on purpose and both groups are `required`, so the drive
  stopped there, returned the path it was on, and the row recorded "driven to stage 4". That is how
  stage 4 and stage 5 came to be described from a photograph of stage 1. The drive now answers every
  group, waits for the next stage's own control, and throws when it never appears.

`DESIGN_AUDIT_ONLY=<slug,…>` is the fourth change and the one that makes the owner's bundling work: a
card that owns one bundle re-drives its own rows and carries the other forty-two over untouched.

**What this register does not measure.** It is text and structure, not pixels: it can say "the reference
draws a trial chip and the live header does not", and it cannot say "the chip is the wrong grey". A
claim that needs the eye is marked `unverifiable` with that reason and the PNGs are on disk. It also
measures one state per screen — the state the seed is in — not every state the bundles draw.

## Role and state coverage — one seat per capture, and what that leaves unverified

A doc's `audience:` is not the same thing as the seat that can render its surface, and a capture is one
seat in one state. Each row above was photographed as the role
`docs/specs/v2-surface-routes.json` declares for its route; this table names what that means for the
surfaces this pass touched, and what a reader should not read into a `matches`.

| surface                                   | doc audience                                                             | seat captured      | covered                                                                                                                                                     | unverified, and why                                                                                                                                                                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------ | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/assessment/new/failed`                  | Initiator                                                                | initiator          | the drawn screen at 390 + 1280, **and** the signed-out arrival — `200` with the same heading and the same promise, because the page reads no session at all | the Counterparty seat. Nothing on the page is seat-dependent, but no counterparty capture exists: the demo holds one identity per party                                                                                                                    |
| `/admin/email-templates`                  | Admin, Build team                                                        | admin              | the register as an admin reads it, at both widths                                                                                                           | any non-admin seat. The gate answers `307 → /login?next=/admin/email-templates` (measured on this build), so there is no reader variant of this surface to capture — and that absence is the correct answer, not a gap                                     |
| `/dashboard/relationships`                | Initiator, Counterparty                                                  | initiator          | the chip row in the seed's live state, at both widths                                                                                                       | the Counterparty seat, and the waiting / trial-ended / paused states of the same list. The seed holds one identity per party and one relationship per state, so a second role-switched capture needs a second seeded account, which the demo does not have |
| `/assessment/instances/{instance}/answer` | Initiator, Counterparty                                                  | initiator          | the **sealed** sheet — the seed's instance is already accepted                                                                                              | the answering state, for either seat. It needs a fresh invite walked end to end, which the harness cannot do without making product choices                                                                                                                |
| the three pause/join emails               | Initiator (joined, paused-initiator); Counterparty (paused-counterparty) | source, not a seat | both seats: one template per seat, each verified in the file that sends it, and rendered in `tests/email-templates.test.ts`                                 | nothing — an email has no screen and no seat-dependent chrome                                                                                                                                                                                              |

**Two things this table is not.** It is not a claim that a member surface was seen by a stakeholder:
the Build-team audience reads the same member shell, none of the nine surfaces draws operator-only
chrome, and the one Admin surface is gated to `admin`. And it is not a claim that the prototypes' state
switcher is missing: every bundle draws one (`PROTOTYPE ONLY`), the app replaces it with real seeds and
real seats, and no doc in this bundle asks a screen to draw a role switch — so its absence is not
counted as a delta here. What it does mean is that **a `matches` on this page is a `matches` for one
seat in one state**, and the rows above say which.

## The register

| doc                                                       | title                                | status                                                                                      | route                                                                                                                                                                            | bundle reference                                                                      | doc checked at                                                                      | verdict        | deltas                                 | issue               |
| --------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------- | -------------------------------------- | ------------------- |
| `guides/account/account-menu.md`                          | Account Menu                         | Built (#1152 via #1170)                                                                     | `/dashboard` <br>↳ `/dashboard`                                                                                                                                                  | `11-spec-design-page-account-settings-v2/reference/account-menu-1280.png`             | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `unverifiable` | reason below                           | #1136               |
| `guides/account/delete-your-account.md`                   | Delete Your Account                  | Built (#1163, lib/account/purge.ts)                                                         | `/settings` <br>↳ `/settings`                                                                                                                                                    | —                                                                                     | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `matches`      | —                                      | #1163               |
| `guides/account/profile-and-password.md`                  | Profile and Password                 | Built (#1152 via #1170) · bundle refresh open (#1233)                                       | `/settings` <br>↳ `/settings`                                                                                                                                                    | —                                                                                     | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `matches`      | —                                      | #1136, #1233        |
| `guides/admin/crud-and-permissions.md`                    | CRUD & Permissions                   | Built (#1157, #1179) · design deltas open                                                   | `/admin/permissions` <br>↳ `/admin/permissions`                                                                                                                                  | `12-spec-design-page-admin-crud-matrix-v2`                                            | **captured** — `7939ebc2`, both widths                                              | `deltas`       | 3 fixed                                | —                   |
| `guides/admin/email-templates.md`                         | Email Templates                      | Built (#1167) · design deltas open (#1231, PR #1242)                                        | `/admin/email-templates` <br>↳ `/admin/email-templates`                                                                                                                          | `spec-design-v2-rc1.3-bundle/09-admin-email-templates-1231`                           | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 1 open · 1 re-read                     | #1138, #1231        |
| `guides/admin/who-sees-the-admin-rail.md`                 | Who Sees the Admin Rail              | Built (#1157, #1167, nav-menu.json)                                                         | `/admin/permissions` <br>↳ `/admin/permissions`                                                                                                                                  | —                                                                                     | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `unverifiable` | reason below                           | #1126, #1138        |
| `guides/counterparty/accept-or-decline-an-invite.md`      | Accept or Decline an Invite          | Built (#1147) · design deltas open                                                          | `/invite/{token}`                                                                                                                                                                | `02-spec-design-page-onboarding-v2/reference/join-*`                                  | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `unverifiable` | reason below                           | #1125               |
| `guides/counterparty/ask-to-be-removed.md`                | Ask to Be Removed                    | Built (#1149 via #1170) · no shot                                                           | `/dashboard/relationships/{relationship}` <br>↳ `/dashboard/relationships/relationship-assessment-instance-avery-rowan-flat`                                                     | —                                                                                     | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `unverifiable` | reason below                           | —                   |
| `guides/counterparty/save-these-aspects-as-a-template.md` | Save These Aspects as a Template     | Built (#1153 via #1170) · design deltas open                                                | `/dashboard/relationships/{review}?tab=aspects` <br>↳ `/dashboard/relationships/relationship-assessment-instance-rowan-avery-review?tab=aspects`                                 | `03-spec-design-page-relationship-detail-v2/reference/rd-live-aspects-counterparty-*` | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 2 named                                | #1134               |
| `guides/counterparty/when-a-relationship-pauses.md`       | When a Relationship Pauses           | Built (#1143, #1236) · design deltas open                                                   | `/dashboard/relationships/{trial}` <br>↳ `/dashboard/relationships/relationship-assessment-instance-avery-rowan-trial`                                                           | `03-spec-design-page-relationship-detail-v2/reference`                                | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 3 named                                | #1224, #1223        |
| `guides/initiator/add-a-card-or-take-your-extra-week.md`  | Add a Card or Take Your Extra Week   | Built (#1143, #1156 via #1170) · design deltas open                                         | `/dashboard/relationships/{trial}?tab=payment` <br>↳ `/dashboard/relationships/relationship-assessment-instance-avery-rowan-trial?tab=payment`                                   | `03-spec-design-page-relationship-detail-v2/reference`                                | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `unverifiable` | reason below                           | #1121, #1132        |
| `guides/initiator/copy-resend-or-cancel-an-invite.md`     | Copy, Resend or Cancel an Invite     | Built (#1149 via #1170) · design deltas open                                                | `/dashboard/relationships/{summer}` <br>↳ `/dashboard/relationships/relationship-assessment-instance-avery-rowan-summer`                                                         | `03-spec-design-page-relationship-detail-v2/reference/rd-invited-details-*,`          | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `unverifiable` | reason below                           | #1135               |
| `guides/initiator/create-your-account.md`                 | Create Your Account                  | Built (#1144, #1190) · design deltas open                                                   | `/dashboard/templates/{wizardTemplate}/create/commit?instance={draftInstance}` <br>↳ `/dashboard/templates/friends/create/commit?instance=assessment-instance-avery-rowan-trial` | `01-spec-design-page-wizard-v2/reference/wizard-stage4-*`                             | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 3 named · 1 fixed                      | #1123, #1187        |
| `guides/initiator/edit-a-draft-or-sent-invite.md`         | Edit a Draft or Sent Invite          | Built (#1144, #1148) · design deltas open                                                   | `/dashboard/relationships/{flat}` <br>↳ `/dashboard/relationships/relationship-assessment-instance-avery-rowan-flat`                                                             | `01-spec-design-page-wizard-v2/reference/wizard-edit-invited-*`                       | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 2 named · 2 unverified for their state | —                   |
| `guides/initiator/if-a-draft-cant-be-created.md`          | If a Draft Can't Be Created          | Built (#1226) · #1226 drew the screen                                                       | `/assessment/new/failed` <br>↳ `/assessment/new/failed`                                                                                                                          | `spec-design-v2-rc1.3-bundle/04-create-failed-screen-1226/reference`                  | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `matches`      | —                                      | #1226, #1205        |
| `guides/initiator/my-relationships-and-start.md`          | My Relationships and Start           | Built (#1150 via #1170) · design deltas open                                                | `/dashboard` <br>↳ `/dashboard`                                                                                                                                                  | `05-spec-design-page-start-my-relationships-v2/reference`                             | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 1 fixed, 2 open                        | #1129               |
| `guides/initiator/my-templates.md`                        | My Templates                         | Built (#1151, #1153 via #1170) · design deltas open                                         | `/dashboard/templates?tab=mine` <br>↳ `/dashboard/templates?tab=mine`                                                                                                            | `06-spec-design-page-templates-v2/reference`                                          | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 3 fixed, 3 open                        | #1130, #1134        |
| `guides/initiator/payment.md`                             | Payment                              | Built (#1156 via #1170) · Planned: Basic-only price (PR #1241), per-plan price line (#1230) | `/dashboard/payment` <br>↳ `/dashboard/payment`                                                                                                                                  | `08-spec-design-page-payment-v2/reference`                                            | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `matches`      | —                                      | #1132, #1230        |
| `guides/initiator/pick-a-template.md`                     | Pick a Template                      | Built (#1170, via #1159 / #1127) · design deltas open                                       | `/relationship-templates` <br>↳ `/relationship-templates`                                                                                                                        | `02-spec-design-page-onboarding-v2/reference`                                         | re-measured `b8868c6b1` (`wt/rect-02-onboarding`)                                   | `deltas`       | 2 named                                | #1127               |
| `guides/initiator/send-the-invite.md`                     | Send the Invite                      | Built (#1144, #1217) · design deltas open                                                   | `/dashboard/templates/{wizardTemplate}/create/invite?instance={draftInstance}` <br>↳ `/dashboard/templates/friends/create/invite?instance=assessment-instance-avery-rowan-trial` | `01-spec-design-page-wizard-v2/reference/wizard-stage5-*`                             | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 3 named · 2 fixed                      | #1123, #1115, #1216 |
| `guides/initiator/set-up-details-settings-and-aspects.md` | Set Up Details, Settings and Aspects | Built (#1144, drawer via #1170 / #1133) · design deltas open                                | `/dashboard/templates/{template}/create` <br>↳ `/dashboard/templates/brother-sister/create`                                                                                      | `01-spec-design-page-wizard-v2/reference`                                             | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 3 named                                | #1123, #1133        |
| `guides/initiator/when-a-relationship-pauses.md`          | When a Relationship Pauses           | Built (#1143, #1235, #1236) · design deltas open                                            | `/dashboard/relationships/{trial}` <br>↳ `/dashboard/relationships/relationship-assessment-instance-avery-rowan-trial`                                                           | `03-spec-design-page-relationship-detail-v2/reference`                                | —                                                                                   | `deltas`       | 3 named                                | —                   |
| `guides/initiator/your-7-days-free.md`                    | Your 7 Days Free                     | Built (#1116, #1117, #1156 via #1170) · design deltas open                                  | `/dashboard/relationships/{trial}?tab=payment` <br>↳ `/dashboard/relationships/relationship-assessment-instance-avery-rowan-trial?tab=payment`                                   | `03-spec-design-page-relationship-detail-v2/reference/rd-live-payment-*`              | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 3 named                                | #1115, #1132        |
| `guides/shared/answer-the-assessment.md`                  | Answer the Assessment                | Built (#1173, #1235) · design deltas open                                                   | `/assessment/instances/{instance}/answer` <br>↳ `/assessment/instances/assessment-instance-avery-rowan/answer`                                                                   | `10-spec-design-page-assessment-v2/reference`                                         | **captured** — `wt/rect-10-assessment`, 4 shots                                     | `unverifiable` | reason below                           | #1128, #1223        |
| `guides/shared/chat-and-discussion.md`                    | Chat and Discussion                  | Built (#1154 via #1170) · chat does not persist yet                                         | `/dashboard/relationships/{relationship}?tab=discussion` <br>↳ `/dashboard/relationships/relationship-assessment-instance-avery-rowan-flat?tab=discussion`                       | `07-spec-design-page-chat-v2/reference`                                               | **fresh** — captured on this branch at 390 + 1280 · **unverified for counterparty** | `matches`      | —                                      | #1131, #1188        |
| `guides/shared/leave-a-relationship.md`                   | Leave a Relationship                 | Built (#1149 via #1170) · no shot                                                           | `/dashboard/relationships/{closed}` <br>↳ `/dashboard/relationships/relationship-assessment-instance-avery-rowan`                                                                | —                                                                                     | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `unverifiable` | reason below                           | —                   |
| `guides/shared/propose-a-change.md`                       | Propose a Change                     | Built (#1155 via #1170) · design deltas open                                                | `/dashboard/relationships/{relationship}?tab=aspects` <br>↳ `/dashboard/relationships/relationship-assessment-instance-avery-rowan-flat?tab=aspects`                             | `03-spec-design-page-relationship-detail-v2/reference/modal-propose-*,`               | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `unverifiable` | reason below                           | #1133               |
| `guides/shared/results-and-align.md`                      | Results and Align                    | Built (#1145, #1148) · design deltas open                                                   | `/dashboard/relationships/{relationship}` <br>↳ `/dashboard/relationships/relationship-assessment-instance-avery-rowan-flat`                                                     | `04-spec-design-page-align-v2/reference`                                              | **captured** — `1707a32c`, both widths (local demo branch)                          | `deltas`       | 3 fixed                                | #1122, #1124        |
| `reference/changelog.md`                                  | Changelog                            | Designed                                                                                    | —                                                                                                                                                                                | —                                                                                     | —                                                                                   | `not-built`    | —                                      | —                   |
| `reference/copy/copy-rules.md`                            | Copy Rules                           | Designed                                                                                    | —                                                                                                                                                                                | —                                                                                     | —                                                                                   | `unverifiable` | 2 fixed · 2 unverifiable               | —                   |
| `reference/copy/glossary.md`                              | Glossary                             | Designed                                                                                    | —                                                                                                                                                                                | —                                                                                     | `docs/glossary.md (repo)`                                                           | `deltas`       | 1 open · 1 fixed                       | —                   |
| `reference/copy/retired-terms.md`                         | Retired Terms                        | Designed                                                                                    | —                                                                                                                                                                                | —                                                                                     | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 1 open · 1 fixed                       | —                   |
| `reference/emails/counterparty-joined.md`                 | Counterparty Joined Email            | Built (#1227, PR #1240) · no delta                                                          | —                                                                                                                                                                                | `spec-design-v2-rc1.3-bundle/05-email-counterparty-joined-1227`                       | `lib/email/templates/counterparty-joined.ts`                                        | `matches`      | —                                      | —                   |
| `reference/emails/invitation.md`                          | Invitation Email                     | Built                                                                                       | —                                                                                                                                                                                | —                                                                                     | `lib/email/templates/invitation.ts · content/email-bodies.md`                       | `matches`      | —                                      | —                   |
| `reference/emails/paused-counterparty.md`                 | Paused Email (Counterparty)          | Built (#1168) · no delta                                                                    | —                                                                                                                                                                                | —                                                                                     | `lib/email/templates/relationship-paused.ts`                                        | `matches`      | —                                      | #1139               |
| `reference/emails/paused-initiator.md`                    | Paused Email (Initiator)             | Built (#1168) · no delta                                                                    | —                                                                                                                                                                                | —                                                                                     | `lib/email/templates/trial-ended-paused.ts`                                         | `matches`      | —                                      | #1139               |
| `reference/emails/release-notes-and-banners.md`           | Release Notes and Banners            | Built (#1177, #1193)                                                                        | —                                                                                                                                                                                | —                                                                                     | —                                                                                   | `matches`      | —                                      | —                   |
| `reference/emails/trial-started.md`                       | Trial Started Line                   | Planned (PR #1240)                                                                          | —                                                                                                                                                                                | `spec-design-v2-rc1.3-bundle/05-email-counterparty-joined-1227`                       | —                                                                                   | `not-built`    | —                                      | #1227               |
| `reference/stages/stage-1-details.md`                     | Stage 1 · Details                    | Built (#1144) · design deltas open                                                          | `/dashboard/templates/{template}/create` <br>↳ `/dashboard/templates/brother-sister/create`                                                                                      | `01-spec-design-page-wizard-v2/reference`                                             | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 3 named                                | —                   |
| `reference/stages/stage-2-settings.md`                    | Stage 2 · Settings                   | Built (#1144) · design deltas open                                                          | `/dashboard/templates/{template}/create/mode` <br>↳ `/dashboard/templates/brother-sister/create/mode`                                                                            | `01-spec-design-page-wizard-v2/reference`                                             | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 3 named                                | —                   |
| `reference/stages/stage-3-aspects.md`                     | Stage 3 · Aspects                    | Built (#1144) · design deltas open                                                          | `/dashboard/templates/{template}/create/aspects` <br>↳ `/dashboard/templates/brother-sister/create/aspects`                                                                      | `01-spec-design-page-wizard-v2/reference`                                             | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `unverifiable` | reason below                           | —                   |
| `reference/stages/stage-4-account.md`                     | Stage 4 · Account                    | Built (#1144) · design deltas open                                                          | `/dashboard/templates/{wizardTemplate}/create/commit?instance={draftInstance}` <br>↳ `/dashboard/templates/friends/create/commit?instance=assessment-instance-avery-rowan-trial` | `01-spec-design-page-wizard-v2/reference`                                             | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 3 named · 1 fixed                      | —                   |
| `reference/stages/stage-5-invite.md`                      | Stage 5 · Invite                     | Built (#1144) · design deltas open                                                          | `/dashboard/templates/{wizardTemplate}/create/invite?instance={draftInstance}` <br>↳ `/dashboard/templates/friends/create/invite?instance=assessment-instance-avery-rowan-trial` | `01-spec-design-page-wizard-v2/reference`                                             | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 3 named · 2 fixed                      | —                   |
| `reference/stages/stage-6-align.md`                       | Stage 6 · Align                      | Built (#1144, #1147, #1148) · design deltas open                                            | `/dashboard/relationships/{relationship}` <br>↳ `/dashboard/relationships/relationship-assessment-instance-avery-rowan-flat`                                                     | `03-spec-design-page-relationship-detail-v2/reference`                                | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 2 named                                | —                   |
| `reference/states/answer-scale.md`                        | The Answer Scale                     | Built (#1173)                                                                               | `/assessment/instances/{instance}/answer` <br>↳ `/assessment/instances/assessment-instance-avery-rowan/answer`                                                                   | —                                                                                     | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `unverifiable` | reason below                           | —                   |
| `reference/states/relationship-states-by-role.md`         | Relationship States by Role          | Built (#1148, #1143) · design deltas open                                                   | `/dashboard/relationships` <br>↳ `/dashboard/relationships`                                                                                                                      | —                                                                                     | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 2 open                                 | —                   |
| `reference/states/status-chips.md`                        | Status Chips                         | Built (#1145, #1150) · design deltas open                                                   | `/dashboard/relationships/{relationship}` <br>↳ `/dashboard/relationships/relationship-assessment-instance-avery-rowan-flat`                                                     | `09-spec-design-system-tokens-v2/reference/patterns-1280.png`                         | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `unverifiable` | reason below                           | —                   |
| `start/core-concepts.md`                                  | Core Concepts                        | Built (v2.0.0-rc1.2) · glossary deltas open                                                 | `/how-it-works` <br>↳ `/how-it-works`                                                                                                                                            | `09-spec-design-system-tokens-v2/reference`                                           | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 2 named                                | —                   |
| `start/plans-and-trial.md`                                | Plans and the Free Trial             | Planned (Basic only: PR #1241) · trial Built (#1116, #1117, #1143)                          | `/pricing` <br>↳ `/pricing`                                                                                                                                                      | `08-spec-design-page-payment-v2/reference`                                            | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `not-built`    | —                                      | —                   |
| `start/quickstart.md`                                     | Quickstart                           | Built (#1144, #1147, #1173, #1145) · design deltas open                                     | `/dashboard` <br>↳ `/dashboard`                                                                                                                                                  | `01-spec-design-page-wizard-v2/reference`                                             | **stale** — `main @ 601ce26`, 21 commits before `03e4984`                           | `deltas`       | 2 named                                | —                   |
| `start/what-is-alignsynch.md`                             | What Is AlignSynch                   | Built (v2.0.0-rc1.2 on main) · design deltas open per guide                                 | `/` <br>↳ `/`                                                                                                                                                                    | `02-spec-design-page-onboarding-v2/reference`                                         | re-measured `b8868c6b1` (`wt/rect-02-onboarding`)                                   | `deltas`       | 2 named                                | —                   |

## The deltas, named — one bullet per difference a card can accept

Every bullet names the line the reference or the doc draws and the capture that does not carry it.

### `guides/admin/crud-and-permissions.md`

CRUD & Permissions · Built (#1157, #1179) · design deltas open · route `/admin/permissions`

Re-captured on `wt/rect-12-admin-crud-matrix` at `7939ebc2` (local demo branch, 390 + 1280):
`169 Rows`, `Pass 10 snapshot · 34 P0 · 23 P1 · 29 P2 · 15 Won't · 2 P0 still open (hinted or missing)`,
`Rules Every #1119 Child Must Honour` with its six sentences, a `Status` facet and
`Conflicts and Decisions` are all in `live.txt` now. The three bullets below stay where they were as
the record of what was asked for, and four differences this card did not own are named below them.

- **[fixed]** The reference's row-count line is **"Showing 18 of 169 Rows"** and the page's own copy is **"Pass 10 snapshot · 34 P0 · 23 P1 · 29 P2 · 15 Won't · 2 P0 still open"**; the live page printed `169 Rows` with no "Showing N of M" filter line and none of the P0/P1/P2 breakdown. — the line now reads `169 Rows` whole and `Showing N of 169 Rows` narrowed, and the band carries the snapshot line, every figure derived (`snapshotPass` from the source's own preamble, `p0Open` = P0 ∩ hinted/missing).
- **[fixed]** The reference's six **"Rules Every #1119 Child Must Honour"** are absent from the live page: it opened on **Role × Action Rules** and named the epic, and carried none of the six rule sentences (not even the archive-over-delete one) — the heading is now the reference's and the six sentences are its own words. The before-capture carried five of the six, not none: "carries none" was wrong, and the sentences it did carry had drifted in punctuation.
- **[fixed]** The reference's **Status** and **Priority** filters and its **Conflicts and Decisions** block do not appear in the live text; the live filters it did print are Object, Role and Upstream. — the prototype-status facet is labelled `Status` as drawn, `Priority` was already drawn, and the section is titled `Conflicts and Decisions`.
- **[open]** The count band's captions: the reference draws **Cells · Applicable · Covered · Hinted · Missing · Conflicts**; the live band draws ten (`169 cells`, `124 applicable`, `4 upstream conflicts`, …), so the reference's two bare words and its sixth card have no counterpart.
- **[open]** A **Filters** heading over the facet block, and the reference's `Clear Filters` control inside it: the live page prints one heading per facet and puts `Clear Filters` beside the count line under the table.
- **[open]** Each P0 gap carries a status chip and its **`#issue`** and **`Open`** links in the reference (`#1123`, `#1134`, …); the live page prints the number, the title and the body, and no link to the prototype or the issue.
- **[open]** The **Conflicts and Decisions** cards: the reference draws four decisions with **Prototype / Upstream / v2 Rule / Recommendation** quadrants; the live page derives a table of the conflicted cells (Object · Action · Role · Rationale). The matrix carries one rationale paragraph per cell, so the quadrants cannot be derived — they are authored prose the source does not hold. The reference's role option also reads `Admin/curator` where the source's vocabulary reads `Admin-curator`.

### `guides/admin/email-templates.md`

Email Templates · Built (#1167) · design deltas open (#1231, PR #1242) · route `/admin/email-templates`

- **Open.** The doc promises **"Save as Draft, then Publish"** and a **Preview** with sample data; the live page carries a preamble sentence describing draft-and-publish ("An edit is saved as a draft; production mail changes only when you publish") and a register whose every row reads **Default** with an **Open** control — and no `Draft` state, no `Publish`, no `Preview`, and no override editor behind `Open` — live `tests/design-captures/admin-email-templates/live.txt`. The prose promises a workflow the page has no control for, which is the delta, and it is not this card's to close: the editor is #1231's build and PR #1242 is open on it.
- **Re-read — the pairing.** No reference render exists to pair: rc1.3 bundle 09 (`09-admin-email-templates-1231`) ships `README.md` and `IMPLEMENTATION-PROMPT.md` and no PNG, so this row is text-against-text by construction. The bundle column says so instead of implying a render nobody can open.

### `guides/counterparty/save-these-aspects-as-a-template.md`

Save These Aspects as a Template · Built (#1153 via #1170) · design deltas open · route `/dashboard/relationships/{review}?tab=aspects`

- **Fixed (rect-03)** — Copy rule 1: the live page's `fork` panel now heads **"Keep These Aspects for Yourself"** and its action reads **"Save This Template to My Templates"**, both Title Case, in a headed section (`data-fork-template`). The reference HTML draws no such panel at all, so the section's shape is the doc's, and only the casing moved.
- **Fixed (rect-03)** — The relationship's **At a Glance** card is drawn above the tabs: **"N of M Aspects Aligned"**, one mark per Aspect in the synch / small-gap / gap tokens, the three counts, then Mode · Alignment Tolerance · Latest Round. The tally is `alignmentSummaryOf()` over `content/gaps.ts`, so this card and the Start page's bar cannot disagree — reference `spec-design-v2-bundles/03-spec-design-page-relationship-detail-v2/relationship-detail.html`. **Captured:** `tests/design-captures/counterparty-save-these-aspects-as-a-template/live.txt` at both widths carries **At a Glance · 0 of 5 Aspects Aligned · 0 In Synch · 4 Small Gap** over this relationship's own answers. The tally is drawn only for a round **both seats** answered; on `{trial}` the seed's counterparty sheet is empty (`opinion` holds 5 initiator rows, 0 counterparty), so that page draws the card's Mode · Tolerance · Round rows and no tally — absence of data, never a zero.

### `guides/counterparty/when-a-relationship-pauses.md`

When a Relationship Pauses · Built (#1143, #1236) · design deltas open · route `/dashboard/relationships/{trial}`

- **Matches (rect-03, verified)** — The badge the doc promises — **"⏸ Paused · Waiting on Marcus"**, grey with a pause icon and no red — is drawn live as **"Paused · Waiting on Avery"**: the shape is right (a soft-grey chip carrying a pause glyph) and only the name moves, which is the seed's identity, not a design delta.
- **Fixed (rect-03)** — The reference's **"At a Glance"** card is now drawn above the record's own facts card (Mode · Alignment Tolerance · Latest Round · the Aspect tally). The flat STATE/STARTED/PUBLISHED/INVITED/CONNECTION/MEMBERSHIP card stays below it: those are the relationship's own columns, and the reference's state switcher substitutes them rather than dropping them. **Captured:** `tests/design-captures/counterparty-when-a-relationship-pauses/live.txt` — **At a Glance · Mode Basic · 2 Opinions · Soft · Small Gap OK · Round 1 · Sep 21, 2026** at both widths, and **Paused · Waiting on Avery** above it. The tally row is absent on this state because the seed's counterparty sheet holds no answers; where both seats answered it is drawn (see the `stage-6-align` row: **2 of 5 Aspects Aligned · 2 In Synch · 1 Small Gap**).
- **Not fixed — a reference defect, recorded not copied.** The reference's next-step band for this state reads **"Your Trial Ended"** with **"Add a Card"** and **"Get 7 More Days Free"**; the Counterparty's live page draws no next-step band, which is copy rule 4 (the Counterparty never sees a price, a trial, a card or an extension). The reference draws the Initiator's band on the Counterparty's screen; the build is the correct half.

### `guides/initiator/add-a-card-or-take-your-extra-week.md`

Add a Card or Take Your Extra Week · Built (#1143, #1156 via #1170) · design deltas open · route `/dashboard/relationships/{trial}?tab=payment`

- **By design, not a delta** — The doc's confirmation copy **"7 More Days Added · Stage 6 is running again"** is drawn by the arrival: pressing **Get 7 More Days Free** writes the week and the screen prints `pause.added` with the end the rows carry (`?from=extend` reprints it on arrival). A confirmation is the answer to an act, so it is absent at rest by construction — the register measured the page before anyone pressed anything.
- **Fixed (rect-03) — asserted, not photographed.** The reference's **Payment tab** summary is drawn: **Status** (the window's own state — `Free Trial · Ends <date>` / `Paused · Trial Ended` / `Paused · Extra Week Ended`), **Billing Owner**, and **After the Trial** with the plan's price (`membershipPrice()`, passed in as a prop so the client bundle stays free of the server module — E34). While a window runs the tab also carries **"Add a card before <date> to keep Stage 6 running. If you don't, it pauses and nothing is lost."** The reference's `Card` row is deliberately not drawn: no read on this page answers whether a card is on file, and "Not needed" over a card nobody read is the guess this register exists to refuse. **Why not captured:** the tab set is client state started on the first tab, and `?tab=payment` does not select it server-side, so the instrument photographs the page's first tab at both widths; the summary is held by `tests/relationship-glance.test.tsx` instead. Navigating to the tab is what would turn this bullet into a photograph — `rect-03` did not widen the harness to claim it.

### `guides/initiator/copy-resend-or-cancel-an-invite.md`

Copy, Resend or Cancel an Invite · Built (#1149 via #1170) · design deltas open · route `/dashboard/relationships/{summer}`

- **Unreachable from the seed — not a build delta.** The doc's two actions — **"Copy Invite Link"** and **"Resend Invite"** — are drawn by the `hygiene` panel (`relationship-detail.tsx`, `data-hygiene-copy`), which renders for a live invitation on an **unclaimed** seat. The seeded relationship at this address is `invite-claimed`, so the capture photographs a page the panel is not for. The controls exist and are covered by `tests/relationship-detail.test.ts`; they cannot be photographed without a sent-and-unclaimed invite.
- **Unreachable from the seed — the state the doc describes.** The reference draws the waiting state as **"Waiting on Elena to Join · Invitation sent to `elena.r@example.com` on Nov 16"** with a **Share the Invite Link** next step; the captured relationship is complete, so "the waiting-invite state is not the state the seeded relationship is in" (the register's own finding, unchanged). **Unverified for the waiting state**, at both widths, from this seed.
- **Unreachable from the seed — not fixed.** The reference's **"Trial Starts When Elena Accepts"** marker is not drawn, and it will not be drawn as reference copy: the shipped anchor is the publish (`published_at`), and the register's own `stage-5-invite` row records that the live stage 5 says the card anchors the trial. Promising an acceptance anchor on the Payment tab would be the more expensive of the two conflicting claims. The Payment tab says **"No trial is running."** when no window exists, which is true of every row that read can see.

### `guides/initiator/create-your-account.md`

Create Your Account · Built (#1144, #1190) · design deltas open · route `/dashboard/templates/{wizardTemplate}/create/commit?instance={draftInstance}`

- The heading is the Title Case breach the doc itself flags: the live stage 4 renders **"Create your account"** where the doc's At a Glance says **Create Your Account** — live `tests/design-captures/initiator-create-your-account/live.txt`, source `data/pages/assessment-create.ts:363`. — **fixed**: the live heading and the page's `metadata.title` both read **Create Your Account** now (`data/pages/assessment-create.ts`, `components/flow/template-create/commit.tsx`), and the registry's capability and notes quote the same words.
- The doc's advance control **"Continue to Stage 5"** and its body **"Your answers stay on this device until you sign in."** are both drawn — those **match**.
- The live page carries a paragraph the doc does not describe: **"The relationship exists as a draft. The account it belongs to is the one you are signed in with."** — the doc still describes signing up as what writes the draft. — **recorded, not a screen defect**: `docs/specs/flow-stages.md`'s stage-4 section pins exactly this behaviour ("Completing stage 4 writes the relationship with `status = 'draft'` and the signed-in account as its Initiator"), so the paragraph is the spec arriving on the screen and the guide is the stale side. The guide lives in the spec drop, not this repo, so the correction is a doc edit for the bundle owner — this row keeps its verdict until that frontmatter status moves.

### `guides/initiator/edit-a-draft-or-sent-invite.md`

Edit a Draft or Sent Invite · Built (#1144, #1148) · design deltas open · route `/dashboard/relationships/{flat}`

- The doc promises **"Continue Setup"** on a draft card and **"Edit this relationship"** on a sent invite; the live page draws **Next Step · Continue Your Assessment** with **5 of 5 Aspects answered** and neither of the doc's two controls — live `tests/design-captures/initiator-edit-a-draft-or-sent-invite/live.txt`. — **unverified for the states the doc is about**: **Edit This Relationship** is drawn (the relationship page's `edit` band, `data/pages/dashboard-relationship-detail.ts`), but a completed relationship has nothing to edit towards, so the control is not on the page at this address. The draft state (**Waiting on Invite** with **Send Invitation**) and the sent-invite state are where the two promises live, and neither was photographed. `unverified for the draft state and the sent-invite state`, never `matches`.
- The reference's draft state draws **"Waiting on Invite · Elena hasn't been invited yet. Only you can see this relationship."** with **Send Invitation**; the live relationship at this address is a completed one, so the draft state was not photographed — the delta is drawn from the page's own copy, not from the reference's state. — **held open**: a demo relationship in the draft state is the missing input. The demo seed carries a completed, a trial and an admin seat, so this row cannot reach the state it judges without a fresh draft walked from stage 1.

### `guides/initiator/if-a-draft-cant-be-created.md`

If a Draft Can't Be Created · Built (#1226) · #1210 shipped a named 500; #1226 drew the screen · route `/assessment/new/failed`

- **Matches.** The screen is drawn: `/assessment/new/failed` heads **"Couldn't Create This Draft"** and offers **Try Again** and **Back to Dashboard**, the doc's first two promises — live `tests/design-captures/initiator-if-a-draft-cant-be-created/live.txt`.
- **Fixed.** The doc's third promise — **"Nothing was sent and nothing was charged"** — is now the page's second sentence (`data/pages/assessment-create-failed.ts:26`), carried after the bundle's own "Try Again Shortly." The rc1.3 bundle's `create-failed.html` draws only that first sentence, so the doc and copy rule 9 are the authority here, and the clause added is the doc's sentence verbatim. The capture shows the pair at both widths — `live.txt` reads **"Try Again Shortly. Nothing was sent and nothing was charged."**, and `missing.json` lists **"Try Again Shortly."** as a reference line only because the comparator matches a line and that line is now the prefix of a longer one.
- **Fixed — the status, and the second action's word.** The doc said `Planned` (issue #1226) while the screen rendered; it now says `Built`. Its Actions row said **Back to My Relationships** where the bundle and the live page both say **Back to Dashboard**, so the doc was corrected to the pair that exists.

### `guides/initiator/my-relationships-and-start.md`

My Relationships and Start · Built (#1150 via #1170) · design deltas open · route `/dashboard`

A rectification pass on 2026-11-19 fixed one of these three and left two, with the reason stated on
each. The two left are the same finding: **the screen already draws what the doc promises, and the
demo seed does not hold the row that would make it true.** They are named here as data, not as copy,
so the next card does not rebuild a branch that exists.

- **Fixed — the filter row.** The doc's At a Glance prints **"All · Live · Waiting · Drafts ·
  Paused"**; the live row drew `Newest | All 5 | Stage 6 Live 3 | Waiting on Invite 1 | Draft 0 |
  Paused 1`, so `Live`, `Waiting` and `Drafts` were not the words on screen.
  `data/pages/dashboard-relationships.ts::tabs` now carries **All · Live · Waiting · Drafts ·
  Paused**, and the card's chip keeps the owner's four words (**Stage 6 Live · Waiting on Invite ·
  Draft · Paused**) — which is bundle 05's own pairing: `my-relationships.html` prints
  `All 4 · Live 1 · Waiting 1 · Drafts 1 · Paused 1` in the row and the longer words on the cards.
  **Two halves of the bullet as originally written were wrong, and are corrected here:** the live
  set's _counts_ are not a delta — the reference draws a count beside every filter, and so does the
  live row — and `Paused` was drawn verbatim, so the genuinely absent word was `Drafts` alone.
  Pinned by `tests/member-relationships-list.test.tsx`; the before/after DOM is
  `tests/design-captures/states-relationship-states-by-role/live.txt`.
- **Not fixed — the draft job ("Finish and Send the Invite").** `lib/member/start.ts::startJobsOf`
  already emits a `finish-draft` job for a draft the viewer is the Initiator of, and
  `components/dashboard/start-view.ts` already resolves its title, body and **Continue Setup**
  action from the fixture. The live page shows two jobs because **the demo initiator owns no draft**:
  the visible set is three live, one waiting and one paused, which is exactly `next-step` +
  `add-card`. This is not reachable from this checkout either — the demo dataset is
  `data/bundles/demo-dataset.alignsynch.json`, the canonical export of `data/assessments.ts`, and
  putting a draft in the demo initiator's hands means a fixture change **and** a re-seed of the
  shared demo branch (which serialises fleet-wide on the `algn/1` advisory lock and would move every
  other row's capture). Named for a card, not fixed here.
- **Not fixed — the Start band's headline and count.** The reference reads **"One thing to talk
  about, and two small jobs."** with **3 to do**; the live page reads **"Your relationships, and
  what is next for each."** with **2 to do**. Both halves are conditional on the same missing draft:
  `start-view.ts` draws `copy.subtitle` — the bundle's sentence, verbatim — the moment the jobs are
  one conversation and two small jobs, and the quiet sentence otherwise, because a landing page that
  counted jobs it did not have is copy nobody can check. So the _headline is already the bundle's_
  whenever the data supports it, and the count is the count. Now pinned both ways round by
  `tests/start-header-sentence.test.ts` (three jobs → the bundle's line; two → the quiet one; a
  Counterparty's pause is not a job), so the next reader sees a data gap rather than a copy gap.

### `guides/initiator/my-templates.md`

My Templates · Built (#1151, #1153 via #1170) · design deltas open · route `/dashboard/templates?tab=mine`

A rectification pass on 2026-11-19 captured this row at 390 and 1280 from the branch that carries the
fix (`b8868c6b` + this pass) and compared it to `templates.html?tab=mine` line by line. **One of the
row's two bullets was wrong** and is corrected here; three differences the instrument did find are
fixed; three stay open with the mechanism named on each.

- **Corrected — the card menu is built, and its words are not a page-text fact.** The reference's own
  markup draws the same two menus the build does: a My Template card's kebab is
  `Edit · Duplicate · Archive` and a Library card's is `Create Relationship · Save a Copy`
  (`templates.html`, one `role="menu"` block per card). `lib/member/card-menu.ts::templateMenuOf`
  returns exactly those rows, in that order, for exactly those tabs, and `tests/card-menus.test.tsx`
  pins both lists. The words are absent from **both** `reference.txt` and `live.txt` because a
  closed menu is not text on either side — the reference marks every menu `hidden` until its trigger
  is pressed, and the build mounts its rows in a portal that does not exist until it is opened — so
  the bullet as written measured the instrument, not the screen.
- **Fixed — the header line.** The screen read _"Browse the Library to start a relationship, or open
  one of your own templates and make it yours."_; the reference's `<h1>Templates</h1>` is followed by
  _"Start from the Library, or reuse one of your own."_ `data/pages/dashboard-templates.ts::subtitle`
  now carries the reference's sentence, verbatim.
- **Fixed — the My Templates tab's own line.** The screen printed three sentences above the shelf
  (_"The templates you own. Opening one shows its Aspects; … does not make one."_); the reference
  prints one: _"Your saved copies. Changes never touch relationships you’ve already started."_ The
  fixture now carries that sentence; the dropped third sentence restated a rule the doc's own _How
  It Works_ already states, and it sat above an empty shelf.
- **Fixed — the empty state's false sentence.** `mine-empty` drew _"A template you already own can
  also be opened above."_, and that notice renders **only** when `owned.length === 0`
  (`app/(mainlayout)/dashboard/templates/page.tsx`), so it always pointed at an empty shelf. The
  sentence is gone; the two doors it names stay, because the build draws `Start Blank` and `Copy a
  Template` below it and the reference's empty state draws neither.
- **Open — the populated grid, and the two facts it prints that have no column.** The reference draws
  three cards (`My Copy · Brother–Sister · Our Version`, `Weekend Load`, `Family Event Planning`) with
  `Based on … · Updated Nov N`, `2 Edited` and `Used in 1`. The live page draws `No Templates Yet`
  because **no demo seat owns a template**: `record.owner_user_id` is null on all 60 rows of the demo
  branch, so `listMyTemplates()` returns nothing for every account. `Edited` is a _version_ count and
  `Based on …` is provenance; `MemberTemplateRow` (`lib/member/templates.ts`) carries neither, so a
  seeded row would still not draw them. A named card, not a copy edit: it needs the model and a
  re-seed of the shared demo branch.
- **Open — the page-level action.** The reference draws a primary **Create Relationship** beside the
  `<h1>`, above the tabs. The live page has none: its doors are the two bands under the empty state
  and the per-card action, and `/dashboard/templates/{id}/create` needs a template id, so the header
  control needs a destination decision rather than a link. Named, not invented.
- **Open — the Propose a Template door is on the other tab.** The reference draws it on **My
  Templates**; the build draws it only on the **Library** (`page.tsx` mounts the band inside
  `tab === "library"`, whose own docstring argues the door belongs where the templates it opens are
  not). Both reads are defensible, so this is a placement decision for the owner, not a fix.

**Roles and states carried.** Captured: **Initiator** — the row's `audience`, signed in — on
`?tab=mine` with **0 owned rows**, at 390 and 1280. **Unverified for counterparty, admin,
stakeholder, support and owner**: all five hold a session on the demo branch (`demo_account` seeds
three; the ladder admits every rung at `requireRole("member")`), but the route map captures this
screen for the initiator only, so no other seat was photographed. The prototype's waiting /
trial-days-left / paused / live variants are relationship states and do not render here — this
surface's states are its two tabs and the empty-and-populated pair, and the populated pair is the
open item above.

### `guides/initiator/pick-a-template.md`

Pick a Template · Built (#1170, via #1159 / #1127) · design deltas open · route `/relationship-templates`

- **Open — the worked example does not follow the doc's own subject.** The bundle draws
  **"EXAMPLE · BROTHER–SISTER"** over **"Parent Decisions"**, **"1 · Avoided or fought"**,
  **"5 · Shared and agreed"** and **"Marcus wishes 5" / "Elena wishes 3"**; the live card draws
  **"EXAMPLE · STAFF–MANAGER"** over an Office Aspect, because `catalogueExample()` takes the first
  template with an authored demo answer sheet and `data/relationship-types.ts::demoAnswersByType`
  holds exactly two (`staff-manager`, `co-founders`). Drawing Brother–Sister is a content change,
  not a UI one: the sheet is 5 Aspects × 2 parties × 4 opinions of authored answers, and
  `tests/alignment-home.test.ts` pins `/`'s six featured cards to exactly the sheet set, so adding
  one re-cuts the home band too. Left open on purpose — re-measured `b8868c6b1`, live
  `tests/design-captures/initiator-pick-a-template/live.txt`.
- **Open — the Aspect line prints its question, not a title.** The bundle's card names the Aspect
  (**"Parent Decisions"**); the live card prints the question it is asked with
  (`aspect.prompt`). The taxonomy carries no Aspect title — only `prompt`, `leftValue`,
  `rightValue` — so this one is a schema addition, and it belongs with whoever decides the
  taxonomy's Aspect shape rather than with a screen.
- **Fixed — the `Choose a Template` heading was drawn twice.** The band paired an `sr-only` copy
  (for the section's `aria-labelledby`) with the visible heading in the browser island, so the
  document carried two headings with the same words. One heading now, and its `id` is the one the
  section names (`components/marketing/catalogue-browser.tsx`).
- **Fixed — the exemplar card had no `Popular` badge.** The bundle draws `Popular` on the card the
  hero's **"Start With the Most Popular"** opens; the page drew neither. The badge now sits on that
  card by construction — the page resolves the exemplar once and passes its id to
  `catalogueCards()`, so the badge and the action cannot name two templates.
- **Fixed — every card was missing its duration chip.** The bundle draws **"About 3 Minutes"** on a
  **"5 Aspects"** card; the catalogue drew the realm, the Aspect count and the roles only. The chip
  is derived from the Aspect count by `content/core.ts::minutesForAspects()`, the same reading the
  in-app shelf prints (`lib/member/shelf.ts`), and it reproduces the bundle's samples exactly
  (`4`→2, `5`→3, `6`→4).
- **Fixed — four strings carried the ASCII apostrophe.** The bundle uses `’` (`you’re`, `there’s`,
  `haven’t`, `each other’s`), and the comparison is glyph-sensitive on purpose, so these four were
  reported as real differences; the fixture now spells them as the bundle does.
- **Withdrawn — "the live catalog draws a Family | Couples | Friends | Work filter row instead of the
  reference's category grouping".** Measured false on `b8868c6b1`: the catalog draws a `Categories`
  group (`aria-label`) of nine chips with counts — **All 27 · Office 5 · Business 4 · Property 1 ·
  School 2 · Medical 1 · Home 10 · Social 4** — which is the bundle's own pattern. The names differ
  because the product's taxonomy is 27 relationship types across seven realms and the prototype had
  eight across six; that is the taxonomy moving, not the screen.
- **Withdrawn — "every Aspect with its 1 and 5 labels is not drawn on the catalog".** The doc's
  promise is about _the template page_ ("The template page lists every Aspect with its left (1) and
  right (5) labels"), and that page draws it: `lib/template-detail.ts` maps every Aspect to
  `left`/`right`, and `data/pages/templates-detail.ts:44` carries the **Create Relationship**
  label. This row captures the catalog, so it never photographed the page the promise is about —
  the gap was in the instrument, not the screen.

### `guides/initiator/send-the-invite.md`

Send the Invite · Built (#1144, #1217) · design deltas open · route `/dashboard/templates/{wizardTemplate}/create/invite?instance={draftInstance}`

- The doc's primary action **"Continue with 7 Days Free"** is absent: the live stage 5 draws **Next** and **Continue as Draft** — live `tests/design-captures/initiator-send-the-invite/live.txt`. — **closed as a capture-state error, not a screen defect**: the control is `plans.free-continue`, drawn on the walk's **plan** panel, and the create path reaches that panel — `tests/trial-no-payment-inputs.test.ts` asserts `data-pay-step="plan"` and the control's presence on an unpaid creator's stage 5, and that the purchase path's thank-you is **not** drawn. The demo seat this register was captured on holds a live membership, so its stage 5 opened one step later and the register photographed the thank-you. `unverified for the paid-seat state` is all that capture supports.
- The doc's trial anchor is contradicted on the page: the doc says the 7 days start **when the person accepts**, and the live page says **"The plan is active and the card is on file. Nothing has been charged today — the trial starts when the card is saved."** — a card anchor and a `Thank you` block the doc does not mention. — **fixed**: the contradiction was real and is gone. The walk's plan panel printed `plans.body` — the _purchase_ panel's sentence, anchored on a saved card — directly above `plans.trial-free`, which anchors the week on the Counterparty's acceptance, so stage 5 stated both anchors in one column. The card-free panel draws its own `plans.body-free` now (`components/assessment-flow/invite-walk.tsx`, `data/pages/assessment-create.ts`), and `tests/trial-no-payment-inputs.test.ts` fails if the purchase body returns to the create path.
- **Continue as Draft** _is_ drawn and matches the doc; the **What Elena Sees** preview the doc tells the reader to check is absent, replaced by **What you can do later**. — **fixed**: `components/assessment-flow/stage-invite.tsx` draws the preview beside the two acts — the Counterparty's own name in the heading, with an unnamed fallback, and the three facts the invitation carries: from whom, about what, to which address, all read off the draft. It deliberately does not restate the email's subject or body, which stay in `lib/email/templates/invitation.ts`; `tests/stage5-invitee-preview.test.ts` pins both halves. **What you can do later** stays — it is a different panel, about the draft, and the reference does not forbid it.

### `guides/initiator/set-up-details-settings-and-aspects.md`

Set Up Details, Settings and Aspects · Built (#1144, drawer via #1170 / #1133) · design deltas open · route `/dashboard/templates/{template}/create`

- The doc's rail vocabulary — **Done · In Progress · Up Next · Later** — is absent from the live stage-1 page, which draws **STAGE 1 OF 5 · DETAILS** and no per-stage state word — live `tests/design-captures/initiator-set-up-details-settings-and-aspects/live.txt`. — **closed as a measurement artifact, and the delta was the instrument's**: the rail is `hidden` below Tailwind's `lg` breakpoint, and `browser.text()` read `innerText` at the browser's default window — ~800px — so every `lg:` element was absent from the text the register judged. Stage 1 draws `Details · In Progress`, `Settings · Up Next`, `Aspects/Account/Invite · Later` and `Align · Starts when they join` at 1280; `browser.text()` now sets the width it claims before reading. Re-captured.
- Stage 2's **Opinions Mode** and **Alignment Setting** are not at this address (they are `/create/mode`); the capture is stage 1 by design, so the stage-2 half of this doc is judged on the `reference/stages/stage-2-settings.md` row instead. — unchanged; a capture-scope note, not a delta.
- The doc's stage-1 field inventory (title, both first names, their email, an optional description) **matches** the live page's form exactly — that part is not a delta.

### `guides/initiator/when-a-relationship-pauses.md`

When a Relationship Pauses · Built (#1143, #1235, #1236) · design deltas open · route `/dashboard/relationships/{trial}`

- **Matches** — The doc promises the line **"Stage 6 is paused. Your results and Discussion are saved and read-only."**; the live page draws exactly that sentence.
- **Matches, read from the pixels (rect-03)** — The doc promises the Paused chip with a pause icon and no red. The icon is a `lucide` `Pause` glyph inside a `Chip variant="soft"` (a grey chip — `bg-secondary`), not a red one; the captures at `tests/design-captures/initiator-when-a-relationship-pauses/live-{390,1280}.png` are where the colour is read, and copy rule 3 holds.
- **Fixed (rect-03)** — The reference's At a Glance card (the Aspect tally · Mode · Alignment Tolerance · Latest Round) is now drawn above the record's own facts card.

### `guides/initiator/your-7-days-free.md`

Your 7 Days Free · Built (#1116, #1117, #1156 via #1170) · design deltas open · route `/dashboard/relationships/{trial}?tab=payment`

- **Unreachable from the seed — unverified for the running trial.** The doc's trial markers — **"Free Trial · 3 Days Left"**, **"Trial Starts When {name} Accepts"** and **"Not needed"** — are absent from the captured page because the seeded relationship is **paused** (`Paused · Trial Ended`), and a paused window has no days left to count. The pill itself is rendered from `pause.daysLeft` and reads **`Trial · N Days Left` / `Extra Week · N Days Left`**; it is asserted in `tests/relationship-glance.test.tsx` and in the pause suite, not photographed. **Unverified for the running state at both widths.**
- **Partly fixed (rect-03)** — The trial chip is drawn only in a running window (see above) and cannot be captured from this seed. The Payment-tab half is fixed and **asserted, not photographed** (the tab set is client state; the instrument photographs the first tab): the tab now carries the reference's summary table — **Status · Billing Owner · After the Trial** with the plan's price — and a running window carries **"Add a card before <date> to keep Stage 6 running. If you don't, it pauses and nothing is lost."** See `tests/relationship-glance.test.tsx`.
- **Not fixed — the anchor is contested by the product itself.** The doc's Payment-tab claim — **"Trial Starts When {name} Accepts"** and **"Card: Not needed"** for a waiting invite — is not drawn. The `Card` half needs a read this page does not have, and the acceptance anchor contradicts the shipped rule (the trial starts at the publish) that the register's `stage-5-invite` row records as the highest-value open delta. A payment screen may not promise an anchor the code does not implement; the waiting state says **"No trial is running."** instead.

### `guides/shared/answer-the-assessment.md`

Answer the Assessment · Built (#1173, #1235) · design deltas open · route `/assessment/instances/{instance}/answer`

**Verdict `unverifiable`, not `matches`.** The state the reference draws is an _unanswered_ sheet, and
that state cannot be reached on the demo seed — so the comparison a `matches` would rest on has no
subject. What was captured, and what it says:

- ~~The doc promises the progress line **"Round 1 · Aspect 2 of 5"** and the save chip **"Saves as You Go"**; the live answer sheet is the **sealed** state and carries neither.~~ **Fixed.** The sealed
  sheet now draws the bundle's band — `ROUND 1 · 5 OF 5 ASPECTS ANSWERED` over five `done` segments
  and a `Sealed` chip — captured at 390 and 1280 for the **Initiator** and the **Counterparty**
  (`data/pages/assessment-answer.ts` `position-sealed` / `sealed-state`, and `AnswerSheet`'s
  `sealed` block, which draws the same `SheetBand` the live sheet draws).
- ~~The save state is a word with no icon (the open delta on #1173).~~ **Fixed.** The chip is the
  reference's badge (bundle rc1.3 `01-answer-screen-paused-1223/js/proto.js`): one `rounded-full`
  bordered pill carrying a mark _and_ a word, in the reference's four states — `Saves as You Go`
  (floppy), `Saving…` (spinner), `Saved` (check), `Not Saved · Pick Again` (undo) — Title Case per
  copy rule 1. The `sealed` chip is a fifth, and this screen's own: a sheet that takes no answer says
  `Sealed` rather than promising a save it cannot perform.
- **Still open, and not a build defect.** The reference draws `ROUND 1 · ASPECT 1 OF 5`,
  `Saved just now`, the two 1–5 rows (**Feel / How it is now**, **Wish / How you want it**) and
  **Next Aspect**; the live page is the sealed state, so none of them is on it. Both seats of the
  demo instance are already accepted — measured from the Initiator _and_ the Counterparty (`Waiting
  for Rowan` on one, `Waiting for Avery` on the other, both `Sealed`) — so the answering screen stays
  **`unverified for the answering state`** until a fresh invite can be walked end to end. The build
  already draws all of it in the writable branch (`SheetBand` + `AspectAnswerCard`); nothing about
  that branch is claimed here, because nothing about it was photographed.
- **Reached and correct in every other variant.** The `admin` seat answers **404** on this route (a
  browser holding no party row is told nothing, by design — `readFlowScreen`'s `undefined` is
  `notFound()`), and a signed-out visitor answers **404** for the same reason; neither is an absence
  in the capture. Session state: the sheet's only reachable state on this seed is `sealed · waiting`
  (both credits accepted, session not yet `complete`); the `lapsed` and review states were not
  reached on the demo rows and are not claimed.

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

Re-captured on `wt/rect-04-align` at `1707a32c` (local demo branch, 390 + 1280, signed in as the
Initiator **and** as the Counterparty): `Where You Agree, and Where You Differ`, `3 of 5 Aspects
Aligned`, `In Synch` / `Small Gap` / `Gap` with their counts, and a `NEXT STEP` band reading
`Talk About Your Widest Gap` with `Start the Conversation` are all in `live.txt` now. The three
bullets stay where they were as the record of what was asked for.

- **[fixed]** The doc's three status words — **In Synch**, **Small Gap**, **Gap** — are absent from the live relationship page at 1280, as is any Aspect tally — the summary block prints `3 of 5 Aspects Aligned` and one count beside each of the three words, all four figures off `alignmentSummaryOf()` so the sentence and the tally cannot disagree.
- **[fixed]** The page's Next Step band says **"Next Step · Continue Your Assessment"** and **"5 of 5 Aspects answered"** even though all five are answered — the answering band is now absent for that state (it is drawn while only one side has answered, unchanged, which is bundle 03's `rd-waiting-*` screen). The results no longer sit behind the **Complete and open the Gap** act: both sheets in is the condition the summary appears on, and that band keeps its own words because sealing Stage 6 is a different act.
- **[fixed]** The reference draws **"Where You Agree, and Where You Differ"**, **"3 of 5 Aspects Aligned · 1 In Synch · 2 Small Gap · 2 Gap"** and a **NEXT STEP** band with **Start the Conversation**; none of those lines is on the live page — all three are now, with `Start the Conversation` opening the Discussion tab (`#discussion`). The reference lines still missing fell from 131 to 110 at both widths.
- **[open]** The reference's Next Step heading names a short Aspect title (**"Talk About Parent Decisions"**); this model's Aspect carries only its prompt question, so the band heads `Talk About Your Widest Gap` and names the Aspect in the sentence beneath. Pressing a question into a title is the alternative, and it reads as a typo.
- **[open]** The reference's Aspect-by-Aspect section — the per-Aspect status chips (`Small Gap · OK`), the `To Talk About` / `Aligned` filter row with its counts and the paired answer bars — is not drawn here. This card owns the summary, the tally and the Next Step band only; the list is a separate surface's work.

### `reference/copy/copy-rules.md`

Copy Rules · Designed · route `—`

- **Fixed — rule 1 (Title Case).** `data/pages/assessment-create.ts:406` carried the label **"send email to counterparty now"**; it now reads **"Send Email to Counterparty Now"**, and `docs/specs/flow-stages.md` quotes the new label in both places it names the control, so the spec and the button cannot drift apart again.
- **Fixed — rule 5 (say "Stage 6", and "Extra Week").** `lib/relationship/membership.ts:461` now returns **"…, so Stage 6 is paused."**, and the two subjects read **"Stage 6 is paused for now"** (`lib/email/templates/relationship-paused.ts:47`) and **"Your trial ended — Stage 6 is paused"** (`lib/email/templates/trial-ended-paused.ts:46`). The lapse sentence's other retired word went with it: **"free 7-day Extra Week"** where it said "extension", and the body's markdown moved the same way.
- **Unverifiable — rule 3 (no red) and rule 2 (status is icon plus word).** Both are pixel and semantics claims, and a DOM-text read cannot see either, so they are read off `tests/design-captures/<surface>/live-{390,1280}.png` by a person.

### `reference/copy/glossary.md`

Glossary · Designed · route `—`

- **Open — the session noun, deliberately not renamed.** The glossary's write-it-as column says **Assessment** where v1 said quiz, and **Relationship** where v1 said session; the live answer sheet still says **"You have accepted this session"** and **"this session sealed"** — live `tests/design-captures/shared-answer-the-assessment/live.txt`, source `data/pages/assessment-answer.ts:148`. This repo's own gate-enforced vocabulary (`scripts/vocabulary.ts`, E41) says **session** is the correct reader-visible noun for one cycle of answering and retires **instance** instead, and `docs/glossary.md` is generated from the schema on that model. Two vocabularies disagree on the same word, so renaming the fixtures would contradict the one the gate enforces — that decision is the owner's, and this card does not spend it.
- **Fixed.** The glossary's **Extra Week** entry is no longer contradicted in code: `lib/relationship/pause.ts:46` exports **`EXTRA_WEEK_DAYS`**, and the copy that spends it says "Extra Week" rather than "extension".

### `reference/copy/retired-terms.md`

Retired Terms · Designed · route `—`

- **Open — the session noun.** The retired term **session** survives in live copy: **"Review and accept this session"** (`data/pages/assessment-accept.ts:28`), **"Accept this session"** (`:59`) and the answer sheet's **"this session sealed"** in `tests/design-captures/shared-answer-the-assessment/live.txt`. Same reason as the glossary row above: E41 names session the correct noun for one cycle, so the two docs' tables and the gate's rule disagree and the rename is the owner's call.
- **Fixed.** The retired phrase **"Align is paused"** is gone from `lib/relationship/membership.ts:461`, the very line this doc quoted as its own evidence: the Initiator's lapse line now ends **"…, so Stage 6 is paused."**, matching the Counterparty's half of the same sentence.

### `reference/emails/counterparty-joined.md`

Counterparty Joined Email · Built (#1227, PR #1240) · no delta · route `—`

- **Matches — the citation moved, the line it wanted is drawn.** The doc cited `content/email-bodies.md:91` for a trial sentence the body no longer carries; the sentence lives in the template now — `lib/email/templates/counterparty-joined.ts:92` draws **"Your 7 days free start today."** only when `onFreeTrial`, which is precisely the doc's At a Glance ("only on a free trial"). The #1227 delta is closed, and the doc's evidence row now cites the line that carries it.
- **Matches — the subject is live as documented**: `lib/email/templates/counterparty-joined.ts:54` **"{joiner} joined — your assessment can start"**. The row's `design deltas open` status was the stale half, and the doc's frontmatter now reads `no delta`.

### `reference/emails/paused-counterparty.md`

Paused Email (Counterparty) · Built (#1168) · no delta · route `—`

- **Fixed — the retired phrase is gone from both surfaces.** The subject is `lib/email/templates/relationship-paused.ts:47` **"Stage 6 is paused for now"** and the body is `content/email-bodies.md:125` **"Stage 6 is paused for now; you'll hear when it resumes."**
- **Fixed — the At a Glance is drawn.** The doc promises the Counterparty learns **Stage 6** is on hold and nothing else; both surfaces now name Stage 6, and neither carries a cause, a plan or a price.

### `reference/emails/paused-initiator.md`

Paused Email (Initiator) · Built (#1168) · no delta · route `—`

- **Fixed — both surfaces say Stage 6.** The subject is `lib/email/templates/trial-ended-paused.ts:46` **"Your trial ended — Stage 6 is paused"** and the body is `content/email-bodies.md:118` **"Stage 6 is paused on {{template}}. Nothing was deleted…"** — neither uses the phrase copy rule 5 retires.
- **Fixed — the resume half.** The document now carries the promise the doc's At a Glance makes: **"You have two ways back, and both resume Stage 6: Add a Card and it picks up straight away, or Get 7 More Days Free — your one free Extra Week, once — before anything is charged."** (`trial-ended-paused.ts:96`), with the relationship's own link and `/pricing` beneath it.

### `reference/stages/stage-1-details.md`

Stage 1 · Details · Built (#1144) · design deltas open · route `/dashboard/templates/{template}/create`

- The reference heads the stage **"Name Your Relationship"** and asks for **Relationship Title**, **Your Shared Goal** and **Your Role** ("I'm the Brother"); the live stage 1 heads it **"Relationship Details"** and asks for title, both first names, an email and a description — live `tests/design-captures/stages-stage-1-details/live.txt`. — **recorded, reference is the stale side**: `docs/specs/flow-stages.md` opens its stage-1 section with the heading, the body sentence and the full field inventory, and says in as many words **"Do not add a field the artifact does not draw … Do not drop a field."** The live form is the pinned one; the reference's three fields are a superseded draft of the same screen. Following it would be the defect the spec names, so it is not followed.
- The reference's advance control is **"Continue to Settings"**; the live one is **"Continue to Stage 2"**. The live label is the one `docs/specs/flow-stages.md` pins, so the reference is the side that is stale — recorded, not followed.
- The reference draws **"Stage 6 Align starts when Elena joins"**; the live rail draws **"Stage 6 Align starts when they join"** — the same sentence with the seed's name removed. That is a name difference, not a design delta, and is not counted.

### `reference/stages/stage-2-settings.md`

Stage 2 · Settings · Built (#1144) · design deltas open · route `/dashboard/templates/{template}/create/mode`

- The doc's **Opinions Mode** and **Alignment Setting** labels are both drawn live, and so are the four option words (**Basic Mode**, **Advanced Mode**, **Soft**, **Full**) — those **match**.
- The reference heads the stage **"Choose How You Compare"** with the sub-line **"Two choices. The defaults suit most first rounds."**; the live stage 2 heads it **"Relationship Settings"** with **"Two independent choices: Mode decides how many Opinion questions each Aspect asks, and Setting decides how strictly the Gap analysis is judged."** — a different heading and a different sentence. — **recorded, reference is the stale side**: `docs/specs/flow-stages.md`'s stage-2 section names the stage heading **`Relationship Settings`**, the two `fieldset` legends, and the reason the sentence spells both dimensions out ("Mode and Setting are two independent dimensions of equal weight"). The reference's sub-line is the version that sentence replaced.
- The live page carries **"Opinions Mode · Fixed at creation"**, which the reference does not draw: a field-state the doc does not describe. — **recorded, and the live side is the one the spec pins**: `docs/specs/flow-stages.md` says **"`Fixed at creation` rides beside the Opinions Mode legend as a chip"**. This is the reference missing a chip the flow is required to draw, not a live addition to remove.

### `reference/stages/stage-4-account.md`

Stage 4 · Account · Built (#1144) · design deltas open · route `/dashboard/templates/{wizardTemplate}/create/commit?instance={draftInstance}`

- Heading case: the doc and `docs/specs/flow-stages.md` say **Create Your Account**, and the live stage 4 renders **"Create your account"** — copy rule 1, Title Case for every label and heading — live `tests/design-captures/stages-stage-4-account/live.txt`, source `data/pages/assessment-create.ts:363`. — **fixed**: the heading renders **Create Your Account**, and so does the page's `metadata.title`; the registry row that quotes the heading moved with it.
- The doc's advance control is **"Continue to Stage 5"** and it is drawn — that part **matches**; so does the doc's body sentence **"Your answers stay on this device until you sign in."**
- The live page adds a paragraph the doc does not describe — **"The relationship exists as a draft. The account it belongs to is the one you are signed in with."** — which is #825's draft-write behaviour arriving on a screen whose doc still describes signing up as what writes the draft. — **recorded, not a screen defect**: `docs/specs/flow-stages.md`'s stage-4 section is the sentence's own provenance. The doc is the stale side, and it lives in the spec drop.

### `reference/stages/stage-5-invite.md`

Stage 5 · Invite · Built (#1144) · design deltas open · route `/dashboard/templates/{wizardTemplate}/create/invite?instance={draftInstance}`

- The doc's primary action is **"Continue with 7 Days Free"**; the live page's primaries are **Next** and **Continue as Draft**, and **Continue with 7 Days Free** appears nowhere in the page text — live `tests/design-captures/stages-stage-5-invite/live.txt`. — **closed as a capture-state error**: the control is the walk's plan-panel action (`plans.free-continue`) and the create path reaches it; **Next** is that same panel's step control. The register photographed a demo seat whose membership was already live, so the walk opened past the plan panel. `tests/trial-no-payment-inputs.test.ts` pins the unpaid panel and its control.
- The doc's whole reason for that label is the anchor: _"the trial starts when Elena accepts"_. The live page states the opposite — **"The plan is active and the card is on file. Nothing has been charged today — the trial starts when the card is saved."** The trial is anchored on the **card**, not on the acceptance, and that is the single highest-value delta in this register. — **fixed, and the delta was real**: the plan panel printed `plans.body` — the purchase panel's card anchor — immediately above `plans.trial-free`, which anchors the week on the Counterparty's acceptance. Stage 5 stated both anchors in one column, and the card sentence is the one a reader meets first. The card-free panel draws `plans.body-free` now and leaves the single anchor to `trial-free`; the walk's later steps carried the same claim — `payment-flow.thanks-body` and `invite.active` both say **"the card is on file"** — and a member's create path opens on the thank-you, which is the seat this register kept photographing, so both draw `plans.active-free` as well. `tests/trial-no-payment-inputs.test.ts` fails if either card sentence returns to the create path.
- The reference draws the **What Elena Sees** preview panel; the live page draws **What you can do later** and no invitee-facing preview. — **fixed**: the preview is drawn beside the two acts in `components/assessment-flow/stage-invite.tsx` — the Counterparty's name, and the three facts the invitation carries, read off the draft. Subject and body are not restated (they live in `lib/email/templates/`). `tests/stage5-invitee-preview.test.ts` pins the panel, its unnamed fallback and its refusal to duplicate the message.

### `reference/stages/stage-6-align.md`

Stage 6 · Align · Built (#1144, #1147, #1148) · design deltas open · route `/dashboard/relationships/{relationship}`

- **Fixed (rect-03)** — The reference's **In Synch / Small Gap / Gap** chips are drawn on this page: the At a Glance card prints one mark per Aspect in the model's three severities plus the counts. **Captured:** `tests/design-captures/stages-stage-6-align/live.txt` at both widths carries **At a Glance · 2 of 5 Aspects Aligned · 2 In Synch · 1 Small Gap** over this round's own answers, beside Mode · Alignment Tolerance. The reference's **"Where You Agree, and Where You Differ"** heading and its **NEXT STEP** band belong to the **Align** screen (bundle 04, `align.html`), which this route is not — the register's `results-and-align` row pairs that copy with bundle 04. The live page's **Next Step · Continue Your Assessment** band is unchanged and still correct for a relationship whose sheets are sealed but whose Gap has not been opened.
- **Fixed (rect-03)** — **"Align stays live until the relationship closes."** is now drawn on the completion band, beneath the sentence the page already carried.

### `reference/states/relationship-states-by-role.md`

Relationship States by Role · Built (#1148, #1143) · design deltas open · route `/dashboard/relationships`

- **Open.** The doc's state vocabulary is **Draft · Invite Sent · Both Joined · Waiting for {name} · Results In · Trial Ended · Extra Week Ended**; the live list draws **Stage 6 Live · Waiting on Invite · Draft · Paused** with counts — different words for overlapping states — live `tests/design-captures/states-relationship-states-by-role/live.txt`. Not fixed here: that chip row is the control the `my-relationships-and-start` row of another bundle also owns, and renaming a chip set is a product decision rather than the copy edit this card owns.
- **Open.** Two of the doc's seven states (**Results In**, **Extra Week Ended**) have no live chip at all in the captured list. Whether the list gains two chips or the doc drops two words is the owner's call, and this card does not invent either answer.

### `start/core-concepts.md`

Re-captured on `wt/rect-09-tokens` at `0aecacd0d` (local demo branch, 390 + 1280): `Stage 6`,
`1 Details` … `6 Align`, `In Synch · Small Gap · Gap` and `Extra Week` are all in `live.txt` now.
The route is `auth: public`, so the three audiences the doc declares — **Visitor, Initiator,
Counterparty** — read the same two vocabulary bands; the only role-switched element on the page is
the secondary CTA, which is hidden for a signed-out reader and captured both ways. Session state is
not a variant here: the page draws no trial, pause or live chip of its own.

- **[fixed]** The doc's concepts are **Stage 6**, **Extra Week**, **Gap** and **Aspect**; the public `/how-it-works` page draws **"One relationship, six moves"** and walks the create flow screen by screen, and its text carries `Gap` but neither **Extra Week** nor a Stage 6 explanation — live `tests/design-captures/start-core-concepts/live.txt`. — two fixture bands now carry the two missing words: **"Where the moves end: Stage 6, Align"** enumerates `1 Details · 2 Settings · 3 Aspects · 4 Account · 5 Invite · 6 Align`, says what Stage 6 is (both sheets side by side, one status per Aspect judged against the Setting, one Step per unmet Gap) and states that the page's six _moves_ are those stages seen from the reader's side; **"The Extra Week"** names the 7-day trial, the pause that is not a close, and the Initiator's one free week. `3 of 4` of the doc's concepts are now on the page — `Gap` and `Aspect` were already there, `Stage 6` and `Extra Week` were not.
- **[open]** The reference this row is paired with (onboarding bundle, `relationship-templates.html`) is not the page `/how-it-works` replaces — no bundle draws `/how-it-works`, which is why the pairing is a vocabulary comparison and not a screen comparison. — nothing on the surface can close this: it is a fact about the pairing, already recorded in the `note` for this row in `docs/specs/v2-surface-routes.json`, and it stays open until a bundle draws the page. It is named here so the row does not read `matches` on the strength of a comparison that was never a screen comparison.

### `start/quickstart.md`

Quickstart · Built (#1144, #1147, #1173, #1145) · design deltas open · route `/dashboard`

- The doc's path starts at **Your Next Steps**; the live `/dashboard` draws it with **2 to do** and one Next Step, and the doc's second job **Finish and Send the Invite** is absent — live `tests/design-captures/start-quickstart/live.txt`. — **not fixed here, and deliberately**: `/dashboard`'s Start band is the surface of a different bundle's row (`guides/initiator/my-relationships-and-start.md`, bundle 05), and this card may not reorder a screen another bundle owns. A second job in that band is a feature on that screen, not a copy change, so it belongs to the card that owns `/dashboard`.
- The reference's Start band reads **"One thing to talk about, and two small jobs."** with **3 to do**; the live headline is **"Your relationships, and what is next for each."** — the same delta as the `my-relationships-and-start` row, because it is the same screen. — **not fixed here**, for the same reason: one screen, one owner. Recorded so the two rows cannot be counted twice when `/dashboard` is carded.

### `start/what-is-alignsynch.md`

What Is AlignSynch · Built (v2.0.0-rc1.2 on main) · design deltas open per guide · route `/`

- **Open — the home's vocabulary is not the doc's, and the gap is narrower than it looked.** The doc
  explains the product in its own words: **Aspects**, the **1–5 scale**, and **Align** marking every
  Aspect **✓ In Synch**, **≈ Small Gap** or **⚑ Gap**. The live `/` opens **"For business and
  corporate relationships" → "Bring expectations into the open at work."** and its primary action is
  **"Explore business templates"**. It does carry two of those words — **"Are you In-Synch with
  ______?"** in the Questions band and **"Where the answers part is the Gap."** above the footer —
  but **Small Gap** appears nowhere and the three-word status set is never drawn. Re-measured
  `b8868c6b1`, live `tests/design-captures/start-what-is-alignsynch/live.txt`. This is a copy and
  positioning decision on the product's front door (business-first, with personal relationships as
  the second family), not a delta against a drawn reference, so it is named here rather than fixed.
- **Open, and out of this instrument's reach — no bundle draws `/`.** The pair for this row is
  bundle 02's `pricing.html`, which is not the home page, so no reference render of `/` exists to
  compare against and the vocabulary comparison above is the only claim this row makes. Closing the
  row needs either a bundle render of the home page or the doc re-pointed at the screen it actually
  describes.

## Matches — the doc's promise is drawn

A match is a comparison that was made, not a row nobody looked at.

- **`guides/account/delete-your-account.md`** — Live `/settings` draws **Delete Account** and the confirm phrase **"delete my account"**, both of which the doc's At a Glance promises; nothing in the doc's two rows is missing from the page text.
- **`guides/account/profile-and-password.md`** — Live `/settings` draws **Profile**, **Display Name**, **Profile URL**, **Save Profile** and the read-only email line the doc describes. The reference's five extra lines are First/Last Name and Current Password, which are the _prototype's_ field set — the doc already says the bundle 11 render is stale, so the reference is the side that moved.
- **`guides/initiator/payment.md`** — Live `/dashboard/payment` draws **Memberships**, **Payment Method**, **After the Trial** and **$9.99 / month** — the four things the doc's two rows promise — and its preamble repeats the doc's own trial sentence.
- **`reference/emails/invitation.md`** — No screen to capture: the subject is `lib/email/templates/invitation.ts:42` **"{inviter} invited you to a {template} assessment"**, which is the sentence the doc quotes, and the reminder subject is `lib/email/templates/invitation-reminder.ts:60`. Verified in source, which is where this doc's subject lives.
- **`reference/emails/release-notes-and-banners.md`** — No screen to capture: `public/og/` holds the three rasters and `lib/email/release-note.ts:64` reads the changelog section, both as the doc states. Verified in source.
- **`guides/counterparty/save-these-aspects-as-a-template.md`**, **`guides/counterparty/when-a-relationship-pauses.md`**, **`guides/initiator/when-a-relationship-pauses.md`** and **`reference/stages/stage-6-align.md`** _(rect-03 — captured, verdict held at `deltas`)_ — These four were re-captured at 390 and 1280 on the fixed tree and their bullets now quote the captured text: **Keep These Aspects for Yourself** / **Save This Template to My Templates**; **Paused · Waiting on Avery** in a soft-grey chip; **At a Glance · Mode Basic · 2 Opinions · Soft · Small Gap OK · Round 1**; **2 of 5 Aspects Aligned · 2 In Synch · 1 Small Gap**; and **Align stays live until the relationship closes.** They are listed here rather than under `matches` because their frontmatter still reads `· design deltas open`, and the verdict cannot outrun the status it is read against.
- **`guides/initiator/if-a-draft-cant-be-created.md`** — Live `/assessment/new/failed` draws the heading, **"Try Again Shortly. Nothing was sent and nothing was charged."** and both actions, which is the doc's At a Glance row for row. The page is the capture; the sentence the bundle omits is the doc's, added verbatim.
- **`reference/emails/counterparty-joined.md`** — No screen to capture: the subject is `lib/email/templates/counterparty-joined.ts:54` and the trial line is the `onFreeTrial` paragraph at `:92`, which is the doc's "only on a free trial". Verified in source.
- **`reference/emails/paused-counterparty.md`** — Verified in source: subject and body both say **"Stage 6 is paused"**, and neither carries a cause, a plan or a price.
- **`reference/emails/paused-initiator.md`** — Verified in source: subject and body say **"Stage 6 is paused"**, the body says nothing was deleted, and the document names both ways back (**Add a Card**, **Get 7 More Days Free**).

## Not built — the surface the doc describes does not exist

Two are `Planned` in their own frontmatter and have no surface at all; the third is a dated list.

- **`reference/changelog.md`** — A dated list of what changed, not a screen: there is nothing to capture and nothing to build. `not-built` here means _no surface_, which is the honest reading of a `Designed` status on a changelog.
- **`reference/emails/trial-started.md`** — Planned (PR #1240). There is no template file to compare: the line the doc describes does not exist in `lib/email/templates/`.
- **`start/plans-and-trial.md`** — Planned (PR #1241): the per-plan price line and the Basic-only plan are not built. The live `/pricing` draws **Basic · 1 relationship · $9.99 / month** and **Test mode: the card checkout runs on test keys**, while the reference still draws **Single**, **Family** and **Single Annual** — the reference is a generation behind the one-plan decision and the planned line is what would close it.

## Unverifiable — and the exact reason

These are rows a capture cannot judge. Naming the reason is the deliverable; a guess would be the defect.

- **`reference/copy/copy-rules.md`** — Rules 1 and 5 are text claims and are now fixed in the tree (the label and the three "Stage 6" strings); rules 2 (**status is icon plus word**) and 3 (**no red**) are not. An icon beside a word is semantics, and "no red" is paint: both are read off the captures at `tests/design-captures/<surface>/live-{390,1280}.png`, by a person. A `matches` here would be a text comparison claiming a pixel verdict.
- **`guides/account/account-menu.md`** — The menu is a disclosure behind the avatar. The page at rest carries neither **Account Settings** nor **Sign Out** (they are inside the closed disclosure), so the harness cannot judge them without opening it — and an optimistic `matches` off a closed menu is exactly the optimism this register exists to end.
- **`guides/admin/who-sees-the-admin-rail.md`** — The rail renders as icons at 1280 and collapses to a drawer at 390; the page text carries neither row name (**CRUD & Permissions**, **Email Templates**), so the by-seat claim cannot be judged from a capture. Judging it needs three signed-in seats and a pixel comparison, not a DOM read.
- **`guides/counterparty/accept-or-decline-an-invite.md`** — Needs a live `/invite/{token}`. The demo seed does not publish its waiting invite's token outside the Initiator's copy-link control, so the harness recorded the route as unresolved rather than photographing **"No such invitation"** and calling it the join screen.
- **`guides/counterparty/ask-to-be-removed.md`** — **Leave Relationship**, **Request My Removal** and **Close This Relationship** are all inside the relationship's ⋮ menu and its dialog. The capture is the page at rest, so none of the three appears in its text — a missing delta would be a guess, and the doc itself says there is no render of this flow to pair it with.
- **`guides/shared/leave-a-relationship.md`** — Same reason as `ask-to-be-removed`: the flow is a menu item and a confirm dialog, the capture is the list at rest, and the doc says _"no shot: there is no bundle, QA, spec or prototype render of the leave flow"_. The seeded relationship at this address has in fact been left — the page draws **"This relationship is closed"** — but the dialog that got it there is not capturable this way.
- **`guides/shared/propose-a-change.md`** — The lock copy (**"Aspects are Locked"**, **"Changes are proposed and agreed by both of you."**) and the propose control live on the **Aspects** tab, and the tab is client state with no address: `?tab=aspects` renders the Discussion panel, which is what the capture holds. A delta taken from it would describe the wrong panel.
- **`reference/stages/stage-3-aspects.md`** — Stage 3's own address answers `307 → /create` on every seeded instance, and the flow cannot be driven past stage 2 headlessly: stage 2's advance control is inert until a Mode/Setting choice is recorded, and the harness does not make product choices on a reader's behalf. The row carries **no reference render** on purpose — pairing stage 3's reference with a stage-2 screenshot would be the guess this register exists to avoid.
- **`reference/states/answer-scale.md`** — The 1–5 scale and its two labels are drawn by the _answering_ sheet, and the seeded instance is already accepted, so the capture is the sealed/review sheet. The scale is `unverifiable` until a fresh invite is walked to the answering step.
- **`reference/states/status-chips.md`** — The doc's chip words (**In Synch · Small Gap · Gap**) are drawn by the Aspects/Align panel, which the capture cannot open — `?tab=` is client state, so every tab URL renders the Discussion panel. The page does draw chips (**Paused**, **Your Trial Ended**, **Complete**), so the primitive is live; three of the doc's four words are simply not on this panel.
- **`guides/initiator/add-a-card-or-take-your-extra-week.md`** _(rect-03)_ — Every remaining bullet is on the **Payment tab**, and the tab set is client state started on the first tab: `?tab=payment` does not select it and `relationship-detail.tsx` holds no server-side tab read, so the instrument photographs the first tab at both widths. The tab's summary rows are held by `tests/relationship-glance.test.tsx`, which is an assertion and not a capture; the register will not write `matches` off one. Opening the tab in the instrument is what would close this row.
- **`guides/initiator/copy-resend-or-cancel-an-invite.md`** _(rect-03)_ — **Copy Invite Link** and **Resend Invite** are drawn by the `hygiene` panel, which renders only for a live invitation on an **unclaimed** seat; the seeded relationship at this address is `invite-claimed`, and the waiting-invite state the reference draws (**Waiting on Elena to Join**) is not a state this seed can reach. Verified in `tests/relationship-detail.test.ts`, not photographed — **unverified for the waiting state at both widths**.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Specs & design briefs** › v2 rectification register — every delta, named · prev [v2 coverage matrix — the 23 screens, measured](v2-coverage-matrix.md)

<!-- docs-nav:end -->
