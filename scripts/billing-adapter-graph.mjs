/**
 * `pnpm billing:on-switch` — proof that the adapter that is not selected is never loaded (#289).
 *
 * A grep for a `stripe` string in `lib/billing/index.ts` would pass on a comment, and fail on a
 * static import that is only used on one branch. This asks the module loader instead: it records
 * every specifier resolution that happens while `lib/billing` is imported and an adapter is
 * constructed, then prints which adapter modules were actually resolved.
 *
 * Two runs, because the interesting fact is the difference between them:
 *
 *   pnpm billing:on-switch            # BILLING_PROVIDER unset → mock; the hosted module is absent
 *   BILLING_PROVIDER=stripe pnpm billing:on-switch   # …and it is present when selected
 *
 * Exit code is 0 when the answer matches the provider that was asked for.
 */
import { registerHooks } from "node:module";
import { loadEnv } from "./load-env.mjs";

const resolved = [];
registerHooks({
  resolve(specifier, context, nextResolve) {
    resolved.push(specifier);
    return nextResolve(specifier, context);
  },
});

loadEnv();

const { billing, resetBillingAdapter } = await import("@/lib/billing");
resetBillingAdapter();

const requested = (process.env.BILLING_PROVIDER ?? "").trim() || "mock";
let port;
try {
  port = await billing();
} catch (error) {
  // `stripe` with no keys refuses by design — and that refusal is itself a resolver event, so the
  // proof still holds. Say what happened instead of pretending the adapter was constructed.
  console.log(`  provider ${requested} → refused: ${error.message}`);
}
if (port !== undefined) console.log(`  provider ${requested} → constructed ${port.provider}`);

const adapters = resolved.filter((specifier) => specifier.includes("adapters/"));
console.log(`  adapter modules resolved: ${adapters.length === 0 ? "none" : adapters.join(", ")}`);

const wanted = requested === "stripe" ? "adapters/stripe" : "adapters/mock";
const other = requested === "stripe" ? "adapters/mock" : "adapters/stripe";
const loaded = adapters.some((specifier) => specifier.includes(wanted));
const leaked = adapters.some((specifier) => specifier.includes(other));

console.log(
  `  ${loaded ? "✓" : "✗"} ${wanted} is resolved when ${requested} is selected\n` +
    `  ${leaked ? "✗" : "✓"} ${other} is NOT resolved when ${requested} is selected`,
);
if (!loaded || leaked) process.exitCode = 1;
