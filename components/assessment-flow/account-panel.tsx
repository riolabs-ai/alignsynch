"use client";

// template-ancestor: components/auth/login-view.tsx   (variation: the stage column's account step — one card, two modes, swapped in place)

import type { ComponentProps } from "react";
import { useState } from "react";
import { LoginView } from "@/components/auth/login-view";
import { RegisterView } from "@/components/auth/register-view";

/**
 * Stage 4's account panel — "Create your account" and "Sign in" in one place (#829).
 *
 * The stage used to mount `LoginView` alone, which opened on **Sign in**: wrong for the person
 * the flow is actually for, since a first-time creator has no account yet. Its "Sign up" control
 * was also a `<Link href="/register">`, so wanting an account dropped the whole stage column and
 * the "What gets created" review beside it.
 *
 * This component owns the one piece of state that fixes both: which form is showing. Each view
 * gains an `onSwitch…` prop; supplied, its cross-link becomes a button that calls this setter, so
 * both directions swap **in place** — same route, same draft cookie, no navigation. Absent, each
 * view keeps its link and its page behaviour, which is why `/login` and `/register` are unchanged
 * (`pnpm parity` proves it).
 *
 * It receives the two views' **props**, not their JSX: a client component cannot hand a callback
 * to a server-rendered child, so the server passes plain data and the two server actions
 * (`startGoogle`, `providerHint`), and the switch is wired here.
 */
type LoginProps = Omit<
  ComponentProps<typeof LoginView>,
  "layout" | "leaving" | "onSwitchToRegister"
>;
type RegisterProps = Omit<
  ComponentProps<typeof RegisterView>,
  "layout" | "leaving" | "onSwitchToSignIn"
>;

/** E23 counts string-literal JSX attributes; the embedded variant is a mode, not a word. */
const EMBEDDED_LAYOUT: "embedded" = "embedded";

export function AccountPanel({ login, register }: { login: LoginProps; register: RegisterProps }) {
  // A person arriving at stage 4 is finishing a relationship they just described; only one of the
  // two forms can be true of them, and it is more often the one that creates the account.
  const [mode, setMode] = useState<"create" | "signin">("create");

  if (mode === "create") {
    return (
      <RegisterView
        {...register}
        layout={EMBEDDED_LAYOUT}
        // Stage 4 is inside `(mainlayout)`, so the two documents on the last step are a
        // departure and E39 requires them to open a new tab: the person is mid-flow.
        leaving
        onSwitchToSignIn={() => setMode("signin")}
      />
    );
  }

  return (
    <LoginView
      {...login}
      layout={EMBEDDED_LAYOUT}
      // The same reason as the register mount: a dashboard mount keeps the stage in its tab.
      leaving
      onSwitchToRegister={() => setMode("create")}
    />
  );
}
