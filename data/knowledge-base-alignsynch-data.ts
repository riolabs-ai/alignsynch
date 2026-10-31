/**
 * The AlignSynch knowledge base — the help articles this *product* has, three of them.
 *
 * `/support` is the one destination the AlignSynch navigation advertises (`lib/nav.ts`
 * `ALIGNMENT_ROUTES`), so its help centre was the quiz product's documentation rendered under
 * another product's name: tournament creation, subscription management, quiz troubleshooting.
 * `data/knowledge-base-data.ts` keeps those articles — they are QuizHub's catalogue, and
 * QuizHub still renders them — and `data/knowledge-base.ts` is the table that decides which
 * set a build publishes (issue #309).
 *
 * Three articles, each about something this build does, in the words of the code that does it:
 *
 *   account and sign-in   `/login`, `/register`, `/settings` — the profile form's four fields
 *                         and the auth server that actually holds the password
 *   invitations           the create form, the single-use link, and the seven-day expiry that
 *                         `lib/flow/tokens.ts::INVITE_TTL_MS` writes onto the row
 *   the Gap               two Opinions per Aspect, one subtraction (`content/record.ts::gapOf`),
 *                         eight kinds (`content/gaps.ts`) and the setting that tolerates 0 or 1
 *
 * What is *not* here is as deliberate: no article claims a feature the tree does not have. There
 * is no article about a plan, a tier, a subscription, a tournament, a payout or a native app,
 * because this build ships none of them, and a help centre that documents them is a fabricated
 * FAQ row with more words around it.
 *
 * `pnpm data:check` validates this fixture exactly like the QuizHub one (E0/E1/E2), and
 * `tests/article-records.test.ts` pins which brand publishes which set.
 */
import type { KbArticle } from "../content/article";
import { brand } from "./brand";

