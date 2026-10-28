"use client"

import { useState } from "react"
import { Copy, Facebook, Twitter, Mail, Share2, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { motion } from "framer-motion"

export function ReferralProgramCTA() {
  const [copied, setCopied] = useState(false)
  const referralCode = "QUIZ2024FRIEND"

  const handleCopy = () => {
    navigator.clipboard.writeText(referralCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="py-16 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-4">
                Invite Friends, Earn Together
              </h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                Share your referral code with friends and earn{" "}
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">$5 bonus</span> for each friend who
                joins. Plus, they'll get a{" "}
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">$5 welcome bonus</span> too!
              </p>
            </motion.div>
          </div>

          <div className="grid gap-8 md:grid-cols-2 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200">How it works</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 text-sm font-medium">
                      1
                    </div>
                    <p className="text-slate-600 dark:text-slate-400">Share your unique referral code with friends</p>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 text-sm font-medium">
                      2
                    </div>
                    <p className="text-slate-600 dark:text-slate-400">Friends sign up using your code</p>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 text-sm font-medium">
                      3
                    </div>
                    <p className="text-slate-600 dark:text-slate-400">Both of you receive $5 bonus credit</p>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 text-sm font-medium">
                      4
                    </div>
                    <p className="text-slate-600 dark:text-slate-400">Earn unlimited rewards with more referrals</p>
                  </li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button className="flex gap-2" size="lg">
                  <Share2 className="h-4 w-4" />
                  <span>Refer Now</span>
                </Button>
                <Button variant="outline" size="lg">
                  View Referral Dashboard
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              viewport={{ once: true }}
            >
              <Card className="overflow-hidden border-2 border-indigo-100 dark:border-indigo-900/50">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium text-slate-800 dark:text-slate-200">Your Referral Code</h4>
                      <div className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs px-2 py-1 rounded-full">
                        Active
                      </div>
                    </div>

                    <div className="relative">
                      <Input
                        value={referralCode}
                        readOnly
                        className="pr-10 bg-indigo-50/50 dark:bg-indigo-900/20 font-medium text-center text-lg border-indigo-100 dark:border-indigo-800"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                        onClick={handleCopy}
                      >
                        {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>

                    <div className="pt-2">
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">Share via:</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="icon" className="rounded-full w-10 h-10">
                          <Facebook className="h-5 w-5 text-blue-600" />
                          <span className="sr-only">Share on Facebook</span>
                        </Button>
                        <Button variant="outline" size="icon" className="rounded-full w-10 h-10">
                          <Twitter className="h-5 w-5 text-sky-500" />
                          <span className="sr-only">Share on Twitter</span>
                        </Button>
                        <Button variant="outline" size="icon" className="rounded-full w-10 h-10">
                          <Mail className="h-5 w-5 text-red-500" />
                          <span className="sr-only">Share via Email</span>
                        </Button>
                        <div className="flex-1"></div>
                        <Button variant="default" className="rounded-full">
                          <Share2 className="h-4 w-4 mr-2" />
                          <span>Share</span>
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-dashed border-slate-200 dark:border-slate-700">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Total Referrals</span>
                        <span className="font-semibold">12</span>
                      </div>
                      <div className="flex items-center justify-between text-sm mt-2">
                        <span className="text-slate-600 dark:text-slate-400">Earnings</span>
                        <span className="font-semibold text-green-600">$60.00</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
