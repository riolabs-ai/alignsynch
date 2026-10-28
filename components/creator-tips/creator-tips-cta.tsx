import { Button } from "@/components/ui/button";
import { ArrowRight, Lightbulb, Sparkles, Target } from "lucide-react";
import Link from "next/link";

export default function CreatorTipsCta() {
  return (
    <section className="my-20">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-600 to-indigo-600 shadow-xl">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-white/10 blur-2xl"></div>
          <div className="absolute top-1/2 -left-24 w-72 h-72 rounded-full bg-white/10 blur-3xl"></div>
          <div className="absolute -bottom-12 right-1/3 w-36 h-36 rounded-full bg-white/10 blur-2xl"></div>
        </div>

        <div className="relative grid md:grid-cols-2 gap-8 p-8 md:p-12 items-center">
          <div className="space-y-6">
            <div className="inline-block rounded-lg bg-white/10 backdrop-blur-sm px-4 py-2 text-white font-medium text-sm">Ready to apply what you've learned?</div>

            <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight">
              Create your own engaging quiz <span className="text-purple-200">today!</span>
            </h2>

            <p className="text-purple-100 text-lg max-w-md">Put these tips into practice and start creating quizzes that engage your audience and showcase your expertise.</p>

            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-1">
                  <div className="p-1.5 rounded-full bg-white/20">
                    <Sparkles className="h-4 w-4 text-purple-100" />
                  </div>
                </div>
                <p className="text-purple-100">Create interactive quizzes with multiple question types</p>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-1">
                  <div className="p-1.5 rounded-full bg-white/20">
                    <Target className="h-4 w-4 text-purple-100" />
                  </div>
                </div>
                <p className="text-purple-100">Reach your target audience and grow your community</p>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-1">
                  <div className="p-1.5 rounded-full bg-white/20">
                    <Lightbulb className="h-4 w-4 text-purple-100" />
                  </div>
                </div>
                <p className="text-purple-100">Monetize your knowledge and earn rewards</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 pt-2">
              <Button asChild size="lg" className="bg-white text-purple-600 hover:bg-purple-50">
                <Link href="/create/editor">
                  Create a Quiz <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>

              <Button asChild size="lg" variant="outline">
                <Link href="/explore">Explore Examples</Link>
              </Button>
            </div>
          </div>

          <div className="hidden md:block relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-64 h-64 rounded-full bg-white/5 backdrop-blur-sm flex items-center justify-center animate-pulse-slow">
                <div className="w-48 h-48 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                  <div className="w-32 h-32 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-white/30 backdrop-blur-sm"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-10 transform rotate-6 hover:rotate-0 transition-transform duration-300">
              <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-6 border border-purple-100/20">
                <div className="space-y-4">
                  <div className="h-4 w-3/4 rounded bg-purple-200"></div>
                  <div className="space-y-2">
                    <div className="h-3 w-full rounded bg-purple-100"></div>
                    <div className="h-3 w-5/6 rounded bg-purple-100"></div>
                    <div className="h-3 w-4/6 rounded bg-purple-100"></div>
                  </div>
                  <div className="flex space-x-2">
                    <div className="h-8 w-8 rounded-full bg-purple-300"></div>
                    <div className="h-8 w-8 rounded-full bg-indigo-300"></div>
                    <div className="h-8 w-8 rounded-full bg-pink-300"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute bottom-8 right-8 transform -rotate-3 hover:rotate-0 transition-transform duration-300">
              <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-4 border border-purple-100/20">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                    <span className="text-green-600 text-xs font-bold">+1</span>
                  </div>
                  <div className="space-y-1">
                    <div className="h-3 w-24 rounded bg-purple-100"></div>
                    <div className="h-2 w-16 rounded bg-purple-50"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
