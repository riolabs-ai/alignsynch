import { QuizEditor } from "@/components/create/quiz-editor";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Quiz",
};

export default function EditorPage() {
  return <QuizEditor />;
}
