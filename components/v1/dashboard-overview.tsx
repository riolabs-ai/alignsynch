// template-ancestor: components/dashboard/dashboard-overview.tsx   (variation: persona-scoped relationship figures — counts, sessions awaiting, stage — plus a subscription card the initiator alone sees; never a fabricated revenue number)
"use client";

import { StatCardGrid, type StatCard } from "@/components/console/stat-card-grid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionIntro } from "@/components/v1/v1-ui";
import { STAGE_LABELS } from "@/content/stages";
import { PERSONA_META } from "@/data/v1/fixtures";
import { relationshipNameOf, stageOfRelationship } from "@/lib/v1/derive";
import { relationshipsVisibleTo, type DashboardPersona } from "@/lib/v1/persona";
import { useV1Store } from "@/lib/v1/store";
import { Clock, CreditCard, Handshake, Layers } from "lucide-react";

/**
 * The persona's dashboard overview, rendered at `/v1/[persona]` (#384). It varies the quiz
 * dashboard's figure grid: instead of a wallet balance, quiz totals and a completion rate — all
 * numbers about somebody else — it counts the relationships **this persona** can see, the sessions
 * still awaiting an answer or acceptance, the sessions completed, and the current stage spread.
 * Every number is computed from the fixture store, never authored.
 *
 * **No revenue for anyone but the initiator.** Only the initiator's overview carries a
 * subscription card; the counterparty, coach and admin dashboards have no money figure of any
 * kind, because the counterparty's membership costs them nothing and the coach and admin do not
 * hold a subscription of their own (#384's rule that outranks the matrix).
 */
export function PersonaDashboard({ persona }: { persona: DashboardPersona }) {
  const { relationships, templates } = useV1Store();
  const meta = PERSONA_META[persona];
  const fullName = meta.surname ? `${meta.name} ${meta.surname}` : meta.name;

  const visible = relationshipsVisibleTo(persona, relationships);
  const awaiting = visible.filter((rel) => {
    const stage = stageOfRelationship(rel);
    return stage === "invited" || stage === "connected";
  }).length;
  const completed = visible.reduce((sum, rel) => sum + rel.completedSessions, 0);

  const cards: StatCard[] = [
    {
      id: "relationships",
      label: "Relationships",
      value: visible.length,
      detail: `${awaiting} awaiting a session`,
      href: `/v1/${persona}/relationships`,
      icon: <Handshake className="size-4" />,
    },
    {
      id: "sessions-awaiting",
      label: "Sessions awaiting",
      value: awaiting,
      detail: "invited or mid-session, not yet scored",
      href: `/v1/${persona}/relationships`,
      icon: <Clock className="size-4" />,
    },
    {
      id: "sessions-completed",
      label: "Sessions completed",
      value: completed,
      detail: "across every relationship you can see",
      href: `/v1/${persona}/relationships`,
      icon: <Layers className="size-4" />,
    },
  ];

  if (persona === "initiator") {
    const subscriptions = visible.filter((rel) => rel.subscription !== null);
    const active = subscriptions.filter((rel) => rel.subscription?.status === "active").length;
    cards.push({
      id: "subscriptions",
      label: "Subscriptions",
      value: subscriptions.length,
      detail: `${active} active, per relationship`,
      href: `/v1/${persona}/shop`,
      icon: <CreditCard className="size-4" />,
    });
  }

  const stageCounts = new Map<string, number>();
  for (const rel of visible) {
    const stage = stageOfRelationship(rel);
    stageCounts.set(stage, (stageCounts.get(stage) ?? 0) + 1);
  }
  const stageBreakdown =
    visible.length === 0
      ? "No relationships yet"
      : [...stageCounts.entries()]
          .map(([stage, count]) => `${count} ${STAGE_LABELS[stage as keyof typeof STAGE_LABELS]}`)
          .join(" · ");

  const open = visible.find((rel) => {
    const stage = stageOfRelationship(rel);
    return stage === "invited" || stage === "connected";
  });
  const nextSessionLine =
    open === undefined
      ? visible.length === 0
        ? "No relationships yet — start one from a template."
        : "No session awaiting — every relationship is scored."
      : `${relationshipNameOf(open, templates.find((t) => t.id === open.templateId)?.title ?? "")} — in progress`;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <SectionIntro
        title={`${meta.label} dashboard`}
        subtitle={`Signed in as ${fullName}. Relationships and sessions, counted from the store.`}
      />

      <StatCardGrid cards={cards} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Next session</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{nextSessionLine}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{stageBreakdown}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
