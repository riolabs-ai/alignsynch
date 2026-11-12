# AlignSynch catalogue and record UI system

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Product** › AS2 catalogue UI system · prev [AS2 templates redesign — implementation brief](IMPLEMENTATION-PROMPT.md) · next [AS2 templates redesign — source notes](SOURCE-NOTES.md)

<!-- docs-nav:end -->

## Direction

Use one visual grammar for anything the product treats as a record: a reusable template, a live relationship, an assessment, or a detail page. The frame and identity cues stay familiar; the facts and available actions change with the record type, route, and viewer's permissions.

The four supplied screenshots are the current product reference: [relationship grid](reference/dashboard-relationships-grid.png), [relationship list](reference/dashboard-relationships-list.png), [workspace template shelf](reference/dashboard-templates.png), and [template detail](reference/template-detail.png). The new home-page bundle supplies the public brand tone and logo treatment. The public hero uses one warm, documentary-style image to establish the human value of the product. Catalog and workspace records use restrained realm icons, never repeated lifestyle photography.

## Brand tokens

Use the existing AlignSynch brand record. Do not create a parallel palette in each component.

| Role | Token | Value | Use |
| --- | --- | --- | --- |
| Ink | `foreground` | `#363d49` | Body text on light surfaces |
| Action | `primary` / `action` | `#37474f` | Primary buttons, links, and record titles |
| Pressed | `actionHover` | `#2a373e` | Hover/pressed action state |
| Accent surface | `accent` | `#08add5` | Active rules, soft art, chips, and large icon fills |
| Accent pressed | `accentPress` | `#0693b8` | Focus ring and active control details |
| Brand mark green | `mark` | `#8dc63f` | Secondary SVG node or pale surface tint |
| Pale accent | `pale` | `#e5f5fa` | Cyan cover/background surface |
| Mist | `mist` | `#f5f7f8` | Page section background |
| Sand | `sand` | `#eef4f7` | Cool neutral cover variation |
| Rule | `line` | `#d9e0e3` | Card and section borders |

Keep text on white or pale surfaces. Cyan is an accent surface, never small text on white; use graphite for labels and links. On a cyan fill, use the approved dark foreground. Avoid saturated gradients, random per-record hues, large shadows, and large pill-shaped cards.

## Record artwork

The shared two-party mark in images/two-party-mark.svg uses two distinct nodes joined by a short line. Treat it as a small secondary cue for the two-person model; it carries no product state.

Do not use template initials or monograms in artwork. Cards use one professional outline icon for their relationship area, selected from images/icons/: office people at work, business handshake, property/community building, school book and learner, medical stethoscope, home/family, or social conversation. Reuse the realm icon for every template in that area. The title and role pair identify the specific relationship.

Keep the art flat: a solid pale surface with one dark line icon. Map muted hues to context while staying compatible with AlignSynch: cyan/blue for Office, green for Business, warm sand for Property, leaf green for School, teal for Medical, warm neutral for Home, and slate blue for Social. Core controls and text continue to use approved graphite, cyan, green, and cool neutrals. Realm tints are supporting cues only; labels remain visible and color never replaces realm, role, state, or action text. Do not invent gradients or unique hues per template.

Use the generated hero photograph only in the public catalogue hero as a contained, framed image beside the headline and actions. Follow it immediately with a compact how-it-works section and a real Aspect example, before the membership line and template catalogue. Keep photography out of workspace cards and detail content, where realm iconography and product information work better.

## Hero image and motion

