import { formatRelative } from "@/content/core";
import type { PageCopySection } from "@/content/pages";
import type { RecentMessage } from "@/data/chat-data";
import { itemLabel } from "@/lib/page-copy";
import { GeneratedAvatar } from "@/components/media/generated-avatar";
import { MessageSquare, X } from "lucide-react";
import Link from "next/link";
import { Button } from "../ui/button";
type Props = {
  copy: PageCopySection;
  /**
   * The rows this brand's drawer shows — `recentMessagesFor(brandId)` reads them
   * (`data/chat-data.ts`). The drawer owns no list of its own: the quiz build's five sample
   * conversations and the alignment build's none are one decision made in the fixture layer.
   */
  messages: readonly RecentMessage[];
  isMessagesDrawerOpen: boolean;
  setIsMessagesDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleMessageClick: (conversationId: string) => void;
};

const ChatDrawer = ({
  copy,
  messages,
  setIsMessagesDrawerOpen,
  isMessagesDrawerOpen,
  handleMessageClick,
}: Props) => {
  return (
    <div
      className={`fixed top-0 right-0 z-50 h-full w-full sm:w-96 bg-background shadow-xl transition-transform duration-300 ease-in-out ${isMessagesDrawerOpen ? "translate-x-0" : "translate-x-full"}`}
    >
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">{copy.heading}</h2>
        <div className="flex items-center gap-2">
          {/* "View all" opens the conversation list; a drawer with no conversation has none. */}
          {messages.length > 0 && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/chat" onClick={() => setIsMessagesDrawerOpen(false)}>
                {itemLabel(copy, "view-all")}
              </Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMessagesDrawerOpen(false)}
            aria-label="Close messages"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="p-2 overflow-y-auto">
        {messages.length === 0 ? (
          /**
           * The drawer's empty state — what a brand with no conversations behind the drawer
           * gets instead of another product's samples (issue #156 follow-up). The words are the
           * `messages` section's (`empty-title` / `empty-body`), as they are for the
           * notifications drawer: no literal here (E23).
           */
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">{itemLabel(copy, "empty-title")}</h3>
            <p className="text-sm text-muted-foreground mt-1">{itemLabel(copy, "empty-body")}</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className="flex items-start gap-3 p-3 hover:bg-muted rounded-lg cursor-pointer transition-colors"
              onClick={() => handleMessageClick(message.conversationId)}
            >
              <div className="relative">
                <GeneratedAvatar name={message.sender} seed={message.conversationId} size={40} />
                {message.unread && (
                  <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary border-2 border-background" />
                )}
              </div>
              <div className="flex-1 space-y-1 overflow-hidden">
                <div className="flex items-center justify-between">
                  <p
                    className={`font-medium ${message.unread ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {message.sender}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {formatRelative(message.lastMessageAt)}
                  </span>
                </div>
                <p
                  className={`text-sm truncate ${message.unread ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {message.content}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ChatDrawer;
