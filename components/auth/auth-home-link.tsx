// template-ancestor: components/auth/login-view.tsx   (variation: the way out — every auth screen carries one, so none of them is a dead end)

/**
 * The way back to the site from an auth screen.
 *
 * An auth route is a place somebody lands from a link, a bookmark or a redirect, and until this
 * component none of them had a door: `/login`, `/register` and `/forgot-password` each rendered
 * zero links to `/`, so a visitor who did not want to sign in had to edit the address bar. That is
 * the same defect as a detail view with no exit — the screen answers one question and refuses the
 * other.
 *
 * One component rather than five copies of the same anchor, and it takes its **words** as a prop:
 * the label is the route's own fixture (`data/pages/*.ts`, `home` band), because `/login` and
 * `/register` are held to a copy budget of 0 (`data/pages/budget.ts`) and a sentence written here
 * would be a red build. The class names are chrome and live here.
 *
 * No `"use client"`: `/login`, `/register` and the reset form are client views and the
 * `/reset/complete` band is a server component, so this file has to be readable from both sides of
 * the boundary — the same reason `mark-icon.tsx` has no directive.
 */
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export function AuthHomeLink({ label }: { label: string }) {
  return (
    <Link
      href="/"
      data-auth-home="true"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-action hover:underline"
    >
      <ArrowLeft className="h-3 w-3" aria-hidden="true" />
      {label}
    </Link>
  );
}
