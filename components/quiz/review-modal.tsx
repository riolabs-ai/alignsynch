"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Star } from "lucide-react"

interface ReviewModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (review: { rating: number; comment: string }) => void
  quizTitle: string
}

export function ReviewModal({ isOpen, onClose, onSubmit, quizTitle }: ReviewModalProps) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState("")
  const [hoveredRating, setHoveredRating] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (rating === 0 || !comment.trim()) return

    setIsSubmitting(true)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    onSubmit({ rating, comment })
    setIsSubmitting(false)
    resetForm()
    onClose()
  }

  const resetForm = () => {
    setRating(0)
    setComment("")
    setHoveredRating(0)
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Write a Review</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <h3 className="text-sm font-medium mb-2">Quiz: {quizTitle}</h3>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rating">Your Rating</Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="focus:outline-none"
                >
                  <Star
                    className={`h-8 w-8 ${
                      star <= (hoveredRating || rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
                    } transition-colors`}
                  />
                </button>
              ))}
            </div>
            {rating === 0 && <p className="text-xs text-muted-foreground">Please select a rating</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment">Your Review</Label>
            <Textarea
              id="comment"
              placeholder="Share your experience with this quiz..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[120px]"
            />
            {comment.trim() === "" && <p className="text-xs text-muted-foreground">Please write a review</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={rating === 0 || comment.trim() === "" || isSubmitting}>
            {isSubmitting ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                Submitting...
              </>
            ) : (
              "Submit Review"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
