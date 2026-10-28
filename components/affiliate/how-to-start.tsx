"use client";

import { Button } from "@/components/ui/button";
import { BarChart, DollarSign, Link, UserPlus, Users } from "lucide-react";

export function HowToStart() {
  const steps = [
    {
      icon: <UserPlus className="h-6 w-6 text-primary" />,
      title: "Sign Up",
      description: "Create your free affiliate account in less than 2 minutes with just a few simple steps.",
      color: "border-l-primary",
    },
    {
      icon: <Link className="h-6 w-6 text-indigo-500" />,
      title: "Share Your Link",
      description: "Get your unique referral link and share it with your audience through social media, email, or your website.",
      color: "border-l-indigo-500",
    },
    {
      icon: <Users className="h-6 w-6 text-violet-500" />,
      title: "Refer Users",
      description: "Your audience signs up using your unique referral link. We track all referrals automatically.",
      color: "border-l-violet-500",
    },
    {
      icon: <DollarSign className="h-6 w-6 text-emerald-500" />,
      title: "Earn Commission",
      description: "Earn up to 30% commission on all referred user subscriptions for the lifetime of their account.",
      color: "border-l-emerald-500",
    },
    {
      icon: <BarChart className="h-6 w-6 text-amber-500" />,
      title: "Track Performance",
      description: "Monitor your earnings and optimize your strategy with our comprehensive analytics dashboard.",
      color: "border-l-amber-500",
    },
  ];

  return (
    <section className="py-10 md:py-16 bg-white dark:bg-slate-900">
      <div className="container px-4 mx-auto">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">How to Start Earning</h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">Getting started with our affiliate program is simple. Follow these steps and start earning passive income by sharing QuizHub with your audience.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {steps.map((step, index) => (
            <div key={index} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-all hover:shadow-md">
              <div className={`border-l-4 ${step.color} h-full flex flex-col`}>
                <div className="p-6 flex-1">
                  <div className="bg-slate-100 dark:bg-slate-700 rounded-full w-12 h-12 flex items-center justify-center mb-4">{step.icon}</div>
                  <div className="flex items-center mb-3">
                    <span className="text-slate-400 dark:text-slate-500 text-sm font-medium mr-2">STEP {index + 1}</span>
                  </div>
                  <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                  <p className="text-slate-600 dark:text-slate-400">{step.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Button size="lg" className="px-8">
            Become an Affiliate
          </Button>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            Already an affiliate?{" "}
            <Link href="#" className="text-primary hover:underline">
              Sign in to your dashboard
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
