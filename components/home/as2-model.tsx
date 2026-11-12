// template-ancestor: components/home/alignment-home.tsx   (variation: the model band — the Bread and the Butter as two photographed cards with a line grid and a scale panel, instead of the two-question compare grid)

import { SectionHead } from "@/components/home/as2-parts";
import type { As2HomeModel } from "@/lib/home-alignsynch";
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
 * **The Butter card's lines carry the emphasised word above its sentence**, where the approved page
 * runs them inline ("Actually, you **FEEL** it is only slightly different."). That is a deliberate
 * deviation and the only one in this band: the Bread card already teaches FEEL/WISH/THINK/GUESS as
 * a word over a sentence, so making the Butter card's four lines match it is more consistent than
 * the inline run-on was — and it keeps the emphasis out of the copy fixture, where a `**bold**`
 * convention would be markup living in a data file.
 *
 * The scale is `.home-scale-track` from `app/globals.css`: a gradient cannot be written here, and
 * its three stops are brand roles, so the bar cannot describe a palette the record does not have.
 */
export function As2Model({ band }: { band: As2HomeModel["model"] }): React.ReactElement {
  return (
    <section className="bg-mist py-14 md:py-[5.375rem]" data-home-anchor id="questions">
      <div className="marketing-container">
        <SectionHead head={band} />
        <div className="grid grid-cols-1 items-stretch gap-[18px] md:grid-cols-2 md:gap-6">
          {band.cards.map((card) => (
            <article
              className="min-w-0 overflow-hidden rounded-lg border border-line bg-background"
              key={card.title}
            >
              <div className="relative h-[175px] overflow-hidden bg-sand sm:h-[210px] md:h-[190px]">
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
                <span className="absolute left-[17px] top-4 z-[1] inline-flex items-center gap-2 rounded-[3px] border border-white/70 bg-paper py-1.5 pl-1.5 pr-2.5 text-[10px] font-bold text-foreground">
                  <b className="grid size-[22px] place-items-center rounded-[2px] bg-deep text-[11px] font-bold text-white">
                    {card.step}
                  </b>
                  {card.stepLabel}
                </span>
              </div>
              <div className="p-5 md:p-6">
                <p className="mb-[7px] text-[11px] font-bold text-deep">{card.kicker}</p>
                <h3 className="mb-[7px] text-[clamp(22px,2.5vw,29px)] font-bold leading-[1.14] tracking-[-0.025em] text-primary">
                  {card.title}
                </h3>
                <p className="text-[13px] leading-[1.55] text-muted-foreground">{card.deck}</p>
                <ul
                  aria-label={card.listName}
                  className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2"
                >
                  {card.lines.map((line) => (
                    <li
                      className="min-h-[92px] rounded-[3px] border border-line/70 bg-paper px-3.5 py-3 text-xs leading-[1.55] text-foreground"
                      key={`${card.title}-${line.lead}-${line.body}`}
                    >
                      <strong className="mb-1 block text-[10px] font-bold tracking-[0.05em] text-primary">
                        {line.lead}
                      </strong>
                      {line.body}
                    </li>
                  ))}
                </ul>
                {card.note === undefined ? null : (
                  <p className="mt-4 border-l-[3px] border-mark bg-pale px-3.5 py-2.5 text-xs leading-[1.5] text-foreground">
                    <strong className="font-bold text-primary">{card.note.lead}</strong>{" "}
                    {card.note.rest}
                  </p>
                )}
                {card.scale === undefined ? null : (
                  <div
                    aria-label={card.scale.name}
                    className="mb-4 mt-5 rounded-[3px] border border-line bg-pale px-4 pb-3 pt-4"
                    role="img"
                  >
                    <div className="flex justify-between text-[10px] font-extrabold tracking-[0.13em] text-primary">
                      <span>{card.scale.yes}</span>
                      <span>{card.scale.no}</span>
                    </div>
                    <div className="home-scale-track relative mx-2 my-3 h-[3px] rounded-full">
                      <span className="absolute -left-1.5 top-1/2 size-[13px] -translate-y-1/2 rounded-full border-[3px] border-white bg-primary ring-1 ring-slate-400" />
                      <span className="absolute -right-1.5 top-1/2 size-[13px] -translate-y-1/2 rounded-full border-[3px] border-white bg-deep ring-1 ring-slate-400" />
                      <span className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-mark ring-4 ring-mark/20" />
                    </div>
                    <p className="text-center text-xs font-extrabold text-deep">
                      {card.scale.middle}
                    </p>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
