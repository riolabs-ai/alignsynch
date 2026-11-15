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
    { id: "none", label: "—" },
    /** #533 phase 3 — the badge the derived lapse draws beside the stored status. */
    { id: "read-only", label: "Read-only" },
    /** #706 — the viewer's own seat, from their party row. */
    { id: "role-initiator", label: "Initiator" },
    { id: "role-counterparty", label: "Counterparty" },
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
      /**
       * #690 / #1010 R2 — the hard gate at publish.
       *
       * Publishing needs a live **membership** — bought at stage 5, one subscription covering both
       * parties — so the screen draws **no publish control at all** while there is none, and names
       * the place one is bought. A disabled button would be worse than nothing: it would say "you
       * cannot publish yet" and leave the person to guess what would change that.
       *
       * There is no "add a payment method" door anywhere in this band, and no sentence offering one:
       * a card reaches an account by buying the membership, which is what the door is.
       */
      id: "publish-gate",
      heading: "A membership is needed to publish",
      /**
       * The artifact's own publish-lock sentence (`s11.publishBlocked`), re-worded for #1010: what
       * the membership unlocks is the Gap and the parity views, and both seats can still answer
       * without it. The old line named a payment method, which this build no longer captures
       * separately from the membership.
       */
      body: "Publish is locked until this account's membership is running — the Gap analysis and the parity views stay closed until then. Both seats can still answer.",
      items: [
        { id: "publish-help", label: "Publishing waits until the membership is running." },
        { id: "plans", label: "See plans and prices" },
        /**
         * #912 — **the door the band actually needs.** `/pricing` sells the membership without the
         * relationship in hand, so a band that named only the plans could not resolve the refusal it
         * drew. This is the pay modal's own label — the owner's words — and the band draws it as the
         * primary door whenever the relationship has a session for stage 5 to read.
         */
        { id: "invite-members", label: "Invite Members" },
        /**
         * #958 — **the same door, named for the act it performs.** On a draft the pay modal's Send
         * *is* the publish, so the band offers both of the owner's verbs rather than implying one
         * act lives on a different screen. Same label as the card's (`dashboard-relationships.ts`),
         * deliberately: one act, one word, whichever surface draws it.
         */
        { id: "publish-to-counterparty", label: "Publish to Counterparty" },
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
      heading: "Keep these Aspects for yourself",
      body: "This relationship's template belongs to the person who started it, so it is not in your templates. Save a copy and it becomes yours to edit, with the Aspects exactly as they were when the invitation went out — and this relationship is untouched: the same words, the same answers, nothing re-sent. Taking it twice points at the copy you already have instead of making a second one.",
      items: [
        { id: "submit", label: "Save this template to My Templates" },
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
      id: "closed",
      heading: "This relationship is closed",
      body: "Nothing more happens to a relationship in this state. Starting a new one is a new relationship with its own invitation.",
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
        { id: "signed-out", label: "Your session ended. Sign in and try again." },
        { id: "failed", label: "The change did not go through." },
      ],
    },
    {
      id: "unreadable",
      heading: "This relationship could not be read",
      body: "The database did not answer. Nothing was changed.",
    },
  ],
});
