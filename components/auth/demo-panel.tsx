"use client";

/**
 * The demo panel — a PIN and three buttons (#183, part 2 of 2).
 *
 * What this component does **not** have is the point of it: no email field, no password field,
 * no credential in a prop, no account list. It posts one PIN and the name of the button that
 * was pressed to a server action; the action looks the account up, signs in and redirects. A
 * browser that reads every byte of this bundle, every form value and every RSC payload learns
 * the three labels and nothing that could be used to sign in anywhere.
 *
 * The buttons are `name="as"` submits rather than three separate forms: one PIN field, three
 * ways to spend it, and no chance of a *different* PIN being typed into a second form.
 *
 * Copy: the banner sentence is the card's own ("Demo mode — not a real login"), and the rest is
 * short enough to stay a literal. There is no `data/pages/` fixture for this route on purpose —
 * it is a development surface, it renders only under `DEMO_AUTH=1`, and a fixture would put its
 * words on the same table every product page's copy is counted in (E23).
 */
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type DemoFormState,
  DEMO_PIN_FIELD,
  DEMO_ROLE_FIELD,
  INITIAL_DEMO_FORM_STATE,
} from "@/lib/auth/demo-form";
import { DEMO_PANEL_LABELS, DEMO_PANEL_ROLES, type DemoPanelRole } from "@/lib/auth/demo-accounts";
import { FlaskConical, Loader2, ShieldAlert } from "lucide-react";
import { useActionState } from "react";

/** Each button reads as the person it signs in as, not as a role name alone. */
const DESCRIPTIONS: Readonly<Record<DemoPanelRole, string>> = {
  initiator: "Avery — the party who asked",
  counterparty: "Rowan — the party who answers",
  admin: "The administrator, with no party to answer as",
};

export function DemoPanel({ action }: { action: DemoAction }) {
  const [state, formAction, pending] = useActionState(action, INITIAL_DEMO_FORM_STATE);

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-700">
      <Card className="w-full max-w-lg shadow-xl border-0">
        <CardHeader className="text-center pb-6">
          <div className="mx-auto mb-4 w-12 h-12 bg-amber-500 rounded-lg flex items-center justify-center">
            <FlaskConical className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Sign in as a demo account</CardTitle>
          <CardDescription>
            Three real accounts stand behind this panel. Pick one, and the server signs in with
            credentials the browser never receives.
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
                placeholder="Enter the demo PIN"
                className="h-12 border-gray-300"
                required
              />
              <p className="text-xs text-muted-foreground">
                The PIN is compared on the server, in constant time. Five attempts a minute.
              </p>
            </div>

            {state.status !== "idle" && (
              <Alert variant="destructive">
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            )}

            <div className="grid gap-3">
              {DEMO_PANEL_ROLES.map((role) => (
                <Button
                  key={role}
                  type="submit"
                  name={DEMO_ROLE_FIELD}
                  value={role}
                  disabled={pending}
                  variant={role === "admin" ? "secondary" : "default"}
                  className="w-full h-auto py-3 justify-start"
                >
                  {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <span className="text-left">
                    <span className="block font-medium">{DEMO_PANEL_LABELS[role]}</span>
                    <span className="block text-xs opacity-80">{DESCRIPTIONS[role]}</span>
                  </span>
                </Button>
              ))}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * The action's type, written out rather than imported so this module never names the `"use
 * server"` file: the page passes the real action down as a prop, and a client module that
 * imported it directly would be a second place the action is wired.
 */
export type DemoAction = (prev: DemoFormState, formData: FormData) => Promise<DemoFormState>;
