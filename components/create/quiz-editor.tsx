"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Question, Quiz } from "@/types/quiz";
import { ChevronDown, ChevronUp, Eye, PlusCircle, Save, Trash, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface QuizEditorProps {
  initialQuizzes?: Quiz[];
}

export function QuizEditor({ initialQuizzes = [] }: QuizEditorProps) {
  const [activeQuizIndex, setActiveQuizIndex] = useState(0);
  const [quizzes, setQuizzes] = useState(
    initialQuizzes.length > 0
      ? initialQuizzes
      : [
          {
            id: 1,
            title: "Untitled Quiz",
            description: "Quiz description",
            difficulty: "medium",
            tags: [],
            questions: [
              {
                id: 1,
                text: "Question 1",
                options: ["Option 1", "Option 2", "Option 3", "Option 4"],
                correctAnswer: 0,
                explanation: "Explanation for the correct answer",
              },
            ],
            settings: {
              timeLimit: 0,
              randomizeQuestions: false,
              showExplanations: true,
              passingScore: 70,
              visibility: "private",
              allowRetakes: true,
              questionTimer: 0,
            },
          },
        ]
  );
  const [newTag, setNewTag] = useState("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewQuestionIndex, setPreviewQuestionIndex] = useState(0);
  const [previewSelectedAnswer, setPreviewSelectedAnswer] = useState<number | null>(null);
  const [previewAnswerSubmitted, setPreviewAnswerSubmitted] = useState(false);

  const activeQuiz = quizzes[activeQuizIndex];

  const handleQuizChange = (field: string, value: string) => {
    const updatedQuizzes = [...quizzes];
    updatedQuizzes[activeQuizIndex] = {
      ...updatedQuizzes[activeQuizIndex],
      [field]: value,
    };
    setQuizzes(updatedQuizzes);
  };

  const handleSettingChange = (field: string, value: string | number | boolean) => {
    const updatedQuizzes = [...quizzes];
    updatedQuizzes[activeQuizIndex].settings = {
      ...updatedQuizzes[activeQuizIndex].settings,
      [field]: value,
    };
    setQuizzes(updatedQuizzes);
  };

  const handleQuestionChange = (questionIndex: number, field: string, value: string) => {
    const updatedQuizzes = [...quizzes];
    updatedQuizzes[activeQuizIndex].questions[questionIndex] = {
      ...updatedQuizzes[activeQuizIndex].questions[questionIndex],
      [field]: value,
    };
    setQuizzes(updatedQuizzes);
  };

  const handleOptionChange = (questionIndex: number, optionIndex: number, value: string) => {
    const updatedQuizzes = [...quizzes];
    updatedQuizzes[activeQuizIndex].questions[questionIndex].options[optionIndex] = value;
    setQuizzes(updatedQuizzes);
  };

  const handleCorrectAnswerChange = (questionIndex: number, optionIndex: number) => {
    const updatedQuizzes = [...quizzes];
    updatedQuizzes[activeQuizIndex].questions[questionIndex].correctAnswer = optionIndex;
    setQuizzes(updatedQuizzes);
  };

  const addQuestion = () => {
    const updatedQuizzes = [...quizzes];
    const newQuestionId = updatedQuizzes[activeQuizIndex].questions.length + 1;
    updatedQuizzes[activeQuizIndex].questions.push({
      id: newQuestionId,
      text: `Question ${newQuestionId}`,
      options: ["Option 1", "Option 2", "Option 3", "Option 4"],
      correctAnswer: 0,
      explanation: "Explanation for the correct answer",
    });
    setQuizzes(updatedQuizzes);
  };

  const removeQuestion = (questionIndex: number) => {
    const updatedQuizzes = [...quizzes];
    updatedQuizzes[activeQuizIndex].questions.splice(questionIndex, 1);
    setQuizzes(updatedQuizzes);
  };

  const moveQuestion = (questionIndex: number, direction: "up" | "down") => {
    if ((direction === "up" && questionIndex === 0) || (direction === "down" && questionIndex === activeQuiz.questions.length - 1)) {
      return;
    }

    const updatedQuizzes = [...quizzes];
    const questions = [...updatedQuizzes[activeQuizIndex].questions];
    const newIndex = direction === "up" ? questionIndex - 1 : questionIndex + 1;

    // Swap questions
    const temp = questions[questionIndex];
    questions[questionIndex] = questions[newIndex];
    questions[newIndex] = temp;

    updatedQuizzes[activeQuizIndex].questions = questions;
    setQuizzes(updatedQuizzes);
  };

  const addTag = () => {
    if (!newTag.trim() || activeQuiz.tags.includes(newTag.trim())) return;

    const updatedQuizzes = [...quizzes];
    updatedQuizzes[activeQuizIndex].tags.push(newTag.trim());
    setQuizzes(updatedQuizzes);
    setNewTag("");
  };

  const removeTag = (tagIndex: number) => {
    const updatedQuizzes = [...quizzes];
    updatedQuizzes[activeQuizIndex].tags.splice(tagIndex, 1);
    setQuizzes(updatedQuizzes);
  };

  const addQuiz = () => {
    const newQuiz = {
      id: quizzes.length + 1,
      title: `Untitled Quiz ${quizzes.length + 1}`,
      description: "Quiz description",
      difficulty: "medium",
      tags: [],
      questions: [
        {
          id: 1,
          text: "Question 1",
          options: ["Option 1", "Option 2", "Option 3", "Option 4"],
          correctAnswer: 0,
          explanation: "Explanation for the correct answer",
        },
      ],
      settings: {
        timeLimit: 0,
        randomizeQuestions: false,
        showExplanations: true,
        passingScore: 70,
        visibility: "private",
        allowRetakes: true,
        questionTimer: 0,
      },
    };
    setQuizzes([...quizzes, newQuiz]);
    setActiveQuizIndex(quizzes.length);
  };

  const deleteQuiz = () => {
    if (quizzes.length <= 1) {
      return;
    }

    const updatedQuizzes = [...quizzes];
    updatedQuizzes.splice(activeQuizIndex, 1);
    setQuizzes(updatedQuizzes);
    setActiveQuizIndex(Math.max(0, activeQuizIndex - 1));
  };

  const saveQuiz = () => {
    console.log("Saving quiz:", activeQuiz);
    // Here you would typically save the quiz to your backend
    toast.success("Quiz saved successfully!", {
      description: "Your changes have been saved.",
    });
  };

  const publishQuiz = () => {
    console.log("Publishing quiz:", activeQuiz);
    // Here you would typically publish the quiz to your backend
    toast.success("Quiz published successfully!", {
      description: "Your changes have been published.",
    });
  };

  const openPreview = () => {
    setPreviewQuestionIndex(0);
    setPreviewSelectedAnswer(null);
    setPreviewAnswerSubmitted(false);
    setIsPreviewOpen(true);
  };

  const handlePreviewAnswer = (optionIndex: number) => {
    if (previewAnswerSubmitted) return;
    setPreviewSelectedAnswer(optionIndex);
  };

  const submitPreviewAnswer = () => {
    if (previewSelectedAnswer === null) return;
    setPreviewAnswerSubmitted(true);
  };

  const nextPreviewQuestion = () => {
    if (previewQuestionIndex < activeQuiz.questions.length - 1) {
      setPreviewQuestionIndex(previewQuestionIndex + 1);
      setPreviewSelectedAnswer(null);
      setPreviewAnswerSubmitted(false);
    } else {
      setIsPreviewOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      {quizzes.length > 1 && (
        <div className="mb-6">
          <Label htmlFor="active-quiz">Select Quiz to Edit</Label>
          <Select value={activeQuizIndex.toString()} onValueChange={(value) => setActiveQuizIndex(Number.parseInt(value))}>
            <SelectTrigger id="active-quiz" className="mt-1">
              <SelectValue placeholder="Select quiz" />
            </SelectTrigger>
            <SelectContent>
              {quizzes.map((quiz, index) => (
                <SelectItem key={quiz.id} value={index.toString()}>
                  {quiz.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="details">Quiz Details</TabsTrigger>
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Quiz Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Quiz Title</Label>
                <Input id="title" value={activeQuiz.title} onChange={(e) => handleQuizChange("title", e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={activeQuiz.description} onChange={(e) => handleQuizChange("description", e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="difficulty">Difficulty Level</Label>
                <Select value={activeQuiz.difficulty} onValueChange={(value) => handleQuizChange("difficulty", value)}>
                  <SelectTrigger id="difficulty">
                    <SelectValue placeholder="Select difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {activeQuiz.tags.map((tag: string, index: number) => (
                    <Badge key={index} variant="secondary" className="px-2 py-1">
                      {tag}
                      <button type="button" className="ml-1 text-muted-foreground hover:text-foreground" onClick={() => removeTag(index)}>
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input placeholder="Add a tag" value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTag()} />
                  <Button type="button" variant="outline" onClick={addTag}>
                    Add
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="questions" className="space-y-4 pt-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Questions</h3>
            <Button onClick={addQuestion} size="sm">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Question
            </Button>
          </div>

          <Accordion type="single" collapsible className="w-full">
            {activeQuiz.questions.map((question: Question, questionIndex: number) => (
              <AccordionItem key={question.id} value={`question-${question.id}`}>
                <AccordionTrigger className="hover:bg-muted/50 px-4 rounded-md">
                  <div className="flex items-center justify-between w-full pr-4">
                    <span>Question {questionIndex + 1}</span>
                    <div className="flex items-center space-x-2">
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          moveQuestion(questionIndex, "up");
                        }}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </span>
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          moveQuestion(questionIndex, "down");
                        }}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </span>
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          removeQuestion(questionIndex);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pt-2">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor={`question-${question.id}-text`}>Question Text</Label>
                      <Textarea id={`question-${question.id}-text`} value={question.text} onChange={(e) => handleQuestionChange(questionIndex, "text", e.target.value)} />
                    </div>

                    <div className="space-y-2">
                      <Label>Options</Label>
                      <RadioGroup value={question.correctAnswer.toString()} onValueChange={(value) => handleCorrectAnswerChange(questionIndex, Number.parseInt(value))}>
                        {question.options.map((option: string, optionIndex: number) => (
                          <div key={optionIndex} className="flex items-center space-x-2 mb-2">
                            <RadioGroupItem value={optionIndex.toString()} id={`q${question.id}-option-${optionIndex}`} />
                            <Input value={option} onChange={(e) => handleOptionChange(questionIndex, optionIndex, e.target.value)} className="flex-1" />
                          </div>
                        ))}
                      </RadioGroup>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`question-${question.id}-explanation`}>Explanation (shown after answering)</Label>
                      <Textarea id={`question-${question.id}-explanation`} value={question.explanation} onChange={(e) => handleQuestionChange(questionIndex, "explanation", e.target.value)} />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Quiz Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="time-limit">Time Limit (minutes)</Label>
                <Select value={activeQuiz?.settings?.timeLimit?.toString()} onValueChange={(value) => handleSettingChange("timeLimit", Number.parseInt(value))}>
                  <SelectTrigger id="time-limit">
                    <SelectValue placeholder="Select time limit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">No time limit</SelectItem>
                    <SelectItem value="5">5 minutes</SelectItem>
                    <SelectItem value="10">10 minutes</SelectItem>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="question-timer">Time Per Question (seconds)</Label>
                <Select value={activeQuiz?.settings?.questionTimer?.toString()} onValueChange={(value) => handleSettingChange("questionTimer", Number.parseInt(value))}>
                  <SelectTrigger id="question-timer">
                    <SelectValue placeholder="Select time per question" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">No limit per question</SelectItem>
                    <SelectItem value="10">10 seconds</SelectItem>
                    <SelectItem value="15">15 seconds</SelectItem>
                    <SelectItem value="30">30 seconds</SelectItem>
                    <SelectItem value="45">45 seconds</SelectItem>
                    <SelectItem value="60">60 seconds</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="randomize-questions">Randomize Questions</Label>
                <Switch id="randomize-questions" checked={activeQuiz?.settings?.randomizeQuestions} onCheckedChange={(checked) => handleSettingChange("randomizeQuestions", checked)} />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="show-explanations">Show Explanations After Answering</Label>
                <Switch id="show-explanations" checked={activeQuiz?.settings?.showExplanations} onCheckedChange={(checked) => handleSettingChange("showExplanations", checked)} />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="allow-retakes">Allow Retakes</Label>
                <Switch id="allow-retakes" checked={activeQuiz?.settings?.allowRetakes} onCheckedChange={(checked) => handleSettingChange("allowRetakes", checked)} />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="passing-score">Passing Score: {activeQuiz?.settings?.passingScore || 70}%</Label>
                </div>
                <Slider id="passing-score" min={0} max={100} step={5} value={[activeQuiz?.settings?.passingScore || 70]} onValueChange={(value) => handleSettingChange("passingScore", value[0])} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="visibility">Quiz Visibility</Label>
                <Select value={activeQuiz?.settings?.visibility} onValueChange={(value) => handleSettingChange("visibility", value)}>
                  <SelectTrigger id="visibility">
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Private (Only you can see)</SelectItem>
                    <SelectItem value="unlisted">Unlisted (Anyone with link)</SelectItem>
                    <SelectItem value="public">Public (Listed in explore)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex flex-wrap justify-between gap-2 mt-8">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={addQuiz}>
            <PlusCircle className="mr-2 h-4 w-4" /> New Quiz
          </Button>

          <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={openPreview}>
                <Eye className="mr-2 h-4 w-4" /> Preview
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Quiz Preview</DialogTitle>
              </DialogHeader>
              {activeQuiz.questions.length > 0 && (
                <div className="space-y-4">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>
                      Question {previewQuestionIndex + 1} of {activeQuiz.questions.length}
                    </span>
                    <span>Preview Mode</span>
                  </div>

                  <div className="p-4 border rounded-md">
                    <h3 className="text-lg font-medium mb-4">{activeQuiz.questions[previewQuestionIndex].text}</h3>

                    <div className="space-y-2">
                      {activeQuiz.questions[previewQuestionIndex].options.map((option: string, index: number) => (
                        <div key={index} className={`p-3 border rounded-md cursor-pointer ${previewSelectedAnswer === index ? "border-primary" : ""} ${previewAnswerSubmitted && index === activeQuiz.questions[previewQuestionIndex].correctAnswer ? "bg-green-500/20 border-green-500" : previewAnswerSubmitted && previewSelectedAnswer === index ? "bg-red-500/20 border-red-500" : ""}`} onClick={() => handlePreviewAnswer(index)}>
                          <div className="flex items-center">
                            <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center mr-2">{String.fromCharCode(65 + index)}</span>
                            {option}
                          </div>
                        </div>
                      ))}
                    </div>

                    {previewAnswerSubmitted && activeQuiz.settings.showExplanations && (
                      <div className="mt-4 p-3 bg-muted/50 rounded-md">
                        <p className="font-medium">Explanation:</p>
                        <p>{activeQuiz.questions[previewQuestionIndex].explanation}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2">
                    {!previewAnswerSubmitted ? (
                      <Button onClick={submitPreviewAnswer} disabled={previewSelectedAnswer === null}>
                        Submit Answer
                      </Button>
                    ) : (
                      <Button onClick={nextPreviewQuestion}>{previewQuestionIndex < activeQuiz.questions.length - 1 ? "Next Question" : "Finish Preview"}</Button>
                    )}
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-wrap gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash className="mr-2 h-4 w-4" /> Delete Quiz
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>This action cannot be undone. This will permanently delete the quiz "{activeQuiz.title}" and remove it from our servers.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={deleteQuiz}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button variant="outline" onClick={saveQuiz}>
            <Save className="mr-2 h-4 w-4" /> Save Draft
          </Button>

          <Button onClick={publishQuiz}>
            <Upload className="mr-2 h-4 w-4" /> Publish Quiz
          </Button>
        </div>
      </div>
    </div>
  );
}
