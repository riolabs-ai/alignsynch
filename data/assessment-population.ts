/**
 * The demo population — 30 people, 27 relationships, and every lifecycle the model allows (#1079).
 *
 * This file is **data, not content logic**: it holds one compact row per relationship and
 * `data/assessments.ts` turns each row into a full `AssessmentSession` (`populationSession`),
 * copying the template's Aspects so `data:check` E31 cannot see a copy that drifted. Two reasons
 * for the shape:
 *
 *   1. **A row is readable.** The four hand-authored sessions in `data/assessments.ts` spell out
 *      every Aspect prompt and every opinion object, which is right for the four records that
 *      *define* the shape and unreadable once there are thirty. A row here states the one thing a
 *      reader is looking for — who is in it, what state it is in, and how far apart they are.
 *   2. **The lifecycle is authored, never inferred.** `lifecycle` is the `relationship` row's own
 *      facts (`content/assessment.ts::zSeededLifecycle`); `seededLifecycleOf()` fills in the
 *      defaults that a status implies, and `scripts/db-seed.mjs` writes the rows from the result.
 *
 * **The answers are the whole sheet; the lifecycle says how much of it has happened.** The model
 * requires both parties to answer every Aspect, so a draft or a pending invitation still carries
 * both seats' eventual answers here — and the lifecycle (`answers`) decides how many of those rows
 * the seed writes. That is the honest split: an `AssessmentSession` is *content* (a template copied
 * and answered), while a `relationship` row is a *state*, and the two are not the same thing.
 *
 * **Every status the CHECK allows appears at least once**, and `tests/demo-dataset-coverage.test.ts`
 * iterates the enum from the model rather than this file, so a status added later fails the build
 * until a relationship carries it. The five flow stages map onto the rows as
 * `docs/specs/flow-stages.md` describes them:
 *
 *   | stage | what the stage leaves behind | rows here |
 *   |---|---|---|
 *   | 1 Details · 2 Settings · 3 Aspects | a cookie, no row (`lib/flow/create-draft.ts`) | — (nothing to seed) |
 *   | 4 Account | the relationship written as a **draft**, no invitation | `esme-walt`, `pia-greta`, `ivan-ada` |
 *   | 5 Invite | the invitation **sent** (`pending`) and, once claimed, `published` | `rowan-kenji`, `lena-yusuf`, `hugo-selma`; `rowan-esme`, `theo-lena`, `tomas-ada`, `bea-anouk`, `dario-fatima` |
 *   | after the flow | `active`, `complete`, and the two ways it ends — `void`, `expired` | 5 · 8 · 3 · 3 |
 *
 * Names are fixtures (`demo.alignsynch.test` is the only address the demo owns) and the scores are
 * authored, not measured: nothing here is a real person's answer, and `DEMO_NOW_ISO` owns the clock
 * so no label is computed from the real time.
 */
import type { AlignmentSetting, AssessmentMode, SeededLifecycle } from "../content/assessment";

/** One seat: a person's name and their answers, one group per Aspect, in the template's order. */
export interface PopulationSeat {
  /** The party name the seeded `party` row carries. */
  readonly name: string;
  /**
   * `feel/wish` per Aspect in Basic Mode, `feel/wish/think/guess` in Advanced — space separated,
   * in the template's Aspect order. A string rather than four arrays because a row is read as a
   * score sheet: `"2/5 3/4 3/5 4/4 4/4"` is the shape a reader is comparing, and a typo fails the
   * builder by count instead of silently shifting one array.
   */
  readonly answers: string;
}

