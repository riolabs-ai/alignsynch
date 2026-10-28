"use client"

import { useState } from "react"
import type { User } from "@/lib/data/users"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Send } from "lucide-react"

interface MessageModalProps {
  isOpen: boolean
  onClose: () => void
  recipient: User
}

export function MessageModal({ isOpen, onClose, recipient }: MessageModalProps) {
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSend = async () => {
    if (!message.trim()) return

    setSending(true)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    setSending(false)
    setSent(true)

    // Reset after showing success message
    setTimeout(() => {
      setMessage("")
      setSent(false)
      onClose()
    }, 1500)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={recipient.avatar || "/placeholder.svg"} alt={recipient.name} />
              <AvatarFallback>{recipient.name.substring(0, 2)}</AvatarFallback>
            </Avatar>
            Message {recipient.name}
          </DialogTitle>
        </DialogHeader>

        {sent ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 className="text-lg font-medium">Message Sent!</h3>
            <p className="text-sm text-muted-foreground">Your message has been sent to {recipient.name}</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Avatar>
                  <AvatarImage src={recipient.avatar || "/placeholder.svg"} alt={recipient.name} />
                  <AvatarFallback>{recipient.name.substring(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-sm">Hi there! Feel free to send me a message about quizzes or anything else.</p>
                </div>
              </div>

              <Textarea
                placeholder={`Write a message to ${recipient.name}...`}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[120px] resize-none"
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSend} disabled={!message.trim() || sending}>
                {sending ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Message
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
