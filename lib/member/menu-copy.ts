/**
 * `lib/member/menu-copy.ts` — the words a card menu prints, resolved from one route's fixture (#1134).
 *
 * The builders in `lib/member/card-menu.ts` decide *which rows* a kebab offers; this module decides
 * what they say. Splitting them keeps the shared component tree at zero copy literals (E23) and
 * keeps each route's sentences in that route's fixture, which is the rule that lets one component
 * serve `/dashboard/templates` and `/dashboard/relationships` without either page's words leaking
 * onto the other's screen.
 *
 * Nothing here decides a fact: every function reads a section by name and hands back what the
 * fixture says, so a rename is one edit in `data/pages/**` and no diff in a component.
 */
import type { PageCopy, PageCopySection } from "@/content/pages";
import type {
  CardMenuConfirm,
  CardMenuWriteId,
  RelationshipMenuWords,
  TemplateMenuWords,
} from "@/lib/member/card-menu";
import { itemLabel, itemLabelOr, sectionBody, sectionOf } from "@/lib/page-copy";

/** A refusal row: the code an action answered with, and the sentence for it. */
export interface MenuRefusal {
  readonly code: string;
  readonly label: string;
}

/** The refusal table of a section, in the fixture's order. `fallback` is the last resort. */
export function refusalsOf(
  section: PageCopySection,
  fallbackId: string,
): {
  readonly refusals: readonly MenuRefusal[];
  readonly fallback: string;
} {
  return {
    refusals: (section.items ?? []).map((item) => ({ code: item.id, label: item.label })),
    fallback: itemLabel(section, fallbackId),
  };
}

/** A neutral confirmation: the section's heading, body and the pair of verbs on its items. */
export function confirmOf(section: PageCopySection): CardMenuConfirm {
  return {
    title: section.heading ?? "",
    body: sectionBody(section),
    confirm: itemLabel(section, "confirm"),
    cancel: itemLabel(section, "cancel"),
  };
}

/** `/dashboard/templates` — the kebab's rows, as bundle 06 words them. */
export function templateMenuWords(copy: PageCopy): TemplateMenuWords {
  const menu = sectionOf(copy, "menu");
  return {
    more: itemLabel(menu, "more"),
    create: itemLabel(menu, "create"),
    saveCopy: itemLabel(menu, "save-copy"),
    edit: itemLabel(menu, "edit"),
    duplicate: itemLabel(menu, "duplicate"),
    archive: itemLabel(menu, "archive"),
  };
}

/** `/dashboard/templates` — what each write says when it lands, keyed by the write it reports. */
export function templateMenuNotices(copy: PageCopy): Partial<Record<CardMenuWriteId, string>> {
  const notices = sectionOf(copy, "menu-notices");
  return {
    "save-copy": itemLabelOr(notices, "save-copy"),
    duplicate: itemLabelOr(notices, "duplicate"),
    archive: itemLabelOr(notices, "archive"),
  };
}

/** `/dashboard/relationships` — the kebab's rows and its three confirmations. */
export function relationshipMenuWords(copy: PageCopy): RelationshipMenuWords {
  const menu = sectionOf(copy, "card-menu");
  return {
    more: itemLabel(menu, "more"),
    open: itemLabel(menu, "open"),
    continueSetup: itemLabel(menu, "continue"),
    addCard: itemLabel(menu, "add-card"),
    resend: itemLabel(menu, "resend"),
    cancelInvite: itemLabel(menu, "cancel-invite"),
    abandon: itemLabel(menu, "abandon"),
    leave: itemLabel(menu, "leave"),
    confirmCancelInvite: confirmOf(sectionOf(copy, "confirm-cancel-invite")),
    confirmAbandon: confirmOf(sectionOf(copy, "confirm-abandon")),
    confirmLeave: confirmOf(sectionOf(copy, "confirm-leave")),
  };
}

/** `/dashboard/relationships` — what each write says when it lands. */
export function relationshipMenuNotices(copy: PageCopy): Partial<Record<CardMenuWriteId, string>> {
  const notices = sectionOf(copy, "menu-notices");
  return {
    resend: itemLabelOr(notices, "resend"),
    "cancel-invite": itemLabelOr(notices, "cancel-invite"),
    abandon: itemLabelOr(notices, "abandon"),
    leave: itemLabelOr(notices, "leave"),
  };
}
