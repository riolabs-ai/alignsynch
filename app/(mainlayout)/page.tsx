import { CategoriesHowItWorks } from "@/components/categories/categories-how-it-works";
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
import { Footer } from "@/components/layout/footer";
import { homePageCopy } from "@/data/pages/home";
import { shellPageCopy } from "@/data/pages/shell";
import { sectionOf } from "@/lib/page-copy";
import { winFeed } from "@/lib/win-feed";
import "swiper/swiper-bundle.css";

/**
 * The home route. Every band's words come from `data/pages/home.ts`, resolved here
 * and passed down — no component holds its own copy (E23), and editing the fixture
 * changes `/` with no `.tsx` edit.
 */
export default function Home() {
  return (
    <div className="space-y-4 xl:space-y-8 pb-8">
      <HeroSection copy={homePageCopy} />
      <CategoriesSlider copy={sectionOf(homePageCopy, "categories")} />
      <LatestQuizzes copy={sectionOf(homePageCopy, "latest-quizzes")} />
      <FeaturedQuizzes copy={sectionOf(homePageCopy, "featured-quizzes")} />
      <TopPlayersCarousel copy={sectionOf(homePageCopy, "top-players")} />
      <QuizzesByDifficulty copy={sectionOf(homePageCopy, "by-difficulty")} />
      <LiveWinners copy={sectionOf(homePageCopy, "live-winners")} wins={winFeed(8)} />
      <CategoriesHowItWorks copy={sectionOf(homePageCopy, "how-it-works")} />
      <PlayerTestimonials copy={sectionOf(homePageCopy, "success-stories")} />
      <ResourcesAndReferral
        referral={sectionOf(homePageCopy, "refer-earn")}
        tips={sectionOf(homePageCopy, "creator-tips")}
      />
      <NewsletterSection copy={sectionOf(homePageCopy, "newsletter")} />
      <Footer copy={shellPageCopy} />
    </div>
  );
}
