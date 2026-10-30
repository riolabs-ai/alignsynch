/**
 * Process startup — one line naming the demo auth mode (#183, part 2 of 2).
 *
 * Next runs `register()` once when a server instance boots, which is the only point at which
 * "this deployment mounted a demo login" can be said once instead of on every request. The line
 * comes from `lib/auth/demo-mode.ts::demoModeLogLine`, so the sentence a log carries and the
 * decision the page makes are the same value read from the same function — a log that could
 * disagree with the gate would be worse than no log.
 *
 * **What the line never carries:** the PIN, a demo password, an address, a session. It names
 * variables and the mode, nothing else. `mode=demo` in a production log is the audit trail for
 * a backdoor someone turned on deliberately; `mode=refused` is how an operator learns that
 * `DEMO_AUTH=1` came along with an environment file and was ignored because
 * `DEMO_ALLOW_PRODUCTION=1` was not set.
 *
 * The runtime guard and the dynamic import are both deliberate: this file is loaded for every
 * runtime Next may start, and the mode module is Node-only in practice (`process.env` is all it
 * reads, but the page it feeds reaches `pg`). Guarding costs one comparison and keeps a
 * middleware bundle from importing the page's graph.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { demoMode, demoModeLogLine } = await import("./lib/auth/demo-mode");
  console.info(demoModeLogLine(demoMode()));

  // The database handshake belongs to boot, not to the first visitor (#204). A cold render used
  // to spend its first ~1.2 s opening a socket, and the Neon branch scales to zero, so the first
  // query after a quiet period also waited for the compute to resume — on the only screen that
  // proves the product works. Warming here moves both costs off the request path.
  //
  // Two guards, both deliberate: `next build` imports the route (and so this file) with no
  // intention of touching a database, so `phase-production-build` skips it; and a missing
  // `DATABASE_URL` skips it rather than failing boot, because the gate and CI build and run with
  // no connection string at all. `warmPool()` swallows its own errors — a database that is down
  // at boot must still leave a server that answers honestly.
  if (process.env.NEXT_PHASE !== "phase-production-build" && process.env.DATABASE_URL?.trim()) {
    const { warmPool } = await import("./lib/db/client");
    await warmPool();
  }
}
