"use client";
// template-ancestor: components/ui/card.tsx   (variation: the reasons band as a card grid over the brand record, each card an icon, a claim and one line)

import { Card, CardContent } from "@/components/ui/card";
import { GeneratedAvatar } from "@/components/media/generated-avatar";
import {
  formatMetricValue,
  formatPercentRange,
  formatPercentValue,
  formatWholeCurrency,
} from "@/content/metrics";
import type { PageCopySection } from "@/content/pages";
import { brand } from "@/data/brand";
import { metric } from "@/data/metrics";
import { fillLabel, itemLabel, itemValue } from "@/lib/page-copy";
import { motion } from "framer-motion";
import { CheckCircle, Clock, DollarSign, Gift, LifeBuoy, TrendingUp } from "lucide-react";

/** Which benefit card renders where; the words are `itemLabel`/`itemValue` of the same id. */
const BENEFITS = [
  {
    id: "high-commission-rates",
    icon: <DollarSign className="h-6 w-6 text-green-600 dark:text-green-500" />,
  },
  {
    id: "strong-conversion-rates",
    icon: <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-500" />,
  },
  {
    id: "fast-payouts",
    icon: <Clock className="h-6 w-6 text-action" />,
  },
  {
    id: "dedicated-support",
    icon: <LifeBuoy className="h-6 w-6 text-action" />,
  },
  {
    id: "exclusive-promotions",
    icon: <Gift className="h-6 w-6 text-pink-600 dark:text-pink-500" />,
  },
  {
    id: "easy-integration",
    icon: <CheckCircle className="h-6 w-6 text-teal-600 dark:text-teal-500" />,
  },
] as const;

export function WhyPartner({ copy }: { copy: PageCopySection }) {
  const testimonials = [
    {
      quote: `I've been part of many affiliate programs, but ${brand.name}'s stands out with its high commission rates and reliable tracking. I've earned over $5,000 monthly since joining.`,
      author: "Sarah Johnson",
      role: "Educational Content Creator",
    },
    {
      quote:
        "The conversion rates are incredible. The product sells itself, and the affiliate team provides amazing support whenever I need help optimizing my campaigns.",
      author: "Michael Chen",
      role: "Digital Marketing Specialist",
    },
  ];

  return (
    <section className="py-10 xl:py-20 sm:px-4 xl:px-8 bg-white dark:bg-slate-900">
      <div className="container px-4 mx-auto">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{copy.heading}</h2>
            <div className="w-24 h-1 bg-action mx-auto mb-6"></div>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">
              {copy.body}
            </p>
          </motion.div>
        </div>

        {/* Benefits Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {BENEFITS.map((benefit, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="h-full border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow duration-300">
                <CardContent className="p-6 xl:pt-6">
                  <div className="rounded-full bg-slate-100 dark:bg-slate-800 p-3 w-14 h-14 flex items-center justify-center mb-4">
                    {benefit.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-2">{itemLabel(copy, benefit.id)}</h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    {itemValue(copy, benefit.id)}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Success Stories */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <div className="bg-muted rounded-2xl p-4 md:p-8 xl:p-12">
            <h3 className="text-2xl font-bold mb-8 text-center">
              {itemLabel(copy, "stories-heading")}
            </h3>

            <div className="grid md:grid-cols-2 gap-8">
              {testimonials.map((testimonial, index) => (
                <div
                  key={index}
                  className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <GeneratedAvatar
                      name={testimonial.author}
                      seed={testimonial.author}
                      size={48}
                    />
                    <div>
                      <p className="font-semibold">{testimonial.author}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {testimonial.role}
                      </p>
                    </div>
                  </div>
                  <p className="italic text-slate-600 dark:text-slate-400">"{testimonial.quote}"</p>
                </div>
              ))}
            </div>

            <div className="mt-10 text-center">
              <div className="inline-flex items-center gap-2 bg-slate-900 dark:bg-slate-800 text-white px-6 py-3 rounded-full font-medium">
                <span>{itemLabel(copy, "join-partners")}</span>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Comparison */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          viewport={{ once: true }}
          className="mt-16"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="p-6 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-xl font-bold">{itemLabel(copy, "compare-heading")}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800">
                    <th className="text-left p-4 font-medium">
                      {itemLabel(copy, "compare-feature-column")}
                    </th>
                    <th className="text-center p-4 font-medium">
                      {itemLabel(copy, "compare-quizhub-column")}
                    </th>
                    <th className="text-center p-4 font-medium">
                      {itemLabel(copy, "compare-others-column")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-200 dark:border-slate-700">
                    <td className="p-4 text-slate-600 dark:text-slate-400">
                      {itemLabel(copy, "row-commission-rate")}
                    </td>
                    <td className="p-4 text-center font-medium">
                      {fillLabel(itemLabel(copy, "row-commission-quizhub"), {
                        percent: formatPercentValue(metric("affiliate.maxCommission").value),
                      })}
                    </td>
                    <td className="p-4 text-center text-slate-600 dark:text-slate-400">
                      {formatPercentRange(
                        metric("affiliate.comparison.commissionMin").value,
                        metric("affiliate.comparison.commissionMax").value,
                      )}
                    </td>
                  </tr>
                  <tr className="border-t border-slate-200 dark:border-slate-700">
                    <td className="p-4 text-slate-600 dark:text-slate-400">
                      {itemLabel(copy, "row-cookie-duration")}
                    </td>
                    <td className="p-4 text-center font-medium">
                      {formatMetricValue(metric("affiliate.cookieDays"))}
                    </td>
                    <td className="p-4 text-center text-slate-600 dark:text-slate-400">
                      {formatMetricValue(metric("affiliate.comparison.cookieDays"))}
                    </td>
                  </tr>
                  <tr className="border-t border-slate-200 dark:border-slate-700">
                    <td className="p-4 text-slate-600 dark:text-slate-400">
                      {itemLabel(copy, "row-minimum-payout")}
                    </td>
                    <td className="p-4 text-center font-medium">
                      {formatWholeCurrency(metric("affiliate.minimumPayout").value)}
                    </td>
                    <td className="p-4 text-center text-slate-600 dark:text-slate-400">
                      {formatWholeCurrency(metric("affiliate.comparison.minimumPayout").value)}
                    </td>
                  </tr>
                  <tr className="border-t border-slate-200 dark:border-slate-700">
                    <td className="p-4 text-slate-600 dark:text-slate-400">
                      {itemLabel(copy, "row-dedicated-support")}
                    </td>
                    <td className="p-4 text-center font-medium">
                      <svg
                        className="w-6 h-6 mx-auto text-green-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </td>
                    <td className="p-4 text-center text-slate-600 dark:text-slate-400">
                      <svg
                        className="w-6 h-6 mx-auto text-red-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </td>
                  </tr>
                  <tr className="border-t border-slate-200 dark:border-slate-700">
                    <td className="p-4 text-slate-600 dark:text-slate-400">
                      {itemLabel(copy, "row-marketing-materials")}
                    </td>
                    <td className="p-4 text-center font-medium">
                      <svg
                        className="w-6 h-6 mx-auto text-green-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </td>
                    <td className="p-4 text-center text-slate-600 dark:text-slate-400">
                      {itemLabel(copy, "row-marketing-others")}
                    </td>
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
