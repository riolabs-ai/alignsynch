"use client";

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
import { type BattleMode, type BattleModeId, isRosterRange } from "@/content/battle";
import { quizCategoryLabel } from "@/content/categories";
import { DIFFICULTIES, type Difficulty, difficultyLabel, isDifficulty } from "@/content/core";
import { formatCountRange } from "@/content/metrics";
import type { PageCopy, PageCopySection } from "@/content/pages";
import { battleModes, battleRoundOptions } from "@/data/battle-modes";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";
import {
  Clock,
  Globe,
  ListChecks,
  Lock,
  Swords,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { BattleState } from "./battle-page";

/**
 * The subjects a battle can be fought over. Slugs, not labels: the taxonomy owns the text
 * (`quizCategoryLabel`), so renaming a subject in `content/categories.ts` moves here for
 * free. `random` is a control, not a subject, and stays a plain option value.
 */
const BATTLE_SUBJECTS = ["science", "history", "geography", "sports"] as const;

/**
 * A mode's tab icon. Presentation keyed by the record's id — a React component cannot
 * live in `data/battle-modes.ts`, which `data:check` compiles and runs under plain node.
 */
function ModeIcon({ id, className }: { id: BattleModeId; className: string }) {
  return id === "group" ? <Users className={className} /> : <Swords className={className} />;
}

/**
 * The tab label: the record's `name`, plus the roster range when the mode *has* one.
 * `1v1` is 2-2 and reads as its name alone; `group` is 3-10 and reads
 * `Group Battle (3-10 players)`. The rule is the record's own shape, not the id, so a
 * fixture edit that gives `1v1` a range shows it without touching this file.
 */
function tabLabel(mode: BattleMode, form: PageCopySection): string {
  if (!isRosterRange(mode)) return mode.name;
  const range = fillLabel(itemLabel(form, "tab-players"), {
    players: formatCountRange(mode.playersMin, mode.playersMax),
  });
  return `${mode.name} ${range}`;
}

/** A mode description, with its one placeholder filled from the record's roster. */
function modeDescription(mode: BattleMode): string {
  return fillLabel(mode.description, {
    players: formatCountRange(mode.playersMin, mode.playersMax),
  });
}

interface BattleModeSelectionProps {
  copy: PageCopy;
  onModeSelect: (
    mode: BattleModeId,
    type: "public" | "private",
    settings: Partial<BattleState>,
  ) => void;
}

/**
 * The mode picker. The tab list, the cards and their defaults are `battleModes` mapped in
 * fixture order — the two copied forms this file used to hold (66 literals between them)
 * are one `BattleSettingsCard` rendered per record, so a mode's player range, description
 * and default round come from the fixture and never from here.
 */
export function BattleModeSelection({ copy, onModeSelect }: BattleModeSelectionProps) {
  const form = sectionOf(copy, "mode-form");

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">{copy.heading}</h1>
        <p className="text-muted-foreground">{copy.subtitle}</p>
      </div>

      <Tabs defaultValue={battleModes[0].id} className="w-full">
        <TabsList className="mb-6 flex overflow-x-auto gap-4 sm:grid grid-cols-2">
          {battleModes.map((mode) => (
            <TabsTrigger key={mode.id} value={mode.id} className="flex items-center gap-2">
              <ModeIcon id={mode.id} className="h-4 w-4" />
              <span>{tabLabel(mode, form)}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {battleModes.map((mode) => (
          <TabsContent key={mode.id} value={mode.id} className="space-y-6">
            <BattleSettingsCard
              mode={mode}
              copy={copy}
              // The first mode's control ids are unsuffixed and every later mode's are
              // suffixed with its own id, which is the id scheme the two cards already had
              // (`battle-type`, `battle-type-group`) — ids are markup, not copy.
              idSuffix={mode.id === battleModes[0].id ? "" : `-${mode.id}`}
              onStart={(type, settings) => onModeSelect(mode.id, type, settings)}
            />
          </TabsContent>
        ))}
      </Tabs>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <BulletCard
          copy={sectionOf(copy, "rewards-card")}
          Icon={Trophy}
          iconClassName="h-5 w-5 text-yellow-500"
          bulletClassName="h-2 w-2 rounded-full bg-green-500"
        />
        <BulletCard
          copy={sectionOf(copy, "rules-card")}
          Icon={Clock}
          iconClassName="h-5 w-5 text-blue-500"
          bulletClassName="h-2 w-2 rounded-full bg-blue-500"
        />
        <BulletCard
          copy={sectionOf(copy, "ranking-card")}
          Icon={ListChecks}
          iconClassName="h-5 w-5 text-action"
          bulletClassName="h-2 w-2 rounded-full bg-action"
        />
      </div>
    </div>
  );
}

interface BattleSettingsCardProps {
  mode: BattleMode;
  copy: PageCopy;
  idSuffix: string;
  onStart: (type: "public" | "private", settings: Partial<BattleState>) => void;
}

/**
 * One mode's card: the settings form plus its start button.
 *
 * The form's state is per mode and starts on that mode's values (`timeLimitSeconds`,
 * `questionCount`), which is what makes a fixture edit visible: change the group mode's
 * question count and the Group Battle card opens on the new number with no `.tsx` edit.
 */
function BattleSettingsCard({ mode, copy, idSuffix, onStart }: BattleSettingsCardProps) {
  const form = sectionOf(copy, "mode-form");
  const [battleType, setBattleType] = useState<"public" | "private">("public");
  const [category, setCategory] = useState<string>("random");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [timePerQuestion, setTimePerQuestion] = useState<number>(mode.timeLimitSeconds);
  const [totalQuestions, setTotalQuestions] = useState<number>(mode.questionCount);
  const [roomCode, setRoomCode] = useState<string>("");

  const handleStartBattle = () => {
    onStart(battleType, {
      category: category !== "random" ? category : undefined,
      difficulty,
      timePerQuestion,
      totalQuestions,
      roomCode: battleType === "private" ? roomCode : undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode.name}</CardTitle>
        <CardDescription>{modeDescription(mode)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`battle-type${idSuffix}`}>{itemLabel(form, "battle-type")}</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={battleType === "public" ? "default" : "outline"}
                className="w-full flex items-center justify-center gap-2"
                onClick={() => setBattleType("public")}
              >
                <Globe className="h-4 w-4" />
                <span>{itemLabel(form, "type-public")}</span>
              </Button>
              <Button
                variant={battleType === "private" ? "default" : "outline"}
                className="w-full flex items-center justify-center gap-2"
                onClick={() => setBattleType("private")}
              >
                <Lock className="h-4 w-4" />
                <span>{itemLabel(form, "type-private")}</span>
              </Button>
            </div>
          </div>

          {battleType === "private" && (
            <div className="space-y-2">
              <Label htmlFor={`room-code${idSuffix}`}>{itemLabel(form, "room-code")}</Label>
              <Input
                id={`room-code${idSuffix}`}
                placeholder={itemLabel(form, "room-code-placeholder")}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor={`category${idSuffix}`}>{itemLabel(form, "category")}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id={`category${idSuffix}`}>
                <SelectValue placeholder={itemLabel(form, "category-placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="random">{itemLabel(form, "category-random")}</SelectItem>
                {BATTLE_SUBJECTS.map((slug) => (
                  <SelectItem key={slug} value={slug}>
                    {quizCategoryLabel(slug)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`difficulty${idSuffix}`}>{itemLabel(form, "difficulty")}</Label>
            <Select
              value={difficulty}
              onValueChange={(value) => {
                if (isDifficulty(value)) setDifficulty(value);
              }}
            >
              <SelectTrigger id={`difficulty${idSuffix}`}>
                <SelectValue placeholder={itemLabel(form, "difficulty-placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {DIFFICULTIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {difficultyLabel(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`time-per-question${idSuffix}`}>
              {itemLabel(form, "time-per-question")}
            </Label>
            <Select
              value={timePerQuestion.toString()}
              onValueChange={(value) => setTimePerQuestion(Number.parseInt(value))}
            >
              <SelectTrigger id={`time-per-question${idSuffix}`}>
                <SelectValue placeholder={itemLabel(form, "time-placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {battleRoundOptions.timeLimitsSeconds.map((seconds) => (
                  <SelectItem key={seconds} value={seconds.toString()}>
                    {fillLabel(itemLabel(form, "time-option"), { value: seconds })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`total-questions${idSuffix}`}>
              {itemLabel(form, "question-count")}
            </Label>
            <Select
              value={totalQuestions.toString()}
              onValueChange={(value) => setTotalQuestions(Number.parseInt(value))}
            >
              <SelectTrigger id={`total-questions${idSuffix}`}>
                <SelectValue placeholder={itemLabel(form, "count-placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {battleRoundOptions.questionCounts.map((count) => (
                  <SelectItem key={count} value={count.toString()}>
                    {fillLabel(itemLabel(form, "count-option"), { value: count })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleStartBattle} className="w-full">
          {fillLabel(itemLabel(form, "start"), { name: mode.name })}
        </Button>
      </CardFooter>
    </Card>
  );
}

interface BulletCardProps {
  copy: PageCopySection;
  Icon: LucideIcon;
  iconClassName: string;
  bulletClassName: string;
}

/** One of the three info cards under the modes: a heading, an icon and three bullets. */
function BulletCard({ copy, Icon, iconClassName, bulletClassName }: BulletCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Icon className={iconClassName} />
          {copy.heading}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1 text-sm">
          {(copy.items ?? []).map((item) => (
            <li key={item.id} className="flex items-center gap-2">
              <div className={bulletClassName}></div>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
