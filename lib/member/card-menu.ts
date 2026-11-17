/**
 * The card menu, as data — one kebab, two shelves, no words of its own (#1134).
 *
 * **The menu is a projection, like the card.** `templates.html` and `my-relationships.html` draw a
 * `More actions` button on every card and a short list behind it, and the list is not the same on
 * two cards of the same shelf: a Library card offers `Create Relationship · Save a Copy` while a My
 * Template offers `Edit · Duplicate · Archive`, and a relationship's menu follows its *state* —
 * a draft can be abandoned, an invitation can be resent, a live relationship can be left. That is a
 * decision, so it is decided here, once, and the components print what they are handed.
 *
 * **No sentence lives in this file.** Every label, every confirmation and every notice arrives in a
 * `words` object the route resolved from its own fixture, for the reason `relationship-card-model.ts`
 * states: this module is reached from two routes, and `scripts/copy-refs.ts` validates a shared file
 * against *both* fixtures. A literal here would be one route's sentence on the other route's screen.
 *
 * **The write is named, not carried.** An entry says *which* write it performs (`"save-copy"`,
 * `"leave"`); the server component that mounts the card supplies the actual `"use server"` action.
 * That keeps this module node-testable — `tests/card-menus.test.ts` drives it with no browser and no
 * session — and it keeps the server action out of a module the browser may reach.
 *
 * **What the bundle draws and this file refuses to draw.** `Copy Invite Link` is on the
 * `Waiting on Invite` card in `my-relationships.html`, and it is *not* here: a token is never stored,
 * so no read can hand a card the link (`lib/member/relationships.ts` — `inviteLinkAvailable` is
 * always `false`, #220). A menu item that copies nothing is the dead control #841 removed from this
 * shelf, so the waiting card carries `Resend Invite` (which mints a link and shows it on the
 * relationship's own screen) and `Cancel Invite`, and the copy control stays where a link exists.
 *
 * **No `Delete`, on any card.** The bundle draws none and `crud-matrix` names none: a relationship is
 * abandoned, left or removed on request, and a template is archived — never deleted from a kebab
 * (`components/dashboard/my-template-retire.tsx` owns the one destroy control, and it lives on the
 * template's own page behind a confirmation).
 */

/** Which of the two builders produced an entry — the surface is the vocabulary's home. */
export const CARD_MENU_WRITES = [
  "save-copy",
  "duplicate",
  "archive",
  "resend",
  "cancel-invite",
  "abandon",
  "leave",
] as const;

export type CardMenuWriteId = (typeof CARD_MENU_WRITES)[number];

/** The glyph a row draws — the icon is structure, so it is named here and mapped in the component. */
export type CardMenuIcon =
  | "open"
  | "create"
  | "save"
  | "edit"
  | "duplicate"
  | "archive"
  | "resend"
  | "cancel"
  | "leave"
  | "card";

/** A neutral confirmation: the bundle's one modal, never a browser `confirm()`. */
export interface CardMenuConfirm {
  readonly title: string;
  readonly body: string;
  readonly confirm: string;
  readonly cancel: string;
}

/** One row of the menu. A link carries `href`; a write carries `write`; never both. */
export interface CardMenuEntry {
  readonly id: string;
  readonly label: string;
  readonly icon: CardMenuIcon;
  /** A destination, for the rows that only navigate (`Open`, `Edit`, `Continue Setup`). */
  readonly href?: string;
  /** The write this row performs, for the rows that change a row. */
  readonly write?: CardMenuWriteId;
  /** Present when the write needs the neutral confirmation first. */
  readonly confirm?: CardMenuConfirm;
}

/** What a `"use server"` action answers, narrowed to what a menu can act on. */
export interface CardMenuAnswer {
  readonly ok: boolean;
  /** The new row's id, for the writes that mint one (`Save a Copy`, `Duplicate`). */
  readonly id?: string;
  /** The refusal word, looked up in the route's own refusal table. */
  readonly code?: string;
  /** The address a resend was sent to — the notice's `{email}`. */
  readonly email?: string;
}

/** A server action, as the menu calls it. The payload is the card's own ids. */
export type CardMenuWrite = (
  payload: Record<string, string | undefined>,
) => Promise<CardMenuAnswer>;

/** The words a Template card's menu needs, all resolved by `lib/member/shelf.ts`. */
export interface TemplateMenuWords {
  /** `More actions for {title}` — the trigger's accessible name. */
  readonly more: string;
  readonly create: string;
  readonly saveCopy: string;
  readonly edit: string;
  readonly duplicate: string;
  readonly archive: string;
}

