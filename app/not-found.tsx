"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, BookOpen, Brain, Home, Search, Star, Trophy, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function NotFound() {
  const [floatingElements, setFloatingElements] = useState<Array<{ id: number; x: number; y: number; delay: number }>>([]);

  useEffect(() => {
    const elements = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 2,
    }));
    setFloatingElements(elements);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0">
        {floatingElements.map((element) => (
          <div
            key={element.id}
            className="absolute animate-pulse"
            style={{
              left: `${element.x}%`,
              top: `${element.y}%`,
              animationDelay: `${element.delay}s`,
            }}
          >
            {element.id % 3 === 0 && <Brain className="w-6 h-6 text-purple-300 opacity-20" />}
            {element.id % 3 === 1 && <Zap className="w-4 h-4 text-blue-300 opacity-20" />}
            {element.id % 3 === 2 && <Star className="w-5 h-5 text-indigo-300 opacity-20" />}
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div className="text-center max-w-2xl mx-auto">
          {/* 404 Animation */}
          <div className="mb-8">
            <div className="relative">
              <h1 className="text-9xl md:text-[12rem] font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 animate-pulse">404</h1>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <div className="w-24 h-24 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center animate-bounce">
                  <BookOpen className="w-12 h-12 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          <Card className="bg-white/10 backdrop-blur-lg border-white/20 mb-8 xl:pt-6">
            <CardContent className="p-8">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Oops! Quiz Not Found</h2>
              <p className="text-lg text-gray-200 mb-6 leading-relaxed">
                Looks like this page decided to play hide and seek! 🎯
                <br />
                {"Don't worry, even the best quiz masters get lost sometimes."}
              </p>

              {/* Fun Quiz Fact */}
              <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-lg p-4 mb-6 border border-white/10">
                <div className="flex items-center justify-center mb-2">
                  <Trophy className="w-5 h-5 text-yellow-400 mr-2" />
                  <span className="text-sm font-semibold text-yellow-400">Fun Quiz Fact</span>
                </div>
                <p className="text-sm text-gray-200">The HTTP 404 error was named after room 404 at CERN, where the original web servers were located!</p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/">
                  <Button variant={"default"}>
                    <Home className="w-5 h-5 mr-2" />
                    Back to Home
                  </Button>
                </Link>

                <Button variant="outline" onClick={() => window.history.back()}>
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Go Back
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Search Suggestion */}
          <div className="text-center">
            <p className="text-gray-300 mb-4">Looking for something specific?</p>
            <div className="flex justify-center space-x-4 text-sm">
              <Link href="/explore" className="text-purple-400 hover:text-purple-300 transition-colors flex items-center">
                <Search className="w-4 h-4 mr-1" />
                Browse Quizzes
              </Link>
              <Link href="/categories" className="text-blue-400 hover:text-blue-300 transition-colors flex items-center">
                <Brain className="w-4 h-4 mr-1" />
                Categories
              </Link>
              <Link href="/leaderboard" className="text-yellow-400 hover:text-yellow-300 transition-colors flex items-center">
                <Trophy className="w-4 h-4 mr-1" />
                Leaderboard
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-20 fill-white/5">
          <path d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z" opacity=".25"></path>
          <path d="M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V0Z" opacity=".5"></path>
          <path d="M0,0V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V0Z"></path>
        </svg>
      </div>
    </div>
  );
}
