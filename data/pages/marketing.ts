/**
 * `/welcome` — the public landing page (issue #159).
 *
 * The pitch and the product are two pages with two jobs, and they used to share one shell.
 * This module is the pitch: every sentence the marketing layout and its landing page render
 * lives here, parsed by `zPageCopy` exactly like the other routes, so the seven bands below are
 * a fixture a writer edits and not strings buried in `.tsx` (E23 holds
 * `components/marketing/**` at zero literals).
 *
 * **Seven sections, in the order the issue gives them:** the hero is the page's own
 * `heading`/`subtitle`/`cta` (band one), and `sections` carries the six that follow —
 * `domains`, `how-it-works`, `opinions`, `gap`, `limits`, `cta`. A hero is not a band with a
 * heading of its own; it is the page's heading, which is why it is not repeated in `sections`.
 *
 * **Every claim here is traceable to code in this repo, and nothing else may be implied.**
 * The vocabulary is the schema's (Aspect, Opinion, Template, Instance, Gap), the facts are the
 * collections':
 *
 *   - the two families and their Relationship Types are `data/assessments.ts` — Business is the
 *     Staff / Manager template, Personal is Parent / Child, and the Aspects each one asks are
 *     that record's `items`, listed below in the order the template holds them;
 *   - Feel and Wish are `BASIC_OPINION_KINDS`, Think and Guess `ADVANCED_OPINION_KINDS`, and
 *     `zOpinions` rejects one of the advanced pair without the other;
 *   - a Gap is `gapOf()` in `content/record.ts` — a difference of two Scores, never a stored
 *     field — and the worked example links to `/assessment/avery-rowan`, the instance
 *     `data/assessments.ts` answers.
 *
 * The two limits are stated because they are true: the demo dataset is a demonstration set —
 * stored since #145 in the six content tables `db/migrations/0001_content_model.sql` defines,
 * read by `/assessment/[slug]` at request time, and reset and reseeded nightly from
 * `data/bundles/demo-dataset.alignsynch.json` (`.github/workflows/demo-reset.yml`) — and the
 * Coach the glossary names is modelled nowhere. "Demonstration" is a statement about what the
 * rows are, never about whether they are stored.
 *
 * What this file deliberately does **not** say: it does not describe the invitation the app
 * sends (the two party roles are Initiator and Counterparty, and the invite flow lives in
 * `lib/flow/email.ts` and `app/(mainlayout)/invite/[token]`, not on this page), it carries no
 * count, no percentage, no metric, no testimonial and no customer name, and it describes only
 * what the screens in this repo do today.
 */
import type { Brand } from "../../content/brand";
import { zPageCopy, type PageCopy } from "../../content/pages";

/**
 * The `/welcome` document title — `"<brand> — Where two people's answers part"`.
 *
 * A function of the brand for the reason `alignSynchHomeTitle` gives: the page names the
 * product, so neither half is spelled in a `.tsx`.
 */
export function marketingTitle(brand: Pick<Brand, "name">): string {
  return `${brand.name} — Where two people's answers part`;
}

