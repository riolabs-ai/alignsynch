/**
 * template-ancestor: components/dashboard/relationship-detail.tsx   (variation: two compact cards side by side instead of the detail screen's `<dl>` of facts — the join shows *who* is in the relationship and which seat the reader is in, and nothing else about it)
 *
 * **The two people, on the invitation's first and last step** (#1125).
 *
 * The bundle draws this pair twice — under the invitation (`counterparty-join.html` step 1) and again
 * on the acceptance (step 3) — and both times it answers one question: *who is this, and which of the
 * two am I?* So the cards carry three facts each and no more: the party's name, the role word, and
 * `(You)` on the Counterparty's card, because the person reading the link **is** the Counterparty
 * (round 02 §2b). The initiator's card is never marked: nothing on this path can answer as them
 * (`previewInvite().viewerRole === null` is the condition the join mounts under).
 *
 * **The tint is the party's own token**, never a palette step: the Initiator's card is
 * `bg-initiator-tint` / `border-initiator-line` / `text-initiator-ink`, the Counterparty's is the
 * slate-teal triple from `tailwind.config.ts`, and `pnpm lint` fails a hex or a `violet-*` in their
 * place. The initials disc is the party's `-solid` value, so the two cards read as two people at a
 * glance before any name is read (bundle 09).
 *
 * A server component: no state, no interaction. The words are `data/pages/invite.ts`'s `invitation`
 * section (`role-initiator`, `role-counterparty`, `you`) — one home, because the same three labels
 * are printed on two steps.
 */
import type { PageCopy } from "@/content/pages";
import type { InvitePreview } from "@/lib/flow/store";
import { itemLabel, sectionOf } from "@/lib/page-copy";

/** The letters of a name, for the initials disc — "Marcus Reyes" → "MR", "Elena" → "E". */
function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

export function JoinPartyCards({
  copy,
  preview,
}: {
  copy: PageCopy;
  preview: InvitePreview;
}) {
  const invitation = sectionOf(copy, "invitation");
  const parties = [
    {
      role: "initiator" as const,
      name: preview.initiatorName ?? "",
      roleLabel: itemLabel(invitation, "role-initiator"),
      you: false,
      card: "border-initiator-line bg-initiator-tint",
      disc: "bg-initiator-solid",
      ink: "text-initiator-ink",
    },
    {
      role: "counterparty" as const,
      name: preview.counterpartyName ?? "",
      roleLabel: itemLabel(invitation, "role-counterparty"),
      you: true,
      card: "border-counterparty-line bg-counterparty-tint",
      disc: "bg-counterparty-solid",
      ink: "text-counterparty-ink",
    },
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {parties.map((party) => (
        <div
          key={party.role}
          data-party={party.role}
          className={`flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2.5 ${party.card}`}
        >
          <span className="relative flex size-10 shrink-0 overflow-hidden rounded-full">
            <span
              aria-hidden="true"
              className={`flex h-full w-full items-center justify-center rounded-full text-sm font-semibold text-white ${party.disc}`}
            >
              {initialsOf(party.name)}
            </span>
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {party.name}
              {party.you ? (
                <span className="ml-1 text-xs font-medium text-muted-foreground">
                  {itemLabel(invitation, "you")}
                </span>
              ) : null}
            </p>
            <p className={`truncate text-xs ${party.ink}`}>
              <span className="font-semibold">{party.roleLabel}</span>
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
