"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { mockQuizzes } from "@/data/mock-quizzes";
import { Quiz } from "@/types/quiz";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { QuizEditor } from "./quiz-editor";

// Mock quiz data array with 20 quizzes

export function QuizGenerator() {
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [questionCount, setQuestionCount] = useState("5");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [generatedQuizzes, setGeneratedQuizzes] = useState<Quiz[]>([]);

  const handleGenerate = () => {
    if (!topic) return;

    setIsGenerating(true);

    // Simulate API call with timeout
    setTimeout(() => {
      // Select 5 random quizzes from the mockQuizzes array
      const shuffled = [...mockQuizzes].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 5);

      // Update the topic of the selected quizzes based on user input
      const customizedQuizzes = selected.map((quiz, index) => ({
        ...quiz,
        id: index + 1,
        title: `${topic} - ${quiz.title}`,
        tags: [...quiz.tags, topic.toLowerCase()],
        settings: {
          timeLimit: 0,
          randomizeQuestions: false,
          showExplanations: true,
          passingScore: 70,
          visibility: "private",
          allowRetakes: true,
          questionTimer: 0,
        },
      }));

      setGeneratedQuizzes(customizedQuizzes);
      setIsGenerating(false);
      setIsGenerated(true);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="generator" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="generator">AI Generator</TabsTrigger>
          <TabsTrigger value="editor" disabled={!isGenerated}>
            Edit Generated Quiz
          </TabsTrigger>
        </TabsList>
        <TabsContent value="generator" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Quiz Generator</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="topic">Quiz Topic</Label>
                <Input id="topic" placeholder="e.g., World History, Space Exploration, etc." value={topic} onChange={(e) => setTopic(e.target.value)} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="difficulty">Difficulty Level</Label>
                  <Select value={difficulty} onValueChange={setDifficulty}>
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
                  <Label htmlFor="question-count">Number of Questions</Label>
                  <Select value={questionCount} onValueChange={setQuestionCount}>
                    <SelectTrigger id="question-count">
                      <SelectValue placeholder="Select count" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 Questions</SelectItem>
                      <SelectItem value="10">10 Questions</SelectItem>
                      <SelectItem value="15">15 Questions</SelectItem>
                      <SelectItem value="20">20 Questions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="additional-info">Additional Information (Optional)</Label>
                <Textarea id="additional-info" placeholder="Any specific requirements or focus areas for the quiz" />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleGenerate} disabled={!topic || isGenerating} className="w-full">
                {isGenerating ? (
                  <>Generating Quiz...</>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" /> Generate Quiz
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          {isGenerated && (
            <div className="rounded-lg border bg-muted/50 p-4">
              <h3 className="mb-2 text-lg font-medium">Quiz Generated Successfully!</h3>
              <p className="text-muted-foreground">
                Your quiz on "{topic}" has been generated with {questionCount} {difficulty} difficulty questions.
              </p>
              <p className="mt-2 text-muted-foreground">Click the "Edit Generated Quiz" tab above to review and customize your quiz before publishing.</p>
              <div className="mt-4 space-y-2">
                <h4 className="font-medium">Generated Quizzes:</h4>
                <div className="grid gap-2">
                  {generatedQuizzes.map((quiz) => (
                    <div key={quiz.id} className="rounded border p-3">
                      <div className="flex items-center justify-between">
                        <h5 className="font-medium">{quiz.title}</h5>
                        <Badge variant="outline">{quiz.difficulty}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{quiz.description}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {quiz.tags.map((tag: string) => (
                          <Badge key={tag} variant="default" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="editor">{isGenerated && <QuizEditor initialQuizzes={generatedQuizzes} />}</TabsContent>
      </Tabs>
    </div>
  );
}
