/**
 * The feature flags — one surface on or off, per template, without a code change (issue #175).
 *
 * The platform has surfaces in four states: mocked, fixture-backed, database-backed and live.
 * Until this file, the only lever that shipped or hid one was editing a route and deploying —
 * expensive on a Vercel quota, and a code change for a decision that is not about code. A flag
 * is that decision written down: `default` says what ships, `templates` says where it differs
 * per template, `note` says what state the surface is actually in.
 *
 * THE PRECEDENCE, resolved in `lib/flags.ts` and tested in `tests/flags.test.ts`:
 *
 *   1. `FLAG_<NAME>` in the environment — `1` on, `0` off — wins over everything. This is the
 *      request-time lever: `community.leaderboard` is `FLAG_COMMUNITY_LEADERBOARD`. A dotted
 *      name becomes a legal env name by upper-casing it and writing `_` for `.` — and for `-` too,
 *      because a shell cannot export a hyphenated variable (`product.quiz-surfaces` is
 *      `FLAG_PRODUCT_QUIZ_SURFACES`, #300).
 *   2. `templates` — an explicit per-template **on**. If the build's template is in the list
 *      the flag is on, whatever `default` says. `BRAND` already selects a whole skin at build
 *      time; this field is the narrower case where one template ships a surface before another.
 *   3. `default` — what every other template gets.
 *
 * and, ahead of all three, one **opt-in** exception (#184):
 *
 *   0. `adminBypass: true` on the flag **and** an `admin` caller — the flag resolves on,
 *      whatever the env, the template list or the default say. This is what makes a hidden
 *      surface reviewable: `/leaderboard` is off for every visitor and still reachable by the
 *      one person who needs to look at it before it ships. It is opt-in per flag and never
 *      global — a flag that does not declare it keeps the three steps above exactly as they
 *      were, which is why `adminBypass` is absent on the other seven.
 *
 *      The role is **not** read here and is not read by the resolver: a caller passes it in,
 *      resolved server-side from the request's own session (`lib/auth/flag-gate.ts` is the one
 *      caller). There is no header, cookie, query string or prop a client can set to become an
 *      admin, and the resolver is server-only for the same reason.
 *
 * Two things this file is **not**, both on purpose:
 *
 *   - it is not a remote flag service and not a table. No GrowthBook, no LaunchDarkly, no
 *     database round trip: the file is the whole store, so a flag cannot disagree with the tree
 *     it ships in, and `data:check` validates it like every other fixture.
 *   - it is not a brand switch. `BRAND` picks the whole record in `data/brand.ts`; a flag toggles
 *     one surface inside whatever brand the build renders.
 *
 * EVERY DEFAULT IS `false`, and that is the rule, not a coincidence: a surface that is still a
 * mock must not be on by default, because "mocked and on by default" is how a mock reaches a
 * client. A flag is turned on when its surface is worth showing, not when it is written down
 * here. Nothing is deleted or implemented by declaring one — the eight below are the deferred
 * group, the payment-gated pair and the two save-path surfaces, declared so that hiding one is
 * an env change rather than a find-and-replace.
 *
 * `templates` is empty on the eight deferred surfaces: each has the same status on both templates,
 * so an override would be a claim nobody made. The field is schema, not decoration — the resolver
 * reads it and `tests/flags.test.ts` proves it beats `default` and loses to the env. It has
 * exactly one real user, `product.quiz-surfaces` (#300): the quiz product's surfaces ship on
 * `quizhub` and not on `alignsynch`, which is a per-template *on* and nothing else.
 *
 * `adminBypass` is set on **one** flag, `community.leaderboard`, and it does not weaken the rule
 * above: the surface still ships off for every visitor, and an admin reaching it is a review
 * path, not a release. A second flag opting in is a decision to argue for, and
 * `tests/flags.test.ts` fails until that argument is made in the test as well as in the record.
 *
 * Adding a flag: add a line here, then gate the surface (`lib/flags.ts` names the three places a
 * flagged-off surface has to be off) and add it to the panel that proves the mechanism.
 */
import { z } from "zod";

/**
 * One flag. `strict()` like every other fixture object: an unknown key is an error, not a
 * silently ignored field — a typo in `defaults` would otherwise leave a surface on.
 */
export const zFlagDefinition = z
  .object({
    /** What ships when nothing overrides it. */
    default: z.boolean(),
    /**
     * Templates where the flag is on regardless of `default`. Absent means "no per-template
     * value": every template gets `default`. An empty list is rejected — a field that is set
     * but says nothing is a claim that reads as intent.
     */
    templates: z.array(z.string().trim().min(1)).min(1).optional(),
    /**
     * Let an `admin` caller through while the flag is off (#184). Absent — the default, and the
     * value every flag but one carries — means no bypass at all: the flag's three steps decide
     * and the session is never consulted. `true` means the role is the last step of the
     * precedence, ahead of the env override, so an operator's `FLAG_X=0` does not lock an admin
     * out of the surface they are reviewing. Opt-in per flag, never a global policy.
     */
    adminBypass: z.boolean().optional(),
    /** The surface's real state and why the default is what it is. Written for the next reader. */
    note: z.string().trim().min(1),
  })
  .strict();

