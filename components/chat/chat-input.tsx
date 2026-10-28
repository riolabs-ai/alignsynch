"use client";

import type React from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ImageIcon, Mic, PaperclipIcon, Send, Smile, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input } from "../ui/input";

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  onSendImage: (imageUrl: string) => void;
}

export function ChatInput({ onSendMessage, onSendImage }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "40px";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "40px";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // In a real app, you would upload the file to a server
      // For this demo, we'll use a placeholder image
      const imageUrl = "/placeholder.svg?height=300&width=400";
      onSendImage(imageUrl);

      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    // In a real app, this would start/stop audio recording
  };

  // Emoji data - simplified for demo
  const emojis = ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "👍", "👎", "👏", "🙌", "👌", "✌️", "🤞", "🤟", "🤘", "👊", "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "❣️", "💕", "💞"];

  return (
    <div className="flex items-end gap-2">
      <div className="flex space-x-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" size="icon" variant="ghost" className="rounded-full h-9 w-9" onClick={() => fileInputRef.current?.click()}>
                <PaperclipIcon className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Attach file</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" size="icon" variant="ghost" className="rounded-full h-9 w-9" onClick={() => fileInputRef.current?.click()}>
                <ImageIcon className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Send image</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="relative flex items-center gap-2 flex-1">
        <Input
          ref={textareaRef}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            setIsTyping(e.target.value.length > 0);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className={cn("resize-none pr-12 rounded-2xl transition-all px-5 !py-4")}
        />
        <Button type="button" size="icon" className={cn("size-9 rounded-full transition-colors", !message.trim() ? "text-muted-foreground" : "")} disabled={!message.trim()} onClick={handleSend}>
          <Send className="h-4 w-4 text-white" />
        </Button>
      </div>

      <div className="flex space-x-1">
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" size="icon" variant="ghost" className="rounded-full h-9 w-9">
              <Smile className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="end">
            <div className="grid grid-cols-8 gap-1">
              {emojis.map((emoji, index) => (
                <button key={index} className="h-8 w-8 flex items-center justify-center rounded hover:bg-muted cursor-pointer text-lg" onClick={() => setMessage((prev) => prev + emoji)}>
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" size="icon" variant={isRecording ? "destructive" : "ghost"} className="rounded-full h-9 w-9" onClick={toggleRecording}>
                {isRecording ? <X className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isRecording ? "Cancel recording" : "Voice message"}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
    </div>
  );
}
