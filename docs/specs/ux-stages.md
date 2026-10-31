# UX Spec — The Stage Display (Invited → Connected → Sharing → Aligned)

**Recommendation: no stepper, no stage bar.** Show **one status sentence** naming the current
stage and who acts next (derived, never stored), and render **Aligned only as a verdict on the
report**, not as a fourth step. If a richer display is wanted later, use a **process list**
(USWDS/VA "process list", GOV.UK task-list style) on the instance screen — a vertical list of the
four named stages with the current one marked and completed ones checked — never a linear
stepper/segmented progress bar. The stepper is dishonest here for three structural reasons:
stages are **not driven by the viewer's actions**, **not all reachable** (Aligned depends on the
Setting and the numbers), and **partial progress between stages must not be shown** (the blind
rule).

## The obvious approach — a 4-step stepper — and why it loses

The spec mockup (08-stage-bar-and-stage-terms.png) draws a linear box-and-arrow stepper, and a
stepper is the obvious answer to "four stages". Against it:

1. **A stepper's premise is "you do the next step".** USWDS: the step indicator is for a user
   working through a form spanning pages, complementing back/next navigation. Here the viewer
   does _not_ drive the transitions: Invited→Connected is the counterparty's click; Connected→
   Sharing is both parties' submissions; Sharing→Aligned is nobody's action — it is arithmetic
   (`instanceAlignment`) over frozen numbers. A bar that doesn't move when you act, and moves
   when someone else does, reads as broken. NN/g: misleading indicators erode trust ("A
   progress bar that fills up without reflecting actual progress creates false expectations").
2. **Stages can stall and loop, not just advance.** An invitation can expire (7 days) leaving
   the instance at Invited forever; re-inviting keeps it at Invited. A stepper has no honest
   state for "stuck with no next action" — it just looks inert. SPEC-DRIFT §2 (UC150) already
   flags that the initiator never learns of expiry; a stage bar would make that silence visible.
3. **Aligned is a verdict, not an event — and it is Setting-relative.** The same frozen numbers
   are Aligned under Soft ("Small Gap (1) OK") and not under Full ("No Gap OK"). A terminal
   step that flips with a Settings choice, and that most relationships never reach, either lies
   (shown optimistically) or perpetually shows an unfinished journey. Conflating the unlock
   event (Sharing) with the verdict (Aligned) in one bar is a category error: one is "the
   report is open", the other is "the report says X".
4. **The blind rule forbids the interstitial state a stepper implies.** A bar between Connected
   and Sharing invites "how far along is the other person?" — the exact count
   `lib/flow/state.ts` refuses to expose ("no score, no '3 of 5 answered', no partial Gap").
   The only honest stepper would jump Connected→Sharing in one bound, which looks broken.
5. **The two documents disagree with each other and themselves** (glossary: six stages;
   spec: eight A–D + 1–4; ruling in SPEC-DRIFT §4.3: four relationship stages). Shipping a
   visual locks in the most contested number in the spec — and the mockups are "inspiration,
   not requirements" (SPEC-DRIFT §9). Material Design has removed the stepper from its M3
   guidelines entirely; MUI documents it as legacy.

## What to show instead

- **Instance screen (`AssessmentInstanceView`):** a single status sentence above the existing
  bands, mapping the already-derived `FlowScreen.status` to the four names:
  - `awaiting_counterparty` → **"Invited — waiting for {name} to accept"** (or, when expired,
    the honest expired-invite sentence with a re-invite action, per UC150).
  - `answering` → **"Connected — {who} still owes answers"** (the existing `waiting` band
    already says who; the stage sentence just names the stage).
  - `complete` → **"Sharing — the report is open to both of you."**
    Never add a count. The sentence goes in `data/pages/assessment-instance.ts` (E23).
- **Report (both `AssessmentReportView` and the instance screen's complete band):** the
  verdict, not a stage: **"Aligned under Soft"** / **"{n} Gaps exceed Full"** from
  `instanceAlignment` (see ux-report.md). This is where "Aligned" belongs — it is a property
  of the numbers, computed only once both parties' opinions are readable anyway.
- **Optional process list (if §4.3's "derived and named" bar is ever wanted):** an `<ol>` on the
  instance screen, four items with the current one `aria-current="step"`, completed ones marked
  with a check **plus** the word "Complete" (never check-only — WCAG 1.4.1), pending ones
  neutral. This is the pattern the VA.gov guidance names for "tracking progress over an
  extended period of time", because it reports states without implying the user's own next
  click. The fourth item reads "Aligned — decided by your Setting, shown on the report" or is
  omitted until the report exists, precisely because it is not a step.

## Why not the other obvious forms

- **Linear progress bar (fill %).** Percent implies distance-to-goal on a task the viewer
  controls; here 50 % would mean "the other person is halfway" — a blind-rule leak or a lie.
- **Checklist/checkout stepper with ticked boxes.** Invites the "which step is mine?" reading;
  two of the four steps are the other party's actions, and one is nobody's.
- **Showing nothing.** Honest, but the spec's customers were told stages exist (the PDF's
  mockup; the glossary), and the existing three statuses are already _de facto_ stage names in
  disguise — naming them with the ruled vocabulary costs one sentence and removes the
  "what happens next" question that sits at the top of every waiting screen. A stage _name_ is
  cheap and true; a stage _bar_ is neither.

## Accessibility consequence and failure modes

A status sentence is plain text — zero new semantics, fully announced, no colour, no list
ordering to get right. The process-list variant uses a real `<ol>` with `aria-current="step"` and
text-completed markers, satisfying 1.3.1 and 1.4.1. **Failure modes if a stepper were shipped:**
(a) screen-reader users hear "step 2 of 4" for a step they cannot perform — the stepper's own
semantics assert a next action that is the other person's; (b) colour-only completed states fail
1.4.1; (c) any sub-step count leaks the blind-rule data the schema comments treat as a defect;
(d) an "Aligned" step that never lights under Full makes the product look failed when the couple
simply chose Soft; (e) a stale "Invited" bar with an expired invitation reads as a bug report,
not a state. **Failure mode of the recommendation:** the sentence could drift from the derived
status if someone maps it by hand — prevent by mapping in one pure function (below) and unit-
testing every transition, the same discipline as `myInstanceStateOf`.

## Sources

- **USWDS, Step indicator** — https://designsystem.digital.gov/components/step-indicator/
  Use for forms spanning pages with linear back/next; "When to consider something else": steps
  that change due to input, nonlinear progression, fewer than three sections. Current step =
  most prominent, `aria-current`, completion status in visually hidden text.
- **VA.gov Design System, Segmented progress bar** —
  https://dev-design.va.gov/3970/components/form/progress-bar-segmented
  "Tracking progress over an extended period of time: use the Process list component"; "Steps
  can be completed in any order: consider Master/Detail… and provide status".
- **GOV.UK Design System, Task list component/pattern** —
  https://design-system.service.gov.uk/components/task-list/
  For services users cannot complete in one sitting and whose tasks have order freedom; each
  task shows name + status; do not use when steps must run in a fixed order.
- **NN/g, "Wizards: Definition and Design Recommendations"** —
  https://www.nngroup.com/articles/wizards/
  A wizard is steps the _user_ completes in a prescribed order, with the current step
  highlighted; "if there are substantial benefits to completing steps in an arbitrary sequence…
  this functionality is not suited to be provided as a wizard."
- **NN/g, smart-device onboarding / progress indicators** —
  https://www.nngroup.com/articles/smart-device-onboarding/ (and
  https://www.nngroup.com/articles/progress-indicators/)
  "Misleading indicators quickly erode trust. A progress bar that fills up without reflecting
  actual progress creates false expectations."
- **Material Design / MUI, Stepper** — https://mui.com/material-ui/react-stepper/ — "This
  component is no longer documented in the Material Design guidelines" (steppers were removed
  from M3).
- **WCAG 2.2** — https://www.w3.org/TR/WCAG22/ SC 1.3.1 (list semantics), 1.4.1 (never
  check-only completion), and ARIA `aria-current="step"`.
