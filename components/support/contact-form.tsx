"use client";

import type React from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { PageCopySection } from "@/content/pages";
import { itemLabel } from "@/lib/page-copy";
import { CheckCircle2, Loader2, Upload } from "lucide-react";
import { useState } from "react";
import type { SupportCategory } from "./support-page";

interface ContactFormProps {
  selectedCategory: SupportCategory;
  copy: PageCopySection;
  categoryCopy: PageCopySection;
}
type categories =
  | "account"
  | "billing"
  | "quiz-creation"
  | "tournaments"
  | "privacy"
  | "technical"
  | "general";
export function ContactForm({ selectedCategory, copy, categoryCopy }: ContactFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    category: selectedCategory === "all" ? "general" : selectedCategory,
    message: "",
    attachment: null as File | null,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setIsSubmitting(false);
    setIsSubmitted(true);

    // Reset form after 3 seconds
    setTimeout(() => {
      setIsSubmitted(false);
      setFormData({
        name: "",
        email: "",
        subject: "",
        category: selectedCategory === "all" ? "general" : selectedCategory,
        message: "",
        attachment: null,
      });
    }, 3000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({
        ...formData,
        attachment: e.target.files[0],
      });
    }
  };

  if (isSubmitted) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="rounded-full bg-green-100 p-3 mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">{itemLabel(copy, "success-heading")}</h2>
          <p className="text-center text-muted-foreground mb-6">
            {itemLabel(copy, "success-body")}
          </p>
          <p className="text-sm text-muted-foreground">
            {itemLabel(copy, "reference-number")}
            {Math.random().toString(36).substring(2, 10).toUpperCase()}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-6">{copy.heading}</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="name">{itemLabel(copy, "name")}</Label>
            <Input
              id="name"
              placeholder={itemLabel(copy, "name-placeholder")}
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{itemLabel(copy, "email")}</Label>
            <Input
              id="email"
              type="email"
              placeholder={itemLabel(copy, "email-placeholder")}
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="subject">{itemLabel(copy, "subject")}</Label>
            <Input
              id="subject"
              placeholder={itemLabel(copy, "subject-placeholder")}
              required
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">{itemLabel(copy, "category")}</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value as categories })}
            >
              <SelectTrigger>
                <SelectValue placeholder={itemLabel(copy, "category-placeholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="account">{itemLabel(categoryCopy, "account")}</SelectItem>
                <SelectItem value="billing">{itemLabel(categoryCopy, "billing")}</SelectItem>
                <SelectItem value="quiz-creation">
                  {itemLabel(categoryCopy, "quiz-creation")}
                </SelectItem>
                <SelectItem value="tournaments">
                  {itemLabel(categoryCopy, "tournaments")}
                </SelectItem>
                <SelectItem value="privacy">{itemLabel(categoryCopy, "privacy")}</SelectItem>
                <SelectItem value="technical">{itemLabel(categoryCopy, "technical")}</SelectItem>
                <SelectItem value="general">{itemLabel(categoryCopy, "general")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="message">{itemLabel(copy, "message")}</Label>
          <Textarea
            id="message"
            placeholder={itemLabel(copy, "message-placeholder")}
            rows={6}
            required
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="attachment">{itemLabel(copy, "attachment")}</Label>
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById("file-upload")?.click()}
              className="w-full md:w-auto"
            >
              <Upload className="mr-2 h-4 w-4" />
              {formData.attachment
                ? itemLabel(copy, "change-file")
                : itemLabel(copy, "upload-file")}
            </Button>
            {formData.attachment && (
              <span className="text-sm text-muted-foreground">{formData.attachment.name}</span>
            )}
            <input
              id="file-upload"
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept="image/*,.pdf,.doc,.docx,.txt"
            />
          </div>
          <p className="text-xs text-muted-foreground">{itemLabel(copy, "accepted-types")}</p>
        </div>

        <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {itemLabel(copy, "sending")}
            </>
          ) : (
            itemLabel(copy, "submit")
          )}
        </Button>
      </form>
    </Card>
  );
}
