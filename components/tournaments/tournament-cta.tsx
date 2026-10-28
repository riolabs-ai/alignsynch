import { Button } from "@/components/ui/button";
import { ArrowRight, Award, Trophy, Users } from "lucide-react";
import Link from "next/link";

export function TournamentCta() {
  return (
    <section className="my-10 xl:my-20">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 to-purple-600 shadow-xl">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-white/10 blur-2xl"></div>
          <div className="absolute top-1/2 -left-24 w-72 h-72 rounded-full bg-white/10 blur-3xl"></div>
          <div className="absolute -bottom-12 right-1/3 w-36 h-36 rounded-full bg-white/10 blur-2xl"></div>
        </div>

        <div className="relative grid md:grid-cols-2 gap-8 p-8 md:p-12 items-center">
          <div className="space-y-6">
            <div className="inline-block rounded-lg bg-white/10 backdrop-blur-sm px-4 py-2 text-white font-medium text-sm">Ready for the challenge?</div>

            <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight">
              Join the ultimate <span className="text-yellow-200">quiz competition!</span>
            </h2>

            <p className="text-indigo-100 text-lg max-w-md">Compete with players from around the world, showcase your knowledge, and win amazing prizes in our tournaments.</p>

            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-1">
                  <div className="p-1.5 rounded-full bg-white/20">
                    <Trophy className="h-4 w-4 text-yellow-200" />
                  </div>
                </div>
                <p className="text-indigo-100">Win exclusive prizes and climb the global leaderboard</p>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-1">
                  <div className="p-1.5 rounded-full bg-white/20">
                    <Users className="h-4 w-4 text-yellow-200" />
                  </div>
                </div>
                <p className="text-indigo-100">Connect with a community of quiz enthusiasts</p>
              </div>

              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-1">
                  <div className="p-1.5 rounded-full bg-white/20">
                    <Award className="h-4 w-4 text-yellow-200" />
                  </div>
                </div>
                <p className="text-indigo-100">Earn special badges and achievements</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 pt-2">
              <Button asChild size="lg" className="bg-white text-indigo-600 hover:bg-indigo-50">
                <Link href="/tournaments/register">
                  Register Now <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>

              <Button asChild size="lg" variant={"secondary"}>
                <Link href="/tournaments/create">Host a Tournament</Link>
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

            {/* Trophy illustration */}
            <div className="relative z-10">
              <div className="relative mx-auto w-40 h-40">
                {/* Trophy cup */}
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-24 h-24 bg-yellow-300 rounded-t-full">
                  <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-20 h-20 bg-yellow-400 rounded-t-full">
                    <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-16 h-16 bg-gradient-to-b from-yellow-200 to-yellow-400 rounded-t-full"></div>
                  </div>
                </div>

                {/* Trophy handles */}
                <div className="absolute top-8 left-1/2 transform -translate-x-1/2 -ml-16 w-8 h-12 border-4 border-yellow-300 rounded-full"></div>
                <div className="absolute top-8 left-1/2 transform -translate-x-1/2 ml-8 w-8 h-12 border-4 border-yellow-300 rounded-full"></div>

                {/* Trophy stem */}
                <div className="absolute top-24 left-1/2 transform -translate-x-1/2 w-6 h-12 bg-yellow-300"></div>

                {/* Trophy base */}
                <div className="absolute top-36 left-1/2 transform -translate-x-1/2 w-20 h-4 bg-yellow-400 rounded"></div>
                <div className="absolute top-40 left-1/2 transform -translate-x-1/2 w-24 h-4 bg-yellow-300 rounded"></div>

                {/* Sparkles */}
                <div className="absolute top-0 left-0 w-4 h-4 bg-white rounded-full animate-ping-slow opacity-75"></div>
                <div className="absolute top-8 right-0 w-3 h-3 bg-white rounded-full animate-ping-slow opacity-75 animation-delay-300"></div>
                <div className="absolute bottom-0 left-8 w-2 h-2 bg-white rounded-full animate-ping-slow opacity-75 animation-delay-700"></div>
              </div>

              {/* Podium */}
              <div className="relative mx-auto mt-8 flex items-end justify-center space-x-2">
                <div className="w-16 h-16 bg-indigo-300 rounded-t-md flex items-center justify-center text-indigo-800 font-bold text-lg">2</div>
                <div className="w-16 h-24 bg-yellow-300 rounded-t-md flex items-center justify-center text-yellow-800 font-bold text-lg">1</div>
                <div className="w-16 h-12 bg-purple-300 rounded-t-md flex items-center justify-center text-purple-800 font-bold text-lg">3</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
