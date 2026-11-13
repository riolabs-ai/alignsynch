/**
 * `/admin/brand` — the brand and audience profile, transcribed (#906).
 *
 * **This file is a transcription, not an edit.** The words come from the approved profile document,
 * `docs/specs/spec-design-page-rel-templates-v2/brand-profile/brand-and-audience-profile.html`, in
 * its order, with its punctuation. A sentence that reads badly while typing it in is fixed in the
 * canon first, by the owner; a page that "improves" the wording while copying it destroys the only
 * property it has — that the app and the canon say the same thing. `tests/admin-brand.test.ts`
 * extracts the eleven headings from both files and diffs them.
 *
 * **The eleven headings are the clone contract** (`admin-brand/README.md` §2): one `h1`, five `h2`
 * (one per band) and five `h3` (three value cards, two audience cards), in that document order. The
 * blocks that carry them are:
 *
 *   positioning   block 1 (the `h1`), and blocks 2–5 — the story band and its three value cards
 *   audiences     blocks 6–8 — the band's `h2` and the two audience cards
 *   workflow      block 9 — the band's `h2`, with four numbered steps
 *   profile-copy  block 10 — the band's `h2`, with three reusable-copy cards
 *   closing       block 11 — the band's `h2`, with the primary action as the band's `cta`
 *
 * Everything that is not a heading — the eyebrows, the ledes' companions, the figure's labels, the
 * steps, the copy cards, the two notes — is an `item`, keyed by id, because the view resolves ids
 * and E23 fails a component that asks for one the fixture does not carry. Budget **0**: the first
 * string typed into `components/admin/brand-profile.tsx` is a red build.
 *
 * **Two destinations, both checked.** The hero's primary action and the closing action point at the
 * public catalogue, `/relationship-types` (`RELATIONSHIP_TYPES_PATH`). The mockup's own targets are
 * anchors in its home preview, which is a preview artefact rather than a route; E23 resolves every
 * `cta.href` against `content/routes.ts`, so a link that only exists in the mockup fails the build
 * here instead of 404ing in front of an operator.
 *
 * **The secondary hero action is an item, not a `cta`.** The mockup's "Explore personal use" is an
 * in-page jump (`#audiences`), and a `PageCopy` href must be a root-relative *path* — E23's
 * `normalizePath` refuses a fragment, on purpose, because a fragment is not a route. The label is
 * therefore an item and the destination is the view's own anchor to the band it names, which is the
 * one shape that keeps the label in the fixture and the fragment out of a checked field.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const adminBrandPageCopy: PageCopy = zPageCopy.parse({
  eyebrow: "Business & corporate relationships",
  heading: "Bring expectations into the open at work.",
  subtitle:
    "AlignSynch helps two people at work compare expectations with a colleague, manager, business partner, or customer. Each answers privately; the shared report opens after both people accept. Personal relationships and friendships are here for your own reflection, too.",
  cta: { label: "Explore business templates", href: "/relationship-types" },
  /**
   * The hero's figure and its promise strip, block 1's other half. The two-seat figure is part of
   * the hero rather than a section of its own: it is the privacy story drawn, and dropping it
   * because it is fiddly would drop the one picture that explains the product.
   */
  items: [
    { id: "hero-secondary", label: "Explore personal use" },
    { id: "promise-label", label: "Brand promise" },
    {
      id: "promise-body",
      label: "A shared starting point for what matters in the relationship.",
    },
    { id: "figure-seats", label: "Two participant seats" },
    { id: "figure-status", label: "Shared report" },
    {
      id: "figure-report-body",
      label: "Opens after both participants answer and explicitly accept.",
    },
    { id: "figure-participant-a", label: "Participant A" },
    { id: "figure-participant-b", label: "Participant B" },
    { id: "figure-private", label: "Private" },
    { id: "figure-aspect", label: "Same relationship Aspect" },
    {
      id: "figure-caption",
      label: "Two people answer separately. The shared report opens when both accept.",
    },
  ],
  sections: [
    {
      id: "positioning",
      heading: "Start with the working relationship in front of you.",
      items: [
        { id: "eyebrow", label: "The story" },
        {
          id: "story-1",
          label:
            "At work, expectations between colleagues, managers, partners, and customers are not always spoken out loud. It can be hard to tell whether two people share the same picture of what matters.",
        },
        {
          id: "story-2",
          label:
            "AlignSynch gives both people the same relationship topics to consider. Each person answers privately, reviews their own answers, and chooses when to accept. The shared report opens only after both have accepted.",
        },
        {
          id: "story-3",
          label:
            "People can also use templates for personal growth, relationships, and friendships. The report organizes perspectives; it does not decide what a relationship means or what anyone should do next.",
        },
        {
          id: "value-business",
          label: "Start with a working relationship.",
          value: "01 / Business first",
          body: "Compare perspectives across colleagues, manager and staff, partners, customers, or teammates.",
        },
        {
          id: "value-personal",
          label: "Make room for personal reflection.",
          value: "02 / Personal growth",
          body: "Explore expectations in personal relationships and friendships at your own pace.",
        },
        {
          id: "value-shared",
          label: "Open the report when both are ready.",
          value: "03 / Shared by choice",
          body: "Responses and differences are organized by topic, without a single relationship score.",
        },
      ],
    },
    {
      id: "audiences",
      heading: "Business first. Personal growth, too.",
      body: "Designed for two people to compare perspectives in a working or personal relationship.",
      items: [
        { id: "eyebrow", label: "Who it is for" },
        {
          id: "card-business",
          label: "For working relationships across a company.",
          value: "Primary · Business & corporate",
          body: "Compare expectations with a colleague, manager, business partner, customer, or teammate. Each pair answers the same topics privately and opens a shared report after both accept.",
        },
        {
          id: "card-business-examples",
          label: "Colleagues · managers · partners · customers · teams",
        },
        {
          id: "card-personal",
          label: "For people building relationship skills.",
          value: "Personal growth · Relationships & friendships",
          body: "Use shared prompts to reflect on personal relationships and friendships, see where your views differ, and decide what you want to discuss.",
        },
        {
          id: "card-personal-examples",
          label: "Partners · family · friends · everyday relationships",
        },
        {
          id: "counselor",
          label: "For counselors, therapists, and coaches",
          body: "AlignSynch may be an optional structure for reflection alongside your existing support. It is not a clinical assessment, diagnosis, therapy, or substitute for professional judgment.",
        },
        {
          id: "participant",
          label: "Two people, one shared report.",
          body: "Each person answers privately; the report opens after both explicitly accept.",
        },
      ],
    },
    {
      id: "workflow",
      heading: "A simple process. A clear privacy gate.",
      body: "You both bring your own perspective. AlignSynch keeps the answers separate until you have each reviewed and accepted them.",
      items: [
        { id: "eyebrow", label: "How it works" },
        {
          id: "step-1",
          label: "Choose a relationship template",
          value: "01",
          body: "Start with business, corporate, personal, or friendship topics.",
        },
        {
          id: "step-2",
          label: "Invite the other person",
          value: "02",
          body: "Start an assessment and invite the person in the relationship with you.",
        },
        {
          id: "step-3",
          label: "Answer and review privately",
          value: "03",
          body: "You each answer the same Aspects and review your own responses.",
        },
        {
          id: "step-4",
          label: "Accept, then open the report",
          value: "04",
          body: "Your shared report opens after you both explicitly accept.",
        },
      ],
    },
    {
      id: "profile-copy",
      heading: "One story across company and app descriptions.",
      body: "Use these as a starting point; keep claims aligned with the current product flow.",
      items: [
        { id: "eyebrow", label: "Reusable profile copy" },
        {
          id: "card-short",
          label: "Short description",
          value: "One line",
          body: "AlignSynch helps two people compare expectations in a working relationship, with personal relationship and friendship templates too.",
        },
        {
          id: "card-company",
          label: "Company profile",
          value: "About",
          body: "AlignSynch is a relationship-assessment product for people who want a clearer view of a working relationship, with personal relationship and friendship templates too. Choose a template, invite the other person, and answer the same topics privately. After both people review and accept their answers, AlignSynch opens a shared report that organizes each perspective for discussion. Business and corporate relationships lead the experience, with templates for personal relationships and friendships as well.",
        },
        {
          id: "card-app",
          label: "App profile",
          value: "Product",
          body: "Compare expectations in a working relationship. Choose a template, invite the other person, and answer the same Aspects privately. Your shared report opens after you both review and accept. Use it to see where your views meet or differ, then decide what to discuss next. Personal relationship and friendship templates are available for reflection too. AlignSynch does not diagnose relationships or assign one relationship score.",
        },
      ],
    },
    {
      id: "closing",
      heading: "Start with a business relationship.",
      body: "Choose a working relationship template, or explore personal and friendship options.",
      cta: { label: "Explore business templates", href: "/relationship-types" },
      items: [{ id: "eyebrow", label: "Primary call to action" }],
    },
  ],
});
