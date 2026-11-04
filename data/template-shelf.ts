/**
 * The front page's templates shelf — six type ids, in the order the band draws them.
 *
 * **Why a typed list and not `slice(0, 6)`.** The shelf is a signpost, not a catalogue (the
 * catalogue is `/templates`), so the six have to be the ones most likely to convert — and a
 * slice of the taxonomy is whatever order somebody typed the fixture in, which is not a
 * decision. `data/promotions.ts` is curated for the same reason: curation is the repo's word
 * for "a person chose this and the choice is reviewable in a diff".
 *
 * **The rule the six follow, stated so the next edit can keep it:** one flagship per realm a
 * practitioner is most often asked about, in the order a practice meets them — the office pair,
 * the founding pair, the school pair, the care pair, the family pair, the friendship pair. That
 * is six of the seven realms; `Property` (an HOA board and an owner) is the one left out,
 * because it is the most specialist shelf and the front page is not the place to open with it.
 * Every id must be purchasable (`isPurchasable()`), and `featuredTemplateTypes()` throws on one
 * that is not, so this list cannot quietly become a dead card.
 *
 * The two types the fixture holds a worked example for (`staff-manager`, `co-founders`) are
 * both here on purpose: the front page's strongest card is the one a stranger can open and read
 * before paying, and the catalogue offers that link only where the demo sheet exists.
 */
export const FEATURED_TEMPLATE_TYPE_IDS: readonly string[] = [
  "staff-manager",
  "co-founders",
  "parent-teacher",
  "patient-caregiver",
  "parent-child",
  "friends",
];
