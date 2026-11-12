// template-ancestor: components/home/alignment-home.tsx   (variation: the model band — the Bread and the Butter as two photographed cards with a line grid and a scale panel, instead of the two-question compare grid)

import { BODY_INK, SectionHead } from "@/components/home/as2-parts";
import type { As2HomeModel } from "@/lib/home-alignsynch";
import { cn } from "@/lib/utils";
import Image from "next/image";
import type React from "react";

/**
 * The AlignSynch model, in two cards: where a gap comes from (the Bread), and what an opinion
 * actually is (the Butter).
 *
 * **`id="questions"` is the page's oldest contract.** The shared marketing header and the footer
 * have both linked to `/#questions` since before this redesign, so the anchor is stable copy *and*
 * stable structure: the band keeps the id even though the band's heading is new. Renaming the id
 * would silently break the footer's "How It Works" row — which is the kind of breakage no test in
 * this tree would report, because a fragment that matches nothing is a no-op rather than an error.
 *
 * **The two cards set their four lines differently, and that is the reference's rule, not a
 * deviation.** `.idea-line strong` is `display: block` — the Bread card teaches FEEL / WISH / THINK
 * / GUESS as a word above its sentence — and `.butter-card .idea-line strong` overrides it back to
 * `display: inline`, so the Butter card runs the same word *inside* the sentence ("Actually, you
 * **FEEL** it is only slightly different."). Both are read from `lead`/`body`, which is why the
 * Butter card splits its body at the emphasised word instead of printing it twice: the copy carries
 * the finished sentence, the lead carries the word to emphasise, and `inlineLead()` puts one inside
 * the other. An earlier version of this file ran both cards as blocks and called the difference a
 * deliberate improvement; it was a misreading of a two-rule cascade, and this is the reference.
 *
 * The scale is `.home-scale-track` from `app/globals.css`: a gradient cannot be written here, and
 * its three stops are brand roles, so the bar cannot describe a palette the record does not have.
 * The three dots on it are the reference's `::before` / `::after` / `.scale-point` — 13px at each
 * end, a 20px green point in the middle with a tinted halo.
 */

/**
 * The sentence with its lead word emphasised, in place.
 *
 * The Butter card's four lines are finished sentences (`"Actually, you FEEL it is only slightly
 * different."`); the lead (`FEEL`) is the word inside it. Splitting on the **first** occurrence is
 * correct because the lead is the only occurrence in every row the fixture declares — a row that
 * repeated its word would emphasise the first one, which is what the reference draws. A lead that is
 * not in the body renders the body unemphasised rather than throwing: the sentence is the content
 * and the emphasis is the treatment, so a copy edit that drops a word must not blank a line.
 */
function inlineLead(lead: string, body: string): React.ReactNode {
  const at = body.indexOf(lead);
  if (at < 0) return body;
  return (
    <>
      {body.slice(0, at)}
      <strong className="inline font-[750] text-primary">{lead}</strong>
      {body.slice(at + lead.length)}
    </>
  );
}

