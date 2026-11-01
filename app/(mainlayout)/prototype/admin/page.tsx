/**
 * `/prototype/admin` — the admin overview, drawn over the prototype fixture (#console cohort 1).
 *
 * **The page joins; the view prints.** `data/prototypes/console.ts` holds the records and the only
 * two derivations ("how many", "who needs attention"); this module turns them into the flat props
 * `components/prototype/admin-overview.tsx` draws — a `CountFigures` and a list of `AttentionRow`s —
 * so the component holds no fixture import and the registry's wiring check can call it `mock` while
 * this route is `fixture`. A type import would be enough to break that, which is why the view's
 * types are declared beside it.
 *
 * Nothing here reads a session, a database or a clock: the rows are the fixture's and the days are
 * `daysIdle()` against `content/core.ts::DEMO_NOW_ISO`, so the two renders of one page agree and
 * there is no hydration mismatch (`AGENTS.md`).
 *
 * The gate is the layout's; this module is a projection and a mount. `robots` is `noindex` for the
 * reason `/admin/instances` carries it.
 */
import { PrototypeAdminOverview, type AttentionRow } from "@/components/prototype/admin-overview";
import { prototypeAdminPageCopy } from "@/data/pages/prototype-console";
import {
  daysIdle,
  prototypeAttentionRows,
  prototypeCounts,
  STALE_DAYS,
  templateById,
} from "@/data/prototypes/console";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: prototypeAdminPageCopy.heading,
  robots: { index: false, follow: false },
};

export default function PrototypeAdminPage() {
  const rows: readonly AttentionRow[] = prototypeAttentionRows.map((relationship) => ({
    id: relationship.id,
    name: relationship.name,
    // The join, resolved here: an unknown template id throws rather than printing a blank cell.
    template: templateById(relationship.templateId).name,
    seat: relationship.counterparty,
    stage: relationship.stage,
    daysIdle: daysIdle(relationship.lastActivity),
  }));

  return (
    <PrototypeAdminOverview
      copy={prototypeAdminPageCopy}
      staleDays={STALE_DAYS}
      rows={rows}
      figures={{
        relationships: prototypeCounts.relationships,
        invited: prototypeCounts.byStage.invited,
        connected: prototypeCounts.byStage.connected,
        sharing: prototypeCounts.byStage.sharing,
        aligned: prototypeCounts.byStage.aligned,
        awaitingInvitation: prototypeCounts.awaitingInvitation,
        templates: prototypeCounts.templates,
        builtIn: prototypeCounts.builtInTemplates,
        authored: prototypeCounts.authoredTemplates,
        complete: prototypeCounts.complete,
      }}
    />
  );
}
