import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { demoMode } from "@/lib/auth/demo-mode";
import { requireAdmin } from "@/lib/auth/require-role";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

/**
 * `/demo/admin` — the admin-only server check the `/login` role buttons prove (#183, part 2; the
 * buttons moved to `/login` in #218).
 *
 * This is the first caller of `requireAdmin()`, and it exists because the demo needs a surface
 * that answers differently for the two roles **on the server**: the two member accounts reach it
 * as a 404 (not a 403 — `require-role.ts` explains why a refusal is never an answer), a signed-out
 * visitor is redirected to `/login`, and only an `admin` session sees this page at all.
 *
 * Two gates, in this order, and the order is deliberate:
 *
 *   1. `demoMode()` — the route only exists in demo mode. It is a demo's proof surface, not a
 *      product feature, and an admin-only page that shipped in every deployment would be a
 *      surface with no owner.
 *   2. `requireAdmin()` — the real gate, reading `user_profile.role` from this request's own
 *      session. Nothing here accepts a role from a header, a cookie or a query string; the one
 *      page in the tree that prints a role is also the one page that proves the role came from
 *      the database.
 *
 * `force-dynamic` for the same reason `/demo` carries it: the mode is read per request.
 *
 * **A proof, not a destination.** The demo's Admin button lands on `/admin/instances` — the
 * console, where there is something to read — and this page stays as the one surface that shows
 * the gate itself: which session, which role, read from Postgres for this request. Nothing links
 * here from the flow; the URL is reachable and `docs/DEMO-AUTH.md` names it as the evidence. A
 * reader who did arrive here gets the console button below rather than only a way back.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Demo admin",
  robots: { index: false, follow: false },
};

export default async function DemoAdminPage() {
  if (demoMode().kind !== "demo") notFound();

  const { user, role } = await requireAdmin({ next: "/demo/admin" });

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-foreground">
      <Card className="w-full max-w-lg shadow-xl border-0">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-bold">Admin-only surface</CardTitle>
          <CardDescription>
            This page is rendered only for a session whose <code>user_profile.role</code> is{" "}
            <code>admin</code>. A member account asking for the same URL gets the 404 a URL that
            never existed returns.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted-foreground">Signed in as</dt>
            <dd className="font-medium">{user.name === "" ? user.email : user.name}</dd>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-mono text-xs">{user.email}</dd>
            <dt className="text-muted-foreground">Role</dt>
            <dd>
              <Badge variant="secondary">{role}</Badge>
            </dd>
          </dl>
          <p className="text-xs text-muted-foreground">
            Demo mode — not a real login. The role above was read from Postgres for this request; no
            header or cookie can claim it.
          </p>
          <Button asChild className="w-full">
            <Link href="/admin/instances">Open the console</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Back to the demo accounts</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
