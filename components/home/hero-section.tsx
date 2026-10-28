import { Button } from "@/components/ui/button";
import Link from "next/link";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden rounded-xl bg-[url('/hero-bg.jpg')] bg-no-repeat bg-cover p-6 text-white md:p-10 xl:py-14">
      <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <div className="max-w-lg space-y-4">
          <h2 className="text-3xl font-bold xl:leading-tight tracking-tight md:text-4xl xl:text-5xl">
            Your Quiz Adventure Starts Here: <br /> Play, Share, Earn!
          </h2>
          <p className="text-lg text-white/80">Build engaging quizzes, challenge others, and earn rewards for your knowledge.</p>
          <div className="flex flex-wrap gap-4">
            <Button size="lg" asChild className="bg-white duration-300 text-indigo-600 hover:bg-white/90">
              <Link href="/create/editor">Create Quiz</Link>
            </Button>
            <Button size="lg" className="bg-indigo-600 text-white duration-300 hover:bg-indigo-700" asChild>
              <Link href="/battle">Join Contest</Link>
            </Button>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-16 -right-16 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl"></div>
      <div className="absolute -left-16 -top-16 h-64 w-64 rounded-full bg-purple-400/20 blur-3xl"></div>
    </section>
  );
}
