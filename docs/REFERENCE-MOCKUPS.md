# REFERENCE — mockups from the specification

**Inspiration, not instruction.** The images in `docs/reference/mockups/` are page renders from
`docs/AlignSynch.com - Website Specs.pdf` (V2-01-01g, Dec 2023). They show how the product was
imagined before it was built. Use them to improve layout, flow and vocabulary. **Do not** treat a
mockup as a requirement: several describe a business (subscriptions, Account Bank, branded coaches)
this template does not implement, and one contradicts the current data model. Where a mockup and
`content/` disagree, the model wins and the disagreement is recorded in `docs/SPEC-DRIFT.md`.

Rendered at 150 dpi with `pdftoppm -r 150 -png`. The PDF stays the source; these are copies.

| file                                            | page | what it shows                                                                                                                                                                                                                         |
| ----------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01-home.png`                                   | 8    | Home: header (`Home, About, Relationships, Pricing, FAQ, Contact` + LOG IN), hero "Improve Relationships / Reduce Stress & Surprises", the "Are you on the Same Page as ____?" prompt pattern, CTA "Choose a relationship to improve" |
| `02-dashboard-your-relationships-templates.png` | 9    | Relationship Dashboard: a **Your Relationships** table (name, other party, stage, four flag columns, mode, setting, last modified), then **Relationship Templates** (Business / Personal / Custom) and **My Templates**               |
| `03-relationship-maintenance.png`               | 10   | Relationship Maintenance screen                                                                                                                                                                                                       |
| `04-relationship-level-basic.png`               | 11   | Relationship Level in **Basic Mode**: the eight-stage bar, then a table of Aspects with **Left / Mid / Right Value (1–3–5)** and FEEL / WISH slider pairs per party                                                                   |
| `05-relationship-level-advanced.png`            | 13   | The same screen in **Advanced Mode**: four opinions per Aspect                                                                                                                                                                        |
| `07-pricing.png`                                | 23   | Pricing page                                                                                                                                                                                                                          |
| `08-stage-bar-and-stage-terms.png`              | 57   | **The eight stages, defined**: A–D are _stage of User_ (Play → Registered → **Parties Locked at Account Bank zero** → Subscribed); 1–4 are _stage of Relationship_ (Invited → Connected → Sharing → Aligned)                          |
| `09-gap-analysis-terms.png`                     | 65   | Gap analysis vocabulary                                                                                                                                                                                                               |
| `11-register-form.png`                          | 118  | Registration form mockup — unique username, first name, last name, email; plus the requirement notes around it                                                                                                                        |

## What is worth borrowing, and what is not

**Worth borrowing**

- The **stage bar** as one horizontal progression, numeric stage and human label together ("3 · Sharing").
- The **four flag columns with counts** on the relationships list — one glance instead of seven rows.
- The **built-in vs My Templates split**: a starting point you copy and edit, kept visibly separate from the ones you made.
- The **prompt pattern** on the home page — "Are you on the Same Page as ____?" — which makes an abstract product concrete by naming a person.
- Registration asking for **username, first name, last name, email**, and nothing else.

**Do not borrow**

- The dense spreadsheet table on p11 is a wireframe for a desktop Excel habit, not a target for a responsive screen. Keep the _content_ (aspect, two values, per-party opinions), not the layout.
- Anything about **Account Bank, Relationship Week, subscriptions, lock watermarks** (stages A–D). That is a billing product this template does not have.
- The **Mid Value (notch 3)**. The mockup shows a three-anchor scale; `content/record.ts` models two Values per Aspect. Adding a middle anchor is a schema decision, not styling — see `docs/SPEC-DRIFT.md`.
