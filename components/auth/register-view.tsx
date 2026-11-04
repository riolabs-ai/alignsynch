"use client";

// template-ancestor: components/auth/login-view.tsx   (variation: the same card with name, username and role fields and a confirm-password row)

import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthHomeLink } from "@/components/auth/auth-home-link";
import { PasswordStrengthMeter } from "@/components/auth/password-strength";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormSurface } from "@/components/ui/form-surface";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PageCopy } from "@/content/pages";
import { authClient } from "@/lib/auth/client";
import { type AuthFailure, authFailureItemId, authFailureOf } from "@/lib/auth/errors";
import type { AuthMarkSet } from "@/lib/auth/marks";
import { loginPathFor } from "@/lib/auth/paths";
import { markGroundClass, MARK_ICONS, MarkGlyph } from "@/components/auth/mark-icon";
import { fillLabel, itemLabel, itemValue, sectionOf } from "@/lib/page-copy";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

/** The step ids, in order. The rail, the header counter and the lookups all read this. */
const STEPS = ["step-1", "step-2"] as const;

/**
 * Re-exported for `tests/register-view.test.tsx`, which proves every id a brand can name has a
 * glyph. The table itself is `components/auth/mark-icon.tsx`: it moved out of this file when the
 * 404 — a server module — needed the same table, and a server component cannot read a value from
 * a `"use client"` module. One table, two boundaries.
 */
export { MARK_ICONS };

/**
 * `/register`, the client half. The words come from `data/pages/register.ts`, parsed by
 * `app/(auth)/register/page.tsx` and passed in, because this component is a client
 * boundary and the fixture carries zod.
 *
 * Two steps since #291: personal details, then the account. The flow used to open on a
 * quiz-interests and quiz-skill step that both brands rendered and nothing read; it is
 * gone, so the component carries no interest state, no skill state and no newsletter
 * opt-in next to a newsletter that does not exist.
 *
 * `destination` is this build's post-sign-in page (#351), for the same reason `copy` is a prop:
 * the brand is a server decision. It used to be the literal `/dashboard/user` below, which is the
 * quiz product's account home — a 404 on the alignment build, so a successful sign-up there landed
 * on a not-found page. The value is `AFTER_SIGN_IN_BY_BRAND[brandId]` (`lib/auth/paths.ts`), and
 * this component never learns which brand it is.
 *
 * `marks` is the same arrangement for the page's glyphs: this screen drew `BookOpen` and `Trophy`
 * unconditionally, so the alignment build's sign-up page showed a quiz book and a quiz trophy.
 * The server hands over an `AuthMarkSet` (`lib/auth/marks.ts`) — ids, resolved to glyphs by
 * `MARK_ICONS` (`components/auth/mark-icon.tsx`, re-exported above) — and QuizHub's two ids are
 * the two components that used to be written here, so that brand renders what it always rendered.
 */
