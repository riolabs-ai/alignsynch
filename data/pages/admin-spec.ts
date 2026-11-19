/**
 * `/admin/spec` — the project spec's reader (#1252), one fixture for its three routes.
 *
 * **Every word the reader prints is here** (E23 budget 0), with one deliberate exception: the
 * register's own text — a requirement, its Definition of Done, what v2.0 does today, an evidence
 * path — is `data/spec/validation.json`, because it is a *measurement* of the agreement and not
 * editorial copy. The line is the one `/admin/permissions` draws: the fixture carries the page's
 * words, the source file carries the rows.
 *
 * **What may never be here.** No agreement wording, no fees, no addresses and no phone numbers:
 * the spec is NDA material and this fixture is a copy surface, so `public/` and the client bundle
 * see none of it (AS-10). The one sentence allowed to say so is `nda`, and the fee line is the
 * agreement's own `See Exhibit B`.
 *
 * **Three routes, three depths, one fixture.** `/admin/spec` (Overview), `/admin/spec/validation`
 * and `/admin/spec/[group]` are keyed to this module in `data/pages/index.ts`, exactly as
 * `/admin/docs` and its two derived views are one fixture — which is why a string added for the
 * matrix is available to the story page without a second copy of it.
 *
 * **Braced placeholders are numbers, not logic.** `{release}`, `{met}`, `{total}`, `{percent}`,
 * `{count}`, `{rows}`, `{date}`, `{sha}`, `{group}` and `{name}` are filled by `fillLabel` with
 * values the register produced, so a count on this page is never typed twice.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const adminSpecPageCopy: PageCopy = zPageCopy.parse({
  heading: "Project Spec",
  subtitle:
    "The 2024 agreement in one place: every requirement, its Definition of Done, the release that evidences it, and what v2.0 does today. Read-only.",
  cta: { label: "Open Validation", href: "/admin/spec/validation" },
  items: [
    {
      id: "nda",
      label:
        "Confidential. Drawn from the 2024 Consulting Agreement (NDA, Exhibit C). Visible only to Project Spec readers. Fees: see Exhibit B.",
    },
    { id: "read-only", label: "Read-only" },

    /* The submenu (AS-06). */
    { id: "rail-heading", label: "Project Spec" },
    { id: "rail-subtitle", label: "v{release} · Read-only" },
    { id: "rail-overview", label: "Overview" },
    { id: "rail-validation", label: "Validation" },
    { id: "rail-pinned", label: "Pinned" },
    { id: "rail-story", label: "Story" },
    { id: "rail-around", label: "Around the Story" },
    { id: "rail-count", label: "{met}/{total}" },

    /* The status box — s02's aside, drawn on Overview and Validation alike. */
    { id: "status-heading", label: "Phase 6 · Delivery Certification" },
    { id: "status-draft", label: "Draft" },
    { id: "status-not-signable", label: "Not Yet Signable" },
    { id: "status-gauge-caption", label: "{met} of {total} met" },
    { id: "status-gauge-label", label: "{met} of {total} met, {percent} percent" },
    { id: "status-met-caption", label: "Met = Delivered + Over-Delivered + Offset" },
    { id: "status-by-scope", label: "By Scope" },
    { id: "status-by-status", label: "By Status" },
    { id: "status-sections", label: "Sections" },
    { id: "status-meta", label: "Meta" },
    { id: "status-beyond", label: "Plus {count} Beyond the Agreement" },
    { id: "status-legend", label: "☑ Met · ◐ Partial · ☐ Open · → Moved" },
    { id: "status-scope-ratio", label: "{met}/{total}" },
    { id: "status-scope", label: "{prefix} · {label}" },
    { id: "meta-register", label: "Register" },
    { id: "meta-main-sha", label: "main @ {sha}" },
    { id: "meta-register-value", label: "v2 · {rows} rows · {date}" },
    { id: "meta-evidence", label: "Evidence" },
    { id: "meta-evidence-value", label: "Code and docs citations checked at main @ {sha}" },
    { id: "meta-release-map", label: "Release Map" },
    { id: "meta-release-map-value", label: "R1 → rc2 · R2 → rc3 · Beta not planned" },
    { id: "meta-sign-off", label: "Sign-Off" },
    { id: "meta-sign-off-value", label: "Walt Johnson, Herringbone Capital (dba AlignSynch)" },
    { id: "meta-sign-off-second", label: "Jaden Black, Venture I/O" },
    { id: "meta-fees", label: "Fees" },
    { id: "meta-fees-value", label: "See Exhibit B" },
    { id: "meta-source", label: "Source" },
    { id: "meta-unsigned", label: "Pending" },

    /* The Overview (s01). */
    { id: "overview-eyebrow", label: "Project Spec 2.0" },
    { id: "overview-heading", label: "Overview" },
    {
      id: "overview-subtitle",
      label: "What the 2024 agreement asked for, what v2.0 does today, and what is still open.",
    },
    { id: "overview-welcome", label: "Welcome, {name}" },
    {
      id: "overview-welcome-body",
      label: "You have read-only access to the Project Spec. Nothing here changes the product.",
    },
    { id: "overview-step-1", label: "1 · Read Validation" },
    {
      id: "overview-step-1-body",
      label: "Every requirement, its Definition of Done and its release.",
    },
    { id: "overview-step-2", label: "2 · Follow the Evidence" },
    {
      id: "overview-step-2-body",
      label: "Each row links the code on main or the docs page that proves it.",
    },
    { id: "overview-step-3", label: "3 · Read a Story" },
    {
      id: "overview-step-3-body",
      label: "One page per group, in the order the agreement reads them.",
    },
    { id: "overview-open-validation", label: "Open Validation" },
    { id: "overview-read-story", label: "Read a Story Page" },
    { id: "overview-story", label: "Story" },
    { id: "overview-around", label: "Around the Story" },
    { id: "overview-card-count", label: "{number} · {met}/{total} met" },
    { id: "overview-card-chip", label: "{status} {count}" },

    /* The Validation matrix (s02). */
    { id: "matrix-eyebrow", label: "Project Spec 2.0 · Read-only" },
    { id: "matrix-heading", label: "Validation" },
    {
      id: "matrix-subtitle",
      label:
        "Every requirement the agreement names, its Definition of Done and the release that evidences it. Four sections, in the agreement's order.",
    },
    { id: "matrix-col-requirement", label: "Requirement · Definition of Done" },
    { id: "matrix-col-evidence", label: "Release Evidence" },
    { id: "matrix-dod", label: "Definition of Done" },
    { id: "matrix-today", label: "v2.0 Today" },
    { id: "matrix-next", label: "Next" },
    { id: "matrix-quote", label: "Agreement wording · served from the private source" },
    { id: "matrix-evidence", label: "Evidence" },
    { id: "matrix-parity", label: "Parity" },
    { id: "matrix-review", label: "Review" },
    { id: "matrix-approval", label: "Approval" },
    { id: "matrix-review-pending", label: "PM, Design Pending" },
    { id: "matrix-approval-pending", label: "Jaden, Walt Pending" },
    { id: "matrix-v200", label: "v2.0.0" },
    { id: "matrix-rc2", label: "rc2" },
    { id: "matrix-rc3", label: "rc3" },
    { id: "matrix-beta", label: "Beta" },
    { id: "matrix-pages", label: "Agreement page" },
    { id: "matrix-empty", label: "No rows in this section." },

    /* One story page (s03). */
    { id: "story-eyebrow-story", label: "Project Spec 2.0 · Story · {number}" },
    { id: "story-eyebrow-around", label: "Project Spec 2.0 · Around the Story · {number}" },
    { id: "story-agreed", label: "Agreed" },
    { id: "story-today", label: "v2.0 Today" },
    { id: "story-status", label: "Status" },
    { id: "story-evidence", label: "Evidence" },
    { id: "story-agreed-heading", label: "Agreed in 2024" },
    { id: "story-no-mockup", label: "No mockup in the agreement for this group." },
    { id: "story-no-mockup-body", label: "The text is the only source." },
    { id: "story-col-id", label: "ID" },
    { id: "story-col-page", label: "Page" },
    { id: "story-col-requirement", label: "Requirement" },
    { id: "story-col-does", label: "What v2.0 Does" },
    { id: "story-col-status", label: "Status" },
    { id: "story-col-dod", label: "Definition of Done" },
    { id: "story-col-evidence", label: "Evidence" },
    { id: "story-col-parity", label: "Parity" },
    { id: "story-empty", label: "The register carries no row for this group." },
    { id: "story-unknown-heading", label: "No story page is called {group}" },
    {
      id: "story-unknown-body",
      label:
        "The register reads eleven stories. Open the Validation matrix to see them, or pick one from the menu.",
    },
    { id: "story-unknown-link", label: "Open Validation" },

    /* The register could not be read (s04b). */
    { id: "notice-heading", label: "The Project Spec Isn't Published Yet" },
    {
      id: "notice-body",
      label:
        "Your access is set up. The validation file this page reads is not there yet, so there is nothing to review.",
    },
    { id: "notice-source", label: "Source:" },
    { id: "notice-reason", label: "Reason:" },
    {
      id: "notice-regenerate",
      label:
        "An admin publishes it by regenerating it from {file}. Nothing is logged as an error: this is an expected state.",
    },
    { id: "notice-how-it-works", label: "How It Works" },
    { id: "notice-support", label: "Contact Support" },
  ],
});

