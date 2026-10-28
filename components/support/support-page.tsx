"use client";

import { useState } from "react";
import { ContactForm } from "./contact-form";
import { KnowledgeBase } from "./knowledge-base";
import { SupportCategories } from "./support-categories";
import { SupportFAQ } from "./support-faq";
import { SupportHeader } from "./support-header";

export type SupportCategory = "all" | "account" | "billing" | "quiz-creation" | "tournaments" | "privacy" | "technical" | "general";

export function SupportPage() {
  const [activeTab, setActiveTab] = useState<"faq" | "contact" | "knowledge">("faq");
  const [selectedCategory, setSelectedCategory] = useState<SupportCategory>("all");

  return (
    <div className="container mx-auto py-4">
      <SupportHeader activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="md:col-span-1">
          <SupportCategories selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} />
        </div>

        <div className="md:col-span-3">
          {activeTab === "faq" && <SupportFAQ selectedCategory={selectedCategory} />}
          {activeTab === "contact" && <ContactForm selectedCategory={selectedCategory} />}
          {activeTab === "knowledge" && <KnowledgeBase selectedCategory={selectedCategory} />}
        </div>
      </div>
    </div>
  );
}
