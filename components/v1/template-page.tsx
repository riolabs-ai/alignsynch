// template-ancestor: components/marketing/marketing-landing.tsx   (variation: one relationship type's landing, not the whole product)
//
// This file owns the arrangement's *facts*; `template-landing.tsx` draws them. Second ancestor,
// cited because this is where the two are decided: `components/my-quizzes/quiz-details.tsx` — its
// Performance Overview stat cards (measured counts, never a score), its seats and detail panels,
// and its vertical action rail. The rail is the one CSS variation and it is stated in
// `template-landing.tsx`'s header, where the sticky classes are drawn.
//
// Nothing here is authored per template: the three counts come from the type's own Aspects, the
// product's stage ladder and the glossary's opinion kinds, and the seats come from the roles. A
// fixture edit moves the landing with it, and no chip can report a number the model does not hold.
// The coach seat is the one absence worth naming: a coach is a *membership* role
// (`lib/flow/membership.ts::RELATIONSHIP_MEMBER_ROLES`), account-bound, and `RelationshipType`
// carries no coach field — so no template declares one today and the strip renders two seats.
// When a type ever declares one it is one more entry in `landingFactsOf`, never a person's name.
import {
  TemplateLanding,
  type LandingFacts,
  type LandingSeat,
} from "@/components/v1/template-landing";
import { OPINION_KINDS } from "@/content/assessment";
import { RELATIONSHIP_STAGES } from "@/content/stages";
import { demoAnswersFor, type RelationshipType } from "@/data/v1/relationship-types";

/**
 * The landing's numbers and seats, derived — once, here, so the drawing never counts by hand.
 *
 * An absent demo is absence (`hasDemo: false`), not a generated example and not a link to one;
 * a template's Aspects, Stages and opinions always exist, so none of these three is `undefined`
 * and none renders as an em-dash.
 */
function landingFactsOf(type: RelationshipType): LandingFacts {
  const seats: readonly LandingSeat[] = [
    {
      role: "INITIATOR",
      name: type.roles.initiator,
      note: "Starts it, answers first, and pays for it.",
    },
    {
      role: "COUNTERPARTY",
      name: type.roles.counterparty,
      note: "Joins by link, answers alone, and pays nothing.",
    },
  ];

  return {
    aspects: type.aspects.length,
    stages: RELATIONSHIP_STAGES.length,
    opinions: OPINION_KINDS.length,
    seats,
    hasDemo: demoAnswersFor(type.id) !== undefined,
  };
}

/**
 * `/v1/templates/[type]` — the page a person decides on.
 *
 * It says who the type is for and who it is **not** for in the header, shows the Aspects plainly
 * (this is the product, shown rather than summarised), walks the session in three steps with the
 * blind rule out loud, and keeps the one primary action — `Create Relationship` — in a rail that
 * stays in view while the Aspect detail is read. The route's gate (`purchasableRelationshipType`,
 * then `NotFoundState`) lives in the page module; by the time this component renders, the type is
 * one a visitor may buy.
 */
export function TemplatePage({ type }: { type: RelationshipType }) {
  return <TemplateLanding facts={landingFactsOf(type)} type={type} />;
}