/**
 * The four sections' notes — the sentence under each section heading in the matrix.
 *
 * A typed record rather than page-copy items because the key *is* the section name the register
 * carries: a section renamed in `content/spec.ts` is a `tsc` error here, where an item id would
 * have to be remembered. `null` is a section the agreement's source writes no line for, and the
 * page then draws the heading alone rather than inventing a sentence.
 */
export const adminSpecSectionNotes: Readonly<Record<string, string | null>> = {
  "Unfinished Work: TBD": "Partial and Tentative rows, plus the OPS-01 sign-off.",
  "Over-Spec Deliverables in v2.0":
    "Rows the build delivered beyond the agreement, and the twelve that are counted separately.",
  "Under-Spec or Moved to a Future Version":
    "Agreed work the build offset, replaced, or deferred to a later release.",
  "Delivered as Specified": "Agreed rows the build delivers as written.",
};

/**
 * The eleven story groups' descriptions, keyed by the route segment.
 *
 * Exhaustive on purpose: adding a story means writing its sentence, and a missing one is a `tsc`
 * error rather than a card with an empty body.
 */
export const adminSpecStoryDescriptions: Readonly<Record<string, string>> = {
  "01-play-with-aspects": "Pick a template, shape its Aspects, choose a mode.",
  "02-register": "Create an account and sign in.",
  "03-invite": "Invite the other person by email.",
  "04-opinions": "Give opinions, sealed until both finish.",
  "05-share-and-results": "See results and Gaps together.",
  "06-discuss": "Talk it through and propose changes.",
  "07-plans-and-billing": "Trial, plan, payment and what happens when it lapses.",
  "08-coaches-and-professionals": "Coach invite and branded coaches.",
  "09-admin": "The staff-only admin app.",
  "10-website": "Public pages, help and documentation.",
  "11-launch-and-operations": "Deploy, email, testing and sign-off.",
};
