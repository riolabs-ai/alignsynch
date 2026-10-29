import { LoginView } from "@/components/auth/login-view";
import { loginPageCopy } from "@/data/pages/login";

/**
 * `/login`. A server module on purpose: the copy is parsed here (import of
 * `data/pages/login.ts`) and handed to the client view as a prop, so the fixture's zod
 * stays out of the bundle. `data:check` E23 attributes this module and
 * `components/auth/**` to the `/login` surface.
 */
export default function AuthPage() {
  return <LoginView copy={loginPageCopy} />;
}
