import { CategoriesHowItWorks } from "@/components/categories/categories-how-it-works";
import { As2HomeView } from "@/components/home/as2-home";
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
import { brand, brandIdOf, type BrandId } from "@/data/brand";
import { homePageCopy, homeTitle } from "@/data/pages/home";
import { alignSynchHomeAs2Copy, alignSynchHomeTitle } from "@/data/pages/home-alignsynch";
import { as2Home } from "@/lib/home-alignsynch";
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
 * The AlignSynch front page since #853: the approved AS2 redesign, eight bands and an in-page menu.
 *
 * The words are `data/pages/home-alignsynch.ts::alignSynchHomeAs2Copy`, the join is
 * `lib/home-alignsynch.ts::as2Home`, and `components/home/as2-home.tsx` draws it. Nothing is named
 * here — no template, no section, no count — which is why the page cannot claim a relationship type
 * the taxonomy does not hold or a number nobody re-measures.
 *
 * The fixture is read through the *projection*, not here, for two reasons `data:check` states: this
 * module is a page-copy entry module, so a literal written below counts against `/`'s budget of 0,
 * and a section lookup written in this file would be resolved against `/`'s declared fixture
 * (`data/pages/home`, the quiz branch) rather than this one — E23 reads the source, comments
 * included, so the lookup has to live where the right fixture does.
 *
 * The retired alignment composition (`components/home/alignment-home.tsx`, `lib/alignment-home.ts`)
 * is still in the tree and still tested; it renders no route since this card. Removing it is its own
 * change, tracked on the board, because it takes `components/home/template-shelf.tsx` and three test
 * files with it.
 */
function AlignSynchHome() {
  return <As2HomeView model={as2Home(brand, alignSynchHomeAs2Copy)} />;
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
 * `/`: their home is the brand's post-sign-in page — `AFTER_SIGN_IN_BY_BRAND` in
 * `lib/auth/paths.ts`, which `/login` and `/register` both navigate to: `/dashboard/user` on
 * QuizHub, `/dashboard` (this console's Overview) on AlignSynch (#351), because `/dashboard/user`
 * is QuizHub's account home and answers 404 on the alignment build. Splitting `/` by session would
 * have made the front door request-time to answer a chrome question that the group already
 * answers.
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
