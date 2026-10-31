"use client";

import { Button } from "@/components/ui/button";
import type { PageCopySection } from "@/content/pages";
import { itemOf, itemValue } from "@/lib/page-copy";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Trophy, Users } from "lucide-react";
import Link from "next/link";

/**
 * The `/categories` call-to-action band: a kicker, a heading, two links, three cards
 * and a community counter.
 *
 * Every word comes from `sectionOf(categoriesPageCopy, "cta")` — the page passes it
 * down. What stays here is presentation: which icon and tint a card gets, keyed by the
 * item id the fixture declares (`itemOf` is the join, and E23 fails the build when the
 * id is not in the fixture).
 */
export function CategoriesCTA({ copy }: { copy: PageCopySection }) {
  const cards = [
    {
      item: itemOf(copy, "compete"),
      icon: Trophy,
      ring: "bg-action/10",
      tint: "text-action",
      delay: 0.4,
    },
    {
      item: itemOf(copy, "learn"),
      icon: Sparkles,
      ring: "bg-action/10",
      tint: "text-action",
      delay: 0.5,
    },
    {
      item: itemOf(copy, "share"),
      icon: Users,
      ring: "bg-blue-100 dark:bg-blue-900/30",
      tint: "text-blue-600 dark:text-blue-400",
      delay: 0.6,
    },
  ];

  return (
    <section className="py-20 bg-muted relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-action/10 blur-3xl"></div>
      <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-action/10 blur-3xl"></div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 bg-white dark:bg-slate-800 px-4 py-1.5 rounded-full shadow-sm border border-action/20 mb-4"
          >
            <Sparkles className="h-4 w-4 text-action" />
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
              {itemOf(copy, "eyebrow").label}
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true }}
            className="text-3xl lg:text-4xl font-bold mb-4"
          >
            {copy.heading}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true }}
            className="text-lg text-slate-600 dark:text-slate-400 mb-8"
          >
            {copy.body}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            viewport={{ once: true }}
            className="flex flex-wrap  gap-4 justify-center"
          >
            {copy.cta && (
              <Link href={copy.cta.href}>
                <Button size="lg" variant={"action"}>
                  {copy.cta.label}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            )}
            {copy.secondaryCta && (
              <Link href={copy.secondaryCta.href}>
                <Button size="lg" variant="outline">
                  {copy.secondaryCta.label}
                </Button>
              </Link>
            )}
          </motion.div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {cards.map(({ item, icon: Icon, ring, tint, delay }) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay }}
              viewport={{ once: true }}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-action/20 p-6 text-center hover:shadow-md transition-all hover:-translate-y-1"
            >
              <div
                className={`inline-flex items-center justify-center w-14 h-14 rounded-full ${ring} mb-4`}
              >
                <Icon className={`h-6 w-6 ${tint}`} />
              </div>
              <h3 className="text-xl font-bold mb-2 text-slate-800 dark:text-slate-200">
                {item.label}
              </h3>
              <p className="text-slate-600 dark:text-slate-400">{item.body}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          viewport={{ once: true }}
          className="mt-16 max-w-3xl mx-auto"
        >
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-action/20 p-6 flex flex-col sm:flex-row items-center gap-6">
            <div className="flex-shrink-0 bg-action p-3 rounded-full">
              <Users className="h-6 w-6 text-action-foreground" />
            </div>
            <div className="text-center sm:text-left">
              <p className="text-slate-600 dark:text-slate-400">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {itemValue(copy, "community")}
                </span>{" "}
                {itemOf(copy, "community").label}
              </p>
            </div>
            <div className="sm:ml-auto">
              <Link href="/register">
                <Button variant={"action"}>{itemOf(copy, "join").label}</Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
