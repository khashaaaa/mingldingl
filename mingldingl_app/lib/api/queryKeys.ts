// Single source of truth for React Query keys. Several keys are shared or
// invalidated across hook files (e.g. useMilestones invalidates the `items`
// prefix that useInventory owns; useDiscover writes directly into the
// `matches` cache that useMatches owns) — centralizing them here turns that
// cross-file coupling into a compiler-checked reference instead of
// hand-typed string literals that can silently drift apart.
export const queryKeys = {
  quiz: ['quiz'] as const,
  quizSubmit: (matchId: string, quizId?: string) => ['quizSubmit', matchId, quizId] as const,
  quizStatus: (matchId: string, quizId?: string) => ['quizStatus', matchId, quizId] as const,
  milestones: ['milestones'] as const,
  messages: (matchId: string) => ['messages', matchId] as const,
  discover: ['discover'] as const,
  discoverSeen: ['discover:seen'] as const,
  icebreaker: (matchId: string) => ['icebreaker', matchId] as const,
  icebreakerReveal: (matchId: string, questionId?: string) => ['icebreakerReveal', matchId, questionId] as const,
  icebreakerStatus: (matchId: string, questionId?: string) => ['icebreakerStatus', matchId, questionId] as const,
  membership: ['membership', 'me'] as const,
  membershipTiers: ['membership', 'tiers'] as const,
  items: ['items'] as const,
  itemsMine: ['items', 'mine'] as const,
  activitySuggestions: (matchId: string) => ['activitySuggestions', matchId] as const,
  attendanceCheck: (matchId: string) => ['attendanceCheck', matchId] as const,
  activity: ['activity'] as const,
  myTrophies: ['myTrophies'] as const,
  businessReviews: (businessId: string) => ['businessReviews', businessId] as const,
  quests: ['quests'] as const,
  questsToday: ['quests', 'today'] as const,
  matches: ['matches'] as const,
  userProfile: ['userProfile'] as const,
  scoreDetail: ['scoreDetail'] as const,
  scoreHistory: ['scoreHistory'] as const,
  leaderboard: ['leaderboard'] as const,
  tierThresholds: ['tierThresholds'] as const,
  geoCities: ['geoCities'] as const,
  blockedUsers: ['blockedUsers'] as const,
  contentPage: (slug: string) => ['contentPage', slug] as const,
  townSquareNextSession: ['townSquareNextSession'] as const,
  townSquareCurrentRound: (sessionId: string) => ['townSquareCurrentRound', sessionId] as const,
  pendingShips: ['pendingShips'] as const,
};
