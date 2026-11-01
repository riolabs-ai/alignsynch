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
import { type AuthFailure, authFailureOf } from "@/lib/auth/errors";
import type { StartGoogleSignInResult } from "@/lib/auth/google-flow";
import { type SignInRefusal, signInRefusalItemId } from "@/lib/auth/provider-link";
import type { DemoViewProps } from "@/lib/auth/demo-form";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";
import { BookOpen, Loader2, Scale, Trophy, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";

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
 *   - `google`       the same 401, for an account that has no password because it was created
 *                    with the Google button. The auth server cannot say which cause it was (one
 *                    code for both, on purpose), so `providerHint` is asked — a server action
 *                    that reads the account's provider rows — and the refusal is upgraded to
 *                    the fixture's Google sentence. Nothing about a password is claimed.
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
 *
 * **The Google button (issue #281)** sits above the form, because it is the shorter path and
 * the form is the fallback — one button, no provider picker. It is drawn by this component for
 * both brands from the fixture's `google` section (the surface's copy budget is 0, so not one
 * word of it is typed here). Where it must **not** be drawn is inside the desktop shell
 * (#280): Google refuses its OAuth flow in an embedded webview (`403 disallowed_useragent`),
 * so a button there is a guaranteed dead end. That card has not landed, and there is no shell
 * in this tree to detect, so the guard is *pending* rather than guessed — when #280 lands it
 * belongs here as one boolean prop resolved on the server, the way `demo` already arrives,
 * never a `navigator.userAgent` check in a client component.
 *
 * **The Google-only refusal** is the second half of #281 and the one place this form asks the
 * server a question of its own. `signIn.email` answers `INVALID_EMAIL_OR_PASSWORD` for a wrong
 * password *and* for an account that has no password because it was created with Google — one
 * code for both, deliberately, so the endpoint cannot be used to discover accounts. The cause is
 * still knowable from the provider rows, so after a `credentials` refusal the form calls
 * `providerHint(address)` — a server action, wired by the page — and upgrades the refusal to
 * `google-account` when it answers true. The person then reads the fixture's Google sentence and
 * is pointed at the button above; nobody is told their password is wrong.
 *
 * Two properties that upgrade keeps:
 *
 *   - **It only ever *adds* a cause.** The ordinary `credentials` sentence renders first, so a
 *     slow lookup, a deployment with no database, or an address with no account at all leaves
 *     the form exactly as it was. A lookup that fails never turns a refusal into a claim.
 *   - **It cannot outlive its own attempt.** Every submit takes a ticket (`useRef`); a reply
 *     that arrives after the person has submitted again, or pressed the Google button, is
 *     dropped instead of relabelling the newer attempt.
 */
export function LoginView({
  copy,
  next,
  demo,
  providerHint,
  startGoogle: startGoogleFlow,
}: {
  copy: PageCopy;
  next: string;
  demo: DemoViewProps;
  /**
   * "Does this address exist only as a Google account?" — a server action from
   * `app/(auth)/login/provider-hint-actions.ts`, wired by the page. `true` is the only answer
   * that changes what the form says; `false`, a rejection and a slow reply all leave the
   * ordinary refusal in place.
   */
  providerHint: (email: string) => Promise<boolean>;
  /**
   * "Start a Google sign-in" — the server action from `app/(auth)/login/google-actions.ts`, wired
   * by the page the way the demo actions are. The browser never learns the auth URL, never holds
   * the session challenge and never composes a `callbackURL`: it asks, and is handed one address on
   * Neon's own origin to navigate to (`lib/auth/google-flow-neon.ts` explains why the hop moved).
   */
  startGoogle: (next: string) => Promise<StartGoogleSignInResult>;
}) {
  const router = useRouter();
  const form = sectionOf(copy, "sign-in");
  const stats = sectionOf(copy, "stats");
  /** The legal row under the card (issue #270); the two ids are the fixture's. */
  const legal = sectionOf(copy, "legal");
  /** The Google button's three strings (issue #281). */
  const google = sectionOf(copy, "google");

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
  const [googlePending, setGooglePending] = useState(false);
  const [refusal, setRefusal] = useState<SignInRefusal | null>(null);
  const [fieldProblem, setFieldProblem] = useState(false);

  /**
   * The current attempt, as a number. A server answer is applied only if the attempt it was
   * asked for is still the latest one — the guard that stops a slow provider lookup from
   * relabelling a second submit (or a Google click) that has already replaced it.
   */
  const attempt = useRef(0);

  /**
   * Render a refusal, and — only for a rejected password — ask the server whether the address
   * is a Google-only account. The ordinary sentence goes up first: the answer is an
   * explanation, so nothing waits for it, and a lookup that cannot answer changes nothing.
   */
  const refuse = (error: unknown, address: string, ticket: number) => {
    const kind: AuthFailure = authFailureOf(error);
    setRefusal(kind);
    setPending(false);
    if (kind !== "invalid-credentials") return;

    void providerHint(address).then(
      (googleOnly) => {
        if (googleOnly && attempt.current === ticket) setRefusal("google-account");
      },
      () => undefined, // an explanation that could not be fetched is not a failed sign-in
    );
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ticket = attempt.current + 1;
    attempt.current = ticket;
    const address = email.trim();

    if (address === "" || password === "") {
      setFieldProblem(true);
      setRefusal(null);
      return;
    }
    setFieldProblem(false);
    setRefusal(null);
    setPending(true);

    let result: { error?: unknown } | undefined;
    try {
      result = await authClient.signIn.email({ email: address, password });
    } catch (error) {
      // Not automatically a transport failure: the SDK throws a normalized `AuthApiError` for any
      // non-2xx answer, so an origin rejection arrives here too (#203) — and so does a wrong
      // password. `authFailureOf` decides; `refuse` then asks the one question it cannot answer.
      refuse(error, address, ticket);
      return;
    }

    if (result?.error) {
      refuse(result.error, address, ticket);
      return;
    }

    router.push(next);
    router.refresh();
  };

  /**
   * Start the Google flow (#281, re-wired by #351's follow-up).
   *
   * The button no longer talks to the auth server: it calls `startGoogleSignIn`, a server action
   * (`app/(auth)/login/google-actions.ts`), and is handed back the URL of Neon's own init page to
   * navigate to. The reason is a pair of cookies that fall out of **whichever response answers
   * `sign-in/social`**: the OAuth *state* must live on Neon's origin (the callback runs there), and
   * the session *challenge* must live where the verifier is exchanged — which, before this card,
   * was nowhere, because a browser-side call put both on Neon's origin and nothing here could read
   * the challenge (`HttpOnly`, their host). Started by our server, the challenge arrives in our
   * response and `lib/auth/google-flow.ts` keeps it in a cookie of our own. The state still comes
   * from Neon's init page, so #350's `state_mismatch` stays fixed. `lib/auth/google-flow-neon.ts`
   * carries the full measured argument.
   *
   * A refusal reaches the same `failure` state the password form uses, so the person reads the
   * fixture's sentence for the cause it actually was — `origin` when the address is not on the
   * branch's trusted-domain list, `network` when the request never left. There is no success
   * branch: `location.assign` has already started the navigation, and clearing `pending` would
   * only flash an idle button during it.
   */
  const startGoogle = async () => {
    // A new attempt: a provider lookup still in flight for the password form must not relabel
    // the refusal this click may produce.
    const ticket = attempt.current + 1;
    attempt.current = ticket;
    setFieldProblem(false);
    setRefusal(null);
    setGooglePending(true);

    try {
      const started = await startGoogleFlow(next);
      if (!started.ok) {
        // A reply that arrives after a newer attempt was started is dropped, the same rule the
        // password form's `refuse()` follows.
        if (attempt.current === ticket) {
          setRefusal(started.failure);
          setGooglePending(false);
        }
        return;
      }
      window.location.assign(started.url);
    } catch (error) {
      setRefusal(authFailureOf(error));
      setGooglePending(false);
    }
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
            {/*
             * The Google button (issue #281), above the form because it is the shorter path:
             * one button, no provider picker. `type="button"` — a `<button>` outside the form
             * still defaults to submit in older user agents, and a stray submit would run the
             * password handler over two empty fields.
             */}
            <div className="space-y-4">
              <Button
                type="button"
                variant="outline"
                className="w-full h-12"
                onClick={startGoogle}
                disabled={googlePending || pending}
              >
                {googlePending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {googlePending ? itemLabel(google, "pending") : itemLabel(google, "label")}
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <span className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    {itemLabel(google, "divider")}
                  </span>
                </div>
              </div>
            </div>

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
               * No "Forgot password?" link (issue #272). Its `href` was a bare hash, and nothing in
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
              {refusal !== null && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {itemLabel(form, signInRefusalItemId(refusal))}
                  </AlertDescription>
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

        {/*
         * The legal row (issue #270): the two documents a person can read before they agree to
         * anything. Below the badge and outside the card, because these are documents about the
         * product, not fields of the form — and they are the same two destinations the footer
         * carries, so a reader who lands here first is not the only one without them.
         */}
        <div className="mt-4 flex items-center justify-center gap-3 text-xs text-muted-foreground">
          <Link href="/terms" className="hover:text-action hover:underline">
            {itemLabel(legal, "terms")}
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/privacy" className="hover:text-action hover:underline">
            {itemLabel(legal, "privacy")}
          </Link>
        </div>
      </div>
    </div>
  );
}
