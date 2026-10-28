import type React from "react"
// Helper functions for the chat components

// Function to prevent event propagation
export function stopPropagation(e: React.MouseEvent | React.KeyboardEvent) {
  e.stopPropagation()
}

// Function to handle dropdown menu item clicks
export function handleMenuItemClick(callback: () => void) {
  return (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    callback()
  }
}

// Function to format timestamps
export function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}
