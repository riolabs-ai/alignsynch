"use client";

import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

type Testimonial = {
  id: number;
  name: string;
  avatar: string;
  role: string;
  rating: number;
  text: string;
  tournament: string;
};

export function TournamentTestimonials() {
  const testimonials: Testimonial[] = [
    {
      id: 1,
      name: "Alex Johnson",
      avatar: "/avatars/alex.png",
      role: "History Enthusiast",
      rating: 5,
      text: "The World History Tournament was incredibly well-organized! The questions were challenging but fair, and the live competition format kept me on the edge of my seat. I learned so much while having fun.",
      tournament: "World History Championship",
    },
    {
      id: 2,
      name: "Sarah Williams",
      avatar: "/avatars/sarah.webp",
      role: "Science Teacher",
      rating: 5,
      text: "As a science teacher, I was impressed by the depth and accuracy of questions in the Science Spectacular tournament. My students and I participated together, and it became a wonderful learning experience for all of us.",
      tournament: "Science Spectacular",
    },
    {
      id: 3,
      name: "Michael Chen",
      avatar: "/avatars/wizard.webp",
      role: "Quiz Champion",
      rating: 4,
      text: "I've participated in dozens of online quiz competitions, and this platform offers the best tournament experience by far. The real-time scoring and global competition make every round exciting!",
      tournament: "General Knowledge Masters",
    },
    {
      id: 4,
      name: "Emily Rodriguez",
      avatar: "/avatars/guru.png",
      role: "Literature Lover",
      rating: 5,
      text: "The Classic Literature tournament exceeded my expectations. The questions were thoughtfully crafted and covered a wide range of works. I connected with other book lovers and even won some amazing prizes!",
      tournament: "Classic Literature Challenge",
    },
    {
      id: 5,
      name: "David Kim",
      avatar: "/avatars/king.webp",
      role: "Math Enthusiast",
      rating: 4,
      text: "The Math & Logic tournament was both challenging and rewarding. The timed rounds really tested my problem-solving abilities under pressure. The community is supportive and the prizes were great!",
      tournament: "Math & Logic Masters",
    },
    {
      id: 6,
      name: "Jessica Taylor",
      avatar: "/testimonials/jessica.png",
      role: "Trivia Buff",
      rating: 5,
      text: "I love how the tournaments are structured with qualifying rounds and finals. It gives everyone a fair chance while still rewarding skill and knowledge. The Pop Culture tournament was my favorite so far!",
      tournament: "Pop Culture Showdown",
    },
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(true);

  useEffect(() => {
    if (!autoplay) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % testimonials.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [autoplay, testimonials.length]);

  const handlePrev = () => {
    setAutoplay(false);
    setCurrentIndex((prevIndex) => (prevIndex - 1 + testimonials.length) % testimonials.length);
  };

  const handleNext = () => {
    setAutoplay(false);
    setCurrentIndex((prevIndex) => (prevIndex + 1) % testimonials.length);
  };

  const handleDotClick = (index: number) => {
    setAutoplay(false);
    setCurrentIndex(index);
  };

  return (
    <section className="py-16 mt-8">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold mb-4">What Tournament Players Say</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">Hear from our community of quiz enthusiasts who have participated in our tournaments</p>
      </div>

      <div className="relative max-w-4xl mx-auto px-4" onMouseEnter={() => setAutoplay(false)} onMouseLeave={() => setAutoplay(true)}>
        <button onClick={handlePrev} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm p-2 rounded-full shadow-md border border-border hover:bg-muted transition-colors" aria-label="Previous testimonial">
          <ChevronLeft className="h-6 w-6" />
        </button>

        <div className="overflow-hidden">
          <div className="flex transition-transform duration-500 ease-in-out" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
            {testimonials.map((testimonial) => (
              <div key={testimonial.id} className="w-full flex-shrink-0 px-4">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="bg-card rounded-xl shadow-lg p-8 border border-border">
                  <div className="flex items-center mb-6">
                    <div className="mr-4">
                      <Image src={testimonial.avatar || "/placeholder.svg"} width={48} height={48} alt={testimonial.name} className="w-16 h-16 rounded-full object-cover border-2 border-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{testimonial.name}</h3>
                      <p className="text-muted-foreground text-sm">{testimonial.role}</p>
                      <div className="flex mt-1">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-4 h-4 ${i < testimonial.rating ? "text-yellow-500 fill-yellow-500" : "text-gray-300"}`} />
                        ))}
                      </div>
                    </div>
                  </div>

                  <blockquote className="relative">
                    <span className="absolute top-0 left-0 text-6xl text-primary/20">"</span>
                    <p className="pl-6 pt-2 italic text-muted-foreground">{testimonial.text}</p>
                  </blockquote>

                  <div className="mt-6 pt-4 border-t border-border">
                    <p className="text-sm font-medium">
                      Tournament: <span className="text-primary">{testimonial.tournament}</span>
                    </p>
                  </div>
                </motion.div>
              </div>
            ))}
          </div>
        </div>

        <button onClick={handleNext} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm p-2 rounded-full shadow-md border border-border hover:bg-muted transition-colors" aria-label="Next testimonial">
          <ChevronRight className="h-6 w-6" />
        </button>

        {/* Dots navigation */}
        <div className="flex justify-center mt-6 space-x-2">
          {testimonials.map((_, index) => (
            <button key={index} onClick={() => handleDotClick(index)} className={`w-3 h-3 rounded-full transition-colors ${index === currentIndex ? "bg-primary" : "bg-muted hover:bg-primary/50"}`} aria-label={`Go to testimonial ${index + 1}`} />
          ))}
        </div>
      </div>

      <div className="text-center mt-12">
        <p className="text-lg font-medium mb-4">Join over 50,000 quiz enthusiasts in our tournaments</p>
        <button className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 rounded-full font-medium">View Upcoming Tournaments</button>
      </div>
    </section>
  );
}
