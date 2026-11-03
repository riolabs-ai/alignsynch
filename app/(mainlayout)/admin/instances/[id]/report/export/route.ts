/**
 * `/admin/instances/[id]/report/export?format=json|pdf` — the audited download (#504).
 *
 * **The gate runs before the read, and a refusal is a 404.** `requireAdminProduct()` first (a
 * template without `product.admin` answers the 404 an unknown URL gets), then the same policy
 * function the pages use — `roleAnswerFor()` — with `support` as the floor. A `member` therefore
 * gets a 404 rather than a 403, which is the repo's rule (`lib/auth/require-role.ts`: a 403 is an
 * answer, and an answer confirms the surface exists), and the read never runs, so **no
 * `read_submission` row is written for the attempt**.
 *
 * **The read that succeeds is recorded, exactly once.** `exportReport()` runs the whole thing
 * inside `act()`: the actor's rung is re-read from `user_profile` in the transaction, the report is
 * derived on that connection, and the `read_submission` row is the last statement before
 * `COMMIT`. One request, one row. That double check is deliberate — this route's own gate answers
 * the status code, and `act()`'s floor is what makes "support and above" true rather than a claim
 * this file makes about itself.
 *
 * **One handler, two formats.** The read, the gate and the audit row are identical; only the bytes
 * differ, and a second route would be a second place to forget the gate. `format` is a closed
 * choice — anything that is not `pdf` is the JSON, because the JSON is the document and the PDF is
 * a rendering of it.
 *
 * **The JSON is the document**, byte for byte what `reportJson()` produced inside the transaction,
 * and its digest rides back in a header so the acceptance (`sha256sum` twice) is checkable from a
 * `curl` as well as from the screen.
 *
 * `force-dynamic`: the route reads a session and a database, and `pnpm build` must keep passing
 * with neither.
 */
import { ActRefused } from "@/lib/admin/act";
import { ReportOpRefused, exportReport } from "@/lib/admin/report-ops";
import { roleAnswerFor } from "@/lib/auth/require-role";
import { currentUser } from "@/lib/auth/session";
import { requireAdminProduct } from "@/lib/brand-boundary";
import { readUserProfileByUserId } from "@/lib/db/user-profiles";
import { DEFAULT_USER_ROLE } from "@/content/identity";
import { renderReportPdf } from "@/lib/report/pdf";

export const dynamic = "force-dynamic";

/** No caching, and no indexing: a report is a customer's answers. */
const COMMON_HEADERS: Record<string, string> = {
  "cache-control": "no-store",
  "x-robots-tag": "noindex, nofollow",
};

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  requireAdminProduct();

  const { id } = await context.params;
  const format = new URL(request.url).searchParams.get("format") === "pdf" ? "pdf" : "json";
  const next = `/admin/instances/${id}/report`;

  // The policy, as one pure function: redirect when nobody is signed in, 404 when the rung is
  // below the floor, and a grant otherwise. A member never reaches the read below.
  const user = await currentUser();
  const profile = user === null ? null : await readUserProfileByUserId(user.userId);
  const answer = roleAnswerFor({
    needed: "support",
    signedIn: user !== null,
    role: profile?.role ?? (user === null ? null : DEFAULT_USER_ROLE),
    next,
  });

  if (answer.kind === "redirect") {
    return new Response(null, { status: 303, headers: { ...COMMON_HEADERS, location: answer.to } });
  }
  if (answer.kind === "not-found" || user === null) {
    // Deliberately indistinguishable from a URL that names nothing: no body, no sentence.
    return new Response(null, { status: 404, headers: COMMON_HEADERS });
  }

  try {
    const exported = await exportReport({
      actorUserId: user.userId,
      instanceRecordId: id,
      reason: `report exported as ${format} from the report screen`,
      format,
    });

    if (format === "pdf") {
      const bytes = renderReportPdf(exported.document);
      return new Response(bytes, {
        status: 200,
        headers: {
          ...COMMON_HEADERS,
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="report-${id}.pdf"`,
          "x-report-sha256": exported.jsonSha256,
        },
      });
    }

    return new Response(exported.json, {
      status: 200,
      headers: {
        ...COMMON_HEADERS,
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="report-${id}.json"`,
        // The digest of these exact bytes — the value the audit row carries.
        "x-report-sha256": exported.jsonSha256,
      },
    });
  } catch (error) {
    if (error instanceof ActRefused || error instanceof ReportOpRefused) {
      // A refusal is a fact about the request or the row, never a 500: `role-too-low` cannot
      // happen through this route's own gate, and if it does it is still the same 404.
      const status = error.reason === "role-too-low" ? 404 : 409;
      return new Response(JSON.stringify({ refusal: error.reason }), {
        status,
        headers: { ...COMMON_HEADERS, "content-type": "application/json; charset=utf-8" },
      });
    }
    throw error;
  }
}
