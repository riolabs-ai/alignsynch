// template-ancestor: components/admin/instance-registry.tsx
import { StageColumn } from "@/components/assessment-flow/stage-column";
import { AdminUsersList } from "@/components/v1/admin-users-list";

/**
 * `/admin/console/users` — the two seats and the members, read from the store.
 *
 * Read-and-count only: the page renders `AdminUsersList`, which has no form and no write path.
 * An account is created by Neon's Managed Auth, so a management form here would be a control that
 * pretends to write to a database this console never opens — its rows are the in-browser store.
 */
export default function AdminUsersPage() {
  return (
    <StageColumn>
      <AdminUsersList />
    </StageColumn>
  );
}
