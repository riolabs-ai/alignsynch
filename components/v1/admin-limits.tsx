// template-ancestor: components/ui/alert.tsx   (variation: a fixed list of three limits, each with what happens instead, rendered on every console screen)
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ADMIN_LIMITS } from "@/lib/v1/admin-console";
import { Lock, ShieldOff, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

/** The icon beside each limit — a limit is one of three kinds, and the icon says which. */
const LIMIT_ICON: Readonly<Record<(typeof ADMIN_LIMITS)[number]["id"], ReactNode>> = {
  answers: <Lock className="h-4 w-4" aria-hidden="true" />,
  impersonation: <ShieldOff className="h-4 w-4" aria-hidden="true" />,
  delete: <Trash2 className="h-4 w-4" aria-hidden="true" />,
};

/**
 * "What this console cannot do" — three limits, each naming the thing an operator might expect to
 * find and what the console does instead.
 *
 * It is a **panel, not an error**: a limit that only says "not allowed" reads as a missing
 * feature, so each row states the mechanism (`no answer values` because the row type has no field
 * for one; `no impersonation` because there is no acting-as control; `no destructive delete
 * without confirmation` because archive and disable are reversible writes in the store). The copy
 * lives in `lib/v1/admin-console.ts::ADMIN_LIMITS` so the console screens and the registry cannot
 * state the same limit three different ways.
 */
export function AdminLimitsPanel() {
  return (
    <Card data-admin-limits="true">
      <CardHeader>
        <CardTitle className="text-base">What this console cannot do</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {ADMIN_LIMITS.map((limit) => (
            <li key={limit.id} className="flex gap-3" data-admin-limit={limit.id}>
              <span className="mt-0.5 text-muted-foreground">{LIMIT_ICON[limit.id]}</span>
              <div>
                <p className="text-sm font-medium text-foreground">{limit.title}</p>
                <p className="text-sm text-muted-foreground">{limit.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
