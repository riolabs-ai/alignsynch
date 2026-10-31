# PROVENANCE — the legal pages, version 1

Where `/terms` and `/privacy` came from, what was taken out of the source templates and why, and
which statements are assumptions a lawyer must confirm before either page is described as final.

The pages themselves are `data/pages/legal.ts`, rendered by `components/legal/legal-page.tsx`.
This document is the audit trail for both; it is not legal advice and it does not make the copy
reviewed.

## Source and licence

- Source: `github.com/ryuno2525/privacy-policy-templates` — a set of plain-text legal templates.
- Licence: **MIT**, `Copyright (c) 2026 PolicyForge`. The full notice is in that repository's
  `LICENSE`; the MIT terms require the copyright and permission notice to travel with copies of the
  text, which is why both pages end in a "Template attribution" section naming PolicyForge,
  Copyright (c) 2026 PolicyForge and the MIT License, and why the header of `data/pages/legal.ts`
  carries the same notice.
- Templates adapted:
  - `/privacy` from `templates/saas-web-app.md` (13 `##` sections)
  - `/terms` from `templates/terms-of-service-basic.md` (15 `##` sections)
- Date fetched: **2026-10-31** (both files read from a checkout taken that morning).
- **Adapted, not copied.** The section list, the clause structure and most of the boilerplate are
  the templates'; every sentence that states a fact about this product was rewritten to match what
  the code in this repository actually does, and eleven template sections were removed outright
  (below). The claim-by-claim evidence — what the copy says, which file was read, which symbol or
  table proves it — is `legal-FACTS.md`, kept beside this page's inputs.

**Deliberately not used:** `Automattic/legalmattic`. It is CC BY-**SA** 4.0, and share-alike would
oblige us to license our own terms the same way. MIT has no such condition. Nothing in these pages
derives from it, not even as inspiration.

## Removed from the templates, and why

Each of these describes a product we do not ship, a provider we have not engaged, or a certification
we do not hold. Filling one in would have been a false statement in a legal document.

- **Terms §5 "Payments and Billing"** — removed. There is no payment, billing, checkout or
  subscription code anywhere in the tree, and `docs/ENV-SPEC.md` keeps payments a hard non-goal.
  The liability cap says the product currently charges nothing rather than inventing paid tiers.
- **Terms §12.3 "Arbitration"** — removed, not filled. The template carries a `[PLACEHOLDER]` for an
  arbitration provider and no provider is designated anywhere. The section was replaced with the
  template's own Option B: governing law and venue in court, with the draft saying in terms that no
  arbitration provider is designated.
- **Terms §4.3 "Usage Limits"** — removed. The product defines no API, storage or bandwidth limits;
  a numeric limit would have been invented.
- **Terms §14.6 / §15, physical address** — removed. No postal address is published anywhere in the
  repository, so both pages say email is the supported channel instead of naming one.
- **Privacy: Data Protection Officer block** — removed. No DPO has been appointed; the copy states
  that fact, in §8.3 and in §13, instead of naming a person or an address.
- **Privacy: EU representative block** — removed. None has been designated, and the copy says so.
- **Privacy: "Security measures" list (AES-256 at rest, regular audits, penetration tests, SOC 2,
  MFA, role-based access control, automated backups)** — removed. None of it is implemented or
  evidenced in this tree. It is replaced by §4.2 (what the code does do: HTTPS, TLS to the database,
  SHA-256 token hashes, constant-time comparison, server-only credentials) and §4.3 (an explicit
  statement that no audit and no SOC 2 report exist).
- **Privacy: "Data breach response" (72 hours, supervisory-authority notification)** — removed. No
  incident-response mechanism exists; §4.4 says notice will be given as and to the extent the law
  requires, which is what can be promised today.
- **Privacy: "Retention" table (12-month logs, 7-year payment records, 3-year support tickets)** —
  removed. No retention schedule is implemented. §7 keeps only the facts that are: invitations and
  the assessment cookies expire after 7 days, assessments are kept while the Service operates, and
  there is no automated deletion.
- **Privacy: "International transfers" (Standard Contractual Clauses and DPAs)** — removed. No such
  instruments are in place; §10 says that plainly and defers the decision to counsel.
- **Privacy: marketing-consent rows in "How we use your information"** — removed. The product sends
  no marketing email and has no consent or opt-out flow; §3 states that no marketing email is sent.
- **Privacy: "Payment processor" third-party row and the billing-information bullet** — removed, for
  the same reason as Terms §5.
- **Privacy: "Authentication providers: Google, GitHub OAuth" row** — removed. Only Neon Auth exists;
  no OAuth provider is wired into this build.
- **Privacy: error-tracking and CDN third-party rows** — removed. Neither is configured, so neither
  is disclosed.

## Assumptions counsel must confirm

These are stated in the pages as they are written, not as facts the repository proves. Each one is a
decision for a lawyer, and each is flagged rather than hidden.

- **Governing law: the State of Texas.** Nothing in the repository names a jurisdiction. RioLabs, the
  operator, is Austin-based per the tasking; the alternative — a Delaware choice — has been decided
  by nobody. Terms §11 states Texas law and Texas venue on that basis, and this line is the record
  that the choice is an assumption.
- **The operating entity is "RioLabs".** Both pages say the product is "operated by RioLabs". The
  entity's registered name, its registration number and its address are **not** established anywhere
  in this repository and have deliberately not been invented: the contact sections say that no
  postal address is currently published, rather than printing a plausible-looking one.
- **The entity behind the brand.** `data/brands/alignsynch.ts` sets `legalName: "AlignSynch"`, which
  is the product's name and not a registered company. Whether the contracting party should be
  "AlignSynch" or "RioLabs" (or both, described correctly) is for counsel.
- **Retention.** The pages state what the build does — 7-day invitations and cookies, assessments
  kept while the Service operates, no automated deletion — and no schedule beyond that. A written
  retention policy, if one is adopted, must replace §7 rather than sit beside it.
- **Minimum age: 16.** Adopted from the template as a policy floor. The sign-up wizard collects a
  date of birth and nothing enforces an age, so the number is a policy statement, not a control.
- **No Data Protection Officer, no EU or UK representative.** Stated as fact because none exists; if
  one is appointed, §8.3 and §13 both need changing.
- **Sub-processor terms.** Neon, Vercel and Resend are named as processors. Their own data
  processing agreements, retention periods and processing locations are external to this repository
  and were not read; the pages point at their policies rather than asserting terms.
- **Version 1 has no effective date.** Both pages say so, and the draft notice says the terms will be
  reviewed by counsel before general availability. When counsel signs off, the notice comes out of
  `data/pages/legal.ts` in one edit — it is produced by `draftNotice()`, one function, and both
  routes render it first.

## Brand keying

The copy is one document, resolved per build from the `Brand` record: the product's name, its domain
and its support address come from `data/brand.ts`, so the AlignSynch build says `alignsynch.com` and
`alignsynch@riolabs.ai` and the QuizHub build says `quizhub.com` and `quizhub@riolabs.ai`. The
**operator is not keyed by brand** — it is RioLabs for both, because it is one company shipping two
products, and inventing a second entity for the second brand is exactly the error this document
exists to prevent. Everything else in the two documents is identical between builds.

## What these pages are not

- Not reviewed by a lawyer.
- Not an effective agreement: both carry a non-dismissible notice saying so, and the notice renders
  first on both routes by construction (`components/legal/legal-page.tsx` draws it above the
  document and offers no way to hide it).
- Not a compliance artefact: no certification, audit, DPO, EU representative, transfer mechanism or
  retention schedule is claimed, because none exists.
