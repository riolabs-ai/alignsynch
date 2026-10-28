"use client";
import { QuizHeader } from "@/components/quiz/quiz-header";
import { QuizQuestion } from "@/components/quiz/quiz-question";
import { QuizResults } from "@/components/quiz/quiz-results";
import { QuizTimer } from "@/components/quiz/quiz-timer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Answer, currentQuiz, Quiz } from "@/data/currentQuiz";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef } from "react";

// Types for the quiz state
interface QuizState {
  quiz: Quiz | null;
  loading: boolean;
  error: string | null;
  currentQuestionIndex: number;
  answers: Answer[];
  quizStartTime: number | null;
  quizEndTime: number | null;
  questionStartTime: number | null;
  timeRemaining: number | null;
  isQuizCompleted: boolean;
  isReviewMode: boolean;
  showFeedback: boolean;
  lastAnswerCorrect: boolean | null;
  direction: number;
}

// Action types
type QuizAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_QUIZ"; payload: Quiz }
  | { type: "SET_CURRENT_QUESTION_INDEX"; payload: number }
  | { type: "SET_DIRECTION"; payload: number }
  | { type: "SET_QUIZ_START_TIME"; payload: number }
  | { type: "SET_QUIZ_END_TIME"; payload: number }
  | { type: "SET_QUESTION_START_TIME"; payload: number }
  | { type: "SET_TIME_REMAINING"; payload: number | null }
  | { type: "DECREMENT_TIME" }
  | { type: "SET_QUIZ_COMPLETED"; payload: boolean }
  | { type: "SET_REVIEW_MODE"; payload: boolean }
  | { type: "SET_SHOW_FEEDBACK"; payload: boolean }
  | { type: "SET_LAST_ANSWER_CORRECT"; payload: boolean | null }
  | { type: "ADD_ANSWER"; payload: Answer }
  | { type: "UPDATE_ANSWER"; payload: { index: number; answer: Answer } }
  | { type: "NAVIGATE_QUESTION"; payload: { direction: number; index: number } }
  | { type: "TIMEOUT_QUIZ" }
  | { type: "RESTART_QUIZ"; payload: { timeLimit: number | null } }
  | { type: "START_REVIEW" };

// Initial state
const initialState: QuizState = {
  quiz: null,
  loading: true,
  error: null,
  currentQuestionIndex: 0,
  answers: [],
  quizStartTime: null,
  quizEndTime: null,
  questionStartTime: null,
  timeRemaining: null,
  isQuizCompleted: false,
  isReviewMode: false,
  showFeedback: false,
  lastAnswerCorrect: null,
  direction: 0,
};

// Reducer function
function quizReducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: action.payload };

    case "SET_ERROR":
      return { ...state, error: action.payload, loading: false };

    case "SET_QUIZ":
      return {
        ...state,
        quiz: action.payload,
        timeRemaining: action.payload.timeLimit,
        loading: false,
      };

    case "SET_CURRENT_QUESTION_INDEX":
      return { ...state, currentQuestionIndex: action.payload };

    case "SET_DIRECTION":
      return { ...state, direction: action.payload };

    case "SET_QUIZ_START_TIME":
      return { ...state, quizStartTime: action.payload };

    case "SET_QUIZ_END_TIME":
      return { ...state, quizEndTime: action.payload };

    case "SET_QUESTION_START_TIME":
      return { ...state, questionStartTime: action.payload };

    case "SET_TIME_REMAINING":
      return { ...state, timeRemaining: action.payload };

    case "DECREMENT_TIME":
      return {
        ...state,
        timeRemaining: state.timeRemaining ? state.timeRemaining - 1 : null,
      };

    case "SET_QUIZ_COMPLETED":
      return { ...state, isQuizCompleted: action.payload };

    case "SET_REVIEW_MODE":
      return { ...state, isReviewMode: action.payload };

    case "SET_SHOW_FEEDBACK":
      return { ...state, showFeedback: action.payload };

    case "SET_LAST_ANSWER_CORRECT":
      return { ...state, lastAnswerCorrect: action.payload };

    case "ADD_ANSWER":
      return { ...state, answers: [...state.answers, action.payload] };

    case "UPDATE_ANSWER":
      const updatedAnswers = [...state.answers];
      updatedAnswers[action.payload.index] = action.payload.answer;
      return { ...state, answers: updatedAnswers };

    case "NAVIGATE_QUESTION":
      return {
        ...state,
        direction: action.payload.direction,
        currentQuestionIndex: action.payload.index,
      };

    case "TIMEOUT_QUIZ":
      return {
        ...state,
        quizEndTime: Date.now(),
        isQuizCompleted: true,
        timeRemaining: 0,
      };

    case "RESTART_QUIZ":
      const now = Date.now();
      return {
        ...state,
        currentQuestionIndex: 0,
        answers: [],
        quizStartTime: now,
        quizEndTime: null,
        questionStartTime: now,
        timeRemaining: action.payload.timeLimit,
        isQuizCompleted: false,
        isReviewMode: false,
        showFeedback: false,
        lastAnswerCorrect: null,
        direction: 0,
      };

    case "START_REVIEW":
      return {
        ...state,
        currentQuestionIndex: 0,
        isReviewMode: true,
        direction: 0,
      };

    default:
      return state;
  }
}