/** The words a relationship card's menu needs, all resolved by `cardWordsOf()`. */
export interface RelationshipMenuWords {
  /** `More actions for {title}` — the trigger's accessible name. */
  readonly more: string;
  readonly open: string;
  readonly continueSetup: string;
  readonly addCard: string;
  readonly resend: string;
  readonly cancelInvite: string;
  readonly abandon: string;
  readonly leave: string;
  readonly confirmCancelInvite: CardMenuConfirm;
  readonly confirmAbandon: CardMenuConfirm;
  readonly confirmLeave: CardMenuConfirm;
}

/** The Library's card menu: what a template this account may use offers (#1134, bundle 06). */
export function templateMenuOf(
  words: TemplateMenuWords,
  tab: "library" | "mine",
  card: {
    readonly id: string;
    readonly detailHref: string;
    readonly createHref: string | null;
  },
): readonly CardMenuEntry[] {
  if (tab === "library") {
    return [
      ...(card.createHref === null
        ? []
        : [
            {
              id: "create",
              label: words.create,
              icon: "create" as const,
              href: card.createHref,
            },
          ]),
      { id: "save-copy", label: words.saveCopy, icon: "save", write: "save-copy" },
    ];
  }
  return [
    { id: "edit", label: words.edit, icon: "edit", href: `${card.detailHref}?edit=1` },
    { id: "duplicate", label: words.duplicate, icon: "duplicate", write: "duplicate" },
    { id: "archive", label: words.archive, icon: "archive", write: "archive" },
  ];
}

/** What the relationship menu needs beyond the words: the seat, and the two ids a write takes. */
export interface RelationshipMenuFacts {
  /** The card's state — the owner's four words, from `lib/member/start.ts::cardStateOf`. */
  readonly state: "live" | "waiting" | "draft" | "paused";
  /** Whether the viewer started this relationship. `Add a Card` is the Initiator's alone. */
  readonly isInitiator: boolean;
  /** The relationship's own screen. */
  readonly href: string;
  /** The destination the card's own action points at (the wizard for a draft, the details otherwise). */
  readonly actionHref: string;
  /** The session a resend re-mints an invitation for; `null` before anything was sent. */
  readonly instanceRecordId: string | null;
}

/**
 * One relationship's card menu (#1134, bundle 05's four states).
 *
 *   live     Open · Leave Relationship
 *   waiting  Open · Resend Invite · Cancel Invite
 *   draft    Open · Continue Setup · Abandon Draft
 *   paused   Open · Add a Card (Initiator only) · Leave Relationship
 *
 * `Copy Invite Link` is the bundle's fifth waiting item and is deliberately absent — see this file's
 * header. `Add a Card` is the one role-gated row: the Counterparty does not pay (`#1139`'s rule, and
 * the issue's `Must not show Add a Card to the Counterparty`), so the row is not drawn for them.
 */
export function relationshipMenuOf(
  words: RelationshipMenuWords,
  facts: RelationshipMenuFacts,
): readonly CardMenuEntry[] {
  const open: CardMenuEntry = { id: "open", label: words.open, icon: "open", href: facts.href };
  switch (facts.state) {
    case "live":
      return [
        open,
        {
          id: "leave",
          label: words.leave,
          icon: "leave",
          write: "leave",
          confirm: words.confirmLeave,
        },
      ];
    case "waiting":
      return [
        open,
        ...(facts.instanceRecordId === null
          ? []
          : [
              {
                id: "resend",
                label: words.resend,
                icon: "resend" as const,
                write: "resend" as const,
              },
            ]),
        {
          id: "cancel-invite",
          label: words.cancelInvite,
          icon: "cancel",
          write: "cancel-invite",
          confirm: words.confirmCancelInvite,
        },
      ];
    case "draft":
      return [
        open,
        { id: "continue", label: words.continueSetup, icon: "create", href: facts.actionHref },
        {
          id: "abandon",
          label: words.abandon,
          icon: "cancel",
          write: "abandon",
          confirm: words.confirmAbandon,
        },
      ];
    case "paused":
      return [
        open,
        ...(facts.isInitiator
          ? [
              {
                id: "add-card",
                label: words.addCard,
                icon: "card" as const,
                href: facts.actionHref,
              },
            ]
          : []),
        {
          id: "leave",
          label: words.leave,
          icon: "leave",
          write: "leave",
          confirm: words.confirmLeave,
        },
      ];
  }
}
