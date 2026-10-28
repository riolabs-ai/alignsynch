export type TipCategory = "question-writing" | "engagement" | "monetization" | "design" | "promotion" | "technical";

export interface Tip {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: TipCategory;
  image: string;
  author: {
    name: string;
    avatar: string;
  };
  date: string;
  readTime: number;
  featured?: boolean;
}

export const categories = [
  {
    id: "question-writing",
    name: "Question Writing",
    description: "Learn how to write effective and engaging quiz questions",
    icon: "PencilLine",
    count: 8,
  },
  {
    id: "engagement",
    name: "User Engagement",
    description: "Strategies to keep participants interested and coming back",
    icon: "Users",
    count: 6,
  },
  {
    id: "monetization",
    name: "Monetization",
    description: "Tips for earning revenue from your quizzes",
    icon: "DollarSign",
    count: 5,
  },
  {
    id: "design",
    name: "Quiz Design",
    description: "Best practices for quiz structure and flow",
    icon: "Palette",
    count: 7,
  },
  {
    id: "promotion",
    name: "Promotion",
    description: "How to promote your quizzes and reach more people",
    icon: "Megaphone",
    count: 4,
  },
  {
    id: "technical",
    name: "Technical Tips",
    description: "Technical aspects of creating effective quizzes",
    icon: "Settings",
    count: 3,
  },
];

