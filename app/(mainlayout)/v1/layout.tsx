// template-ancestor: none — prototype screen, approved for /v1
import { V1Shell } from "@/components/v1/v1-shell";
import type { ReactNode } from "react";

/**
 * The /v1 app layout — the product shell's child, so the persona screens get the app chrome and,
 * inside it, the persona bar and the store. The prototype is additive and open: no flag gates it,
 * because the flag store is a file this card does not own and `/v1/**` is a separate tree.
 */
export default function V1MainLayout({ children }: { children: ReactNode }) {
  return <V1Shell>{children}</V1Shell>;
}
