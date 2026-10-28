import { Atom, BookOpen, Building2, Code, Dumbbell, Globe, Landmark, Lightbulb, Music, Palette, Popcorn, Rocket, Utensils, Wallet } from "lucide-react";
import type React from "react";

export interface CategoryType {
  id: number;
  name: string;
  slug: string;
  description: string;
  icon: React.ReactNode;
  count: number;
  featured: boolean;
}

export const categoriesData: CategoryType[] = [
  {
    id: 1,
    name: "Science",
    slug: "science",
    description: "Test your knowledge of scientific concepts, discoveries, and famous scientists.",
    icon: <Atom className="h-12 w-12" />,
    count: 42,
    featured: true,
  },
  {
    id: 2,
    name: "History",
    slug: "history",
    description: "Explore historical events, figures, and civilizations from around the world.",
    icon: <Landmark className="h-12 w-12" />,
    count: 38,
    featured: true,
  },
  {
    id: 3,
    name: "Mathematics",
    slug: "mathematics",
    description: "Challenge yourself with math problems, puzzles, and concepts.",
    icon: <Lightbulb className="h-12 w-12" />,
    count: 25,
    featured: true,
  },
  {
    id: 4,
    name: "Literature",
    slug: "literature",
    description: "Test your knowledge of books, authors, and literary works.",
    icon: <BookOpen className="h-12 w-12" />,
    count: 31,
    featured: true,
  },
  {
    id: 5,
    name: "Sports",
    slug: "sports",
    description: "Challenge yourself with questions about various sports, athletes, and competitions.",
    icon: <Dumbbell className="h-12 w-12" />,
    count: 29,
    featured: true,
  },
  {
    id: 6,
    name: "Geography",
    slug: "geography",
    description: "Test your knowledge of countries, capitals, landmarks, and geographical features.",
    icon: <Globe className="h-12 w-12" />,
    count: 27,
    featured: false,
  },
  {
    id: 7,
    name: "Technology",
    slug: "technology",
    description: "Explore questions about computers, gadgets, programming, and tech innovations.",
    icon: <Code className="h-12 w-12" />,
    count: 34,
    featured: false,
  },
  {
    id: 8,
    name: "Movies & TV",
    slug: "movies-tv",
    description: "Test your knowledge of films, TV shows, actors, directors, and pop culture.",
    icon: <Popcorn className="h-12 w-12" />,
    count: 45,
    featured: false,
  },
  {
    id: 9,
    name: "Music",
    slug: "music",
    description: "Challenge yourself with questions about artists, songs, instruments, and music history.",
    icon: <Music className="h-12 w-12" />,
    count: 33,
    featured: false,
  },
  {
    id: 10,
    name: "Art",
    slug: "art",
    description: "Explore questions about famous artworks, artists, movements, and techniques.",
    icon: <Palette className="h-12 w-12" />,
    count: 22,
    featured: false,
  },
  {
    id: 11,
    name: "Food & Cooking",
    slug: "food-cooking",
    description: "Test your knowledge of cuisines, ingredients, cooking techniques, and famous chefs.",
    icon: <Utensils className="h-12 w-12" />,
    count: 19,
    featured: false,
  },
  {
    id: 12,
    name: "Business & Finance",
    slug: "business-finance",
    description: "Challenge yourself with questions about economics, companies, entrepreneurs, and financial concepts.",
    icon: <Wallet className="h-12 w-12" />,
    count: 24,
    featured: false,
  },
  {
    id: 13,
    name: "Architecture",
    slug: "architecture",
    description: "Explore questions about famous buildings, architectural styles, and renowned architects.",
    icon: <Building2 className="h-12 w-12" />,
    count: 17,
    featured: false,
  },
  {
    id: 14,
    name: "Space",
    slug: "space",
    description: "Test your knowledge of astronomy, space exploration, planets, and the universe.",
    icon: <Rocket className="h-12 w-12" />,
    count: 28,
    featured: false,
  },
];
