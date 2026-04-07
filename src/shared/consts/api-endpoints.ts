// ---------------------------------------------------------------------------
// API Endpoints
//
// 모든 API 경로 상수를 중앙화한다. Service 레이어 / MSW 핸들러 / 테스트가
// 같은 상수를 참조하여 경로 오타로 인한 불일치를 방지한다.
// ---------------------------------------------------------------------------

export const CAMPAIGN_API = {
  LIST: "/api/campaigns",
  CREATE: "/api/campaigns",
  UPDATE_STATUS: (id: string) => `/api/campaigns/${id}/status`,
} as const;

export const DAILY_STATS_API = {
  LIST: "/api/daily-stats",
} as const;
