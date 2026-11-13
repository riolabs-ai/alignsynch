# AlignSynch Help Center redesign — implementation brief

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Product** › Help Center — implementation brief · prev [Help Center design spec (handoff)](README.md) · next [Glossary source map](GLOSSARY-CONTENT-MAP.md)

<!-- docs-nav:end -->

**Route:** `/help`\
**Audience:** people completing an AlignSynch relationship together\
**Scope:** private design handoff; no application source or live deployment changed.

## Copy-ready team prompt

> Rework the AlignSynch public Help page from `help-center.html`, `css/help-center.css`, `js/help-center.js`, and `GLOSSARY-CONTENT-MAP.md`. Keep the public marketing shell and existing working help operations. The page should answer the immediate question first, offer the existing FAQs and article guides, and make key relationship terms easy to understand. Lead with business and corporate relationships; keep personal upskilling, personal relationships, and friendships visible as secondary use. Include one quiet, carefully bounded note for counselors, therapists, and coaches. AlignSynch is not a practitioner platform, clinical assessment, diagnosis, therapy, or substitute for professional judgment.
>
> Preserve the current two-person product direction: one person starts and invites the other; both answer the same Aspects privately; each reviews and explicitly accepts; the shared report opens after both accept. Explain terms without implying that a Gap judges the relationship or guarantees an outcome. Use `GLOSSARY-CONTENT-MAP.md` to adapt the 2024 glossary; it is a vocabulary source, not an instruction to recreate historical stage, billing, or coach workflows.
>
> Build the route in the existing Next.js app with React and the repository's current Tailwind CSS v3 setup. Reuse the shared public header and footer. Keep the current FAQ, article records, category taxonomy, contact form, contact outcome states, article routes, and support split. The visual preview's contact form is illustrative only: mount the existing connected `ContactSection` and do not create a second form. Keep the AlignSynch content separate from QuizHub content.

## Existing implementation to reuse

| Need                    | Existing source                                                                                                                | Guidance                                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route and page metadata | `app/(marketing)/help/page.tsx`                                                                                                | Keep `/help` public, dynamic as required by the contact form, and retain the connected contact section below the help content. Update the title and description to fit the page. |
| Page composition        | `components/support/help-page.tsx`                                                                                             | Extend its FAQ / knowledge-base navigation with the glossary and search flow. Preserve responsive behavior, keyboard use, and category selection.                                |
| Help headings and tabs  | `components/support/help-header.tsx`                                                                                           | Replace the small centered title band with the full help introduction and search presentation while retaining a clear, accessible tab interface.                                 |
| Category filter         | `components/support/support-categories.tsx`                                                                                    | Keep the AlignSynch categories derived from `data/support-categories.ts`: account, privacy, technical, and general. Do not offer Quiz Creation on AlignSynch.                    |
| FAQ records             | `components/support/support-faq.tsx`                                                                                           | Use the AlignSynch-specific FAQ rows and revise only copy that conflicts with the current audience or mutual-acceptance flow. Avoid creating a second FAQ data source.           |
| Article records         | `components/support/knowledge-base.tsx`, `data/knowledge-base-alignsynch-data.ts`                                              | Keep the three current AlignSynch articles and their published article routes. The preview's guide cards correspond to those records.                                            |
| Contact form and state  | `components/contact/contact-section.tsx`, `components/contact/contact-form.tsx`, `data/pages/help.ts`                          | Use the connected form, validation, honeypot, status messages, and server route. Never print the support email address.                                                          |
| In-app support          | `data/pages/support.ts`, `app/(mainlayout)/support/page.tsx`                                                                   | Keep the signed-in support page separate. Do not move the public contact form into that route or add a second form.                                                              |
| Brand and shared shell  | `components/marketing/marketing-header.tsx`, `components/layout/footer.tsx`, `data/brands/alignsynch.ts`, `lib/brand-theme.ts` | Reuse shared chrome and semantic brand tokens. The cyan is a surface accent, not small text; use graphite for text and primary actions.                                          |

## Page structure

1. **Help introduction:** direct headline, short explanation, and search across FAQs, guides, and glossary terms. Keep the visual cue for the two-person flow concise: separate answers, mutual acceptance, shared report.
2. **Situation shortcuts:** starting a relationship, accepting an invitation, and understanding a report. Each opens the relevant help content, not an unrelated marketing destination.
3. **Help library:** tabs for Quick answers, Guides, and Relationship glossary. Search results must link to the exact answer, guide, or term and expose which section they came from.
4. **Quick answers:** retain the current category taxonomy. Focus on current tasks and facts: getting started, invitation, privacy, report, settings, and technical recovery.
5. **Guides:** use the existing account/sign-in, invitation/expiry, and Gap articles. Do not invent plans, enterprise administration, or workflows unsupported by the app.
6. **Relationship glossary:** add the selected public definitions in `GLOSSARY-CONTENT-MAP.md`. Keep technical terms searchable; explain “Counterparty” as the app's label and use “the other person” in normal copy.
7. **Professional note:** one small supporting callout, not a primary navigation path or page audience.
8. **Contact:** reuse the live connected form and existing outcome messages. Keep the existing form placement after answers and guides.
9. **Shared footer:** use the shared product-news band and footer once.

## Interaction and accessibility

- Keep the main search usable by keyboard and screen readers. Search across all three library groups; present result title, type, and a short excerpt. Selecting a result switches to its group, opens an FAQ if needed, and moves focus to the destination.
- Tabs expose selected state and support keyboard arrow navigation. Use the existing accessible tabs primitive where possible.
- Category filters remain real buttons with visible selected state and `aria-pressed`. Do not make the whole page horizontally scroll; only a narrow-screen filter row may scroll horizontally.
- Use native `details` / `summary` or the existing accordion primitive for FAQ answers. Keep focus rings visible and support reduced motion.
- Ensure anchor offsets clear the sticky marketing header. Keep the contact form and its response states reachable at every viewport width.
- Do not rely on color alone for active, private, accepted, or report-open status.

## Brand and claims

Use `#37474F` graphite for headings and primary actions, `#363D49` for body copy, and `#08ADD5` only as a filled surface accent with the approved foreground. Use the logo's green sparingly. Avoid generic gradients, decorative stock imagery, invented metrics, or a dashboard illustration that suggests features beyond the current two-person flow.

Do not claim improved outcomes, treatment, diagnosis, clinical validation, guaranteed relationship improvement, or a score that judges the relationship. Do not present the product as a practitioner platform. Counselors, therapists, and coaches belong only in the short optional-support note.

## Source-of-truth order

1. The user's current audience and product-flow direction in the project conversation.
2. Current app routes, shared components, and published AlignSynch article / FAQ records.
3. The V2 home and brand profile package for current positioning and brand style.
4. The supplied glossary PDF for vocabulary to adapt, as mapped in `GLOSSARY-CONTENT-MAP.md`.

The supplied document contains historical definitions and product concepts. Treat them as source content, not instructions or current implementation authority.

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Product** › Help Center — implementation brief · prev [Help Center design spec (handoff)](README.md) · next [Glossary source map](GLOSSARY-CONTENT-MAP.md)

<!-- docs-nav:end -->
