"use client";
import { GeneratedAvatar } from "@/components/media/generated-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { PageCopySection } from "@/content/pages";
import { fillLabel, itemLabel } from "@/lib/page-copy";
import {
  Filter,
  Flag,
  MessageCircle,
  MoreHorizontal,
  PlusCircle,
  Search,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { useState } from "react";

interface TournamentDiscussionProps {
  tournamentId: string;
  copy: PageCopySection;
}

// The three sort orders, in menu order: the fixture owns the words, this owns the values.
const SORTS = [
  { id: "sort-recent", value: "recent" },
  { id: "sort-popular", value: "popular" },
  { id: "sort-replies", value: "most-replies" },
] as const;

// The discussion tabs, in render order — same split as `SORTS`.
const TABS = [
  { id: "tab-all", value: "all" },
  { id: "tab-strategy", value: "strategy" },
  { id: "tab-questions", value: "questions" },
  { id: "tab-technical", value: "technical" },
] as const;

// Mock data for discussions
const mockDiscussions = [
  {
    id: "1",
    title: "Strategy for Round 1: Speed vs. Accuracy",
    author: {
      id: "user1",
      name: "Alex Johnson",
      avatar: media["avatars.alex"].src,
      role: "Tournament Finalist",
    },
    content:
      "I'm wondering what everyone's approach is for the first round. Are you focusing on answering quickly to maximize points, or taking your time to ensure accuracy?",
    createdAt: "2 hours ago",
    likes: 24,
    replies: 8,
    tags: ["strategy", "round-1"],
    pinned: true,
  },
  {
    id: "2",
    title: "History questions seem much harder than other categories",
    author: {
      id: "user2",
      name: "Sarah Williams",
      avatar: media["avatars.sarah"].src,
      role: "Participant",
    },
    content:
      "Did anyone else notice that the history questions in the practice round were significantly more difficult than other categories? I'm wondering if I should focus my preparation there.",
    createdAt: "5 hours ago",
    likes: 18,
    replies: 12,
    tags: ["difficulty", "history"],
    pinned: false,
  },
  {
    id: "3",
    title: "Looking for a study group for the science category",
    author: {
      id: "user3",
      name: "Michael Chen",
      avatar: media["avatars.wizard"].src,
      role: "Participant",
    },
    content:
      "I'm looking to form a small study group (3-4 people) to prepare for the science questions. Anyone interested? We could share resources and quiz each other.",
    createdAt: "1 day ago",
    likes: 15,
    replies: 20,
    tags: ["study-group", "science"],
    pinned: false,
  },
  {
    id: "4",
    title: "Technical issues during practice round",
    author: {
      id: "user4",
      name: "Emily Rodriguez",
      avatar: media["avatars.guru"].src,
      role: "Participant",
    },
    content:
      "I experienced some lag during the practice round that caused me to miss a few questions. Has anyone else had similar issues? Any tips for preventing this during the actual tournament?",
    createdAt: "1 day ago",
    likes: 8,
    replies: 15,
    tags: ["technical", "issues"],
    pinned: false,
  },
  {
    id: "5",
    title: "Official rules clarification needed",
    author: {
      id: "user5",
      name: "David Kim",
      avatar: media["avatars.master"].src,
      role: "Participant",
    },
    content:
      "The rules state that 'external resources are not permitted during the tournament.' Does this include personal notes made before the tournament starts?",
    createdAt: "2 days ago",
    likes: 32,
    replies: 7,
    tags: ["rules", "clarification"],
    pinned: false,
  },
];

// Mock data for comments on a discussion
const mockComments = [
  {
    id: "c1",
    author: {
      id: "user6",
      name: "Jessica Taylor",
      avatar: media["avatars.mind"].src,
      role: "Tournament Moderator",
    },
    content:
      "Great question! I personally focus on accuracy first, especially in the early rounds. Speed becomes more important in the later rounds when the questions get harder and time pressure increases.",
    createdAt: "1 hour ago",
    likes: 12,
    isOfficial: true,
  },
  {
    id: "c2",
    author: {
      id: "user7",
      name: "Robert Chen",
      avatar: media["avatars.brain"].src,
      role: "Previous Champion",
    },
    content:
      "I've found that a balanced approach works best. For questions you're confident about, answer quickly. For ones you're unsure of, take a bit more time but don't overthink. Remember that in Round 1, incorrect answers don't have a penalty, so it's better to guess than to skip.",
    createdAt: "1.5 hours ago",
    likes: 18,
    isOfficial: false,
  },
  {
    id: "c3",
    author: {
      id: "user8",
      name: "Sophia Martinez",
      avatar: media["avatars.genious"].src,
      role: "Participant",
    },
    content:
      "I'm planning to go for speed in categories I'm strong in (science and literature) and take more time in my weaker areas (sports and geography). Has anyone tried this approach before?",
    createdAt: "1.8 hours ago",
    likes: 5,
    isOfficial: false,
  },
];

export function TournamentDiscussion({ tournamentId, copy }: TournamentDiscussionProps) {
  const [activeDiscussion, setActiveDiscussion] = useState<string | null>(null);
  const [filter, setFilter] = useState("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [newPostOpen, setNewPostOpen] = useState(false);
  const [newCommentText, setNewCommentText] = useState("");

  // Filter and sort discussions based on current filter and search
  const filteredDiscussions = mockDiscussions
    .filter(
      (discussion) =>
        discussion.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        discussion.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        discussion.tags.some((tag) => tag.includes(searchQuery.toLowerCase())),
    )
    .sort((a, b) => {
      if (filter === "recent") {
        return a.createdAt < b.createdAt ? 1 : -1;
      } else if (filter === "popular") {
        return a.likes < b.likes ? 1 : -1;
      } else if (filter === "most-replies") {
        return a.replies < b.replies ? 1 : -1;
      }
      return 0;
    });

  // If a discussion is selected, show its details and comments
  if (activeDiscussion) {
    const discussion = mockDiscussions.find((d) => d.id === activeDiscussion);
    if (!discussion) return null;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setActiveDiscussion(null)}
            className="flex items-center gap-2"
          >
            {itemLabel(copy, "back")}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <Flag className="h-4 w-4" />
              {itemLabel(copy, "report")}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>{itemLabel(copy, "bookmark")}</DropdownMenuItem>
                <DropdownMenuItem>{itemLabel(copy, "share")}</DropdownMenuItem>
                <DropdownMenuItem>{itemLabel(copy, "subscribe")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="bg-card rounded-lg p-6 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <GeneratedAvatar
                name={discussion.author.name}
                seed={discussion.author.id ?? discussion.author.name}
                size={40}
                className="border-2 border-primary/20"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{discussion.author.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {discussion.author.role}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{discussion.createdAt}</p>
              </div>
            </div>
            {discussion.pinned && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2v10" />
                  <path d="M12 22v-3" />
                  <path d="M4.93 10.93l1.41 1.41" />
                  <path d="M17.66 11.7l1.41 1.41" />
                  <path d="M2 18h2" />
                  <path d="M20 18h2" />
                  <path d="M4.93 19.07l1.41-1.41" />
                  <path d="M17.66 17.3l1.41-1.41" />
                </svg>
                {itemLabel(copy, "pinned")}
              </Badge>
            )}
          </div>

          <h2 className="text-2xl font-semibold mb-3">{discussion.title}</h2>
          <p className="mb-4">{discussion.content}</p>

          <div className="flex flex-wrap gap-2 mb-4">
            {discussion.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="bg-muted/50">
                #{tag}
              </Badge>
            ))}
          </div>

          <div className="flex items-center gap-4 text-muted-foreground">
            <Button variant="ghost" size="sm" className="flex items-center gap-1">
              <ThumbsUp className="h-4 w-4" />
              <span>{discussion.likes}</span>
            </Button>
            <Button variant="ghost" size="sm" className="flex items-center gap-1">
              <ThumbsDown className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="flex items-center gap-1">
              <MessageCircle className="h-4 w-4" />
              <span>
                {fillLabel(itemLabel(copy, "replies-count"), { count: discussion.replies })}
              </span>
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-xl font-semibold">{itemLabel(copy, "replies-heading")}</h3>

          {mockComments.map((comment) => (
            <div key={comment.id} className="bg-card rounded-lg p-5 shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <GeneratedAvatar
                    name={comment.author.name}
                    seed={comment.author.id ?? comment.author.name}
                    size={36}
                    className={comment.isOfficial ? "border-2 border-primary" : undefined}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{comment.author.name}</span>
                      <Badge
                        variant={comment.isOfficial ? "default" : "outline"}
                        className="text-xs"
                      >
                        {comment.author.role}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{comment.createdAt}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>

              <p className="mb-3">{comment.content}</p>

              <div className="flex items-center gap-4 text-muted-foreground">
                <Button variant="ghost" size="sm" className="flex items-center gap-1">
                  <ThumbsUp className="h-4 w-4" />
                  <span>{comment.likes}</span>
                </Button>
                <Button variant="ghost" size="sm" className="flex items-center gap-1">
                  <ThumbsDown className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="flex items-center gap-1">
                  {itemLabel(copy, "reply")}
                </Button>
              </div>
            </div>
          ))}

          <div className="bg-muted/30 rounded-lg p-5">
            <h4 className="font-medium mb-3">{itemLabel(copy, "add-reply")}</h4>
            <Textarea
              placeholder={itemLabel(copy, "reply-placeholder")}
              className="mb-3 min-h-[100px]"
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNewCommentText("")}>
                {itemLabel(copy, "cancel")}
              </Button>
              <Button>{itemLabel(copy, "post-reply")}</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main discussion list view
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-semibold">{copy.heading}</h2>
        <Dialog open={newPostOpen} onOpenChange={setNewPostOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              {itemLabel(copy, "new-discussion")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader>
              <DialogTitle>{itemLabel(copy, "dialog-title")}</DialogTitle>
              <DialogDescription>{itemLabel(copy, "dialog-body")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="title" className="text-sm font-medium">
                  {itemLabel(copy, "title-label")}
                </label>
                <Input id="title" placeholder={itemLabel(copy, "title-placeholder")} />
              </div>
              <div className="space-y-2">
                <label htmlFor="content" className="text-sm font-medium">
                  {itemLabel(copy, "content-label")}
                </label>
                <Textarea
                  id="content"
                  placeholder={itemLabel(copy, "content-placeholder")}
                  className="min-h-[150px]"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="tags" className="text-sm font-medium">
                  {itemLabel(copy, "tags-label")}
                </label>
                <Input id="tags" placeholder={itemLabel(copy, "tags-placeholder")} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewPostOpen(false)}>
                {itemLabel(copy, "cancel")}
              </Button>
              <Button onClick={() => setNewPostOpen(false)}>
                {itemLabel(copy, "post-discussion")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-[300px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={itemLabel(copy, "search-placeholder")}
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                {itemLabel(copy, SORTS.find((sort) => sort.value === filter)?.id ?? "sort-recent")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {SORTS.map((sort) => (
                <DropdownMenuItem key={sort.value} onClick={() => setFilter(sort.value)}>
                  {itemLabel(copy, sort.id)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="w-full sm:w-auto grid grid-cols-4 sm:inline-flex">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {itemLabel(copy, tab.id)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="space-y-4">
        {filteredDiscussions.length > 0 ? (
          filteredDiscussions.map((discussion) => (
            <div
              key={discussion.id}
              className="bg-card hover:bg-card/80 rounded-lg p-5 shadow-sm cursor-pointer transition-colors"
              onClick={() => setActiveDiscussion(discussion.id)}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-3">
                  <GeneratedAvatar
                    name={discussion.author.name}
                    seed={discussion.author.id ?? discussion.author.name}
                    size={32}
                  />
                  <div>
                    <span className="text-sm font-medium">{discussion.author.name}</span>
                    <p className="text-xs text-muted-foreground">{discussion.createdAt}</p>
                  </div>
                </div>
                {discussion.pinned && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 2v10" />
                      <path d="M12 22v-3" />
                      <path d="M4.93 10.93l1.41 1.41" />
                      <path d="M17.66 11.7l1.41 1.41" />
                      <path d="M2 18h2" />
                      <path d="M20 18h2" />
                      <path d="M4.93 19.07l1.41-1.41" />
                      <path d="M17.66 17.3l1.41-1.41" />
                    </svg>
                    {itemLabel(copy, "pinned")}
                  </Badge>
                )}
              </div>

              <h3 className="text-lg font-medium mb-2">{discussion.title}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                {discussion.content}
              </p>

              <div className="flex flex-wrap gap-2 mb-3">
                {discussion.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs bg-muted/50">
                    #{tag}
                  </Badge>
                ))}
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <ThumbsUp className="h-3.5 w-3.5" />
                  <span>{discussion.likes}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>
                    {fillLabel(itemLabel(copy, "replies-count"), { count: discussion.replies })}
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-muted/50 rounded-lg p-8 text-center">
            <h3 className="text-xl font-medium mb-2">{itemLabel(copy, "empty-heading")}</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery
                ? fillLabel(itemLabel(copy, "empty-search"), { query: searchQuery })
                : itemLabel(copy, "empty-first")}
            </p>
            <Button
              onClick={() => {
                setSearchQuery("");
                setNewPostOpen(true);
              }}
            >
              {itemLabel(copy, "start-new")}
            </Button>
          </div>
        )}
      </div>

      <div className="flex justify-center">
        <Button variant="outline" className="w-full sm:w-auto">
          {itemLabel(copy, "load-more")}
        </Button>
      </div>
    </div>
  );
}
