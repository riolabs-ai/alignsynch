import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function AffiliateCta() {
  return (
    <section className="py-20 bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
      <div className="container px-4 mx-auto">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Start Earning?</h2>
          <p className="text-lg text-purple-100 mb-8 max-w-2xl mx-auto">Join thousands of successful affiliates who are earning passive income by sharing QuizHub with their audience. It only takes 2 minutes to get started.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-white text-purple-600 hover:bg-purple-50 border-0 shadow-lg hover:shadow-xl transition-all duration-200">
              Join Now
            </Button>
            <Button variant="outline" size="lg" className="border-white text-white hover:bg-white/10 hover:text-white">
              Learn More <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <p className="mt-8 text-sm text-purple-200">
            Have questions? Contact our affiliate team at{" "}
            <a href="mailto:affiliates@quizhub.com" className="underline hover:text-white">
              affiliates@quizhub.com
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
