"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PageCopySection } from "@/content/pages";
import { itemLabel, itemValue } from "@/lib/page-copy";
import { motion } from "framer-motion";
import {
  Award,
  BarChart3,
  Clock,
  DollarSign,
  Globe,
  Headphones,
  Link,
  Shield,
  Zap,
} from "lucide-react";

/** Which feature card renders where; the words are `itemLabel`/`itemValue` of the same id. */
const FEATURES = [
  {
    id: "high-commission-rates",
    icon: <DollarSign className="h-5 w-5 text-action" />,
  },
  {
    id: "real-time-analytics",
    icon: <BarChart3 className="h-5 w-5 text-action" />,
  },
  {
    id: "custom-referral-links",
    icon: <Link className="h-5 w-5 text-action" />,
  },
  { id: "90-day-cookie", icon: <Clock className="h-5 w-5 text-action" /> },
  {
    id: "secure-payments",
    icon: <Shield className="h-5 w-5 text-action" />,
  },
  {
    id: "dedicated-support",
    icon: <Headphones className="h-5 w-5 text-action" />,
  },
  {
    id: "performance-bonuses",
    icon: <Award className="h-5 w-5 text-action" />,
  },
  {
    id: "instant-approval",
    icon: <Zap className="h-5 w-5 text-action" />,
  },
  {
    id: "global-program",
    icon: <Globe className="h-5 w-5 text-action" />,
  },
] as const;

export function ProgramFeatures({ copy }: { copy: PageCopySection }) {
  return (
    <section className="py-10 xl:py-20 sm:px-4 xl:px-8 bg-white dark:bg-slate-900">
      <div className="container px-4 mx-auto">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">{copy.heading}</h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            {copy.body}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              viewport={{ once: true }}
            >
              <Card className="h-full border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow duration-300">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-action/10">{feature.icon}</div>
                    <CardTitle className="text-lg">{itemLabel(copy, feature.id)}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-slate-600 dark:text-slate-400">
                    {itemValue(copy, feature.id)}
                  </CardDescription>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