export function As2Model({ band }: { band: As2HomeModel["model"] }): React.ReactElement {
  return (
    <section className="bg-mist py-[72px] min-[741px]:py-[86px]" data-home-anchor id="questions">
      {/* The reference also keeps a zero-height `#about` alias on this band. It is omitted: nothing
          in this app links to `#about` (the shared header and footer both use `/#questions`), and a
          target the in-page menu does not list is a scroll position with no referent. Named here so
          the omission is a decision rather than an oversight. */}
      <div className="home-container">
        <SectionHead head={band} />
        <div className="grid grid-cols-1 items-stretch gap-[18px] min-[741px]:grid-cols-2 min-[741px]:gap-6">
          {band.cards.map((card, index) => {
            /* The second card is the Butter: inline lines, a shorter line box and the scale panel.
               The distinction is positional in the reference (`.butter-card`), and the projection
               hands the cards in the reference's order, so position is the honest test. */
            const butter = index === 1;
            return (
              <article
                className="min-w-0 overflow-hidden rounded-[5px] border border-line bg-background"
                key={card.title}
              >
                <div
                  className={cn(
                    "relative h-[175px] overflow-hidden min-[481px]:h-[210px] min-[741px]:h-[190px]",
                    butter ? "bg-[#e7d9ce]" : "bg-[#d7e8e6]",
                  )}
                >
                  <Image
                    alt={card.image.alt}
                    className="size-full object-cover"
                    height={card.image.height}
                    src={card.image.src}
                    width={card.image.width}
                  />
                  <div
                    aria-hidden="true"
                    className="home-idea-scrim absolute inset-x-0 bottom-0 top-[35%]"
                  />
                  <span className="absolute left-[17px] top-4 z-[1] inline-flex items-center gap-2 rounded-[3px] border border-[rgb(251_250_246_/_70%)] bg-white py-1.5 pl-1.5 pr-2.5 text-[10px] font-bold leading-[1.55] tracking-[0.02em] text-foreground">
                    <b className="grid size-[22px] place-items-center rounded-[2px] bg-deep text-[11px] font-bold text-white">
                      {card.step}
                    </b>
                    {card.stepLabel}
                  </span>
                </div>
                <div className="p-5 min-[741px]:p-6">
                  <p className="mb-[7px] text-[11px] font-bold leading-[1.55] tracking-[0.01em] text-deep">
                    {card.kicker}
                  </p>
                  <h3 className="mb-[7px] text-[clamp(22px,2.5vw,29px)] font-[720] leading-[1.14] tracking-[-0.025em] text-primary">
                    {card.title}
                  </h3>
                  <p className={cn("text-[13px] leading-[1.55]", BODY_INK)}>{card.deck}</p>
                  {card.scale === undefined ? null : (
                    <div
                      aria-label={card.scale.name}
                      className="mb-[18px] mt-[21px] rounded-[3px] border border-line bg-pale px-4 pb-[13px] pt-[15px]"
                      role="img"
                    >
                      <div className="flex justify-between text-[10px] font-[850] leading-[1.55] tracking-[0.13em] text-[#526a7b]">
                        <span>{card.scale.yes}</span>
                        <span>{card.scale.no}</span>
                      </div>
                      <div className="home-scale-track relative mx-[9px] my-[13px] h-[3px] rounded-full">
                        <span className="absolute left-0 top-1/2 size-[13px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-primary shadow-[0_0_0_1px_#8baeb8]" />
                        <span className="absolute left-full top-1/2 size-[13px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-deep shadow-[0_0_0_1px_#8baeb8]" />
                        <span className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-mark shadow-[0_0_0_4px_rgb(141_198_63_/_18%)]" />
                      </div>
                      <p className="text-center text-xs font-extrabold leading-[1.55] text-[#1d6670]">
                        {card.scale.middle}
                      </p>
                    </div>
                  )}
                  <ul
                    aria-label={card.listName}
                    className={cn(
                      "grid grid-cols-2 gap-2.5 max-[480px]:grid-cols-1 max-[480px]:gap-2",
                      butter ? "mt-[17px]" : "mt-5",
                    )}
                  >
                    {card.lines.map((line) => (
                      <li
                        className={cn(
                          "rounded-[3px] border border-[#e0e6e8] bg-[#f7fafb] px-3.5 py-[13px] text-xs leading-[1.55] text-[#394b43]",
                          butter
                            ? "min-h-[92px] max-[480px]:min-h-0"
                            : "min-h-[113px] max-[480px]:min-h-0 max-[480px]:px-[13px] max-[480px]:py-3",
                        )}
                        key={`${card.title}-${line.lead}-${line.body}`}
                      >
                        {butter ? (
                          inlineLead(line.lead, line.body)
                        ) : (
                          <>
                            <strong className="mb-[5px] block text-[10px] font-[750] tracking-[0.05em] text-primary">
                              {line.lead}
                            </strong>
                            {line.body}
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                  {card.note === undefined ? null : (
                    <p className="mt-4 border-l-[3px] border-mark bg-pale px-[13px] py-2.5 text-xs leading-[1.5] text-foreground">
                      <strong className="font-bold text-primary">{card.note.lead}</strong>{" "}
                      {card.note.rest}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