export function QuizPlay({ id }: { id: string }) {
  const router = useRouter();
  const [state, dispatch] = useReducer(quizReducer, initialState);
  const questionContainerRef = useRef<HTMLDivElement>(null);

  // Fetch quiz data
  useEffect(() => {
    const getQuiz = async () => {
      try {
        dispatch({ type: "SET_LOADING", payload: true });
        dispatch({ type: "SET_QUIZ", payload: currentQuiz });
      } catch (err) {
        dispatch({ type: "SET_ERROR", payload: "Failed to load quiz. Please try again later." });
      }
    };

    getQuiz();
  }, [id]);

  // Start quiz timer when quiz is loaded
  useEffect(() => {
    if (state.quiz && !state.quizStartTime && !state.isQuizCompleted) {
      const startTime = Date.now();
      dispatch({ type: "SET_QUIZ_START_TIME", payload: startTime });
      dispatch({ type: "SET_QUESTION_START_TIME", payload: startTime });
    }
  }, [state.quiz, state.quizStartTime, state.isQuizCompleted]);

  // Timer effect
  useEffect(() => {
    if (!state.quiz || state.isQuizCompleted || !state.timeRemaining || state.isReviewMode) return;

    const timer = setInterval(() => {
      if (state.timeRemaining && state.timeRemaining <= 1) {
        clearInterval(timer);
        dispatch({ type: "TIMEOUT_QUIZ" });
        return;
      }
      dispatch({ type: "DECREMENT_TIME" });
    }, 1000);

    return () => clearInterval(timer);
  }, [state.quiz, state.isQuizCompleted, state.timeRemaining, state.isReviewMode]);

  // Scroll to top of question container when changing questions
  useEffect(() => {
    if (questionContainerRef.current) {
      questionContainerRef.current.scrollTo(0, 0);
    }
  }, [state.currentQuestionIndex]);

  // Handle answer selection
  const handleAnswerSelect = useCallback(
    (questionId: string, optionId: string) => {
      if (state.isReviewMode || state.showFeedback) return;

      const currentQuestion = state.quiz?.questions[state.currentQuestionIndex];
      if (!currentQuestion || !state.questionStartTime) return;

      const timeSpent = Math.floor((Date.now() - state.questionStartTime) / 1000);
      const isCorrect = optionId === currentQuestion.correctOptionId;

      // Show feedback
      dispatch({ type: "SET_LAST_ANSWER_CORRECT", payload: isCorrect });
      dispatch({ type: "SET_SHOW_FEEDBACK", payload: true });

      const newAnswer: Answer = {
        questionId,
        selectedOptionId: optionId,
        isCorrect,
        timeSpent,
      };

      // Check if we already have an answer for this question
      const existingAnswerIndex = state.answers.findIndex((a) => a.questionId === questionId);

      if (existingAnswerIndex >= 0) {
        dispatch({ type: "UPDATE_ANSWER", payload: { index: existingAnswerIndex, answer: newAnswer } });
      } else {
        dispatch({ type: "ADD_ANSWER", payload: newAnswer });
      }

      // Move to next question after feedback delay
      setTimeout(() => {
        dispatch({ type: "SET_SHOW_FEEDBACK", payload: false });

        if (state.currentQuestionIndex < (state.quiz?.questions.length || 0) - 1) {
          dispatch({
            type: "NAVIGATE_QUESTION",
            payload: { direction: 1, index: state.currentQuestionIndex + 1 },
          });
          dispatch({ type: "SET_QUESTION_START_TIME", payload: Date.now() });
        } else {
          dispatch({ type: "SET_QUIZ_END_TIME", payload: Date.now() });
          dispatch({ type: "SET_QUIZ_COMPLETED", payload: true });
        }
      }, 1500);
    },
    [state.currentQuestionIndex, state.quiz, state.questionStartTime, state.isReviewMode, state.showFeedback, state.answers]
  );

  // Navigate to next question (in review mode)
  const handleNextQuestion = useCallback(() => {
    if (state.currentQuestionIndex < (state.quiz?.questions.length || 0) - 1) {
      dispatch({
        type: "NAVIGATE_QUESTION",
        payload: { direction: 1, index: state.currentQuestionIndex + 1 },
      });
    }
  }, [state.currentQuestionIndex, state.quiz]);

  // Navigate to previous question (in review mode)
  const handlePrevQuestion = useCallback(() => {
    if (state.currentQuestionIndex > 0) {
      dispatch({
        type: "NAVIGATE_QUESTION",
        payload: { direction: -1, index: state.currentQuestionIndex - 1 },
      });
    }
  }, [state.currentQuestionIndex]);

  // Format time for display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Calculate progress percentage
  const progressPercentage = state.quiz ? ((state.currentQuestionIndex + 1) / state.quiz.questions.length) * 100 : 0;

  // Handle quiz restart
  const handleRestartQuiz = () => {
    dispatch({
      type: "RESTART_QUIZ",
      payload: { timeLimit: state.quiz?.timeLimit || null },
    });
  };

  // Handle review answers
  const handleReviewAnswers = () => {
    dispatch({ type: "START_REVIEW" });
  };

  // Handle exit quiz
  const handleExitQuiz = () => {
    router.push(`/quiz/${id}`);
  };

  // Calculate quiz results
  const calculateResults = () => {
    if (!state.quiz) return null;

    const totalQuestions = state.quiz.questions.length;
    const correctAnswers = state.answers.filter((a) => a.isCorrect).length;
    const score = Math.round((correctAnswers / totalQuestions) * 100);
    const totalTime = state.quizEndTime && state.quizStartTime ? Math.floor((state.quizEndTime - state.quizStartTime) / 1000) : 0;

    return {
      totalQuestions,
      correctAnswers,
      score,
      totalTime,
      answers: state.answers,
    };
  };

  // Loading state
  if (state.loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg font-medium">Loading quiz...</p>
      </div>
    );
  }

  // Error state
  if (state.error || !state.quiz) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{state.error || "Failed to load quiz. Please try again later."}</AlertDescription>
        </Alert>
        <Button onClick={() => router.push("/explore")}>Back to Explore</Button>
      </div>
    );
  }

  // Quiz completed - show results
  if (state.isQuizCompleted) {
    const results = calculateResults();
    return (
      <div className="container mx-auto py-8 px-4">
        <QuizResults results={results} quiz={state.quiz} onRestart={handleRestartQuiz} onReview={handleReviewAnswers} onExit={handleExitQuiz} />
      </div>
    );
  }

  // Review mode or active quiz
  const currentQuestion = state.quiz.questions[state.currentQuestionIndex];
  const currentAnswer = state.answers.find((a) => a.questionId === currentQuestion.id);

  return (
    <div className="container mx-auto py-4 px-4 md:py-8 max-w-4xl">
      <QuizHeader title={state.quiz.title} category={state.quiz.category} difficulty={state.quiz.difficulty} isReviewMode={state.isReviewMode} />

      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <div className="text-sm font-medium">
            Question {state.currentQuestionIndex + 1} of {state.quiz.questions.length}
          </div>
          {!state.isReviewMode && state.timeRemaining !== null && <QuizTimer timeRemaining={state.timeRemaining} formatTime={formatTime} />}
        </div>
        <Progress value={progressPercentage} className="h-2" />
      </div>

      <div className="relative">
        {/* Feedback overlay */}
        {state.showFeedback && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
            <div className={`text-center p-6 rounded-lg ${state.lastAnswerCorrect ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
              <div className={`text-5xl mb-2 ${state.lastAnswerCorrect ? "text-green-500" : "text-red-500"}`}>{state.lastAnswerCorrect ? "✓" : "✗"}</div>
              <h3 className="text-xl font-bold mb-1">{state.lastAnswerCorrect ? "Correct!" : "Incorrect!"}</h3>
              <p>{state.lastAnswerCorrect ? "Great job! Moving to next question..." : `The correct answer was: ${state.quiz.questions[state.currentQuestionIndex].options.find((o) => o.id === state.quiz!.questions[state.currentQuestionIndex].correctOptionId)?.text}`}</p>
            </div>
          </div>
        )}

        <Card className="overflow-hidden">
          <div ref={questionContainerRef}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={currentQuestion.id} initial={{ opacity: 0, x: state.direction * 100 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: state.direction * -100 }} transition={{ duration: 0.3 }} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Question image */}
                {currentQuestion.image && (
                  <div className="rounded-lg overflow-hidden">
                    <Image src={currentQuestion.image || "/placeholder.svg"} alt="Question illustration" className="size-full object-center object-cover" />
                  </div>
                )}

                <QuizQuestion question={currentQuestion} selectedOptionId={currentAnswer?.selectedOptionId || null} correctOptionId={state.isReviewMode ? currentQuestion.correctOptionId : undefined} onSelectOption={handleAnswerSelect} isReviewMode={state.isReviewMode} />

                {state.isReviewMode && (
                  <div className="mt-6 space-y-4">
                    {currentQuestion.explanation && (
                      <div className="bg-muted p-4 rounded-md">
                        <p className="font-medium mb-1">Explanation:</p>
                        <p>{currentQuestion.explanation}</p>
                      </div>
                    )}

                    <div className="flex justify-between mt-6">
                      <Button variant="outline" onClick={handlePrevQuestion} disabled={state.currentQuestionIndex === 0} className="flex items-center gap-2">
                        <ChevronLeft className="h-4 w-4" /> Previous
                      </Button>

                      <Button variant="outline" onClick={handleNextQuestion} disabled={state.currentQuestionIndex === state.quiz.questions.length - 1} className="flex items-center gap-2">
                        Next <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </Card>
      </div>

      {state.isReviewMode && (
        <div className="flex justify-center mt-6">
          <Button onClick={handleExitQuiz} variant="default">
            Exit Review
          </Button>
        </div>
      )}
    </div>
  );
}
