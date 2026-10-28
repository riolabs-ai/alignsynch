"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, BookOpen, Brain, Eye, EyeOff, Gamepad2, Globe, Link, Trophy, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AuthPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    // Step 1: Quiz Interests
    interests: [] as string[],
    skillLevel: "",
    preferredTopics: [] as string[],

    // Step 2: Personal Details
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    country: "",

    // Step 3: Account Setup
    password: "",
    confirmPassword: "",
    newsletter: false,
    terms: false,
  });

  const quizCategories = [
    { id: "general", label: "General Knowledge", icon: Brain },
    { id: "science", label: "Science & Technology", icon: BookOpen },
    { id: "history", label: "History & Geography", icon: Globe },
    { id: "sports", label: "Sports & Entertainment", icon: Trophy },
    { id: "gaming", label: "Gaming & Pop Culture", icon: Gamepad2 },
    { id: "social", label: "Social & Current Events", icon: Users },
  ];

  const steps = [
    { number: 1, title: "Quiz Interests", description: "Tell us what you love" },
    { number: 2, title: "Personal Details", description: "Your basic information" },
    { number: 3, title: "Account Setup", description: "Secure your account" },
  ];

  const handleInterestToggle = (interest: string) => {
    setFormData((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest) ? prev.interests.filter((i) => i !== interest) : [...prev.interests, interest],
    }));
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const nextStep = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.interests.length > 0 && formData.skillLevel;
      case 2:
        return formData.firstName && formData.lastName && formData.email && formData.phone;
      case 3:
        return formData.password && formData.confirmPassword && formData.terms && formData.password === formData.confirmPassword;
      default:
        return false;
    }
  };

  const router = useRouter();

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Image/Illustration */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative mx-auto z-10 flex flex-col justify-center items-center text-white p-12">
          <div className="text-center mb-8">
            <div className="w-24 h-24 bg-white/20 rounded-3xl flex items-center justify-center mb-6 backdrop-blur-sm mx-auto">
              <BookOpen className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-4xl font-bold mb-4">Join the Quiz Revolution</h1>
            <p className="text-xl text-white/90 leading-relaxed mb-8">Discover your potential, challenge your friends, and become a quiz champion</p>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center space-x-4 mb-8">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 font-semibold transition-all ${currentStep >= step.number ? "bg-white text-indigo-600 border-white" : "border-white/50 text-white/70"}`}>{step.number}</div>
                {index < steps.length - 1 && <div className={`w-12 h-0.5 mx-2 ${currentStep > step.number ? "bg-white" : "bg-white/30"}`}></div>}
              </div>
            ))}
          </div>

          <div className="text-center">
            <div className="text-lg font-semibold mb-2">{steps[currentStep - 1].title}</div>
            <div className="text-white/80">{steps[currentStep - 1].description}</div>
          </div>

          {/* Decorative Elements */}
          <div className="absolute top-20 right-20 w-32 h-32 bg-white/10 rounded-full blur-xl animate-pulse"></div>
          <div className="absolute bottom-20 left-20 w-24 h-24 bg-white/10 rounded-full blur-xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-10 w-16 h-16 bg-white/10 rounded-full blur-lg animate-pulse delay-500"></div>
        </div>
      </div>

      {/* Right Side - Registration Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 ">
        <div className="w-full max-w-lg">
          {/* Mobile Header */}
          <div className="lg:hidden text-center mb-8">
            <div className="mx-auto mb-4 w-16 h-16 bg-indigo-600 rounded-xl flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold  mb-2">Join QuizHub</h1>
            <p>Create your account and start your quiz adventure</p>
          </div>

          {/* Form Card */}
          <Card className="shadow-xl border-0">
            <CardHeader className="pb-6">
              <CardTitle className="text-2xl font-bold">Step {currentStep} of 3</CardTitle>
              <CardDescription>{steps[currentStep - 1].description}</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Step 1: Quiz Interests */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <Label className="text-base font-semibold mb-4 block">What types of quizzes interest you? *</Label>
                    <div className="grid grid-cols-1 gap-3">
                      {quizCategories.map((category) => {
                        const Icon = category.icon;
                        return (
                          <div key={category.id} onClick={() => handleInterestToggle(category.id)} className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${formData.interests.includes(category.id) ? "border-indigo-600 bg-indigo-500/20" : "border-gray-200 dark:border-neutral-500 hover:border-gray-300"}`}>
                            <div className="flex items-center space-x-3">
                              <Icon className={`w-5 h-5 ${formData.interests.includes(category.id) ? "text-indigo-600" : "text-gray-400"}`} />
                              <span className="font-medium">{category.label}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="skillLevel" className="text-base font-semibold">
                      What's your quiz skill level? *
                    </Label>
                    <Select value={formData.skillLevel} onValueChange={(value) => handleInputChange("skillLevel", value)}>
                      <SelectTrigger className="mt-2 h-12">
                        <SelectValue placeholder="Select your skill level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner - Just getting started</SelectItem>
                        <SelectItem value="intermediate">Intermediate - I know my way around</SelectItem>
                        <SelectItem value="advanced">Advanced - Bring on the challenge!</SelectItem>
                        <SelectItem value="expert">Expert - Quiz master level</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Step 2: Personal Details */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName" className="text-sm font-medium ">
                        First Name *
                      </Label>
                      <Input id="firstName" value={formData.firstName} onChange={(e) => handleInputChange("firstName", e.target.value)} placeholder="John" className="h-12 mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="lastName" className="text-sm font-medium ">
                        Last Name *
                      </Label>
                      <Input id="lastName" value={formData.lastName} onChange={(e) => handleInputChange("lastName", e.target.value)} placeholder="Smith" className="h-12 mt-1" />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="email" className="text-sm font-medium ">
                      Email *
                    </Label>
                    <Input id="email" type="email" value={formData.email} onChange={(e) => handleInputChange("email", e.target.value)} placeholder="john@example.com" className="h-12 mt-1" />
                  </div>

                  <div>
                    <Label htmlFor="phone" className="text-sm font-medium ">
                      Phone Number *
                    </Label>
                    <Input id="phone" type="tel" value={formData.phone} onChange={(e) => handleInputChange("phone", e.target.value)} placeholder="+1 (555) 123-4567" className="h-12 mt-1" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="dateOfBirth" className="text-sm font-medium ">
                        Date of Birth
                      </Label>
                      <Input id="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={(e) => handleInputChange("dateOfBirth", e.target.value)} className="h-12 mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="country" className="text-sm font-medium ">
                        Country
                      </Label>
                      <Select value={formData.country} onValueChange={(value) => handleInputChange("country", value)}>
                        <SelectTrigger className="h-12 mt-1">
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="us">United States</SelectItem>
                          <SelectItem value="uk">United Kingdom</SelectItem>
                          <SelectItem value="ca">Canada</SelectItem>
                          <SelectItem value="au">Australia</SelectItem>
                          <SelectItem value="de">Germany</SelectItem>
                          <SelectItem value="fr">France</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Account Setup */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="password" className="text-sm font-medium ">
                      Password *
                    </Label>
                    <div className="relative mt-1">
                      <Input id="password" type={showPassword ? "text" : "password"} value={formData.password} onChange={(e) => handleInputChange("password", e.target.value)} placeholder="Create a strong password" className="h-12 pr-10" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Password must be at least 8 characters long</p>
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword" className="text-sm font-medium ">
                      Confirm Password *
                    </Label>
                    <div className="relative mt-1">
                      <Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} value={formData.confirmPassword} onChange={(e) => handleInputChange("confirmPassword", e.target.value)} placeholder="Confirm your password" className="h-12 pr-10" />
                      <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    {formData.confirmPassword && formData.password !== formData.confirmPassword && <p className="text-xs text-red-500 mt-1">Passwords do not match</p>}
                  </div>

                  <div className="space-y-3 pt-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="newsletter" checked={formData.newsletter} onCheckedChange={(checked) => handleInputChange("newsletter", checked as boolean)} />
                      <Label htmlFor="newsletter" className="text-sm ">
                        Subscribe to our newsletter for quiz updates and tips
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox id="terms" checked={formData.terms} onCheckedChange={(checked) => handleInputChange("terms", checked as boolean)} />
                      <Label htmlFor="terms" className="text-sm ">
                        I agree to the{" "}
                        <Link href="#" className="text-indigo-600 hover:underline">
                          Terms of Service
                        </Link>{" "}
                        and{" "}
                        <Link href="#" className="text-indigo-600 hover:underline">
                          Privacy Policy
                        </Link>{" "}
                        *
                      </Label>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between pt-6">
                <Button variant="outline" onClick={() => router.push("/login")}>
                  <ArrowLeft className="w-4 h-4" />
                  <span>{currentStep === 1 ? "Back to Login" : "Back"}</span>
                </Button>

                {currentStep < 3 ? (
                  <Button onClick={nextStep} disabled={!canProceed()}>
                    <span>Next</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button disabled={!canProceed()}>
                    <span>Create Account</span>
                    <Trophy className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
