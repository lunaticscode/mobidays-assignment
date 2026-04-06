export const CAMPAIGN_API = {
  LIST: "/api/campaigns",
  BY_ID: (id: string) => `/api/campaigns/${id}`,
  STATUS: (id: string) => `/api/campaigns/${id}/status`,
} as const;

export const DAILY_STAT_API = {
  LIST: "/api/daily-stats",
  BY_CAMPAIGN: (campaignId: string) =>
    `/api/daily-stats?campaignId=${campaignId}`,
} as const;