Keep the public hero as a balanced split layout: the headline, product explanation, primary catalogue action, and how-it-works link stay visible beside the framed photo. Keep both people in the crop; never let the image fill the viewport or push the message below it. The static reference uses a single subtle image entrance. The asset has 768px and 1536px WebP variants plus a PNG fallback; keep explicit dimensions and responsive sizes so it loads quickly without layout shift. In React, use the already-installed framer-motion dependency for a one-time opacity/scale arrival; do not add a motion package, looping effects, parallax, or movement on every card. Respect reduced-motion preferences with useReducedMotion or the app's shared Motion configuration. Follow Motion's current [reduced-motion guidance](https://motion.dev/docs/react-accessibility). The effect should be removable without affecting content.

## Shared anatomy and variants

### Template card

Use for public catalogue entries and the workspace's built-in or owned template shelves.

1. Compact art band: realm-specific outline icon on a flat semantic tint, with the two-party mark only when it adds useful context.
2. Identity: template name, then the named role pair.
3. Facts: realm and Aspect count; show membership/plan information at the collection level when it is identical across every card.
4. Actions: `View details` and one primary use action. Public use preserves the selected template into registration; workspace use opens the relationship creation step with that template selected.

Keep the authored `who it is for / not for` text and the full ordered Aspect list on the detail page. The browse card should stay short enough to compare quickly. Search may index the authored descriptors even when the card does not print them.

### Relationship card

Reuse the same frame, cover, title scale, facts row, and action row. Replace template-only fields with relationship facts the current read actually provides: template title, the other party's name from the viewer's seat, viewer role, stored status, Aspect count, invitation state, and the available date/session label.

Keep the current action contract: one strong state-aware action, such as `Publish Assessment`, `Complete Relationship`, or `Open Relationship`; show `Open Assessment` only when its destination exists. Keep less common actions in the row menu. Do not show private other-party answers, unreturned progress, or an invented alignment score on the card.

### Compact list row

The row is a density variation of the relationship card, not a second information model. It keeps a compact realm icon or two-party mark, title/party, one status label, a short facts segment, and one action. Preserve search, status filters, sorting, and grid/list toggle behavior. On narrow screens, wrap metadata under the title rather than forcing page-level horizontal scroll.

### Detail page

Keep the app's existing shared `RecordDetailShell` order: identity band → facts and action aside → authored content. Align both the template and relationship detail views to one graphite identity band with a narrow cyan rule and the appropriate realm icon plus shared two-party mark. For templates, print the descriptor pair and every Aspect with its two named endpoints. For relationships, print only data the current viewer's role and read permission allow, and keep stage actions in the existing action panel.

### Aspect row

Use the same reading pattern wherever an Aspect appears: prompt first, then the two named Values at scale ends 1 and 5. A simple numbered/ruled row is enough; avoid a metric tile, chart, or background that makes the Aspect look scored before opinions exist. Preserve blind-answer boundaries and existing mode/setting behavior.

## Density and shape

- Page measure: approximately 1180px for public catalogue; follow the product shell measure in dashboard views.
- Card radius: 5–7px, one-pixel neutral border, white surface; no heavy shadow at rest.
- Card art: about 72–88px in a catalog grid; compact 40–50px outline icon in a row.
- Card body: 14–16px inset; titles 16–18px; role and metadata 11–13px.
- Primary actions: graphite fill, white text, compact 32–36px height.
- Secondary actions: neutral outline/text, never equal emphasis to the primary action.
- Use a one-line facts row, not a stack of metric tiles. Allow text to wrap before shrinking it below a readable size.

## Reuse in the current application

The app already has a useful shared base in `lib/member/card.ts`: `MemberCard`, `CARD_FRAME`, `CARD_COVER`, `CARD_COVER_WORD`, `CARD_TITLE`, `CARD_META`, and `CARD_ACTIONS`. Evolve this shared base instead of adding separate public, template, and relationship card frames.

Recommended component boundaries:

- RecordArtwork: shared art slot; receives realm and approved flat tint. Renders that realm's outline icon, plus the two-party mark only where appropriate. Never derives artwork from initials.
- `RecordCard`: shared frame and body layout; discriminated template/relationship variants supply their own facts and actions.
- `RecordCardGrid` / `RecordRow`: grid and compact layout wrappers over the same projections.
- `RecordDetailShell`: preserve the existing shared detail component and its current semantic hooks.
- `AspectRow`: reusable prompt/endpoints presentation for detail, answer, and report views where their interaction states permit.

Use existing projections and copy fixtures: `lib/member/card.ts`, `lib/member/shelf.ts`, `lib/template-catalogue.ts`, `data/relationship-types.ts`, `data/pages/dashboard-templates.ts`, `data/pages/dashboard-relationships.ts`, and the relevant detail-page fixtures. Components should not calculate counts, invent status text, infer permissions, or embed user-facing copy.

The current mutedGradientFor() creates arbitrary HSL tints per slug. Replace those record-cover gradients with a realm-to-tint map and the realm outline art above. Remove monogram rendering from record covers while preserving the brand record and unrelated category behavior.

## Route rollout

1. `RecordArtwork` and the template/relationship card frames in `/dashboard/templates` and `/dashboard/relationships`.
2. Grid and compact row variations for those workspace shelves; preserve their existing search/filter/sort and state-specific actions.
3. Public `/relationship-types` listing using the same visual card anatomy but its public actions and shared marketing shell.
4. Public `/relationship-types/[slug]` and workspace template/relationship detail pages using the shared identity band and Aspect rows.
5. Extend the visual treatment to other AlignSynch record collections in route-sized batches, checking each record's actual fields and permissions. Keep QuizHub unchanged.

## Quality rules

- State, role, and participant identity remain readable in text; color is only a supporting cue.
- Every card action has a valid route or a real action; do not use decorative buttons.
- Empty, loading, unreadable, and filtered states remain distinct and follow their owning page fixture.
- All filters, details links, primary actions, and overflow menus remain keyboard operable with visible focus.
- Templates are reusable prompts; relationships are two-party instances; neither card should imply the other model.
- No design claim may reveal a score or answer that the current privacy projection does not provide.

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Product** › AS2 catalogue UI system · prev [AS2 templates redesign — implementation brief](IMPLEMENTATION-PROMPT.md) · next [AS2 templates redesign — source notes](SOURCE-NOTES.md)

<!-- docs-nav:end -->
