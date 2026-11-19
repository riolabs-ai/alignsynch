/**
 * `/dashboard/relationships/[id]` — one relationship, from draft to a live invitation (#533 phase
 * 2, #706).
 *
 * The screen has four bands, and which of them renders is `publishViewOf()`'s answer — one value
 * derived from the stored status, the invitation row and the instant the page rendered, never four
 * conditionals that could disagree:
 *
 *   status     what the relationship is (`draft`, `pending`, `published`, …) and what the
 *              invitation is doing (`live`, `expired`, `claimed`, `revoked`, `missing`)
 *   aspects    the Aspect editor, while the relationship is `draft`/`pending` — the initiator's
 *              alone, and refused by the server action rather than hidden from the counterparty
 *   publish    the counterparty's name and address, and the one button that starts the trial (or
 *              opens a checkout), publishes the relationship and mints the invitation
 *   republish  the one-click reissue a lapsed or revoked link gets — no Aspects re-entered
 *
 * **The trial sentence.** #533 requires the screen to say plainly when a trial is running and no
 * invitation is live (`trial-running-no-invite`). That is a real state — the member paid for a
 * link that lapsed — and leaving it to be inferred from two columns is how a person concludes the
 * product took their money and stopped.
 *
 * **A Counterparty opens this screen and reads it, read-only (#706).** The three write bands are
 * absent for them because `aspectsEditable`, `publishable` and `offersRepublish` are each derived
 * as `isInitiator && …`, and `counterparty-read-only` says so in words rather than leaving three
 * missing panels to be interpreted. No button is the enforcement either way: the server actions
 * check ownership inside their transaction and answer `not-yours` to anyone else. Hiding the form
 * is a courtesy, not a rule.
 *
 *   link       the invitation link, shown **once** after it is minted (a token is never stored, so
 *              a reload cannot reproduce it — the copy says so)
 *   closed     a terminal relationship: nothing more happens to it here
 *   unreadable the database did not answer
 */
import { zPageCopy, type PageCopy } from "../../content/pages";
import { aspectDrawerSection } from "../../content/aspect-drawer";

/**
 * The id of the shared Aspect editor's section on this page.
 *
 * Exported, not written into the page: `/dashboard/relationships/[id]` has a leaf-literal budget of
 * zero (E23), so a page component may name a section only through a constant the fixture declares.
 */
export const ASPECT_EDITOR_SECTION = "aspect-editor";

/**
 * The id of the edit band's section on this page.
 *
 * #923 — the band is no longer drawn inline; the trigger that opens it and the dialog's
 * accessible name are read from this section, so the same ratchet applies: the page names the
 * section through this constant and the words through its items, never a literal (E23).
 */
export const RELATIONSHIP_EDIT_SECTION = "edit";

/**
 * The id of the live Aspects band's section on this page (#1133).
 *
 * Stage 6 is running, so the panel draws the two sentences and **no writing control** — the
 * pencils, the Add and the drag are gone, and `saveAspects` refuses the write inside its own
 * transaction even if one came back. The page names the section through this constant for the
 * same E23 reason as the two above.
 */
export const ASPECTS_LIVE_SECTION = "aspects-live";

/**
 * The id of the At a Glance card's section (#1124's rail, filled in by the v2 rectification).
 *
 * The section exports its own id for the same E23 reason: the page component names a section
 * through a constant the fixture declares, never a literal of its own.
 */
export const RELATIONSHIP_GLANCE_SECTION = "glance";

