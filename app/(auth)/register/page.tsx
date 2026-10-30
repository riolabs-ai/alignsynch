import { RegisterView } from "@/components/auth/register-view";
import { brand, brandIdOf } from "@/data/brand";
import { registerPageCopy } from "@/data/pages/register";
import { registerCopyFor } from "@/lib/auth-copy";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up",
};

/**
 * `/register`. A server module on purpose: the copy is parsed here (import of
 * `data/pages/register.ts`) and handed to the client view as a prop, so the fixture's zod
 * stays out of the bundle. `data:check` E23 attributes this module and `components/auth/**`
 * to the `/register` surface.
 *
 * The brand is resolved here too (issue #225), exactly like `/login`: `registerCopyFor`
 * swaps the hero and the mobile header's line for the build's brand and leaves the wizard
 * alone — its steps, its interests, its skill level are one product's onboarding, and
 * replacing them is a product decision with its own card.
 */
export default function AuthPage() {
  return <RegisterView copy={registerCopyFor(registerPageCopy, brandIdOf(brand))} />;
}
