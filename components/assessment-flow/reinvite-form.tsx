/**
 * The re-invite control: one address field and one button (#275).
 *
 * It sits inside the invitation panel, below the state sentence, and it is drawn only while the
 * invitation is unclaimed (`unclaimed` or `expired`) and only for the Initiator — the store refuses
 * anybody else with `not-initiator`, and offering a control that is certain to be refused is the
 * thing this app's refusals are supposed to make visible instead of impossible.
 *
 * **The field is pre-filled with the address on the row**, because the common case is a typo: the
 * Initiator corrects one character rather than retyping the whole address. Emptying it keeps the
 * stored address (`resendInvite()` treats a blank post as "no correction"), so the form cannot
 * erase the only address the invitation has.
 *
 * **The cooldown and the cap are not disabled here.** They are enforced inside the store's
 * transaction — the same rule a hand-written POST meets — and they surface as sentences on the
 * panel. A greyed-out button would say "no" without saying why, which is the failure mode the
 * issue's copy guidance names.
 *
 * No JavaScript: a plain form POST, like the answer sheet and the claim. Literal-free — every
 * string is `data/pages/assessment-instance.ts` (E23).
 */
import type { PageCopy } from "@/content/pages";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";

export function ReinviteForm({
  copy,
  action,
  email,
  counterpartyName,
}: {
  copy: PageCopy;
  /** The instance's re-invite endpoint (`reinvitePath()`). */
  action: string;
  /** The address on the invitation row, as the field's starting value. */
  email: string;
  counterpartyName: string;
}) {
  const section = sectionOf(copy, "invite");

  return (
    <form action={action} method="post" data-reinvite-form className="mt-4 space-y-2">
      <h3 className="text-sm font-semibold">
        {fillLabel(itemLabel(section, "resend-heading"), { counterparty: counterpartyName })}
      </h3>
      <p className="text-xs">{itemLabel(section, "resend-note")}</p>
      <label className="block text-xs font-medium" htmlFor="reinvite-email">
        {itemLabel(section, "resend-email")}
      </label>
      <input
        id="reinvite-email"
        name="email"
        type="email"
        required
        defaultValue={email}
        autoComplete="off"
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100"
      />
      <button
        type="submit"
        className="rounded-md bg-action px-4 py-2 text-sm font-semibold text-action-foreground hover:bg-action/90"
      >
        {itemLabel(section, "resend-submit")}
      </button>
    </form>
  );
}
