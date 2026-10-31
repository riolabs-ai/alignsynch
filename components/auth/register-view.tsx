"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PageCopy } from "@/content/pages";
import { authClient } from "@/lib/auth/client";
import { type AuthFailure, authFailureItemId, authFailureOf } from "@/lib/auth/errors";
import { fillLabel, itemLabel, itemValue, sectionOf } from "@/lib/page-copy";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  Eye,
  EyeOff,
  Gamepad2,
  Globe,
  Link,
  Loader2,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * The onboarding interests, in render order. The ids are the form values and the icons;
 * `data/pages/register.ts` owns the words. These six are the form's own buckets, not the
 * 25-subject `quizCategories` taxonomy — rendering the taxonomy here would be a different
 * product decision, not a copy fix.
 */
const INTERESTS: ReadonlyArray<{ id: string; icon: LucideIcon }> = [
  { id: "general", icon: Brain },
  { id: "science", icon: BookOpen },
  { id: "history", icon: Globe },
  { id: "sports", icon: Trophy },
  { id: "gaming", icon: Gamepad2 },
  { id: "social", icon: Users },
];

/** The step ids, in order. The rail, the header counter and the lookups all read this. */
const STEPS = ["step-1", "step-2", "step-3"] as const;

/**
 * `/register`, the client half. The words come from `data/pages/register.ts`, parsed by
 * `app/(auth)/register/page.tsx` and passed in, because this component is a client
 * boundary and the fixture carries zod.
 */