export const marketingPageCopy: PageCopy = zPageCopy.parse({
  heading: "Where two people's answers part",
  subtitle:
    "Every Aspect of a relationship is answered from both sides. AlignSynch puts the two answers side by side, computes the difference on each one, and calls it the Gap.",
  cta: { label: "Read the worked example", href: "/assessment/avery-rowan" },
  /** Strings the page renders outside a band: the footer's line and its contact label. */
  items: [
    {
      id: "footer-note",
      label:
        "AlignSynch is a beta. The four opinions, the Gap and the templates are the product today.",
    },
    { id: "footer-contact", label: "Email us" },
  ],
  sections: [
    {
      id: "domains",
      heading: "Align your business life. Synch your personal one.",
      body: "Both run on one method: a template written for a kind of relationship, answered by the two people in it.",
      items: [
        {
          id: "domain-business",
          label: "Align",
          value: "Business",
          body: "Staff and manager. This family asks about priorities, feedback, workload, decisions and development.",
        },
        {
          id: "domain-personal",
          label: "Synch",
          value: "Personal",
          body: "Parent and child. This family asks about check-ins, house rules, trust, one-to-one time and privacy.",
        },
      ],
    },
    {
      id: "how-it-works",
      heading: "How it works",
      body: "Three beats, and the third one is the point.",
      items: [
        {
          id: "beat-express",
          label: "Express your opinions",
          body: "You answer each Aspect twice over: how it feels to you now, and how you wish it to be.",
        },
        {
          id: "beat-counterparty",
          label: "Name the Counterparty",
          body: "A relationship has an Initiator who starts it and a Counterparty who answers the same Aspects from their side. Both sets of answers sit on the same record.",
        },
        {
          id: "beat-compare",
          label: "Compare the Gap",
          body: "The Gap on an Aspect is the distance between your answer and theirs. The report prints the two answers in one row, with the Gap beside them.",
        },
      ],
    },
    {
      id: "opinions",
      heading: "Four opinions, two modes",
      body: "Feel and Wish are the basic pair, so an answered relationship always has them and always has a Gap on each. Think and Guess are the advanced pair: they arrive together or not at all, and they are optional on every Aspect.",
      items: [
        { id: "opinion-feel", label: "Feel", value: "Basic", body: "How it feels to you now." },
        {
          id: "opinion-wish",
          label: "Wish",
          value: "Basic",
          body: "How you wish it to be.",
        },
        {
          id: "opinion-think",
          label: "Think",
          value: "Advanced",
          body: "Answered in advanced mode, with Guess.",
        },
        {
          id: "opinion-guess",
          label: "Guess",
          value: "Advanced",
          body: "Answered in advanced mode, with Think.",
        },
      ],
    },
    {
      id: "gap",
      heading: "What a Gap is",
      body: "A Gap is the difference between two scores on one Aspect. It is computed from the two answers and never stored, so it cannot drift away from them: a Feel of 2 against a Feel of 5 is a Gap of 3, and two equal scores make a Gap of 0, which the app calls In Synch.",
    },
    {
      id: "limits",
      heading: "Two limits",
      body: "Better to say them here than to have you find them.",
      items: [
        {
          id: "limit-beta",
          label: "This is a beta",
          body: "The records behind these screens are a demonstration set: real rows in a Postgres database, reset and reseeded every night from a versioned bundle.",
        },
        {
          id: "limit-coach",
          label: "Coach support is not built",
          body: "The Coach is a word in the product's vocabulary and a feature in no file. Today the app shows you the Gap and stops there.",
        },
      ],
    },
    {
      id: "cta",
      heading: "Start with someone else's answers",
      body: "Avery and Rowan answered Relationship Basics. Both sets of their answers are on one page, with the Gap on every Aspect beside them.",
      cta: { label: "Read the worked example", href: "/assessment/avery-rowan" },
    },
    /**
     * The version badge (issue #269) — `/welcome`'s footer prints it under the mailbox. Same
     * three ids as the shell's and `/login`'s sections, because `AppVersion` is one component;
     * `{version}` is filled from the build and never typed here.
     */
    {
      id: "version",
      items: [
        { id: "label", label: "Version {version}" },
        { id: "compact", label: "v{version}" },
        { id: "title", label: "Open the v{version} release notes on GitHub" },
      ],
    },
  ],
});

/**
 * The `(marketing)` chrome for the **template** brand — QuizHub's header action, footer line and
 * version labels, and nothing else.
 *
 * **Why the group has two copies (#317).** The chrome now wraps `/`, and `pnpm parity` hashes `/`
 * for both brands under one rule: a route's render carries its own brand's name and not the
 * other's. `marketingPageCopy` above is the alignment product's pitch — its subtitle and its
 * footer line name the product and state what that product is — so a quiz build mounting it on
 * the front door would print the other brand's name and describe a product it does not ship. The
 * gate refuses that, correctly. Two fixtures and a `switch` over `brandIdOf(brand)` is the
 * arrangement this tree already uses for the front page itself (`data/pages/home.ts` and
 * `home-alignsynch.ts`), and it is copy data, not a session check: nothing here reads the
 * request.
 *
 * Only the fields the chrome reads are written, and each is the brand record's own claim —
 * "create quizzes, play games" is `quizHubBrand.description`, and the action points at the quiz
 * catalogue. What this is *not* is a QuizHub landing page: `/welcome` still renders the alignment
 * landing for both brands (a pre-existing gap, and inventing six bands of quiz marketing is a
 * product decision this card does not own). The chrome is brand-correct because the chrome is
 * what `/` now inherits.
 */
export const quizHubMarketingCopy: PageCopy = zPageCopy.parse({
  heading: "Play, share, earn",
  cta: { label: "Explore quizzes", href: "/explore" },
  items: [
    { id: "footer-note", label: "QuizHub is a quiz platform — create a quiz, play one, share it." },
    { id: "footer-contact", label: "Email us" },
  ],
  sections: [
    /** The same three ids `AppVersion` reads on every surface that mounts it (issue #269). */
    {
      id: "version",
      items: [
        { id: "label", label: "Version {version}" },
        { id: "compact", label: "v{version}" },
        { id: "title", label: "Open the v{version} release notes on GitHub" },
      ],
    },
  ],
});
