import type { PageCopy, PageCopySection } from "@/content/pages";
import { sectionBody, sectionOf } from "@/lib/page-copy";
import Link from "next/link";

/**
 * `/terms` and `/privacy`, the one view both pages render (issue #270).
 *
 * The copy is `data/pages/legal.ts`; this file owns no string of its own — `data:check` E23 holds
 * it to a budget of 0 leaf literals, so every heading, label and paragraph arrives as a prop.
 * What it does own is the *order* and the *shape*, and the order is the requirement:
 *
 *   1. the `draft-notice` band, first, always;
 *   2. then the document, section by section.
 *
 * **Non-dismissible by construction, not by discipline.** There is no state here, no
 * `"use client"` and no control of any kind in the notice band: a draft banner that can be
 * closed is a draft banner a reader will close and then read the rest as final. The only way to
 * remove it is to delete the code that draws it, which is a visible diff in this file.
 *
 * The notice sits on the page's own ground in body ink (`text-foreground` on `bg-muted`, with the
 * brand's action colour as the rule down its left edge) rather than in the small grey print most
 * policies use for a disclaimer — the banner is there to be read, not to be survived.
 *
 * A section body is a sequence of paragraphs separated by `\n\n`; a paragraph whose lines all
 * start with `- ` is rendered as a list. That is the whole markup vocabulary the fixture uses,
 * and it is enough for a legal document: two of the template's shapes (a numbered sub-clause and
 * a bullet list) plus prose.
 */
export function LegalPage({ copy }: { copy: PageCopy }) {
  /**
   * Resolved by id, not by position: `sectionOf` throws with the ids that do exist if this band
   * is ever renamed, and E23 resolves the same id at build time. Position is the second half of
   * the guarantee — the band is drawn above the body whatever order the fixture declares.
   */
  const notice = sectionOf(copy, "draft-notice");
  const sections = (copy.sections ?? []).filter((section) => section.id !== notice.id);
  /**
   * The band's heading is the sentence's own opening words ("Version 1 draft", then "Version 1
   * draft. Adapted from…"), so drawing both prints the same three words twice in forty pixels.
   * The heading renders only when it says something the sentence does not already say; the
   * sentence itself — the thing the issue requires on both pages — always renders, in full.
   */
  const noticeBody = sectionBody(notice);
  const noticeHeading =
    notice.heading !== undefined && !noticeBody.startsWith(notice.heading)
      ? notice.heading
      : undefined;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-16">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {copy.heading}
        </h1>
        {copy.subtitle !== undefined && (
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">{copy.subtitle}</p>
        )}
      </header>

      {/*
       * The draft band. `role="note"` so a screen reader announces it as an aside before the
       * document's headings, and no button, no anchor and no `hidden` attribute anywhere: the
       * requirement is that both pages cannot offer a way to hide it.
       */}
      <section
        id={notice.id}
        role="note"
        className="mb-12 rounded-r-lg border-l-4 border-action bg-muted px-5 py-4"
      >
        {noticeHeading !== undefined && (
          <h2 className="text-sm font-semibold tracking-wide text-foreground uppercase">
            {noticeHeading}
          </h2>
        )}
        <div className="mt-2">
          <Body text={noticeBody} />
        </div>
      </section>

      <div className="space-y-10">
        {sections.map((section) => (
          <Section key={section.id} section={section} />
        ))}
      </div>

      {copy.cta !== undefined && (
        <p className="mt-12 border-t border-border pt-6">
          <Link href={copy.cta.href} className="text-sm font-medium text-action hover:underline">
            {copy.cta.label}
          </Link>
        </p>
      )}
    </div>
  );
}

/** One band of the document: its heading, its prose, then its numbered sub-clauses. */
function Section({ section }: { section: PageCopySection }) {
  return (
    <section id={section.id}>
      {section.heading !== undefined && (
        <h2 className="text-xl font-semibold tracking-tight text-foreground">{section.heading}</h2>
      )}
      {section.body !== undefined && (
        <div className="mt-3">
          <Body text={section.body} />
        </div>
      )}
      {section.items !== undefined && (
        <dl className="mt-4 space-y-4">
          {section.items.map((item) => (
            <div key={item.id} id={`${section.id}-${item.id}`}>
              <dt className="font-medium text-foreground">{item.label}</dt>
              {item.body !== undefined && (
                <dd className="mt-1">
                  <Body text={item.body} />
                </dd>
              )}
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

/**
 * The fixture's paragraph vocabulary: blocks split on a blank line, and a block whose every line
 * starts with `- ` becomes a list. Text is rendered as text — the fixture carries no markup, so
 * there is nothing here for a component to interpret.
 */
function Body({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
      {text.split("\n\n").map((block) => {
        const lines = block.split("\n");
        if (lines.every((line) => line.startsWith("- "))) {
          return (
            <ul key={block} className="list-disc space-y-1 pl-5">
              {lines.map((line) => (
                <li key={line}>{line.slice(2)}</li>
              ))}
            </ul>
          );
        }
        return <p key={block}>{block}</p>;
      })}
    </div>
  );
}
