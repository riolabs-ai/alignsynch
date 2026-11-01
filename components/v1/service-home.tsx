// template-ancestor: components/assessment-flow/my-instances.tsx   (variation: the support queue over stalled invitations)
"use client";

import { useV1Store } from "@/lib/v1/store";
import { EmptyState, LoadingState, SectionIntro } from "@/components/v1/v1-ui";
import { useState } from "react";

/** The Service user's home — the support queue: invitations, accounts and stuck relationships. */
export function ServiceHome() {
  const { hydrated, tickets, accounts, relationships, resolveTicket, sendInvite } = useV1Store();
  const [openAccountId, setOpenAccountId] = useState<string | null>(null);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-8">
        <LoadingState rows={4} />
      </div>
    );
  }

  const open = tickets.filter((ticket) => ticket.status === "open");
  const kindLabel = {
    invitation: "Invitation",
    account: "Account",
    stuck: "Stuck relationship",
  } as const;

  const resolveStuckInvite = (ticketId: string, relationshipId: string | null) => {
    if (relationshipId !== null) sendInvite(relationshipId);
    resolveTicket(ticketId);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <SectionIntro
        title="Service queue"
        subtitle="Resolve invitations, accounts and stuck relationships. This is ops, not the admin console."
      />

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Open tickets</h2>
        {open.length === 0 ? (
          <EmptyState title="Queue clear" body="No open tickets." />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {open.map((ticket) => (
              <li
                key={ticket.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{ticket.subject}</p>
                  <p className="text-xs text-muted-foreground">{kindLabel[ticket.kind]}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => resolveStuckInvite(ticket.id, ticket.relationshipId)}
                    className="inline-flex h-11 items-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action/90"
                  >
                    {ticket.kind === "invitation" ? "Resend invite" : "Resolve"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Accounts</h2>
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {accounts.map((account) => (
            <li key={account.id}>
              <button
                type="button"
                onClick={() => setOpenAccountId(openAccountId === account.id ? null : account.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{account.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{account.email}</p>
                </div>
                <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {account.state}
                </span>
              </button>
              {openAccountId === account.id && (
                <div className="border-t border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                  <p>
                    Persona: {account.persona} · State: {account.state}
                  </p>
                  <p className="mt-1 text-xs">
                    {
                      relationships.filter(
                        (rel) =>
                          rel.counterpartyName === account.name ||
                          rel.initiatorName === account.name,
                      ).length
                    }{" "}
                    relationship(s) name this account as a party.
                  </p>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
