"use client";
import browse from "@/public/browse-category.png";
import earnReward from "@/public/earn-reward.png";
import takequiz from "@/public/take-quiz.png";
import type { PageCopySection } from "@/content/pages";
import { itemOf, itemValue } from "@/lib/page-copy";
import { motion } from "framer-motion";
import { Award, BookOpen, Search } from "lucide-react";
import Image from "next/image";
import { media } from "@/data/media";

/**
 * The how-it-works band. It renders on `/` and on `/categories`, so it takes its
 * section as a prop and both routes read the same fixture entry
 * (`data/pages/categories.ts` owns it; the component lives in that surface's
 * directory). The step order and each step's icon, tint and photo stay here — they are
 * presentation, joined to the fixture by the item id.
 */
export function CategoriesHowItWorks({ copy }: { copy: PageCopySection }) {
  const steps = [
    {
      item: itemOf(copy, "browse"),
      icon: <Search className="h-6 w-6 text-white" />,
      color: "from-purple-500 to-purple-600",
      delay: 0.3,
      img: browse,
    },
    {
      item: itemOf(copy, "take"),
      icon: <BookOpen className="h-6 w-6 text-white" />,
      color: "from-indigo-500 to-indigo-600",
      delay: 0.5,
      img: takequiz,
    },
    {
      item: itemOf(copy, "earn"),
      icon: <Award className="h-6 w-6 text-white" />,
      color: "from-blue-500 to-blue-600",
      delay: 0.7,
      img: earnReward,
    },
  ];

  return (
    <section className="py-10 xl:py-20 bg-white dark:bg-slate-900 px-3">
      <div className="container mx-auto xl:px-4">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-4 py-1.5 rounded-full mb-4"
          >
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
              {itemOf(copy, "eyebrow").label}
            </span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            viewport={{ once: true }}
            className="text-3xl font-bold mb-4 text-slate-900 dark:text-white"
          >
            {copy.heading}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true }}
            className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto"
          >
            {copy.body}
          </motion.p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {steps.map((step, index) => (
            <motion.div
              key={step.item.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: step.delay }}
              viewport={{ once: true }}
              className="relative"
            >
              {/* Connector line */}

              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className=" relative">
                  <Image
                    src={step.img || media.placeholder.src}
                    alt={step.item.label}
                    width={300}
                    height={200}
                    className="object-cover aspect-[16/10] w-full border-b object-center"
                  />
                  <div className="absolute top-4 left-4">
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-r ${step.color} shadow-lg`}
                    >
                      {step.icon}
                    </div>
                  </div>
                  <div className="absolute top-4 right-4 bg-white dark:bg-slate-900 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-md border border-slate-100 dark:border-slate-700">
                    {index + 1}
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">
                    {step.item.label}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400">{step.item.body}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <p className="text-slate-600 dark:text-slate-400 mb-6">{itemOf(copy, "outro").label}</p>
          <div className="inline-flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-full">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
              <span className="font-bold">{itemValue(copy, "users-online")}</span>{" "}
              {itemOf(copy, "users-online").label}
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
