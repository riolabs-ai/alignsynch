export type KnowledgeBaseArticle = {
  id: string;
  title: string;
  description: string;
  readTime: number;
  category: string;
  content: {
    heading: string;
    paragraphs: string[];
    list?: string[];
    note?: string;
  }[];
};
export const articlesData: KnowledgeBaseArticle[] = [
  {
    id: "getting-started",
    title: "Getting Started with QuizHub",
    description: "Everything you need to know to begin your journey on our platform.",
    readTime: 5,
    category: "general",
    content: [
      {
        heading: "Welcome to QuizHub",
        paragraphs: [
          "Welcome to QuizHub , the premier platform for creating, sharing, and participating in quizzes across a wide range of topics. Whether you're an educator looking to engage your students, a content creator wanting to connect with your audience, or simply a quiz enthusiast, our platform offers all the tools you need to succeed.",
          "This guide will walk you through the basics of getting started with QuizHub , from setting up your account to creating your first quiz and exploring the community.",
        ],
      },
      {
        heading: "Creating Your Account",
        paragraphs: ["To get started with QuizHub , you'll need to create an account. Visit our homepage and click on the 'Sign Up' button in the top right corner. You can register using your email address, or sign up with your Google, Facebook, or Apple account for a quicker process."],
        list: ["Fill in your basic information (name, email, password)", "Verify your email address through the link we send you", "Complete your profile by adding a profile picture and bio", "Set your preferences for notifications and privacy"],
      },
      {
        heading: "Exploring the Dashboard",
        paragraphs: ["Once you've created your account, you'll be taken to your dashboard. This is your personal hub where you can see your recent activity, track your progress, and access all the features of QuizHub ."],
        list: ["My Quizzes: Access quizzes you've created", "Saved Quizzes: Find quizzes you've bookmarked for later", "Recent Activity: See your recent quiz attempts and results", "Earnings: Track your earnings if you're monetizing your content", "Notifications: Stay updated on likes, comments, and other interactions"],
      },
      {
        heading: "Creating Your First Quiz",
        paragraphs: [
          "Ready to create your first quiz? Click on the 'Create Quiz' button in the top navigation bar or on your dashboard. You'll be presented with two options: create from scratch or use our AI-powered quiz generator.",
          "For beginners, we recommend starting with the AI generator. Simply enter a topic, select the difficulty level and number of questions, and our system will generate a complete quiz for you. You can then edit and customize it to your liking.",
        ],
        note: "Remember to save your quiz regularly as you work on it. You can always come back and edit it later before publishing.",
      },
      {
        heading: "Joining the Community",
        paragraphs: ["QuizHub is more than just a quiz platform—it's a community of knowledge enthusiasts. Explore the 'Explore' section to discover popular quizzes, follow creators you enjoy, and participate in discussions.", "Don't forget to check out our tournaments for a chance to compete with others and win prizes. The leaderboard showcases top performers, and you might see your name there soon!"],
      },
      {
        heading: "Next Steps",
        paragraphs: ["Now that you're familiar with the basics, explore our other knowledge base articles to learn more about specific features and best practices. If you have any questions, our support team is always here to help.", "Happy quizzing!"],
      },
    ],
  },
  {
    id: "account-setup",
    title: "Complete Account Setup Guide",
    description: "Learn how to set up your account, customize your profile, and configure your preferences.",
    readTime: 5,
    category: "account",
    content: [
      {
        heading: "Setting Up Your Account",
        paragraphs: ["A complete account setup ensures you get the most out of QuizHub . This guide will walk you through all the steps to fully configure your account, from basic profile information to advanced settings and preferences.", "Taking the time to properly set up your account will enhance your experience and help you connect with like-minded quiz enthusiasts."],
      },
      {
        heading: "Profile Information",
        paragraphs: ["Your profile is your identity on QuizHub . A complete profile helps others recognize you and builds trust in the community."],
        list: ["Upload a profile picture: Choose a clear, appropriate image that represents you", "Add a username: Pick a unique username that's easy to remember", "Write a bio: Share a brief description about yourself and your interests", "Set your location: This helps connect you with local events and users", "Add your areas of expertise: Highlight topics you're knowledgeable about"],
      },
      {
        heading: "Account Security",
        paragraphs: ["Protecting your account is crucial. We recommend implementing these security measures:"],
        list: ["Create a strong password: Use a combination of letters, numbers, and symbols", "Enable two-factor authentication: Add an extra layer of security", "Set up recovery options: Add a backup email or phone number", "Review connected apps: Manage third-party applications with access to your account", "Check login history: Monitor for any suspicious activity"],
        note: "We recommend changing your password every 3-6 months for optimal security.",
      },
      {
        heading: "Notification Preferences",
        paragraphs: ["Stay informed about activity relevant to you by configuring your notification settings. You can receive notifications via email, push notifications (if you've installed our mobile app), or within the platform."],
        list: ["Quiz interactions: Likes, comments, and shares on your quizzes", "Followers: New followers and follower activity", "Messages: Direct messages from other users", "System updates: Important announcements and feature updates", "Marketing: Optional promotional content and special offers"],
      },
      {
        heading: "Privacy Settings",
        paragraphs: ["Control who can see your content and how your information is shared on the platform."],
        list: ["Profile visibility: Choose between public, private, or custom visibility", "Quiz results sharing: Decide if your quiz results are visible to others", "Activity tracking: Control what activities appear in your public feed", "Search visibility: Determine if your profile appears in search results", "Data usage: Manage how your data is used for recommendations"],
      },
      {
        heading: "Linked Accounts",
        paragraphs: ["Connect your social media accounts to enhance your QuizHub  experience. This allows for easier sharing of content and finding friends who are already on the platform."],
        list: ["Google: Connect for easy login and contact syncing", "Facebook: Find friends and share achievements", "Twitter: Share your quizzes and results", "Apple: Use for secure sign-in on Apple devices", "Discord: Connect with gaming communities"],
        note: "You can disconnect these accounts at any time from your settings page.",
      },
    ],
  },
  {
    id: "subscription-management",
    title: "Managing Your Subscription",
    description: "Learn how to upgrade, downgrade, or cancel your subscription plan.",
    readTime: 4,
    category: "billing",
    content: [
      {
        heading: "Understanding Your Subscription Options",
        paragraphs: ["QuizHub offers several subscription tiers to meet different needs and budgets. Whether you're a casual quiz taker, a dedicated creator, or an educational institution, we have plans designed for you.", "This guide will help you understand how to manage your subscription, make changes to your plan, and handle billing issues."],
      },
      {
        heading: "Viewing Your Current Plan",
        paragraphs: ["To view your current subscription details, follow these steps:"],
        list: ["Log in to your QuizHub  account", "Click on your profile picture in the top right corner", "Select 'Settings' from the dropdown menu", "Navigate to the 'Subscription & Billing' tab", "Here you'll see your current plan, billing cycle, and next payment date"],
      },
      {
        heading: "Upgrading Your Subscription",
        paragraphs: ["Ready to access more features? Upgrading your subscription is simple:"],
        list: ["Go to 'Subscription & Billing' in your settings", "Click on 'Upgrade Plan'", "Browse the available plans and select the one that meets your needs", "Review the new features and price difference", "Confirm your selection and complete the payment process", "Your new plan benefits will be activated immediately"],
        note: "When upgrading, you'll only be charged the prorated difference between your current plan and the new one for the remainder of your billing cycle.",
      },
      {
        heading: "Downgrading Your Subscription",
        paragraphs: ["If you need to reduce your subscription level, you can downgrade your plan:"],
        list: ["Navigate to 'Subscription & Billing' in settings", "Click on 'Change Plan'", "Select a lower-tier plan", "Review the features you'll lose access to", "Confirm your selection"],
        note: "Downgrades take effect at the end of your current billing cycle. You'll continue to have access to your current plan's features until then.",
      },
      {
        heading: "Cancelling Your Subscription",
        paragraphs: ["If you wish to cancel your subscription entirely, follow these steps:"],
        list: ["Go to 'Subscription & Billing' in settings", "Click on 'Cancel Subscription'", "Select a reason for cancellation (this helps us improve)", "Confirm your cancellation", "You'll receive an email confirmation of your cancellation"],
        note: "After cancellation, your premium features will remain active until the end of your current billing period. Your account will then revert to the free tier.",
      },
      {
        heading: "Managing Payment Methods",
        paragraphs: ["You can update your payment information or add backup payment methods:"],
        list: ["Go to 'Subscription & Billing'", "Select 'Payment Methods'", "Add a new card or payment method", "Set a default payment method", "Remove outdated payment information"],
      },
      {
        heading: "Billing History and Receipts",
        paragraphs: ["Need access to past invoices? All your billing history is available in your account:"],
        list: ["Navigate to 'Subscription & Billing'", "Click on 'Billing History'", "View a list of all past transactions", "Download or print receipts for your records", "Request invoice corrections if needed"],
      },
    ],
  },
  {
    id: "quiz-creation-basics",
    title: "Quiz Creation Basics",
    description: "A step-by-step guide to creating your first quiz from scratch.",
    readTime: 5,
    category: "quiz-creation",
    content: [
      {
        heading: "Introduction to Quiz Creation",
        paragraphs: ["Creating engaging quizzes is both an art and a science. Whether you're an educator looking to test knowledge, a content creator wanting to engage your audience, or someone who loves sharing interesting challenges, this guide will walk you through the process of creating effective quizzes on QuizHub .", "We'll cover everything from planning your quiz to publishing and sharing it with the world."],
      },
      {
        heading: "Planning Your Quiz",
        paragraphs: ["Before diving into the quiz editor, take some time to plan your quiz. Consider these key elements:"],
        list: ["Purpose: Define why you're creating this quiz (education, entertainment, assessment)", "Audience: Identify who will be taking your quiz and their knowledge level", "Topic: Choose a clear, focused subject for your quiz", "Length: Decide how many questions to include (we recommend 10-15 for most quizzes)", "Difficulty: Determine the appropriate challenge level for your audience"],
      },
      {
        heading: "Creating a New Quiz",
        paragraphs: ["Now that you've planned your quiz, it's time to create it in the platform:"],
        list: ["Log in to your QuizHub  account", "Click the 'Create' button in the top navigation", "Select 'New Quiz' from the dropdown menu", "Enter a title, description, and category for your quiz", "Upload a cover image that represents your quiz topic", "Choose your quiz settings (time limit, randomization, etc.)", "Click 'Continue to Questions' to start building your quiz content"],
      },
      {
        heading: "Adding Questions",
        paragraphs: ["The heart of any quiz is its questions. Our platform supports multiple question types to keep your quiz varied and engaging:"],
        list: ["Multiple Choice: The classic format with one correct answer", "Multiple Response: Questions with more than one correct answer", "True/False: Simple binary choice questions", "Short Answer: Requires participants to type a brief response", "Matching: Participants match items from two columns", "Ranking: Requires ordering items correctly", "Image-based: Questions that use images as options"],
        note: "Mix different question types to keep participants engaged and test different skills.",
      },
      {
        heading: "Writing Effective Questions",
        paragraphs: ["The quality of your questions directly impacts the effectiveness of your quiz. Follow these best practices:"],
        list: ["Be clear and concise in your wording", "Avoid ambiguity that could lead to confusion", "Ensure questions have a definitive correct answer", "Make incorrect options plausible but clearly wrong", "Use proper grammar and spelling", "Include relevant images or media when appropriate", "Vary the difficulty to maintain interest"],
      },
      {
        heading: "Adding Explanations",
        paragraphs: ["Explanations turn your quiz from a simple assessment into a learning opportunity. For each question, consider adding:"],
        list: ["Why the correct answer is right", "Why common misconceptions are wrong", "Additional context or interesting facts", "Sources or references for further reading"],
      },
      {
        heading: "Previewing and Testing",
        paragraphs: ["Before publishing, always preview and test your quiz:"],
        list: ["Click the 'Preview' button to see your quiz as participants will", "Take the quiz yourself to check for errors or unclear questions", "Test on different devices to ensure compatibility", "Ask a friend to review it for clarity and engagement", "Check that scoring works correctly"],
        note: "You can save your quiz as a draft at any point and return to edit it later.",
      },
      {
        heading: "Publishing and Sharing",
        paragraphs: ["Once you're satisfied with your quiz, it's time to share it with the world:"],
        list: ["Click 'Publish' to make your quiz live", "Set visibility options (public, private, or link-only)", "Share directly to social media platforms", "Embed the quiz on your website or blog", "Send the link directly to specific participants"],
      },
    ],
  },
  {
    id: "tournament-creation",
    title: "Creating Your First Tournament",
    description: "Learn how to set up, configure, and launch a successful quiz tournament.",
    readTime: 6,
    category: "tournaments",
    content: [
      {
        heading: "Introduction to Quiz Tournaments",
        paragraphs: ["Quiz tournaments take the excitement of quizzing to the next level by adding competition, time pressure, and prizes. Whether you're organizing an event for your classroom, workplace, or community, tournaments can dramatically increase engagement and participation.", "This guide will walk you through the process of creating and managing your first tournament on QuizHub ."],
      },
      {
        heading: "Planning Your Tournament",
        paragraphs: ["Before diving into the technical setup, take some time to plan your tournament structure:"],
        list: ["Define your objective (education, team building, entertainment)", "Determine your target audience and expected number of participants", "Choose a theme or topic focus for your tournament", "Decide on the tournament format (knockout, round-robin, etc.)", "Set a timeline with registration period, rounds, and finals", "Plan your prize structure if applicable"],
      },
      {
        heading: "Creating a New Tournament",
        paragraphs: ["Now that you have a plan, let's create your tournament in the platform:"],
        list: ["Log in to your QuizHub  account", "Navigate to the 'Tournaments' section", "Click 'Create Tournament' button", "Enter a compelling title and detailed description", "Upload an eye-catching banner image", "Set the tournament dates (registration, start, and end)", "Choose your tournament visibility (public, private, or invitation-only)"],
        note: "Premium accounts can create unlimited tournaments, while free accounts are limited to one active tournament per month.",
      },
      {
        heading: "Configuring Tournament Settings",
        paragraphs: ["Fine-tune your tournament with these important settings:"],
        list: ["Participant limit: Set maximum number of participants", "Entry requirements: Free entry or point/token cost", "Qualification criteria: Open to all or based on ranking/invitation", "Time restrictions: Set when quizzes can be attempted", "Anti-cheating measures: Enable or disable various protections", "Results visibility: When and how results are displayed", "Communication settings: Enable comments, announcements, etc."],
      },
      {
        heading: "Adding Quizzes to Your Tournament",
        paragraphs: ["Every tournament needs content. You can add quizzes in several ways:"],
        list: ["Create new quizzes specifically for the tournament", "Select from your existing quizzes", "Import quizzes from the QuizHub  library (premium feature)", "Invite other creators to contribute quizzes (collaboration feature)", "Use AI-generated quizzes based on your specifications"],
        note: "For multi-round tournaments, you can assign specific quizzes to different rounds or make them randomly selected from a pool.",
      },
      {
        heading: "Setting Up Tournament Rounds",
        paragraphs: ["For more complex tournaments, you can set up multiple rounds:"],
        list: ["Click 'Add Round' in the tournament editor", "Name each round (e.g., 'Qualifying Round', 'Semi-Finals', 'Finals')", "Set the start and end time for each round", "Assign quizzes to each round", "Configure advancement rules (top scorers, percentage, or manual selection)", "Set point values or weightings for each round"],
      },
      {
        heading: "Configuring Prizes and Rewards",
        paragraphs: ["Prizes add excitement and incentive for participation:"],
        list: ["Set up the prize structure (1st, 2nd, 3rd place, etc.)", "Define prizes (points, badges, physical prizes, monetary rewards)", "Create custom achievement badges for participants", "Set up automatic or manual prize distribution", "Configure participation rewards for all contestants"],
        note: "Even simple recognition like digital badges can significantly increase participation and engagement.",
      },
      {
        heading: "Promoting Your Tournament",
        paragraphs: ["A successful tournament needs participants. Here's how to spread the word:"],
        list: ["Use the built-in invitation system to invite specific users", "Share on social media directly from the platform", "Embed tournament announcements on your website", "Create a custom landing page (premium feature)", "Schedule announcement posts leading up to the event", "Partner with other quiz creators for cross-promotion"],
      },
      {
        heading: "Managing Your Live Tournament",
        paragraphs: ["Once your tournament is live, you'll need to manage it:"],
        list: ["Monitor participation and send reminders", "Address participant questions and concerns promptly", "Make announcements about upcoming rounds or changes", "Review and approve quiz submissions if using collaborative mode", "Moderate discussions and comments", "Handle any technical issues that arise"],
      },
      {
        heading: "Analyzing Tournament Results",
        paragraphs: ["After your tournament concludes, take time to analyze the results:"],
        list: ["Review participation statistics and completion rates", "Analyze performance data across different rounds", "Identify the most challenging questions or quizzes", "Collect feedback from participants for future improvements", "Share highlights and celebrate winners", "Plan follow-up events based on popularity and engagement"],
      },
      {
        heading: "Tournament Best Practices",
        paragraphs: ["Based on successful tournaments on our platform, here are some tips:", "Keep your first tournament relatively simple until you're familiar with the tools. You can always create more complex events as you gain experience. Regular communication with participants before and during the tournament is crucial for engagement and satisfaction."],
        note: "Remember that the goal is to create an enjoyable experience for participants, regardless of who wins. Focus on making the journey fun and engaging for everyone involved.",
      },
    ],
  },
  {
    id: "privacy-settings",
    title: "Understanding Privacy Settings",
    description: "A comprehensive guide to all privacy options available on the platform.",
    readTime: 5,
    category: "privacy",
    content: [
      {
        heading: "Introduction to Privacy on QuizHub",
        paragraphs: [
          "At QuizHub , we understand the importance of privacy and giving you control over your personal information and content. This guide explains all the privacy settings available on our platform and how to configure them to match your preferences.",
          "Whether you're concerned about who can see your quiz results, want to control your profile visibility, or need to understand how your data is used, this article will help you navigate all privacy options.",
        ],
      },
      {
        heading: "Accessing Your Privacy Settings",
        paragraphs: ["To access your privacy settings, follow these steps:"],
        list: ["Log in to your QuizHub  account", "Click on your profile picture in the top right corner", "Select 'Settings' from the dropdown menu", "Navigate to the 'Privacy' tab", "Here you'll find all privacy-related settings organized by category"],
      },
      {
        heading: "Profile Privacy Settings",
        paragraphs: ["Control who can see your profile information and activity:"],
        list: [
          "Profile Visibility: Choose between Public (anyone can view), Private (only followers), or Custom (select specific users)",
          "Activity Feed: Control what activities appear in your public feed (quiz completions, creations, comments)",
          "Online Status: Show or hide when you're active on the platform",
          "Last Seen: Control whether others can see when you last used the platform",
          "Profile Discovery: Determine if your profile appears in search results and recommendations",
        ],
        note: "Even with a private profile, your username and profile picture may still be visible in certain contexts, such as leaderboards you've opted into.",
      },
      {
        heading: "Quiz Result Privacy",
        paragraphs: ["Manage how your quiz performance is shared:"],
        list: ["Result Sharing: Choose to automatically share results, never share, or decide case by case", "Score Visibility: Control whether your scores are visible to others", "Leaderboard Participation: Opt in or out of appearing on public leaderboards", "Performance Statistics: Control if others can see your overall performance metrics", "Quiz History: Determine who can view your quiz taking history"],
      },
      {
        heading: "Content Creation Privacy",
        paragraphs: ["For quiz creators, control the visibility and access to your created content:"],
        list: ["Default Quiz Visibility: Set new quizzes to public, private, or link-only by default", "Creator Attribution: Show or hide your name on quizzes you create", "Comment Moderation: Approve comments before they appear on your quizzes", "Usage Statistics: Control whether others can see how many times your quizzes have been taken", "Content Reuse: Allow or restrict others from using your questions in their quizzes"],
      },
      {
        heading: "Communication Privacy",
        paragraphs: ["Manage how others can interact with you on the platform:"],
        list: ["Direct Messages: Choose who can send you messages (everyone, followers only, or nobody)", "Comment Notifications: Control who can comment on your activity", "Mention Permissions: Determine who can mention you in comments and posts", "Follow Requests: Automatically accept follow requests or review them first", "Email Communication: Control what types of updates you receive via email"],
      },
      {
        heading: "Data Usage and Personalization",
        paragraphs: ["Control how your data is used to personalize your experience:"],
        list: [
          "Personalized Recommendations: Enable or disable quiz recommendations based on your activity",
          "Interest-Based Content: Allow or restrict content suggestions based on your interests",
          "Learning Pattern Analysis: Permit or limit analysis of your quiz performance for personalized learning",
          "Third-Party Data Sharing: Control what data is shared with integrated services",
          "Analytics Participation: Opt in or out of anonymous usage statistics",
        ],
        note: "Disabling personalization features may limit the platform's ability to suggest relevant content but will not affect core functionality.",
      },
      {
        heading: "Advanced Privacy Options",
        paragraphs: ["Additional privacy controls for specific needs:"],
        list: ["Two-Factor Authentication: Add an extra layer of security to your account", "Login History: Review devices and locations that have accessed your account", "Connected Apps: Manage third-party applications with access to your account", "Data Download: Request a copy of all your personal data stored on our platform", "Account Deletion: Permanently remove your account and associated data"],
      },
      {
        heading: "Privacy Best Practices",
        paragraphs: ["To maintain optimal privacy on QuizHub , we recommend:", "Regularly review your privacy settings, especially after platform updates. Be mindful of what personal information you include in your profile, quizzes, and comments. Use strong, unique passwords and enable two-factor authentication for maximum security."],
        note: "If you have specific privacy concerns not addressed by these settings, please contact our support team for assistance.",
      },
    ],
  },
  {
    id: "troubleshooting-quiz-issues",
    title: "Troubleshooting Common Quiz Issues",
    description: "Solutions for the most frequently encountered problems when taking or creating quizzes.",
    readTime: 6,
    category: "technical",
    content: [
      {
        heading: "Common Quiz Taking Issues",
        paragraphs: ["Encountering problems while taking quizzes can be frustrating. Here are solutions to the most common issues:"],
        list: [
          "Quiz won't load: Clear your browser cache, try a different browser, or check your internet connection",
          "Can't submit answers: Ensure all required questions are answered and you're still within the time limit",
          "Timer issues: Refresh the page (your progress should be saved) or try a different browser",
          "Media not displaying: Enable JavaScript and check if your browser blocks media content",
          "Score not recording: Make sure you're logged in and complete the quiz to the confirmation screen",
        ],
      },
      {
        heading: "Quiz Creation Troubleshooting",
        paragraphs: ["When creating quizzes, you might encounter these common issues:"],
        list: [
          "Changes not saving: Check your internet connection and look for the 'Saved' confirmation",
          "Image upload failures: Ensure images are under 5MB and in supported formats (JPG, PNG, GIF)",
          "Formatting problems: Use the built-in formatting tools rather than pasting formatted text",
          "Question limit reached: Free accounts are limited to 50 questions per quiz; upgrade for more",
          "Preview not working: Try a different browser or clear your cache",
        ],
        note: "Always save your work frequently when creating quizzes to prevent loss of content.",
      },
      {
        heading: "Mobile App Issues",
        paragraphs: ["If you're using our mobile app and experiencing problems:"],
        list: ["App crashes: Update to the latest version or reinstall the app", "Sync issues: Ensure you're logged into the same account and have a stable internet connection", "Notification problems: Check your device notification settings and the app's notification settings", "Storage warnings: Clear the app cache or free up device storage", "Display issues: Try adjusting your device's display settings or font size"],
      },
      {
        heading: "Account and Access Problems",
        paragraphs: ["Issues related to accessing quizzes or features:"],
        list: [
          "Premium feature access: Verify your subscription status in Account Settings",
          "Quiz access denied: Check if the quiz requires a password or is restricted to certain users",
          "Tournament entry issues: Ensure you meet all eligibility requirements and registered before the deadline",
          "Missing quizzes: Check different tabs (Draft, Published, Archived) in your My Quizzes section",
          "Collaboration permissions: Verify your role and permissions in shared quizzes",
        ],
      },
      {
        heading: "Performance and Speed Issues",
        paragraphs: ["If you're experiencing slow performance:"],
        list: [
          "Slow quiz loading: Try reducing the number of media elements in your quiz",
          "Delayed results: Large participant numbers may cause slight delays in leaderboard updates",
          "Sluggish editor: Close other browser tabs or applications to free up system resources",
          "Reporting delays: Complex analytics may take longer to generate for quizzes with many participants",
          "General slowness: Check your internet speed and try accessing during off-peak hours",
        ],
      },
      {
        heading: "Browser Compatibility",
        paragraphs: ["For optimal performance, we recommend using:"],
        list: ["Chrome (version 90 or newer)", "Firefox (version 88 or newer)", "Safari (version 14 or newer)", "Edge (version 90 or newer)", "Opera (version 76 or newer)"],
        note: "Internet Explorer is not supported. If you're using an older browser version, you may experience compatibility issues.",
      },
      {
        heading: "Advanced Troubleshooting",
        paragraphs: ["If basic troubleshooting doesn't resolve your issue:"],
        list: ["Try incognito/private browsing mode to rule out extension conflicts", "Check if your network blocks certain content types or domains", "Verify that your device meets the minimum system requirements", "Test on a different device or network to isolate the problem", "Clear all browser data including cookies and local storage"],
      },
      {
        heading: "Contacting Support",
        paragraphs: ["If you've tried the solutions above and still have issues, contact our support team with these details:"],
        list: ["Detailed description of the problem", "Steps to reproduce the issue", "Device and browser information", "Screenshots or screen recordings if possible", "Quiz ID or URL where the problem occurs", "Any error messages you received"],
        note: "Our support team typically responds within 24 hours on business days. Premium users receive priority support.",
      },
    ],
  },
  {
    id: "community-guidelines",
    title: "Community Guidelines",
    description: "Our rules and expectations for creating a positive and respectful community.",
    readTime: 4,
    category: "general",
    content: [
      {
        heading: "Our Community Values",
        paragraphs: ["QuizHub is committed to fostering a welcoming, inclusive, and educational community. Our platform brings together people from diverse backgrounds who share a passion for knowledge, learning, and quiz creation.", "These guidelines outline our expectations for all community members to ensure everyone has a positive experience. By using QuizHub , you agree to follow these guidelines in all interactions."],
      },
      {
        heading: "Respectful Interactions",
        paragraphs: ["We expect all community members to treat each other with respect and courtesy:"],
        list: ["Be kind and considerate in all communications", "Respect diverse perspectives and experiences", "Disagree constructively without personal attacks", "Avoid language that could be considered offensive or exclusionary", "Consider how your words might be interpreted by others"],
      },
      {
        heading: "Content Standards",
        paragraphs: ["When creating quizzes, comments, or other content, please adhere to these standards:"],
        list: [
          "Create accurate, factual content whenever presenting information as fact",
          "Clearly distinguish between factual content and opinion-based questions",
          "Avoid sensitive topics unless presented in an educational, balanced manner",
          "Do not create content that promotes harmful stereotypes or prejudice",
          "Respect intellectual property rights and cite sources when appropriate",
          "Ensure content is age-appropriate for your intended audience",
        ],
        note: "Content that violates our standards may be removed, and repeated violations may result in account restrictions.",
      },
      {
        heading: "Prohibited Content",
        paragraphs: ["The following types of content are strictly prohibited on QuizHub :"],
        list: ["Hate speech, discrimination, or content promoting intolerance", "Sexually explicit or pornographic material", "Graphic violence or content that glorifies harm", "Harassment, bullying, or content targeting specific individuals", "Misinformation or deliberate spreading of false information", "Spam, scams, or deceptive content", "Content that violates laws or regulations"],
      },
      {
        heading: "Fair Play in Competitions",
        paragraphs: ["When participating in quizzes and tournaments:"],
        list: ["Do not cheat or use unauthorized aids when taking quizzes", "Respect time limits and competition rules", "Do not share answers with others during active competitions", "Report any bugs or exploits rather than taking advantage of them", "Be gracious in both victory and defeat"],
      },
      {
        heading: "Privacy and Personal Information",
        paragraphs: ["Respect the privacy of other community members:"],
        list: ["Do not share personal information about others without consent", "Respect privacy settings and boundaries set by other users", "Do not attempt to identify anonymous or pseudonymous users", "Ask permission before tagging others in content", "Report privacy concerns rather than calling attention to them publicly"],
      },
      {
        heading: "Reporting Violations",
        paragraphs: ["If you encounter content or behavior that violates these guidelines:"],
        list: ["Use the 'Report' button available on all content and user profiles", "Provide specific details about the violation", "Do not engage with or escalate problematic interactions", "Allow moderators time to review and address reports", "Contact support for urgent concerns"],
        note: "All reports are reviewed by our moderation team and kept confidential.",
      },
      {
        heading: "Consequences for Violations",
        paragraphs: ["Depending on the severity and frequency of violations, consequences may include:"],
        list: ["Content removal", "Warnings", "Temporary restrictions on specific features", "Account suspension", "Permanent account termination", "IP bans for severe or repeated violations"],
      },
      {
        heading: "Appeals Process",
        paragraphs: ["If you believe a moderation action was taken in error, you can appeal:"],
        list: ["Contact support with the subject line 'Moderation Appeal'", "Include your username and details about the moderation action", "Explain why you believe the action was incorrect", "Provide any relevant context or evidence", "Allow 3-5 business days for review"],
      },
    ],
  },
];
