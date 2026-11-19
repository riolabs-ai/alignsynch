/**
 * `/admin/spec/[group]` — one story page (#1252).
 *
 * The gate is the parent's, in the same order: `requireAdminProduct()` (#509) and then
 * `requireSpecReader()`, so a member or a support seat is answered with the unknown-URL 404 and a
 * signed-out visitor is sent to `/login?next=/admin/spec/<group>`.
 *
 * **The segment is a story slug, and a slug no story claims is a page, not a 404.** `specStoryOf`
 * resolves `07-plans-and-billing` against `SPEC_STORY_GROUPS`; an unknown segment renders the
 * fixture's honest panel — "no story page is called …" plus the way to the matrix — because a 404
 * here would be indistinguishable from the *gate's* 404, and the gate's is the one answer that must
 * stay unambiguous (s04). Eleven slugs exist, and `data:check` E42 holds them to the register.
 *
 * **`params` is a Promise in Next 16**, so it is awaited before the gate: the `next` this page hands
 * `/login` is the address the person actually asked for, not a placeholder.
 *
 * `force-dynamic`, like its two siblings, and the register is read per request (AS-09); the
 * `Cache-Control`/`X-Robots-Tag` pair is `next.config.mjs`'s.
 */
import type { Metadata } from "next";

import { SpecFrame } from "@/components/admin/spec/spec-frame";
import { SpecNotice } from "@/components/admin/spec/spec-notice";
import { StoryPage } from "@/components/admin/spec/story-page";
import { StageColumn } from "@/components/assessment-flow/stage-column";
import { adminSpecPageCopy } from "@/data/pages/admin-spec";
import { adminSpecGroupPath } from "@/lib/admin/spec-paths";
import { requireSpecReader } from "@/lib/auth/require-role";
import { requireAdminProduct } from "@/lib/brand-boundary";
import { readSpecValidationSafe, SPEC_VALIDATION_SOURCE } from "@/lib/spec/file";
import { specStoryOf } from "@/content/spec";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: adminSpecPageCopy.heading,
  robots: { index: false, follow: false },
};

export default async function AdminSpecGroupPage({
  params,
}: {
  params: Promise<{ group: string }>;
}) {
  const { group } = await params;

  requireAdminProduct();
  await requireSpecReader({ next: adminSpecGroupPath(group) });
  const { doc, reason } = readSpecValidationSafe();
  const story = specStoryOf(group);

  return (
    <StageColumn>
      <SpecFrame
        copy={adminSpecPageCopy}
        doc={doc}
        current={{ kind: "story", slug: story?.slug ?? group }}
      >
        {doc === null ? (
          <SpecNotice copy={adminSpecPageCopy} path={SPEC_VALIDATION_SOURCE} reason={reason} />
        ) : (
          <StoryPage copy={adminSpecPageCopy} doc={doc} story={story ?? null} />
        )}
      </SpecFrame>
    </StageColumn>
  );
}
