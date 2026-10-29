import type React from "react";
// Helper functions for the chat components

// Function to prevent event propagation
export function stopPropagation(e: React.MouseEvent | React.KeyboardEvent) {
  e.stopPropagation();
}

// Function to handle dropdown menu item clicks
export function handleMenuItemClick(callback: () => void) {
  return (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    callback();
  };
}

// Time formatting lives in `content/core.ts` (`formatClockTime`, `formatDateTimeLong`,
// `formatRelative`): those are UTC-pinned and measured against the fixture clock, so they
// render identically on the server and in the browser. A local `toLocaleTimeString()` helper
// here is how the chat produced React #418 — do not add one back.
