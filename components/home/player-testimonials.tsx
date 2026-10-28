"use client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import avatarAlex from "@/public/avatars/alex.png";
import avatarBrain from "@/public/avatars/brain.png";
import avatarChampion from "@/public/avatars/champion.png";
import avatarGenius from "@/public/avatars/genious.png";
import avatarSarah from "@/public/avatars/sarah.webp";
import { ChevronLeft, ChevronRight, Quote, Star } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

// Sample testimonial data
const testimonials = [
  {
    id: 1,
    name: "Sarah Johnson",
    role: "Quiz Creator",
    avatar: avatarSarah,
    rating: 5,
    testimonial: "I've created over 50 quizzes and earned more than $2,000 in just three months. The platform makes it incredibly easy to monetize my knowledge!",
    stats: { earnings: "$2,000+", quizzes: 50, followers: "1.2k" },
  },
  {
    id: 2,
    name: "Michael Chen",
    role: "Top Earner",
    avatar: avatarAlex,
    rating: 5,
    testimonial: "Quitting my part-time job was the best decision ever. I now make double creating fun quizzes about topics I'm passionate about. The community is amazing!",
    stats: { earnings: "$3,500+", quizzes: 78, followers: "3.4k" },
  },
  {
    id: 3,
    name: "Jessica Williams",
    role: "Teacher",
    avatar: avatarBrain,
    rating: 4,
    testimonial: "As an educator, I use this platform to create supplementary quizzes for my students. They love the interactive format, and I earn extra income. Win-win!",
    stats: { earnings: "$1,200+", quizzes: 35, followers: "850" },
  },
  {
    id: 4,
    name: "David Rodriguez",
    role: "Content Creator",
    avatar: avatarGenius,
    rating: 5,
    testimonial: "I've integrated these quizzes into my content strategy and seen engagement skyrocket. The analytics help me understand what my audience loves.",
    stats: { earnings: "$2,800+", quizzes: 42, followers: "2.7k" },
  },
  {
    id: 5,
    name: "Emma Thompson",
    role: "Trivia Enthusiast",
    avatar: avatarChampion,
    rating: 5,
    testimonial: "From quiz player to creator, this platform changed my hobby into a profitable side hustle. The referral program helped me build a solid player base quickly.",
    stats: { earnings: "$1,800+", quizzes: 28, followers: "1.5k" },
  },
];

export function PlayerTestimonials() {
  const [activeIndex, setActiveIndex] = useState(0);

  const handlePrev = () => {
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : testimonials.length - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev < testimonials.length - 1 ? prev + 1 : 0));
  };

  // Generate star rating
  const renderStars = (rating: number) => {
    return Array(5)
      .fill(0)
      .map((_, i) => <Star key={i} className={`h-4 w-4 ${i < rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`} />);
  };

  return (
    <section className="py-10 xl:py-16  bg-indigo-50 dark:bg-slate-900">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200 mb-4">Success Stories</h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">Hear from our community of quiz creators and players who are earning rewards and building their audience</p>
        </div>

        <div className="relative max-w-5xl mx-auto">
          {/* Desktop view - side by side */}
          <div className="hidden md:grid grid-cols-12 gap-6">
            <div className="col-span-5 flex items-center justify-center">
              <div className="relative">
                <div className="absolute -top-6 -left-6">
                  <Quote className="h-12 w-12 text-indigo-200 dark:text-indigo-800 rotate-180" />
                </div>
                <Avatar className="h-64 w-64 border-4 border-white dark:border-slate-800 shadow-lg">
                  <Image src={testimonials[activeIndex].avatar} width={400} height={400} alt={testimonials[activeIndex].name} className="object-cover object-center" />
                </Avatar>
                <Badge className="absolute bottom-4 right-4 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5">{testimonials[activeIndex].role}</Badge>
              </div>
            </div>

            <div className="col-span-7 flex flex-col justify-center">
              <div className="flex mb-3">{renderStars(testimonials[activeIndex].rating)}</div>

              <blockquote className="text-xl italic font-medium text-slate-800 dark:text-slate-200 mb-6">"{testimonials[activeIndex].testimonial}"</blockquote>

              <div className="mb-6">
                <h3 className="text-lg font-semibold">{testimonials[activeIndex].name}</h3>
                <p className="text-slate-600 dark:text-slate-400">{testimonials[activeIndex].role}</p>
              </div>

              <div className="flex gap-6 flex-wrap">
                <div className="text-center">
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{testimonials[activeIndex].stats.earnings}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Earnings</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{testimonials[activeIndex].stats.quizzes}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Quizzes</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{testimonials[activeIndex].stats.followers}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Followers</p>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile view - card based */}
          <div className="md:hidden">
            <Card className="border-2 border-indigo-100 dark:border-indigo-900/30 overflow-hidden">
              <CardContent className="p-6">
                <div className="flex justify-center mb-6">
                  <Avatar className="h-24 w-24 border-4 border-white dark:border-slate-800 shadow-md">
                    <Image src={testimonials[activeIndex].avatar || `/placeholder.svg?height=96&width=96&query=person ${testimonials[activeIndex].name}`} alt={testimonials[activeIndex].name} />
                    <AvatarFallback>
                      {testimonials[activeIndex].name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                </div>

                <div className="text-center mb-4">
                  <h3 className="font-semibold">{testimonials[activeIndex].name}</h3>
                  <Badge variant="secondary" className="mt-1">
                    {testimonials[activeIndex].role}
                  </Badge>
                </div>

                <div className="flex justify-center mb-4">{renderStars(testimonials[activeIndex].rating)}</div>

                <blockquote className="text-center italic text-slate-700 dark:text-slate-300 mb-6">"{testimonials[activeIndex].testimonial}"</blockquote>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-md">
                    <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{testimonials[activeIndex].stats.earnings}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Earnings</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-md">
                    <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{testimonials[activeIndex].stats.quizzes}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Quizzes</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-md">
                    <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{testimonials[activeIndex].stats.followers}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Followers</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Navigation dots */}
          <div className="flex justify-center mt-8 gap-2">
            {testimonials.map((_, index) => (
              <button key={index} onClick={() => setActiveIndex(index)} className={`h-2.5 w-2.5 rounded-full transition-colors ${index === activeIndex ? "bg-indigo-600 dark:bg-indigo-400" : "bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600"}`} aria-label={`View testimonial ${index + 1}`} />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="absolute top-1/2 -translate-y-1/2 w-full flex justify-between pointer-events-none">
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-full bg-white dark:bg-slate-800 shadow-md pointer-events-auto" onClick={handlePrev}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-full bg-white dark:bg-slate-800 shadow-md pointer-events-auto" onClick={handleNext}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
