"use client";

import { Footer } from "@/components/layout/footer";
import { useState } from "react";
import { FeaturedTournament } from "./featured-tournament";
import { TournamentCategories } from "./tournament-categories";
import { TournamentCta } from "./tournament-cta";
import { TournamentFilters } from "./tournament-filters";
import { TournamentHowItWorks } from "./tournament-how-it-works";
import { TournamentList } from "./tournament-list";
import { TournamentTestimonials } from "./tournament-testimonials";

export function TournamentPage() {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");

  return (
    <>
      <div className="container mx-auto">
        <h1 className="text-3xl font-bold mb-2">Quiz Tournaments</h1>
        <p className="text-muted-foreground mb-8">Compete against other quiz enthusiasts and win amazing prizes</p>

        <FeaturedTournament />

        <div className="mt-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
            <h2 className="text-2xl font-bold">All Tournaments</h2>
            <TournamentFilters activeFilter={activeFilter} setActiveFilter={setActiveFilter} />
          </div>

          <TournamentCategories activeCategory={activeCategory} setActiveCategory={setActiveCategory} />

          <TournamentList activeCategory={activeCategory} activeFilter={activeFilter} />
        </div>

        {/* Call to Action section */}
        <TournamentCta />

        {/* How It Works section */}
        <TournamentHowItWorks />

        {/* Testimonials section */}
        <TournamentTestimonials />
      </div>

      {/* Add the Footer */}
      <Footer />
    </>
  );
}
