"use client";
import { Media } from "@/components/media/media";
import { entryOf, FALLBACK_KIND } from "@/lib/media-entry";
import { Card, CardContent } from "@/components/ui/card";
import type { PageCopySection } from "@/content/pages";
import { brand } from "@/data/brand";
import { itemLabel, itemValue } from "@/lib/page-copy";
import { motion } from "framer-motion";
import { Award, BookOpen, Globe, Users } from "lucide-react";

/** Which stat card renders where; the caption and the figure are the fixture's pair. */
const STATS = [
  {
    id: "stat-active-users",
    icon: <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />,
  },
  {
    id: "stat-quizzes-taken",
    icon: <Award className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />,
  },
  { id: "stat-countries", icon: <Globe className="h-5 w-5 text-blue-600 dark:text-blue-400" /> },
  {
    id: "stat-quizzes-created",
    icon: <BookOpen className="h-5 w-5 text-green-600 dark:text-green-400" />,
  },
] as const;

export function AboutBrand({ copy }: { copy: PageCopySection }) {
  return (
    <section className="py-10 xl:py-20 sm:px-4 xl:px-8 bg-slate-50 dark:bg-slate-800 overflow-hidden">
      <div className="container px-4 mx-auto">
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{copy.heading}</h2>
            <div className="w-24 h-1 bg-gradient-to-r from-purple-600 to-indigo-600 mx-auto mb-6"></div>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">
              {copy.body}
            </p>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left column - Image */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="relative z-10 rounded-2xl overflow-hidden shadow-xl border border-slate-200 dark:border-slate-700">
              <Media
                alt={`${brand.name} Platform`}
                className="w-full h-auto"
                height={400}
                kind={FALLBACK_KIND.illustration}
                seed="about-affiliate"
                width={600}
              />
            </div>
            {/* Decorative elements */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-[90%] max-h-[90%] rounded-2xl border border-purple-200 dark:border-purple-900/30 -z-10"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-[80%] max-h-[80%] rounded-2xl border border-indigo-200 dark:border-indigo-900/30 -z-20"></div>
          </motion.div>

          {/* Right column - Text content */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <div>
              <h3 className="text-2xl font-bold mb-4">{itemLabel(copy, "our-story")}</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                {itemLabel(copy, "story-origin")}
              </p>
              <p className="text-slate-600 dark:text-slate-400">
                {itemLabel(copy, "story-platform")}
              </p>
            </div>

            <div>
              <h3 className="text-2xl font-bold mb-4">{itemLabel(copy, "our-mission")}</h3>
              <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                <p className="italic text-slate-600 dark:text-slate-400">
                  {itemLabel(copy, "mission-statement")}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {STATS.map((stat, index) => (
                <Card key={index} className="border border-slate-200 dark:border-slate-700">
                  <CardContent className="p-6 xl:pt-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-700">
                        {stat.icon}
                      </div>
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        {itemLabel(copy, stat.id)}
                      </span>
                    </div>
                    <div className="text-3xl font-bold">{itemValue(copy, stat.id)}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
