-- 0036_relationship_payment.sql — a relationship is paid for once, at completion (#619).
--
-- #619 moves the charge from **creation** to **completion**. That needs one table, and the table
-- is the *billing* fact rather than a `relationship` column for the reason this schema already
-- gives elsewhere: `relationship.status` is a lifecycle word a person moves through, while "what
-- has been captured, what has been charged and when" is money, and money lives in billing
-- (`billing_subscription`, `billing_event`, `billing_plan`). A `relationship.paid_at` would be a
-- second authored copy of a fact the provider reports, and nothing in SQL could compare the two.
--
--   one row per relationship   `relationship_id` is the primary key. The owner's rule is **one
--                              payer per relationship, unlimited rounds for one fee**, so a second
--                              round does not open a second obligation and a second checkout cannot
--                              charge twice. A table that allowed two rows would make "the fee"
--                              ambiguous at every read.
--   payer_user_id              fixed at creation to the relationship's initiator (#619: "the
--                              original initiator always pays"). Stored, not derived, because
--                              `relationship.initiator_user_id` is nullable for pre-#340 rows and a
--                              payment obligation may not name nobody; the write that creates the
--                              row copies the id that existed at that moment.
--   provider …                 which adapter captured the method and what it called the two objects.
--                              **No card data crosses this column set** — no number, no brand, no
--                              expiry — for the same reason `billing_subscription` carries none: an
--                              id we can charge with a server key is all this product needs, and a
--                              PAN in a client database is a liability nobody asked for.
--   method_captured_at         when a payment method came on file. NULL is "nothing captured yet",
--                              which is a real state (#619's optional "pay later").
--   charge_due_at              method_captured_at + 7 days. #619 keeps the trial: the delay is on
--                              **the charge**, not on the obligation, so the method is required up
--                              front and the money lands a week later.
--   charged_at                 when the fee was actually taken. Set once (`WHERE charged_at IS NULL`
--                              in the write), which is what makes one fee cover every round.
--   charge_attempts            how many times the fee has been attempted, initial attempt included.
--                              #619: "retry ×3 across a week, then expire".
--   first_failed_at            the first failure's instant. The retry ladder and the one-week
--                              window are computed from **this stored instant**, never from
--                              `now()` at render time — the #418 lesson.
--   expired_at / expire_reason the terminal outcome. Two reasons, because they are different news:
--                              `unpaid` is "nobody paid within 14 days of the sheets being sealed",
--                              `charge-failed` is "the card kept declining". `expired_at` is write-once
--                              and is history: a relationship that later pays keeps it.
--   reminder_day3_at / _day10  when each nag was sent, so a job that runs every hour sends one, not
--                              twenty-four. Nullable, and the absence is "not sent yet".
--
-- **The 14-day window is NOT a column.** It is `max(party.accepted_at) + 14 days` — the instant the
-- last acceptance sealed both sheets — and it is derived by `lib/flow/payment.ts::paymentDeadlineOf()`
-- like every other state in this flow (#146). A stored copy would have to be backfilled for every
-- existing completed session (inventing a deadline nobody had) and could drift from the acceptance
-- rows the moment a seat is re-accepted.
--
-- **No backfill, and that is deliberate.** A relationship created before this file has no payment
-- obligation: it was charged at creation, under the model this file retires. Inventing a captured
-- method for those rows would claim a charge that never happened. The absence is read as **not
-- measured** (`paymentArmedOf()` answers `undefined`), which does not gate completion — while every
-- relationship the product creates from now on writes its row at creation, so `false` is real there.
--
-- Idempotent on purpose, like 0001–0035: `db:migrate` ledgers this file and skips what it applied,
-- and a re-run of this file alone must still be a no-op.

CREATE TABLE IF NOT EXISTS relationship_payment (
  relationship_id             TEXT        PRIMARY KEY REFERENCES relationship (id),
  payer_user_id               TEXT        NOT NULL,
  provider                    TEXT        NOT NULL,
  provider_customer_id        TEXT        NULL,
  provider_payment_method_id  TEXT        NULL,
  method_captured_at          TIMESTAMPTZ NULL,
  charge_due_at               TIMESTAMPTZ NULL,
  charged_at                  TIMESTAMPTZ NULL,
  charge_amount_cents         INTEGER     NULL,
  charge_attempts             INTEGER     NOT NULL DEFAULT 0,
  last_attempt_at             TIMESTAMPTZ NULL,
  first_failed_at             TIMESTAMPTZ NULL,
  expired_at                  TIMESTAMPTZ NULL,
  expire_reason               TEXT        NULL,
  reminder_day3_at            TIMESTAMPTZ NULL,
  reminder_day10_at           TIMESTAMPTZ NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The two vocabularies, closed where a reviewer reads them. The reasons mirror
-- `lib/flow/payment.ts::PAYMENT_EXPIRY_REASONS`; `tests/flow-payment.test.ts` asserts the two
-- agree, so a fourth reason added in code without a migration is a red test rather than a
-- constraint violation in production.
ALTER TABLE relationship_payment DROP CONSTRAINT IF EXISTS relationship_payment_reason_vocabulary;
ALTER TABLE relationship_payment
  ADD CONSTRAINT relationship_payment_reason_vocabulary CHECK (
    expire_reason IS NULL OR expire_reason IN ('unpaid', 'charge-failed')
  );

-- A method is a pair: an id with no customer cannot be charged off-session, and the provider
-- object that owns it is what the charge is made against. The provider name is required for the
-- same reason `billing_subscription.provider` is: a row must say who to ask.
ALTER TABLE relationship_payment DROP CONSTRAINT IF EXISTS relationship_payment_provider_not_blank;
ALTER TABLE relationship_payment
  ADD CONSTRAINT relationship_payment_provider_not_blank CHECK (length(btrim(provider)) > 0);

-- Money is a positive integer count of cents, never a float (the repo's own convention,
-- `data/billing-plans.ts`). `0` is a mis-written row: nothing in this product is free to charge.
ALTER TABLE relationship_payment DROP CONSTRAINT IF EXISTS relationship_payment_amount_positive;
ALTER TABLE relationship_payment
  ADD CONSTRAINT relationship_payment_amount_positive CHECK (
    charge_amount_cents IS NULL OR charge_amount_cents > 0
  );

-- The chronology, as constraints rather than as hope. Each pair says "the later fact cannot predate
-- the earlier one", and a row that violates it is a bug the database refuses to store.
ALTER TABLE relationship_payment DROP CONSTRAINT IF EXISTS relationship_payment_charge_after_capture;
ALTER TABLE relationship_payment
  ADD CONSTRAINT relationship_payment_charge_after_capture CHECK (
    charged_at IS NULL
    OR (method_captured_at IS NOT NULL AND charged_at >= method_captured_at)
  );

ALTER TABLE relationship_payment DROP CONSTRAINT IF EXISTS relationship_payment_expiry_after_capture;
ALTER TABLE relationship_payment
  ADD CONSTRAINT relationship_payment_expiry_after_capture CHECK (
    expired_at IS NULL
    OR (method_captured_at IS NOT NULL AND expired_at >= method_captured_at)
  );

-- A charged obligation is not also an expired one: the two outcomes are exclusive, and a row that
-- carried both would make `paymentPhaseOf()` answer whichever branch it checks first.
ALTER TABLE relationship_payment DROP CONSTRAINT IF EXISTS relationship_payment_charged_or_expired;
ALTER TABLE relationship_payment
  ADD CONSTRAINT relationship_payment_charged_or_expired CHECK (
    charged_at IS NULL OR expired_at IS NULL
  );

-- The job reads "every obligation with work due", newest failure first. A partial index over the
-- rows that are not finished is smaller than the table and is exactly the scan the job makes.
CREATE INDEX IF NOT EXISTS relationship_payment_open_idx
  ON relationship_payment (COALESCE(first_failed_at, charge_due_at), relationship_id)
  WHERE charged_at IS NULL AND expired_at IS NULL;
