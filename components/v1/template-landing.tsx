// template-ancestor: components/marketing/marketing-landing.tsx   (variation: one relationship type's landing, not the whole product)
//
// Two ancestors, one citation each (#336):
//
//   header band, tags, descriptor, primary/secondary CTA   components/marketing/marketing-landing.tsx
//   stat cards, seats, tabs, detail panels, the rail       components/my-quizzes/quiz-details.tsx
//
// The rail is the one CSS variation, stated here because this is where it is drawn: quiz-details
// keeps its action column in normal flow on the right, and this page pins the same column on the
// LEFT — `lg:sticky lg:top-6 lg:self-start`, so the CTA, the counts and the seats stay in view
// while the Aspect list scrolls past. That is the whole point of the arrangement (#404 §5): the
// page used to run to the end and take the decision with it. The tree's only other sticky
// precedent is `components/v1/opinion-sheet.tsx`'s action bar.
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StartRelationshipButton } from "@/components/v1/start-relationship-button";
import {
  ASSESSMENT_MODES,
  MODE_LABELS,
  OPINION_DEFINITIONS,
  OPINION_KINDS,
  OPINION_LABELS,
  SETTING_DEFINITIONS,
  SETTING_LABELS,
  opinionKindsFor,
  type AssessmentMode,
  type Aspect,
  type OpinionKind,
} from "@/content/assessment";
import { formatCurrency } from "@/content/core";
import { RELATIONSHIP_STAGES, STAGE_LABELS } from "@/content/stages";
import { REALM_GROUP, type RelationshipType } from "@/data/v1/relationship-types";
import Link from "next/link";

/**
 * One seat on the template — a role, never a person.
 *
 * `name` is the type's own role word (`type.roles.initiator`), and `note` is that seat's honest
 * job. There is deliberately no avatar and no account: a template holds Aspects, and names are
 * instance facts (`#404` §3b), so a name rendered here would be invented social proof.
 */
export interface LandingSeat {
  readonly role: "INITIATOR" | "COUNTERPARTY" | "COACH";
  readonly name: string;
  readonly note: string;
}

/**
 * The landing's numbers and its seats, derived once by `template-page.tsx` and drawn here.
 *
 * Nothing in this shape is authored per type: the counts come from the fixtures and the product
 * ladders, so a fixture edit moves the chips with it and no chip can drift from the model.
 */
export interface LandingFacts {
  /** `type.aspects.length` — the questions this template asks. */
  readonly aspects: number;
  /** `RELATIONSHIP_STAGES.length` — the session ladder, an instance word, never a template badge. */
  readonly stages: number;
  /** `OPINION_KINDS.length` — what each party answers on every Aspect, across both Modes. */
  readonly opinions: number;
  /** The two role seats, plus a coach only when the template declares one. */
  readonly seats: readonly LandingSeat[];
  /** Whether `demoAnswersFor(type.id)` holds a sheet — absence renders as absence. */
  readonly hasDemo: boolean;
}

/** The three steps, authored once — the blind rule is said out loud in step three. */
const SESSION_STEPS = [
  {
    title: "Answer each Aspect from your side",
    body: "How things are now, and how you'd like them to be. In Advanced Mode you also say what you think — and what you guess — the other person will answer.",
  },
  {
    title: "They answer the same Aspects on their own",
    body: "The other person gets a link and answers the same questions. While they answer, neither of you can see the other's sheet.",
  },
  {
    title: "The report unlocks when both of you have finished",
    body: "The two sets of answers appear side by side, Aspect by Aspect, with the Gaps between them in plain view. That is the whole point — and the blind rule: your answers stay hidden until both of you have submitted.",
  },
] as const;

