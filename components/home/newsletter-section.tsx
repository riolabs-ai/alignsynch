"use client";

import type React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle, Mail } from "lucide-react";
import { useState } from "react";

export function NewsletterSection() {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      setIsSubmitted(true);
      setEmail("");
    }, 1000);
  };

  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background image with overlay */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: "url('/newsletter-bg.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-purple-900/90 to-indigo-900/90 backdrop-blur-sm"></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} viewport={{ once: true }} className="text-center">
            <div className="inline-flex items-center justify-center p-3 bg-white/10 backdrop-blur-md rounded-full mb-6 border border-white/20">
              <Mail className="h-6 w-6 text-white" />
            </div>

            <h2 className="text-4xl font-bold text-white mb-4">Get Quiz Insights Weekly</h2>

            <p className="text-white/80 mb-8 text-lg max-w-2xl mx-auto">Join 10,000+ quiz creators and players receiving our weekly tips, strategies, and exclusive opportunities</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} viewport={{ once: true }}>
            {isSubmitted ? (
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 text-center border border-white/20">
                <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 10 }} className="flex items-center justify-center gap-2 text-white font-medium text-lg">
                  <div className="bg-green-500 rounded-full p-1">
                    <CheckCircle className="h-6 w-6 text-white" />
                  </div>
                  <span>Thank you for subscribing! Check your inbox soon.</span>
                </motion.div>
              </div>
            ) : (
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20">
                <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Input type="email" placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} className="pr-10 h-14 bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:border-white focus:ring-white" required />
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-white/60" />
                  </div>
                  <Button type="submit" className="h-14 px-8 bg-white text-indigo-900 hover:bg-white/90 transition-all duration-200 font-medium text-base" disabled={isLoading}>
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 border-2 border-indigo-900 border-t-transparent rounded-full animate-spin"></span>
                        Subscribing...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        Subscribe
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    )}
                  </Button>
                </form>

                <div className="mt-6 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-white/80">
                  <div className="flex items-center">
                    <div className="bg-white/20 rounded-full p-1 mr-2">
                      <CheckCircle className="h-3 w-3 text-white" />
                    </div>
                    <span>Weekly insights</span>
                  </div>
                  <div className="flex items-center">
                    <div className="bg-white/20 rounded-full p-1 mr-2">
                      <CheckCircle className="h-3 w-3 text-white" />
                    </div>
                    <span>Exclusive strategies</span>
                  </div>
                  <div className="flex items-center">
                    <div className="bg-white/20 rounded-full p-1 mr-2">
                      <CheckCircle className="h-3 w-3 text-white" />
                    </div>
                    <span>Unsubscribe anytime</span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }} viewport={{ once: true }} className="mt-8 flex flex-wrap justify-center gap-6">
            <div className="flex flex-col items-center">
              <p className="text-3xl font-bold text-white">10k+</p>
              <p className="text-white/70 text-sm">Subscribers</p>
            </div>
            <div className="w-px h-12 bg-white/20 self-center"></div>
            <div className="flex flex-col items-center">
              <p className="text-3xl font-bold text-white">4.9/5</p>
              <p className="text-white/70 text-sm">Satisfaction</p>
            </div>
            <div className="w-px h-12 bg-white/20 self-center"></div>
            <div className="flex flex-col items-center">
              <p className="text-3xl font-bold text-white">Weekly</p>
              <p className="text-white/70 text-sm">Updates</p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Decorative elements */}
      <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl"></div>
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl"></div>
    </section>
  );
}