export function RegisterView({ copy }: { copy: PageCopy }) {
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

  const mobile = sectionOf(copy, "mobile");
  const stepsCopy = sectionOf(copy, "steps");
  const progressCopy = sectionOf(copy, "progress");
  const interestsCopy = sectionOf(copy, "interests");
  const skillCopy = sectionOf(copy, "skill");
  const details = sectionOf(copy, "details");
  const account = sectionOf(copy, "account");
  const navigation = sectionOf(copy, "navigation");

  const handleInterestToggle = (interest: string) => {
    setFormData((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }));
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const nextStep = () => {
    if (currentStep < STEPS.length) setCurrentStep(currentStep + 1);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.interests.length > 0 && formData.skillLevel;
      case 2:
        return formData.firstName && formData.lastName && formData.email && formData.phone;
      case 3:
        return (
          formData.password &&
          formData.confirmPassword &&
          formData.terms &&
          formData.password === formData.confirmPassword
        );
      default:
        return false;
    }
  };

  const router = useRouter();

  /**
   * The sign-up itself (issue #164). Until this card the last step's button did nothing at all.
   *
   * `name` is the auth user's display name — `zUserProfile.displayName` starts from it on
   * `/settings`, so a person who never saves a profile still has a name on their page. The
   * onboarding interests and phone number are not part of the auth user or the profile schema,
   * so they are not sent anywhere: a form field that silently goes nowhere is worse than one the
   * product does not ask for yet.
   */
  const status = sectionOf(copy, "status");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<AuthFailure | null>(null);
  const [requiredMissing, setRequiredMissing] = useState(false);

  const createAccount = async () => {
    setFailure(null);
    setRequiredMissing(false);
    const name = `${formData.firstName} ${formData.lastName}`.trim();
    if (name === "" || formData.email.trim() === "" || formData.password === "") {
      setRequiredMissing(true);
      return;
    }

    setPending(true);
    let result: { error?: unknown } | undefined;
    try {
      result = await authClient.signUp.email({
        email: formData.email.trim(),
        password: formData.password,
        name,
      });
    } catch (error) {
      // A thrown value is **not** by itself a transport failure: `@neon/auth` throws a normalized
      // `AuthApiError` for every non-2xx answer, a 403 origin rejection included (#203). Classify
      // it exactly like a returned `{ error }`; `authFailureOf` is what decides whether the
      // transport is implicated, and only a failure with no status and no code reads as `network`.
      setFailure(authFailureOf(error));
      setPending(false);
      return;
    }

    if (result?.error) {
      setFailure(authFailureOf(result.error));
      setPending(false);
      return;
    }

    // Into the product, not onto `/`: the session the sign-up just created is what the
    // account page reads, so this is also the first proof to the person that it worked.
    router.push("/dashboard/user");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Image/Illustration */}
      <div className="hidden lg:flex lg:w-1/2 bg-action relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative mx-auto z-10 flex flex-col justify-center items-center text-white p-12">
          <div className="text-center mb-8">
            <div className="w-24 h-24 bg-white/20 rounded-3xl flex items-center justify-center mb-6 backdrop-blur-sm mx-auto">
              <BookOpen className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-4xl font-bold mb-4">{copy.heading}</h1>
            <p className="text-xl text-white/90 leading-relaxed mb-8">{copy.subtitle}</p>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center space-x-4 mb-8">
            {STEPS.map((stepId, index) => (
              <div key={stepId} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 font-semibold transition-all ${currentStep >= index + 1 ? "bg-white text-action border-white" : "border-white/50 text-white/70"}`}
                >
                  {index + 1}
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`w-12 h-0.5 mx-2 ${currentStep > index + 1 ? "bg-white" : "bg-white/30"}`}
                  ></div>
                )}
              </div>
            ))}
          </div>

          <div className="text-center">
            <div className="text-lg font-semibold mb-2">
              {itemLabel(stepsCopy, STEPS[currentStep - 1])}
            </div>
            <div className="text-white/80">{itemValue(stepsCopy, STEPS[currentStep - 1])}</div>
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
            <div className="mx-auto mb-4 w-16 h-16 bg-action rounded-xl flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold  mb-2">{mobile.heading}</h1>
            <p>{mobile.body}</p>
          </div>

          {/* Form Card */}
          <Card className="shadow-xl border-0">
            <CardHeader className="pb-6">
              <CardTitle className="text-2xl font-bold">
                {fillLabel(itemLabel(progressCopy, "label"), {
                  step: currentStep,
                  total: STEPS.length,
                })}
              </CardTitle>
              <CardDescription>{itemValue(stepsCopy, STEPS[currentStep - 1])}</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Step 1: Quiz Interests */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <Label className="text-base font-semibold mb-4 block">
                      {interestsCopy.heading}
                    </Label>
                    <div className="grid grid-cols-1 gap-3">
                      {INTERESTS.map(({ id, icon: Icon }) => {
                        return (
                          <div
                            key={id}
                            onClick={() => handleInterestToggle(id)}
                            className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${formData.interests.includes(id) ? "border-action bg-action/20" : "border-gray-200 dark:border-neutral-500 hover:border-gray-300"}`}
                          >
                            <div className="flex items-center space-x-3">
                              <Icon
                                className={`w-5 h-5 ${formData.interests.includes(id) ? "text-action" : "text-gray-400"}`}
                              />
                              <span className="font-medium">{itemLabel(interestsCopy, id)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="skillLevel" className="text-base font-semibold">
                      {skillCopy.heading}
                    </Label>
                    <Select
                      value={formData.skillLevel}
                      onValueChange={(value) => handleInputChange("skillLevel", value)}
                    >
                      <SelectTrigger className="mt-2 h-12">
                        <SelectValue placeholder={itemLabel(skillCopy, "placeholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">{itemLabel(skillCopy, "beginner")}</SelectItem>
                        <SelectItem value="intermediate">
                          {itemLabel(skillCopy, "intermediate")}
                        </SelectItem>
                        <SelectItem value="advanced">{itemLabel(skillCopy, "advanced")}</SelectItem>
                        <SelectItem value="expert">{itemLabel(skillCopy, "expert")}</SelectItem>
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
                        {itemLabel(details, "first-name")}
                      </Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => handleInputChange("firstName", e.target.value)}
                        placeholder={itemLabel(details, "first-name-placeholder")}
                        className="h-12 mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName" className="text-sm font-medium ">
                        {itemLabel(details, "last-name")}
                      </Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => handleInputChange("lastName", e.target.value)}
                        placeholder={itemLabel(details, "last-name-placeholder")}
                        className="h-12 mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="email" className="text-sm font-medium ">
                      {itemLabel(details, "email")}
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      placeholder={itemLabel(details, "email-placeholder")}
                      className="h-12 mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone" className="text-sm font-medium ">
                      {itemLabel(details, "phone")}
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      placeholder={itemLabel(details, "phone-placeholder")}
                      className="h-12 mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="dateOfBirth" className="text-sm font-medium ">
                        {itemLabel(details, "date-of-birth")}
                      </Label>
                      <Input
                        id="dateOfBirth"
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={(e) => handleInputChange("dateOfBirth", e.target.value)}
                        className="h-12 mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="country" className="text-sm font-medium ">
                        {itemLabel(details, "country")}
                      </Label>
                      <Select
                        value={formData.country}
                        onValueChange={(value) => handleInputChange("country", value)}
                      >
                        <SelectTrigger className="h-12 mt-1">
                          <SelectValue placeholder={itemLabel(details, "country-placeholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="us">{itemLabel(details, "country-us")}</SelectItem>
                          <SelectItem value="uk">{itemLabel(details, "country-uk")}</SelectItem>
                          <SelectItem value="ca">{itemLabel(details, "country-ca")}</SelectItem>
                          <SelectItem value="au">{itemLabel(details, "country-au")}</SelectItem>
                          <SelectItem value="de">{itemLabel(details, "country-de")}</SelectItem>
                          <SelectItem value="fr">{itemLabel(details, "country-fr")}</SelectItem>
                          <SelectItem value="other">
                            {itemLabel(details, "country-other")}
                          </SelectItem>
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
                      {itemLabel(account, "password")}
                    </Label>
                    <div className="relative mt-1">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={formData.password}
                        onChange={(e) => handleInputChange("password", e.target.value)}
                        placeholder={itemLabel(account, "password-placeholder")}
                        className="h-12 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {itemLabel(account, "password-hint")}
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword" className="text-sm font-medium ">
                      {itemLabel(account, "confirm-password")}
                    </Label>
                    <div className="relative mt-1">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={formData.confirmPassword}
                        onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                        placeholder={itemLabel(account, "confirm-placeholder")}
                        className="h-12 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                      <p className="text-xs text-red-500 mt-1">{itemLabel(account, "mismatch")}</p>
                    )}
                  </div>

                  <div className="space-y-3 pt-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="newsletter"
                        checked={formData.newsletter}
                        onCheckedChange={(checked) =>
                          handleInputChange("newsletter", checked as boolean)
                        }
                      />
                      <Label htmlFor="newsletter" className="text-sm ">
                        {itemLabel(account, "newsletter")}
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="terms"
                        checked={formData.terms}
                        onCheckedChange={(checked) =>
                          handleInputChange("terms", checked as boolean)
                        }
                      />
                      <Label htmlFor="terms" className="text-sm ">
                        {itemLabel(account, "agree-prefix")}{" "}
                        <Link href="#" className="text-action hover:underline">
                          {itemLabel(account, "agree-terms")}
                        </Link>{" "}
                        {itemLabel(account, "agree-and")}{" "}
                        <Link href="#" className="text-action hover:underline">
                          {itemLabel(account, "agree-privacy")}
                        </Link>{" "}
                        *
                      </Label>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              {requiredMissing && (
                <Alert variant="destructive">
                  <AlertDescription>{itemLabel(status, "error-required")}</AlertDescription>
                </Alert>
              )}
              {failure !== null && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {itemLabel(status, authFailureItemId(failure))}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-between pt-6">
                <Button variant="outline" onClick={() => router.push("/login")}>
                  <ArrowLeft className="w-4 h-4" />
                  <span>
                    {currentStep === 1
                      ? itemLabel(navigation, "back-to-login")
                      : itemLabel(navigation, "back")}
                  </span>
                </Button>

                {currentStep < 3 ? (
                  <Button onClick={nextStep} disabled={!canProceed()}>
                    <span>{itemLabel(navigation, "next")}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button onClick={createAccount} disabled={!canProceed() || pending}>
                    {pending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <span>
                      {pending
                        ? itemLabel(status, "pending")
                        : itemLabel(navigation, "create-account")}
                    </span>
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
