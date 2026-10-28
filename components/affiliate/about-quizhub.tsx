"use client";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Award, BookOpen, Globe, Users } from "lucide-react";
import Image from "next/image";

export function AboutQuizHub() {
  const stats = [
    {
      icon: <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />,
      value: "2M+",
      label: "Active Users",
    },
    {
      icon: <Award className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />,
      value: "10M+",
      label: "Quizzes Taken",
    },
    {
      icon: <Globe className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
      value: "150+",
      label: "Countries",
    },
    {
      icon: <BookOpen className="h-5 w-5 text-green-600 dark:text-green-400" />,
      value: "500K+",
      label: "Quizzes Created",
    },
  ];

  return (
    <section className="py-10 xl:py-20 sm:px-4 xl:px-8 bg-slate-50 dark:bg-slate-800 overflow-hidden">
      <div className="container px-4 mx-auto">
        <div className="text-center mb-12">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} viewport={{ once: true }}>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">About QuizHub </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-purple-600 to-indigo-600 mx-auto mb-6"></div>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">The leading platform revolutionizing how people create, share, and experience quizzes worldwide</p>
          </motion.div>
        </div>

        <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left column - Image */}
          <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }} viewport={{ once: true }} className="relative">
            <div className="relative z-10 rounded-2xl overflow-hidden shadow-xl border border-slate-200 dark:border-slate-700">
              <Image src="/about-affiliate.png" alt="QuizMaker Platform" width={600} height={400} className="w-full h-auto" />
            </div>
            {/* Decorative elements */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-[90%] max-h-[90%] rounded-2xl border border-purple-200 dark:border-purple-900/30 -z-10"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-[80%] max-h-[80%] rounded-2xl border border-indigo-200 dark:border-indigo-900/30 -z-20"></div>
          </motion.div>

          {/* Right column - Text content */}
          <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.2 }} viewport={{ once: true }} className="space-y-8">
            <div>
              <h3 className="text-2xl font-bold mb-4">Our Story</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4">Founded in 2018, QuizHub began with a simple mission: to transform learning into an engaging, interactive experience. What started as a small project has grown into a global platform used by educators, businesses, and quiz enthusiasts in over 150 countries.</p>
              <p className="text-slate-600 dark:text-slate-400">Our platform combines cutting-edge technology with user-friendly design to make quiz creation and participation accessible to everyone. With AI-powered tools and a vibrant community, we're redefining how knowledge is shared and tested online.</p>
            </div>

            <div>
              <h3 className="text-2xl font-bold mb-4">Our Mission</h3>
              <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                <p className="italic text-slate-600 dark:text-slate-400">"To empower people worldwide to create, share, and experience knowledge in the most engaging way possible, making learning fun, accessible, and rewarding for everyone."</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {stats.map((stat, index) => (
                <Card key={index} className="border border-slate-200 dark:border-slate-700">
                  <CardContent className="p-6 xl:pt-6">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-700">{stat.icon}</div>
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{stat.label}</span>
                    </div>
                    <div className="text-3xl font-bold">{stat.value}</div>
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
