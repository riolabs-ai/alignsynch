// template-ancestor: components/console/overview.tsx   (variation: the operator's overview — every figure is a filter over the relationship registry, each card links to that exact filter, and the page ends with what the console cannot do)
"use client";

import { StatCardGrid, type StatCard } from "@/components/console/stat-card-grid";
import { AdminLimitsPanel } from "@/components/v1/admin-limits";
import { LoadingState, SectionIntro } from "@/components/v1/v1-ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { STAGE_LABELS } from "@/content/stages";
import {
  ADMIN_TEMPLATES_PATH,
  ADMIN_USERS_PATH,
  ADMIN_ANSWER_LIMIT_SENTENCE,
  adminCounts,
  adminRegistryHref,
  adminRelationshipRows,
} from "@/lib/v1/admin-console";
import { useV1Store } from "@/lib/v1/store";
import {
  Archive,
  CheckCircle2,
  Clock,
  CreditCard,
  Handshake,
  LayoutTemplate,
  Link2,
  Mail,
  Split,
  Users,
} from "lucide-react";

/**
 * `/admin/console` — the console's overview.
 *
 * The arrangement is `components/console/overview.tsx`: a heading, a grid of `<Card>` figures,
 * then the prose that says what the screen is. The figure grid itself is the shipped
 * `components/console/stat-card-grid.tsx`, unchanged — its `href` is required precisely because a
 * total with no list behind it is the number a console exists to stop printing.
 *
 * **What varies, and why it is the whole card.** In the shipped console a figure is the operator's
 * own instance list and the card links to a list filtered by the same predicate. Here every figure
 * is a predicate over **one** array — `adminRelationshipRows()` — and the card links to the
 * registry with that predicate in the query string (`adminRegistryHref`). So "2 past due" and the
 * two rows the `subscription=past_due` filter draws are computed by the same function over the same
 * rows, and the detail line under each figure prints the predicate in words, which is why the
 * screen can be audited by reading it rather than by trusting it.
 *
 * **Nothing is authored.** There is no metric fixture, no percentage and no string that could hold
 * a formatted figure: `StatCard.value` is a `number` computed from the store's own arrays. The two
 * cards that are not relationships — templates and users — count the store's collections, and the
 * template card's detail names how many of them an operator has disabled rather than hiding the
 * disabled rows from the total.
 */
export function AdminConsoleOverview() {
  const { hydrated, relationships, templates, accounts, disabledTemplateIds } = useV1Store();

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-8">
        <SectionIntro title="Admin console" subtitle="Reading the store…" />
        <LoadingState rows={4} />
      </div>
    );
  }

  const rows = adminRelationshipRows(
    relationships,
    new Map(templates.map((template) => [template.id, template.title])),
    Date.now(),
  );
  const counts = adminCounts(rows, templates, accounts, disabledTemplateIds);

  const cards: readonly StatCard[] = [
    {
      id: "relationships",
      label: "Relationships",
      value: counts.relationships,
      detail: "live rows — every row where archivedAt is null",
      href: adminRegistryHref(),
      icon: <Handshake className="h-4 w-4" />,
    },
    {
      id: "invited",
      label: STAGE_LABELS.invited,
      value: counts.byStage.invited,
      detail: "live rows where stage = invited",
      href: adminRegistryHref({ stage: "invited" }),
      icon: <Mail className="h-4 w-4" />,
    },
    {
      id: "connected",
      label: STAGE_LABELS.connected,
      value: counts.byStage.connected,
      detail: "live rows where stage = connected",
      href: adminRegistryHref({ stage: "connected" }),
      icon: <Link2 className="h-4 w-4" />,
    },
    {
      id: "sharing",
      label: STAGE_LABELS.sharing,
      value: counts.byStage.sharing,
      detail: "live rows where stage = sharing",
      href: adminRegistryHref({ stage: "sharing" }),
      icon: <Split className="h-4 w-4" />,
    },
    {
      id: "aligned",
      label: STAGE_LABELS.aligned,
      value: counts.byStage.aligned,
      detail: "live rows where stage = aligned",
      href: adminRegistryHref({ stage: "aligned" }),
      icon: <CheckCircle2 className="h-4 w-4" />,
    },
    {
      id: "awaiting-answers",
      label: "Sessions awaiting answers",
      value: counts.awaitingAnswers,
      detail: "live rows with two seats where bothSubmitted is false",
      href: adminRegistryHref({ filter: "awaiting-answers" }),
      icon: <Clock className="h-4 w-4" />,
    },
    {
      id: "past-due",
      label: "Subscriptions past due",
      value: counts.pastDue,
      detail: "live rows where subscription.status = past_due",
      href: adminRegistryHref({ subscription: "past_due" }),
      icon: <CreditCard className="h-4 w-4" />,
    },
    {
      id: "templates",
      label: "Templates",
      value: counts.templates,
      detail:
        counts.disabledTemplates === 0
          ? "templates in the store — none disabled"
          : `templates in the store — ${counts.disabledTemplates} disabled`,
      href: ADMIN_TEMPLATES_PATH,
      icon: <LayoutTemplate className="h-4 w-4" />,
    },
    {
      id: "users",
      label: "Users",
      value: counts.users,
      detail: "accounts in the store — the two seats and the members",
      href: ADMIN_USERS_PATH,
      icon: <Users className="h-4 w-4" />,
    },
    {
      id: "archived",
      label: "Archived relationships",
      value: counts.archived,
      detail: "rows where archivedAt is set — restorable from the registry",
      href: adminRegistryHref({ state: "archived" }),
      icon: <Archive className="h-4 w-4" />,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <SectionIntro
        title="Admin console"
        subtitle="Relationships, templates and the two seats. Every figure is a store query, and every card opens the list it counts."
      />

      <Alert variant="warning" data-admin-console-limit="true">
        <AlertDescription>{ADMIN_ANSWER_LIMIT_SENTENCE}</AlertDescription>
      </Alert>

      <section aria-labelledby="console-counts" className="space-y-3">
        <h2 id="console-counts" className="text-lg font-semibold text-foreground">
          Counts
        </h2>
        <StatCardGrid cards={cards} />
      </section>

      <AdminLimitsPanel />
    </div>
  );
}
