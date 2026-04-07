import { http, HttpResponse } from "msw";

import rawData from "./data.json";

// ---------------------------------------------------------------------------
// Types
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

// ---------------------------------------------------------------------------
// Mock data normalization (dirty data → spec-valid data)
//
// data.json 에는 의도적으로 더티 데이터가 섞여 있다. (phase-1 사전작업 §0)
// - status: stopped / running 등 스펙 외 값
// - platform: 네이버, Facebook, facebook 등 표기 변형
// - name / budget 에 null
// - startDate 가 슬래시(`2026/04/12`) 포맷 혼재
//
// 명백한 동의어는 정규화하여 데이터 보존, 매핑 불가한 값만 제외한다.
// ---------------------------------------------------------------------------

const VALID_STATUSES: readonly CampaignStatus[] = ["active", "paused", "ended"];
const VALID_PLATFORMS: readonly Platform[] = ["Google", "Meta", "Naver"];

const STATUS_ALIASES: Record<string, CampaignStatus> = {
  running: "active",
  stopped: "ended",
};

const PLATFORM_ALIASES: Record<string, Platform> = {
  네이버: "Naver",
  Facebook: "Meta",
  facebook: "Meta",
};

const FALLBACK_NAME = "(이름 없음)";

function normalizeDate(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return "";
  return value.replace(/\//g, "-");
}

function normalizeStatus(value: unknown): CampaignStatus | null {
  if (typeof value !== "string") return null;
  if ((VALID_STATUSES as readonly string[]).includes(value)) {
    return value as CampaignStatus;
  }
  return STATUS_ALIASES[value] ?? null;
}

function normalizePlatform(value: unknown): Platform | null {
  if (typeof value !== "string") return null;
  if ((VALID_PLATFORMS as readonly string[]).includes(value)) {
    return value as Platform;
  }
  return PLATFORM_ALIASES[value] ?? null;
}

interface RawCampaign {
  id: string;
  name: string | null;
  status: string;
  platform: string;
  budget: number | null;
  startDate: string;
  endDate: string;
}

function sanitizeCampaign(raw: RawCampaign): Campaign | null {
  const status = normalizeStatus(raw.status);
  const platform = normalizePlatform(raw.platform);
  if (!status || !platform) return null;
  return {
    id: raw.id,
    name: raw.name ?? FALLBACK_NAME,
    status,
    platform,
    budget: raw.budget ?? 0,
    startDate: normalizeDate(raw.startDate),
    endDate: normalizeDate(raw.endDate),
  };
}

// 모듈 로드 시 1회 정규화. 이후 POST/PATCH 는 이 배열을 인메모리 변이.
const campaigns: Campaign[] = (rawData.campaigns as RawCampaign[])
  .map(sanitizeCampaign)
  .filter((c): c is Campaign => c !== null);

const dailyStats: DailyStat[] = (rawData.daily_stats as DailyStat[]).map(
  (stat) => ({
    ...stat,
    date: normalizeDate(stat.date),
  }),
);

// ---------------------------------------------------------------------------
// Filter helpers
// ---------------------------------------------------------------------------

interface CampaignFilter {
  startDate?: string;
  endDate?: string;
  statuses: string[];
  platforms: string[];
}

function readCampaignFilter(url: URL): CampaignFilter {
  return {
    startDate: url.searchParams.get("startDate") ?? undefined,
    endDate: url.searchParams.get("endDate") ?? undefined,
    statuses: url.searchParams.getAll("status"),
    platforms: url.searchParams.getAll("platform"),
  };
}

function applyCampaignFilter(
  source: Campaign[],
  filter: CampaignFilter,
): Campaign[] {
  return source.filter((campaign) => {
    // 집행 기간이 필터 기간과 겹치면 통과 (overlap)
    if (filter.startDate && campaign.endDate < filter.startDate) return false;
    if (filter.endDate && campaign.startDate > filter.endDate) return false;
    if (
      filter.statuses.length > 0 &&
      !filter.statuses.includes(campaign.status)
    ) {
      return false;
    }
    if (
      filter.platforms.length > 0 &&
      !filter.platforms.includes(campaign.platform)
    ) {
      return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const handlers = [
  // GET /api/campaigns ----------------------------------------------------
  http.get("/api/campaigns", ({ request }) => {
    const url = new URL(request.url);
    const filter = readCampaignFilter(url);
    const result = applyCampaignFilter(campaigns, filter);
    return HttpResponse.json({
      campaigns: result,
      total: result.length,
    });
  }),

  // POST /api/campaigns ---------------------------------------------------
  http.post("/api/campaigns", async ({ request }) => {
    const body = (await request.json()) as Partial<Campaign>;

    const platform = normalizePlatform(body.platform);
    if (!platform) {
      return HttpResponse.json(
        { message: "유효하지 않은 광고 매체입니다." },
        { status: 400 },
      );
    }

    const startDate = normalizeDate(body.startDate);
    const endDate = normalizeDate(body.endDate);
    if (!body.name || !startDate || !endDate) {
      return HttpResponse.json(
        { message: "필수 입력값이 누락되었습니다." },
        { status: 400 },
      );
    }

    const newCampaign: Campaign = {
      id: crypto.randomUUID(),
      name: body.name,
      platform,
      status: "active",
      budget: body.budget ?? 0,
      startDate,
      endDate,
    };
    campaigns.unshift(newCampaign);

    return HttpResponse.json({ campaign: newCampaign }, { status: 201 });
  }),

  // PATCH /api/campaigns/:id/status ---------------------------------------
  http.patch("/api/campaigns/:id/status", async ({ params, request }) => {
    const id = params.id as string;
    const body = (await request.json()) as { status?: string };

    const status = normalizeStatus(body.status);
    if (!status) {
      return HttpResponse.json(
        { message: "유효하지 않은 상태값입니다." },
        { status: 400 },
      );
    }

    const campaign = campaigns.find((c) => c.id === id);
    if (!campaign) {
      return HttpResponse.json(
        { message: "캠페인을 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    campaign.status = status;
    return HttpResponse.json({ campaign });
  }),

  // GET /api/daily-stats --------------------------------------------------
  // GlobalFilter 와 동일한 조건(status / platform / 기간) 으로 캠페인을 1차
  // 필터링한 뒤, 해당 캠페인들의 daily_stats 를 기간 내로 추려 반환한다.
  http.get("/api/daily-stats", ({ request }) => {
    const url = new URL(request.url);
    const filter = readCampaignFilter(url);
    const campaignIds = url.searchParams.getAll("campaignId");

    let scope = applyCampaignFilter(campaigns, filter);
    if (campaignIds.length > 0) {
      const idSet = new Set(campaignIds);
      scope = scope.filter((c) => idSet.has(c.id));
    }
    const scopedIds = new Set(scope.map((c) => c.id));

    const result = dailyStats.filter((stat) => {
      if (!scopedIds.has(stat.campaignId)) return false;
      if (filter.startDate && stat.date < filter.startDate) return false;
      if (filter.endDate && stat.date > filter.endDate) return false;
      return true;
    });

    return HttpResponse.json({
      dailyStats: result,
      total: result.length,
    });
  }),
];
