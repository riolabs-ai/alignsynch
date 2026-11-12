/**
 * template-ancestor: components/assessment-flow/create-relationship.tsx   (variation: the six facts stages 1–3 decided, printed back as one definition list instead of a form — a review card, not an editor)
 *
 * **What gets created**, read back before it exists (#825).
 *
 * Stage 4 owns the account and shows this beside it: the relationship's shape — one template, two
 * seats, the title, the Mode and the Setting — is settled by the three stages behind it, so a person
 * who is being asked to hand over an account can see what the account is for. It moved here from the
 * old single-screen conversion, because v9 splits that screen in two: the account is stage 4 and the
 * send is stage 5, and repeating these six facts on both would be one card too many
 * (`docs/specs/flow-stages.md` → *Stage 4, Account*).
 *
 * Every word is `data/pages/assessment-create.ts` (`review`, plus the template band's `aspects`
 * row) — E23 counts what a component writes and this one writes none. `none` is the fixture's dash,
 * because a blank row is worse than a dash: a reviewer cannot tell an empty description from a
 * rendering bug.
 */
import type { PageCopy } from "@/content/pages";
import { MODE_LABELS, SETTING_LABELS } from "@/content/assessment";
import { personName } from "@/lib/flow/names";
import type { CreateDraft } from "@/lib/flow/create-draft";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

/** The review's six facts, in the order the artifact prints them. */
const REVIEW_ORDER = ["template", "initiator", "counterparty", "title", "mode", "setting"] as const;

const CARD =
  "space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900";
const HEADING = "text-lg font-semibold text-gray-900 dark:text-gray-100";
const MUTED = "text-sm text-gray-600 dark:text-gray-300";

export function RelationshipReview({
  copy,
  draft,
  template,
}: {
  copy: PageCopy;
  draft: CreateDraft;
  /** The template as the review prints it: its title and its Aspect count. */
  template: { readonly title: string; readonly aspectCount: number };
}) {
  const review = sectionOf(copy, "review");
  const band = sectionOf(copy, "template");

  /** One fact's answer: the template's own values, the draft's, or the fixture's dash. */
  function reviewValue(fact: (typeof REVIEW_ORDER)[number]) {
    const none = () => <span>{itemLabel(review, "none")}</span>;
    const orNone = (value: string) => (value.trim() === "" ? none() : <span>{value.trim()}</span>);
    switch (fact) {
      case "template":
        return (
          <span>
            {template.title}
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              {fillLabel(itemLabel(band, "aspects"), { count: template.aspectCount })}
            </span>
          </span>
        );
      case "initiator":
        return orNone(personName(draft.initiatorFirst, draft.initiatorLast));
      case "counterparty":
        return orNone(personName(draft.counterpartyFirst, draft.counterpartyLast));
      case "title":
        return orNone(draft.title);
      case "mode":
        return (
          <span>
            {MODE_LABELS[draft.mode as keyof typeof MODE_LABELS] ?? itemLabel(review, "none")}
          </span>
        );
      case "setting":
        return (
          <span>
            {SETTING_LABELS[draft.alignmentSetting as keyof typeof SETTING_LABELS] ??
              itemLabel(review, "none")}
          </span>
        );
    }
  }

  return (
    <section aria-labelledby="create-review-heading" data-create-review="true" className={CARD}>
      <h2 id="create-review-heading" className={HEADING}>
        {review.heading}
      </h2>
      <p className={MUTED}>{sectionBody(review)}</p>
      <dl className="mt-2 space-y-1.5 text-sm">
        {REVIEW_ORDER.map((fact) => (
          <div key={fact} className="flex justify-between gap-3" data-create-fact="true">
            <dt className="text-gray-500 dark:text-gray-400">{itemLabel(review, fact)}</dt>
            <dd className="text-right text-gray-900 dark:text-gray-100">{reviewValue(fact)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
