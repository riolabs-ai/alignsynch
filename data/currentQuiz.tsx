import q3 from "@/public/quiz/q12.png";
import q1 from "@/public/quiz/q13.png";
import q4 from "@/public/quiz/q15.png";
import q5 from "@/public/quiz/q17.png";
import q2 from "@/public/quiz/q6.png";

import { StaticImageData } from "next/image";

export interface Question {
  id: string;
  text: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  explanation?: string;
  image?: string | StaticImageData;
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  timeLimit: number;
  questions: Question[];
  difficulty: string;
  category: string;
  image: string | StaticImageData;
}

export interface Answer {
  questionId: string;
  selectedOptionId: string | null;
  isCorrect: boolean;
  timeSpent: number;
}

export const currentQuiz: Quiz = {
  id: "q1",
  title: "Ultimate World History Trivia",
  description: "Test your knowledge of world history with this comprehensive trivia quiz covering ancient civilizations to modern times.",
  timeLimit: 20 * 60, // 20 minutes in seconds
  difficulty: "Medium",
  category: "History",
  image: "/history-quiz.png",
  questions: [
    {
      id: "q1",
      text: "Which ancient wonder of the world was located in Alexandria, Egypt?",
      image: q1,
      options: [
        { id: "a", text: "The Colossus of Rhodes" },
        { id: "b", text: "The Lighthouse of Alexandria" },
        { id: "c", text: "The Hanging Gardens of Babylon" },
        { id: "d", text: "The Temple of Artemis" },
      ],
      correctOptionId: "b",
      explanation: "The Lighthouse of Alexandria was one of the Seven Wonders of the Ancient World, built around 280 BC.",
    },
    {
      id: "q2",
      text: "In which year did World War II end?",
      image: q2,
      options: [
        { id: "a", text: "1944" },
        { id: "b", text: "1945" },
        { id: "c", text: "1946" },
        { id: "d", text: "1947" },
      ],
      correctOptionId: "b",
      explanation: "World War II ended in 1945, with Germany surrendering in May and Japan surrendering in September.",
    },
    {
      id: "q3",
      text: "Who was the first person to circumnavigate the globe?",
      image: q3,
      options: [
        { id: "a", text: "Christopher Columbus" },
        { id: "b", text: "Vasco da Gama" },
        { id: "c", text: "Ferdinand Magellan" },
        { id: "d", text: "Juan Sebastián Elcano" },
      ],
      correctOptionId: "d",
      explanation: "While Magellan started the voyage, Juan Sebastián Elcano completed the first circumnavigation after Magellan's death in 1522.",
    },
    {
      id: "q4",
      text: "Which empire was ruled by Julius Caesar?",
      image: q4,
      options: [
        { id: "a", text: "Greek Empire" },
        { id: "b", text: "Byzantine Empire" },
        { id: "c", text: "Roman Empire" },
        { id: "d", text: "Persian Empire" },
      ],
      correctOptionId: "c",
      explanation: "Julius Caesar was a Roman general and statesman who played a critical role in the transformation of the Roman Republic into the Roman Empire.",
    },
    {
      id: "q5",
      text: "The Renaissance period began in which country?",
      image: q5,
      options: [
        { id: "a", text: "France" },
        { id: "b", text: "Germany" },
        { id: "c", text: "Italy" },
        { id: "d", text: "England" },
      ],
      correctOptionId: "c",
      explanation: "The Renaissance began in Italy during the 14th century, particularly in Florence, before spreading throughout Europe.",
    },
  ],
};
