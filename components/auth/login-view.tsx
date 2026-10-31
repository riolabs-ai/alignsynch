"use client";

import { AppVersion } from "@/components/layout/app-version";
import { DemoEntry } from "@/components/auth/demo-entry";
import { DemoRoles } from "@/components/auth/demo-roles";
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
import type { DemoViewProps } from "@/lib/auth/demo-form";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";
import { BookOpen, Loader2, Scale, Trophy, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

/**
 * The mark each stat tile draws, by the id the build's fixture declares.
 *
 * An icon is chrome, not copy, so it stays in the view — but which tile is which belongs
 * to the fixture's ids, and a brand may word a tile the quiz build fills with a count
 * (`stats-alignsynch`). An id this map does not know gets the neutral mark rather than a
 * quiz trophy: the tiles are the same shape on both brands, and only the words move.
 */
const STAT_MARKS: Record<string, { icon: LucideIcon; tone: string }> = {
  players: { icon: Trophy, tone: "text-yellow-400" },
  categories: { icon: BookOpen, tone: "text-green-400" },
};

/** The mark for a tile the map above does not name. */
const NEUTRAL_MARK = { icon: Scale, tone: "text-white/80" };

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
 *
 * **The demo block is a prop, not a client decision** (#218). `demo` arrives already resolved by
 * the page (`lib/auth/demo-surface.ts`): `off` renders nothing at all, `entry` renders the anchor
 * to the PIN gate, and `roles` renders the three server-action buttons for a request whose unlock
 * cookie verified. This component never asks for the mode, never reads a cookie and never decides
 * whether the demo exists — a client that could answer that question would be a client that could
 * be talked into answering it wrongly. The general sign-in form above is untouched by the demo:
 * two surfaces, two contracts, one of which is a development door.
 *
 * Two things here are brand-selected rather than shared (issue #225), and both arrive as
 * props: `copy` is already resolved by `lib/auth-copy.ts::loginCopyFor`, so `subtitle` and the
 * `sign-in` card carry the build's brand, and the two tiles under the panel are `copy`'s own
 * items. The quiz build's tiles are two numbers; the alignment build's are two sentences, and
 * the slot is the same. The one number this file owns is `platform.activePlayers` (a snapshot
 * in `data/metrics.ts`, formatted here): it is filled into the fixture's `{count}` placeholder,
 * so a brand whose tile carries no placeholder renders no count at all.
 */
export function LoginView({
  copy,
  next,
  demo,
}: {
  copy: PageCopy;
  next: string;
  demo: DemoViewProps;
}) {
  const router = useRouter();
  const form = sectionOf(copy, "sign-in");
  const stats = sectionOf(copy, "stats");

  /**
   * The one number this page owns: the demo's active-player count, as `data/metrics.ts`
   * records it and `content/metrics.ts` formats it. It reaches a tile through the fixture's
   * `{count}` placeholder — and a brand whose tile carries no placeholder renders none, which
   * is how the alignment build's two sentences take the slots the quiz build fills with
   * numbers.
   */
  const values = { count: formatCompactCount(metric("platform.activePlayers").value, "upper") };

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
      <div className="hidden lg:flex justify-center lg:w-1/2 bg-action relative overflow-hidden">
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
            {stats.items?.map((stat) => {
              const mark = STAT_MARKS[stat.id] ?? NEUTRAL_MARK;
              const Icon = mark.icon;
              return (
                <div
                  key={stat.id}
                  className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center"
                >
                  <Icon className={`w-8 h-8 mx-auto mb-2 ${mark.tone}`} />
                  {stat.value !== undefined && (
                    <div className="text-2xl font-bold">{fillLabel(stat.value, values)}</div>
                  )}
                  <div className="text-sm text-white/80">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </div>
        {/* Decorative Elements */}
        <div className="absolute top-20 right-20 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
        <div className="absolute bottom-20 left-20 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center gap-6 p-8 ">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardHeader className="text-center pb-8">
            <div className="lg:hidden mx-auto mb-4 w-12 h-12 bg-action rounded-lg flex items-center justify-center">
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
              {/*
               * No "Forgot password?" link (issue #272). It was an `href="#"`, and nothing in
               * this app could have been behind it: the Managed Auth client here unwraps
               * `signUp.email`, `signIn.email`, `getSession` and `signOut` only, and no route or
               * form starts a reset. A link that cannot lead anywhere is worse than its absence
               * — this one also promised an account feature the product does not have. It comes
               * back when the reset flow does, pointed at the reset route.
               */}
              <div className="flex items-center space-x-2">
                <Checkbox id="remember" />
                <Label htmlFor="remember" className="text-sm ">
                  {itemLabel(form, "remember")}
                </Label>
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
              <Link href="/register" className="text-action">
                {itemLabel(form, "signup-action")}
              </Link>
            </div>

            {/* The demo surfaces, resolved on the server (#218). `off` renders nothing — no
                disabled control, no hint, the same page this route rendered before the demo. */}
            {demo.kind === "entry" && <DemoEntry copy={copy} />}
            {demo.kind === "roles" && <DemoRoles copy={copy} action={demo.action} />}
          </CardContent>
        </Card>

        {/*
         * The running version, centred directly below the credentials card (issue #269). Below
         * the card and not inside it: the card is the form, the badge is the build, and a
         * version is not something you agree to by signing in.
         */}
        <AppVersion copy={copy} />
      </div>
    </div>
  );
}
