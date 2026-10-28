// Add mock search data
export const mockSearchData = {
  quizzes: [
    { id: "q1", title: "World Geography Quiz", category: "Geography", difficulty: "Medium" },
    { id: "q2", title: "Marvel Cinematic Universe Trivia", category: "Entertainment", difficulty: "Hard" },
    { id: "q3", title: "Basic Mathematics", category: "Education", difficulty: "Easy" },
    { id: "q4", title: "History of Ancient Civilizations", category: "History", difficulty: "Medium" },
  ],
  categories: [
    { id: "c1", name: "Science", quizCount: 42 },
    { id: "c2", name: "History", quizCount: 38 },
    { id: "c3", name: "Entertainment", quizCount: 65 },
    { id: "c4", name: "Sports", quizCount: 29 },
  ],
  creators: [
    { id: "u1", username: "quizmaster", name: "Quiz Master", quizCount: 87 },
    { id: "u2", username: "historyprof", name: "History Professor", quizCount: 34 },
    { id: "u3", username: "scienceguru", name: "Science Guru", quizCount: 56 },
  ],
  pages: [
    { id: "p1", title: "Home", path: "/" },
    { id: "p2", title: "Today's Challenge", path: "/daily-challenge" },
    { id: "p3", title: "Categories", path: "/categories" },
    { id: "p4", title: "Quiz Battle", path: "/battle" },
    { id: "p5", title: "News & Updates", path: "/news" },
    { id: "p6", title: "Explore Quizzes", path: "/explore" },
    { id: "p7", title: "Quiz Tournament", path: "/tournaments" },
    { id: "p8", title: "Leaderboard", path: "/leaderboard" },
    { id: "p9", title: "Quiz Creator Tips", path: "/creator-tips" },
    { id: "p10", title: "Quiz Discussions", path: "/quiz-discussions" },
    { id: "p11", title: "Create Quiz", path: "/create/editor" },
    { id: "p12", title: "Ai Quiz Generator", path: "/create/generator" },
    { id: "p13", title: "Affiliate Page", path: "/affiliate" },
    { id: "p14", title: "Pricing Plan", path: "/pricing" },
    { id: "p15", title: "Support", path: "/support" },
  ],
};
