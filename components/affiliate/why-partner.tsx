"use client";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { CheckCircle, Clock, DollarSign, Gift, LifeBuoy, TrendingUp } from "lucide-react";
import Image from "next/image";

export function WhyPartner() {
  const benefits = [
    {
      icon: <DollarSign className="h-6 w-6 text-green-600 dark:text-green-500" />,
      title: "High Commission Rates",
      description: "Earn up to 30% commission on all referred subscriptions, with lifetime tracking for recurring revenue.",
    },
    {
      icon: <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-500" />,
      title: "Strong Conversion Rates",
      description: "Our optimized landing pages and product quality ensure high conversion rates for your referrals.",
    },
    {
      icon: <Clock className="h-6 w-6 text-purple-600 dark:text-purple-500" />,
      title: "Fast Payouts",
      description: "Get paid reliably every month with low minimum thresholds and multiple payout options.",
    },
    {
      icon: <LifeBuoy className="h-6 w-6 text-indigo-600 dark:text-indigo-500" />,
      title: "Dedicated Support",
      description: "Access to a dedicated affiliate manager and priority support to help maximize your earnings.",
    },
    {
      icon: <Gift className="h-6 w-6 text-pink-600 dark:text-pink-500" />,
      title: "Exclusive Promotions",
      description: "Get access to special offers and promotional materials to boost your conversion rates.",
    },
    {
      icon: <CheckCircle className="h-6 w-6 text-teal-600 dark:text-teal-500" />,
      title: "Easy Integration",
      description: "Simple tracking links, API access, and ready-to-use marketing materials for seamless promotion.",
    },
  ];

  const testimonials = [
    {
      quote: "I've been part of many affiliate programs, but QuizHub 's stands out with its high commission rates and reliable tracking. I've earned over $5,000 monthly since joining.",
      author: "Sarah Johnson",
      role: "Educational Content Creator",
      image: "/avatars/sarah.webp",
    },
    {
      quote: "The conversion rates are incredible. The product sells itself, and the affiliate team provides amazing support whenever I need help optimizing my campaigns.",
      author: "Michael Chen",
      role: "Digital Marketing Specialist",
      image: "/avatars/alex.png",
    },
  ];

  return (
    <section className="py-10 xl:py-20 sm:px-4 xl:px-8 bg-white dark:bg-slate-900">
      <div className="container px-4 mx-auto">
        <div className="text-center mb-16">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} viewport={{ once: true }}>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Partner With Us?</h2>
            <div className="w-24 h-1 bg-gradient-to-r from-green-600 to-teal-600 mx-auto mb-6"></div>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">Join thousands of successful affiliates who are earning substantial income by promoting QuizHub </p>
          </motion.div>
        </div>

        {/* Benefits Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {benefits.map((benefit, index) => (
            <motion.div key={index} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: index * 0.1 }} viewport={{ once: true }}>
              <Card className="h-full border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow duration-300">
                <CardContent className="p-6 xl:pt-6">
                  <div className="rounded-full bg-slate-100 dark:bg-slate-800 p-3 w-14 h-14 flex items-center justify-center mb-4">{benefit.icon}</div>
                  <h3 className="text-xl font-bold mb-2">{benefit.title}</h3>
                  <p className="text-slate-600 dark:text-slate-400">{benefit.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Success Stories */}
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} viewport={{ once: true }}>
          <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-2xl p-4 md:p-8 xl:p-12">
            <h3 className="text-2xl font-bold mb-8 text-center">Success Stories</h3>

            <div className="grid md:grid-cols-2 gap-8">
              {testimonials.map((testimonial, index) => (
                <div key={index} className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full overflow-hidden">
                      <Image width={48} height={48} src={testimonial.image || "/placeholder.svg"} alt={testimonial.author} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="font-semibold">{testimonial.author}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{testimonial.role}</p>
                    </div>
                  </div>
                  <p className="italic text-slate-600 dark:text-slate-400">"{testimonial.quote}"</p>
                </div>
              ))}
            </div>

            <div className="mt-10 text-center">
              <div className="inline-flex items-center gap-2 bg-slate-900 dark:bg-slate-800 text-white px-6 py-3 rounded-full font-medium">
                <span>Join our successful partners today</span>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Comparison */}
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} viewport={{ once: true }} className="mt-16">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="p-6 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-xl font-bold">How We Compare</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800">
                    <th className="text-left p-4 font-medium">Feature</th>
                    <th className="text-center p-4 font-medium">QuizHub Affiliate</th>
                    <th className="text-center p-4 font-medium">Other Programs</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-200 dark:border-slate-700">
                    <td className="p-4 text-slate-600 dark:text-slate-400">Commission Rate</td>
                    <td className="p-4 text-center font-medium">Up to 30%</td>
                    <td className="p-4 text-center text-slate-600 dark:text-slate-400">10-20%</td>
                  </tr>
                  <tr className="border-t border-slate-200 dark:border-slate-700">
                    <td className="p-4 text-slate-600 dark:text-slate-400">Cookie Duration</td>
                    <td className="p-4 text-center font-medium">90 days</td>
                    <td className="p-4 text-center text-slate-600 dark:text-slate-400">30 days</td>
                  </tr>
                  <tr className="border-t border-slate-200 dark:border-slate-700">
                    <td className="p-4 text-slate-600 dark:text-slate-400">Minimum Payout</td>
                    <td className="p-4 text-center font-medium">$50</td>
                    <td className="p-4 text-center text-slate-600 dark:text-slate-400">$100</td>
                  </tr>
                  <tr className="border-t border-slate-200 dark:border-slate-700">
                    <td className="p-4 text-slate-600 dark:text-slate-400">Dedicated Support</td>
                    <td className="p-4 text-center font-medium">
                      <svg className="w-6 h-6 mx-auto text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </td>
                    <td className="p-4 text-center text-slate-600 dark:text-slate-400">
                      <svg className="w-6 h-6 mx-auto text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </td>
                  </tr>
                  <tr className="border-t border-slate-200 dark:border-slate-700">
                    <td className="p-4 text-slate-600 dark:text-slate-400">Marketing Materials</td>
                    <td className="p-4 text-center font-medium">
                      <svg className="w-6 h-6 mx-auto text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </td>
                    <td className="p-4 text-center text-slate-600 dark:text-slate-400">Limited</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
