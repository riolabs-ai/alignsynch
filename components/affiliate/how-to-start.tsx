"use client";

import { Button } from "@/components/ui/button";
import type { PageCopySection } from "@/content/pages";
import { fillLabel, itemLabel, itemOf } from "@/lib/page-copy";
import { BarChart, DollarSign, Link, UserPlus, Users } from "lucide-react";

/** Step identity and presentation; the words are `itemLabel`/`itemValue` of the same id. */
const STEPS = [
  {
    id: "sign-up",
    icon: <UserPlus className="h-6 w-6 text-primary" />,
    color: "border-l-primary",
  },
  {
    id: "share-your-link",
    icon: <Link className="h-6 w-6 text-action" />,
    color: "border-l-action",
  },
  {
    id: "refer-users",
    icon: <Users className="h-6 w-6 text-action" />,
    color: "border-l-action",
  },
  {
    id: "earn-commission",
    icon: <DollarSign className="h-6 w-6 text-emerald-500" />,
    color: "border-l-emerald-500",
  },
  {
    id: "track-performance",
    icon: <BarChart className="h-6 w-6 text-amber-500" />,
    color: "border-l-amber-500",
  },
] as const;

export function HowToStart({ copy }: { copy: PageCopySection }) {
  return (
    <section className="py-10 md:py-16 bg-white dark:bg-slate-900">
      <div className="container px-4 mx-auto">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">{copy.heading}</h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">{copy.body}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {STEPS.map((step, index) => (
            <div
              key={index}
              className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-all hover:shadow-md"
            >
              <div className={`border-l-4 ${step.color} h-full flex flex-col`}>
                <div className="p-6 flex-1">
                  <div className="bg-slate-100 dark:bg-slate-700 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                    {step.icon}
                  </div>
                  <div className="flex items-center mb-3">
                    <span className="text-slate-400 dark:text-slate-500 text-sm font-medium mr-2">
                      {fillLabel(itemLabel(copy, "step-label"), { step: index + 1 })}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold mb-2">{itemLabel(copy, step.id)}</h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    {itemOf(copy, step.id).value}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Button size="lg" variant="action" className="px-8">
            {itemLabel(copy, "become-affiliate")}
          </Button>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            {itemLabel(copy, "already-an-affiliate")}
            <Link href="#" className="text-primary hover:underline">
              {itemLabel(copy, "sign-in")}
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
