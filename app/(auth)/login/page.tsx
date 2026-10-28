"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Image */}
      <div className="hidden lg:flex justify-center lg:w-1/2 bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative z-10 flex flex-col justify-center items-center text-white p-12">
          <div className="mb-8 max-w-md mx-auto">
            <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm">
              <BookOpen className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-4xl font-bold mb-4">Welcome to QuizHub</h2>
            <p className="text-xl text-white/90 leading-relaxed">Challenge your mind with thousands of engaging quizzes across multiple categories</p>
          </div>
          <div className="grid grid-cols-2 gap-4 w-full max-w-md">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
              <Trophy className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
              <div className="text-2xl font-bold">10K+</div>
              <div className="text-sm text-white/80">Active Players</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
              <BookOpen className="w-8 h-8 mx-auto mb-2 text-green-400" />
              <div className="text-2xl font-bold">500+</div>
              <div className="text-sm text-white/80">Quiz Categories</div>
            </div>
          </div>
        </div>
        {/* Decorative Elements */}
        <div className="absolute top-20 right-20 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
        <div className="absolute bottom-20 left-20 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 ">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardHeader className="text-center pb-8">
            <div className="lg:hidden mx-auto mb-4 w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <CardTitle className="text-3xl font-bold ">Welcome Back</CardTitle>
            <CardDescription>Sign in to continue your quiz journey</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium ">
                Email
              </Label>
              <Input id="email" type="email" placeholder="Enter your email" className="h-12 border-gray-300 " />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium ">
                Password
              </Label>
              <Input id="password" type="password" placeholder="Enter your password" className="h-12 border-gray-300 " />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox id="remember" />
                <Label htmlFor="remember" className="text-sm ">
                  Remember me
                </Label>
              </div>
              <Link href="#" className="text-sm text-indigo-600 font-medium">
                Forgot password?
              </Link>
            </div>
            <Button className="w-full" onClick={() => router.push("/")}>
              Sign In
            </Button>
            <div className="text-center text-sm ">
              {"Don't have an account? "}
              <button onClick={() => router.push("/register")} className="text-indigo-600">
                Sign up here
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
