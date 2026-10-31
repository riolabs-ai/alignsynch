/**
 * `/terms` and `/privacy` — legal page copy, Version 1 DRAFT, for both brands (issue #270).
 *
 * Adapted from PolicyForge's MIT-licensed templates — Copyright (c) 2026 PolicyForge,
 * used under the MIT License (the licence requires this notice in copies of the text):
 *   Privacy: templates/saas-web-app.md (13 sections) — github.com/ryuno2525/privacy-policy-templates
 *   Terms:   templates/terms-of-service-basic.md (15 sections) — same repository
 * The provenance, the removals and the assumptions are `docs/legal/PROVENANCE.md`; the
 * claim-by-claim evidence table is beside the draft this file was built from.
 *
 * **Draft status.** Not reviewed by a lawyer. Any view that renders this copy MUST draw the
 * `draft-notice` section first and must not offer a way to dismiss it. The sentence is
 * `draftNotice()`, one function, so the two pages cannot drift.
 *
 * **Two brands, one operator.** The words are the same document for both builds; what changes
 * is who the reader is dealing with. Every brand fact is read from the `Brand` record — the
 * product's name, its domain and its support address — and nothing here types `alignsynch.com`
 * or an address by hand, exactly as `data/pages/login.ts` reads the brand for its hero. The
 * *operating entity* is not a brand fact and is not invented per brand: it is RioLabs, the one
 * operator behind both builds, so both pages name the same entity. `docs/legal/PROVENANCE.md`
 * records that decision and the facts counsel still has to confirm.
 *
 * **Removed from the templates, with the reason** (all of it is in `PROVENANCE.md`):
 *   Terms §5 "Payments and Billing" — no payment or billing code exists anywhere in this tree;
 *     the liability cap says "charges nothing" instead of inventing paid tiers.
 *   Terms §12.3 "Arbitration" — no arbitration provider is designated anywhere; replaced with
 *     the template's Option B (court venue), never an invented body.
 *   Terms §4.3 "Usage Limits" — the product defines no usage limits; dropped rather than filled
 *     with invented numbers.
 *   Terms §14.6/§15 physical address — no address is published anywhere in the repo; the contact
 *     section says email is the supported channel.
 *   Privacy DPO and EU-representative blocks — the company has neither; the copy says so.
 *   Privacy SOC 2 / audits / penetration tests / AES-256-at-rest / automated backups / 72-hour
 *     breach notification / SCCs and DPAs / a numeric retention table — none of it is
 *     implemented or evidenced in this tree; the copy states what is true instead.
 *   Privacy "How we use" marketing-consent rows, payment-processor and OAuth-provider rows —
 *     no marketing email, no payments and no OAuth provider exist in this build.
 *
 * Shape — the same as `data/pages/assessment.ts`: one `zPageCopy.parse({ … })` per route, sections
 * with `id` / `heading` / `body`, and `items` (`{ id, label, body }`) for sub-clauses. Paragraphs
 * inside one body are separated by `\n\n`; a block of `- ` lines is a list, and
 * `components/legal/legal-page.tsx` renders it as one. No React, no Next: `data:check` compiles
 * this file with `tsconfig.datacheck.json` and runs it under plain node.
 */
import type { Brand } from "../../content/brand";
import { zPageCopy, type PageCopy } from "../../content/pages";
import { brand } from "../brand";

/**
 * The sentence both pages show first, once per build.
 *
 * One function of the brand's name rather than two strings, because the requirement is that the
 * two pages cannot drift and that the words name the product the reader is using: the AlignSynch
 * build renders exactly the sentence issue #270 specifies, and the QuizHub build the same
 * sentence with its own name. Returning it from here — rather than letting each fixture repeat it
 * — is what makes "one string" true.
 */
export function draftNotice(record: Pick<Brand, "name">): string {
  return `Version 1 draft. Adapted from an MIT-licensed template and not reviewed by a lawyer. ${record.name} will have these terms reviewed by counsel before general availability.`;
}

