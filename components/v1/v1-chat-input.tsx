"use client";

// template-ancestor: components/chat/chat-input.tsx   (variation: a single-line composer — one input and a send button, no attach, emoji or voice)

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";
import { useState } from "react";

interface V1ChatInputProps {
  onSend: (body: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function V1ChatInput({
  onSend,
  disabled = false,
  placeholder = "Type a message…",
}: V1ChatInputProps) {
  const [value, setValue] = useState("");

  const send = () => {
    const body = value.trim();
    if (body === "") return;
    onSend(body);
    setValue("");
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            send();
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        aria-label="Message"
      />
      <Button
        type="button"
        size="icon"
        onClick={send}
        disabled={disabled || value.trim() === ""}
        aria-label="Send"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
