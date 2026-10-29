import { NewsPage } from "@/components/news/news-page";
import { newsPageCopy } from "@/data/pages/news";

export const metadata = {
  title: "Quiz News & Updates | QuizMaker",
  description: "Stay updated with the latest quiz trends, updates, and community news.",
};

export default function News() {
  return <NewsPage copy={newsPageCopy} />;
}