export const alignSynchArticlesData: readonly KbArticle[] = [
  {
    id: "kb-account-and-sign-in",
    kind: "kb",
    slug: "account-and-sign-in",
    title: "Your account and how you sign in",
    summary:
      "Where sign-in happens, which four fields Account Settings edits, and what that page does not do.",
    categoryIds: ["kb-account"],
    tags: [],
    readMinutes: 3,
    publishedAt: "2026-10-13T09:00:00.000Z",
    body: [
      {
        type: "heading",
        text: "Signing in and signing out",
        level: 2,
      },
      {
        type: "paragraph",
        text: `Sign in at /login and register at /register; both take an email address and a password. The password belongs to the auth service this deployment is pointed at, not to this app: no password, token or user row is stored by the application itself, and a signed-in request is resolved from the session cookie before the page reads anything.`,
      },
      {
        type: "paragraph",
        text: "To sign out, open the account menu in the header and choose Sign out. That ends the browser session; the answers you already submitted stay with the instance, because they were saved when you submitted them.",
      },
      {
        type: "heading",
        text: "What Account Settings edits",
        level: 2,
      },
      {
        type: "paragraph",
        text: `Account Settings (/settings) is the one settings page in the build, and it edits the profile other people can see on ${brand.name}:`,
      },
      {
        type: "list",
        items: [
          "Display name — the name shown on your profile and beside your answers",
          "Handle — your profile address, /profile/<handle>. Lowercase, 3 to 30 characters, starting and ending with a letter or digit; one person holds a handle, so a name somebody else already has will not save",
          "Bio — optional, a short description of yourself",
          "Country — optional, picked from the list the form offers",
        ],
        ordered: false,
      },
      {
        type: "paragraph",
        text: "The email address your account signs in with is shown on that page and is not editable there.",
      },
      {
        type: "note",
        text: `Account Settings edits the profile and nothing else — there is no password change, no notification preference and no billing control on it. If you need something it does not offer, write to ${brand.supportEmail}.`,
      },
    ],
  },
  {
    id: "kb-invitations-and-expiry",
    kind: "kb",
    slug: "invitations-and-expiry",
    title: "Invitations, and what happens when one expires",
    summary:
      "How the other person joins, why an invitation only works once, and what to do when the seven days are up.",
    categoryIds: ["kb-general"],
    tags: [],
    readMinutes: 3,
    publishedAt: "2026-10-20T09:00:00.000Z",
    body: [
      {
        type: "heading",
        text: "Starting an instance and inviting the other person",
        level: 2,
      },
      {
        type: "paragraph",
        text: "You start from a template. The create form asks for your name, the other person's name and their email address, and one submission writes the instance, your own seat and the invitation together in a single transaction. You are the Initiator; the person you invite becomes the Counterparty when they take the seat.",
      },
      {
        type: "heading",
        text: "The link is the invitation",
        level: 2,
      },
      {
        type: "paragraph",
        text: "The invitation is a link carrying a single-use token. When this deployment has a mail provider configured the link is emailed; when it does not, the instance screen shows you the same link and a Copy link control so you can send it yourself. Either way the link is the credential, so send it to the person it is meant for and to nobody else.",
      },
      {
        type: "heading",
        text: "Invitations last seven days",
        level: 2,
      },
      {
        type: "paragraph",
        text: "An invitation is claimable for seven days from the instant it is created. At the end of that window the claim page says the invitation has expired, and the link cannot be revived: the expiry is a column written when the invitation was created, not a flag that can be reset afterwards. Ask the person who created the instance to start a new one with you.",
      },
      {
        type: "heading",
        text: "An invitation works once",
        level: 2,
      },
      {
        type: "paragraph",
        text: "Opening the link shows the claim page; pressing Accept and answer spends it. Opening is not claiming — the page only spends the token when you confirm — so a mail client that previews links, or a scanner that follows them, cannot use the invitation up before the person it was sent to does.",
      },
      {
        type: "paragraph",
        text: "On the initiator's screen the invitation reads as one of three things:",
      },
      {
        type: "list",
        items: [
          "Unclaimed — the link exists and nobody has taken the seat yet",
          "Claimed — the other person took the seat; this wins even if they claimed it after the window closed, because they claimed it inside it",
          "Expired — the seven days passed and the seat is still unclaimed",
        ],
        ordered: false,
      },
      {
        type: "note",
        text: "A claim that is refused does not use the link up. The page says why — somebody else holds the seat, the browser already answers as one of the two parties, or the confirmation was not sent — and the invitation stays claimable until it expires or is taken.",
      },
    ],
  },
  {
    id: "kb-how-the-gap-is-computed",
    kind: "kb",
    slug: "how-the-gap-is-computed",
    title: "How the Gap is calculated",
    summary:
      "Two answers per Aspect, one subtraction, eight named Gaps, and the setting that decides what counts as close enough.",
    categoryIds: ["kb-general"],
    tags: [],
    readMinutes: 4,
    publishedAt: "2026-10-27T09:00:00.000Z",
    body: [
      {
        type: "heading",
        text: "Two answers per Aspect",
        level: 2,
      },
      {
        type: "paragraph",
        text: "An assessment is a list of Aspects — the characteristics of a relationship the two of you are looking at. On every Aspect each party gives answers on a scale of 1 to 5: how it feels now, and how you wish it to be. Those answers are the Opinions, and they are what is stored.",
      },
      {
        type: "heading",
        text: "A Gap is one subtraction",
        level: 2,
      },
      {
        type: "paragraph",
        text: "A Gap is the difference between two Opinions, as a whole number: two answers four apart give a Gap of 4, two identical answers give 0, which the glossary calls In Synch. Nothing is stored as a Gap — the report computes each one from the two scores every time it is drawn, so there is no second copy of a number to drift from the answers behind it.",
      },
      {
        type: "heading",
        text: "Eight kinds, each a named pair",
        level: 2,
      },
      {
        type: "paragraph",
        text: 'The glossary names eight Gaps, and each is one specific pair of Opinions rather than "the difference" in general:',
      },
      {
        type: "list",
        items: [
          "Feel — how you feel against how they feel",
          "Wish — how you wish it to be against how they wish it to be",
          "Initiator — the initiator's own Feel against their own Wish",
          "Counterparty — the counterparty's own Feel against their own Wish",
          "Think and Guess (Advanced Mode) — what one person thought the other felt, or guessed the other wished, against what that person actually answered, once per direction",
        ],
        ordered: false,
      },
      {
        type: "paragraph",
        text: "Basic Mode asks Feel and Wish, so an Aspect there has the four Gaps those answers describe. Advanced Mode adds Think and Guess, which is what the four prediction Gaps have to compare against — a pair of guesses about each other is not a Gap anyone defined, and it is not computed.",
      },
      {
        type: "heading",
        text: "Neither party sees the other's answers first",
        level: 2,
      },
      {
        type: "paragraph",
        text: "You answer every Aspect before either of you can read the other's answers, and the answers are frozen once both have submitted. The report is the first place the two sets of scores meet; until then a screen can tell you what you still owe and never how far along the other person is.",
      },
      {
        type: "heading",
        text: "The setting decides what counts as close enough",
        level: 2,
      },
      {
        type: "paragraph",
        text: "Each instance is read under a setting. Under Full, a Gap counts as met only at 0; under Soft, a Gap of 1 is tolerated. The setting changes which Gaps count as met — it never changes the numbers themselves.",
      },
      {
        type: "note",
        text: "A Gap the answers cannot produce is absent, not zero: if one of the two Opinions was never given, there is no Gap there, and a 0 would claim In Synch about a question nobody asked.",
      },
    ],
  },
];
