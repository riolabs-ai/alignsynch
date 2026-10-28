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
import "swiper/swiper-bundle.css";

export default function Home() {
  return (
    <div className="space-y-4 xl:space-y-8 pb-8">
      <HeroSection />
      <CategoriesSlider />
      <LatestQuizzes />
      <FeaturedQuizzes />
      <TopPlayersCarousel />
      <QuizzesByDifficulty />
      <LiveWinners />
      <CategoriesHowItWorks />
      <PlayerTestimonials />
      <ResourcesAndReferral />
      <NewsletterSection />
      <Footer />
    </div>
  );
}
