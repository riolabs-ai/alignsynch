// Mock data for demonstration purposes
// In a real app, this would fetch from a database

export interface User {
  id: string;
  username: string;
  name: string;
  avatar: string;
  bio: string;
  level: number;
  score: number;
  quizzesTaken: number;
  quizzesCreated: number;
  badge: string;
  country: string;
  joinedDate: string;
  isVerified: boolean;
  followers: number;
  following: number;
  achievements: Achievement[];
  recentActivity: Activity[];
  quizHistory: QuizHistoryItem[];
  stats: UserStats;
  createdQuizzes: CreatedQuiz[]; // Added this field
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
}

export interface Activity {
  id: string;
  type: "quiz_completed" | "achievement_earned" | "level_up" | "quiz_created" | "followed_user";
  content: string;
  timestamp: string;
  relatedId?: string;
  relatedName?: string;
}

export interface QuizHistoryItem {
  id: string;
  quizId: string;
  quizName: string;
  score: number;
  maxScore: number;
  completedAt: string;
  timeSpent: number;
  category: string;
  difficulty: "easy" | "medium" | "hard";
}

export interface UserStats {
  averageScore: number;
  bestCategory: string;
  totalTimePlayed: number;
  winRate: number;
  highestStreak: number;
  currentStreak: number;
  favoriteCategory: string;
  weakestCategory: string;
  quizCompletionRate: number;
}

export interface CreatedQuiz {
  id: string;
  title: string;
  description: string;
  image: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  questions: number;
  plays: number;
  averageScore: number;
  rating: number;
  createdAt: string;
  updatedAt: string;
  published: boolean;
  featured: boolean;
  isTournament: boolean;
  tournamentDetails?: {
    startDate: string;
    endDate: string;
    participants: number;
    prize: string;
    status: "upcoming" | "active" | "completed";
  };
  stats: {
    completionRate: number;
    averageTimeSpent: number;
    mostMissedQuestion: number;
    highestScore: number;
    lowestScore: number;
  };
}

