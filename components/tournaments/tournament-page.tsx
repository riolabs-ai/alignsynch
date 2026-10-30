"use client";

import { Footer } from "@/components/layout/footer";
import type { PageCopy } from "@/content/pages";
import { sectionOf } from "@/lib/page-copy";
import { useState } from "react";
import { FeaturedTournament } from "./featured-tournament";
import { TournamentCategories } from "./tournament-categories";
import { TournamentCta } from "./tournament-cta";
import { TournamentFilters } from "./tournament-filters";
import { TournamentHowItWorks } from "./tournament-how-it-works";
import { TournamentList } from "./tournament-list";
import { TournamentTestimonials } from "./tournament-testimonials";

/**
 * `/tournaments`'s body. The route module hands it the fixture; this resolves one
 * section per band and passes it down, so a band's words are never typed here (E23).
 * The catalogue band (`all-tournaments`) is one section shared by the filter row, the
 * category chips and the list — they are one band, and three components reading one
 * section beats three sections whose order the fixture cannot express.
 *
 * `shellCopy` is the shell fixture (`data/pages/shell.ts`), not this page's own copy:
 * the tournaments page renders the footer itself, and the footer's words belong to the
 * chrome. WU-11 adds the page copy as its own prop and hands it to the bands above.
 */
export function TournamentPage({
  copy,
  shellCopy,
  hiddenNav,
}: {
  copy: PageCopy;
  shellCopy: PageCopy;
  /**
   * The gated hrefs the shell must not draw (#175 follow-up) — forwarded to the footer, which is
   * client-bundled through this `"use client"` module and so cannot resolve the flag itself.
   */
  hiddenNav: readonly string[];
}) {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const catalogue = sectionOf(copy, "all-tournaments");

  return (
    <>
      <div className="container mx-auto">
        <h1 className="text-3xl font-bold mb-2">{copy.heading}</h1>
        <p className="text-muted-foreground mb-8">{copy.subtitle}</p>

        <FeaturedTournament copy={sectionOf(copy, "featured")} />

        <div className="mt-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
            <h2 className="text-2xl font-bold">{catalogue.heading}</h2>
            <TournamentFilters
              activeFilter={activeFilter}
              setActiveFilter={setActiveFilter}
              copy={catalogue}
            />
          </div>

          <TournamentCategories
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            copy={catalogue}
          />

          <TournamentList
            activeCategory={activeCategory}
            activeFilter={activeFilter}
            copy={catalogue}
          />
        </div>

        {/* Call to Action section */}
        <TournamentCta copy={sectionOf(copy, "call-to-action")} />

        {/* How It Works section */}
        <TournamentHowItWorks copy={sectionOf(copy, "how-it-works")} />

        {/* Testimonials section */}
        <TournamentTestimonials copy={sectionOf(copy, "testimonials")} />
      </div>

      {/* Add the Footer */}
      <Footer copy={shellCopy} hiddenNav={hiddenNav} />
    </>
  );
}
