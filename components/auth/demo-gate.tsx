"use client";

/**
 * The PIN gate — one field, one submit, and nothing else that could sign anyone in (#218).
 *
 * What this component does **not** have is the point of it: no role buttons, no email field, no
 * password field, no account list, no credential in a prop. It posts one PIN to a server action;
 * the action compares it and answers with a redirect to `/login`, where the three role buttons
 * appear only for a request carrying the signed unlock cookie that action set. A browser that
 * reads every byte of this bundle, every form value and every RSC payload learns that a PIN is
 * asked for and nothing that could be used to sign in anywhere.
 *
 * **The four-digit field is shaping, not checking.** `inputMode`, `pattern` and `maxLength` make a
 * phone keyboard numeric and stop a fifth digit from being typed. They are not a second PIN
 * comparison: the server still runs `pinMatches()` in constant time over whatever arrived, and a
 * wrong length costs the caller an attempt exactly like a wrong value (`app/(auth)/demo/actions.ts`).
 *
 * **The copy is a literal on purpose.** `/demo` is a development surface: it renders only under
 * `DEMO_AUTH=1`, it has no `PageCopy` fixture in `data/pages/`, and a fixture would put its words
 * on the same table every product page's copy is counted in (E23). The one sentence a failure can
 * render still comes from the server (`lib/auth/demo-pin.ts`, `lib/auth/demo-failure.ts`).
 */
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type DemoGateAction, DEMO_PIN_FIELD, INITIAL_DEMO_FORM_STATE } from "@/lib/auth/demo-form";
import { FlaskConical, Loader2, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

export function DemoGate({ action }: { action: DemoGateAction }) {
  const [state, formAction, pending] = useActionState(action, INITIAL_DEMO_FORM_STATE);

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-700">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center pb-6">
          <div className="mx-auto mb-4 w-12 h-12 bg-amber-500 rounded-lg flex items-center justify-center">
            <FlaskConical className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Demo sign-in</CardTitle>
          <CardDescription>
            Enter the demo PIN. The role buttons appear on the sign-in page once it is accepted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* The banner the card requires, and the one sentence a person must not miss. */}
          <Alert className="border-amber-500/60 bg-amber-50 text-amber-900">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription className="font-medium">
              Demo mode — not a real login
            </AlertDescription>
          </Alert>

          <form action={formAction} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="demo-pin" className="text-sm font-medium">
                Demo PIN
              </Label>
              <Input
                id="demo-pin"
                name={DEMO_PIN_FIELD}
                type="password"
                inputMode="numeric"
                autoComplete="off"
                pattern="[0-9]{4}"
                maxLength={4}
                placeholder="4 digits"
                className="h-12 border-gray-300 text-center text-lg tracking-[0.5em]"
                autoFocus
                required
              />
              <p className="text-xs text-muted-foreground">
                Four digits. Five attempts a minute, compared on the server in constant time.
              </p>
            </div>

            {state.status !== "idle" && (
              <Alert variant="destructive">
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full h-12" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {pending ? "Checking…" : "Continue"}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            <Link href="/login" className="text-indigo-600">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
