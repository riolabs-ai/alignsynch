"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DIFFICULTIES } from "@/content/core";
import type { Quiz } from "@/content/quiz";
import { mockQuizzes } from "@/data/mock-quizzes";
import { Layers } from "lucide-react";
import { useState } from "react";
import { QuizEditor } from "./quiz-editor";
import { DRAFT_COUNTS, composeDraft } from "./quiz-generator-templates";

/**
 * The generator: it composes a draft out of the built-in template library (`data/mock-quizzes`)
 * and retitles each row with the topic typed here. There is no model, no prompt and no network
 * call behind this form — `composeDraft` is the whole rule, and
 * `tests/quiz-generator-templates.test.ts` pins it (#287).
 *
 * The difficulty and the count are read by that rule. Until #287 both were collected and thrown
 * away, and every run returned five rows whatever the controls said.
 */
export function QuizGenerator() {
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<string>("medium");
  const [draftCount, setDraftCount] = useState<string>("5");
  const [drafts, setDrafts] = useState<Quiz[]>([]);
  const [available, setAvailable] = useState(0);
  const [isBuilt, setIsBuilt] = useState(false);

  const build = () => {
    const result = composeDraft(mockQuizzes, {
      topic,
      difficulty,
      count: Number(draftCount),
    });
    setDrafts(result.quizzes);
    setAvailable(result.available);
    setIsBuilt(true);
  };

  const requested = Number(draftCount);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="generator" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="generator">Generator</TabsTrigger>
          <TabsTrigger value="editor" disabled={!isBuilt}>
            Edit Draft
          </TabsTrigger>
        </TabsList>
        <TabsContent value="generator" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Quiz Generator</CardTitle>
              <CardDescription>
                Builds a draft from the built-in template library and retitles it with your topic.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="topic">Quiz Topic</Label>
                <Input
                  id="topic"
                  placeholder="e.g., World History, Space Exploration, etc."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="difficulty">Difficulty Level</Label>
                  <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger id="difficulty">
                      <SelectValue placeholder="Select difficulty" />
                    </SelectTrigger>
                    <SelectContent>
                      {DIFFICULTIES.map((level) => (
                        <SelectItem key={level} value={level}>
                          {level.charAt(0).toUpperCase() + level.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="draft-count">Number of Drafts</Label>
                  <Select value={draftCount} onValueChange={setDraftCount}>
                    <SelectTrigger id="draft-count">
                      <SelectValue placeholder="Select count" />
                    </SelectTrigger>
                    <SelectContent>
                      {DRAFT_COUNTS.map((count) => (
                        <SelectItem key={count} value={String(count)}>
                          {count} drafts
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={build} disabled={!topic.trim()} className="w-full">
                <Layers className="mr-2 h-4 w-4" />
                Build Draft
              </Button>
            </CardFooter>
          </Card>

          {isBuilt && (
            <div className="rounded-lg border bg-muted/50 p-4">
              <h3 className="mb-2 text-lg font-medium">Draft built</h3>
              <p className="text-muted-foreground">
                {drafts.length} {drafts.length === 1 ? "quiz" : "quizzes"} from the {difficulty}{" "}
                templates in the library, each retitled with "{topic}".
              </p>
              {drafts.length < requested && (
                <p className="mt-2 text-muted-foreground">
                  The library holds {available} templates at {difficulty} difficulty, so it builds
                  that many and stops.
                </p>
              )}
              <p className="mt-2 text-muted-foreground">
                Open the "Edit Draft" tab above to change the questions before publishing.
              </p>
              <div className="mt-4 space-y-2">
                <h4 className="font-medium">Drafted Quizzes:</h4>
                <div className="grid gap-2">
                  {drafts.map((quiz) => (
                    <div key={quiz.id} className="rounded border p-3">
                      <div className="flex items-center justify-between">
                        <h5 className="font-medium">{quiz.title}</h5>
                        <Badge variant="outline">{quiz.difficulty}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{quiz.summary}</p>
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

        <TabsContent value="editor">
          {isBuilt && <QuizEditor initialQuizzes={drafts} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
