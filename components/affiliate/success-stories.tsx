"use client";

import { GeneratedAvatar } from "@/components/media/generated-avatar";
import type { PageCopySection } from "@/content/pages";
import { brand } from "@/data/brand";
import { fillLabel, itemLabel } from "@/lib/page-copy";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { useState } from "react";

export function SuccessStories({ copy }: { copy: PageCopySection }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const stories = [
    {
      name: "Sarah Johnson",
      role: "Content Creator",
      quote: `I've been promoting ${brand.name} to my audience for 6 months now and the results have been incredible. The 30% commission is one of the best in the industry, and the recurring revenue has added a reliable income stream to my business.`,
      earnings: "$2,450/month",
      rating: 5,
    },
    {
      name: "Michael Chen",
      role: "Education Blogger",
      quote: `What I love about ${brand.name}'s affiliate program is how easy they make it to promote. The marketing materials are top-notch, and my audience loves the product. I'm earning more with ${brand.name} than with any other affiliate program I've tried.`,
      earnings: "$1,875/month",
      rating: 5,
    },
    {
      name: "Jessica Williams",
      role: "YouTube Educator",
      quote: `As someone who creates educational content, ${brand.name} was a natural fit for my audience. The affiliate dashboard makes it easy to track my performance, and the team is always responsive when I have questions. Highly recommended!`,
      earnings: "$3,200/month",
      rating: 5,
    },
  ];

  const nextStory = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % stories.length);
  };

  const prevStory = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + stories.length) % stories.length);
  };

  return (
    <section className="py-10 xl:py-16 bg-white dark:bg-slate-900">
      <div className="container px-4 mx-auto">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">{copy.heading}</h2>
          <p className="text-slate-600 dark:text-slate-400">{copy.body}</p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="relative bg-slate-50 dark:bg-slate-800 rounded-xl p-8 shadow-sm">
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="w-full md:w-1/3 flex justify-center">
                <GeneratedAvatar
                  name={stories[currentIndex].name}
                  seed={stories[currentIndex].name}
                  size={128}
                  className="border-4 border-white dark:border-slate-700"
                />
              </div>
              <div className="w-full md:w-2/3 text-center md:text-left">
                <div className="flex mb-2 justify-center md:justify-start">
                  {[...Array(stories[currentIndex].rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <blockquote className="text-slate-700 dark:text-slate-300 italic mb-4">
                  "{stories[currentIndex].quote}"
                </blockquote>
                <div className="font-medium text-lg">{stories[currentIndex].name}</div>
                <div className="text-slate-600 dark:text-slate-400 text-sm mb-2">
                  {stories[currentIndex].role}
                </div>
                <div className="inline-block bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 text-sm font-medium px-3 py-1 rounded-full">
                  {fillLabel(itemLabel(copy, "earning-badge"), {
                    earnings: stories[currentIndex].earnings,
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-center mt-8 gap-2">
              {stories.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-2.5 h-2.5 rounded-full ${index === currentIndex ? "bg-primary" : "bg-slate-300 dark:bg-slate-600"}`}
                  aria-label={`Go to testimonial ${index + 1}`}
                />
              ))}
            </div>

            <button
              onClick={prevStory}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white dark:bg-slate-700 rounded-full p-2 shadow-md hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
              aria-label="Previous testimonial"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={nextStory}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white dark:bg-slate-700 rounded-full p-2 shadow-md hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
              aria-label="Next testimonial"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
