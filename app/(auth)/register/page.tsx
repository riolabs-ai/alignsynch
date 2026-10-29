import { RegisterView } from "@/components/auth/register-view";
import { registerPageCopy } from "@/data/pages/register";

/**
 * `/register`. A server module on purpose: the copy is parsed here (import of
 * `data/pages/register.ts`) and handed to the client view as a prop, so the fixture's zod
 * stays out of the bundle. `data:check` E23 attributes this module and `components/auth/**`
 * to the `/register` surface.
 */
export default function AuthPage() {
  return <RegisterView copy={registerPageCopy} />;
}
