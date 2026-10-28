import { AlertCircle, Calendar, Gift, Star, Trophy, Users } from "lucide-react";
import { JSX } from "react";
export type Notification = {
  id: string;
  type: string;
  title: string;
  description: string;
  time: string;
  icon: JSX.Element;
  read: boolean;
  link: string;
};
// Mock notifications data
export const notifications: Notification[] = [
  {
    id: "notif-1",
    type: "achievement",
    title: "Achievement Unlocked!",
    description: "You've earned the 'Quiz Master' badge for creating 10 quizzes!",
    time: "10m ago",
    icon: <Trophy className="h-5 w-5 text-yellow-500" />,
    read: false,
    link: "/profile/achievements",
  },
  {
    id: "notif-2",
    type: "social",
    title: "New Follower",
    description: "Sarah Williams started following you",
    time: "1h ago",
    icon: <Users className="h-5 w-5 text-blue-500" />,
    read: false,
    link: "/profile/followers",
  },
  {
    id: "notif-3",
    type: "reward",
    title: "Quiz Reward",
    description: "You've earned $5.25 from your 'History Trivia' quiz!",
    time: "3h ago",
    icon: <Gift className="h-5 w-5 text-green-500" />,
    read: false,
    link: "/earnings",
  },
  {
    id: "notif-4",
    type: "event",
    title: "Tournament Starting Soon",
    description: "The 'Science Quiz Championship' starts in 2 hours",
    time: "5h ago",
    icon: <Calendar className="h-5 w-5 text-purple-500" />,
    read: true,
    link: "/tournaments",
  },
  {
    id: "notif-5",
    type: "system",
    title: "System Update",
    description: "We've added new quiz creation tools! Check them out.",
    time: "1d ago",
    icon: <AlertCircle className="h-5 w-5 text-red-500" />,
    read: true,
    link: "/create",
  },
  {
    id: "notif-6",
    type: "featured",
    title: "Quiz Featured",
    description: "Your 'Movie Trivia' quiz has been featured on the homepage!",
    time: "2d ago",
    icon: <Star className="h-5 w-5 text-amber-500" />,
    read: true,
    link: "/my-quizzes",
  },
];