export function RegisterView({
  copy,
  destination,
  marks,
  markSrc,
}: {
  copy: PageCopy;
  destination: string;
  marks: AuthMarkSet;
  /**
   * The image the `brand-mark` id draws (`AUTH_MARK_SRC_BY_BRAND`) — the brand's generated app
   * mark, handed down for every brand and read by the one whose hero names that id.
   */
  markSrc: string;
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    // Step 1: the email address, and nothing else.
    email: "",

    // Step 2: the name, then the credentials.
    firstName: "",
    lastName: "",
    password: "",
    confirmPassword: "",
    terms: false,
  });

  const mobile = sectionOf(copy, "mobile");
  const stepsCopy = sectionOf(copy, "steps");
  const progressCopy = sectionOf(copy, "progress");
  const details = sectionOf(copy, "details");
  const account = sectionOf(copy, "account");
  const navigation = sectionOf(copy, "navigation");
  /** The way back to the site — every auth screen carries one (`auth-home-link.tsx`). */
  const home = sectionOf(copy, "home");

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const nextStep = () => {
    if (currentStep < STEPS.length) setCurrentStep(currentStep + 1);
  };

  /**
   * Whether the current step's required fields are filled. Step 1 asks one question, so it needs
   * one answer; the two name fields are required on step 2 (their labels carry the `*`) and are
   * checked here — a field the server-side check below refuses must not be reachable through Next.
   */
  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.email.trim() !== "";
      case 2:
        return (
          formData.firstName.trim() !== "" &&
          formData.lastName.trim() !== "" &&
          formData.password !== "" &&
          formData.confirmPassword !== "" &&
          formData.terms &&
          formData.password === formData.confirmPassword
        );
      default:
        return false;
    }
  };

  const router = useRouter();

  /**
   * The sign-up itself (issue #164). Until that card the last step's button did nothing at all.
   *
   * `name` is the auth user's display name — `zUserProfile.displayName` starts from it on
   * `/settings`, so a person who never saves a profile still has a name on their page. Sign-up
   * collects the identity the account needs and nothing else: the phone number, date of birth and
   * country used to sit on step 1 and went nowhere (they are not part of the auth user or the
   * profile schema), so they were removed rather than kept as fields with no reader — `/settings`
   * is where the profile asks for country, and it owns that question. (The quiz-interests and
   * skill-level fields had the same problem and were removed outright in #291.)
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
    // destination reads, so this is also the first proof to the person that it worked. The page is
    // the build's own (#351) — the server decided which one, so this line cannot send an
    // AlignSynch sign-up to a route that brand does not ship.
    router.push(destination);
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
              <MarkGlyph id={marks.hero} src={markSrc} className="w-12 h-12 text-white" />
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
          {/* The way back to the site, above everything else on the screen. */}
          <div className="mb-6">
            <AuthHomeLink label={itemLabel(home, "back")} />
          </div>
          {/* Mobile Header */}
          <div className="lg:hidden text-center mb-8">
            <div
              className={`mx-auto mb-4 w-16 h-16 ${markGroundClass(marks.hero)} rounded-xl flex items-center justify-center`}
            >
              <MarkGlyph id={marks.hero} src={markSrc} className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold  mb-2">{mobile.heading}</h1>
            <p>{mobile.body}</p>
          </div>

          {/* Form Card */}
          <FormSurface>
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
              {/* Step 1: the email address only */}
              {currentStep === 1 && (
                <div className="space-y-4">
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
                </div>
              )}

              {/* Step 2: the name, then the account */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName" className="text-sm font-medium ">
                        {itemLabel(account, "first-name")}
                      </Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => handleInputChange("firstName", e.target.value)}
                        placeholder={itemLabel(account, "first-name-placeholder")}
                        className="h-12 mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName" className="text-sm font-medium ">
                        {itemLabel(account, "last-name")}
                      </Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => handleInputChange("lastName", e.target.value)}
                        placeholder={itemLabel(account, "last-name-placeholder")}
                        className="h-12 mt-1"
                      />
                    </div>
                  </div>

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
                    {/*
                      The strength meter, under the field it describes. It reads the value the
                      person is typing, so it moves with every keystroke — and it is advice only:
                      nothing here disables the Create Account button or refuses a password the
                      server would accept.
                    */}
                    <PasswordStrengthMeter value={formData.password} copy={copy} />
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
                        id="terms"
                        checked={formData.terms}
                        onCheckedChange={(checked) =>
                          handleInputChange("terms", checked as boolean)
                        }
                      />
                      <Label htmlFor="terms" className="text-sm ">
                        {itemLabel(account, "agree-prefix")}{" "}
                        <Link href="/terms" className="text-action hover:underline">
                          {itemLabel(account, "agree-terms")}
                        </Link>{" "}
                        {itemLabel(account, "agree-and")}{" "}
                        <Link href="/privacy" className="text-action hover:underline">
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
                <Button variant="outline" onClick={() => router.push(loginPathFor(destination))}>
                  <ArrowLeft className="w-4 h-4" />
                  <span>
                    {currentStep === 1
                      ? itemLabel(navigation, "back-to-login")
                      : itemLabel(navigation, "back")}
                  </span>
                </Button>

                {currentStep < STEPS.length ? (
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
                    <MarkGlyph id={marks.action} src={markSrc} className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </FormSurface>
        </div>
      </div>
    </div>
  );
}
