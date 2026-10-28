import { SupportPage } from "@/components/support/support-page";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support - QuizHub",
  description: "Get help and support for your QuizHub  account",
};

export default function Support() {
  return <SupportPage />;
}
