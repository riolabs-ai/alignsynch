/**
 * `GET|POST /api/billing/payment-jobs` — the scheduled payment job (#619).
 *
 * #619 is explicit that reminders and expiry are **scheduled facts**, not render-time ones: a
 * session must expire whether or not someone visits its page, and a nag must not depend on the
 * browser. This route is what the scheduler calls; `lib/member/payment-job-run.ts` is what it does.
 *
 * **Authentication, and why it fails closed.** Without a secret this route answers 503 and runs
 * nothing: an unauthenticated maintenance endpoint that mutates money and relationship state is a
 * public button, and a deployment that forgot the variable should be told so rather than silently
 * not expiring anything. Two callers are accepted:
 *
 *   `x-vercel-cron: 1`        the platform's own scheduler, which cannot send a bearer token.
 *   `authorization: Bearer …` `PAYMENT_JOB_SECRET`, or `CRON_SECRET` as the fallback name.
 *
 * **Idempotent by construction.** Every write behind it is `charged_at IS NULL` /
 * `expired_at IS NULL` guarded and every window is arithmetic over stored instants, so two runs in
 * one minute do the same work once and a run after an outage finds everything already due.
 *
 * The response is the run's own report — how many obligations were scanned and what each job did —
 * so the scheduler's log is the trace, not a bare 200.
 */
import { runPaymentJobs } from "@/lib/member/payment-job-run";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function authorised(request: Request): boolean {
  const secret = (process.env.PAYMENT_JOB_SECRET ?? process.env.CRON_SECRET ?? "").trim();
  if (secret === "") return false;
  if (request.headers.get("x-vercel-cron") !== null) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function run(request: Request): Promise<Response> {
  const configured = (process.env.PAYMENT_JOB_SECRET ?? process.env.CRON_SECRET ?? "").trim();
  if (configured === "") {
    return json(
      {
        error: "not-configured",
        message:
          "the payment job needs PAYMENT_JOB_SECRET (or CRON_SECRET) set — it is not run unauthenticated",
      },
      503,
    );
  }
  if (!authorised(request)) {
    return json({ error: "unauthorized", message: "A bearer token is required" }, 401);
  }

  const run = await runPaymentJobs({ now: new Date() });
  return json(run, 200);
}

export async function GET(request: Request): Promise<Response> {
  return run(request);
}

export async function POST(request: Request): Promise<Response> {
  return run(request);
}
