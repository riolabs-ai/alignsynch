export interface Question {
  id: number;
  text: string;
  options: string[];
  correctAnswer: number; // index of the correct option
  explanation: string;
}

interface QuizSettings {
  timeLimit: number; // in minutes (0 means no limit)
  randomizeQuestions: boolean;
  showExplanations: boolean;
  passingScore: number; // percentage (0-100)
  visibility: string;
  allowRetakes: boolean;
  questionTimer: number; // in seconds (0 means no timer)
}

export interface Quiz {
  id: number;
  title: string;
  description: string;
  difficulty: string;
  tags: string[];
  questions: Question[];
  settings: QuizSettings;
}
