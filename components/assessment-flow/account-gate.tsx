"use client";

// template-ancestor: components/auth/register-view.tsx   (variation: one step inside the flow's column — no split hero, no two-step meter — with the same fields, the same create-account call and the same strength meter; the sign-in screen stays the tab beside it instead of a form copied here)

/**
 * `AccountGate` — the one surface that follows stage 4 (#690).
 *
 * **It is not a stage, and it says so.** The spec is explicit that the account is not one of the
 * six (#659): the flow begins at Who, the invite commits at the end of Create, and *then* a person
 * is asked whether they want the relationship kept under an account. So this screen draws the
 * three-step strip the prototype draws (`Relationship ready · Your account · Invitation sent`)
 * rather than the six-stage rail — the rail would claim this is stage 5, and it is not.
 *
 * **Nothing here blocks anything.** By the time the gate renders, the relationship exists and the
 * invitation has gone out; the create never needed an account. Two ways out, both free: back to
 * the relationship, or the sign-in tab for somebody who already has an account. There is no
 * disabled control and no "skip" that punishes the person who takes it.
 *
 * **The form is the shipped one, not a second copy of it.** `authClient.signUp.email` is what
 * `/register` calls and `authFailureOf` is what classifies its failures — a thrown `AuthApiError`
 * is a failed sign-up exactly like a returned `{ error }` is. What is *not* copied is the sign-in
 * screen: the second tab is a link to `/login` carrying `next` = this gate, so the round trip
 * returns here (signed in, the page forwards to the relationship) and the sign-in form keeps one
 * home.
 *
 * Every reader-visible word is `data/pages/assessment-create.ts`'s `account` section (E23).
 */
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormSurface } from "@/components/ui/form-surface";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StageColumn } from "@/components/assessment-flow/stage-column";
import type { PageCopy } from "@/content/pages";
import { authClient } from "@/lib/auth/client";
import { authFailureOf } from "@/lib/auth/errors";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** The strip's three steps, in the order the account step sits between them. */
const GATE_STEPS = [
  { id: "step-1", state: "done" },
  { id: "step-2", state: "current" },
  // The invitation is already out by the time the gate draws: the create commits it. Marking this
  // step "todo" would be the prototype's words telling the truth about a flow this build does not
  // have, so the marker is a tick and the reason is in the fixture.
  { id: "step-3", state: "done" },
] as const;

