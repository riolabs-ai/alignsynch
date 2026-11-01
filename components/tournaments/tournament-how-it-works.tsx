"use client";

// template-ancestor: components/categories/categories-how-it-works.tsx   (variation: four numbered steps over the tournament cycle, one button at the end)

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { PageCopySection } from "@/content/pages";
import { itemLabel } from "@/lib/page-copy";
import { motion } from "framer-motion";
import { Calendar, CheckCircle, Trophy, Users } from "lucide-react";

/** The four steps, in order: the fixture owns the words, this owns the number and the icon. */
const STEPS = [
  { id: "register", number: "01", icon: <Calendar className="h-5 w-5" /> },
  { id: "prepare", number: "02", icon: <Users className="h-5 w-5" /> },
  { id: "compete", number: "03", icon: <CheckCircle className="h-5 w-5" /> },
  { id: "win", number: "04", icon: <Trophy className="h-5 w-5" /> },
] as const;

export function TournamentHowItWorks({ copy }: { copy: PageCopySection }) {
  return (
    <section className="py-10 xl:py-16 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">{copy.heading}</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">{copy.body}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {STEPS.map((step, index) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="h-full border border-border hover:border-primary/20 transition-colors duration-300 overflow-hidden">
                <CardContent className="p-6 xl:pt-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      {step.icon}
                    </div>
                    <span className="text-2xl font-light text-muted-foreground/50">
                      {step.number}
                    </span>
                  </div>

                  <h3 className="text-xl font-semibold mb-3">
                    {itemLabel(copy, `step-${step.id}-title`)}
                  </h3>
                  <p className="text-muted-foreground">{itemLabel(copy, `step-${step.id}-body`)}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-lg mb-4">{itemLabel(copy, "ready")}</p>
          <Button size="lg" className="px-6">
            {itemLabel(copy, "join-today")}
          </Button>
        </div>
      </div>
    </section>
  );
}