export const tips: Tip[] = [
  {
    id: "1",
    slug: "writing-effective-quiz-questions",
    title: "Writing Effective Quiz Questions",
    excerpt: "Learn how to craft quiz questions that are clear, engaging, and test knowledge effectively.",
    content: `
# Writing Effective Quiz Questions

Good quiz questions are the foundation of any successful quiz. They should be clear, engaging, and effectively test knowledge. Here are some tips to help you write better quiz questions:

## Be Clear and Concise

Your questions should be easy to understand. Avoid using complex language or ambiguous phrasing that might confuse participants.

- **Good Example**: "Which planet is closest to the sun?"
- **Bad Example**: "In our solar system's arrangement of celestial bodies, which of the planetary entities maintains the position of least distance from our star?"

## Use a Variety of Question Types

Different question types test different skills and keep your quiz interesting:

- Multiple choice
- True/False
- Fill in the blank
- Matching
- Short answer

## Balance Difficulty

A good quiz has a mix of easy, medium, and difficult questions. This keeps participants engaged and gives everyone a chance to succeed.

## Avoid Trick Questions

Questions should test knowledge, not try to deceive participants. Trick questions can frustrate users and make them less likely to return.

## Use Images When Appropriate

Visual elements can make your quiz more engaging and test different types of knowledge.

- [Learn more about adding images](https://docs.quizlet.com/en/adding-images-to-your-quiz)

## Test Your Questions

Before publishing, have someone else take your quiz to ensure the questions are clear and have the right level of difficulty.
    `,
    category: "question-writing",
    image: "/tips/tip-1.png",
    author: {
      name: "Alex Johnson",
      avatar: "/avatars/alex.png",
    },
    date: "2023-04-15",
    readTime: 5,
    featured: true,
  },
  {
    id: "2",
    slug: "increasing-quiz-engagement",
    title: "Strategies for Increasing Quiz Engagement",
    excerpt: "Discover proven methods to boost participation and keep users coming back to your quizzes.",
    content: `
# Strategies for Increasing Quiz Engagement

Keeping users engaged with your quizzes is essential for building a successful platform. Here are some effective strategies:

## Personalize the Experience

Tailor quizzes to user interests and previous performance. Personalized recommendations can significantly increase participation.

## Add Gamification Elements

Incorporate points, badges, leaderboards, and achievements to make the experience more game-like and rewarding.

## Provide Immediate Feedback

Don't just tell users if they're right or wrong - explain why. This turns the quiz into a learning experience.

## Create Time-Limited Events

Special events or tournaments with time limits create urgency and encourage participation.

## Use Social Features

Allow users to challenge friends, share results, and compete on social leaderboards to leverage social connections.

## Offer Rewards

Tangible or digital rewards for completion or high scores can be powerful motivators.

## Keep Content Fresh

Regularly update your quizzes and add new content to give users reasons to return.
    `,
    category: "engagement",
    image: "/tips/tip-2.png",
    author: {
      name: "Sarah Williams",
      avatar: "/avatars/sarah.webp",
    },
    date: "2023-05-22",
    readTime: 6,
  },
  {
    id: "3",
    slug: "monetizing-your-quizzes",
    title: "Monetizing Your Quizzes: A Complete Guide",
    excerpt: "Learn different strategies to generate revenue from your quiz content.",
    content: `
# Monetizing Your Quizzes: A Complete Guide

There are multiple ways to generate revenue from your quizzes. This guide covers the most effective strategies:

## Premium Quiz Content

Create a tiered system with free and premium quizzes. Premium content can include:
- Specialized topics
- Advanced difficulty levels
- In-depth analysis of results
- Exclusive certificates

## Subscription Models

Offer a subscription service that provides:
- Unlimited access to all quizzes
- No advertisements
- Additional features like progress tracking
- Early access to new content

## Sponsored Quizzes

Partner with brands to create sponsored quiz content that:
- Aligns with your audience interests
- Provides value while promoting products
- Creates an additional revenue stream

## Advertising

Implement non-intrusive advertising:
- Between quiz questions
- On results pages
- In sidebar placements
- Native advertising that matches your content

## Affiliate Marketing

Include relevant product recommendations based on quiz results with affiliate links.

## Corporate Training Packages

Offer customized quiz packages for businesses for training and assessment purposes.

## Data Insights (With Proper Consent)

Aggregate anonymized data from quizzes to provide valuable market insights to partners.
    `,
    category: "monetization",
    image: "/tips/tip-3.png",
    author: {
      name: "Michael Chen",
      avatar: "/placeholder.svg?height=100&width=100",
    },
    date: "2023-06-10",
    readTime: 8,
    featured: true,
  },
  {
    id: "4",
    slug: "quiz-design-principles",
    title: "Quiz Design Principles for Maximum Impact",
    excerpt: "Design principles that make your quizzes more effective and enjoyable for participants.",
    content: `
# Quiz Design Principles for Maximum Impact

The design of your quiz significantly impacts user experience and effectiveness. Follow these principles for better results:

## Clear Structure

Organize your quiz with a logical flow:
- Introduction with clear instructions
- Consistent question format
- Progress indicators
- Well-designed results page

## Optimal Length

Keep quizzes at an appropriate length:
- Short quizzes (5-10 questions) for casual engagement
- Medium quizzes (10-20 questions) for more in-depth topics
- Long quizzes (20+ questions) only for comprehensive assessments

## Visual Hierarchy

Use design elements to guide attention:
- Emphasize questions with typography
- Make answer options distinct but equal
- Use color to indicate selection and feedback
- Keep decorative elements minimal

## Mobile-First Design

Ensure your quiz works perfectly on mobile devices:
- Touch-friendly interface
- Readable text without zooming
- Minimal scrolling within questions
- Fast loading times

## Accessibility

Make your quiz accessible to all users:
- Sufficient color contrast
- Alternative text for images
- Keyboard navigation support
- Screen reader compatibility

## Feedback Design

Design effective feedback mechanisms:
- Immediate response to answers
- Visual cues for correct/incorrect answers
- Explanations that add value
- Summary of performance at the end
    `,
    category: "design",
    image: "/tips/tip-4.png",
    author: {
      name: "Emma Rodriguez",
      avatar: "/avatars/alex.png",
    },
    date: "2023-07-05",
    readTime: 7,
  },
  {
    id: "5",
    slug: "promoting-your-quiz",
    title: "Effective Strategies for Promoting Your Quiz",
    excerpt: "Learn how to market your quizzes and reach a wider audience.",
    content: `
# Effective Strategies for Promoting Your Quiz

Creating a great quiz is only half the battle - you also need to promote it effectively. Here are strategies to help your quiz reach more people:

## Social Media Promotion

Leverage different platforms effectively:
- **Instagram**: Share visually appealing quiz previews and results templates
- **Twitter**: Post intriguing quiz questions and statistics
- **Facebook**: Create events for quiz competitions and share to groups
- **LinkedIn**: Promote professional development and knowledge-testing quizzes
- **TikTok**: Create short videos with quiz teasers or reactions

## Email Marketing

Build and utilize an email list:
- Send new quiz announcements to subscribers
- Create a regular quiz newsletter
- Offer exclusive quizzes to email subscribers
- Use segmentation to send relevant quizzes to different audiences

## Content Marketing

Create supporting content:
- Blog posts related to quiz topics
- Behind-the-scenes of quiz creation
- Expert interviews on quiz subjects
- Analysis of interesting quiz results and trends

## Collaborations

Partner with others to expand reach:
- Influencer partnerships
- Cross-promotion with complementary websites
- Guest quizzes on other platforms
- Industry expert endorsements

## SEO Optimization

Make your quizzes discoverable:
- Research and use relevant keywords
- Create compelling meta descriptions
- Use schema markup for rich results
- Build backlinks through outreach

## Paid Advertising

Consider strategic paid promotion:
- Social media ads targeted to relevant interests
- Google Ads for high-intent searches
- Retargeting campaigns for previous visitors
- Sponsored content in newsletters

## Community Building

Foster a community around your quizzes:
- Create challenges and competitions
- Highlight top performers
- Encourage user-generated content
- Respond to feedback and suggestions
    `,
    category: "promotion",
    image: "/tips/tip-5.png",
    author: {
      name: "David Wilson",
      avatar: "/avatars/guru.png",
    },
    date: "2023-08-12",
    readTime: 6,
    featured: true,
  },
  {
    id: "6",
    slug: "technical-quiz-optimization",
    title: "Technical Optimization for Quiz Performance",
    excerpt: "Technical tips to make your quizzes load faster and perform better.",
    content: `
# Technical Optimization for Quiz Performance

The technical performance of your quiz directly impacts user experience. Follow these optimization tips:

## Loading Speed Optimization

Improve how quickly your quiz loads:
- Compress images and media
- Minimize HTTP requests
- Use lazy loading for content
- Implement efficient caching
- Consider a content delivery network (CDN)

## Progressive Loading

Structure your quiz to load progressively:
- Load the quiz interface first
- Fetch questions in batches as needed
- Preload the next question while user answers current one
- Show loading indicators for transparency

## Data Management

Optimize how quiz data is handled:
- Store user progress locally when possible
- Implement efficient database queries
- Use pagination for large result sets
- Consider serverless functions for scaling

## Mobile Performance

Ensure smooth performance on mobile devices:
- Optimize touch interactions
- Reduce JavaScript execution time
- Minimize battery usage
- Test on various devices and connections

## Error Handling

Implement robust error handling:
- Graceful degradation when features fail
- Offline support where possible
- Clear error messages
- Automatic retry mechanisms

## Analytics Implementation

Add analytics without hurting performance:
- Choose lightweight analytics tools
- Batch analytics events
- Consider sampling for high-traffic quizzes
- Ensure GDPR compliance

## Security Considerations

Protect your quiz and user data:
- Implement rate limiting
- Validate all user inputs
- Protect against common vulnerabilities
- Secure API endpoints
    `,
    category: "technical",
    image: "/tips/tip-5.png",
    author: {
      name: "Tech Team",
      avatar: "/avatars/king.webp",
    },
    date: "2023-09-18",
    readTime: 9,
  },
];

// Helper functions
export function getFeaturedTips() {
  return tips.filter((tip) => tip.featured);
}

export function getTipsByCategory(category: TipCategory) {
  return tips.filter((tip) => tip.category === category);
}

export function getTipBySlug(slug: string) {
  return tips.find((tip) => tip.slug === slug);
}

export function getRelatedTips(currentTip: Tip, count = 3) {
  return tips.filter((tip) => tip.id !== currentTip.id && tip.category === currentTip.category).slice(0, count);
}

export function searchTips(query: string) {
  const lowerCaseQuery = query.toLowerCase();
  return tips.filter((tip) => tip.title.toLowerCase().includes(lowerCaseQuery) || tip.excerpt.toLowerCase().includes(lowerCaseQuery) || tip.content.toLowerCase().includes(lowerCaseQuery));
}
