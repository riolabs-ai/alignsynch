/**
 * The audit sentence a template write carries, **generated** rather than typed.
 *
 * `act()` (`lib/admin/act.ts`) records a reason when a caller states one, and the audit row is where an
 * operator's action on **someone else's** data answers "why did staff do this".
 *
 * It was never a good question to ask a member about their own draft. Requiring a justification to save
 * your own template reads as a form that does not work: the field was filled in empty, the save came
 * back refused, and the person concluded the page was broken (issue #625). That finding is now the
 * repo's rule (#732): no action form asks for a reason.
 *
 * So the sentence is composed here, from facts the server already holds — no caller can make a
 * submission fail on a field the person was never asked for, and the audit row keeps its sentence
 * instead of going `NULL` for the writes where the product already knows why it happened.
 *
 * This module is deliberately pure and dependency-free: `tests/template-action-reasons.test.ts`
 * asserts every sentence names the action, the record and the surface it came from.
 */

/** Where the write came from. Two surfaces write templates, and the audit row should say which. */
export type TemplateWriteScope = "member" | "console";

/**
 * What the write did. `publish`/`withdraw` are NOT here: the console's publish and withdraw bands no
 * longer ask for a reason either (#732), so those rows record whatever the caller supplied.
 */
export type TemplateWriteAction = "created-blank" | "cloned-public" | "saved";

/** A title as a sentence fragment: never empty, so the reason can never collapse below the floor. */
function quoted(title: string | undefined): string {
  const clean = (title ?? "").trim();
  return clean === "" ? "an untitled template" : `"${clean}"`;
}

/**
 * One sentence per action, naming the action, the record and the surface.
 *
 * `cloned-public` names the **source** id rather than the copy's title: the copy's title is taken from
 * the stored rows inside the transaction, so at compose time the server knows the source and not the
 * words it is about to copy.
 */
export function templateWriteReason(input: {
  readonly action: TemplateWriteAction;
  readonly scope: TemplateWriteScope;
  readonly title?: string;
  readonly sourceTemplateId?: string;
}): string {
  const surface = input.scope === "member" ? "dashboard, templates" : "console, templates";

  switch (input.action) {
    case "created-blank":
      return `Created ${quoted(input.title)} from a blank start (${surface}).`;
    case "cloned-public":
      return `Cloned public template ${input.sourceTemplateId ?? "(unknown)"} into their own templates (${surface}).`;
    case "saved":
      return `Saved edits to ${quoted(input.title)} (${surface}).`;
  }
}
