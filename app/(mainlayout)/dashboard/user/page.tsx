import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { Suspense } from "react";

export default function Dashboard() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DashboardPage />;
    </Suspense>
  );
}
