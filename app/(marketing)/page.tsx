import { CategoriesHowItWorks } from "@/components/categories/categories-how-it-works";
import { AlignmentHomeView } from "@/components/home/alignment-home";
import { CategoriesSlider } from "@/components/home/categories-slider";
import { FeaturedQuizzes } from "@/components/home/featured-quizzes";
import { HeroSection } from "@/components/home/hero-section";
import { LatestQuizzes } from "@/components/home/latest-quizzes";
import { LiveWinners } from "@/components/home/live-winners";
import { NewsletterSection } from "@/components/home/newsletter-section";
import { PlayerTestimonials } from "@/components/home/player-testimonials";
import { QuizzesByDifficulty } from "@/components/home/quizzes-by-difficulty";
import { ResourcesAndReferral } from "@/components/home/resources-and-referral";
import { TopPlayersCarousel } from "@/components/home/top-players-carousel";
import type { Brand } from "@/content/brand";
import { assessmentInstances, assessments } from "@/data/assessments";
import { brand, brandIdOf, type BrandId } from "@/data/brand";
import { homePageCopy, homeTitle } from "@/data/pages/home";
import {
  ALIGN_SYNCH_FEATURED_SLUG,
  alignSynchHomeCopy,
  alignSynchHomeTitle,
} from "@/data/pages/home-alignsynch";
import { alignmentHome } from "@/lib/alignment-home";
import { hiddenNavHrefs } from "@/lib/flags";
import { sectionOf, withoutHiddenCta } from "@/lib/page-copy";
import { winFeed } from "@/lib/win-feed";
import "swiper/swiper-bundle.css";
import type { Metadata } from "next";

/**
 * Which brand this build is, once — the same value `metadata` and the page body branch on, so
 * the tab title and the bands cannot disagree about which product is live.
 */
const brandId = brandIdOf(brand);

/**
 * The `/` document title, chosen by composition.
 *
 * Each front page names the product itself, so it uses `absolute`: the root layout's
 * `%s · <brand>` template would otherwise print the name twice. Each brings its own tagline —
 * the quiz template's "Play, Share, Earn" and the alignment page's two questions — and both are
 * functions of the brand record, so neither the product name nor a tagline is spelled here.
 */
function homeTitleFor(id: BrandId, record: Brand): string {
  switch (id) {
    case "quizhub":
      return homeTitle(record);
    case "alignsynch":
      return alignSynchHomeTitle(record);
  }
}

export const metadata: Metadata = {
  title: { absolute: homeTitleFor(brandId, brand) },
};

/**
 * The quiz product's front page: twelve bands, unchanged.
 *
 * Every band's words come from `data/pages/home.ts`, resolved here and passed down — no
 * component holds its own copy (E23), and editing the fixture changes `/` with no `.tsx` edit.
 * A named function rather than the page body, because the page body is now a choice: this is
 * what `BRAND=quizhub` renders, and its markup is what `fa82b03` rendered.
 *
 * `hiddenNav` is the shell's list of gated hrefs, resolved once in `Home` on the server
 * (#175 follow-up). It filters exactly one thing: the `top-players` band's "View Full
 * Leaderboard" CTA, which pointed at a surface that answers 404 while `community.leaderboard`
 * is off. `TopPlayersCarousel` is a client component, so the section arrives already filtered
 * (`withoutHiddenCta`) rather than the flag being read beside it; the fixture keeps its row, so
 * a build with the flag on renders the same markup it always did.
 */
function QuizHubHome({ hiddenNav }: { hiddenNav: readonly string[] }) {
  return (
    <div className="space-y-4 xl:space-y-8 pb-8">
      <HeroSection copy={homePageCopy} />
      <CategoriesSlider copy={sectionOf(homePageCopy, "categories")} />
      <LatestQuizzes copy={sectionOf(homePageCopy, "latest-quizzes")} />
      <FeaturedQuizzes copy={sectionOf(homePageCopy, "featured-quizzes")} />
      <TopPlayersCarousel
        copy={withoutHiddenCta(sectionOf(homePageCopy, "top-players"), hiddenNav)}
      />
      <QuizzesByDifficulty copy={sectionOf(homePageCopy, "by-difficulty")} />
      <LiveWinners copy={sectionOf(homePageCopy, "live-winners")} wins={winFeed(8)} />
      <CategoriesHowItWorks copy={sectionOf(homePageCopy, "how-it-works")} />
      <PlayerTestimonials copy={sectionOf(homePageCopy, "success-stories")} />
      <ResourcesAndReferral
        referral={sectionOf(homePageCopy, "refer-earn")}
        tips={sectionOf(homePageCopy, "creator-tips")}
      />
      <NewsletterSection copy={sectionOf(homePageCopy, "newsletter")} />
    </div>
  );
}

/**
 * The AlignSynch front page: the two questions, the four templates, the two families.
 *
 * The records are `data/assessments.ts` and the words are `data/pages/home-alignsynch.ts`;
 * `lib/alignment-home.ts` is the join and `components/home/alignment-home.tsx` draws it. No
 * template, relationship or family is named here — which is why the page cannot claim a fifth
 * template or a response the fixtures do not hold.
 */
function AlignSynchHome() {
  return (
    <div className="space-y-4 xl:space-y-8 pb-8">
      <AlignmentHomeView
        model={alignmentHome(
          brand,
          alignSynchHomeCopy,
          assessments,
          assessmentInstances,
          ALIGN_SYNCH_FEATURED_SLUG,
        )}
      />
    </div>
  );
}

/**
 * The home route — and the one place `BRAND` changes the product *surface*, not only the paint.
 *
 * **`/` is a marketing page, for everyone (#317, option (a)).** This module lives in
 * `app/(marketing)/`, so it inherits that group's header and footer and never the product shell:
 * no `<aside>`, no search palette, no drawers, no account menu. The group is the mechanism — there
 * is no `if (signedIn)` here — which is what keeps the shell's client components out of the front
 * door's bundle.
 *
 * Option (a) was chosen over (b), and the reason is that a signed-in person does not need a second
 * `/`: their home is `/dashboard/user`, which is where the sign-in flow already lands them
 * (`lib/auth/paths.ts`'s `AFTER_SIGN_IN`, which `register-view.tsx` pushes explicitly).
 * Splitting `/` by session would have made the front door request-time to answer a chrome
 * question that the group already answers.
 *
 * The shell's footer is no longer mounted by the page: the group's footer is the chrome now, and
 * two footers on one page was the old arrangement's accident, not a design.
 *
 * A `switch` over the brand id rather than a lookup or a boolean, for the reason `resolveBrand`
 * gives: `BrandId` is a closed union and both branches return, so a brand added without a front
 * page is a compile error instead of a template inherited by accident, and neither composition
 * can be edited into the other by a skin.
 *
 * `hiddenNav` is resolved here, on the server, once per request (#175 follow-up): `hiddenNavHrefs()`
 * returns the hrefs whose surface is gated off, and the quiz branch hands the list to the one place
 * its front page advertises one — the `top-players` CTA. Neither client component can ask the flag
 * itself.
 */
export default function Home() {
  const hiddenNav = hiddenNavHrefs();
  switch (brandId) {
    case "quizhub":
      return <QuizHubHome hiddenNav={hiddenNav} />;
    case "alignsynch":
      return <AlignSynchHome />;
  }
}