export type FlagDefinition = z.infer<typeof zFlagDefinition>;

/**
 * The record. Keys are the flag names other modules import — dotted, `area.surface` — so a
 * name is greppable from the surface it gates and a mistyped one fails `tsc`, not a request.
 */
export const zFlags = z
  .object({
    "community.leaderboard": zFlagDefinition,
    "community.tournaments": zFlagDefinition,
    "community.battle": zFlagDefinition,
    "community.chat": zFlagDefinition,
    "commerce.pricing": zFlagDefinition,
    "commerce.affiliate": zFlagDefinition,
    "create.editor": zFlagDefinition,
    "create.generator": zFlagDefinition,
    "product.quiz-surfaces": zFlagDefinition,
  })
  .strict();

export type Flags = z.infer<typeof zFlags>;
export type FlagName = keyof Flags;

/** The validated record. `data:check` compiles this file, so a malformed flag is a red build. */
export const flags: Flags = zFlags.parse({
  "community.leaderboard": {
    default: false,
    adminBypass: true,
    note: "Mocked: the boards are `data/players.ts` projected by `lib/players.ts`, deferred from #163. Off until the rows are real — and reachable by an admin session meanwhile (#184), so the surface can be reviewed without being shipped.",
  },
  "community.tournaments": {
    default: false,
    note: "Mocked: the list and detail rows are the components' own fixtures, deferred from #163. Off until the domain is P4.",
  },
  "community.battle": {
    default: false,
    note: "Mocked: the lobby, active battle and results are fixtures, deferred from #163. Off until a battle has a server behind it.",
  },
  "community.chat": {
    default: false,
    note: "Mocked: contacts and conversations are `data/chat-data.ts`. Off until a message can be sent to someone.",
  },
  "commerce.pricing": {
    default: false,
    note: "Fixture-backed plans with no checkout: wait on payments. Off, because a price a client can read is an offer.",
  },
  "commerce.affiliate": {
    default: false,
    note: "Fixture-backed programme with no payout path: wait on payments. Off for the same reason as pricing.",
  },
  "create.editor": {
    default: false,
    note: "Mocked save path: the editor's Save is a toast. Off until a quiz survives a reload.",
  },
  "create.generator": {
    default: false,
    note: "Mocked generation: the generator seeds from `data/mock-quizzes.ts` and saves to a toast. Off for the same reason as the editor.",
  },
  /**
   * The brand boundary (#300), and the one flag whose subject is a *product* rather than a mock.
   *
   * `templates: ["quizhub"]` is the whole mechanism: the quiz product's surfaces exist on the quiz
   * template and do not exist on the alignment one, so the same resolver `/leaderboard` reads
   * answers `true` for one build and `false` for the other, with no second `BRAND === …` check
   * anywhere. `default: false` keeps the rule above intact for anything that is not `quizhub`.
   *
   * Its hrefs are in `navSurfaces` (`lib/flags.ts`) and its routes call
   * `lib/brand-boundary.ts::requireQuizProduct()`, which is the one gate those twenty-two pages
   * share. `FLAG_PRODUCT_QUIZ_SURFACES=1` on an alignment build turns the whole product back on,
   * which is the review path: the surfaces are gated, not deleted.
   */
  "product.quiz-surfaces": {
    default: false,
    templates: ["quizhub"],
    note: "Shipped by the quiz template only: twenty-two routes (the quiz catalogue, a quiz and its two views, the authoring pair, an author's own quizzes, tournaments, battle, the daily challenge, creator tips, discussions, chat and the quiz dashboard) answer 404 on the alignment build (#300). Gated, never removed.",
  },
});

/**
 * One definition by name, failing loudly on a name the record does not carry.
 *
 * The type makes that impossible from TypeScript, so this exists for the two callers the type
 * cannot see: a test that probes the negative case, and any future string that reaches the
 * resolver from config. A silent `undefined` would read as `default: false` and quietly turn a
 * surface off; a thrown error names the flag and the ones that do exist.
 */
export function flagDefinition(name: FlagName): FlagDefinition {
  const definition: FlagDefinition | undefined = flags[name];
  if (definition === undefined) {
    throw new Error(
      `feature flag "${String(name)}" is not declared in data/flags.ts — declared: ${Object.keys(flags).join(", ")}`,
    );
  }
  return definition;
}
