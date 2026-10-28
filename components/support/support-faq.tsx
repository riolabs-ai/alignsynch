"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useState } from "react";
import type { SupportCategory } from "./support-page";

interface SupportFAQProps {
  selectedCategory: SupportCategory;
}

export function SupportFAQ({ selectedCategory }: SupportFAQProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const allFaqs = {
    account: [
      {
        question: "How do I change my username?",
        answer: "To change your username, go to Account Settings > Profile. Click on the edit button next to your username and enter a new one. Note that usernames must be unique and can only be changed once every 30 days.",
      },
      {
        question: "How do I reset my password?",
        answer: "To reset your password, click on the 'Forgot Password' link on the login page. Enter the email associated with your account, and we'll send you a password reset link. Follow the instructions in the email to create a new password.",
      },
      {
        question: "Can I link my social media accounts?",
        answer: "Yes, you can link your social media accounts for easier login. Go to Account Settings > Connected Accounts and click on the social media platforms you want to connect. This also allows you to share your quiz achievements directly to those platforms.",
      },
      {
        question: "How do I delete my account?",
        answer: "To delete your account, go to Account Settings > Privacy, and scroll to the bottom where you'll find the 'Delete Account' option. Please note that account deletion is permanent and will remove all your data, including created quizzes and earnings history.",
      },
      {
        question: "How do I change my email address?",
        answer: "To change your email address, go to Account Settings > Profile. Click on the edit button next to your email address and enter a new one. You'll receive a verification email at the new address. Your email change will be complete once you verify the new address.",
      },
    ],
    billing: [
      {
        question: "What payment methods are accepted?",
        answer: "We accept credit/debit cards (Visa, Mastercard, American Express), PayPal, Apple Pay, Google Pay, and various regional payment methods depending on your location. All payments are processed securely through our payment partners.",
      },
      {
        question: "How do I update my payment information?",
        answer: "To update your payment information, go to Account Settings > Billing. Click on 'Payment Methods' and select 'Add New Method' or 'Edit' next to an existing method. Follow the prompts to update your information securely.",
      },
      {
        question: "When will I receive my earnings?",
        answer: "Earnings are calculated daily and updated in your dashboard. You can withdraw your earnings once they reach the minimum threshold ($25). Withdrawals are processed within 3-5 business days, depending on your payment method and location.",
      },
      {
        question: "How do I cancel my subscription?",
        answer: "To cancel your subscription, go to Account Settings > Billing > Subscriptions. Click on 'Cancel Subscription' and follow the prompts. Your subscription will remain active until the end of the current billing period, after which it will not renew.",
      },
      {
        question: "Is there a refund policy?",
        answer: "Yes, we offer refunds within 14 days of purchase for subscription plans if you haven't used premium features. For tournament entry fees, refunds are available up to 24 hours before the tournament starts. Please contact support for specific refund requests.",
      },
    ],
    "quiz-creation": [
      {
        question: "How do I create a quiz?",
        answer: "To create a quiz, click on 'Create' in the sidebar and choose either 'Editor' for manual creation or 'Generator' for AI-assisted creation. In the Editor, you can add questions, multiple-choice answers, and media. The Generator will help you create questions based on your topic and preferences.",
      },
      {
        question: "What types of questions can I include?",
        answer: "You can create multiple-choice questions (single or multiple correct answers), true/false questions, fill-in-the-blank, matching, and short answer questions. Each question can include text, images, or embedded videos to make your quiz more engaging.",
      },
      {
        question: "How many questions can I add to a quiz?",
        answer: "Free accounts can create quizzes with up to 10 questions. Premium accounts can create quizzes with up to 100 questions. For educational institutions, we offer custom limits based on your needs.",
      },
      {
        question: "Can I add images or videos to my questions?",
        answer: "Yes, you can add images, GIFs, and videos to both questions and answer options. Click the media icon in the question editor to upload or embed media. Supported formats include JPG, PNG, GIF for images and YouTube, Vimeo links for videos.",
      },
      {
        question: "How do I set time limits for questions?",
        answer: "In the quiz editor, you can set time limits for individual questions or for the entire quiz. Click on the timer icon next to each question to set a specific time limit, or use the quiz settings to apply a uniform time limit to all questions.",
      },
    ],
    tournaments: [
      {
        question: "How do I create a tournament?",
        answer: "To create a tournament, go to the Tournaments section and click 'Create Tournament'. Fill in the details including name, description, start/end dates, entry requirements, and prizes. You can make it public or invite-only, and set up rounds and scoring rules.",
      },
      {
        question: "How do I join a tournament?",
        answer: "Browse available tournaments in the Tournaments section. Click on a tournament to view details, then click 'Join Tournament'. Some tournaments may have entry requirements (skill level, entry fee) that you'll need to meet before joining.",
      },
      {
        question: "How is tournament scoring calculated?",
        answer: "Tournament scoring depends on the format chosen by the organizer. Common formats include points per correct answer, time-based scoring (faster answers get more points), or elimination rounds. The specific scoring rules are always displayed on the tournament details page.",
      },
      {
        question: "Can I create a private tournament for friends?",
        answer: "Yes, when creating a tournament, select 'Invite Only' in the privacy settings. You'll receive a unique code that you can share with friends. Only people with this code will be able to join your tournament.",
      },
      {
        question: "How are tournament prizes distributed?",
        answer: "Prize distribution depends on the tournament. Cash prizes are credited to winners' accounts within 48 hours of tournament completion. Virtual prizes (badges, points) are awarded immediately. For physical prizes, winners will be contacted to provide shipping information.",
      },
    ],
    privacy: [
      {
        question: "How is my personal information used?",
        answer: "We collect only necessary information to provide our services. Your personal data is used for account management, service improvement, and personalized experiences. We never sell your data to third parties. For complete details, please review our Privacy Policy.",
      },
      {
        question: "Can I make my profile private?",
        answer: "Yes, go to Account Settings > Privacy and toggle 'Private Profile'. When enabled, only your username will be visible to others. Your quiz history, achievements, and other profile details will be hidden from public view.",
      },
      {
        question: "How do I control who sees my created quizzes?",
        answer: "When creating or editing a quiz, you can set its visibility to 'Public' (visible to everyone), 'Unlisted' (accessible only via direct link), or 'Private' (visible only to you). You can change this setting at any time from the quiz management page.",
      },
      {
        question: "Are my quiz results shared with others?",
        answer: "By default, your quiz results are visible on leaderboards. To change this, go to Account Settings > Privacy and toggle 'Hide My Results'. This will prevent your name from appearing on public leaderboards while still allowing you to see your own performance.",
      },
      {
        question: "How can I manage cookies and tracking?",
        answer: "We use cookies for essential functions, analytics, and personalization. You can manage cookie preferences in the footer of our website by clicking 'Cookie Settings'. You can choose to accept all cookies or only essential ones required for the site to function.",
      },
    ],
    technical: [
      {
        question: "The quiz editor isn't loading properly. What should I do?",
        answer: "First, try refreshing the page. If that doesn't work, clear your browser cache and cookies. Make sure you're using a supported browser (Chrome, Firefox, Safari, Edge - latest versions). If problems persist, try using a different browser or device.",
      },
      {
        question: "Why can't I upload images to my quiz?",
        answer: "Check that your image meets our requirements: max 5MB size, JPG/PNG/GIF format. If the image meets these requirements but still won't upload, try compressing it further or using a different image. Also ensure you have a stable internet connection.",
      },
      {
        question: "The quiz timer isn't working correctly. How can I fix it?",
        answer: "Timer issues are often related to browser performance. Close unnecessary tabs and applications, refresh the page, or try a different browser. If you're on mobile, ensure your device isn't in battery saving mode, which can affect timers.",
      },
      {
        question: "Why am I experiencing lag during quizzes?",
        answer: "Lag can be caused by slow internet connection, browser issues, or device performance. Try connecting to a stronger WiFi signal, closing other applications and tabs, or switching to a device with better performance. For mobile users, the app version may provide better performance than the browser version.",
      },
      {
        question: "How do I report a bug?",
        answer: "To report a bug, go to the Support page and select 'Contact Us'. Choose 'Report a Bug' from the dropdown menu and provide as much detail as possible, including what you were doing when the bug occurred, your device, browser, and screenshots if possible. Our team will investigate and respond as soon as possible.",
      },
    ],
    general: [
      {
        question: "What is QuizHub ?",
        answer: "QuizHub is an interactive platform where users can create, share, and take quizzes on various topics. It combines educational content with gamification elements, allowing creators to earn from their quizzes while players can win prizes and climb leaderboards.",
      },
      {
        question: "How do I get started?",
        answer: "Sign up for a free account, then explore the platform by taking some featured quizzes. When you're ready to create your own, click 'Create' in the sidebar and follow the guided process. Check out the 'Creator Tips' section for advice on making engaging quizzes.",
      },
      {
        question: "Is QuizHub  available on mobile devices?",
        answer: "Yes, QuizHub  is fully responsive and works on all mobile browsers. We also offer dedicated apps for iOS and Android with additional features like offline quiz taking and push notifications for tournament reminders.",
      },
      {
        question: "Can I use QuizHub  for educational purposes?",
        answer: "Many educators use QuizHub  to create engaging learning materials. We offer special educational accounts with features like student progress tracking, classroom management, and the ability to align quizzes with curriculum standards.",
      },
      {
        question: "How do I contact customer support?",
        answer: "You can contact our support team through the 'Contact Us' tab on this page, by emailing support@quizhub.com, or by using the chat button in the bottom right corner of any page. Our support team is available 24/7 to assist with any questions or issues.",
      },
    ],
  };

  // Combine all FAQs for the "all" category
  const allCategoryFaqs = [...allFaqs.account, ...allFaqs.billing, ...allFaqs["quiz-creation"], ...allFaqs.tournaments, ...allFaqs.privacy, ...allFaqs.technical, ...allFaqs.general];

  // Get the appropriate FAQs based on the selected category
  const faqs = selectedCategory === "all" ? allCategoryFaqs : allFaqs[selectedCategory] || [];

  // Filter FAQs based on search query
  const filteredFaqs = faqs.filter((faq) => faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || faq.answer.toLowerCase().includes(searchQuery.toLowerCase()));

  // Get the category name for display
  const getCategoryName = () => {
    switch (selectedCategory) {
      case "all":
        return "All Categories";
      case "account":
        return "Account";
      case "billing":
        return "Billing";
      case "quiz-creation":
        return "Quiz Creation";
      case "tournaments":
        return "Tournaments";
      case "privacy":
        return "Privacy";
      case "technical":
        return "Technical Issues";
      case "general":
        return "General";
      default:
        return "All Categories";
    }
  };

  return (
    <Card className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <h2 className="text-2xl font-bold">{getCategoryName()} FAQs</h2>
        <div className="relative w-full md:w-64 mt-4 md:mt-0">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search FAQs..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      {filteredFaqs.length > 0 ? (
        <Accordion type="single" collapsible className="w-full">
          {filteredFaqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
              <AccordionContent>{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No FAQs found matching your search.</p>
        </div>
      )}
    </Card>
  );
}
