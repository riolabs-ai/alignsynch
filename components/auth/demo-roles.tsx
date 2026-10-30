"use client";

/**
 * The three demo role buttons, on `/login`, only under a valid unlock (#218).
 *
 * `/demo` is the gate and this is the second half of the flow: the page draws this block only for
 * a request whose signed unlock cookie verifies (`lib/auth/demo-surface.ts`), and every button's
 * server action verifies the same cookie again before it reads a credential. So the block is a
 * convenience, not the authorisation — a forged form post, or a tab left open past the unlock's
 * fifteen minutes, gets the expired-unlock sentence and no session.
 *
 * What a browser can learn here is the three labels and the three notes the `/login` fixture
 * carries. The password for each account is read server-side (`lib/db/demo-accounts.ts`) and
 * handed straight to the auth server; it is never a prop, never a form value, never rendered.
 *
 * **Three forms, not one.** Each button is its own `<form>` with a hidden `as` field, so
 * `useActionState` tracks pending and the refusal sentence per button: a failed Admin button must
 * not leave the Initiator button spinning, and the sentence belongs under the button that was
 * pressed. The words are the fixture's (`data/pages/login.ts`, section `demo`) because E23 holds
 * this surface's literals at zero; the refusal sentence is the server's.
 */
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { PageCopy } from "@/content/pages";
import { DEMO_ROLE_LABELS, DEMO_ROLES, type DemoRole } from "@/lib/auth/demo-accounts";
import {
  type DemoRoleAction,
  type DemoRoleState,
  DEMO_ROLE_FIELD,
  INITIAL_DEMO_ROLE_STATE,
} from "@/lib/auth/demo-form";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import { FlaskConical, Loader2 } from "lucide-react";
import { useActionState } from "react";

/**
 * The fixture id of each button's note. A record rather than a template literal, so the ids read
 * as three names instead of one interpolated string a typo can hide in.
 */
const NOTE_IDS: Readonly<Record<DemoRole, string>> = {
  initiator: "initiator-note",
  counterparty: "counterparty-note",
  admin: "admin-note",
};

export function DemoRoles({ copy, action }: { copy: PageCopy; action: DemoRoleAction }) {
  const block = sectionOf(copy, "demo");

  return (
    <section className="space-y-3 rounded-lg border border-amber-500/60 bg-amber-50 p-4 text-amber-900">
      <div className="flex items-center gap-2">
        <FlaskConical className="h-4 w-4" />
        <h2 className="text-sm font-semibold">{block.heading}</h2>
      </div>
      <p className="text-xs text-amber-900/80">{block.body}</p>
      <div className="grid gap-2">
        {DEMO_ROLES.map((role) => (
          <DemoRoleButton key={role} role={role} block={block} action={action} />
        ))}
      </div>
    </section>
  );
}

/** One button and its own failure sentence. Split out so each button owns one `useActionState`. */
function DemoRoleButton({
  role,
  block,
  action,
}: {
  role: DemoRole;
  block: ReturnType<typeof sectionOf>;
  action: DemoRoleAction;
}) {
  const [state, formAction, pending] = useActionState<DemoRoleState, FormData>(
    action,
    INITIAL_DEMO_ROLE_STATE,
  );

  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name={DEMO_ROLE_FIELD} value={role} />
      <Button
        type="submit"
        disabled={pending}
        variant={role === "admin" ? "secondary" : "default"}
        className="w-full h-auto py-2 justify-start"
      >
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        <span className="text-left">
          <span className="block font-medium">{DEMO_ROLE_LABELS[role]}</span>
          <span className="block text-xs opacity-80">{itemLabel(block, NOTE_IDS[role])}</span>
        </span>
      </Button>
      {state.status === "rejected" && (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}
