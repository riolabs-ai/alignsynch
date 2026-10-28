import { Button } from "@/components/ui/button";
import { ArrowRight, Check } from "lucide-react";

export function PricingCta() {
  return (
    <section className="py-20">
      <div className="container px-4 mx-auto">
        <div className="max-w-4xl mx-auto bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl overflow-hidden shadow-xl">
          <div className="grid md:grid-cols-2">
            <div className="p-8 md:p-12">
              <h2 className="text-3xl font-bold text-white mb-4">Ready to create amazing quizzes?</h2>
              <p className="text-purple-100 mb-6">Join thousands of educators, content creators, and businesses who are engaging their audience with interactive quizzes.</p>

              <ul className="space-y-3 mb-8">
                {["No credit card required to start", "14-day free trial on all paid plans", "Cancel anytime, no questions asked", "Dedicated support to help you succeed"].map((item, i) => (
                  <li key={i} className="flex items-center text-white">
                    <Check className="h-5 w-5 mr-2 text-purple-200" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="bg-white text-purple-600 hover:bg-purple-50 border-0">
                  Get Started Free
                </Button>
                <Button size="lg" variant="outline" className="border-white  hover:bg-white/10">
                  View Demo <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="hidden md:block relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 backdrop-blur-sm"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3/4 aspect-square rounded-full bg-gradient-to-br from-indigo-400/30 to-purple-400/30 backdrop-blur-md flex items-center justify-center">
                  <div className="w-2/3 aspect-square rounded-full bg-gradient-to-br from-indigo-300/40 to-purple-300/40 backdrop-blur-md flex items-center justify-center">
                    <div className="w-1/2 aspect-square rounded-full bg-white/30 backdrop-blur-md"></div>
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
