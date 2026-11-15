# Source notes

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Specs & design briefs** › AS2 templates redesign — source notes · prev [AS2 templates redesign (handoff)](README.md) · next [/admin/brand (V2 package)](../spec-design-page-rel-templates-v2/admin-brand/README.md)

<!-- docs-nav:end -->

## Product and catalogue

- Live public catalogue reviewed: [alignsynch.com/relationship-types](https://alignsynch.com/relationship-types)
- Live template detail reviewed: [Staff–Manager](https://alignsynch.com/relationship-types/staff-manager)
- Live pricing route reviewed: [alignsynch.com/pricing](https://alignsynch.com/pricing)
- Current catalogue records: `data/relationship-types.ts`
- Membership plan and current amounts: `data/billing-plans.ts`
- Current relationship-template page copy: `data/pages/templates.ts`
- Current pricing copy: `data/pages/pricing.ts`

The prototype contains the 27 records currently marked purchasable in the product catalogue, grouped by the existing seven realms. Card titles, roles, and Aspect counts come from those records; authored descriptors remain searchable and belong on the detail page. The dating records marked `purchasable: false` are not included. Worked-example links appear only for `staff-manager` and `co-founders`, the two templates with authored demo sheets.

The four workspace screenshots supplied for this iteration are preserved in `reference/`. They guide the existing shell, template-cover treatment, relationship card states, and detail-page fields. `catalogue-components.html` shows those patterns as a small design specimen; its relationship data labels reflect the supplied screenshots and are examples of presentation, not new fixture records.

The public detail route exposes the template's “who it is for / not for” guidance and actual Aspects. The list points to that route from each card title and sends a selected template to registration using the proposed selection-preserving query string.

## Membership wording

The page makes the distinction between a template and a membership explicit. All relationship templates are included; the public catalogue does not price each template as a separate product. The Basic monthly figure and membership limits come from the current billing fixture and live catalogue presentation. The invitation-based seven-day start, the initiator-held membership, and the second party's no-cost invitation seat follow current product copy and membership notes.

Before any production implementation changes billing copy, compare the exact words to the currently deployed `/pricing` page and checkout state. The dated product brief and older site-spec captures explicitly warn that historical screenshots do not establish live billing availability.

## Visual language and purpose

- Approved home design reference: `spec-as2-style-home-redesign/homepage-redesign.html`, its stylesheet, and its React implementation brief.
- Full logo asset: copied from `spec-as2-style-home-redesign/images/alignsynch-logo.png`.
- Two-party mark: images/two-party-mark.svg, used as a compact secondary cue.
- Hero photo: images/hero-connection-1536.webp with a 768px responsive variant and PNG fallback; generated for this review bundle to show a warm, non-romantic conversation between two adults. It is used only in the public hero.
- Relationship-area icons: images/icons/office.svg, business.svg, property.svg, school.svg, medical.svg, home.svg, and social.svg; hand-authored outline SVGs with flat, realm-specific tints.
- Shared catalog and record rules: `CATALOG-UI-SYSTEM.md`.
- Big-picture purpose: `/home/jadenblack/Desktop/alignsynch-webspec/AlignSynch-Project-Brief-2026-11-04.md` describes structured, private, two-party answers followed by explicit acceptance and a shared report.
- Product website context: `/home/jadenblack/Desktop/alignsynch-webspec/AlignSynch-Product-and-Website-Spec-2026-11-04.md` provides a dated route and product map. Its capture notes are historical context, not proof of current behavior.

The user asked for this Templates page to serve the “My Relationship” party membership and for its card/list/detail language to carry across the app. The redesign therefore foregrounds the two participant seats and membership path while preserving the current product's actual template set and two-party privacy rules. The hero combines a warm generated human moment with a real Staff–Manager Aspect; reusable catalog and workspace art stays role-specific, flat, and illustrative.

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Specs & design briefs** › AS2 templates redesign — source notes · prev [AS2 templates redesign (handoff)](README.md) · next [/admin/brand (V2 package)](../spec-design-page-rel-templates-v2/admin-brand/README.md)

<!-- docs-nav:end -->
