// template-ancestor: none — prototype screen, approved for /v1
import { V1Shell } from "@/components/v1/v1-shell";
import type { ReactNode } from "react";

/**
 * The /v1 marketing layout — the public chrome's child, so /v1 marketing pages get the marketing
 * header and footer (from `app/(marketing)/layout.tsx`) and, inside them, the persona bar and the
 * store. The prototype is additive and open: no flag gates it, because the flag store is a file
 * this card does not own and `/v1/**` is a separate tree.
 */
export default function V1MarketingLayout({ children }: { children: ReactNode }) {
  return <V1Shell>{children}</V1Shell>;
}