/** One relationship in the population. */
export interface PopulationRow {
  /** The session slug — unique across the collection (E2), and the seed's id is `relationship-<id>`. */
  readonly slug: string;
  /** Which template this relationship copied. Resolved by E31; a typo is a red build. */
  readonly templateId: string;
  /** The relationship's own name, when it has one (`sessionNameOf` falls back to the template's). */
  readonly name?: string;
  /** The fixture instant the relationship was created — `relationship.created_at`, never a clock. */
  readonly date: string;
  readonly mode: AssessmentMode;
  readonly setting: AlignmentSetting;
  readonly lifecycle: SeededLifecycle;
  readonly initiator: PopulationSeat;
  readonly counterparty: PopulationSeat;
}

const BASICS = "assessment-relationship-basics";
const STAFF_MANAGER = "assessment-business-staff-manager";
const PARENT_CHILD = "assessment-personal-parent-child";
const COLLEAGUES = "assessment-colleagues";
const TEAM = "assessment-team";
const VENDOR_PRODUCT = "assessment-customer-vendor-product";
const VENDOR_SERVICES = "assessment-customer-vendor-services";
const PARENT_TEACHER = "assessment-parent-teacher";
const TEACHER_STUDENT = "assessment-teacher-student";

/**
 * The population, newest last. Dates run Aug–Oct 2026 so the lists sort meaningfully under
 * `DEMO_NOW_ISO` (2026-10-29T12:00:00Z) — a list of thirty rows that share one instant has no
 * sort order to demonstrate.
 */
