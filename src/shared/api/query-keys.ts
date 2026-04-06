import type { GlobalFilterState } from "@/types";

export const queryKeys = {
  campaign: {
    all: () => ["campaign"] as const,
    list: (filters?: GlobalFilterState) =>
      [...queryKeys.campaign.all(), "list", filters] as const,
    detail: (id: string) =>
      [...queryKeys.campaign.all(), "detail", id] as const,
  },
  dailyStat: {
    all: () => ["dailyStat"] as const,
    list: (filters?: GlobalFilterState) =>
      [...queryKeys.dailyStat.all(), "list", filters] as const,
    byCampaign: (campaignId: string) =>
      [...queryKeys.dailyStat.all(), "byCampaign", campaignId] as const,
  },
} as const;
