import { Button } from "@/components/ui/button";
import { Download, PlusCircle } from "lucide-react";

interface DashboardHeaderProps {
  activeTab: string;
}

export function DashboardHeader({ activeTab }: DashboardHeaderProps) {
  const getHeaderContent = () => {
    switch (activeTab) {
      case "overview":
        return {
          title: "Dashboard",
          description: "Welcome back! Here's an overview of your account.",
          actions: (
            <Button className="ml-auto">
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Quiz
            </Button>
          ),
        };
      case "my-quizzes":
        return {
          title: "My Quizzes",
          description: "Manage your created quizzes and see their performance.",
          actions: (
            <Button className="ml-auto">
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Quiz
            </Button>
          ),
        };
      case "wallet":
        return {
          title: "Wallet",
          description: "Manage your earnings and withdraw funds.",
          actions: (
            <Button className="ml-auto">
              <Download className="mr-2 h-4 w-4" />
              Withdraw
            </Button>
          ),
        };
      case "affiliate":
        return {
          title: "Affiliate Program",
          description: "Track your referrals and commission earnings.",
          actions: (
            <Button className="ml-auto">
              <Download className="mr-2 h-4 w-4" />
              Export Data
            </Button>
          ),
        };
      case "settings":
        return {
          title: "Dashboard Settings",
          description: "Customize your dashboard experience.",
          actions: null,
        };
      default:
        return {
          title: "Dashboard",
          description: "Welcome back! Here's an overview of your account.",
          actions: null,
        };
    }
  };

  const content = getHeaderContent();

  return (
    <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{content.title}</h1>
        <p className="text-muted-foreground">{content.description}</p>
      </div>
      {content.actions}
    </div>
  );
}
