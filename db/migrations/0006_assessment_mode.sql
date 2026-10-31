-- 0006_assessment_mode.sql — the instance's mode (#213, the Advanced Mode row).
--
-- assessment_instance.mode — which mode the instance is played in. One value, fixed at
-- creation, read by the answer sheet, the submit parser and the report. There is no UPDATE
-- path in the application: a mode that moves would rewrite one party's record after the other
-- had answered on a different sheet, which is the silent Basic-versus-Advanced comparison the
-- column exists to prevent.
--
-- NOT NULL with DEFAULT 'basic' because every pre-existing row is Basic by construction: the
-- old answer sheet asked only Feel and Wish, so the default cannot hide a mode those rows
-- never had. The four seeded fixture rows are the exception — they carry authored Think/Guess
-- opinions — so they are backfilled EXPLICITLY below, never by the default.
ALTER TABLE assessment_instance ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'basic'
  CHECK (mode IN ('basic', 'advanced'));

-- The four seeded instances, each named, so no seeded row's mode is left to the default.
-- assessment-instance-avery-rowan is Basic: its two Aspects carrying Think/Guess are the
-- pre-Mode schema's per-Aspect optionality, which Basic now forbids — the pair is removed
-- so migrate-then-verify is green before any reseed, and db:seed rewrites the sheet to the
-- same result from the fixture.
UPDATE assessment_instance SET mode = 'basic'
 WHERE record_id IN ('assessment-instance-avery-rowan',
                     'assessment-instance-ruth-sam',
                     'assessment-instance-marco-priya');
UPDATE assessment_instance SET mode = 'advanced'
 WHERE record_id = 'assessment-instance-noor-iris';

UPDATE opinion SET think = NULL, guess = NULL
 WHERE instance_record_id = 'assessment-instance-avery-rowan'
   AND (think IS NOT NULL OR guess IS NOT NULL);
