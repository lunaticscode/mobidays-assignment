// 1. Campaign: 캠페인 정보
export interface Campaign {
  id: string; // 고유 식별자
  name: string; // 캠페인 명칭
  platform: "Google" | "Meta" | "Naver"; // 광고 매체
  status: "active" | "paused" | "ended"; // 상태 (진행중, 일시중지, 종료)
  budget: number; // 총 예산
  startDate: string; // 시작일 (YYYY-MM-DD)
  endDate: string | null; // 종료일 (YYYY-MM-DD)
}

// 2. DailyStat: 캠페인별 일간 성과 (1:N 관계)
export interface DailyStat {
  id: string; // 고유 식별자
  campaignId: string; // 연관된 캠페인 ID
  date: string; // 성과 발생 날짜 (YYYY-MM-DD)
  impressions: number; // 노출수
  clicks: number; // 클릭수
  conversions: number; // 전환수
  cost: number; // 집행 비용
  conversionsValue: number | null; // 전환 가치 (매출액)
}

export interface GlobalFilterState extends Pick<
  Campaign,
  "startDate" | "endDate" | "status" | "platform"
> {}
