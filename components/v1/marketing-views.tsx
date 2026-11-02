// template-ancestor: components/marketing/marketing-landing.tsx   (variation: the public bands, rendered inside the prototype)
import { brand } from "@/data/brand";
import { SectionIntro } from "@/components/v1/v1-ui";

/**
 * The /v1 support surface — the facts the live support page states, minus the taxonomy the
 * alignment build does not offer. The contact line reads the brand record's mailbox.
 */
export function V1Support() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <SectionIntro title="Support" subtitle="Help for your AlignSynch account." />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            heading: "This is a beta",
            body: "The records behind these screens are a demonstration set, reset and reseeded every night from a versioned bundle.",
          },
          {
            heading: "Coach support is not built",
            body: "The Coach is a word in the product's vocabulary and a feature in no file. The app shows the Gap and stops there.",
          },
          {
            heading: "The Gap",
            body: "A Gap is the difference between two scores on one Aspect, computed from the answers and never stored.",
          },
        ].map((card) => (
          <div key={card.heading} className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-semibold text-foreground">{card.heading}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{card.body}</p>
          </div>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        Email us at{" "}
        <a
          href={`mailto:${brand.supportEmail}`}
          className="font-medium text-action hover:underline"
        >
          {brand.supportEmail}
        </a>
        .
      </p>
    </div>
  );
}
