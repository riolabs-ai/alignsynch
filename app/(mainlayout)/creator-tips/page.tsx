import type { Metadata } from "next"
import { Footer } from "@/components/layout/footer"
import CreatorTipsPage from "@/components/creator-tips/creator-tips-page"

export const metadata: Metadata = {
  title: "Quiz Creator Tips - Learn How to Create Better Quizzes",
  description: "Discover tips, strategies, and best practices for creating engaging and effective quizzes.",
}

export default function CreatorTips() {
  return (
    <>
      <CreatorTipsPage />
      <Footer />
    </>
  )
}
