"use client"

import { useRef } from "react"
import { ChevronLeft, ChevronRight, ArrowRight, BookOpen, TrendingUp, DollarSign, Lightbulb, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel"

// Sample tips data
const quizTips = [
  {
    id: 1,
    title: "How to Create High-Converting Quizzes",
    excerpt: "Learn the psychology behind quizzes that engage users and drive conversions.",
    category: "Strategy",
    readTime: 5,
    icon: TrendingUp,
    color: "bg-blue-500",
  },
  {
    id: 2,
    title: "Top Quiz Formats That Boost Earnings",
    excerpt: "Discover the most profitable quiz formats and how to implement them effectively.",
    category: "Monetization",
    readTime: 7,
    icon: DollarSign,
    color: "bg-green-500",
  },
  {
    id: 3,
    title: "Writing Questions That Keep Players Coming Back",
    excerpt: "Craft engaging questions that challenge players and encourage repeat participation.",
    category: "Content",
    readTime: 6,
    icon: BookOpen,
    color: "bg-purple-500",
  },
  {
    id: 4,
    title: "Quiz Design Best Practices",
    excerpt: "Visual design tips to make your quizzes stand out and improve completion rates.",
    category: "Design",
    readTime: 8,
    icon: Lightbulb,
    color: "bg-amber-500",
  },
  {
    id: 5,
    title: "Optimizing Quiz Length for Maximum Engagement",
    excerpt: "Find the sweet spot for quiz length to keep players engaged without dropping off.",
    category: "Optimization",
    readTime: 4,
    icon: Clock,
    color: "bg-indigo-500",
  },
]

export function QuizCreatorTips() {
  const carouselRef = useRef<HTMLDivElement>(null)

  return (
    <section className="py-16 bg-white dark:bg-slate-950">
      <div className="container mx-auto px-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold tracking-tight">Quiz Creator Resources</h2>
            <p className="text-muted-foreground">Expert tips and strategies to create successful quizzes</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => carouselRef.current?.scrollBy({ left: -300, behavior: "smooth" })}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => carouselRef.current?.scrollBy({ left: 300, behavior: "smooth" })}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Carousel className="w-full">
          <CarouselContent className="-ml-2 md:-ml-4" ref={carouselRef}>
            {quizTips.map((tip) => (
              <CarouselItem key={tip.id} className="pl-2 md:pl-4 sm:basis-1/2 md:basis-1/3 lg:basis-1/4">
                <Card className="h-full flex flex-col">
                  <CardContent className="flex-1 p-6">
                    <div className="mb-4">
                      <div className={`inline-flex items-center justify-center rounded-lg p-2 ${tip.color}`}>
                        <tip.icon className="h-5 w-5 text-white" />
                      </div>
                    </div>
                    <Badge variant="outline" className="mb-2">
                      {tip.category}
                    </Badge>
                    <h3 className="text-xl font-semibold mb-2 line-clamp-2">{tip.title}</h3>
                    <p className="text-muted-foreground line-clamp-3">{tip.excerpt}</p>
                  </CardContent>
                  <CardFooter className="border-t p-6 pt-4">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Clock className="mr-1 h-4 w-4" />
                        <span>{tip.readTime} min read</span>
                      </div>
                      <Button variant="ghost" size="sm" className="gap-1">
                        Read More
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        <div className="mt-8 text-center">
          <Button variant="outline" size="lg">
            View All Resources
          </Button>
        </div>
      </div>
    </section>
  )
}
