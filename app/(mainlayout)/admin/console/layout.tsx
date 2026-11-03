import type { ReactNode } from "react";

import { requireAdmin } from "@/lib/auth/require-role";
import { requireAdminProduct } from "@/lib/brand-boundary";
import { V1StoreProvider } from "@/lib/v1/store";

/**
 * `/admin/console` — the operator console, moved out of the `/v1` prototype tree (#478) so the
 * prototype can be deleted without taking the one surface that survives it.
 *
 * **The gate is the same one `/admin/*` uses, and it is here rather than in six pages.**
 * `requireAdmin()` answers one of three ways and never returns for a refusal: a signed-out
 * visitor is sent to `/login?next=/admin/console`, a signed-in person without the role gets
 * `notFound()` — the 404 a URL that never existed returns, not a 403, because a 403 confirms the
 * surface exists — and only an `admin` session reaches the render below. The role is read from
 * `user_profile` for this request (`lib/auth/require-role.ts`); it is granted when the verified
 * email is on `ADMIN_EMAILS` (`lib/auth/admin-allowlist.ts`), so no address is read here and a
 * form field cannot promote anybody. A layout rather than six page copies because this subtree is
 * one surface: a seventh console page added under it inherits the check, and no page can be
 * written that forgets it.
 *
 * **`force-dynamic`, always.** The guard reads a cookie, a session and a profile row, so a
 * prerendered answer would be one visitor's verdict baked into the build — and `pnpm build` must
 * keep passing with no `DATABASE_URL` and no `NEON_AUTH_*`, which a prerender of this subtree
 * could not. A *request* to a tree with no auth env answers 500 `NEON_AUTH_BASE_URL is not set`
 * instead of pretending nobody is signed in, exactly as `/admin/instances` and `/admin/gaps` do
 * (the answer recorded for the gated console routes); the gate never issues one.
 *
 * **The store provider moved with the screens, not the chrome.** These six pages read the
 * in-browser store (`lib/v1/store.tsx`) through `useV1Store`, which throws outside a provider;
 * the prototype shell (`components/v1/v1-shell.tsx`) used to mount it for them. Under the real
 * `(mainlayout)` shell there is no such provider, so this layout supplies it: the console keeps
 * the data source it was written against and loses the prototype's persona bar, sidebar and
 * review footer. `V1StoreProvider` is a client component and takes server children, so the
 * provider wraps the subtree without a second page-level directive.
 */
export const dynamic = "force-dynamic";

export default async function AdminConsoleLayout({ children }: { children: ReactNode }) {
  /**
   * The capability first (#509), then the role. A template that does not claim `product.admin` has
   * no console at all, so it answers the 404 an unknown URL gets before any session or profile is
   * read; a template that claims it falls through to the role gate's three answers. Reversed, a
   * product without a console would send people to `/login` for a surface it does not sell.
   */
  requireAdminProduct();
  await requireAdmin({ next: "/admin/console" });
  return <V1StoreProvider>{children}</V1StoreProvider>;
}
