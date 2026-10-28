"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Award, BarChart3, Clock, DollarSign, Globe, Headphones, Link, Shield, Zap } from "lucide-react";

export function ProgramFeatures() {
  const features = [
    {
      icon: <DollarSign className="h-5 w-5 text-purple-600 dark:text-purple-400" />,
      title: "High Commission Rates",
      description: "Earn up to 30% commission on all referred user subscriptions for the first year.",
    },
    {
      icon: <BarChart3 className="h-5 w-5 text-purple-600 dark:text-purple-400" />,
      title: "Real-time Analytics",
      description: "Track your performance with detailed analytics and reporting tools.",
    },
    {
      icon: <Link className="h-5 w-5 text-purple-600 dark:text-purple-400" />,
      title: "Custom Referral Links",
      description: "Create and manage multiple custom referral links for different campaigns.",
    },
    {
      icon: <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />,
      title: "90-Day Cookie",
      description: "Our 90-day cookie duration ensures you get credit for delayed conversions.",
    },
    {
      icon: <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />,
      title: "Secure Payments",
      description: "Get paid reliably via PayPal, bank transfer, or cryptocurrency.",
    },
    {
      icon: <Headphones className="h-5 w-5 text-purple-600 dark:text-purple-400" />,
      title: "Dedicated Support",
      description: "Access to a dedicated affiliate manager to help optimize your strategy.",
    },
    {
      icon: <Award className="h-5 w-5 text-purple-600 dark:text-purple-400" />,
      title: "Performance Bonuses",
      description: "Earn additional bonuses when you exceed your monthly targets.",
    },
    {
      icon: <Zap className="h-5 w-5 text-purple-600 dark:text-purple-400" />,
      title: "Instant Approval",
      description: "Get started immediately with our instant approval process.",
    },
    {
      icon: <Globe className="h-5 w-5 text-purple-600 dark:text-purple-400" />,
      title: "Global Program",
      description: "Our affiliate program is open to partners worldwide with no restrictions.",
    },
  ];

  return (
    <section className="py-10 xl:py-20 sm:px-4 xl:px-8 bg-white dark:bg-slate-900">
      <div className="container px-4 mx-auto">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Program Features</h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">Our affiliate program is designed to maximize your earnings while providing all the tools and support you need to succeed.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div key={index} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: index * 0.05 }} viewport={{ once: true }}>
              <Card className="h-full border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow duration-300">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30">{feature.icon}</div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-slate-600 dark:text-slate-400">{feature.description}</CardDescription>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
