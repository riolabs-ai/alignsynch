"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PageCopy } from "@/content/pages";
import { formatCompactCount } from "@/content/metrics";
import { metric } from "@/data/metrics";
import { authClient } from "@/lib/auth/client";
import { type AuthFailure, authFailureItemId, authFailureOf } from "@/lib/auth/errors";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import { BookOpen, Loader2, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

/**
 * `/login`, the client half — a real sign-in since issue #164.
 *
 * What it was: two uncontrolled inputs and a submit that pushed `/`. Nothing ever reached the auth
 * server, so every password "worked".
 *
 * What it does now, in the order the card lists it:
 *
 *   - `pending`      the button says it is working and refuses a second submit; a double-click on
 *                    a sign-in form is a second session on somebody's device.
 *   - `credentials`  a wrong password renders **"Invalid email or password"** from the fixture.
 *                    Never `error.message` — the SDK's text is written for a developer and can
 *                    echo the identifier back.
 *   - `network`      a request that never arrived says so. This is the state a `catch` around a
 *                    fetch usually swallows into "invalid credentials", which is the one wrong
 *                    answer for a flaky connection.
 *
 * On success the router moves to `next` — the same-site path the *server* put in the URL when it
 * redirected here (`lib/auth/paths.ts`) — and refreshes, so a cached server payload for the
 * protected page is not reused. The component never reads `window.location` to decide where to go.
 *
 * The words stay in `data/pages/login.ts`: this file owns which id it asks for, never the string.
 */
export function LoginView({ copy, next }: { copy: PageCopy; next: string }) {
  const router = useRouter();
  const form = sectionOf(copy, "sign-in");
  const stats = sectionOf(copy, "stats");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<AuthFailure | null>(null);
  const [fieldProblem, setFieldProblem] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (email.trim() === "" || password === "") {
      setFieldProblem(true);
      setFailure(null);
      return;
    }
    setFieldProblem(false);
    setFailure(null);
    setPending(true);

    let result: { error?: unknown } | undefined;
    try {
      result = await authClient.signIn.email({ email: email.trim(), password });
    } catch (error) {
      // Not automatically a transport failure: the SDK throws a normalized `AuthApiError` for any
      // non-2xx answer, so an origin rejection arrives here too (#203). `authFailureOf` decides —
      // only a failure carrying no status and no code is a `network` one.
      setFailure(authFailureOf(error));
      setPending(false);
      return;
    }

    if (result?.error) {
      setFailure(authFailureOf(result.error));
      setPending(false);
      return;
    }

    router.push(next);
    router.refresh();
  };

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
            <h2 className="text-4xl font-bold mb-4">{copy.heading}</h2>
            <p className="text-xl text-white/90 leading-relaxed">{copy.subtitle}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 w-full max-w-md">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
              <Trophy className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
              <div className="text-2xl font-bold">
                {formatCompactCount(metric("platform.activePlayers").value, "upper")}+
              </div>
              <div className="text-sm text-white/80">{itemLabel(stats, "players")}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
              <BookOpen className="w-8 h-8 mx-auto mb-2 text-green-400" />
              <div className="text-2xl font-bold">500+</div>
              <div className="text-sm text-white/80">{itemLabel(stats, "categories")}</div>
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
            <CardTitle className="text-3xl font-bold ">{form.heading}</CardTitle>
            <CardDescription>{form.body}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={submit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium ">
                  {itemLabel(form, "email")}
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={itemLabel(form, "email-placeholder")}
                  className="h-12 border-gray-300 "
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium ">
                  {itemLabel(form, "password")}
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={itemLabel(form, "password-placeholder")}
                  className="h-12 border-gray-300 "
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox id="remember" />
                  <Label htmlFor="remember" className="text-sm ">
                    {itemLabel(form, "remember")}
                  </Label>
                </div>
                <Link href="#" className="text-sm text-indigo-600 font-medium">
                  {itemLabel(form, "forgot")}
                </Link>
              </div>

              {fieldProblem && (
                <Alert variant="destructive">
                  <AlertDescription>{itemLabel(form, "error-required")}</AlertDescription>
                </Alert>
              )}
              {failure !== null && (
                <Alert variant="destructive">
                  <AlertDescription>{itemLabel(form, authFailureItemId(failure))}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={pending}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {pending ? itemLabel(form, "pending") : itemLabel(form, "submit")}
              </Button>
            </form>
            <div className="text-center text-sm ">
              {itemLabel(form, "signup-prompt")}{" "}
              <Link href="/register" className="text-indigo-600">
                {itemLabel(form, "signup-action")}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
