// GENERATED FILE — do not edit.
//
// Written whole by `scripts/gen-email-bodies.mjs` from `content/email-bodies.md` and compared byte
// for byte by `pnpm email:bodies:check`, which the gate runs in every lane. Editing this file by
// hand is caught: the check re-derives it from the markdown and fails when the two disagree.
export const EMAIL_BODIES = {
  "counterparty-invitation": "This is {{inviter}}'s invitation to answer {{template}}: a set of statements about the two of you,\nanswered separately.",
  "invitation-reminder": "This invitation is the way in to {{template}}, and it stops working on {{expires_on}}.",
  "counterparty-joined": "The invitation has been claimed: that seat belongs to {{joiner}} now, and the answering is what is\nleft.",
  "gap-report-ready": "The report sets your answers side by side, so you can see where the two of you agree — In Synch — and\nwhere the difference is the Gap.",
  "trial-ending": "While the trial runs, the relationship it pays for stays writable: both of you can answer, accept and\nedit.",
  "membership-lapsed": "Nothing was deleted: the membership that paid for {{template}} ended, and what it bought is still\nyours to read.",
  "support-reply": "You are reading the reply itself: there is no ticket number to quote and no second screen to open.",
  "signup-confirmation": "You asked to hear from us, and the address you gave us is recorded.",
  "purchase-confirmation": "While the {{plan}} plan is active, the relationships it pays for stay writable: both seats can\nanswer, accept and edit.",
} as const;

export type EmailBodyId = keyof typeof EMAIL_BODIES;
