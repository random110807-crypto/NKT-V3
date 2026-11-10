// NKT sidebar configuration. Update values here; core rendering code stays unchanged.
export const CONFIG = {
  clubSlug: "nashediyon-ki-toli-nkt",
  clubUrl: "https://www.chess.com/club/nashediyon-ki-toli-nkt",
  apiBase: "https://api.chess.com/pub",
  cacheTtlMs: 30 * 60 * 1000,
  recentMemberCount: 3,

  // Asset paths are relative to the project root.
  clubLogoPath: "assets/images/nkt-club-logo.png",
  sidebarBackgroundPath: "assets/images/nkt-sidebar-background.jpg",
  links: {
    feedback: "",          // Google Form URL
    adminApplication: "",  // Google Form URL
    clubCompetitions: "https://www.chess.com/clubs/matches/nashediyon-ki-toli-nkt",
    interestingForums: "https://www.chess.com/clubs/forum/nashediyon-ki-toli-nkt"
  },

  // Set true only while previewing. Demo records are visibly marked DEMO.
  DEMO_MODE: false,

  // Manual club awards and leaderboards. Empty arrays/null values are hidden.
  // Each leaderboard row: { name, username, points }.
  clubhouse: {
    // Manual MCA standings. Leave [] to keep the section completely hidden.
    // Add rows like: { username: "chesscom_username", points: 120, name: "Optional display name" }.
    mcaLeaderboard: [],
    voteChessLeaderboard: [],
    overallLeaderboard: [],
    memberOfTheMonth: null, // { name, username, avatar?, achievement? }
    gameOfTheMonth: null,   // { name, username, opponent?, gameUrl?, achievement? }
    mostImprovedMember: null // { name, username, improvement?, achievement? }
  },

  // Up to three. Dates should be ISO 8601 with timezone, e.g. 2026-12-01T18:30:00+05:30.
  // Optional: banner, startAt, endAt, status, joinUrl, eventUrl.
  featuredCompetitions: [],

  tracks: [
    { title: "The First Move", file: "assets/music/01-the-first-move.mp3" },
    { title: "Midnight Gambit", file: "assets/music/02-midnight-gambit.mp3" },
    { title: "Quiet Calculations", file: "assets/music/03-quiet-calculations.mp3" },
    { title: "The King's March", file: "assets/music/04-the-kings-march.mp3" },
    { title: "After the Checkmate", file: "assets/music/05-after-the-checkmate.mp3" }
  ]
};
