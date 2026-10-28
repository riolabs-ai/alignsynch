"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, ChevronLeft, ChevronRight, Clock, DollarSign, Gift, Lightbulb, TrendingUp } from "lucide-react";
import { useRef, useState } from "react";
import { Autoplay, Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

export function ResourcesAndReferral() {
  const [copied, setCopied] = useState(false);
  const referralCode = "QUIZ2024FRIEND";
  const cardsRef = useRef<HTMLDivElement>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const scrollCards = (direction: "left" | "right") => {
    if (!cardsRef.current) return;
    const scrollAmount = direction === "left" ? -280 : 280;
    cardsRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
  };

  // Quiz creator tips data
  const creatorTips = [
    {
      id: 1,
      title: "How to create high-converting quizzes",
      icon: <TrendingUp className="h-5 w-5 text-purple-500" />,
      description: "Learn the psychology behind quizzes that engage users and drive conversions.",
    },
    {
      id: 2,
      title: "Top quiz formats that boost earnings",
      icon: <DollarSign className="h-5 w-5 text-green-500" />,
      description: "Discover the most profitable quiz formats and how to implement them effectively.",
    },
    {
      id: 3,
      title: "Writing questions that keep players coming back",
      icon: <Lightbulb className="h-5 w-5 text-amber-500" />,
      description: "Craft engaging questions that challenge players and encourage repeat participation.",
    },
    {
      id: 4,
      title: "Quiz design best practices",
      icon: <Lightbulb className="h-5 w-5 text-blue-500" />,
      description: "Learn visual design tips to make your quizzes stand out and improve completion rates.",
    },
    {
      id: 5,
      title: "Optimizing quiz length for maximum engagement",
      icon: <Clock className="h-5 w-5 text-indigo-500" />,
      description: "Find the sweet spot for quiz length to keep players engaged without dropping off.",
    },
    {
      id: 6,
      title: "Effective strategies for promoting your quiz",
      icon: <Gift className="h-5 w-5 text-pink-500" />,
      description: "Learn how to market your quizzes and reach a wider audience.",
    },
  ];

  return (
    <section className="py-10 xl:py-16 bg-white dark:bg-slate-950">
      <div className="container mx-auto xl:px-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Referral Program CTA - 5 columns */}
          <div className="md:col-span-5">
            <Card className="overflow-hidden h-full  border-0 shadow-md bg-[url('/refer-bg.png')]">
              <CardContent className="p-6 xl:pt-6 h-full">
                <div className="flex flex-col h-full">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-2xl xl:text-4xl font-bold text-slate-50">Refer & Earn</h2>
                      <p className="text-slate-100 xl:text-lg">Invite friends and earn bonus rewards!</p>
                    </div>
                    <Badge className="bg-amber-500 hover:bg-amber-600">Earn up to $10</Badge>
                  </div>

                  <div className="flex-1 flex items-end h-full justify-between">
                    <Button variant={"outline"} className="w-full">
                      <Gift className="mr-2 h-4 w-4" />
                      Invite Friends
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quiz Creator Tips - 7 columns */}
          <div className="md:col-span-7">
            <div className="h-full flex flex-col">
              <div className="mb-6 flex justify-between items-center gap-3 flex-wrap">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Quiz Creator Tips</h2>
                  <p className="text-slate-600 dark:text-slate-400">Grow faster with expert advice</p>
                </div>
                <div className="flex items-center gap-4">
                  <Button variant="outline">View All Resources</Button>
                  <div className="flex gap-2">
                    <Button variant="outline" className="prev-tip" size="icon" onClick={() => scrollCards("left")}>
                      <ChevronLeft />
                    </Button>
                    <Button variant="outline" className="next-tip" size="icon" onClick={() => scrollCards("right")}>
                      <ChevronRight />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="relative flex-1">
                <div ref={cardsRef} className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory">
                  <Swiper
                    slidesPerView={"auto"}
                    spaceBetween={16}
                    autoplay
                    loop
                    modules={[Navigation, Autoplay]}
                    navigation={{
                      nextEl: ".next-tip",
                      prevEl: ".prev-tip",
                    }}
                  >
                    {creatorTips.map((tip) => (
                      <SwiperSlide className="max-w-[270px]">
                        <div key={tip.id} className="min-w-[270px] max-w-[270px] snap-start ">
                          <Card className="h-full border border-slate-200 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800/50 transition-colors">
                            <CardContent className="p-5 xl:pt-5">
                              <div className="flex flex-col h-full">
                                <div className="mb-3 p-2 rounded-full bg-slate-100 dark:bg-slate-800 w-fit">{tip.icon}</div>
                                <h3 className="text-lg font-semibold mb-2 line-clamp-2">{tip.title}</h3>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-3 flex-1">{tip.description}</p>
                                <Button variant="ghost" className="justify-start p-0 h-auto text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-transparent">
                                  Read more
                                  <ArrowRight className="ml-1 h-4 w-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </SwiperSlide>
                    ))}
                  </Swiper>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
