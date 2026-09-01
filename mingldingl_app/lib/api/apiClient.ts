import { api, UPLOAD_TIMEOUT_MS } from './api';
import type { components } from './api.generated';
import type { Oath } from '../../models/user';

type Schemas = components['schemas'];

function query(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const apiClient = {
  health: {
    get: () => api.get<Schemas['HealthResponse']>('/health').then((r) => r.data),
  },
  content: {
    get: (slug: string) => api.get<Schemas['ContentPageResponse']>(`/content/${slug}`).then((r) => r.data),
  },
  push: {
    register: (token: string, platform: string) =>
      api.post('/push/register', { token, platform }).then((r) => r.data),
    unregister: (token: string) =>
      api.post('/push/unregister', { token }).then((r) => r.data),
  },
  photos: {
    upload: (blob: Blob, filename: string) => {
      const form = new FormData();
      form.append('file', blob, filename);
      return api
        .post<Schemas['PhotoUploadResponse']>('/photos/upload', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: UPLOAD_TIMEOUT_MS,
        })
        .then((r) => r.data);
    },
    uploadUri: (uri: string, filename: string) => {
      const form = new FormData();
      form.append('file', { uri, name: filename, type: 'image/jpeg' } as unknown as Blob);
      return api
        .post<Schemas['PhotoUploadResponse']>('/photos/upload', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: UPLOAD_TIMEOUT_MS,
        })
        .then((r) => r.data);
    },
  },
  auth: {
    /** Starts verify.mn phone verification. Anonymous — runs before the user has a session. */
    startPhoneVerification: (phone: string) =>
      api.post<Schemas['StartPhoneVerificationResponse']>('/auth/phone/start', { phone }).then((r) => r.data),
    phoneVerificationStatus: (verificationId: string) =>
      api.get<Schemas['PhoneVerificationStatusResponse']>(`/auth/phone/status/${verificationId}`).then((r) => r.data),
    /** Binds a verified number to the signed-in identity. Requires the Supabase JWT. */
    claimPhoneVerification: (verificationId: string) =>
      api.post<Schemas['ClaimPhoneVerificationResponse']>('/auth/phone/claim', { verificationId }).then((r) => r.data),
  },
  users: {
    upsert: (body: Schemas['CreateUserRequest']) =>
      api.post<Schemas['UserResponse']>('/users', body).then((r) => r.data),
    me: () => api.get<Schemas['UserResponse']>('/users/me').then((r) => r.data),
    update: (body: Schemas['UpdateUserRequest']) =>
      api.put<Schemas['UserResponse']>('/users/me', body).then((r) => r.data),
    updateLocation: (latitude: number, longitude: number) =>
      api.post<Schemas['UpdateLocationResponse']>('/users/me/location', { latitude, longitude }).then((r) => r.data),
    requestDeletion: () => api.post<Schemas['UserResponse']>('/users/me/delete').then((r) => r.data),
    blockedUsers: () => api.get<Schemas['BlockedUserResponse'][]>('/users/me/blocked').then((r) => r.data),
    unblock: (targetUserId: string) =>
      api.post<Schemas['BlockedUserResponse'][]>(`/users/me/blocked/${targetUserId}/unblock`).then((r) => r.data),
    changePhone: (phoneNumber: string, verificationId: string) =>
      api.put<Schemas['UserResponse']>('/users/me/phone', { phoneNumber, verificationId }).then((r) => r.data),
    swearOath: (oath: Oath) =>
      api.post<Schemas['UserResponse']>('/users/me/oath', { oath } satisfies Schemas['SwearOathRequest']).then((r) => r.data),
  },
  geo: {
    nearestCity: (latitude: number, longitude: number) =>
      api.get<Schemas['NearestCityResponse']>(`/geo/nearest-city${query({ latitude, longitude })}`).then((r) => r.data),
    cities: () => api.get<Schemas['CitiesResponse']>('/geo/cities').then((r) => r.data),
  },
  scores: {
    me: () => api.get<Schemas['ScoreResponse']>('/scores/me').then((r) => r.data),
    dailyLogin: () => api.post<Schemas['DailyLoginResponse']>('/scores/daily-login').then((r) => r.data),
    detail: () => api.get<Schemas['ScoreDetailResponse']>('/scores/me/detail').then((r) => r.data),
    history: (cursor?: string, cursorId?: string, pageSize = 20) =>
      api.get<Schemas['ScoreHistoryResponse']>(`/scores/me/history${query({ cursor, cursorId, pageSize })}`).then((r) => r.data),
    leaderboard: () => api.get<Schemas['LeaderboardResponse']>('/scores/leaderboard').then((r) => r.data),
    tiers: () => api.get<Schemas['TierThresholdsResponse']>('/scores/tiers').then((r) => r.data),
    ackNotification: (kind: 'referral' | 'ship') =>
      api.post('/scores/me/notifications/ack', { kind }).then((r) => r.data),
  },
  membership: {
    tiers: () => api.get<Schemas['MembershipTierResponse'][]>('/membership/tiers').then((r) => r.data),
    me: () => api.get<Schemas['MembershipMeResponse']>('/membership/me').then((r) => r.data),
    upgrade: (level: string, durationMonths: number) =>
      api.post<Schemas['MembershipMeResponse']>('/membership/upgrade', { level, durationMonths }).then((r) => r.data),
  },
  matches: {
    candidates: (page = 1, pageSize?: number) =>
      api.get<Schemas['CandidateResponsePagedResponse']>(`/matches/candidates${query({ page, pageSize })}`).then((r) => r.data),
    request: (targetUserId: string) =>
      api.post<Schemas['CreateMatchResponse']>('/matches', { targetUserId }).then((r) => r.data),
    list: (page = 1, pageSize?: number) =>
      api.get<Schemas['MatchResponsePagedResponse']>(`/matches${query({ page, pageSize })}`).then((r) => r.data),
    ghostCheck: (id: string) =>
      api.post<Schemas['GhostCheckResponse']>(`/matches/${id}/ghost-check`).then((r) => r.data),
    unmatch: (id: string) =>
      api.post<Schemas['UnmatchResponse']>(`/matches/${id}/unmatch`).then((r) => r.data),
    block: (id: string) =>
      api.post<Schemas['UnmatchResponse']>(`/matches/${id}/block`).then((r) => r.data),
    campaign: (id: string) =>
      api.get<Schemas['CampaignResponse']>(`/matches/${id}/campaign`).then((r) => r.data),
    claimCampaignRoom: (id: string, roomId: string) =>
      api.post<Schemas['ClaimCampaignRoomResponse']>(`/matches/${id}/campaign/rooms/${roomId}/claim`).then((r) => r.data),
  },
  ships: {
    create: (slotAPhoneNumber: string, slotBPhoneNumber: string) =>
      api.post<Schemas['CreateShipResponse']>('/ships', { slotAPhoneNumber, slotBPhoneNumber }).then((r) => r.data),
    pending: () => api.get<Schemas['PendingShipResponse'][]>('/ships/pending').then((r) => r.data),
    respond: (shipId: string, accept: boolean) =>
      api.post<Schemas['RespondToShipResponse']>(`/ships/${shipId}/respond`, { accept }).then((r) => r.data),
  },
  business: {
    list: (params?: { city?: string; category?: string; page?: number; pageSize?: number }) =>
      api.get<Schemas['BusinessResponsePagedResponse']>(`/business${query({ ...params })}`).then((r) => r.data),
    rate: (id: string, matchId: string, body: Schemas['RateBusinessRequest']) =>
      api.post<Schemas['RateBusinessResponse']>(`/business/${id}/rate${query({ matchId })}`, body).then((r) => r.data),
    reviews: (id: string) =>
      api.get<Schemas['BusinessReviewResponse'][]>(`/business/${id}/reviews`).then((r) => r.data),
  },
  engagement: {
    icebreaker: (matchId: string) =>
      api.get<Schemas['IcebreakerQuestionResponse']>(`/engagement/icebreaker/${matchId}`).then((r) => r.data),
    icebreakerRespond: (matchId: string, body: Schemas['IcebreakerRespondDto']) =>
      api.post<Schemas['IcebreakerRespondResult']>(`/engagement/icebreaker/${matchId}/respond`, body).then((r) => r.data),
    icebreakerReveal: (matchId: string, icebreakerId: string) =>
      api.get<Schemas['IcebreakerRevealEntry'][]>(`/engagement/icebreaker/${matchId}/reveal${query({ icebreakerId })}`).then((r) => r.data),
    icebreakerStatus: (matchId: string, icebreakerId: string) =>
      api.get<Schemas['IcebreakerStatusResponse']>(`/engagement/icebreaker/${matchId}/status${query({ icebreakerId })}`).then((r) => r.data),
    /** matchId keeps the pick stable per match, so both participants answer the same quiz. */
    quiz: (matchId: string) =>
      api.get<Schemas['QuizDetailsResponse']>(`/engagement/quiz${query({ matchId })}`).then((r) => r.data),
    quizRespond: (quizId: string, body: Schemas['QuizRespondDto']) =>
      api.post<Schemas['QuizCompatibilityResponse']>(`/engagement/quiz/${quizId}/respond`, body).then((r) => r.data),
    quizStatus: (quizId: string, matchId: string) =>
      api.get<Schemas['QuizStatusResponse']>(`/engagement/quiz/${quizId}/status${query({ matchId })}`).then((r) => r.data),
  },
  activities: {
    suggestions: (matchId: string) =>
      api.get<Schemas['ActivitySuggestionResponse'][]>(`/activities/${matchId}/suggestions`).then((r) => r.data),
    confirm: (matchId: string, body: Schemas['ConfirmDateDto']) =>
      api.post<Schemas['ConfirmDateResponse']>(`/activities/${matchId}/confirm`, body).then((r) => r.data),
    mine: () => api.get<Schemas['TrophyResponse'][]>('/activities/mine').then((r) => r.data),
    attendanceCheckStatus: (matchId: string) =>
      api.get<Schemas['AttendanceCheckStatusResponse']>(`/activities/${matchId}/attendance-check`).then((r) => r.data),
    attendanceCheckSubmit: (matchId: string, body: Schemas['AttendanceCheckRequestDto']) =>
      api.post<Schemas['AttendanceCheckResponse']>(`/activities/${matchId}/attendance-check`, body).then((r) => r.data),
  },
  video: {
    token: (matchId: string) =>
      api.post<Schemas['VideoTokenResponse']>('/video/token', { matchId }).then((r) => r.data),
    complete: (matchId: string) =>
      api.post<Schemas['VideoCompleteResponse']>('/video/complete', { matchId }).then((r) => r.data),
    ritePropose: (matchId: string) =>
      api.post<Schemas['FlameRiteStateResponse']>('/video/rite/propose', { matchId }).then((r) => r.data),
    riteAccept: (matchId: string) =>
      api.post<Schemas['FlameRiteStateResponse']>('/video/rite/accept', { matchId }).then((r) => r.data),
    riteDecline: (matchId: string) =>
      api.post<Schemas['FlameRiteStateResponse']>('/video/rite/decline', { matchId }).then((r) => r.data),
  },
  messages: {
    list: (matchId: string, opts: { before?: string; limit?: number } = {}) =>
      api.get<Schemas['MessageResponse'][]>(`/matches/${matchId}/messages${query(opts)}`).then((r) => r.data),
    send: (matchId: string, content: string) =>
      api.post<Schemas['SendMessageResponse']>(`/matches/${matchId}/messages`, { content }).then((r) => r.data),
  },
  quests: {
    today: () => api.get<Schemas['QuestBoardResponse']>('/engagement/quests/today').then((r) => r.data),
    claimChest: () => api.post<Schemas['ClaimChestResponse']>('/engagement/quests/claim-chest').then((r) => r.data),
  },
  items: {
    mine: () => api.get<Schemas['OwnedItemResponse'][]>('/users/me/items').then((r) => r.data),
    equip: (itemId: string) =>
      api.post<Schemas['UserResponse']>(`/users/me/items/${itemId}/equip`).then((r) => r.data),
  },
  milestones: {
    list: () => api.get<Schemas['MilestoneResponse'][]>('/engagement/milestones').then((r) => r.data),
    open: (id: string) =>
      api.post<Schemas['OpenMilestoneResponse']>(`/engagement/milestones/${id}/open`).then((r) => r.data),
  },
  townSquare: {
    nextSession: () => api.get<Schemas['NextSessionResponse']>('/townsquare/next-session').then((r) => r.data),
    rsvp: (sessionId: string) =>
      api.post('/townsquare/rsvp', { sessionId } satisfies Schemas['TownSquareRsvpDto']).then((r) => r.data),
    cancelRsvp: (sessionId: string) =>
      api.delete(`/townsquare/rsvp${query({ sessionId })}`).then((r) => r.data),
    currentRound: (sessionId: string) =>
      api.get<Schemas['CurrentRoundResponse']>(`/townsquare/session/${sessionId}/current-round`).then((r) => r.data),
    joined: (pairingId: string) =>
      api.post(`/townsquare/pairing/${pairingId}/joined`).then((r) => r.data),
    respond: (pairingId: string, response: string) =>
      api
        .post<Schemas['TownSquareRespondResult']>(`/townsquare/pairing/${pairingId}/respond`, {
          response,
        } satisfies Schemas['TownSquareRespondDto'])
        .then((r) => r.data),
  },
};