export function AccountGate({
  copy,
  signInHref,
  backHref,
  destination,
}: {
  copy: PageCopy;
  /** `/login?next=<this gate>`, so the round trip lands back here. */
  signInHref: string;
  /** Back to the relationship stage 4 created — the other free way out. */
  backHref: string;
  /** Where a freshly created account goes: the relationship itself. */
  destination: string;
}) {
  const account = sectionOf(copy, "account");
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [required, setRequired] = useState(false);
  const [failed, setFailed] = useState(false);

  async function createAccount(): Promise<void> {
    setRequired(false);
    setFailed(false);
    if (name.trim() === "" || email.trim() === "" || password === "") {
      setRequired(true);
      return;
    }

    setPending(true);
    let result: { error?: unknown } | undefined;
    try {
      result = await authClient.signUp.email({
        email: email.trim(),
        password,
        name: name.trim(),
      });
    } catch (error) {
      // A thrown `AuthApiError` is a failed sign-up like a returned `{ error }` is — `authFailureOf`
      // is the classifier `/register` uses, and a thrown value with no status reads as `network`.
      // This screen prints one sentence for both kinds, because it has no per-code band: the
      // sentence it does print is the fixture's, and it names the two things a person can do.
      console.error("account-gate: the sign-up threw", authFailureOf(error));
      setFailed(true);
      setPending(false);
      return;
    }
    if (result?.error !== undefined) {
      console.error("account-gate: the sign-up was refused", authFailureOf(result.error));
      setFailed(true);
      setPending(false);
      return;
    }

    // Into the relationship, not back onto this gate: the page forwards a signed-in visitor there
    // anyway, so the extra hop would only flash the gate at somebody who just left it behind.
    router.push(destination);
    router.refresh();
  }

  return (
    <StageColumn>
      <div className="space-y-6">
        <p>
          <Link href={backHref} className="text-sm font-medium text-action hover:underline">
            {itemLabel(account, "back")}
          </Link>
        </p>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            {account.heading}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-300">{account.body}</p>
        </div>

        {/*
          The account step's own progress: three steps, one `<ol>`, the current one marked with
          `aria-current`. Done steps carry a tick, which is the prototype's "numbers → ✓" rule
          (#659 § 2) applied to a strip that is not the six-stage rail.
        */}
        <section
          data-account-gate-progress="true"
          className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {itemLabel(account, "progress")}
          </p>
          <ol className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            {GATE_STEPS.map((step) => (
              <li
                key={step.id}
                data-step={step.id}
                data-state={step.state}
                aria-current={step.state === "current" ? "step" : undefined}
                className="flex items-center gap-2 text-sm"
              >
                <span
                  aria-hidden="true"
                  className={
                    step.state === "done"
                      ? "flex h-6 w-6 items-center justify-center rounded-full bg-action text-xs font-semibold text-action-foreground"
                      : "flex h-6 w-6 items-center justify-center rounded-full border-2 border-action text-xs font-semibold text-action"
                  }
                >
                  {step.state === "done" ? "✓" : "2"}
                </span>
                <span
                  className={
                    step.state === "current"
                      ? "font-medium text-gray-900 dark:text-gray-100"
                      : "text-gray-600 dark:text-gray-300"
                  }
                >
                  {itemLabel(account, step.id)}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/*
          The two tabs. The first is this screen; the second is a link, because `/login` is where
          signing in happens and a form here would be a second place for its refusals to drift.
        */}
        <div
          role="tablist"
          aria-label={account.heading}
          className="flex gap-1 border-b border-gray-200 dark:border-gray-700"
        >
          {/*
            The current tab is a focusable button rather than a bare span: a `role="tab"` that
            cannot take focus is unreachable for keyboard users, and a tab that can be reached but
            does nothing is a dead stop. Pressing it puts the cursor in the first field, which is
            where anybody selecting this tab was going anyway.
          */}
          <button
            type="button"
            role="tab"
            tabIndex={0}
            aria-selected="true"
            aria-controls="account-gate-form"
            data-account-gate-tab="create"
            onClick={() => document.getElementById("account-gate-name")?.focus()}
            className="-mb-px border-b-2 border-action bg-transparent px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100"
          >
            {itemLabel(account, "tab-create")}
          </button>
          <Link
            role="tab"
            aria-selected="false"
            href={signInHref}
            data-account-gate-tab="sign-in"
            className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
          >
            {itemLabel(account, "tab-sign-in")}
          </Link>
        </div>

        <FormSurface>
          <form
            id="account-gate-form"
            data-account-gate-form="true"
            className="space-y-4 p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void createAccount();
            }}
          >
            <div className="grid gap-3">
              <Label htmlFor="account-gate-name">{itemLabel(account, "name")}</Label>
              <Input
                id="account-gate-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-11"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {itemLabel(account, "name-help")}
              </p>
            </div>

            <div className="grid gap-3">
              <Label htmlFor="account-gate-email">{itemLabel(account, "email")}</Label>
              <Input
                id="account-gate-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-11"
              />
            </div>

            <div className="grid gap-3">
              <Label htmlFor="account-gate-password">{itemLabel(account, "password")}</Label>
              <Input
                id="account-gate-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-11"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {itemLabel(account, "password-help")}
              </p>
              {/*
                No strength meter here, deliberately: the meter reads the `strength` section of the
                register fixture, and a copy of that vocabulary in this fixture would be a second
                place for the same advice to drift. The hint above is this screen's own sentence,
                and the full sign-up screen is one tab away.
              */}
            </div>

            {required ? (
              <Alert variant="destructive">
                <AlertDescription>{itemLabel(account, "required")}</AlertDescription>
              </Alert>
            ) : null}
            {failed ? (
              <Alert variant="destructive">
                <AlertDescription>{itemLabel(account, "failed")}</AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" className="h-11" disabled={pending}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              <span>
                {pending ? itemLabel(account, "submitting") : itemLabel(account, "submit")}
              </span>
            </Button>
          </form>
        </FormSurface>
      </div>
    </StageColumn>
  );
}