/** `A`, `A and B`, `A, B and C` — a list a person reads, not an array printed at them. */
function nameList(names: readonly string[]): string {
  if (names.length === 0) return "nothing";
  if (names.length === 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1] ?? ""}`;
}

/** What a Mode asks, in the model's own words: Basic is Feel + Wish, Advanced adds Think + Guess. */
function modeSummary(mode: AssessmentMode): string {
  const names = nameList(opinionKindsFor(mode).map((kind) => OPINION_LABELS[kind]));
  return mode === "basic"
    ? `Asks ${names} on every Aspect.`
    : `Adds ${names} — the Basic pair plus the two predictions.`;
}

/**
 * `/v1/templates/[type]`, drawn: the header band, the sticky left rail, and the scrolling column
 * of tabs and Aspect detail.
 *
 * Every fact the old linear page told is still here — who it is for and not for, every Aspect
 * prompt with both named ends, how a session works with the blind rule out loud, the price, and
 * what a Mode and a Setting are — but the decision stays in view: the rail carries the CTA, the
 * derived counts, the seats, the Mode/Setting vocabulary and the price while the Aspects scroll.
 *
 * What it does not draw, on purpose: the mockup's hero photograph (no cover field exists), a
 * `Topics` chip (a topic is an Aspect — two counters for one thing would be a lie), named
 * participants (a template has seats, and those are instance facts), and any slider value (the
 * landing has no answers; only the demo page has a real sheet).
 */
export function TemplateLanding({ type, facts }: { type: RelationshipType; facts: LandingFacts }) {
  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-8">
      <nav aria-label="Breadcrumb">
        <Link href="/v1/templates" className="text-xs font-medium text-action hover:underline">
          ← Relationship types
        </Link>
      </nav>

      <HeaderBand type={type} />

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
        <Rail type={type} facts={facts} />

        <div className="min-w-0 space-y-6">
          <SchemaTabs type={type} facts={facts} />
          <SessionSteps />
        </div>
      </div>
    </div>
  );
}

/** The header band — quiz-details' cover overlay, text-only: there is no photograph to show. */
function HeaderBand({ type }: { type: RelationshipType }) {
  return (
    <header className="rounded-xl bg-foreground p-6 text-background sm:p-8">
      <div className="flex flex-wrap items-center gap-2">
        <BandTag>{type.realm}</BandTag>
        <BandTag>{REALM_GROUP[type.realm]}</BandTag>
        <BandTag>AlignSynch Template</BandTag>
      </div>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        {type.name}
      </h1>
      <p className="mt-2 text-sm text-background/75">
        {`${type.shortName} · ${type.roles.initiator} ↔ ${type.roles.counterparty}`}
      </p>
      <dl className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-background/20 p-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-background/60">For</dt>
          <dd className="mt-1 text-sm leading-relaxed">{type.descriptor.whoItsFor}</dd>
        </div>
        <div className="rounded-lg border border-background/20 p-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-background/60">
            Not for
          </dt>
          <dd className="mt-1 text-sm leading-relaxed text-background/75">
            {type.descriptor.whoItsNotFor}
          </dd>
        </div>
      </dl>
    </header>
  );
}

/** A chip on the dark band. The band's own contrast carries it; no palette step, no gradient. */
function BandTag({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-background/25 px-2.5 py-0.5 text-xs font-medium text-background/90">
      {children}
    </span>
  );
}

/**
 * The rail: the page's primary action region. It is the first column of the grid, so on a phone
 * it stacks above the Aspect list with the CTA first, and from `lg` it sticks — with its own
 * scroll if it ever outgrows the viewport, so the accordion can never push the CTA off screen.
 */
function Rail({ type, facts }: { type: RelationshipType; facts: LandingFacts }) {
  return (
    <aside
      aria-label={`${type.name} actions`}
      className="space-y-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto"
    >
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex [&>button]:w-full">
          <StartRelationshipButton label="Create Relationship" />
        </div>
        {facts.hasDemo ? (
          <Link
            href={`/v1/templates/${type.id}/demo`}
            className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
          >
            See a finished example
          </Link>
        ) : null}

        <div className="mt-4">
          <StatChips facts={facts} />
          <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
            Opinions are what each of you answers on every Aspect.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {RELATIONSHIP_STAGES.map((stage) => STAGE_LABELS[stage]).join(" › ")}
          </p>
        </div>

        <div className="mt-4 border-t border-border pt-3">
          <SeatStrip seats={facts.seats} />
        </div>

        <PriceRow price={type.price} />
      </section>

      <ModeSettingCard />
    </aside>
  );
}

/** The derived counts, as three chips. Each is one text node, so `6 Aspects` reads as written. */
function StatChips({ facts }: { facts: LandingFacts }) {
  const chips = [
    `${facts.aspects} Aspects`,
    `${facts.stages} Stages`,
    `${facts.opinions} Opinions`,
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {chips.map((chip) => (
        <p
          key={chip}
          className="rounded-md bg-muted px-2 py-1.5 text-center text-xs font-semibold tabular-nums text-foreground"
        >
          {chip}
        </p>
      ))}
    </div>
  );
}

/** Seats, never people: the role words the template names, with each seat's honest job. */
function SeatStrip({ seats }: { seats: readonly LandingSeat[] }) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Seats</h2>
      <ul className="mt-2 space-y-1.5">
        {seats.map((seat) => (
          <li key={seat.role} className="rounded-md border border-border px-2.5 py-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {`${seat.role} · ${seat.name}`}
            </p>
            <p className="text-xs leading-snug text-muted-foreground">{seat.note}</p>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
        Who fills a seat is decided when the relationship is created.
      </p>
    </div>
  );
}

/**
 * Mode and Setting, in the product's own vocabulary with one line each on what they change.
 * Both are first-class here: neither is the default and neither is being retired, and both are
 * fixed at creation — the sheet asks exactly what the Mode asks, whatever the Setting is.
 */
function ModeSettingCard() {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mode</h2>
      <dl className="mt-1.5 space-y-1.5">
        {ASSESSMENT_MODES.map((mode) => (
          <div key={mode}>
            <dt className="text-sm font-medium text-foreground">{MODE_LABELS[mode]}</dt>
            <dd className="text-xs leading-snug text-muted-foreground">{modeSummary(mode)}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Setting
      </h2>
      <dl className="mt-1.5 space-y-1.5">
        {(["soft", "full"] as const).map((setting) => (
          <div key={setting}>
            <dt className="text-sm font-medium text-foreground">{SETTING_LABELS[setting]}</dt>
            <dd className="text-xs leading-snug text-muted-foreground">
              {SETTING_DEFINITIONS[setting]}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 border-t border-border pt-2 text-xs leading-snug text-muted-foreground">
        Both are chosen when the relationship is created — the Mode decides what is asked, the
        Setting decides what counts as Aligned.
      </p>
    </section>
  );
}

/** One price, one payer — and never a sum of anything. */
function PriceRow({ price }: { price: number }) {
  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          One relationship
        </p>
        <p className="text-lg font-semibold text-foreground">{formatCurrency(price)}</p>
      </div>
      <p className="mt-1 text-xs leading-snug text-muted-foreground">
        You pay once; the other person joins by link and pays nothing.
      </p>
    </div>
  );
}

/**
 * The visible schema: four tabs over the model's own primitives. `Aspects` is the accordion a
 * buyer reads before paying; the other three answer the questions the accordion raises — who
 * sits in the seats, what Mode and Setting change, and whether a finished example exists.
 */
function SchemaTabs({ type, facts }: { type: RelationshipType; facts: LandingFacts }) {
  return (
    <Tabs defaultValue="aspects" className="rounded-xl border border-border bg-card p-4">
      <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
        <TabsTrigger value="aspects">Aspects</TabsTrigger>
        <TabsTrigger value="parties">Parties</TabsTrigger>
        <TabsTrigger value="setup">Setup</TabsTrigger>
        <TabsTrigger value="see">See</TabsTrigger>
      </TabsList>

      <TabsContent value="aspects" className="pt-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {`${facts.aspects} Aspects, each one question with two named ends. The report puts your answer and theirs side by side and shows the Gap between them — open one to see exactly what each of you will be asked.`}
        </p>
        <AspectsAccordion aspects={type.aspects} />
      </TabsContent>

      <TabsContent value="parties" className="space-y-4 pt-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          A template names seats, not people. The Initiator starts the relationship and pays for it;
          the Counterparty joins by link and pays nothing. A coach seat, when a template declares
          one, reads the report and never answers or scores.
        </p>
        <SeatStrip seats={facts.seats} />
      </TabsContent>

      <TabsContent value="setup" className="space-y-4 pt-4">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Mode</h3>
          {ASSESSMENT_MODES.map((mode) => (
            <div key={mode} className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium text-foreground">{MODE_LABELS[mode]}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {modeSummary(mode)}
              </p>
              <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                {opinionKindsFor(mode).map((kind) => (
                  <li key={kind} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{OPINION_LABELS[kind]}</span>
                    {` — ${OPINION_DEFINITIONS[kind]}`}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Setting</h3>
          {(["soft", "full"] as const).map((setting) => (
            <div key={setting} className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium text-foreground">{SETTING_LABELS[setting]}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {SETTING_DEFINITIONS[setting]}
              </p>
            </div>
          ))}
          <p className="text-xs leading-relaxed text-muted-foreground">
            A Setting changes no number and no question — the sheet asks exactly what the Mode asks.
            It moves the bar the verdict is judged against, and it is fixed at creation like the
            Mode.
          </p>
        </div>
      </TabsContent>

      <TabsContent value="see" className="space-y-3 pt-4">
        {facts.hasDemo ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            A finished example is published for this template — the same report a completed session
            gets, both sheets filled in.
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">
            No finished example is published for this template yet. The report is the one described
            above: your answers and theirs, Aspect by Aspect, once you have both submitted.
          </p>
        )}
        {facts.hasDemo ? (
          <Link
            href={`/v1/templates/${type.id}/demo`}
            className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
          >
            See a finished example
          </Link>
        ) : null}
      </TabsContent>
    </Tabs>
  );
}

/**
 * One accordion item per Aspect: the numbered prompt, both named ends, and — in the panel — the
 * opinions each party is asked of it. The first item is open by default, so the schema is visible
 * before anything is clicked.
 */
function AspectsAccordion({ aspects }: { aspects: readonly Aspect[] }) {
  return (
    <Accordion type="single" collapsible defaultValue={aspects[0]?.id} className="mt-3">
      {aspects.map((item, index) => (
        <AccordionItem key={item.id} value={item.id}>
          <AccordionTrigger className="gap-3 text-left">
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {`Aspect ${String(index + 1).padStart(2, "0")}`}
              </span>
              <span className="mt-0.5 block text-sm font-medium text-foreground">
                {item.prompt}
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="text-sm">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-muted px-2 py-0.5 text-xs text-foreground">
                  {`${item.scale.min} — ${item.leftValue}`}
                </span>
                <span aria-hidden="true" className="text-xs text-muted-foreground">
                  →
                </span>
                <span className="rounded bg-muted px-2 py-0.5 text-xs text-foreground">
                  {`${item.scale.max} — ${item.rightValue}`}
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  What each of you will be asked
                </p>
                <dl className="mt-1.5 space-y-1">
                  {OPINION_KINDS.map((kind) => (
                    <div
                      key={kind}
                      className="grid grid-cols-[68px_minmax(0,1fr)] items-baseline gap-2"
                    >
                      <dt className="text-sm font-medium text-foreground">
                        {OPINION_LABELS[kind]}
                      </dt>
                      <dd className="text-xs leading-snug text-muted-foreground">
                        {OPINION_DEFINITIONS[kind]}
                        {isBasicKind(kind) ? null : (
                          <span className="ml-1.5 whitespace-nowrap rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {MODE_LABELS.advanced}
                          </span>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

/** Whether Basic Mode already asks this opinion — the pair Advanced adds is marked as such. */
function isBasicKind(kind: OpinionKind): boolean {
  return opinionKindsFor("basic").includes(kind);
}

/** How a session works, kept whole from the old page: the blind rule is said out loud in step 3. */
function SessionSteps() {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">How a session works</h2>
      <ol className="mt-3 space-y-3">
        {SESSION_STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-action text-xs font-semibold text-action-foreground">
              {index + 1}
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">{step.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
