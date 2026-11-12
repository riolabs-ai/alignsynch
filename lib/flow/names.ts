/**
 * The two people's names, and the title derived from them (#825, v9 artifact `s4Who`).
 *
 * Stage 1 collects each person as **first + last**, not as one free-text name, and the
 * relationship's title is a *default derived from those four fields* rather than a sentence
 * somebody has to invent: `Daniel V – Rowan M`. Three facts follow from that, and each of them
 * lives here rather than in the component so they can be tested without a DOM:
 *
 *   - **the title is a default, not a value.** It is recomputed while the name fields change,
 *     and it stops the moment somebody types in the title itself. What "stops" means is the
 *     caller's fact (a `touched` flag while the form is open, a stored title after a reload);
 *     `derivedTitle()` only says what the derivation *is*, so a caller cannot accidentally
 *     treat it as the answer.
 *   - **a missing last name drops the initial**, not the person: a counterparty whose last name
 *     nobody knows still gets `Rowan` on their side of the dash. The last name is optional on
 *     the Counterparty and required on the Initiator, but the derivation does not care which.
 *   - **one person alone is the whole title** (`Daniel V`, not `Daniel V – `), because half a
 *     dash is not a name. A blank pair therefore never produces a dangling separator.
 *
 * Pure, no React and no `next/*`: the client form derives as it types, `whoDraft()` composes
 * the seats it stores, and both read this one module, so the title on the screen and the name
 * on the invitation cannot be two different spellings of the same person.
 */

/** What one seat of the form carries — the four fields, in the order the form asks them. */
export interface NameParts {
  readonly first: string;
  readonly last: string;
}

/** An empty pair, for a first visit or a seat nobody has typed into yet. */
export const EMPTY_NAME_PARTS: NameParts = { first: "", last: "" };

/**
 * One seat's display name: `First Last`, trimmed, with a blank last name simply absent.
 *
 * This is the string the flow **stores** — `party.name`, the invitation's "who is inviting
 * you" and the dashboard's row all read it — so it is composed once, here, from the two fields
 * the person actually filled in.
 */
export function personName(first: string, last: string): string {
  const head = first.trim();
  const tail = last.trim();
  if (head === "") return tail;
  return tail === "" ? head : `${head} ${tail}`;
}

/**
 * One side of the derived title: the first name plus the **initial** of the last name
 * (`Daniel V`). The initial is uppercased because it is a capital letter standing for a name,
 * not whatever case the person happened to type.
 */
export function titleName({ first, last }: NameParts): string {
  const head = first.trim();
  if (head === "") return "";
  const tail = last.trim();
  return tail === "" ? head : `${head} ${tail[0]?.toUpperCase() ?? ""}`;
}

/** The dash between the two sides — an en dash, as the artifact draws it (`\u2013`). */
const TITLE_DASH = " \u2013 ";

/**
 * The relationship's derived title: `Daniel V – Rowan M`.
 *
 * Either side alone is the whole title; both blank is the empty string, which is what the
 * required-field refusal names (the store still refuses a blank title, and the form marks the
 * field required with the browser's own `required` attribute before that).
 */
export function derivedTitle(initiator: NameParts, counterparty: NameParts): string {
  const left = titleName(initiator);
  const right = titleName(counterparty);
  if (left === "") return right;
  if (right === "") return left;
  return `${left}${TITLE_DASH}${right}`;
}
