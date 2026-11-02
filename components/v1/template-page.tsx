// template-ancestor: components/marketing/marketing-landing.tsx (variation: one relationship type, not the whole product)
import { RELATIONSHIP_PRICE_CENTS, type RelationshipType } from "@/data/v1/relationship-types";
import { formatCurrency } from "@/content/core";
import { SectionIntro } from "@/components/v1/v1-ui";
import { StartRelationshipButton } from "@/components/v1/start-relationship-button";
import Link from "next/link";

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

/**
 * `/v1/templates/[type]` — the page a person decides on.
 *
 * It says who the type is for and who it is **not** for, lists the Aspects plainly (this is the
 * product, shown rather than summarised), walks the session in three steps with the blind rule
 * out loud, and states the price — one person pays, the counterparty pays nothing. One primary
 * action, `Start this relationship`, and nothing else competing for the click.
 */
export function TemplatePage({ type }: { type: RelationshipType }) {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
      <nav aria-label="Breadcrumb">
        <Link href="/v1/templates" className="text-xs font-medium text-action hover:underline">
          ← Relationship types
        </Link>
      </nav>

      <SectionIntro
        title={type.name}
        subtitle={`${type.roles.initiator} · ${type.roles.counterparty} — ${type.descriptor.whoItsFor}`}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">For</p>
          <p className="mt-1 text-sm text-foreground">{type.descriptor.whoItsFor}</p>
        </section>
        <section className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Not for
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{type.descriptor.whoItsNotFor}</p>
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">What you&apos;ll each answer</h2>
        <ol className="space-y-2">
          {type.aspects.map((item) => (
            <li key={item.id} className="rounded-lg border border-border bg-card px-4 py-3">
              <p className="text-sm font-medium text-foreground">{item.prompt}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {item.leftValue} (1) → {item.rightValue} (5)
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">How a session works</h2>
        <ol className="space-y-3">
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

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">One relationship</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              You pay. The other person joins by link and pays nothing.
            </p>
          </div>
          <p className="text-2xl font-semibold text-foreground">
            {formatCurrency(RELATIONSHIP_PRICE_CENTS)}
          </p>
        </div>
      </section>

      <div className="flex flex-col items-start gap-2">
        <StartRelationshipButton />
        <Link
          href={`/v1/templates/${type.id}/demo`}
          className="text-xs font-medium text-action hover:underline"
        >
          See a finished example first →
        </Link>
      </div>
    </div>
  );
}
