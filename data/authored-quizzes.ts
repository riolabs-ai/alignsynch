/**
 * GENERATED from the P1 fixture migration — see docs/p1-migration/MIGRATION.md §10.
 *
 * The 16 quizzes decision A authored so that all 31 card records project instead
 * of orphaning: `title`, `cover.src`, `author` and `stats` are lifted from the card
 * records unchanged; `summary`, `difficulty`, `categoryIds` and the 5 questions (4
 * options each, answer by option id) are authored, and are the only new prose.
 *
 * Slugs are FROZEN (E8): `historys-greatest-mysteries` deletes the apostrophe on
 * purpose. Renaming one is a new URL, not a rename.
 *
 * The card-only engagement conflicts are NOT resolved here. `Science Quiz: Space
 * Exploration` carries the catalog snapshot (2453/3000 · $10.00 · 4.9 · `hot`);
 * the second merchandising snapshot (2105/2500 · $7.50 · 4.8 · `popular`) is a
 * per-slot overlay (B-01, `zQuizPromotion`), never a second record for the same
 * subject — E10 forbids a duplicate record and A4 forbids a shadow identity.
 */
import type { Quiz } from "../content/quiz";

export const authoredQuizzes: readonly Quiz[] = [
  {
    id: "quiz-science-quiz-space-exploration",
    kind: "quiz",
    slug: "science-quiz-space-exploration",
    title: "Science Quiz: Space Exploration",
    summary:
      "Blast off through the solar system and beyond: planets, orbits and the scale of the galaxy, five questions at a time.",
    categoryIds: ["space", "science"],
    tags: [],
    difficulty: "medium",
    status: "published",
    questions: [
      {
        id: "quiz-science-quiz-space-exploration-q1",
        prompt: "Which planet is known as the Red Planet?",
        options: [
          {
            id: "a",
            text: "Venus",
          },
          {
            id: "b",
            text: "Mars",
          },
          {
            id: "c",
            text: "Jupiter",
          },
          {
            id: "d",
            text: "Mercury",
          },
        ],
        correctOptionId: "b",
        explanation: "Iron oxide on the surface gives Mars its reddish colour.",
      },
      {
        id: "quiz-science-quiz-space-exploration-q2",
        prompt: "Which is the largest planet in our solar system?",
        options: [
          {
            id: "a",
            text: "Saturn",
          },
          {
            id: "b",
            text: "Neptune",
          },
          {
            id: "c",
            text: "Jupiter",
          },
          {
            id: "d",
            text: "Earth",
          },
        ],
        correctOptionId: "c",
        explanation: "Jupiter is more massive than all the other planets combined.",
      },
      {
        id: "quiz-science-quiz-space-exploration-q3",
        prompt: "What force keeps the planets in orbit around the Sun?",
        options: [
          {
            id: "a",
            text: "Gravity",
          },
          {
            id: "b",
            text: "Magnetism",
          },
          {
            id: "c",
            text: "Friction",
          },
          {
            id: "d",
            text: "Radiation pressure",
          },
        ],
        correctOptionId: "a",
        explanation: "The Sun's gravity curves the planets' paths into closed orbits.",
      },
      {
        id: "quiz-science-quiz-space-exploration-q4",
        prompt: "A light-year is a measure of what?",
        options: [
          {
            id: "a",
            text: "Time",
          },
          {
            id: "b",
            text: "Brightness",
          },
          {
            id: "c",
            text: "Distance",
          },
          {
            id: "d",
            text: "Mass",
          },
        ],
        correctOptionId: "c",
        explanation: "It is the distance light travels in one year, about 9.46 trillion km.",
      },
      {
        id: "quiz-science-quiz-space-exploration-q5",
        prompt: "Which galaxy contains our solar system?",
        options: [
          {
            id: "a",
            text: "Andromeda",
          },
          {
            id: "b",
            text: "Triangulum",
          },
          {
            id: "c",
            text: "Sombrero",
          },
          {
            id: "d",
            text: "The Milky Way",
          },
        ],
        correctOptionId: "d",
        explanation: "The Sun sits about 26,000 light-years from the galactic centre.",
      },
    ],
    settings: {
      timeLimitSeconds: 0,
      questionTimerSeconds: 0,
      passingScore: 70,
      shuffleQuestions: false,
      showExplanations: true,
      allowRetakes: true,
      visibility: "public",
    },
    stats: {
      isTournament: false,
      recentPlayers: [
        {
          name: "Alex J.",
          avatar: {
            src: "/avatars/alex.png",
            alt: "Alex J.",
          },
        },
        {
          name: "Sarah W.",
          avatar: {
            src: "/avatars/wizard.webp",
            alt: "Sarah W.",
          },
        },
        {
          name: "Mike B.",
          avatar: {
            src: "/avatars/sarah.webp",
            alt: "Mike B.",
          },
        },
        {
          name: "Emily D.",
          avatar: {
            src: "/avatars/king.webp",
            alt: "Emily D.",
          },
        },
      ],
      plays: 2453,
      capacity: 3000,
      rating: 4.9,
      badge: {
        type: "hot",
        label: "Hot 🔥",
      },
      rewardCents: 1000,
      limitedTimeEndsAt: "2025-01-03T00:00:00.000Z",
      updatedAt: "2024-12-27T00:00:00.000Z",
    },
    cover: {
      src: "/space-exploration-quiz.png",
      alt: "Science Quiz: Space Exploration",
    },
    author: {
      name: "MarvelFan",
      avatar: {
        src: "/avatars/alex.png",
        alt: "MarvelFan",
      },
    },
  },
  {
    id: "quiz-world-geography-challenge-capitals-landmarks",
    kind: "quiz",
    slug: "world-geography-challenge-capitals-landmarks",
    title: "World Geography Challenge: Capitals & Landmarks",
    summary:
      "Capitals, rivers and the world's best-known landmarks — a quick tour of the map for armchair travellers.",
    categoryIds: ["geography"],
    tags: [],
    difficulty: "easy",
    status: "published",
    questions: [
      {
        id: "quiz-world-geography-challenge-capitals-landmarks-q1",
        prompt: "What is the capital of France?",
        options: [
          {
            id: "a",
            text: "Lyon",
          },
          {
            id: "b",
            text: "Marseille",
          },
          {
            id: "c",
            text: "Paris",
          },
          {
            id: "d",
            text: "Nice",
          },
        ],
        correctOptionId: "c",
        explanation: "Paris has been the French capital since 987 CE.",
      },
      {
        id: "quiz-world-geography-challenge-capitals-landmarks-q2",
        prompt: "The Great Wall is located in which country?",
        options: [
          {
            id: "a",
            text: "China",
          },
          {
            id: "b",
            text: "Japan",
          },
          {
            id: "c",
            text: "Mongolia",
          },
          {
            id: "d",
            text: "South Korea",
          },
        ],
        correctOptionId: "a",
        explanation: "Its surviving sections were mostly built during the Ming dynasty.",
      },
      {
        id: "quiz-world-geography-challenge-capitals-landmarks-q3",
        prompt: "What is the capital of Japan?",
        options: [
          {
            id: "a",
            text: "Osaka",
          },
          {
            id: "b",
            text: "Kyoto",
          },
          {
            id: "c",
            text: "Tokyo",
          },
          {
            id: "d",
            text: "Sapporo",
          },
        ],
        correctOptionId: "c",
        explanation: "Tokyo became the capital in 1868, when it was still called Edo.",
      },
      {
        id: "quiz-world-geography-challenge-capitals-landmarks-q4",
        prompt: "The Colosseum stands in which city?",
        options: [
          {
            id: "a",
            text: "Athens",
          },
          {
            id: "b",
            text: "Rome",
          },
          {
            id: "c",
            text: "Naples",
          },
          {
            id: "d",
            text: "Carthage",
          },
        ],
        correctOptionId: "b",
        explanation: "It was completed in 80 CE under the Flavian emperors.",
      },
      {
        id: "quiz-world-geography-challenge-capitals-landmarks-q5",
        prompt: "What is the capital of Australia?",
        options: [
          {
            id: "a",
            text: "Sydney",
          },
          {
            id: "b",
            text: "Melbourne",
          },
          {
            id: "c",
            text: "Canberra",
          },
          {
            id: "d",
            text: "Perth",
          },
        ],
        correctOptionId: "c",
        explanation: "Canberra was purpose-built as a compromise between Sydney and Melbourne.",
      },
    ],
    settings: {
      timeLimitSeconds: 0,
      questionTimerSeconds: 0,
      passingScore: 70,
      shuffleQuestions: false,
      showExplanations: true,
      allowRetakes: true,
      visibility: "public",
    },
    stats: {
      isTournament: false,
      recentPlayers: [
        {
          name: "David W.",
          avatar: {
            src: "/avatars/champion.png",
            alt: "David W.",
          },
        },
        {
          name: "Jessica T.",
          avatar: {
            src: "/avatars/mind.webp",
            alt: "Jessica T.",
          },
        },
        {
          name: "Ryan M.",
          avatar: {
            src: "/avatars/genious.png",
            alt: "Ryan M.",
          },
        },
        {
          name: "Olivia A.",
          avatar: {
            src: "/avatars/brain.png",
            alt: "Olivia A.",
          },
        },
      ],
      plays: 1872,
      capacity: 2000,
      rating: 4.8,
      badge: {
        type: "editors",
        label: "Editor's Choice ✨",
      },
      rewardCents: 750,
    },
    cover: {
      src: "/world-landmarks.png",
      alt: "World Geography Challenge: Capitals & Landmarks",
    },
    author: {
      name: "GeoExplorer",
      avatar: {
        src: "/avatars/wizard.webp",
        alt: "GeoExplorer",
      },
    },
  },
  {
    id: "quiz-brain-teasers-logic-puzzles",
    kind: "quiz",
    slug: "brain-teasers-logic-puzzles",
    title: "Brain Teasers & Logic Puzzles",
    summary:
      "Riddles that reward a second look: wordplay, counting traps and sequences that are not what they seem.",
    categoryIds: ["puzzle"],
    tags: [],
    difficulty: "medium",
    status: "published",
    questions: [
      {
        id: "quiz-brain-teasers-logic-puzzles-q1",
        prompt: "If two's company and three's a crowd, what are four and five?",
        options: [
          {
            id: "a",
            text: "Nine",
          },
          {
            id: "b",
            text: "Seven",
          },
          {
            id: "c",
            text: "Twelve",
          },
          {
            id: "d",
            text: "Ten",
          },
        ],
        correctOptionId: "a",
        explanation: "Four and five are nine — the riddle is arithmetic wearing a proverb.",
      },
      {
        id: "quiz-brain-teasers-logic-puzzles-q2",
        prompt: "What has keys but cannot open a single lock?",
        options: [
          {
            id: "a",
            text: "A map",
          },
          {
            id: "b",
            text: "A piano",
          },
          {
            id: "c",
            text: "A clock",
          },
          {
            id: "d",
            text: "A library",
          },
        ],
        correctOptionId: "b",
        explanation: "A piano has keys and pedals but no locks.",
      },
      {
        id: "quiz-brain-teasers-logic-puzzles-q3",
        prompt: "A farmer has 17 sheep and all but 9 run away. How many are left?",
        options: [
          {
            id: "a",
            text: "8",
          },
          {
            id: "b",
            text: "9",
          },
          {
            id: "c",
            text: "17",
          },
          {
            id: "d",
            text: "0",
          },
        ],
        correctOptionId: "b",
        explanation: '"All but 9" means 9 stayed.',
      },
      {
        id: "quiz-brain-teasers-logic-puzzles-q4",
        prompt: "What comes next: 2, 4, 8, 16, …?",
        options: [
          {
            id: "a",
            text: "18",
          },
          {
            id: "b",
            text: "20",
          },
          {
            id: "c",
            text: "32",
          },
          {
            id: "d",
            text: "24",
          },
        ],
        correctOptionId: "c",
        explanation: "Each term doubles the one before it.",
      },
      {
        id: "quiz-brain-teasers-logic-puzzles-q5",
        prompt: "How many months of the year have 28 days?",
        options: [
          {
            id: "a",
            text: "One",
          },
          {
            id: "b",
            text: "Two",
          },
          {
            id: "c",
            text: "Eleven",
          },
          {
            id: "d",
            text: "All twelve",
          },
        ],
        correctOptionId: "d",
        explanation: "Every month has at least 28 days; February is the only one that stops there.",
      },
    ],
    settings: {
      timeLimitSeconds: 0,
      questionTimerSeconds: 0,
      passingScore: 70,
      shuffleQuestions: false,
      showExplanations: true,
      allowRetakes: true,
      visibility: "public",
    },
    stats: {
      isTournament: false,
      recentPlayers: [
        {
          name: "James K.",
          avatar: {
            src: "/avatars/alex.png",
            alt: "James K.",
          },
        },
        {
          name: "Sophia L.",
          avatar: {
            src: "/avatars/wizard.webp",
            alt: "Sophia L.",
          },
        },
        {
          name: "Noah P.",
          avatar: {
            src: "/avatars/sarah.webp",
            alt: "Noah P.",
          },
        },
        {
          name: "Emma R.",
          avatar: {
            src: "/avatars/king.webp",
            alt: "Emma R.",
          },
        },
      ],
      plays: 3241,
      capacity: 5000,
      rating: 4.7,
      badge: {
        type: "trending",
        label: "Trending 📈",
      },
      rewardCents: 800,
      limitedTimeEndsAt: "2025-01-02T00:00:00.000Z",
    },
    cover: {
      src: "/brain-teasers-puzzles.png",
      alt: "Brain Teasers & Logic Puzzles",
    },
    author: {
      name: "PuzzleMaster",
      avatar: {
        src: "/avatars/sarah.webp",
        alt: "PuzzleMaster",
      },
    },
  },
  {
    id: "quiz-historys-greatest-mysteries",
    kind: "quiz",
    slug: "historys-greatest-mysteries",
    title: "History's Greatest Mysteries",
    summary:
      "Unsolved vanishing acts, undeciphered manuscripts and events that still divide historians.",
    categoryIds: ["history"],
    tags: [],
    difficulty: "hard",
    status: "published",
    questions: [
      {
        id: "quiz-historys-greatest-mysteries-q1",
        prompt: "The 1947 Roswell incident took place in which US state?",
        options: [
          {
            id: "a",
            text: "Nevada",
          },
          {
            id: "b",
            text: "New Mexico",
          },
          {
            id: "c",
            text: "Texas",
          },
          {
            id: "d",
            text: "Arizona",
          },
        ],
        correctOptionId: "b",
        explanation:
          'The Army Air Forces first reported a recovered "flying disc", then called it a weather balloon.',
      },
      {
        id: "quiz-historys-greatest-mysteries-q2",
        prompt:
          "Which of the Seven Wonders of the Ancient World has never been conclusively located?",
        options: [
          {
            id: "a",
            text: "The Hanging Gardens of Babylon",
          },
          {
            id: "b",
            text: "The Lighthouse of Alexandria",
          },
          {
            id: "c",
            text: "The Colossus of Rhodes",
          },
          {
            id: "d",
            text: "The Statue of Zeus",
          },
        ],
        correctOptionId: "a",
        explanation: "No archaeological trace of the Hanging Gardens has been found at Babylon.",
      },
      {
        id: "quiz-historys-greatest-mysteries-q3",
        prompt: "What is unusual about the Voynich manuscript?",
        options: [
          {
            id: "a",
            text: "It is written in an undeciphered script",
          },
          {
            id: "b",
            text: "It was written in the 20th century",
          },
          {
            id: "c",
            text: "It is a forgery proven in 1930",
          },
          {
            id: "d",
            text: "It contains no illustrations",
          },
        ],
        correctOptionId: "a",
        explanation: "Its script and language remain unread despite a century of attempts.",
      },
      {
        id: "quiz-historys-greatest-mysteries-q4",
        prompt: "Which ship was found abandoned and crewless in 1872?",
        options: [
          {
            id: "a",
            text: "HMS Terror",
          },
          {
            id: "b",
            text: "The Mary Celeste",
          },
          {
            id: "c",
            text: "The Flying Dutchman",
          },
          {
            id: "d",
            text: "SS Ourang Medan",
          },
        ],
        correctOptionId: "b",
        explanation: "The Mary Celeste was found intact off the Azores with no one aboard.",
      },
      {
        id: "quiz-historys-greatest-mysteries-q5",
        prompt: "In which year did the Romanov dynasty fall?",
        options: [
          {
            id: "a",
            text: "1905",
          },
          {
            id: "b",
            text: "1914",
          },
          {
            id: "c",
            text: "1917",
          },
          {
            id: "d",
            text: "1921",
          },
        ],
        correctOptionId: "c",
        explanation: "Nicholas II abdicated in March 1917, ending three centuries of Romanov rule.",
      },
    ],
    settings: {
      timeLimitSeconds: 0,
      questionTimerSeconds: 0,
      passingScore: 70,
      shuffleQuestions: false,
      showExplanations: true,
      allowRetakes: true,
      visibility: "public",
    },
    stats: {
      isTournament: false,
      recentPlayers: [
        {
          name: "William T.",
          avatar: {
            src: "/avatars/champion.png",
            alt: "William T.",
          },
        },
        {
          name: "Ava M.",
          avatar: {
            src: "/avatars/mind.webp",
            alt: "Ava M.",
          },
        },
        {
          name: "Liam S.",
          avatar: {
            src: "/avatars/genious.png",
            alt: "Liam S.",
          },
        },
        {
          name: "Mia J.",
          avatar: {
            src: "/avatars/brain.png",
            alt: "Mia J.",
          },
        },
      ],
      plays: 1563,
      capacity: 1600,
      rating: 4.9,
      badge: {
        type: "topRated",
        label: "Top Rated ⭐",
      },
      rewardCents: 650,
    },
    cover: {
      src: "/history-mysteries.png",
      alt: "History's Greatest Mysteries",
    },
    author: {
      name: "HistoryBuff",
      avatar: {
        src: "/avatars/king.webp",
        alt: "HistoryBuff",
      },
    },
  },
  {
    id: "quiz-ancient-civilizations-egypt-greece-rome",
    kind: "quiz",
    slug: "ancient-civilizations-egypt-greece-rome",
    title: "Ancient Civilizations: Egypt, Greece & Rome",
    summary:
      "Three empires that shaped the Mediterranean world: pharaonic Egypt, classical Greece and Rome.",
    categoryIds: ["history"],
    tags: [],
    difficulty: "medium",
    status: "published",
    questions: [
      {
        id: "quiz-ancient-civilizations-egypt-greece-rome-q1",
        prompt: "Which river was central to ancient Egyptian civilization?",
        options: [
          {
            id: "a",
            text: "The Tigris",
          },
          {
            id: "b",
            text: "The Euphrates",
          },
          {
            id: "c",
            text: "The Nile",
          },
          {
            id: "d",
            text: "The Jordan",
          },
        ],
        correctOptionId: "c",
        explanation: "Annual Nile floods renewed the farmland that fed the kingdom.",
      },
      {
        id: "quiz-ancient-civilizations-egypt-greece-rome-q2",
        prompt: "Who was the first Roman emperor?",
        options: [
          {
            id: "a",
            text: "Julius Caesar",
          },
          {
            id: "b",
            text: "Augustus",
          },
          {
            id: "c",
            text: "Nero",
          },
          {
            id: "d",
            text: "Trajan",
          },
        ],
        correctOptionId: "b",
        explanation: "Octavian took the name Augustus in 27 BCE; Caesar was never emperor.",
      },
      {
        id: "quiz-ancient-civilizations-egypt-greece-rome-q3",
        prompt: "The Parthenon stands on which hill in Athens?",
        options: [
          {
            id: "a",
            text: "The Acropolis",
          },
          {
            id: "b",
            text: "Mount Lycabettus",
          },
          {
            id: "c",
            text: "The Areopagus",
          },
          {
            id: "d",
            text: "The Pnyx",
          },
        ],
        correctOptionId: "a",
        explanation: "It was built between 447 and 432 BCE as a temple to Athena.",
      },
      {
        id: "quiz-ancient-civilizations-egypt-greece-rome-q4",
        prompt: "Which writing system did ancient Egyptians use for monuments?",
        options: [
          {
            id: "a",
            text: "Cuneiform",
          },
          {
            id: "b",
            text: "Hieroglyphs",
          },
          {
            id: "c",
            text: "Linear B",
          },
          {
            id: "d",
            text: "Runes",
          },
        ],
        correctOptionId: "b",
        explanation: "Hieroglyphs combined logographic and alphabetic signs.",
      },
      {
        id: "quiz-ancient-civilizations-egypt-greece-rome-q5",
        prompt: "Which Greek city-state was famed for its military discipline?",
        options: [
          {
            id: "a",
            text: "Athens",
          },
          {
            id: "b",
            text: "Corinth",
          },
          {
            id: "c",
            text: "Thebes",
          },
          {
            id: "d",
            text: "Sparta",
          },
        ],
        correctOptionId: "d",
        explanation: "Spartan boys entered state training at the age of seven.",
      },
    ],
    settings: {
      timeLimitSeconds: 0,
      questionTimerSeconds: 0,
      passingScore: 70,
      shuffleQuestions: false,
      showExplanations: true,
      allowRetakes: true,
      visibility: "public",
    },
    stats: {
      isTournament: false,
      recentPlayers: [],
      plays: 1987,
      capacity: 2500,
      rating: 4.8,
      badge: {
        type: "hot",
        label: "Hot 🔥",
      },
      rewardCents: 900,
      limitedTimeEndsAt: "2025-01-02T12:00:00.000Z",
      updatedAt: "2024-12-25T00:00:00.000Z",
    },
    author: {
      name: "HistoryBuff",
      avatar: {
        src: "/avatars/king.webp",
        alt: "HistoryBuff",
      },
    },
    cover: {
      src: "/ancient-civilizations-quiz.png",
      alt: "Ancient Civilizations: Egypt, Greece & Rome",
    },
  },
  {
    id: "quiz-mathematical-puzzles-brain-teasers",
    kind: "quiz",
    slug: "mathematical-puzzles-brain-teasers",
    title: "Mathematical Puzzles & Brain Teasers",
    summary:
      "Percentages, rates and proportions dressed up as puzzles — arithmetic you can do without a calculator.",
    categoryIds: ["math", "puzzle"],
    tags: [],
    difficulty: "medium",
    status: "published",
    questions: [
      {
        id: "quiz-mathematical-puzzles-brain-teasers-q1",
        prompt: "What is 15% of 200?",
        options: [
          {
            id: "a",
            text: "15",
          },
          {
            id: "b",
            text: "20",
          },
          {
            id: "c",
            text: "30",
          },
          {
            id: "d",
            text: "35",
          },
        ],
        correctOptionId: "c",
        explanation: "10% is 20 and 5% is 10, so 15% is 30.",
      },
      {
        id: "quiz-mathematical-puzzles-brain-teasers-q2",
        prompt: "If a dozen eggs cost $3.00, how much do 18 eggs cost?",
        options: [
          {
            id: "a",
            text: "$4.00",
          },
          {
            id: "b",
            text: "$4.50",
          },
          {
            id: "c",
            text: "$5.00",
          },
          {
            id: "d",
            text: "$5.50",
          },
        ],
        correctOptionId: "b",
        explanation: "Each egg is 25 cents, so 18 eggs cost $4.50.",
      },
      {
        id: "quiz-mathematical-puzzles-brain-teasers-q3",
        prompt: "What is the next prime number after 7?",
        options: [
          {
            id: "a",
            text: "9",
          },
          {
            id: "b",
            text: "10",
          },
          {
            id: "c",
            text: "11",
          },
          {
            id: "d",
            text: "13",
          },
        ],
        correctOptionId: "c",
        explanation: "8, 9 and 10 are composite; 11 has no divisor besides 1 and itself.",
      },
      {
        id: "quiz-mathematical-puzzles-brain-teasers-q4",
        prompt: "A train covers 60 km in 45 minutes. What is its average speed?",
        options: [
          {
            id: "a",
            text: "60 km/h",
          },
          {
            id: "b",
            text: "70 km/h",
          },
          {
            id: "c",
            text: "75 km/h",
          },
          {
            id: "d",
            text: "80 km/h",
          },
        ],
        correctOptionId: "d",
        explanation: "45 minutes is 0.75 hours, and 60 / 0.75 = 80 km/h.",
      },
      {
        id: "quiz-mathematical-puzzles-brain-teasers-q5",
        prompt: "What do the interior angles of a triangle add up to?",
        options: [
          {
            id: "a",
            text: "90°",
          },
          {
            id: "b",
            text: "180°",
          },
          {
            id: "c",
            text: "270°",
          },
          {
            id: "d",
            text: "360°",
          },
        ],
        correctOptionId: "b",
        explanation: "A triangle's angles always sum to 180 degrees in flat space.",
      },
    ],
    settings: {
      timeLimitSeconds: 0,
      questionTimerSeconds: 0,
      passingScore: 70,
      shuffleQuestions: false,
      showExplanations: true,
      allowRetakes: true,
      visibility: "public",
    },
    stats: {
      isTournament: false,
      recentPlayers: [],
      plays: 1543,
      capacity: 2000,
      rating: 4.6,
      badge: {
        type: "trending",
        label: "Trending 📈",
      },
      rewardCents: 650,
      updatedAt: "2024-12-18T00:00:00.000Z",
    },
    author: {
      name: "MathWhiz",
      avatar: {
        src: "/avatars/genious.png",
        alt: "MathWhiz",
      },
    },
    cover: {
      src: "/math-puzzles-quiz.png",
      alt: "Mathematical Puzzles & Brain Teasers",
    },
  },
  {
    id: "quiz-world-of-fantasy-literature",
    kind: "quiz",
    slug: "world-of-fantasy-literature",
    title: "World of Fantasy Literature",
    summary:
      "Hobbits, talking lions and Discworld wizards — a tour of the books that built modern fantasy.",
    categoryIds: ["literature"],
    tags: [],
    difficulty: "medium",
    status: "published",
    questions: [
      {
        id: "quiz-world-of-fantasy-literature-q1",
        prompt: 'Who wrote "The Hobbit"?',
        options: [
          {
            id: "a",
            text: "C. S. Lewis",
          },
          {
            id: "b",
            text: "J. R. R. Tolkien",
          },
          {
            id: "c",
            text: "Terry Pratchett",
          },
          {
            id: "d",
            text: "Ursula K. Le Guin",
          },
        ],
        correctOptionId: "b",
        explanation: "Tolkien published it in 1937.",
      },
      {
        id: "quiz-world-of-fantasy-literature-q2",
        prompt: 'In "The Chronicles of Narnia", what is the name of the lion?',
        options: [
          {
            id: "a",
            text: "Aslan",
          },
          {
            id: "b",
            text: "Rumblebuffin",
          },
          {
            id: "c",
            text: "Tumnus",
          },
          {
            id: "d",
            text: "Caspian",
          },
        ],
        correctOptionId: "a",
        explanation: "Aslan is the Narnian creator figure in C. S. Lewis's series.",
      },
      {
        id: "quiz-world-of-fantasy-literature-q3",
        prompt: 'Who wrote "A Wizard of Earthsea"?',
        options: [
          {
            id: "a",
            text: "Robin Hobb",
          },
          {
            id: "b",
            text: "Ursula K. Le Guin",
          },
          {
            id: "c",
            text: "Philip Pullman",
          },
          {
            id: "d",
            text: "Neil Gaiman",
          },
        ],
        correctOptionId: "b",
        explanation: "Le Guin published it in 1968, starting the Earthsea cycle.",
      },
      {
        id: "quiz-world-of-fantasy-literature-q4",
        prompt: 'In "The Lord of the Rings", what must Frodo destroy?',
        options: [
          {
            id: "a",
            text: "The Silmarils",
          },
          {
            id: "b",
            text: "The One Ring",
          },
          {
            id: "c",
            text: "The Palantír",
          },
          {
            id: "d",
            text: "The Arkenstone",
          },
        ],
        correctOptionId: "b",
        explanation: "Only the fires of Mount Doom can unmake the One Ring.",
      },
      {
        id: "quiz-world-of-fantasy-literature-q5",
        prompt: "Who created the Discworld series?",
        options: [
          {
            id: "a",
            text: "Terry Pratchett",
          },
          {
            id: "b",
            text: "Douglas Adams",
          },
          {
            id: "c",
            text: "Terry Brooks",
          },
          {
            id: "d",
            text: "Robert Jordan",
          },
        ],
        correctOptionId: "a",
        explanation: '"The Colour of Magic" (1983) began the Discworld novels.',
      },
    ],
    settings: {
      timeLimitSeconds: 0,
      questionTimerSeconds: 0,
      passingScore: 70,
      shuffleQuestions: false,
      showExplanations: true,
      allowRetakes: true,
      visibility: "public",
    },
    stats: {
      isTournament: false,
      recentPlayers: [],
      plays: 1876,
      capacity: 2200,
      rating: 4.7,
      badge: {
        type: "hot",
        label: "Hot 🔥",
      },
      rewardCents: 700,
      limitedTimeEndsAt: "2025-01-01T12:00:00.000Z",
    },
    author: {
      name: "BookWorm",
      avatar: {
        src: "/avatars/mind.webp",
        alt: "BookWorm",
      },
    },
    cover: {
      src: "/classic-novels-quiz.png",
      alt: "World of Fantasy Literature",
    },
  },
  {
    id: "quiz-literature-classic-novels",
    kind: "quiz",
    slug: "literature-classic-novels",
    title: "Literature: Classic Novels",
    summary:
      "Openings, narrators and unforgettable captains from the novels that defined the canon.",
    categoryIds: ["literature"],
    tags: [],
    difficulty: "medium",
    status: "published",
    questions: [
      {
        id: "quiz-literature-classic-novels-q1",
        prompt: 'Who wrote "Pride and Prejudice"?',
        options: [
          {
            id: "a",
            text: "Charlotte Brontë",
          },
          {
            id: "b",
            text: "Jane Austen",
          },
          {
            id: "c",
            text: "George Eliot",
          },
          {
            id: "d",
            text: "Mary Shelley",
          },
        ],
        correctOptionId: "b",
        explanation: "Austen published it in 1813.",
      },
      {
        id: "quiz-literature-classic-novels-q2",
        prompt: 'Who narrates "To Kill a Mockingbird"?',
        options: [
          {
            id: "a",
            text: "Atticus Finch",
          },
          {
            id: "b",
            text: "Jem Finch",
          },
          {
            id: "c",
            text: "Scout Finch",
          },
          {
            id: "d",
            text: "Boo Radley",
          },
        ],
        correctOptionId: "c",
        explanation: 'Jean Louise "Scout" Finch tells the story as an adult looking back.',
      },
      {
        id: "quiz-literature-classic-novels-q3",
        prompt: 'Which Dickens novel opens "It was the best of times, it was the worst of times"?',
        options: [
          {
            id: "a",
            text: "Great Expectations",
          },
          {
            id: "b",
            text: "A Tale of Two Cities",
          },
          {
            id: "c",
            text: "Oliver Twist",
          },
          {
            id: "d",
            text: "Bleak House",
          },
        ],
        correctOptionId: "b",
        explanation: "The line opens the 1859 novel set in London and Paris.",
      },
      {
        id: "quiz-literature-classic-novels-q4",
        prompt: 'Who wrote "1984"?',
        options: [
          {
            id: "a",
            text: "Aldous Huxley",
          },
          {
            id: "b",
            text: "George Orwell",
          },
          {
            id: "c",
            text: "Ray Bradbury",
          },
          {
            id: "d",
            text: "Franz Kafka",
          },
        ],
        correctOptionId: "b",
        explanation: "Orwell's dystopia was published in 1949.",
      },
      {
        id: "quiz-literature-classic-novels-q5",
        prompt: 'In "Moby-Dick", what is the whaling captain\'s name?',
        options: [
          {
            id: "a",
            text: "Starbuck",
          },
          {
            id: "b",
            text: "Ahab",
          },
          {
            id: "c",
            text: "Ishmael",
          },
          {
            id: "d",
            text: "Queequeg",
          },
        ],
        correctOptionId: "b",
        explanation: "Captain Ahab hunts the white whale that took his leg.",
      },
    ],
    settings: {
      timeLimitSeconds: 0,
      questionTimerSeconds: 0,
      passingScore: 70,
      shuffleQuestions: false,
      showExplanations: true,
      allowRetakes: true,
      visibility: "public",
    },
    stats: {
      isTournament: false,
      recentPlayers: [],
      plays: 1298,
      capacity: 1500,
      rating: 4.9,
      badge: {
        type: "topRated",
        label: "Top Rated ⭐",
      },
      rewardCents: 500,
    },
    author: {
      name: "BookWorm",
      avatar: {
        src: "/avatars/mind.webp",
        alt: "BookWorm",
      },
    },
    cover: {
      src: "/classic-novels-quiz.png",
      alt: "Literature: Classic Novels",
    },
  },
  {
    id: "quiz-world-cup-football-history",
    kind: "quiz",
    slug: "world-cup-football-history",
    title: "World Cup Football History",
    summary:
      "Ninety years of the World Cup: hosts, winners and the tournaments that changed the game.",
    categoryIds: ["sports"],
    tags: [],
    difficulty: "medium",
    status: "published",
    questions: [
      {
        id: "quiz-world-cup-football-history-q1",
        prompt: "Which country has won the most FIFA World Cups?",
        options: [
          {
            id: "a",
            text: "Germany",
          },
          {
            id: "b",
            text: "Italy",
          },
          {
            id: "c",
            text: "Brazil",
          },
          {
            id: "d",
            text: "Argentina",
          },
        ],
        correctOptionId: "c",
        explanation: "Brazil has five titles: 1958, 1962, 1970, 1994 and 2002.",
      },
      {
        id: "quiz-world-cup-football-history-q2",
        prompt: "In which year was the first World Cup held?",
        options: [
          {
            id: "a",
            text: "1926",
          },
          {
            id: "b",
            text: "1930",
          },
          {
            id: "c",
            text: "1934",
          },
          {
            id: "d",
            text: "1938",
          },
        ],
        correctOptionId: "b",
        explanation: "Uruguay hosted and won the inaugural tournament in 1930.",
      },
      {
        id: "quiz-world-cup-football-history-q3",
        prompt: "Which country hosted the 2014 World Cup?",
        options: [
          {
            id: "a",
            text: "South Africa",
          },
          {
            id: "b",
            text: "Brazil",
          },
          {
            id: "c",
            text: "Russia",
          },
          {
            id: "d",
            text: "Germany",
          },
        ],
        correctOptionId: "b",
        explanation: "Brazil hosted in 2014 and lost 7–1 to Germany in the semi-final.",
      },
      {
        id: "quiz-world-cup-football-history-q4",
        prompt: "Who won the 2022 World Cup?",
        options: [
          {
            id: "a",
            text: "France",
          },
          {
            id: "b",
            text: "Brazil",
          },
          {
            id: "c",
            text: "Argentina",
          },
          {
            id: "d",
            text: "Croatia",
          },
        ],
        correctOptionId: "c",
        explanation: "Argentina beat France on penalties after a 3–3 final.",
      },
      {
        id: "quiz-world-cup-football-history-q5",
        prompt: "How many players from each team start a football match on the field?",
        options: [
          {
            id: "a",
            text: "9",
          },
          {
            id: "b",
            text: "10",
          },
          {
            id: "c",
            text: "11",
          },
          {
            id: "d",
            text: "12",
          },
        ],
        correctOptionId: "c",
        explanation: "Eleven per side, including the goalkeeper.",
      },
    ],
    settings: {
      timeLimitSeconds: 0,
      questionTimerSeconds: 0,
      passingScore: 70,
      shuffleQuestions: false,
      showExplanations: true,
      allowRetakes: true,
      visibility: "public",
    },
    stats: {
      isTournament: false,
      recentPlayers: [],
      plays: 2341,
      capacity: 3000,
      rating: 4.8,
      badge: {
        type: "popular",
        label: "Popular 👑",
      },
      rewardCents: 850,
    },
    author: {
      name: "SportsNut",
      avatar: {
        src: "/avatars/guru.png",
        alt: "SportsNut",
      },
    },
    cover: {
      src: "/sports-trivia-quiz.png",
      alt: "World Cup Football History",
    },
  },
  {
    id: "quiz-blockbuster-movies-trivia",
    kind: "quiz",
    slug: "blockbuster-movies-trivia",
    title: "Blockbuster Movies Trivia",
    summary:
      "Directors, quotes and box-office giants: five questions for people who quote films in daily life.",
    categoryIds: ["movies"],
    tags: [],
    difficulty: "easy",
    status: "published",
    questions: [
      {
        id: "quiz-blockbuster-movies-trivia-q1",
        prompt: 'Who directed "Jurassic Park" (1993)?',
        options: [
          {
            id: "a",
            text: "James Cameron",
          },
          {
            id: "b",
            text: "Steven Spielberg",
          },
          {
            id: "c",
            text: "Ridley Scott",
          },
          {
            id: "d",
            text: "George Lucas",
          },
        ],
        correctOptionId: "b",
        explanation: "Spielberg's adaptation of Michael Crichton's novel broke box-office records.",
      },
      {
        id: "quiz-blockbuster-movies-trivia-q2",
        prompt: "Which 1997 film is set aboard a doomed ocean liner?",
        options: [
          {
            id: "a",
            text: "Titanic",
          },
          {
            id: "b",
            text: "The Poseidon Adventure",
          },
          {
            id: "c",
            text: "Das Boot",
          },
          {
            id: "d",
            text: "Master and Commander",
          },
        ],
        correctOptionId: "a",
        explanation: 'James Cameron\'s "Titanic" won eleven Academy Awards.',
      },
      {
        id: "quiz-blockbuster-movies-trivia-q3",
        prompt: "Who played Iron Man in the Marvel Cinematic Universe?",
        options: [
          {
            id: "a",
            text: "Chris Evans",
          },
          {
            id: "b",
            text: "Chris Hemsworth",
          },
          {
            id: "c",
            text: "Robert Downey Jr.",
          },
          {
            id: "d",
            text: "Mark Ruffalo",
          },
        ],
        correctOptionId: "c",
        explanation: "Downey Jr. played Tony Stark from 2008 to 2019.",
      },
      {
        id: "quiz-blockbuster-movies-trivia-q4",
        prompt: '"May the Force be with you" comes from which franchise?',
        options: [
          {
            id: "a",
            text: "Star Trek",
          },
          {
            id: "b",
            text: "Star Wars",
          },
          {
            id: "c",
            text: "Dune",
          },
          {
            id: "d",
            text: "The Matrix",
          },
        ],
        correctOptionId: "b",
        explanation: "The line appears throughout the Star Wars saga from 1977 onward.",
      },
      {
        id: "quiz-blockbuster-movies-trivia-q5",
        prompt: 'Which studio produced "Toy Story"?',
        options: [
          {
            id: "a",
            text: "DreamWorks",
          },
          {
            id: "b",
            text: "Pixar",
          },
          {
            id: "c",
            text: "Illumination",
          },
          {
            id: "d",
            text: "Studio Ghibli",
          },
        ],
        correctOptionId: "b",
        explanation: '"Toy Story" (1995) was Pixar\'s first feature film.',
      },
    ],
    settings: {
      timeLimitSeconds: 0,
      questionTimerSeconds: 0,
      passingScore: 70,
      shuffleQuestions: false,
      showExplanations: true,
      allowRetakes: true,
      visibility: "public",
    },
    stats: {
      isTournament: false,
      recentPlayers: [],
      plays: 3102,
      capacity: 3500,
      rating: 4.9,
      badge: {
        type: "topRated",
        label: "Top Rated ⭐",
      },
      rewardCents: 950,
    },
    author: {
      name: "MovieBuff",
      avatar: {
        src: "/avatars/brain.png",
        alt: "MovieBuff",
      },
    },
    cover: {
      src: "/space-exploration-quiz.png",
      alt: "Blockbuster Movies Trivia",
    },
  },
  {
    id: "quiz-wonders-of-the-natural-world",
    kind: "quiz",
    slug: "wonders-of-the-natural-world",
    title: "Wonders of the Natural World",
    summary:
      "Reefs, canyons and rainbows — the natural features that make the planet worth travelling for.",
    categoryIds: ["science"],
    tags: [],
    difficulty: "easy",
    status: "published",
    questions: [
      {
        id: "quiz-wonders-of-the-natural-world-q1",
        prompt: "Which is the largest coral reef system on Earth?",
        options: [
          {
            id: "a",
            text: "The Red Sea Reef",
          },
          {
            id: "b",
            text: "The Great Barrier Reef",
          },
          {
            id: "c",
            text: "The Belize Barrier Reef",
          },
          {
            id: "d",
            text: "The Maldives Reef",
          },
        ],
        correctOptionId: "b",
        explanation: "It stretches more than 2,300 km off the Queensland coast.",
      },
      {
        id: "quiz-wonders-of-the-natural-world-q2",
        prompt: "The Grand Canyon lies in which US state?",
        options: [
          {
            id: "a",
            text: "Utah",
          },
          {
            id: "b",
            text: "Nevada",
          },
          {
            id: "c",
            text: "Arizona",
          },
          {
            id: "d",
            text: "Colorado",
          },
        ],
        correctOptionId: "c",
        explanation: "The Colorado River has cut the canyon in Arizona for millions of years.",
      },
      {
        id: "quiz-wonders-of-the-natural-world-q3",
        prompt: "What is the tallest mountain above sea level?",
        options: [
          {
            id: "a",
            text: "K2",
          },
          {
            id: "b",
            text: "Mount Everest",
          },
          {
            id: "c",
            text: "Denali",
          },
          {
            id: "d",
            text: "Kilimanjaro",
          },
        ],
        correctOptionId: "b",
        explanation: "Everest rises 8,849 m above sea level.",
      },
      {
        id: "quiz-wonders-of-the-natural-world-q4",
        prompt: "What causes a rainbow?",
        options: [
          {
            id: "a",
            text: "Reflection off clouds",
          },
          {
            id: "b",
            text: "Sunlight refracted and dispersed in water droplets",
          },
          {
            id: "c",
            text: "Air pressure changes",
          },
          {
            id: "d",
            text: "Lightning",
          },
        ],
        correctOptionId: "b",
        explanation: "Droplets act as prisms, spreading white light into its colours.",
      },
      {
        id: "quiz-wonders-of-the-natural-world-q5",
        prompt: "On which continent is the Sahara Desert?",
        options: [
          {
            id: "a",
            text: "Asia",
          },
          {
            id: "b",
            text: "Africa",
          },
          {
            id: "c",
            text: "Australia",
          },
          {
            id: "d",
            text: "South America",
          },
        ],
        correctOptionId: "b",
        explanation: "The Sahara covers much of northern Africa.",
      },
    ],
    settings: {
      timeLimitSeconds: 0,
      questionTimerSeconds: 0,
      passingScore: 70,
      shuffleQuestions: false,
      showExplanations: true,
      allowRetakes: true,
      visibility: "public",
    },
    stats: {
      isTournament: false,
      recentPlayers: [],
      plays: 1876,
      capacity: 2000,
      rating: 4.7,
      badge: {
        type: "popular",
        label: "Popular 👑",
      },
      rewardCents: 600,
    },
    author: {
      name: "NatureExplorer",
      avatar: {
        src: "/avatars/master.png",
        alt: "NatureExplorer",
      },
    },
    cover: {
      src: "/world-landmarks.png",
      alt: "Wonders of the Natural World",
    },
  },
  {
    id: "quiz-music-through-the-decades",
    kind: "quiz",
    slug: "music-through-the-decades",
    title: "Music Through the Decades",
    summary:
      "From Abbey Road to the King of Pop: the records and decades that still fill playlists.",
    categoryIds: ["music"],
    tags: [],
    difficulty: "easy",
    status: "published",
    questions: [
      {
        id: "quiz-music-through-the-decades-q1",
        prompt: 'Which band released the album "Abbey Road"?',
        options: [
          {
            id: "a",
            text: "The Rolling Stones",
          },
          {
            id: "b",
            text: "The Beatles",
          },
          {
            id: "c",
            text: "The Who",
          },
          {
            id: "d",
            text: "Pink Floyd",
          },
        ],
        correctOptionId: "b",
        explanation: "The Beatles released it in 1969.",
      },
      {
        id: "quiz-music-through-the-decades-q2",
        prompt: 'Who is known as the "King of Pop"?',
        options: [
          {
            id: "a",
            text: "Elvis Presley",
          },
          {
            id: "b",
            text: "Prince",
          },
          {
            id: "c",
            text: "Michael Jackson",
          },
          {
            id: "d",
            text: "Stevie Wonder",
          },
        ],
        correctOptionId: "c",
        explanation: "The nickname stuck after his 1980s solo albums.",
      },
      {
        id: "quiz-music-through-the-decades-q3",
        prompt: "Disco is most associated with which decade?",
        options: [
          {
            id: "a",
            text: "1950s",
          },
          {
            id: "b",
            text: "1960s",
          },
          {
            id: "c",
            text: "1970s",
          },
          {
            id: "d",
            text: "1990s",
          },
        ],
        correctOptionId: "c",
        explanation: "Disco peaked in the mid-to-late 1970s.",
      },
      {
        id: "quiz-music-through-the-decades-q4",
        prompt: 'Who composed "Für Elise"?',
        options: [
          {
            id: "a",
            text: "Mozart",
          },
          {
            id: "b",
            text: "Bach",
          },
          {
            id: "c",
            text: "Beethoven",
          },
          {
            id: "d",
            text: "Chopin",
          },
        ],
        correctOptionId: "c",
        explanation: "Beethoven wrote the bagatelle around 1810.",
      },
      {
        id: "quiz-music-through-the-decades-q5",
        prompt: "How many keys does a standard piano have?",
        options: [
          {
            id: "a",
            text: "66",
          },
          {
            id: "b",
            text: "76",
          },
          {
            id: "c",
            text: "88",
          },
          {
            id: "d",
            text: "96",
          },
        ],
        correctOptionId: "c",
        explanation: "52 white keys and 36 black keys make 88.",
      },
    ],
    settings: {
      timeLimitSeconds: 0,
      questionTimerSeconds: 0,
      passingScore: 70,
      shuffleQuestions: false,
      showExplanations: true,
      allowRetakes: true,
      visibility: "public",
    },
    stats: {
      isTournament: false,
      recentPlayers: [],
      plays: 210,
      capacity: 1000,
      rating: 4.5,
      badge: {
        type: "new",
        label: "New ✨",
      },
      rewardCents: 550,
    },
    author: {
      name: "MusicMaestro",
      avatar: {
        src: "/avatars/genious.png",
        alt: "MusicMaestro",
      },
    },
    cover: {
      src: "/music-quiz.png",
      alt: "Music Through the Decades",
    },
  },
  {
    id: "quiz-technology-gadgets",
    kind: "quiz",
    slug: "technology-gadgets",
    title: "Technology & Gadgets",
    summary:
      "The acronyms and origin stories behind the devices in your pocket, from CPU to USB-C.",
    categoryIds: ["technology"],
    tags: [],
    difficulty: "easy",
    status: "published",
    questions: [
      {
        id: "quiz-technology-gadgets-q1",
        prompt: "What does CPU stand for?",
        options: [
          {
            id: "a",
            text: "Central Processing Unit",
          },
          {
            id: "b",
            text: "Computer Power Unit",
          },
          {
            id: "c",
            text: "Core Program Utility",
          },
          {
            id: "d",
            text: "Central Program Unit",
          },
        ],
        correctOptionId: "a",
        explanation: "The CPU executes the instructions a program issues.",
      },
      {
        id: "quiz-technology-gadgets-q2",
        prompt: "Who co-founded Apple with Steve Jobs?",
        options: [
          {
            id: "a",
            text: "Bill Gates",
          },
          {
            id: "b",
            text: "Steve Wozniak",
          },
          {
            id: "c",
            text: "Paul Allen",
          },
          {
            id: "d",
            text: "Jack Dorsey",
          },
        ],
        correctOptionId: "b",
        explanation: "Wozniak designed the Apple I and II hardware.",
      },
      {
        id: "quiz-technology-gadgets-q3",
        prompt: "In which year did the first iPhone launch?",
        options: [
          {
            id: "a",
            text: "2005",
          },
          {
            id: "b",
            text: "2007",
          },
          {
            id: "c",
            text: "2009",
          },
          {
            id: "d",
            text: "2010",
          },
        ],
        correctOptionId: "b",
        explanation: "The original iPhone went on sale in June 2007.",
      },
      {
        id: "quiz-technology-gadgets-q4",
        prompt: "What does USB stand for?",
        options: [
          {
            id: "a",
            text: "Universal Serial Bus",
          },
          {
            id: "b",
            text: "Unified System Bridge",
          },
          {
            id: "c",
            text: "Universal Storage Block",
          },
          {
            id: "d",
            text: "User System Bus",
          },
        ],
        correctOptionId: "a",
        explanation: "USB replaced a thicket of serial and parallel ports.",
      },
      {
        id: "quiz-technology-gadgets-q5",
        prompt: "Which company maintains the Android operating system?",
        options: [
          {
            id: "a",
            text: "Samsung",
          },
          {
            id: "b",
            text: "Microsoft",
          },
          {
            id: "c",
            text: "Google",
          },
          {
            id: "d",
            text: "Nokia",
          },
        ],
        correctOptionId: "c",
        explanation: "Google acquired Android Inc. in 2005 and releases it as open source.",
      },
    ],
    settings: {
      timeLimitSeconds: 0,
      questionTimerSeconds: 0,
      passingScore: 70,
      shuffleQuestions: false,
      showExplanations: true,
      allowRetakes: true,
      visibility: "public",
    },
    stats: {
      isTournament: false,
      recentPlayers: [],
      plays: 175,
      capacity: 1000,
      rating: 4.6,
      badge: {
        type: "new",
        label: "New ✨",
      },
      rewardCents: 700,
    },
    author: {
      name: "TechGuru",
      avatar: {
        src: "/avatars/brain.png",
        alt: "TechGuru",
      },
    },
    cover: {
      src: "/technology-quiz.png",
      alt: "Technology & Gadgets",
    },
  },
  {
    id: "quiz-culinary-world-tour",
    kind: "quiz",
    slug: "culinary-world-tour",
    title: "Culinary World Tour",
    summary:
      "One dish at a time: the ingredients and home countries behind the world's most-ordered food.",
    categoryIds: ["food"],
    tags: [],
    difficulty: "easy",
    status: "published",
    questions: [
      {
        id: "quiz-culinary-world-tour-q1",
        prompt: "Sushi originated in which country?",
        options: [
          {
            id: "a",
            text: "China",
          },
          {
            id: "b",
            text: "Japan",
          },
          {
            id: "c",
            text: "Korea",
          },
          {
            id: "d",
            text: "Thailand",
          },
        ],
        correctOptionId: "b",
        explanation: "Modern sushi developed in Edo-period Japan.",
      },
      {
        id: "quiz-culinary-world-tour-q2",
        prompt: "What is the main ingredient in guacamole?",
        options: [
          {
            id: "a",
            text: "Tomato",
          },
          {
            id: "b",
            text: "Avocado",
          },
          {
            id: "c",
            text: "Cucumber",
          },
          {
            id: "d",
            text: "Mango",
          },
        ],
        correctOptionId: "b",
        explanation: "Avocado gives guacamole its body and colour.",
      },
      {
        id: "quiz-culinary-world-tour-q3",
        prompt: "Paella comes from which country?",
        options: [
          {
            id: "a",
            text: "Italy",
          },
          {
            id: "b",
            text: "Portugal",
          },
          {
            id: "c",
            text: "Spain",
          },
          {
            id: "d",
            text: "Mexico",
          },
        ],
        correctOptionId: "c",
        explanation: "It originates in Valencia, on Spain's east coast.",
      },
      {
        id: "quiz-culinary-world-tour-q4",
        prompt: "Which spice is harvested from the crocus flower?",
        options: [
          {
            id: "a",
            text: "Turmeric",
          },
          {
            id: "b",
            text: "Saffron",
          },
          {
            id: "c",
            text: "Cumin",
          },
          {
            id: "d",
            text: "Paprika",
          },
        ],
        correctOptionId: "b",
        explanation: "Saffron threads are the dried stigmas of Crocus sativus.",
      },
      {
        id: "quiz-culinary-world-tour-q5",
        prompt: "What is the primary ingredient in hummus?",
        options: [
          {
            id: "a",
            text: "Lentils",
          },
          {
            id: "b",
            text: "Chickpeas",
          },
          {
            id: "c",
            text: "White beans",
          },
          {
            id: "d",
            text: "Peas",
          },
        ],
        correctOptionId: "b",
        explanation: "Hummus is blended chickpeas, tahini, lemon and garlic.",
      },
    ],
    settings: {
      timeLimitSeconds: 0,
      questionTimerSeconds: 0,
      passingScore: 70,
      shuffleQuestions: false,
      showExplanations: true,
      allowRetakes: true,
      visibility: "public",
    },
    stats: {
      isTournament: false,
      recentPlayers: [],
      plays: 98,
      capacity: 1000,
      rating: 4.3,
      badge: {
        type: "new",
        label: "New ✨",
      },
      rewardCents: 450,
    },
    author: {
      name: "FoodieChef",
      avatar: {
        src: "/avatars/alex.png",
        alt: "FoodieChef",
      },
    },
    cover: {
      src: "/easy-quiz-1.png",
      alt: "Culinary World Tour",
    },
  },
  {
    id: "quiz-artistic-masterpieces",
    kind: "quiz",
    slug: "artistic-masterpieces",
    title: "Artistic Masterpieces",
    summary: "Painters, sculptors and movements: match the masterpiece to the hand that made it.",
    categoryIds: ["art"],
    tags: [],
    difficulty: "medium",
    status: "published",
    questions: [
      {
        id: "quiz-artistic-masterpieces-q1",
        prompt: "Who painted the Mona Lisa?",
        options: [
          {
            id: "a",
            text: "Michelangelo",
          },
          {
            id: "b",
            text: "Raphael",
          },
          {
            id: "c",
            text: "Leonardo da Vinci",
          },
          {
            id: "d",
            text: "Titian",
          },
        ],
        correctOptionId: "c",
        explanation: "Leonardo painted it in Florence around 1503–1519.",
      },
      {
        id: "quiz-artistic-masterpieces-q2",
        prompt: 'Who painted "The Starry Night"?',
        options: [
          {
            id: "a",
            text: "Claude Monet",
          },
          {
            id: "b",
            text: "Vincent van Gogh",
          },
          {
            id: "c",
            text: "Paul Cézanne",
          },
          {
            id: "d",
            text: "Edvard Munch",
          },
        ],
        correctOptionId: "b",
        explanation: "Van Gogh painted it in 1889 while at Saint-Rémy.",
      },
      {
        id: "quiz-artistic-masterpieces-q3",
        prompt: 'Which artist painted melting clocks in "The Persistence of Memory"?',
        options: [
          {
            id: "a",
            text: "Salvador Dalí",
          },
          {
            id: "b",
            text: "Pablo Picasso",
          },
          {
            id: "c",
            text: "Joan Miró",
          },
          {
            id: "d",
            text: "René Magritte",
          },
        ],
        correctOptionId: "a",
        explanation: "Dalí's 1931 canvas is a landmark of Surrealism.",
      },
      {
        id: "quiz-artistic-masterpieces-q4",
        prompt: 'Who sculpted "David" in marble?',
        options: [
          {
            id: "a",
            text: "Donatello",
          },
          {
            id: "b",
            text: "Bernini",
          },
          {
            id: "c",
            text: "Michelangelo",
          },
          {
            id: "d",
            text: "Rodin",
          },
        ],
        correctOptionId: "c",
        explanation: "Michelangelo carved it between 1501 and 1504 in Florence.",
      },
      {
        id: "quiz-artistic-masterpieces-q5",
        prompt: "Claude Monet was a founder of which movement?",
        options: [
          {
            id: "a",
            text: "Cubism",
          },
          {
            id: "b",
            text: "Impressionism",
          },
          {
            id: "c",
            text: "Expressionism",
          },
          {
            id: "d",
            text: "Baroque",
          },
        ],
        correctOptionId: "b",
        explanation: '"Impression, Sunrise" gave the movement its name in 1874.',
      },
    ],
    settings: {
      timeLimitSeconds: 0,
      questionTimerSeconds: 0,
      passingScore: 70,
      shuffleQuestions: false,
      showExplanations: true,
      allowRetakes: true,
      visibility: "public",
    },
    stats: {
      isTournament: false,
      recentPlayers: [],
      plays: 87,
      capacity: 1000,
      rating: 4.2,
      badge: {
        type: "new",
        label: "New ✨",
      },
      rewardCents: 400,
    },
    author: {
      name: "ArtLover",
      avatar: {
        src: "/avatars/sarah.webp",
        alt: "ArtLover",
      },
    },
    cover: {
      src: "/easy-quiz-2.png",
      alt: "Artistic Masterpieces",
    },
  },
  {
    id: "quiz-famous-inventors-discoveries",
    kind: "quiz",
    slug: "famous-inventors-discoveries",
    title: "Famous Inventors & Discoveries",
    summary:
      "The patents, accidents and experiments that changed daily life — and the people behind them.",
    categoryIds: ["history", "science"],
    tags: [],
    difficulty: "medium",
    status: "published",
    questions: [
      {
        id: "quiz-famous-inventors-discoveries-q1",
        prompt: "Who is credited with inventing the telephone?",
        options: [
          {
            id: "a",
            text: "Thomas Edison",
          },
          {
            id: "b",
            text: "Alexander Graham Bell",
          },
          {
            id: "c",
            text: "Nikola Tesla",
          },
          {
            id: "d",
            text: "Guglielmo Marconi",
          },
        ],
        correctOptionId: "b",
        explanation: "Bell received the first US patent for the telephone in 1876.",
      },
      {
        id: "quiz-famous-inventors-discoveries-q2",
        prompt: "Who discovered penicillin?",
        options: [
          {
            id: "a",
            text: "Louis Pasteur",
          },
          {
            id: "b",
            text: "Alexander Fleming",
          },
          {
            id: "c",
            text: "Robert Koch",
          },
          {
            id: "d",
            text: "Joseph Lister",
          },
        ],
        correctOptionId: "b",
        explanation: "Fleming noticed mould killing bacteria on a plate in 1928.",
      },
      {
        id: "quiz-famous-inventors-discoveries-q3",
        prompt: "Who developed the theory of general relativity?",
        options: [
          {
            id: "a",
            text: "Isaac Newton",
          },
          {
            id: "b",
            text: "Niels Bohr",
          },
          {
            id: "c",
            text: "Albert Einstein",
          },
          {
            id: "d",
            text: "Max Planck",
          },
        ],
        correctOptionId: "c",
        explanation: "Einstein published it in 1915.",
      },
      {
        id: "quiz-famous-inventors-discoveries-q4",
        prompt: "Who introduced movable-type printing to Europe?",
        options: [
          {
            id: "a",
            text: "Johannes Gutenberg",
          },
          {
            id: "b",
            text: "William Caxton",
          },
          {
            id: "c",
            text: "Aldus Manutius",
          },
          {
            id: "d",
            text: "Nicolaus Copernicus",
          },
        ],
        correctOptionId: "a",
        explanation: "Gutenberg's press produced its famous Bible around 1455.",
      },
      {
        id: "quiz-famous-inventors-discoveries-q5",
        prompt: "Which element did Marie Curie name after her homeland?",
        options: [
          {
            id: "a",
            text: "Radium",
          },
          {
            id: "b",
            text: "Polonium",
          },
          {
            id: "c",
            text: "Francium",
          },
          {
            id: "d",
            text: "Curium",
          },
        ],
        correctOptionId: "b",
        explanation: "She named polonium after Poland in 1898.",
      },
    ],
    settings: {
      timeLimitSeconds: 0,
      questionTimerSeconds: 0,
      passingScore: 70,
      shuffleQuestions: false,
      showExplanations: true,
      allowRetakes: true,
      visibility: "public",
    },
    stats: {
      isTournament: false,
      recentPlayers: [],
      plays: 112,
      capacity: 1000,
      rating: 4.4,
      badge: {
        type: "new",
        label: "New ✨",
      },
      rewardCents: 500,
    },
    author: {
      name: "ScienceGeek",
      avatar: {
        src: "/avatars/wizard.webp",
        alt: "ScienceGeek",
      },
    },
    cover: {
      src: "/easy-quiz-3.png",
      alt: "Famous Inventors & Discoveries",
    },
  },
];