export const dashboardRelationshipDetailPageCopy: PageCopy = zPageCopy.parse({
  heading: "Relationship",
  subtitle:
    "Its Aspects are fixed once it is published: publishing opens the session and mints the invitation, and a link that lapsed is reissued in one click. Which of those the person reading this may do depends on which seat they hold — the card says so.",
  items: [
    { id: "status", label: "State" },
    { id: "aspects", label: "Aspects" },
    { id: "started", label: "Started" },
    { id: "published", label: "Published" },
    { id: "invited", label: "Invited" },
    { id: "trial", label: "Trial ends" },
    /**
     * #1115 task 5 — the connection row. `connected` is drawn from `connectionOf()` (both seats
     * bound to an account and the session exists — never from an answer or an opinion count), so
     * the words here are only the two states it can be in.
     */
    { id: "connection", label: "Connection" },
    { id: "connected", label: "Connected" },
    { id: "waiting", label: "Waiting on {name}" },
    /**
     * #1121 — the facts card's membership row: the window, the pause, or the other person's cover.
     * The four values are the pause section's own items, so the fact and the badge never say two
     * things about one account.
     */
    { id: "membership", label: "Membership" },
    { id: "none", label: "—" },
    /** #533 phase 3 — the badge the derived lapse draws beside the stored status. */
    { id: "read-only", label: "Read-only" },
    /** #706 — the viewer's own seat, from their party row. */
    { id: "role-initiator", label: "Initiator" },
    { id: "role-counterparty", label: "Counterparty" },
    {
      /**
       * #1124 — what the tab strip says when the fixture hands it no sections at all. E40 gives an
       * empty list an explicit bordered block, and this is the sentence that block carries: a
       * binding nobody can read, said out loud rather than drawn as blank space.
       */
      id: "tabs-empty",
      label: "This relationship has no sections to open — support can repair the binding.",
    },
  ],
  sections: [
    {
      /**
       * #795 — the way back, which this screen did not have (the template page has had
       * `All templates` all along). The shell renders it above the identity band on both pages.
       */
      id: "back",
      items: [{ id: "all", label: "All relationships" }],
    },
    {
      /**
       * #795 — the identity band's two words. A relationship's band is the template page's band,
       * drawn by one component, so the group chip and the roles line are the same two strings the
       * template page resolves — declared here because this route's fixture owns this route's copy
       * (E23 resolves every id against the fixture of the surface that asks for it).
       */
      id: "identity",
      items: [
        { id: "business", label: "Business" },
        { id: "personal", label: "Personal" },
        { id: "roles", label: "{initiator} / {counterparty}" },
      ],
    },
    {
      /**
       * The v2 rectification register's most repeated delta on this screen: bundle 03 draws the
       * relationship's **At a Glance** card above the tabs — the Aspect tally, the Mode, the
       * Alignment Tolerance and the latest round — and the live page drew only the flat metadata
       * card beside it. The tally is a derivation (`alignmentSummaryOf` over `content/gaps.ts`), so
       * nothing here is a stored verdict; the card says the numbers the read produced and no others.
       *
       * `Open Align` is the reference's one control, and it is drawn only when the round's report is
       * readable — a relationship whose sheets are not both sealed has no Gap to open, so the link
       * is absent rather than dead.
       */
      id: "glance",
      heading: "At a Glance",
      items: [
        { id: "aligned", label: "{aligned} of {total} Aspects Aligned" },
        { id: "in-synch", label: "{count} In Synch" },
        { id: "small-gap", label: "{count} Small Gap" },
        { id: "gap", label: "{count} Gap" },
        { id: "mode", label: "Mode" },
        { id: "opinions", label: "{count} Opinions" },
        { id: "tolerance", label: "Alignment Tolerance" },
        { id: "tolerance-soft", label: "Soft · Small Gap OK" },
        { id: "tolerance-full", label: "Full · No Gap OK" },
        { id: "round", label: "Latest Round" },
        { id: "round-value", label: "Round {round} · {date}" },
        { id: "open-align", label: "Open Align" },
      ],
    },
    {
      id: "status",
      heading: "State",
      items: [
        { id: "draft", label: "Draft" },
        { id: "pending", label: "Ready to publish" },
        { id: "published", label: "Published" },
        { id: "active", label: "Running" },
        { id: "complete", label: "Complete" },
        { id: "void", label: "Void" },
        { id: "expired", label: "Expired" },
      ],
    },
    {
      id: "view",
      heading: "Where this stands",
      body: "A draft is yours alone. A published relationship has an invitation out; the pair is working on it once the other person joins.",
      items: [
        { id: "not-published", label: "Not sent yet — nothing has been invited or charged." },
        { id: "invite-live", label: "Published. The invitation link is live." },
        { id: "invite-expired", label: "Published. The invitation link has expired." },
        { id: "invite-claimed", label: "Published. The other person has joined." },
        { id: "invite-revoked", label: "Published. An operator revoked the invitation link." },
        {
          id: "invite-declined",
          label:
            "Published. {counterparty} declined the invitation — send a new one when you are ready.",
        },
        {
          id: "invite-missing",
          label: "Published with no invitation row — that is a defect; support can repair it.",
        },
        {
          id: "trial-running-no-invite",
          label:
            "Your trial is running and no invitation is live. Reissue the link below — publishing again is one click and does not re-enter the Aspects.",
        },
        {
          /**
           * #706 — the sentence a Counterparty reads instead of an editor, a publish panel and a
           * reissue button. It names the split rather than leaving three absent bands to be
           * interpreted: the relationship is theirs to answer, not theirs to configure.
           */
          id: "counterparty-read-only",
          label:
            "You are the Counterparty on this relationship. Its Aspects, publishing and invitation belong to the person who started it, so this screen is read-only for you — answer on the assessment itself, from My Relationships or the invitation you were sent.",
        },
        {
          /**
           * #975 D2 — the same read-only fact, for the seat that is **not** the Counterparty's.
           *
           * The band above states a *role* and a *permission*, and only the permission is what the
           * band is drawn on (`isInitiator` is false). When the seat says Initiator and the
           * relationship's account column names somebody else, the two halves of that sentence
           * disagree — the seat chip one block up already said "Initiator" — so this row states the
           * permission and names no role. `relationship.viewerRole` picks which of the two is drawn,
           * and that is the same value the chip prints, so the screen cannot call one person both.
           */
          id: "controls-belong-to-starter",
          label:
            "The Aspects, publishing and invitation on this relationship belong to the account that started it, so this screen is read-only for you — answer on the assessment itself, from My Relationships or the invitation you were sent.",
        },
      ],
    },
    {
      /**
       * #1128 — **the Next Step a live, answering relationship draws.**
       *
       * The bundle's own sentence for the state (03, `joined`): the eyebrow, the heading, the
       * three-minute promise and the one button. It is the door the issue says was missing —
       * "Next Step 'Start Assessment' goes nowhere" — and the verb comes from the reader's own
       * answered count, so a second visit says `Continue`.
       */
      id: "assessment",
      items: [
        { id: "next-step", label: "Next Step" },
        { id: "start-heading", label: "Start Your First Assessment" },
        { id: "continue-heading", label: "Continue Your Assessment" },
        {
          id: "body",
          label:
            "{count} Aspects, about 3 minutes. Your answers stay private until you both finish.",
        },
        { id: "start", label: "Start Assessment" },
        { id: "continue", label: "Continue Assessment" },
        { id: "progress", label: "{answered} of {count} Aspects answered" },
      ],
    },
    {
      /**
       * #1121 — **Stage 6's pause, in the owner's words.**
       *
       * Every string here is verbatim from the issue's state table (and the ported bundle,
       * `docs/specs/v2-bundles/03-spec-design-page-rel-detail-v2/`): *Paused*, *Your Trial Ended*,
       * *Add a Card*, *Get 7 More Days Free*, *Waiting on Marcus*, *See Your Results*, *Paused ·
       * Trial Ended*, *Covered by Marcus*. The Counterparty's column is the half of the table that
       * may not carry a price, the word *trial*, a card ask or an extension — so their four labels
       * are the only ones that name the pause from the outside, and `tests/trial-pause-no-leak`
       * fails on any of those words reaching their render.
       *
       * `{initiator}` is the initiating account's name, filled by the view; `{days}` and `{instant}`
       * are the trial window's, so the pill, the Payment fact and the arrival banner cannot disagree
       * about a date the read already knows.
       */
      id: "pause",
      heading: "Stage 6 is paused",
      body: "Nothing is lost. Both of you can still read the results and the Discussion; Stage 6 runs again the moment a card is added.",
      items: [
        { id: "badge", label: "Paused" },
        { id: "badge-waiting", label: "Paused · Waiting on {initiator}" },
        {
          id: "line",
          label: "Stage 6 is paused. Your results and Discussion are saved and read-only.",
        },
        {
          id: "line-waiting",
          label: "Stage 6 is paused until {initiator} resumes it. Everything is saved.",
        },
        { id: "trial-ended-heading", label: "Your Trial Ended" },
        {
          id: "trial-ended-body",
          label: "Add a card or get 7 more days free. Either one resumes Stage 6 right away.",
        },
        { id: "extra-ended-heading", label: "Your Extra Week Ended" },
        { id: "extra-ended-body", label: "Add a card to resume Stage 6. Everything is saved." },
        { id: "waiting-heading", label: "Waiting on {initiator}" },
        { id: "waiting-body", label: "Nothing to do. You can still read your results." },
        { id: "add-card", label: "Add a Card" },
        { id: "extend", label: "Get 7 More Days Free" },
        { id: "extending", label: "Adding the week…" },
        { id: "see-results", label: "See Your Results" },
        { id: "read-only", label: "Read-only while Stage 6 is paused." },
        {
          id: "added",
          label: "7 More Days Added · Stage 6 is running again. Your extra week ends {instant}.",
        },
        { id: "membership-trial", label: "Free Trial · Ends {instant}" },
        { id: "membership-extra", label: "Extra Week · Ends {instant}" },
        { id: "membership-trial-ended", label: "Paused · Trial Ended" },
        { id: "membership-extra-ended", label: "Paused · Extra Week Ended" },
        { id: "membership-covered", label: "Covered by {initiator}" },
        { id: "pill-trial", label: "Trial · {days} Days Left" },
        { id: "pill-extra", label: "Extra Week · {days} Days Left" },
      ],
    },
    {
      id: "aspects",
      heading: "Aspects",
      body: "One question per row, answered by both of you on the 1..5 band. They are editable until the relationship is published, and only by the person who started it — the other side never sees this screen's configuration.",
      items: [
        { id: "prompt", label: "What is asked" },
        { id: "left", label: "Left Value (1)" },
        { id: "right", label: "Right Value (5)" },
        { id: "add", label: "Add an Aspect" },
        { id: "remove", label: "Remove" },
        { id: "up", label: "Move up" },
        { id: "down", label: "Move down" },
        { id: "save-draft", label: "Save the draft" },
        { id: "save-pending", label: "Save and mark ready" },
        { id: "saving", label: "Saving…" },
        { id: "saved", label: "Saved at status {status}. Audit action {actionId}." },
      ],
    },
    {
      /**
       * The row vocabulary of the shared Aspect editor (#774).
       *
       * The anatomy — the ordinal, the grip, the question, the scale, the edit icon — is the modal's,
       * drawn by `components/assessment-flow/aspect-list.tsx`. This section is only what *this* page
       * says while drawing it, because the dashboard and the create flow are different screens and
       * each owns its own copy (E23).
       */
      id: "aspect-editor",
      heading: "Edit an Aspect",
      body: "One question per row. Open a row to reword it, drag it to reorder, or remove it.",
      items: [
        { id: "count", label: "{count} Aspects" },
        { id: "tap-to-edit", label: "Open an Aspect to reword it in place." },
        { id: "drag-hint", label: "Drag to reorder" },
        { id: "prompt-label", label: "The question both of you answer" },
        { id: "left-label", label: "Left opinion label" },
        { id: "left-help", label: "The low end — what a 1 means." },
        { id: "right-label", label: "Right opinion label" },
        { id: "right-help", label: "The high end — what a 5 means." },
        { id: "edit", label: "Edit this Aspect" },
        { id: "save", label: "Save Aspect" },
        { id: "cancel", label: "Cancel" },
        { id: "unsaved", label: "Discard the changes to this Aspect?" },
        { id: "grip", label: "Reorder {name}" },
        { id: "saved", label: "Aspect saved." },
        { id: "reordered", label: "Order saved." },
        { id: "refused", label: "That Aspect was not saved." },
        { id: "add", label: "Add an Aspect" },
        { id: "remove", label: "Remove {name}" },
        {
          id: "last",
          label: "A relationship asks at least one Aspect. Add another before removing this one.",
        },
      ],
    },
    /**
     * The Aspect drawer (#1133), shared vocabulary from `content/aspect-drawer.ts` — the same sheet
     * Stage 3 and a My Template's Edit open, mounted here for a `draft`/`pending` relationship.
     */
    aspectDrawerSection(),
    {
      /**
       * The live Aspects band (#1133) — Stage 6 is running, so **no control on this panel writes**.
       *
       * The two sentences are the owner's rule and the bundle's reason, in that order: the rule
       * (`Changes are proposed and agreed by both of you.`) is the issue's own wording, and the
       * state (`Aspects are locked while Stage 6 is live.`) is
       * `03-spec-design-page-relationship-detail-v2`. Together they answer the question a person
       * asks when the pencils are gone: *why can't I edit this*.
       */
      id: ASPECTS_LIVE_SECTION,
      heading: "Aspects are Locked",
      items: [
        { id: "locked-now", label: "Aspects are locked while Stage 6 is live." },
        { id: "rule", label: "Changes are proposed and agreed by both of you." },
      ],
    },

    {
      id: "publish",
      heading: "Publish",
      body: "The invitation needs the other person's name — it is what they are asked to confirm — and an address to send it to. Publishing starts your fourteen-day trial if you have none, or opens a checkout if your trial has already been used; either way the relationship is published and the link minted in one action.",
      items: [
        { id: "name", label: "Their name" },
        { id: "email", label: "Their email" },
        {
          id: "mode",
          label: "Mode",
        },
        { id: "mode-basic", label: "Basic — how you feel and how you wish it were" },
        {
          id: "mode-advanced",
          label: "Advanced — the two above, plus how you each predict the other answers",
        },
        {
          id: "mode-help",
          label:
            "The mode is written on the session when you publish and never rewritten after — it decided which questions were asked, so changing it later would relabel answers people already gave.",
        },
        { id: "setting", label: "Setting" },
        { id: "setting-soft", label: "Soft — a large Gap is a conversation to have" },
        { id: "setting-full", label: "Full — a large Gap is the finding itself" },
        {
          id: "setting-help",
          label:
            "The Setting decides how the two sheets are read, never what they say. It is written at publish, like the mode.",
        },
        { id: "submit", label: "Publish and invite" },
        /**
         * #912 — the other half of a draft's pair, on the surface that shows a draft. The publish
         * panel *is* "Publish to Counterparty" (its submit above); this is the pay modal's own door,
         * drawn above the fields so the money decision is made before the counterparty's address.
         */
        { id: "invite-members", label: "Invite Members" },
        { id: "publishing", label: "Publishing…" },
        { id: "expiry", label: "The invitation expires {instant}." },
        { id: "checkout", label: "A checkout has to complete first." },
      ],
    },
    {
      id: "republish",
      heading: "Reissue the invitation",
      body: "One click: a new token on the same invitation row, a new seven-day window, and the old link stops working. Nothing about the Aspects changes, and the relationship stays published.",
      items: [
        { id: "submit", label: "Reissue the link" },
        { id: "working", label: "Reissuing…" },
        { id: "reissued", label: "Reissued. The new link expires {instant}." },
      ],
    },
    {
      id: "link",
      heading: "The invitation link",
      body: "Shown once, when it is minted: only a hash of the token is stored, so this page cannot reprint it. Copy it now, or reissue the invitation for a new one.",
      items: [{ id: "copy", label: "Copy the link" }],
    },
    {
      id: "edit",
      heading: "Edit this relationship",
      body: "Everything here is written to the relationship itself. Anything that would change what the other person has already answered is priced first: press Check the cost, read what it takes, and confirm it before the save is offered.",
      items: [
        /**
         * #923 — the control that opens this band. The form is no longer a permanent column
         * beside the detail, so the band needs a door; "Edit" is the word the issue uses for it,
         * and it lives here because the page may not type copy (E23).
         */
        { id: "open", label: "Edit" },
        { id: "title", label: "Title" },
        { id: "summary", label: "Summary" },
        { id: "mode", label: "Mode" },
        { id: "mode-basic", label: "Basic" },
        { id: "mode-advanced", label: "Advanced" },
        { id: "setting", label: "Setting" },
        { id: "setting-soft", label: "Soft" },
        { id: "setting-full", label: "Full" },
        {
          id: "locked-mode",
          label:
            "The mode and the Setting are printed, not editable: they were written on the session when it opened, and a session that has been answered is never rewritten. Changing them means a new relationship.",
        },
        {
          id: "mode-help",
          label:
            "The mode and the Setting are chosen when you publish. Until then this relationship has no session to carry them.",
        },
        { id: "aspects", label: "Aspects" },
        /**
         * #975 D12 — **the dialog names the Aspects and hands back the one editor.**
         *
         * #935 answered the owner's "keep the drag and drop, remove the stacked forms" by taking
         * the Aspect fields out of this panel, which left the dialog silent about a section the page
         * behind it edits — the inverse gap. The answer is not a second editor in the modal (that is
         * the duplicated surface #935 deleted, drawn over the list it duplicates): it is a read-only
         * statement of what the Aspects are, the questions' own words and one door to the section
         * that owns them. `{count}` is filled from the rows the relationship carries, so the band
         * cannot disagree with the list it points at about how many there are.
         */
        {
          id: "aspects-note",
          label:
            "The {count} Aspects are edited on this page, in the Aspects section — this form leaves them exactly as they are.",
        },
        /**
         * The same note on a published relationship, where `aspectsEditable` is false: the questions
         * are not merely somewhere else, they are fixed, and a sentence that said "edited" would
         * offer a power the server refuses.
         */
        {
          id: "aspects-note-locked",
          label:
            "Once the relationship is published the {count} Aspects are fixed, and the page shows them as they were answered.",
        },
        /** The door to the one editor — and, when the list is frozen, to the one place it is shown. */
        { id: "aspects-open", label: "Edit the Aspects" },
        { id: "aspects-view", label: "See the Aspects" },
        { id: "prompt", label: "What is asked" },
        { id: "left", label: "Left Value (1)" },
        { id: "right", label: "Right Value (5)" },
        { id: "add", label: "Add an Aspect" },
        { id: "remove", label: "Remove" },
        { id: "pin", label: "Version" },
        /**
         * #711 — the sentence that says which version this relationship was answered under.
         *
         * It is the fact the revision flow exists to protect: publishing version N+1 never moves a
         * relationship, so a screen that stayed silent about the binding would let an operator
         * assume the new words reached a live one. Printed whether or not the pin control is drawn.
         */
        { id: "version", label: "Answered under version {version}" },
        {
          id: "version-none",
          label: "No published version is bound to this relationship.",
        },
        { id: "pin-current", label: "Keep the version this relationship is on" },
        { id: "pin-option", label: "Move to version {version}, saved {instant}" },
        {
          id: "pin-help",
          label:
            "A version is what the whole relationship reads from. Moving the pin applies that version's words and Aspects, and the cost below is what it would take.",
        },
        { id: "invitee", label: "Their name" },
        { id: "invitee-email", label: "Their email" },
        { id: "window", label: "The invitation stays open for (days)" },
        {
          id: "window-help",
          label: "Extending the window does not touch the Aspects or anybody's answers.",
        },
        {
          id: "claimed",
          label:
            "The other person has joined, so the seat is theirs: their account holds it, and a name or address typed here would be a second truth. Support can re-point a seat; this form cannot.",
        },
        { id: "preview", label: "Check the cost" },
        { id: "previewing", label: "Checking…" },
        { id: "save", label: "Save the change" },
        { id: "saving", label: "Saving…" },
        {
          id: "saved",
          label:
            "Saved at version {version}. {discarded} answer(s) discarded. Audit action {actionId}.",
        },
        { id: "cost-heading", label: "What this change costs" },
        {
          id: "cost-discards",
          label: "Turning off “{aspect}” discards {answers} answer(s) from {name}.",
        },
        {
          id: "cost-rewrites",
          label:
            "Rewording “{aspect}” leaves {answers} answer(s) from {name} answering words that changed.",
        },
        { id: "cost-adds", label: "“{aspect}” is a new question." },
        { id: "cost-mode", label: "The mode moves from {from} to {to}." },
        { id: "cost-setting", label: "The Setting moves from {from} to {to}." },
        {
          id: "confirm",
          label: "I have read what this change costs, and I want it made.",
        },
        {
          id: "blocked-adds",
          label:
            "A new Aspect cannot be added once a sheet has been answered: whoever already answered would be left with a gap the sheet never had. A new round is the way to ask a new question.",
        },
        {
          id: "blocked-mode",
          label:
            "The mode and the Setting cannot move once the session exists — it decided which questions were asked.",
        },
        /* #623 — the refusal sentences this form can show, one id per code. */
        {
          id: "unconfirmed-invalidation",
          label: "This change costs answers, and the cost has not been confirmed yet.",
        },
        {
          id: "answers-sealed",
          label: "A new question cannot be added to a sheet somebody has answered.",
        },
        { id: "mode-fixed", label: "The mode and the Setting are fixed once the session exists." },
        {
          id: "seat-claimed",
          label: "The other person has joined — the seat is an account, not a text field.",
        },
        { id: "invalid-window", label: "The invitation window is 1 to 60 whole days." },
        { id: "no-such-version", label: "That version is not one of this relationship's." },
        { id: "no-change", label: "Nothing in this form differs from the relationship." },
        { id: "not-yours", label: "This relationship belongs to another account." },
        {
          id: "not-editable",
          label: "This relationship is closed, or bound to no version — it is not a form.",
        },
        { id: "invalid-draft", label: "The model refused these Aspects — check each field." },
        {
          id: "invalid-counterparty",
          label: "The invitation needs a name and a real address.",
        },
        { id: "signed-out", label: "Your session ended. Sign in and try again." },
        { id: "failed", label: "The change did not go through." },
      ],
    },
    {
      /**
       * #739 — the Initiator's act: complete and open the Gap.
       *
       * **The band sells nothing (#1010 R2).** The membership bought at stage 5 covers this
       * relationship, so sealing it is free: there is no amount, no deadline, no method and no door
       * to a card here. The only fact the band draws is the seal, because the seal is the one thing
       * the transition is gated on — and `not-sealed` says exactly that, without promising a charge
       * that no longer happens.
       */
      id: "completion",
      heading: "Complete and open the Gap",
      body: "Completing this relationship is free — your membership already covers it. Nothing is charged here. Once both of you have answered every Aspect and accepted the other's answers, completing opens the Gap to both of you.",
      items: [
        { id: "sealed", label: "Both sheets are sealed. Complete when you are ready." },
        {
          id: "not-sealed",
          label:
            "Completion waits for both of you: every Aspect answered by each, and both answers accepted.",
        },
        { id: "complete", label: "Complete and open the Gap" },
        { id: "completing", label: "Completing…" },
        {
          id: "completed",
          label: "Complete ({status}) — the Gap is open to both of you.",
        },
        /*
         * The reference's one sentence about what completing does *not* do: the Gap is not a report
         * that expires when the round does. It stays readable until the relationship itself closes,
         * which is the sentence the doc quotes and the live page had no home for.
         */
        { id: "live-until-closes", label: "Align stays live until the relationship closes." },
      ],
    },
    {
      /**
       * #785 — the Counterparty's one action on this screen.
       *
       * The relationship's template is a private copy of the initiator's, so nothing in either
       * library lists it for the person who was asked to answer it: without this panel the words
       * they were invited on are readable once and never theirs. The body says what the copy is
       * and — the part that keeps it honest — what it is not: taking it changes nothing about the
       * relationship it came from.
       */
      id: "fork",
      /*
       * Copy rule 1 (Title Case for every label, heading and button) — the rectification register's
       * one copy delta on this panel. The section and its action are both Title Case now; the body
       * stays a sentence, because body copy is not what the rule governs.
       */
      heading: "Keep These Aspects for Yourself",
      body: "This relationship's template belongs to the person who started it, so it is not in your templates. Save a copy and it becomes yours to edit, with the Aspects exactly as they were when the invitation went out — and this relationship is untouched: the same words, the same answers, nothing re-sent. Taking it twice points at the copy you already have instead of making a second one.",
      items: [
        { id: "submit", label: "Save This Template to My Templates" },
        { id: "working", label: "Saving…" },
        {
          id: "saved",
          label: "Saved as “{title}” — {aspects} Aspects — in My Templates.",
        },
        { id: "reused", label: "You already have this one, saved as “{title}”." },
        { id: "open", label: "Open My Templates" },
      ],
    },
    {
      /**
       * #1135 — **invitation hygiene**, the three courtesies on a live invitation.
       *
       * Bundle 03's pass-10 list, in the order the artifact draws them: Copy Invite Link (copies,
       * then confirms), Resend Invite (rate-limited by `lib/flow/resend.ts`, then confirms), and
       * Cancel Invite behind a neutral × confirm whose sentence is the artifact's own — "the link
       * stops working… your draft stays and you can invite again".
       *
       * The resend has three sentences rather than one because the mail has three outcomes
       * (`sent|unset|failed`): a deployment with no key still minted a working link, and claiming an
       * email nobody sent would be the one lie this screen could tell.
       */
      id: "hygiene",
      heading: "Invitation",
      body: "The invitation works until it is claimed, cancelled, or it expires. Copy the link to share it yourself, resend it to the same address, or cancel it — the draft stays, and you can invite again.",
      items: [
        { id: "copy", label: "Copy Invite Link" },
        { id: "copied", label: "Link Copied" },
        { id: "copy-failed", label: "The clipboard is not available in this browser." },
        { id: "link", label: "The link" },
        { id: "resend", label: "Resend Invite" },
        { id: "resending", label: "Resending…" },
        { id: "resent", label: "Invitation Resent · the new link is live until {instant}." },
        {
          id: "resent-unset",
          label: "Resent · no email left this deployment, so share the link below.",
        },
        { id: "resent-failed", label: "Resent · the email did not go, so share the link below." },
        { id: "cancel", label: "Cancel Invite" },
        {
          id: "cancel-confirm",
          label:
            "Cancel this invitation? The link stops working the moment you do. Your draft stays and you can invite again.",
        },
        { id: "cancelling", label: "Cancelling…" },
        { id: "cancelled", label: "Invitation Cancelled at {instant}. This is a draft again." },
        { id: "keep", label: "Keep It" },
      ],
    },
    {
      /**
       * #1135 — **close or leave, never delete.**
       *
       * One panel, two roles: either party may Leave (Stage 6 closes for both, answers stay
       * readable), and the Counterparty has the ghost control the crud-matrix flagged as missing —
       * Request My Removal, whose reason only support reads. There is deliberately **no "Delete
       * Relationship"**: the confirm copy is where the rule is stated to the reader, and the writers
       * (`lib/member/relationship-close.ts`) write a status, never a delete.
       */
      id: "close",
      heading: "Close This Relationship",
      body: "Leaving closes Stage 6 for both of you. Your answers and the Discussion stay where they are, and you can both still read them.",
      items: [
        { id: "leave", label: "Leave Relationship" },
        {
          id: "leave-confirm",
          label:
            "Leave this relationship? Stage 6 closes for both of you, and your answers and Discussion stay readable to both of you.",
        },
        { id: "leaving", label: "Leaving…" },
        { id: "left", label: "Relationship Closed at {instant}." },
        { id: "closed-badge", label: "Relationship Closed" },
        { id: "keep", label: "Stay" },
        { id: "request", label: "Request My Removal" },
        {
          id: "request-confirm",
          label:
            "Ask support to remove your name and your answers? They are removed within 30 days, and the relationship closes when they are.",
        },
        {
          id: "request-reason",
          label: "Anything support should know — they keep it to themselves.",
        },
        { id: "requesting", label: "Requesting…" },
        {
          id: "requested",
          label: "Removal Requested · support removes your name and answers within 30 days.",
        },
        { id: "requested-at", label: "Removal Requested at {instant} · support has it." },
      ],
    },
    {
      /**
       * #1135 — **Abandon Draft**, drawn only for a draft nobody was invited to.
       *
       * The confirm says what abandoning is (terminal) rather than softening it: `void` has no
       * outgoing edge, so "starting again is a new relationship" is the honest sentence and the
       * reason field is what the audit row and the row's own `void_reason` keep.
       */
      id: "abandon",
      heading: "Abandon This Draft",
      body: "Nothing has been sent, so there is nobody to tell. Abandoning ends this draft for good.",
      items: [
        { id: "submit", label: "Abandon Draft" },
        {
          id: "confirm",
          label:
            "Abandon this draft? It ends here and cannot be reopened — starting again is a new relationship.",
        },
        { id: "reason", label: "Why you are abandoning it (optional)" },
        { id: "keep", label: "Keep the Draft" },
        { id: "abandoning", label: "Abandoning…" },
        { id: "done", label: "Draft Abandoned at {instant}." },
      ],
    },
    {
      id: "closed",
      heading: "This relationship is closed",
      body: "Stage 6 is closed for both of you. Nothing more happens to this relationship, and your answers and Discussion stay readable.",
    },
    {
      id: "refusals",
      items: [
        { id: "not-yours", label: "This relationship belongs to another account." },
        { id: "no-such-relationship", label: "That relationship is not in this database." },
        { id: "not-editable", label: "Its Aspects are fixed once it has been published." },
        { id: "not-publishable", label: "It cannot be published from its current state." },
        {
          id: "trial-already-running",
          label:
            "A trial is already running on this account. It has to end before another one starts.",
        },
        { id: "invalid-counterparty", label: "The invitation needs a name and a real address." },
        { id: "invalid-draft", label: "The model refused these Aspects — check each field." },
        { id: "no-invite", label: "There is no invitation on this relationship to reissue." },
        {
          id: "invite-live",
          label: "The invitation link is still live — there is nothing to reissue.",
        },
        { id: "checkout-required", label: "A checkout has to complete first." },
        /* #1010 R2 — the completion band's own dead end. There is no fee, so there is no
         * payment-method-required, no charge-declined and no already-charged sentence left. */
        {
          id: "not-the-payer",
          label:
            "The relationship fee belongs to the person who started the relationship, every round. Only they can complete it.",
        },
        {
          id: "not-ready-to-complete",
          label:
            "The fee is only taken once both of you have answered every Aspect and accepted each other's answers.",
        },
        {
          id: "payment-expired",
          label:
            "This relationship expired before the fee was paid. A new relationship is the way to try again.",
        },
        {
          id: "invalid-plan",
          label:
            "That tier cannot carry a relationship fee. Free is a relationship limit, not a payment exemption.",
        },
        { id: "not-configured", label: "Billing is not configured on this deployment yet." },
        /* #785 — the fork's own two refusals, one sentence each. */
        {
          id: "template-not-yours",
          label:
            "That template belongs to another account. Only a party to a relationship can take its template.",
        },
        {
          id: "unknown-template",
          label: "This relationship's template could not be read — support can repair the binding.",
        },
        /* #623 — the edit surface's own dead ends, one sentence each. */
        {
          id: "unconfirmed-invalidation",
          label: "This change costs answers, and the cost has not been confirmed yet.",
        },
        {
          id: "answers-sealed",
          label: "A new question cannot be added to a sheet somebody has answered.",
        },
        {
          id: "mode-fixed",
          label: "The mode and the Setting are fixed once the session exists.",
        },
        {
          id: "seat-claimed",
          label: "The other person has joined — the seat is an account, not a text field.",
        },
        { id: "invalid-window", label: "The invitation window is 1 to 60 whole days." },
        { id: "no-such-version", label: "That version is not one of this relationship's." },
        { id: "no-change", label: "Nothing in this form differs from the relationship." },
        /* #1121 — the free week's three dead ends, one sentence each, each naming the way back so a
         * refusal is a next step rather than a wall. */
        {
          id: "not-paused",
          label:
            "Stage 6 is not paused right now, so there is no free week to add. Add a card if you want to keep it running.",
        },
        {
          id: "no-trial",
          label:
            "This account has no free trial to extend. Adding a card is the way to resume Stage 6.",
        },
        {
          id: "extension-used",
          label:
            "Your one free week has already been used on this account. Adding a card resumes Stage 6.",
        },
        /* #1135 — the ending verbs' dead ends, one sentence each. */
        {
          id: "already-closed",
          label: "This relationship is already closed — there is nothing left to end.",
        },
        {
          id: "already-joined",
          label: "The other person has already joined, so there is no link to cancel.",
        },
        { id: "invite-dead", label: "That invitation already ended. Send a new one instead." },
        {
          id: "not-published",
          label:
            "An invitation is cancelled on a relationship that was sent — this one is a draft.",
        },
        { id: "not-a-draft", label: "Only a draft that was never sent can be abandoned." },
        {
          id: "not-running",
          label:
            "Stage 6 is not running yet, so there is nothing to leave. Cancel the invitation instead.",
        },
        {
          id: "removal-already-requested",
          label: "You have already asked support to remove you — they have it.",
        },
        /* #275 — the four ways a resend is refused before it writes. */
        {
          id: "cooldown",
          label: "This invitation was resent very recently. Try again in a few hours.",
        },
        {
          id: "cap-reached",
          label:
            "This invitation has been resent as many times as it can be. Cancel it and invite again instead.",
        },
        {
          id: "already-claimed",
          label: "The other person has already joined, so the invitation needs no resending.",
        },
        {
          id: "not-initiator",
          label: "Only the person who started the relationship can resend its invitation.",
        },
        {
          id: "instance-complete",
          label: "Both of you have answered everything, so there is no invitation left to resend.",
        },
        { id: "signed-out", label: "Your session ended. Sign in and try again." },
        { id: "failed", label: "The change did not go through." },
      ],
    },
    {
      /**
       * #1124 — **the six-tab layer, and it is the whole of the content column.**
       *
       * The sections below this one are its panels: the record is one page with six views of it,
       * not six pages. The labels are the owner's words from the approved bundle
       * (`docs/specs/v2-bundles/03-spec-design-page-relationship-detail-v2/`), in the bundle's
       * order, and the `heading` is the tablist's accessible name rather than a drawn heading —
       * the layer never prints it.
       */
      id: "tabs",
      heading: "Relationship sections",
      items: [
        { id: "discussion", label: "Discussion" },
        { id: "aspects", label: "Aspects" },
        { id: "members", label: "Members" },
        { id: "details", label: "Details" },
        { id: "settings", label: "Settings" },
        { id: "payment", label: "Payment" },
      ],
    },
    {
      /**
       * #1124 — the Discussion panel.
       *
       * **The thread has no model yet** (#921 owns it), so the panel draws what the read can
       * support: the heading and one honest empty state. It is not a fake composer and it is not
       * a comment box that would write nowhere — the layer ships the tab, and the thread lands
       * when the model does.
       */
      id: "discussion",
      heading: "Relationship Discussion",
      body: "One thread for the two of you, beside the Aspects you are answering.",
      items: [{ id: "empty", label: "Nothing has been said here yet." }],
    },
    {
      /**
       * #1124 — the Members panel: the two seats, and what has happened to the invitation.
       *
       * Read from the relationship itself — the initiator's name, the Counterparty's seat, and
       * the invitation row — so a draft (no seat bound) says so instead of drawing two blanks.
       * The owner-named labels are the bundle's: `(You)` marks the viewer, and `Invitation
       * History` is the subheading.
       */
      id: "members",
      heading: "Members",
      items: [
        { id: "you", label: "(You)" },
        { id: "seat-empty", label: "Not joined yet" },
        { id: "history", label: "Invitation History" },
        { id: "no-invite", label: "No invitation has been sent yet." },
        { id: "sent", label: "Invite sent {date}." },
        { id: "expires", label: "The link stops working {date}." },
        { id: "claimed", label: "The other person has joined." },
        { id: "revoked", label: "An operator revoked the link." },
      ],
    },
    {
      /** #1124 — the Details panel: the record's own facts, then its timeline. */
      id: "details",
      heading: "Relationship Information",
      items: [
        { id: "template", label: "Template" },
        { id: "invitation", label: "Invitation" },
        { id: "seat", label: "Your Seat" },
        { id: "timeline", label: "Timeline" },
        { id: "created", label: "Created {date}." },
        { id: "published", label: "Published {date}." },
        { id: "trial-started", label: "7-day free trial started {date}." },
        { id: "empty-timeline", label: "Nothing has happened to this relationship yet." },
      ],
    },
    {
      /**
       * #1124 — the Settings panel: the two values the assessment was configured with, and the
       * one sentence about when a change takes effect. The values are read; the editor that
       * writes them is the relationship's own edit panel (#623), so this panel never grows a
       * second one.
       */
      id: "settings",
      heading: "Assessment Settings",
      items: [
        { id: "mode", label: "Mode" },
        { id: "setting", label: "Alignment Tolerance" },
        { id: "next-round", label: "Changes apply from the next round." },
        {
          id: "by-starter",
          label: "The person who started this relationship sets these.",
        },
      ],
    },
    {
      /**
       * #1124 — the Payment panel, and the no-leak rule is the whole design.
       *
       * The Initiator reads the membership and its trial; the Counterparty reads one sentence
       * and nothing else — no plan, no price, no card, no countdown. Billing itself is #1132's
       * surface; this panel mirrors the facts the relationship already carries and adds no
       * control, so there is exactly one place money is decided.
       */
      id: "payment",
      heading: "Relationship Membership",
      items: [
        { id: "membership", label: "Membership" },
        { id: "billing-owner", label: "Billing Owner" },
        { id: "you", label: "You" },
        { id: "open", label: "Running" },
        { id: "lapsed", label: "Read-only" },
        { id: "trial-ends", label: "Trial ends {date}." },
        { id: "no-trial", label: "No trial is running." },
        { id: "covered", label: "{name} covers this relationship. You’re never charged." },
        /*
         * Bundle 03's Payment tab is a summary table, not a status chip: *Status*, the date the
         * window ends (or the acceptance the trial is waiting on), the price after it, and the
         * sentence that says what happens if no card arrives. The anchor sentence is the doc's own
         * — the trial starts when the other person accepts — so a waiting relationship says when
         * the clock starts instead of printing a window that has not opened.
         *
         * The reference's `Card` row is **not** here: the member read carries no card fact, and a
         * screen asserting "Not needed" about a card it cannot read is the guess this page's
         * docstrings exist to refuse. The row lands when a read can answer it.
         */
        { id: "status", label: "Status" },
        { id: "status-waiting", label: "Trial Starts When {name} Accepts" },
        { id: "status-running", label: "Free Trial · Ends {date}" },
        { id: "status-paused", label: "Paused · Trial Ended" },
        { id: "status-paused-extra", label: "Paused · Extra Week Ended" },
        { id: "after-trial", label: "After the Trial" },
        { id: "per-month", label: "{price} / month" },
        {
          id: "resume",
          label:
            "Add a card before {date} to keep Stage 6 running. If you don’t, it pauses and nothing is lost.",
        },
      ],
    },
    {
      id: "unreadable",
      heading: "This relationship could not be read",
      body: "The database did not answer. Nothing was changed.",
    },
  ],
});
