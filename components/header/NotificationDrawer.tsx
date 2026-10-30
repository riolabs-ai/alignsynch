import type { Notification } from "@/content/social";
import type { PageCopySection } from "@/content/pages";
import { formatRelative } from "@/content/core";
import { itemLabel } from "@/lib/page-copy";
import { renderNotificationIcon } from "./notification-icon";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import { Bell, Check, X } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
type Props = {
  copy: PageCopySection;
  /**
   * The rows this brand's drawer shows — `notificationsFor(brandId)` reads them
   * (`data/notifications.ts`). A brand with nothing behind the drawer (the alignment build)
   * passes none, and the empty state below is the screen it draws rather than another
   * product's events (issue #156 follow-up).
   */
  notifications: readonly Notification[];
  isNotificationsDrawerOpen: boolean;
  setIsNotificationsDrawerOpen: (isOpen: boolean) => void;
  handleNotificationClick: (notification: Notification) => void;
  markAllNotificationsAsRead: () => void;
};
const NotificationDrawer = ({
  copy,
  notifications,
  handleNotificationClick,
  isNotificationsDrawerOpen,
  markAllNotificationsAsRead,
  setIsNotificationsDrawerOpen,
}: Props) => {
  return (
    <div
      className={`fixed top-0 right-0 z-50 h-full w-full sm:w-96 bg-background shadow-xl transition-transform duration-300 ease-in-out ${isNotificationsDrawerOpen ? "translate-x-0" : "translate-x-full"}`}
    >
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">{copy.heading}</h2>
        <div className="flex items-center gap-2">
          {/* Nothing to mark when the drawer has no notification (the alignment build). */}
          {notifications.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
              onClick={markAllNotificationsAsRead}
            >
              <Check className="h-4 w-4" />
              <span>{itemLabel(copy, "mark-all")}</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsNotificationsDrawerOpen(false)}
            aria-label="Close notifications"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-64px)]">
        <div className="p-2">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">{itemLabel(copy, "empty-title")}</h3>
              <p className="text-sm text-muted-foreground mt-1">{itemLabel(copy, "empty-body")}</p>
            </div>
          ) : (
            <>
              <div className="px-3 py-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {itemLabel(copy, "new")}
                </h3>
              </div>
              <div className="space-y-3">
                {notifications
                  .filter((notification) => !notification.read)
                  .map((notification) => (
                    <div
                      key={notification.id}
                      className="flex items-start gap-3 p-3 hover:bg-muted rounded-lg cursor-pointer transition-colors border-l-2 border-primary"
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        {renderNotificationIcon(notification.iconKey)}
                      </div>
                      <div className="flex-1 space-y-1 overflow-hidden">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{notification.title}</p>
                          <Badge variant="outline" className="text-xs font-normal">
                            {formatRelative(notification.createdAt)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{notification.body}</p>
                      </div>
                    </div>
                  ))}
              </div>

              <div className="px-3 py-2 mt-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {itemLabel(copy, "earlier")}
                </h3>
              </div>
              <div className="space-y-3">
                {notifications
                  .filter((notification) => notification.read)
                  .map((notification) => (
                    <div
                      key={notification.id}
                      className="flex items-start gap-3 p-3 hover:bg-muted rounded-lg cursor-pointer transition-colors opacity-70"
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        {renderNotificationIcon(notification.iconKey)}
                      </div>
                      <div className="flex-1 space-y-1 overflow-hidden">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{notification.title}</p>
                          <Badge variant="outline" className="text-xs font-normal">
                            {formatRelative(notification.createdAt)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{notification.body}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default NotificationDrawer;
