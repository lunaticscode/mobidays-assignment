// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";

import { apiClient } from "@/libs/api-client";
import { CAMPAIGN_API, DAILY_STATS_API } from "@/shared/consts/api-endpoints";

// ---------------------------------------------------------------------------
// 응답 형태 (handlers.ts 와 동일)
// ---------------------------------------------------------------------------

type CampaignStatus = "active" | "paused" | "ended";
type Platform = "Google" | "Meta" | "Naver";

interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  platform: Platform;
  budget: number;
  startDate: string;
  endDate: string;
}

interface DailyStat {
  id: string;
  campaignId: string;
  date: string;
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
  conversionsValue: number;
}

interface CampaignsResponse {
  campaigns: Campaign[];
  total: number;
}

interface DailyStatsResponse {
  dailyStats: DailyStat[];
  total: number;
}

interface CampaignResponse {
  campaign: Campaign;
}

// ---------------------------------------------------------------------------
// GET /api/campaigns
// ---------------------------------------------------------------------------

describe("GET /api/campaigns", () => {
  it("정규화 후 80건이 모두 살아있고, status/platform 에 spec 외 값이 없다", async () => {
    const data = await apiClient.get<CampaignsResponse>(CAMPAIGN_API.LIST);

    expect(data.total).toBe(80);
    expect(data.campaigns).toHaveLength(80);

    const validStatuses = new Set(["active", "paused", "ended"]);
    const validPlatforms = new Set(["Google", "Meta", "Naver"]);
    for (const c of data.campaigns) {
      expect(validStatuses.has(c.status)).toBe(true);
      expect(validPlatforms.has(c.platform)).toBe(true);
      expect(c.name).not.toBeNull();
      expect(typeof c.budget).toBe("number");
      expect(c.startDate.includes("/")).toBe(false);
    }
  });

  it("status / platform 다중 필터를 AND 조합한다", async () => {
    const data = await apiClient.get<CampaignsResponse>(CAMPAIGN_API.LIST, {
      query: {
        status: ["active", "paused"],
        platform: ["Google"],
      },
    });

    expect(data.campaigns.length).toBeGreaterThan(0);
    for (const c of data.campaigns) {
      expect(["active", "paused"]).toContain(c.status);
      expect(c.platform).toBe("Google");
    }
  });

  it("기간 필터는 캠페인 집행기간과 겹치는(overlap) 캠페인을 반환한다", async () => {
    const startDate = "2026-04-01";
    const endDate = "2026-04-30";
    const data = await apiClient.get<CampaignsResponse>(CAMPAIGN_API.LIST, {
      query: { startDate, endDate },
    });

    expect(data.campaigns.length).toBeGreaterThan(0);
    for (const c of data.campaigns) {
      // overlap: c.endDate >= startDate && c.startDate <= endDate
      expect(c.endDate >= startDate).toBe(true);
      expect(c.startDate <= endDate).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// POST /api/campaigns
// ---------------------------------------------------------------------------

describe("POST /api/campaigns", () => {
  it("신규 캠페인을 생성하고 status='active' 와 자동 id 를 부여한다", async () => {
    const beforeList = await apiClient.get<CampaignsResponse>(
      CAMPAIGN_API.LIST,
    );
    const before = beforeList.total;

    const created = await apiClient.post<CampaignResponse>(
      CAMPAIGN_API.CREATE,
      {
        name: "신규 테스트 캠페인",
        platform: "Meta",
        budget: 1_000_000,
        startDate: "2026-05-01",
        endDate: "2026-05-31",
      },
    );

    expect(created.campaign.id).toEqual(expect.any(String));
    expect(created.campaign.id.length).toBeGreaterThan(0);
    expect(created.campaign.status).toBe("active");
    expect(created.campaign.platform).toBe("Meta");

    const afterList = await apiClient.get<CampaignsResponse>(CAMPAIGN_API.LIST);
    expect(afterList.total).toBe(before + 1);
    expect(
      afterList.campaigns.find((c) => c.id === created.campaign.id),
    ).toBeDefined();
  });

  it("필수값 누락 시 400 을 반환한다", async () => {
    await expect(
      apiClient.post(CAMPAIGN_API.CREATE, {
        platform: "Google",
        startDate: "2026-05-01",
        endDate: "2026-05-31",
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("유효하지 않은 platform 은 400 을 반환한다", async () => {
    await expect(
      apiClient.post(CAMPAIGN_API.CREATE, {
        name: "잘못된 플랫폼",
        platform: "TikTok",
        budget: 100,
        startDate: "2026-05-01",
        endDate: "2026-05-31",
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/campaigns/:id/status
// ---------------------------------------------------------------------------

describe("PATCH /api/campaigns/:id/status", () => {
  let targetId: string;

  beforeEach(async () => {
    const list = await apiClient.get<CampaignsResponse>(CAMPAIGN_API.LIST);
    targetId = list.campaigns[0]!.id;
  });

  it("상태를 변경하고 변경된 캠페인을 반환한다", async () => {
    const res = await apiClient.patch<CampaignResponse>(
      CAMPAIGN_API.UPDATE_STATUS(targetId),
      { status: "paused" },
    );
    expect(res.campaign.id).toBe(targetId);
    expect(res.campaign.status).toBe("paused");

    // 후속 GET 에도 반영
    const list = await apiClient.get<CampaignsResponse>(CAMPAIGN_API.LIST);
    const updated = list.campaigns.find((c) => c.id === targetId);
    expect(updated?.status).toBe("paused");
  });

  it("존재하지 않는 id 는 404 를 반환한다", async () => {
    await expect(
      apiClient.patch(CAMPAIGN_API.UPDATE_STATUS("__NOPE__"), {
        status: "ended",
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("유효하지 않은 status 는 400 을 반환한다", async () => {
    await expect(
      apiClient.patch(CAMPAIGN_API.UPDATE_STATUS(targetId), { status: "wat" }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

// ---------------------------------------------------------------------------
// GET /api/daily-stats
// ---------------------------------------------------------------------------

describe("GET /api/daily-stats", () => {
  it("기간 필터 내의 stats 만 반환한다", async () => {
    const startDate = "2026-04-01";
    const endDate = "2026-04-15";
    const data = await apiClient.get<DailyStatsResponse>(DAILY_STATS_API.LIST, {
      query: { startDate, endDate },
    });

    expect(data.dailyStats.length).toBeGreaterThan(0);
    for (const s of data.dailyStats) {
      expect(s.date >= startDate).toBe(true);
      expect(s.date <= endDate).toBe(true);
    }
  });

  it("platform 필터로 1차 캠페인을 추린 stats 만 반환한다", async () => {
    const data = await apiClient.get<DailyStatsResponse>(DAILY_STATS_API.LIST, {
      query: { platform: ["Google"] },
    });

    const campaigns = await apiClient.get<CampaignsResponse>(
      CAMPAIGN_API.LIST,
      {
        query: { platform: ["Google"] },
      },
    );
    const googleIds = new Set(campaigns.campaigns.map((c) => c.id));

    expect(data.dailyStats.length).toBeGreaterThan(0);
    for (const s of data.dailyStats) {
      expect(googleIds.has(s.campaignId)).toBe(true);
    }
  });
});
