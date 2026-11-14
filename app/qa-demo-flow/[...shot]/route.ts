/**
 * `/qa-demo-flow/[...shot]` — the committed screenshots of the recorded demo (#898 card 2).
 *
 * **Why a route rather than `public/`.** `data:check` **E18** fails any file under `public/` with no
 * media-registry key, and E17 forbids `components/` and `app/` writing `public/` paths; a screenshot
 * of a live walk is evidence, not a media asset with an alt and a credit. Serving them from where
 * they are committed (`docs/qa-demo-flow/<path>/<n>-<slug>-1440.png`) keeps both invariants and keeps
 * them versioned beside the transcript that names them. `/review-artifacts/[id]` made the same choice
 * for the review prototypes (#665), and `outputFileTracingIncludes` names the directory so a
 * deployment carries the files.
 *
 * **A path the transcript names, or a 404.** There is no directory scan and no file browser: the
 * request's segments are joined back into a repo-relative path and matched against the shots the
 * committed transcript lists. A `..` segment cannot match a listed shot, so the URL is never a file
 * read. A read failure for a listed shot is a 500 with the reason — the transcript says the file
 * exists, so a missing one is a broken tree rather than an unknown address.
 *
 * **Public, because the page is.** `/how-it-works` renders for a signed-out visitor, so the images it
 * draws must answer without a session. Nothing here is per-user: the bytes are the ones the run wrote.
 *
 * **Nothing is captured at request time.** The page reads JSON and this route reads a PNG; no request
 * ever drives a browser. That is the whole point of committing the transcript.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { DEMO_FLOW_DIR, demoFlowShotPath, readDemoFlow } from "@/lib/demo-flow/transcript";

export const dynamic = "force-dynamic";

/** Only a file the recording wrote: `<path>/<n>-<slug>-1440.png`, the driver's own naming. */
const SHOT_PATTERN = /^[a-z0-9-]+\/[a-z0-9-]+\.png$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ shot: string[] }> },
): Promise<Response> {
  const { shot } = await params;
  const relative = shot.join("/");

  if (!SHOT_PATTERN.test(relative)) {
    return new Response("No screenshot with that name.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  // A transcript that cannot be read is a broken tree, not an unknown image: 500 says so.
  const flow = readDemoFlow();
  if (!flow.shots.includes(relative)) {
    return new Response("The recorded walk has no screenshot with that name.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  let bytes: Buffer;
  try {
    bytes = await readFile(demoFlowShotPath(relative));
  } catch (error) {
    return new Response(
      `${join(DEMO_FLOW_DIR, relative)} is named by the transcript but could not be read: ${(error as Error).message}`,
      {
        status: 500,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      },
    );
  }

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "content-type": "image/png",
      "x-content-type-options": "nosniff",
      // `pnpm demo:flow` rewrites these in place, so a long-lived copy is a stale recording.
      "cache-control": "public, max-age=300, must-revalidate",
    },
  });
}
