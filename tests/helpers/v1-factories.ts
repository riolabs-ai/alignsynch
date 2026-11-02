/**
 * tests/helpers/v1-factories.ts — one shape for every `/v1` test fixture.
 *
 * Three cards in one batch each hand-built a `V1Relationship` and disagreed about `deletedAspects`,
 * `inviteExpiresAt`, `modifiedAt` and `payments[]`: every one of them was plausible, and every one
 * of them would have broken the moment the schema changed. A hand-built fixture is a second copy
 * of the model with no parser behind it.
 *
 * These factories are the parser. `makeRelationship` / `makeAnswerSheet` merge the caller's
 * overrides onto one complete base and then **parse the result with the real zod schema**, so:
 *
 *   - a field added to `zV1Relationship` fails here, once, instead of in six test files;
 *   - a malformed override throws at the call site (`makeRelationship({ mode: "expert" })`), which
 *     is what lets the test beside this file prove the rejection rather than assert a comment;
 *   - every test speaks the same vocabulary, so two fixtures can be compared for the difference
 *     the test actually cares about.
 *
 * The base is a real template's Aspects from `data/v1/fixtures.ts` — an Aspect is never invented,
 * because a prompt or a scale that only exists in a test is a fixture that proves nothing about
 * what the app renders.
 */
import {
  zOpinions,
  type AlignmentSetting,
  type AssessmentMode,
  type Opinions,
} from "@/content/assessment";
import {
  v1Templates,
  zV1Relationship,
  type V1Relationship,
  type V1Subscription,
} from "@/data/v1/fixtures";

/** The instant every factory stamps, so two fixtures differ only where a test says they do. */
export const FACTORY_AT = "2026-10-29T09:00:00.000Z";

/** The template the factory relationship copies — its Aspects are real content, not invented. */
const BASE_TEMPLATE = v1Templates[0];

/** A copy of the base template's Aspects: a relationship holds its own, never a reference. */
function baseItems(): V1Relationship["items"] {
  return BASE_TEMPLATE.items.map((aspect) => ({ ...aspect, scale: { ...aspect.scale } }));
}

/** The answer sheet a factory relationship is built to hold: every Aspect answered the same way. */
const BASE_OPINIONS: Opinions = { feel: 3, wish: 4 };

/**
 * **One answer shape.** The base is Basic Mode's two opinions; pass `mode: "advanced"` for the
 * four, and per-Aspect overrides keyed by Aspect id for everything a test wants to move.
 *
 * Every entry is parsed by `zOpinions`, so `{ feel: 6 }` throws here rather than producing a
 * fixture the report would silently score past the 1..5 band.
 */
export function makeAnswerSheet(
  overrides: Readonly<Record<string, Partial<Opinions>>> = {},
  options: { readonly mode?: AssessmentMode; readonly items?: V1Relationship["items"] } = {},
): Readonly<Record<string, Opinions>> {
  const mode = options.mode ?? "basic";
  const items = options.items ?? baseItems();
  const base: Opinions =
    mode === "advanced" ? { ...BASE_OPINIONS, think: 3, guess: 4 } : { ...BASE_OPINIONS };
  const sheet: Record<string, Opinions> = {};
  for (const item of items) {
    sheet[item.id] = zOpinions.parse({ ...base, ...(overrides[item.id] ?? {}) });
  }
  // An override keyed to an Aspect the relationship does not hold is still a shape a test may
  // want to reason about (a deleted Aspect's surviving answers), so it is parsed and kept.
  for (const [itemId, override] of Object.entries(overrides)) {
    if (sheet[itemId] === undefined) sheet[itemId] = zOpinions.parse({ ...base, ...override });
  }
  return sheet;
}

/** The persisted subscription a factory relationship may carry, mocked and never charged. */
export function makeSubscription(overrides: Partial<V1Subscription> = {}): V1Subscription {
  return {
    plan: "monthly",
    status: "active",
    periodEnd: "2026-11-29T09:00:00.000Z",
    startedAt: FACTORY_AT,
    payments: [
      {
        id: "pay-factory-1",
        plan: "monthly",
        amountCents: 999,
        paidAt: FACTORY_AT,
      },
    ],
    ...overrides,
  };
}

/**
 * **One relationship shape.** Every field `zV1Relationship` requires is present, in a state that
 * parses: a claimed, unstarted Basic/Soft relationship on the base template. Override only what
 * the test is about; the returned object is parsed, so a bad override fails loudly and a schema
 * change fails at the factory instead of six files down the line.
 */
export function makeRelationship(overrides: Partial<V1Relationship> = {}): V1Relationship {
  const base: V1Relationship = {
    id: "rel-factory",
    templateId: BASE_TEMPLATE.id,
    items: baseItems(),
    deletedAspects: [],
    mode: "basic",
    setting: "soft",
    initiatorName: "Jordan",
    counterpartyName: "Sam",
    inviteeName: null,
    initiatorAnswers: {},
    counterpartyAnswers: {},
    initiatorSubmitted: false,
    counterpartySubmitted: false,
    initiatorAccepted: false,
    counterpartyAccepted: false,
    initiatorAcceptedAt: null,
    counterpartyAcceptedAt: null,
    inviteToken: "inv-factory",
    inviteExpiresAt: null,
    archivedAt: null,
    sharedWithCoach: false,
    coachComments: [],
    comments: [],
    aspectComments: {},
    // A Step is derived when a session completes, never authored into a fixture: the default
    // factory row has not completed one, so it holds none. A test that needs Steps passes them in.
    steps: [],
    openedSessions: 0,
    completedSessions: 0,
    subscription: null,
    history: [],
    lastSessionAt: null,
    createdAt: FACTORY_AT,
    modifiedAt: FACTORY_AT,
  };
  return zV1Relationship.parse({ ...base, ...overrides });
}

/**
 * A relationship that has completed a session — both parties submitted a full sheet and both
 * accepted it — so a test about a report, a verdict or a Stage has one row to start from.
 * `setting` and per-Aspect answers stay the caller's.
 */
export function makeCompletedRelationship(
  overrides: Partial<V1Relationship> = {},
  options: {
    readonly mode?: AssessmentMode;
    readonly setting?: AlignmentSetting;
    readonly overrides?: Readonly<Record<string, Partial<Opinions>>>;
  } = {},
): V1Relationship {
  const mode = options.mode ?? overrides.mode ?? "basic";
  const counterparties: Readonly<Record<string, Opinions>> = makeAnswerSheet(
    options.overrides ?? {},
    {
      mode,
    },
  );
  return makeRelationship({
    mode,
    setting: options.setting ?? "soft",
    initiatorAnswers: counterparties,
    counterpartyAnswers: counterparties,
    initiatorSubmitted: true,
    counterpartySubmitted: true,
    initiatorAccepted: true,
    counterpartyAccepted: true,
    initiatorAcceptedAt: FACTORY_AT,
    counterpartyAcceptedAt: FACTORY_AT,
    openedSessions: 1,
    completedSessions: 1,
    lastSessionAt: FACTORY_AT,
    ...overrides,
  });
}
