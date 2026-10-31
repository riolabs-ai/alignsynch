-- 0008_alignment_setting.sql — the instance's Soft/Full Setting (#259).
--
-- assessment_instance.alignment_setting — how closely these two parties want to Align, and
-- therefore what counts as aligned. The glossary's own rows:
--
--   Setting   Qty 2 — "How closely you want to Align." ("Small Gap (1) is OK, or not.")
--   Soft      "Small Gap (1) OK – a satisfactory Setting."
--   Full      "No Gap OK – an exceptional Setting."
--
-- **It is a lens, not a Gap.** The value changes no number: every Gap stays `gapOf()` over
-- two Opinions, computed on every read (`content/gaps.ts`). What the setting decides is
-- whether those numbers are tolerated — Soft accepts a Gap of 1, Full accepts only 0 — and
-- that verdict is derived (`gapMeetsSetting` / `instanceAlignment`), so there is no
-- `aligned` column here either. Storing the verdict would be a second authored copy of a
-- fact the opinion rows already carry, which is the defect this schema has now refused for
-- the Gap (0002), the status (0002) and the mode (0006).
--
-- NOT NULL with DEFAULT 'soft' because every pre-existing row was created when no setting
-- existed, and Soft is the least-strict reading: it cannot retroactively mark a relationship
-- unmet that its parties never agreed to play by Full. The glossary names no default; this
-- is the decision, stated.
--
-- Unlike the mode (0006) there is no "no UPDATE path" rule: a mode rewrites the sheet a party
-- answered on, while the setting only changes the lens over frozen answers, so a later
-- Relationship Maintenance form may legitimately update it. This migration ships no such
-- path — it writes the column and backfills the seeded rows, nothing more.
--
-- The four seeded fixture rows are backfilled EXPLICITLY below, never left to the DEFAULT
-- (0006's rule): three are Soft, and the Advanced demo instance is Full, exactly as
-- `data/assessments.ts` authors them, so migrate-then-verify agrees with the fixture before
-- any reseed.
ALTER TABLE assessment_instance ADD COLUMN IF NOT EXISTS alignment_setting TEXT NOT NULL DEFAULT 'soft'
  CHECK (alignment_setting IN ('soft', 'full'));

-- The four seeded instances, each named, so no seeded row's setting is left to the default.
-- assessment-instance-noor-iris is the Advanced demonstration and plays under Full ("No Gap
-- OK"); the other three are Soft ("Small Gap (1) OK").
UPDATE assessment_instance SET alignment_setting = 'soft'
 WHERE record_id IN ('assessment-instance-avery-rowan',
                     'assessment-instance-ruth-sam',
                     'assessment-instance-marco-priya');
UPDATE assessment_instance SET alignment_setting = 'full'
 WHERE record_id = 'assessment-instance-noor-iris';