const users: User[] = [
  {
    id: "1",
    username: "alexjohnson",
    name: "Alex Johnson",
    avatar: "/avatars/alex.png",
    bio: "Quiz enthusiast and knowledge seeker. I love challenging myself with difficult quizzes!",
    level: 42,
    score: 9850,
    quizzesTaken: 187,
    quizzesCreated: 15,
    badge: "Diamond",
    country: "United States",
    joinedDate: "2022-03-15",
    isVerified: true,
    followers: 1243,
    following: 356,
    achievements: [
      {
        id: "a1",
        name: "Quiz Master",
        description: "Complete 100 quizzes with a score of 80% or higher",
        icon: "trophy",
        earnedAt: "2023-01-20",
        rarity: "epic",
      },
      {
        id: "a2",
        name: "Knowledge Seeker",
        description: "Complete quizzes in 10 different categories",
        icon: "search",
        earnedAt: "2022-11-05",
        rarity: "uncommon",
      },
      {
        id: "a3",
        name: "Perfect Score",
        description: "Achieve 100% on a difficult quiz",
        icon: "star",
        earnedAt: "2023-04-12",
        rarity: "rare",
      },
    ],
    recentActivity: [
      {
        id: "act1",
        type: "quiz_completed",
        content: "Completed 'World History Trivia' with a score of 95%",
        timestamp: "2023-05-01T14:30:00Z",
        relatedId: "q123",
        relatedName: "World History Trivia",
      },
      {
        id: "act2",
        type: "achievement_earned",
        content: "Earned the 'Quiz Wizard' achievement",
        timestamp: "2023-04-28T09:15:00Z",
        relatedId: "a7",
        relatedName: "Quiz Wizard",
      },
      {
        id: "act3",
        type: "level_up",
        content: "Reached level 42",
        timestamp: "2023-04-25T16:45:00Z",
      },
    ],
    quizHistory: [
      {
        id: "qh1",
        quizId: "q123",
        quizName: "World History Trivia",
        score: 95,
        maxScore: 100,
        completedAt: "2023-05-01T14:30:00Z",
        timeSpent: 720,
        category: "History",
        difficulty: "hard",
      },
      {
        id: "qh2",
        quizId: "q456",
        quizName: "Science Facts",
        score: 88,
        maxScore: 100,
        completedAt: "2023-04-29T10:20:00Z",
        timeSpent: 540,
        category: "Science",
        difficulty: "medium",
      },
      {
        id: "qh3",
        quizId: "q789",
        quizName: "Pop Culture Quiz",
        score: 75,
        maxScore: 100,
        completedAt: "2023-04-27T19:10:00Z",
        timeSpent: 480,
        category: "Entertainment",
        difficulty: "easy",
      },
    ],
    stats: {
      averageScore: 87.5,
      bestCategory: "History",
      totalTimePlayed: 42600,
      winRate: 0.78,
      highestStreak: 12,
      currentStreak: 5,
      favoriteCategory: "Science",
      weakestCategory: "Sports",
      quizCompletionRate: 0.94,
    },
    createdQuizzes: [
      {
        id: "q1",
        title: "World Geography Challenge",
        description: "Test your knowledge of world geography with this challenging quiz!",
        image: "/world-map-quiz.png",
        category: "Geography",
        difficulty: "medium",
        questions: 20,
        plays: 1245,
        averageScore: 76,
        rating: 4.7,
        createdAt: "2023-01-15T10:30:00Z",
        updatedAt: "2023-02-10T14:20:00Z",
        published: true,
        featured: true,
        isTournament: false,
        stats: {
          completionRate: 87,
          averageTimeSpent: 840,
          mostMissedQuestion: 12,
          highestScore: 100,
          lowestScore: 35,
        },
      },
      {
        id: "q2",
        title: "Science Quiz Extravaganza",
        description: "From physics to biology, test your science knowledge!",
        image: "/space-exploration-quiz.png",
        category: "Science",
        difficulty: "hard",
        questions: 25,
        plays: 876,
        averageScore: 68,
        rating: 4.5,
        createdAt: "2023-02-20T09:15:00Z",
        updatedAt: "2023-02-20T09:15:00Z",
        published: true,
        featured: false,
        isTournament: false,
        stats: {
          completionRate: 72,
          averageTimeSpent: 1200,
          mostMissedQuestion: 18,
          highestScore: 96,
          lowestScore: 28,
        },
      },
      {
        id: "q3",
        title: "History Through the Ages",
        description: "Journey through time with this comprehensive history quiz!",
        image: "/ancient-civilizations-quiz.png",
        category: "History",
        difficulty: "medium",
        questions: 30,
        plays: 1532,
        averageScore: 72,
        rating: 4.8,
        createdAt: "2023-03-05T11:45:00Z",
        updatedAt: "2023-04-10T16:30:00Z",
        published: true,
        featured: true,
        isTournament: false,
        stats: {
          completionRate: 85,
          averageTimeSpent: 1500,
          mostMissedQuestion: 22,
          highestScore: 100,
          lowestScore: 40,
        },
      },
      {
        id: "q4",
        title: "Pop Culture Trivia",
        description: "Test your knowledge of movies, music, and celebrities!",
        image: "/space-exploration-quiz.png",
        category: "Entertainment",
        difficulty: "easy",
        questions: 15,
        plays: 2145,
        averageScore: 84,
        rating: 4.6,
        createdAt: "2023-03-18T14:20:00Z",
        updatedAt: "2023-03-18T14:20:00Z",
        published: true,
        featured: false,
        isTournament: false,
        stats: {
          completionRate: 94,
          averageTimeSpent: 600,
          mostMissedQuestion: 10,
          highestScore: 100,
          lowestScore: 53,
        },
      },
      {
        id: "q5",
        title: "Annual Science Tournament",
        description: "Compete with others in this annual science knowledge tournament!",
        image: "/technology-quiz.png",
        category: "Science",
        difficulty: "hard",
        questions: 40,
        plays: 567,
        averageScore: 62,
        rating: 4.9,
        createdAt: "2023-04-01T08:30:00Z",
        updatedAt: "2023-04-15T10:45:00Z",
        published: true,
        featured: true,
        isTournament: true,
        tournamentDetails: {
          startDate: "2023-05-01T00:00:00Z",
          endDate: "2023-05-31T23:59:59Z",
          participants: 324,
          prize: "$500 Amazon Gift Card",
          status: "active",
        },
        stats: {
          completionRate: 68,
          averageTimeSpent: 2400,
          mostMissedQuestion: 35,
          highestScore: 98,
          lowestScore: 22,
        },
      },
    ],
  },
  {
    id: "2",
    username: "sarahwilliams",
    name: "Sarah Williams",
    avatar: "/avatars/sarah.webp",
    bio: "Trivia lover and quiz creator. Follow me for the best science quizzes!",
    level: 38,
    score: 8720,
    quizzesTaken: 156,
    quizzesCreated: 27,
    badge: "Platinum",
    country: "Canada",
    joinedDate: "2022-05-22",
    isVerified: true,
    followers: 987,
    following: 245,
    achievements: [
      {
        id: "a4",
        name: "Quiz Creator",
        description: "Create 25 quizzes that have been played by at least 10 people",
        icon: "pencil",
        earnedAt: "2023-02-18",
        rarity: "rare",
      },
      {
        id: "a5",
        name: "Science Whiz",
        description: "Score 90% or higher on 20 science quizzes",
        icon: "flask",
        earnedAt: "2022-12-10",
        rarity: "uncommon",
      },
    ],
    recentActivity: [
      {
        id: "act4",
        type: "quiz_created",
        content: "Created a new quiz 'Quantum Physics Basics'",
        timestamp: "2023-05-02T11:20:00Z",
        relatedId: "q234",
        relatedName: "Quantum Physics Basics",
      },
      {
        id: "act5",
        type: "quiz_completed",
        content: "Completed 'Ancient Civilizations' with a score of 92%",
        timestamp: "2023-04-30T15:40:00Z",
        relatedId: "q345",
        relatedName: "Ancient Civilizations",
      },
    ],
    quizHistory: [
      {
        id: "qh4",
        quizId: "q345",
        quizName: "Ancient Civilizations",
        score: 92,
        maxScore: 100,
        completedAt: "2023-04-30T15:40:00Z",
        timeSpent: 650,
        category: "History",
        difficulty: "medium",
      },
      {
        id: "qh5",
        quizId: "q567",
        quizName: "Astronomy Wonders",
        score: 96,
        maxScore: 100,
        completedAt: "2023-04-28T13:25:00Z",
        timeSpent: 580,
        category: "Science",
        difficulty: "hard",
      },
    ],
    stats: {
      averageScore: 91.2,
      bestCategory: "Science",
      totalTimePlayed: 36800,
      winRate: 0.85,
      highestStreak: 9,
      currentStreak: 7,
      favoriteCategory: "Science",
      weakestCategory: "Arts",
      quizCompletionRate: 0.97,
    },
    createdQuizzes: [],
  },
  {
    id: "3",
    username: "michaelbrown",
    name: "Michael Brown",
    avatar: "/avatars/brain.png",
    bio: "History buff and trivia enthusiast. Always looking for challenging quizzes!",
    level: 35,
    score: 7640,
    quizzesTaken: 142,
    quizzesCreated: 8,
    badge: "Gold",
    country: "United Kingdom",
    joinedDate: "2022-06-10",
    isVerified: false,
    followers: 645,
    following: 189,
    achievements: [
      {
        id: "a6",
        name: "History Expert",
        description: "Score 95% or higher on 15 history quizzes",
        icon: "book",
        earnedAt: "2023-03-05",
        rarity: "rare",
      },
    ],
    recentActivity: [
      {
        id: "act6",
        type: "followed_user",
        content: "Started following Sarah Williams",
        timestamp: "2023-05-03T09:10:00Z",
        relatedId: "2",
        relatedName: "Sarah Williams",
      },
    ],
    quizHistory: [
      {
        id: "qh6",
        quizId: "q678",
        quizName: "Medieval Europe",
        score: 98,
        maxScore: 100,
        completedAt: "2023-05-02T16:15:00Z",
        timeSpent: 720,
        category: "History",
        difficulty: "hard",
      },
    ],
    stats: {
      averageScore: 89.7,
      bestCategory: "History",
      totalTimePlayed: 32400,
      winRate: 0.82,
      highestStreak: 8,
      currentStreak: 3,
      favoriteCategory: "History",
      weakestCategory: "Technology",
      quizCompletionRate: 0.91,
    },
    createdQuizzes: [],
  },
];

export async function getUserByUsername(username: string): Promise<User | undefined> {
  // In a real app, this would query a database
  return users.find((user) => user.username === username);
}

export async function getTopUsers(limit = 10): Promise<User[]> {
  // In a real app, this would query a database with proper sorting
  return users.slice(0, limit);
}

export async function getUserFollowers(userId: string): Promise<User[]> {
  // Mock implementation - in a real app, this would query a database
  return users.filter((user) => user.id !== userId).slice(0, 5);
}

export async function getUserFollowing(userId: string): Promise<User[]> {
  // Mock implementation - in a real app, this would query a database
  return users.filter((user) => user.id !== userId).slice(0, 3);
}