/** The brand facts these pages need. Deliberately narrower than `Brand`: no colour, no logo. */
export type LegalBrand = Pick<Brand, "name" | "domain" | "supportEmail">;

/**
 * The two pages, for one brand record.
 *
 * A function rather than two exported constants, because a second brand must not be able to
 * inherit the first one's address by accident: `data/pages/index.ts` calls it with the build's
 * `brand`, and both route modules read the same resolved object.
 */
export function legalCopy(record: LegalBrand): { terms: PageCopy; privacy: PageCopy } {
  const entity = "RioLabs";
  const notice = draftNotice(record);

  const terms: PageCopy = zPageCopy.parse({
    heading: "Terms of Service",
    subtitle: `The rules for using ${record.name}, the two-person assessment service that measures the Gap between your answers and theirs.`,
    cta: { label: "Privacy Policy", href: "/privacy" },
    sections: [
      {
        id: "draft-notice",
        heading: "Version 1 draft",
        body: `${notice} This version has no effective date and creates no obligations until a final version is published.`,
      },
      {
        id: "agreement",
        heading: "1. Agreement to Terms",
        body: `These Terms of Service ("Terms") are a legally binding agreement between you and ${record.name} ("we," "us," or "our"), operated by ${entity}, governing your access to and use of the ${record.name} application and the assessment templates, invitations, reports and related services it provides (collectively, the "Service"). The Service is provided at ${record.domain} and at any address a build of the Service is deployed to.\n\nBy creating an account, starting or answering an assessment, or otherwise using the Service, you agree to be bound by these Terms. If you do not agree to these Terms, do not use the Service.\n\nWe may update these Terms from time to time. Material changes will be posted on the Service. Your continued use of the Service after a revised version is posted constitutes your acceptance of it.`,
      },
      {
        id: "eligibility",
        heading: "2. Eligibility",
        body: `To use the Service you must be at least 16 years of age (or the age of majority in your jurisdiction, whichever is greater) and have the legal capacity to enter into a binding agreement. You must not be prohibited from using the Service under applicable law.\n\nIf you use the Service on behalf of an organization, you represent and warrant that you have the authority to bind that organization to these Terms.`,
      },
      {
        id: "accounts",
        heading: "3. Accounts",
        body: "Some features of the Service, such as keeping a list of your assessments, require an account.",
        items: [
          {
            id: "creating",
            label: "3.1 Creating an account",
            body: `You register with a name, an email address and a password. You agree to provide accurate information. Sign-up and sign-in are handled by Neon Auth, a managed authentication service operated by Neon: ${record.name} never stores your password itself.`,
          },
          {
            id: "security",
            label: "3.2 Account security",
            body: `You are responsible for keeping your credentials secure and confidential, and for all activity that occurs under your account, whether or not you authorized it. Notify us immediately at ${record.supportEmail} of any unauthorized use of your account.`,
          },
          {
            id: "termination",
            label: "3.3 Account termination",
            body: `We reserve the right to suspend or terminate your account for violation of these Terms, fraudulent or abusive conduct, or requests by law enforcement or government agencies.\n\nThe current build has no self-service account deletion. To request deletion of your account and its data, write to ${record.supportEmail}.`,
          },
        ],
      },
      {
        id: "use",
        heading: "4. Use of the Service",
        items: [
          {
            id: "license",
            label: "4.1 License grant",
            body: "Subject to your compliance with these Terms, we grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for your personal purposes.",
          },
          {
            id: "acceptable-use",
            label: "4.2 Acceptable use",
            body: `You agree not to use the Service to:\n\n- violate any applicable law, regulation, or third-party rights\n- attempt to view another person's answers before the Service reveals them (each assessment's answers stay blind until both people have submitted)\n- attempt to gain unauthorized access to the Service, other accounts, or computer systems\n- interfere with or disrupt the integrity or performance of the Service\n- scrape, crawl, or use automated means to access the Service without our express written permission\n- reverse engineer, decompile, or disassemble any part of the Service\n- upload, transmit, or distribute viruses or other harmful code\n- impersonate any person or entity\n- use the Service to send unsolicited commercial communications (spam)\n- collect or harvest personal information of other users without their consent\n- use the Service in any way that could damage, disable, overburden, or impair it`,
          },
        ],
      },
      {
        id: "ip",
        heading: "5. Intellectual Property",
        items: [
          {
            id: "ours",
            label: "5.1 Our intellectual property",
            body: `The Service, including its design, features, functionality, source code, trademarks, service marks and logos, is and shall remain the exclusive property of ${record.name} and its licensors, and is protected by copyright, trademark, trade secret and other intellectual property laws. These Terms themselves are adapted from an MIT-licensed template; see the attribution section below.`,
          },
          {
            id: "yours",
            label: "5.2 Your content",
            body: `You retain ownership of the content you submit through the Service, including your answers and any templates you write ("User Content"). By submitting User Content, you grant us a worldwide, non-exclusive, royalty-free license to use, store, display and transmit your User Content in connection with operating the Service — which includes showing your answers to the other person in your assessment once both of you have submitted.\n\nYou represent and warrant that you own or have the necessary rights to your User Content, that it does not infringe the intellectual property rights of any third party, and that it does not violate any applicable law.`,
          },
          {
            id: "feedback",
            label: "5.3 Feedback",
            body: "If you provide feedback, suggestions or ideas about the Service, we may use them without obligation to you.",
          },
        ],
      },
      {
        id: "user-content",
        heading: "6. User Content",
        items: [
          {
            id: "responsibility",
            label: "6.1 Responsibility",
            body: "You are solely responsible for your User Content and the consequences of submitting it. An assessment is a structured comparison of two people's own answers — the Gap is arithmetic on those answers — and the Service does not provide relationship, medical, legal or any other professional advice.",
          },
          {
            id: "moderation",
            label: "6.2 Content moderation",
            body: "We reserve the right, but are not obligated, to review, edit or remove User Content that we determine, in our sole discretion, to violate these Terms, to be offensive or harmful, to violate any third party's rights, or to be otherwise inappropriate.",
          },
          {
            id: "removal",
            label: "6.3 Content removal and the freeze",
            body: `Once both people in an assessment have submitted their answers, the answers are frozen by design and can no longer be changed. Before that point, each person may resubmit their own answers.\n\nTo ask us to remove content, write to ${record.supportEmail}. There is no automated content or account deletion in the current build; requests are handled manually.`,
          },
        ],
      },
      {
        id: "third-parties",
        heading: "7. Third-Party Services and Links",
        body: "The Service depends on third parties we do not control: Neon (database and authentication), Vercel (hosting), and Resend (transactional email, when a mail provider is configured on a deployment). Their terms and privacy policies govern their part of the Service.\n\nThe Service may contain links to third-party websites, services or resources that are not owned or controlled by us. We are not responsible for the content, privacy policies or practices of any third-party services, and your use of them is at your own risk.",
      },
      {
        id: "disclaimer",
        heading: "8. Disclaimer of Warranties",
        body: 'THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED.\n\nTo the fullest extent permitted by applicable law, we disclaim all warranties, including but not limited to implied warranties of merchantability, fitness for a particular purpose and non-infringement, warranties that the Service will be uninterrupted, timely, secure or error-free, warranties regarding the accuracy, reliability or completeness of any content available through the Service, and warranties that defects will be corrected. The Service is an early prototype, and its features, data and these Terms may change.\n\nSome jurisdictions do not allow the exclusion of certain warranties. In such jurisdictions, the above exclusions may not apply to you.',
      },
      {
        id: "liability",
        heading: "9. Limitation of Liability",
        body: `TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL ${record.name.toUpperCase()}, ITS OPERATOR RIO LABS, OR ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, SUPPLIERS OR LICENSORS BE LIABLE FOR:\n\n- any indirect, incidental, special, consequential, or punitive damages\n- any loss of profits, revenue, data, goodwill, or other intangible losses\n- any damages resulting from your access to or use of (or inability to access or use) the Service\n- any damages resulting from any unauthorized access to or alteration of your transmissions or data\n- any damages resulting from statements or conduct of any third party on the Service\n- any other matter relating to the Service\n\nOUR TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE LIABILITY — ${record.name.toUpperCase()} CURRENTLY CHARGES NOTHING — OR (B) ONE HUNDRED U.S. DOLLARS (USD $100).\n\nSome jurisdictions do not allow the exclusion or limitation of liability for consequential or incidental damages. In such jurisdictions, our liability shall be limited to the greatest extent permitted by law.`,
      },
      {
        id: "indemnity",
        heading: "10. Indemnification",
        body: `You agree to indemnify, defend and hold harmless ${record.name} and its officers, directors, employees, agents and affiliates from and against any claims, liabilities, damages, losses, costs and expenses (including reasonable attorneys' fees) arising out of or related to your use of the Service, your User Content, your violation of these Terms, your violation of any law or third-party rights, or any dispute between you and another user of the Service.`,
      },
      {
        id: "disputes",
        heading: "11. Dispute Resolution and Governing Law",
        items: [
          {
            id: "governing-law",
            label: "11.1 Governing law",
            body: "These Terms shall be governed by and construed in accordance with the laws of the State of Texas, without regard to its conflict of law provisions.",
          },
          {
            id: "informal",
            label: "11.2 Informal resolution",
            body: `Before filing any formal dispute, you agree to first attempt to resolve the issue informally by contacting us at ${record.supportEmail}. We will attempt to resolve the dispute informally within 30 days.`,
          },
          {
            id: "venue",
            label: "11.3 Venue",
            body: "Any dispute arising from these Terms that cannot be resolved informally shall be brought exclusively in the state or federal courts located in the State of Texas, and you consent to the personal jurisdiction and venue of such courts. This draft designates no arbitration provider; disputes are resolved in court.",
          },
          {
            id: "class-waiver",
            label: "11.4 Class action waiver",
            body: "To the maximum extent permitted by applicable law, you agree to resolve disputes with us on an individual basis and waive any right to participate in a class action, class arbitration, or any other representative proceeding.",
          },
        ],
      },
      {
        id: "termination",
        heading: "12. Termination",
        body: "You may terminate your use of the Service at any time by ceasing to use it, and you may request deletion of your account as described in Section 3.3.\n\nWe may terminate or suspend your access to the Service, without prior notice or liability, if you breach these Terms or as otherwise provided in these Terms.\n\nUpon termination, your right to use the Service will immediately cease, and all provisions of these Terms that by their nature should survive termination shall survive, including the intellectual property provisions, warranty disclaimers, limitation of liability, indemnification, and dispute resolution provisions.",
      },
      {
        id: "general",
        heading: "13. General Provisions",
        items: [
          {
            id: "entire-agreement",
            label: "13.1 Entire agreement",
            body: "These Terms, together with the Privacy Policy and any notices posted on the Service, constitute the entire agreement between you and us regarding the Service.",
          },
          {
            id: "severability",
            label: "13.2 Severability",
            body: "If any provision of these Terms is found to be unenforceable or invalid, that provision will be limited or eliminated to the minimum extent necessary, and the remaining provisions will remain in full force and effect.",
          },
          {
            id: "waiver",
            label: "13.3 Waiver",
            body: "Our failure to enforce any right or provision of these Terms will not be considered a waiver of that right or provision.",
          },
          {
            id: "assignment",
            label: "13.4 Assignment",
            body: "You may not assign or transfer your rights or obligations under these Terms without our prior written consent. We may assign our rights and obligations without restriction.",
          },
          {
            id: "force-majeure",
            label: "13.5 Force majeure",
            body: "We shall not be liable for any failure or delay in performing our obligations under these Terms due to circumstances beyond our reasonable control, including but not limited to natural disasters, war, terrorism, riots, government actions, internet disruptions, or pandemics.",
          },
          {
            id: "notices",
            label: "13.6 Notices",
            body: `We may provide notices to you via email to the address associated with your account, or through the Service. Notices to us should be sent to ${record.supportEmail}.`,
          },
        ],
      },
      {
        id: "contact",
        heading: "14. Contact Information",
        body: `If you have questions about these Terms of Service, contact us:\n\n- ${record.name}, operated by ${entity}\n- Email: ${record.supportEmail}\n- Website: ${record.domain}\n\n${record.name} does not currently publish a postal address; email is the supported channel for questions about these Terms.`,
      },
      {
        id: "attribution",
        heading: "Template attribution",
        body: "These Terms of Service are adapted from a legal template by PolicyForge, Copyright (c) 2026 PolicyForge, used under the MIT License.",
      },
    ],
  });

  const privacy: PageCopy = zPageCopy.parse({
    heading: "Privacy Policy",
    subtitle: `What ${record.name} collects, why it collects it, and what you can ask for — stated only as far as the codebase proves it.`,
    cta: { label: "Terms of Service", href: "/terms" },
    sections: [
      {
        id: "draft-notice",
        heading: "Version 1 draft",
        body: `${notice} This version has no effective date; it describes the Service as it is built today and will be reviewed before general availability.`,
      },
      {
        id: "intro",
        heading: "1. Introduction",
        body: `${record.name} ("we," "our," or "us"), operated by ${entity}, operates the ${record.name} application (the "Service"), in which two people answer the same questions about their relationship. Each person answers, for each question, how things feel now and how they wish things were; neither person can see the other's answers until both have submitted, and the difference between the two answers is called the Gap. The Service is provided at ${record.domain} and at any address a build of the Service is deployed to.\n\nThis Privacy Policy explains what information we collect, how we use it, and your choices. ${record.name} does not currently publish a postal address; privacy questions go to ${record.supportEmail}.`,
      },
      {
        id: "collects",
        heading: "2. Information We Collect",
        items: [
          {
            id: "account",
            label: "2.1 Account information",
            body: `When you register, you give a name, an email address and a password. Sign-up and sign-in are handled by Neon Auth, a managed authentication service operated by Neon, so your email and password live in Neon's managed database rather than in the tables ${record.name} owns, and ${record.name} never stores your password itself. The profile the app keeps is deliberately small: a public handle, a display name, an optional one-paragraph bio, and an optional country — and nothing else.`,
          },
          {
            id: "wizard",
            label: "2.2 Onboarding questions",
            body: "The sign-up wizard asks about interests, skill level, phone number and date of birth. In the current build, only your name, email and password are transmitted anywhere: the other wizard fields are not sent to any server and are not stored by us.",
          },
          {
            id: "assessment",
            label: "2.3 Assessment content",
            body: "When an assessment is started, we store the two people's names, the invited person's email address (and the starter's, when they are signed in), the template used, and each person's answers — for every question, a score from 1 to 5 for how it feels now and a score from 1 to 5 for how they wish it to be, plus in Advanced Mode what each thinks the other answered and what they would guess. The Gap is calculated from these scores when a report is shown; it is never stored as its own value.",
          },
          {
            id: "usage",
            label: "2.4 Usage data",
            body: `${record.name} does not integrate third-party analytics, advertising or tracking SDKs, and the application sends no telemetry about you to anyone. Our hosting provider, Vercel, serves the application and may keep standard web-server logs (such as IP address and browser type), as hosting providers do. The application's own logs record only operational events — for example, whether an email send was refused, as an HTTP status code — and never the content of a message, a link it contains, or a recipient's address.`,
          },
          {
            id: "from-providers",
            label: "2.5 Information from third parties",
            body: "Neon Auth gives us your user id, your email address and the name you chose at sign-up, so the application can associate you with your profile and your assessments.",
          },
          {
            id: "not-collected",
            label: "2.6 What we do not collect",
            body: "The Service does not process payments, so we never collect payment card numbers, billing details or anything a payment provider would hold.",
          },
        ],
      },
      {
        id: "use",
        heading: "3. How We Use Your Information",
        items: [
          {
            id: "operate",
            label: "To run the Service",
            body: "Creating and claiming assessments, keeping each person's answers hidden until both have submitted, computing the Gap, and sending the two messages the Service sends: the invitation email, and the notice that answers are complete.",
          },
          {
            id: "support",
            label: "To support and protect the Service",
            body: "Answering your requests, guarding against abuse, and protecting the security of the Service.",
          },
          {
            id: "legal",
            label: "To meet legal obligations",
            body: "Complying with applicable law, and defending our rights.",
          },
          {
            id: "no-marketing",
            label: "We do not send marketing email",
            body: "The only messages the Service sends are the two transactional ones above, and only when a deployment has a mail provider configured. There is no newsletter, no product announcements list, and no advertising.",
          },
        ],
      },
      {
        id: "storage",
        heading: "4. Data Storage and Security",
        items: [
          {
            id: "where",
            label: "4.1 Where your data lives",
            body: "Assessments, invitations, profiles and answers are stored in a PostgreSQL database operated by Neon, in Neon's us-east-2 (AWS) region. Accounts, passwords and sessions live in Neon's managed authentication database. The application itself is hosted by Vercel.",
          },
          {
            id: "measures",
            label: "4.2 What we do to protect it",
            body: "The Service is served over HTTPS. Database connections are made over TLS. Invitation and access tokens are stored only as SHA-256 hashes — the raw tokens are never written to the database — and token comparisons are performed in constant time. Credentials such as database connection strings and mail-provider keys exist only on the server and are never sent to browsers.",
          },
          {
            id: "honest",
            label: "4.3 What we do not claim",
            body: `${record.name} is a prototype. We have not completed a formal security audit, we do not hold a SOC 2 report or any comparable certification, and this draft makes no claim that we do. (A marketing page inherited from the template skin makes broader claims; this policy, not that page, is the accurate statement.)`,
          },
          {
            id: "breach",
            label: "4.4 If a breach happens",
            body: "If a breach affects your personal information, we will notify you through the contact details we hold about you, as and to the extent required by applicable law.",
          },
        ],
      },
      {
        id: "providers",
        heading: "5. Third-Party Services",
        body: "These third parties process data as part of providing the Service:",
        items: [
          {
            id: "neon",
            label: "Neon (PostgreSQL database and Neon Auth)",
            body: "Stores assessment data, profiles, invitations and answers, and manages accounts and sessions. Receives the information described in Sections 2.1 and 2.3.",
          },
          {
            id: "vercel",
            label: "Vercel (hosting)",
            body: "Hosts and serves the application, and may keep standard web-server logs as described in Section 2.4.",
          },
          {
            id: "resend",
            label: "Resend (transactional email, when configured)",
            body: "Sends the invitation email and the completion notice on deployments where a mail provider is configured. Receives the recipient's address and the message text.",
          },
        ],
      },
      {
        id: "sharing",
        heading: "6. How Information Is Shared",
        body: "We do not sell your personal information, and no advertising network receives it.",
        items: [
          {
            id: "other-party",
            label: "With the other person in your assessment",
            body: "This is the point of the Service: once both people have submitted, your answers are shown to the other person and theirs to you. Before both have submitted, neither person can see the other's answers — this blindness is enforced in how the database is read, not just on screen.",
          },
          {
            id: "service-providers",
            label: "With service providers",
            body: "With the providers listed in Section 5, strictly as needed to provide the Service.",
          },
          {
            id: "legal-compliance",
            label: "For legal compliance",
            body: "When required by law, subpoena or court order.",
          },
          {
            id: "business-transfer",
            label: "During business transfers",
            body: "In connection with a merger, acquisition or asset sale; your information would remain subject to this policy, and you will be notified.",
          },
        ],
      },
      {
        id: "retention",
        heading: "7. Retention",
        items: [
          {
            id: "invites",
            label: "Invitations",
            body: "An invitation expires 7 days after it is created, after which its link stops working. The browser cookies that let each person answer expire within the same period.",
          },
          {
            id: "answers",
            label: "Assessments and answers",
            body: "Assessments and their answers are kept for as long as the Service operates. Once both people have submitted, the answers are frozen by design and cannot be edited; a person may resubmit their own answers only before the assessment is complete.",
          },
          {
            id: "deletion",
            label: "Deletion",
            body: `There is no automated deletion in the current build. You may request deletion of your account and its data by writing to ${record.supportEmail}; requests are handled manually and answered within a reasonable time.`,
          },
        ],
      },
      {
        id: "rights",
        heading: "8. Your Rights and Choices",
        items: [
          {
            id: "access",
            label: "Access, correction and deletion",
            body: `You may ask us for a copy of the personal information we hold about you, ask for corrections, or ask that we delete it, by writing to ${record.supportEmail}. Self-service tools in the current build are limited, so email is the supported channel.`,
          },
          {
            id: "california",
            label: "California residents",
            body: "You have the right to know what personal information is collected about you, the right to request deletion of it, and the right to opt out of its sale — and we do not sell personal information, so there is nothing to opt out of. We do not discriminate against anyone who exercises these rights.",
          },
          {
            id: "eea",
            label: "EEA and UK residents",
            body: `Where the GDPR or UK GDPR applies to you, you also have rights to restrict processing, to data portability, to withdraw consent, and to lodge a complaint with a supervisory authority. ${record.name} has not appointed a Data Protection Officer, and this draft designates no EU or UK representative.`,
          },
        ],
      },
      {
        id: "cookies",
        heading: "9. Cookies",
        items: [
          {
            id: "session",
            label: "Sign-in session cookies",
            body: "Managed by our authentication provider (Neon Auth), these keep you signed in.",
          },
          {
            id: "flow",
            label: "Assessment cookies",
            body: "When you start or claim an assessment, the application sets cookies named flow_party_<instance-id> and flow_invite_<instance-id> that identify you as one of the two people answering. They are httpOnly (scripts cannot read them), sent only over HTTPS in production, and expire within 7 days.",
          },
          {
            id: "none-else",
            label: "What we do not set",
            body: `${record.name} sets no third-party tracking or advertising cookies and loads no analytics pixels or scripts. You can manage or block cookies in your browser settings, though blocking the cookies above will stop assessment links from working.`,
          },
        ],
      },
      {
        id: "international",
        heading: "10. International Data Transfers",
        body: `${record.name}'s database and hosting are located in the United States. If you use the Service from outside the United States, your information will be transferred to and processed in the United States, and by using the Service you consent to that transfer. This draft does not rely on Standard Contractual Clauses or similar transfer instruments, because none have been put in place; this will be revisited with counsel before general availability.`,
      },
      {
        id: "children",
        heading: "11. Children's Privacy",
        body: `The Service is not intended for people under 16 years of age, and we do not knowingly collect personal information from children under that age. If you believe a child has provided us personal information, contact ${record.supportEmail} and we will delete it.`,
      },
      {
        id: "changes",
        heading: "12. Changes to This Policy",
        body: "We will post changes to this policy on this page and, for material changes, let you know through the contact details we hold. Because the current version is a draft, you should treat everything in it as subject to change before general availability. Continued use of the Service after a revised policy is posted constitutes acceptance of the revision.",
      },
      {
        id: "contact",
        heading: "13. Contact",
        body: `For privacy-related inquiries:\n\n- Email: ${record.supportEmail}\n- ${record.name}, operated by ${entity}\n- ${record.name} does not currently publish a postal address, and no Data Protection Officer has been appointed.`,
      },
      {
        id: "attribution",
        heading: "Template attribution",
        body: "This Privacy Policy is adapted from a legal template by PolicyForge, Copyright (c) 2026 PolicyForge, used under the MIT License.",
      },
    ],
  });

  return { terms, privacy };
}

/**
 * The two pages this build renders, keyed by route pattern — the same direction
 * `data/pages/index.ts` keys its table, resolved once for the brand `BRAND` selected.
 *
 * Route modules read this object rather than re-deriving the copy, so the page a reader gets and
 * the fixture `data:check` validates are the same parse.
 */
export const legalPages = legalCopy(brand);