export const populationRows: readonly PopulationRow[] = [
  /* ---------------- drafts: stage 4 wrote the row, nothing has been sent ---------------- */
  {
    slug: "esme-walt",
    templateId: VENDOR_PRODUCT,
    name: "Renewal with the vendor",
    date: "2026-10-27T09:20:00.000Z",
    mode: "basic",
    setting: "soft",
    lifecycle: { status: "draft" },
    initiator: { name: "Esme", answers: "3/4 2/4 4/5 3/3 3/4" },
    counterparty: { name: "Walt", answers: "3/4 3/4 4/4 3/4 3/4" },
  },
  {
    slug: "pia-greta",
    templateId: TEAM,
    date: "2026-10-26T15:05:00.000Z",
    mode: "basic",
    setting: "soft",
    lifecycle: { status: "draft" },
    initiator: { name: "Pia", answers: "4/4 3/5 4/4 3/4 4/4" },
    counterparty: { name: "Greta", answers: "4/4 4/5 4/4 3/4 4/4" },
  },
  {
    slug: "ivan-ada",
    templateId: TEAM,
    date: "2026-10-22T11:40:00.000Z",
    mode: "basic",
    setting: "full",
    lifecycle: { status: "draft" },
    initiator: { name: "Ivan", answers: "2/4 2/3 3/4 2/4 3/4" },
    counterparty: { name: "Ada", answers: "3/4 3/4 3/4 2/4 3/4" },
  },

  /* ---------------- pending: the invitation is out, nobody has claimed it ---------------- */
  {
    slug: "kenji-yusuf",
    templateId: TEAM,
    date: "2026-10-25T08:15:00.000Z",
    mode: "basic",
    setting: "soft",
    lifecycle: { status: "pending" },
    initiator: { name: "Kenji", answers: "3/4 3/4 4/4 3/5 3/4" },
    counterparty: { name: "Yusuf", answers: "3/4 3/4 4/4 3/4 3/4" },
  },
  {
    slug: "lena-yusuf",
    templateId: PARENT_CHILD,
    date: "2026-10-18T19:30:00.000Z",
    mode: "basic",
    setting: "soft",
    lifecycle: { status: "pending", publishedAfterDays: 0 },
    initiator: { name: "Lena", answers: "3/4 2/4 3/4 4/4 3/4" },
    counterparty: { name: "Yusuf", answers: "2/4 2/4 3/3 3/4 2/4" },
  },
  {
    slug: "hugo-selma",
    templateId: BASICS,
    date: "2026-10-12T10:00:00.000Z",
    mode: "basic",
    setting: "soft",
    lifecycle: { status: "pending" },
    initiator: { name: "Hugo", answers: "4/4 3/4 3/4 4/4 3/4" },
    counterparty: { name: "Selma", answers: "3/4 3/4 3/4 4/4 4/4" },
  },

  /* ---------------- published: claimed, not yet accepted ---------------- */
  {
    slug: "esme-jules",
    templateId: COLLEAGUES,
    name: "Handover with Esme",
    date: "2026-10-20T13:45:00.000Z",
    mode: "basic",
    setting: "soft",
    lifecycle: { status: "published", answers: "both", publishedAfterDays: 0 },
    initiator: { name: "Esme", answers: "2/5 3/4 4/4 2/5 3/4" },
    counterparty: { name: "Jules", answers: "4/4 4/4 4/4 4/4 3/4" },
  },
  {
    /**
     * The other direction of the demo pair: Rowan initiated this one, so the Counterparty button's
     * person is an Initiator somewhere and the Initiator button's person holds a counterparty seat.
     * Both roles on both accounts is what makes each button show a different screen.
     */
    slug: "rowan-avery-review",
    templateId: COLLEAGUES,
    name: "The performance review",
    date: "2026-10-19T09:05:00.000Z",
    mode: "basic",
    setting: "soft",
    lifecycle: { status: "published", answers: "both", plan: "principal" },
    initiator: { name: "Rowan", answers: "3/4 3/4 3/4 2/4 3/4" },
    counterparty: { name: "Avery", answers: "3/4 3/4 3/4 3/4 3/4" },
  },
  {
    slug: "tomas-ada",
    templateId: VENDOR_SERVICES,
    date: "2026-10-15T09:10:00.000Z",
    mode: "basic",
    setting: "full",
    lifecycle: { status: "published", answers: "both", plan: "principal" },
    initiator: { name: "Tomas", answers: "3/5 2/4 3/5 2/4 3/5" },
    counterparty: { name: "Ada", answers: "3/4 3/4 3/4 3/4 3/4" },
  },
  {
    slug: "theo-lena",
    templateId: TEACHER_STUDENT,
    name: "This term's plan",
    date: "2026-10-09T16:20:00.000Z",
    mode: "basic",
    setting: "soft",
    lifecycle: { status: "published", answers: "initiator", plan: "basic" },
    initiator: { name: "Theo", answers: "2/4 3/5 4/4 3/4 2/4" },
    counterparty: { name: "Lena", answers: "3/4 3/4 4/4 3/4 3/4" },
  },
  {
    slug: "bea-anouk",
    templateId: PARENT_CHILD,
    date: "2026-10-06T18:00:00.000Z",
    mode: "basic",
    setting: "soft",
    lifecycle: { status: "published", answers: "initiator" },
    initiator: { name: "Bea", answers: "4/5 3/4 2/4 3/5 4/4" },
    counterparty: { name: "Anouk", answers: "3/4 3/4 3/4 3/4 3/4" },
  },
  {
    slug: "dario-fatima",
    templateId: COLLEAGUES,
    date: "2026-09-30T08:50:00.000Z",
    mode: "basic",
    setting: "soft",
    lifecycle: { status: "published", answers: "initiator" },
    initiator: { name: "Dario", answers: "2/4 2/4 3/4 2/5 3/4" },
    counterparty: { name: "Fatima", answers: "3/4 3/4 3/4 3/4 3/4" },
  },

  /* ---------------- active: both accepted, a live plan ---------------- */
  {
    /**
     * The demo's own pair, in the one state whose screen needs an entitling subscription: Avery and
     * Rowan are the two people the PIN panel signs in as, and a `demo.alignsynch.test` persona may
     * only sit in a relationship whose **every** seat is a persona (`B8`, `scripts/bundle-platform.ts`)
     * — a persona beside an undeclared name would leave that seat unowned in a `--subset prod`
     * package. So the demo people have several relationships between themselves, which is also what
     * a real pair looks like: money, the flat, work.
     */
    slug: "avery-rowan-flat",
    templateId: BASICS,
    name: "The flat on Mill Street",
    date: "2026-10-21T07:30:00.000Z",
    mode: "basic",
    setting: "soft",
    lifecycle: { status: "active", plan: "basic" },
    initiator: { name: "Avery", answers: "3/5 4/4 2/5 3/4 4/4" },
    counterparty: { name: "Rowan", answers: "3/4 4/4 3/4 3/4 4/4" },
  },
  {
    slug: "nadia-omar",
    templateId: PARENT_TEACHER,
    date: "2026-10-17T12:00:00.000Z",
    mode: "basic",
    setting: "soft",
    lifecycle: { status: "active", plan: "principal" },
    initiator: { name: "Nadia", answers: "4/4 3/5 4/4 3/4 2/4" },
    counterparty: { name: "Omar", answers: "3/4 4/4 4/4 3/4 3/4" },
  },
  {
    slug: "omar-tomas",
    templateId: STAFF_MANAGER,
    name: "Q4 priorities",
    date: "2026-10-11T10:15:00.000Z",
    mode: "advanced",
    setting: "full",
    lifecycle: { status: "active", plan: "principal" },
    initiator: {
      name: "Omar",
      answers: "2/5/4/2 3/4/3/3 4/4/4/4 2/5/3/2 3/4/4/3",
    },
    counterparty: {
      name: "Tomas",
      answers: "4/4/3/4 3/4/4/3 4/4/4/4 4/4/3/4 3/3/3/3",
    },
  },
  {
    slug: "milo-ines",
    templateId: BASICS,
    date: "2026-10-03T20:40:00.000Z",
    mode: "basic",
    setting: "soft",
    lifecycle: { status: "active", plan: "basic" },
    initiator: { name: "Milo", answers: "3/4 2/4 3/5 3/4 3/4" },
    counterparty: { name: "Ines", answers: "3/4 3/4 3/4 3/4 3/4" },
  },
  {
    slug: "ines-marcus",
    templateId: PARENT_TEACHER,
    date: "2026-09-24T17:00:00.000Z",
    mode: "basic",
    setting: "full",
    lifecycle: { status: "active", plan: "basic" },
    initiator: { name: "Ines", answers: "4/4 4/5 3/4 4/4 3/4" },
    counterparty: { name: "Marcus", answers: "4/4 4/4 3/4 4/4 3/4" },
  },

  /* ---------------- complete: the subscription finished ---------------- */
  {
    slug: "avery-rowan-summer",
    templateId: PARENT_CHILD,
    name: "Summer rules",
    date: "2026-09-28T09:00:00.000Z",
    mode: "advanced",
    setting: "full",
    lifecycle: { status: "complete", plan: "principal", completedAfterDays: 9 },
    initiator: {
      name: "Avery",
      answers: "3/5/4/2 4/4/3/4 3/5/3/2 2/4/2/3 4/4/4/4",
    },
    counterparty: {
      name: "Rowan",
      answers: "4/4/4/4 4/4/4/4 4/4/4/4 3/4/3/3 4/4/4/4",
    },
  },
  {
    slug: "kenji-rosa",
    templateId: COLLEAGUES,
    date: "2026-09-19T14:25:00.000Z",
    mode: "basic",
    setting: "soft",
    lifecycle: { status: "complete", plan: "basic", completedAfterDays: 12 },
    initiator: { name: "Kenji", answers: "3/4 3/4 4/4 3/4 3/4" },
    counterparty: { name: "Rosa", answers: "3/4 3/4 4/4 3/4 3/4" },
  },
  {
    slug: "greta-hugo",
    templateId: PARENT_TEACHER,
    name: "The reading plan",
    date: "2026-09-12T11:30:00.000Z",
    mode: "basic",
    setting: "soft",
    lifecycle: { status: "complete", plan: "principal", completedAfterDays: 14 },
    initiator: { name: "Greta", answers: "4/5 4/4 3/5 4/4 4/5" },
    counterparty: { name: "Hugo", answers: "4/4 4/4 4/4 4/4 4/4" },
  },
  {
    slug: "ada-milo",
    templateId: COLLEAGUES,
    date: "2026-09-02T09:45:00.000Z",
    mode: "basic",
    setting: "full",
    lifecycle: { status: "complete", plan: "basic", completedAfterDays: 20 },
    initiator: { name: "Ada", answers: "2/4 3/4 3/4 2/4 3/4" },
    counterparty: { name: "Milo", answers: "2/4 3/4 3/4 3/4 3/4" },
  },

  /* ---------------- void: an operator closed it, with a reason ---------------- */
  {
    slug: "jules-pia",
    templateId: BASICS,
    date: "2026-09-26T17:10:00.000Z",
    mode: "basic",
    setting: "soft",
    lifecycle: {
      status: "void",
      voidReason: "Both people asked for it to be closed — they moved out of the flat.",
    },
    initiator: { name: "Jules", answers: "3/4 2/4 3/4 3/4 3/4" },
    counterparty: { name: "Pia", answers: "3/4 3/4 3/4 3/4 3/4" },
  },
  {
    slug: "yusuf-bea",
    templateId: TEACHER_STUDENT,
    date: "2026-09-08T15:35:00.000Z",
    mode: "basic",
    setting: "soft",
    lifecycle: {
      status: "void",
      voidReason:
        "Created against the wrong template — support closed it rather than delete the answers.",
    },
    initiator: { name: "Yusuf", answers: "3/4 3/4 3/4 3/4 3/4" },
    counterparty: { name: "Bea", answers: "3/4 3/4 3/4 4/4 3/4" },
  },
  {
    slug: "selma-dario",
    templateId: TEAM,
    date: "2026-08-29T10:05:00.000Z",
    mode: "basic",
    setting: "soft",
    lifecycle: {
      status: "void",
      voidReason: "The project was reassigned; neither person needed the sheet any more.",
    },
    initiator: { name: "Selma", answers: "3/4 3/4 3/4 3/4 3/4" },
    counterparty: { name: "Dario", answers: "3/4 2/4 3/4 3/4 3/4" },
  },

  /* ---------------- expired: unpaid, and it says why ---------------- */
  {
    slug: "avery-rowan-trial",
    templateId: STAFF_MANAGER,
    name: "The quarterly review",
    date: "2026-09-21T08:00:00.000Z",
    mode: "basic",
    setting: "soft",
    lifecycle: { status: "expired", lapseReason: "trial-ended", plan: "basic" },
    initiator: { name: "Avery", answers: "3/4 2/4 3/5 2/4 3/4" },
    counterparty: { name: "Rowan", answers: "3/4 3/4 3/4 3/4 3/4" },
  },
  {
    slug: "rosa-ivan",
    templateId: BASICS,
    date: "2026-09-05T19:20:00.000Z",
    mode: "basic",
    setting: "soft",
    lifecycle: { status: "expired", lapseReason: "payment-failed", plan: "basic" },
    initiator: { name: "Rosa", answers: "4/4 3/5 4/4 3/4 4/5" },
    counterparty: { name: "Ivan", answers: "4/4 4/4 4/4 3/4 4/4" },
  },
  {
    slug: "anouk-pavel",
    templateId: STAFF_MANAGER,
    date: "2026-08-25T13:15:00.000Z",
    mode: "basic",
    setting: "full",
    lifecycle: {
      status: "expired",
      lapseReason: "subscription-canceled",
      plan: "principal",
      expiredAfterDays: 30,
    },
    initiator: { name: "Anouk", answers: "2/4 3/4 3/5 2/4 3/4" },
    counterparty: { name: "Pavel", answers: "3/4 3/4 3/4 3/4 3/4" },
  },
];