- **docs/SPEC-DRIFT.md §3–4** — glossary says six stages, spec says eight, ruling #4.3 says four
  relationship stages with "No Stage Bar visual until the four are derived and named";
  mockups are inspiration, not requirements (§9); UC150: the initiator never learns an invite
  expired.
- **lib/flow/state.ts (repo)** — the blind rule as code: `MY_INSTANCE_STATES` deliberately says
  "no score, no '3 of 5 answered', no partial Gap" — the constraint any stage display must honor.

## Implementation sketch (real files)

1. **New `lib/flow/stage.ts`** (pure, like `lib/flow/state.ts`): export
   `RELATIONSHIP_STAGES = ["invited", "connected", "sharing", "aligned"] as const` and
   `relationshipStage(status: InstanceStatus): RelationshipStage` mapping
   `awaiting_counterparty → invited`, `answering → connected`, `complete → sharing`
   (never `aligned` — the verdict comes from the report projection). Unit tests in
   `tests/flow-state.test.ts` style for all three statuses.
2. **`lib/assessment-report.ts`** already gains the verdict (ux-report.md); the report's
   verdict band renders "Aligned under {Setting}" — the only place the word Aligned appears,
   because only a complete instance can compute it (pre-complete screens cannot read the other
   party's opinions: `visibleRoles`).
3. **`components/assessment-flow/instance-view.tsx`** — add the stage sentence above the
   waiting/invite bands: `<p data-stage={stage}>` filled from a new `stage` section of
   `data/pages/assessment-instance.ts` (E23). When the instance is complete, the sentence says
   "Sharing…" and the verdict band (report section) carries Aligned/not-Aligned.
4. **Optional process list** — if built, lives as a small component
   `components/assessment-flow/stage-list.tsx` rendering the `<ol>` described above, fed by
   `relationshipStage()` plus `screen.invite.claimed`; no counts anywhere in its props (make the
   type have no count fields, the same way `FlowScreen` omits the other party's progress).
5. **No changes** to `content/` — stages are derived vocabulary, not schema; `instanceAlignment`
   in `content/gaps.ts` already computes the aligned verdict.

## Acceptance criteria

1. `lib/flow/stage.ts` exists and `pnpm typecheck` passes; a unit test asserts the full mapping
   table: `awaiting_counterparty→invited`, `answering→connected`, `complete→sharing`, and that
   `aligned` is unreachable from `relationshipStage` alone.
2. `grep -riE "stepper|step-indicator|step indicator|usa-step" components/ app/` returns no
   matches in the assessment flow — no stepper markup ships.
3. Rendered instance screen (render test with `renderToStaticMarkup` or parity render) contains
   the stage sentence with `data-stage` for each of the three statuses, and the sentence text
   comes from `data/pages/assessment-instance.ts` — asserted by checking the component file has
   no stage-name string literal (E23 grep).
4. The word "Aligned" appears in the rendered output **only** on complete instances' verdict
   band: `grep -l "Aligned" components/` shows the report component and the copy file, and the
   render test asserts the pre-complete instance screen text lacks it.
5. Blind rule: the rendered instance screen for an `answering` instance contains no digit
   expressing the other party's answered count — a test regex-sweeps the markup for
   patterns like `answered \d+` / `\d+ of \d+` and finds none (the sentence must name who acts,
   never how far along).
6. Expired-invite honesty: given an instance whose invitation is past its 7-day claim window,
   the stage sentence states the invitation expired and offers the re-invite action (ties to
   SPEC-DRIFT UC150) — unit test on the copy selection, plus an integration test if the store
   exposes `expires_at`.
7. If the process list ships: the `<ol>` carries exactly four items, the current one has
   `aria-current="step"`, completed markers include the word "Complete" in text (not check
   icon alone), and no item contains a numeric count — checked in the render test and with axe.
8. `bash scripts/verify.sh` exits 0; the parity manifest for the affected routes is updated with
   `pnpm parity:update --reason "stage sentence added"` only after review, or the harness
   change is documented in the PR (per tests/parity/README.md).
