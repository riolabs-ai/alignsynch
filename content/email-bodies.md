# Email bodies

The words every email in `lib/email/templates/` sends, in one file you can edit without fighting
syntax. One `## ` section per template, named by the template's own id, holding **one** fenced
`text` block: that block is the body, word for word.

```text
## counterparty-invitation

This is {{inviter}}'s invitation to answer {{template}}: a set of statements about the two of you,
answered separately.
```

### How this file becomes an email

`pnpm email:bodies` reads this file and writes `lib/email/bodies.generated.ts` — committed, because
the build and CI must work with no extra step. `pnpm email:bodies:check` re-derives it and fails when
the two disagree, so **hand-editing the generated file is caught**. The gate runs the check in every
lane, beside `md:check`.

What the check fails, each with its own message: a registered template with no section here; a
section with no fenced body; an empty body; a body that still carries the retired placeholder marker
the band used to print where prose was unwritten; a section naming a template that does not exist;
two sections naming the same template; a placeholder a template does not hold. Run `pnpm email:bodies`
after every edit.

### What may appear in a body

Text, blank lines, `## ` headings and `- ` bullets — no HTML, no front matter, no tables. A blank
line separates one block from the next; a paragraph's lines are joined with a space, so wrap them
wherever you like. Every `{{name}}` must be one of the names in the table below, and it is replaced
with the fact the template already holds; the check names any placeholder a template does not hold.

| section (template id)     | what it may say                                            |
| ------------------------- | ---------------------------------------------------------- |
| `counterparty-invitation` | `{{inviter}}` `{{counterparty}}` `{{template}}` `{{link}}` |
| `invitation-reminder`     | `{{inviter}}` `{{template}}` `{{link}}` `{{expires_on}}`   |
| `counterparty-joined`     | `{{joiner}}` `{{inviter}}` `{{template}}` `{{link}}`       |
| `gap-report-ready`        | `{{recipient}}` `{{other}}` `{{template}}` `{{link}}`      |
| `trial-ending`            | `{{recipient}}` `{{trial_ends_on}}` `{{link}}`             |
| `membership-lapsed`       | `{{recipient}}` `{{template}}` `{{ended_on}}` `{{link}}`   |
| `support-reply`           | `{{recipient}}` `{{subject}}` `{{received_on}}`            |
| `signup-confirmation`     | `{{address}}`                                              |
| `purchase-confirmation`   | `{{recipient}}` `{{plan}}` `{{link}}`                      |

The four `*_on` names are calendar dates — `YYYY-MM-DD`, printed from the instant the record stores,
never computed from a clock, so the mail says the same day however often it is rendered.

### Where the body does not live here

Three of the twelve templates keep their body in code, and that is deliberate. Two of the three were
already written before this file existed — the reminder and the expiry notice each carry a sentence
this file's one-fence shape cannot express — and the third is assembled from the changelog.

| template                   | why this file has no section for it                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `stakeholder-release-note` | its body is parsed from `CHANGELOG.md` — the version line, the entry's own sections and its Known limits block, in the entry's own words.   |
| `payment-reminder`         | the body is already written, and it carries one paragraph only the day-10 nag sends — a condition a fence has no way to express.            |
| `relationship-expired`     | there are two bodies, one per seat reading it: the payer is told their fee was not paid, the counterparty is told no billing detail at all. |

A body may not be moved into this file and a body may not be moved out of it without changing these
two lists and the register in the same commit — the check reports a section for a template that does
not hold one, and a template that holds one with no section.

### These are drafts

Every body below is a draft written from facts this repository already holds — the names, the plan,
the stage, the link the template interpolates, the date on the row. **Nothing is invented**, and
where a body genuinely needs a fact the tree does not have, the blank is a visible
`<!-- TODO(owner): … -->` above the block rather than a plausible sentence. Nobody has released
these: edit what you want, then say which ones are final.

## counterparty-invitation

```text
This is {{inviter}}'s invitation to answer {{template}}: a set of statements about the two of you,
answered separately.
```

## invitation-reminder

```text
This invitation is the way in to {{template}}, and it stops working on {{expires_on}}.
```

## counterparty-joined

```text
The invitation has been claimed: that seat belongs to {{joiner}} now, and the answering is what is
left.
```

## gap-report-ready

```text
The report sets your answers side by side, so you can see where the two of you agree — In Synch — and
where the difference is the Gap.
```

## trial-ending

```text
While the trial runs, the relationship it pays for stays writable: both of you can answer, accept and
edit.
```

## membership-lapsed

```text
Nothing was deleted: the membership that paid for {{template}} ended, and what it bought is still
yours to read.
```

## support-reply

<!-- TODO(owner): the reply's actual words are not a fact this template takes — `SupportReplyFacts`
has no body field, so `lib/contact/reply.ts` mails the operator's text through `lib/contact/mail.ts`
and not through this template. Does the reply need a `body` fact threaded into this template, or is a
wrapper sentence the whole message? -->

```text
You are reading the reply itself: there is no ticket number to quote and no second screen to open.
```

## signup-confirmation

<!-- TODO(owner): what does this list send, and how often? Nothing in the tree says, so the body
confirms the address and promises nothing about when. -->

```text
You asked to hear from us, and the address you gave us is recorded.
```

## purchase-confirmation

```text
While the {{plan}} plan is active, the relationships it pays for stay writable: both seats can
answer, accept and edit.
```
