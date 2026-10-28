import { recentMessages } from "@/data/chat-data";
import { Avatar, AvatarFallback, AvatarImage } from "@radix-ui/react-avatar";
import { X } from "lucide-react";
import Link from "next/link";
import { Button } from "../ui/button";
type Props = {
  isMessagesDrawerOpen: boolean;
  setIsMessagesDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleMessageClick: (conversationId: string) => void;
};

const ChatDrawer = ({ setIsMessagesDrawerOpen, isMessagesDrawerOpen, handleMessageClick }: Props) => {
  return (
    <div className={`fixed top-0 right-0 z-50 h-full w-full sm:w-96 bg-background shadow-xl transition-transform duration-300 ease-in-out ${isMessagesDrawerOpen ? "translate-x-0" : "translate-x-full"}`}>
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Recent Messages</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/chat" onClick={() => setIsMessagesDrawerOpen(false)}>
              View All
            </Link>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setIsMessagesDrawerOpen(false)} aria-label="Close messages">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="p-2 overflow-y-auto">
        {recentMessages.map((message) => (
          <div key={message.id} className="flex items-start gap-3 p-3 hover:bg-muted rounded-lg cursor-pointer transition-colors" onClick={() => handleMessageClick(message.conversationId)}>
            <div className="relative">
              <Avatar className="size-10">
                <AvatarImage className="size-10 rounded-full object-cover object-center" src={message.avatar || "/placeholder.svg"} alt={message.sender} />
                <AvatarFallback>{message.sender.charAt(0)}</AvatarFallback>
              </Avatar>
              {message.unread && <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary border-2 border-background" />}
            </div>
            <div className="flex-1 space-y-1 overflow-hidden">
              <div className="flex items-center justify-between">
                <p className={`font-medium ${message.unread ? "text-foreground" : "text-muted-foreground"}`}>{message.sender}</p>
                <span className="text-xs text-muted-foreground">{message.time}</span>
              </div>
              <p className={`text-sm truncate ${message.unread ? "text-foreground" : "text-muted-foreground"}`}>{message.content}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatDrawer;
