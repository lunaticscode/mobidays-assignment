# 1차 구현 범위 상세

## 개요

GlobalFilter, DailyStatsGraph, CampaignTable, CampaignRegisterModal 4개 컴포넌트 구현.
모든 데이터는 MSW를 통한 API 모킹 기반으로 동작한다.

---

## 0. 사전 작업

### MSW 핸들러

현재 `mocks/handlers.ts`에 placeholder만 존재. 아래 엔드포인트 핸들러 구현 필요:

| Method | Path                        | 설명                              |
| ------ | --------------------------- | --------------------------------- |
| GET    | `/api/campaigns`            | 캠페인 목록 조회 (필터 쿼리 지원) |
| POST   | `/api/campaigns`            | 캠페인 등록                       |
| PATCH  | `/api/campaigns/:id/status` | 캠페인 상태 변경                  |
| GET    | `/api/daily-stats`          | 일별 통계 조회 (필터 쿼리 지원)   |

### 목 데이터 정제

`mocks/data.json` (campaigns 80건, daily_stats 1,422건)에 의도적 더티 데이터 존재:

- **status**: `stopped`, `running` 등 스펙 외 값 → 유효값(`active`/`paused`/`ended`)만 필터
- **platform**: `네이버`, `Facebook`, `facebook` → 유효값(`Google`/`Meta`/`Naver`)만 필터
- **name**: `null` 값 존재 → 기본값 처리 또는 제외
- **budget**: `null` 값 존재 → 기본값 처리 또는 제외
- **startDate 포맷**: `2026/04/12` (슬래시) 혼재 → 파싱 시 정규화 필요

Zod 스키마의 `safeParse`로 런타임 검증 시 위 케이스를 처리한다.

### 차트 라이브러리

DailyStatsGraph 구현에 필요한 차트 라이브러리 설치 필요. (예: `recharts`)

---

## 1. GlobalFilter

### 파일 구조

```
features/dashboard/ui/GlobalFilter.tsx       # 프레젠테이션
features/dashboard/hooks/useGlobalFilter.ts  # 필터 상태 관리 훅
```

### UI 구성 (레퍼런스 이미지 참고)

가로 1줄 레이아웃: `[집행기간 시작일] ~ [종료일] | 상태 [진행중] [일시중지] [종료] | 매체 [Google] [Meta] [Naver] | 초기화`

### 필터 항목

| 필터      | UI 타입                    | 초기값          | 동작                                               |
| --------- | -------------------------- | --------------- | -------------------------------------------------- |
| 집행 기간 | DatePicker × 2 (시작/종료) | 당월 1일 ~ 말일 | 해당 기간 내 집행 중인 캠페인 + 일별 데이터 필터링 |
| 상태      | 토글 버튼 그룹             | 전체 선택       | 다중 선택, AND 조합                                |
| 매체      | 토글 버튼 그룹             | 전체 선택       | 다중 선택, AND 조합                                |
| 초기화    | 버튼                       | -               | 모든 조건을 초기값으로 복구                        |

### 상태 관리

- 필터 상태를 URL SearchParams로 관리하거나, 상위 Container에서 `useState`로 관리 후 하위 위젯에 props 전달
- 필터 변경 시 하단 모든 위젯(DailyStatsGraph, CampaignTable)이 실시간 동기화

### 핵심 요구사항

- 각 필터 조건은 **AND** 조합
- 집행 기간 필터: 캠페인의 startDate~endDate가 선택 기간과 겹치는 캠페인을 필터링

---

## 2. DailyStatsGraph

### 파일 구조

```
features/dashboard/ui/DailyStatsGraph.tsx        # 차트 프레젠테이션
features/dashboard/hooks/useDailyStats.ts        # 일별 데이터 조회 훅
```

### UI 구성 (레퍼런스 이미지 참고)

- 제목: "일별 추이"
- 범례: 노출수 (좌), 클릭수 (우)
- 필터 기간 표시: `2026-03-01 ~ 2026-03-31`
- 우측 상단: 메트릭 토글 버튼 (`노출수` / `클릭수`)
- 차트: 듀얼 Y축 라인 차트 (좌: 노출수, 우: 클릭수)
- X축: 날짜 (`MM/DD` 포맷)

### 메트릭 토글

| 메트릭               | 초기 상태 | Y축  |
| -------------------- | --------- | ---- |
| 노출수 (impressions) | 활성      | 좌측 |
| 클릭수 (clicks)      | 활성      | 우측 |

- 중복 선택 가능 (둘 다 활성 가능)
- **최소 1개** 반드시 선택 유지 → 마지막 1개 토글 해제 시 비활성화 방지

### 데이터 집계

- GlobalFilter 조건에 해당하는 캠페인들의 daily_stats를 날짜별로 **합산**
- 예: 3월 1일에 캠페인 A의 impressions 1000 + 캠페인 B의 impressions 2000 → 3월 1일 합계 3000

### 인터랙션

- 호버 시 해당 날짜의 수치를 **툴팁**으로 표시

---

## 3. CampaignTable

### 파일 구조

```
features/dashboard/ui/CampaignTable.tsx          # 테이블 프레젠테이션
features/dashboard/hooks/useCampaigns.ts         # 캠페인 목록 조회 훅
features/dashboard/hooks/useBulkStatusUpdate.ts  # 일괄 상태 변경 훅
```

### 컬럼 정의

| 컬럼     | 데이터                                | 정렬 | 비고                                                      |
| -------- | ------------------------------------- | ---- | --------------------------------------------------------- |
| 체크박스 | -                                     | X    | 전체 선택 / 개별 선택                                     |
| 캠페인명 | name                                  | X    | -                                                         |
| 상태     | status                                | X    | 뱃지 스타일 (진행중: 초록, 일시중지: 주황, 종료: 회색)    |
| 매체     | platform                              | X    | -                                                         |
| 집행기간 | startDate ~ endDate                   | O    | `YYYY.MM.DD ~ YYYY.MM.DD` 포맷, 기본 정렬 기준 (내림차순) |
| 집행금액 | 총 cost 합계                          | O    | `₩{금액}` 포맷, 천단위 콤마                               |
| CTR (%)  | (총 clicks / 총 impressions) × 100    | O    | 소수점 2자리                                              |
| CPC (원) | 총 cost / 총 clicks                   | O    | 정수, 천단위 콤마                                         |
| ROAS (%) | (총 conversionsValue / 총 cost) × 100 | O    | 소수점 2자리                                              |

### 파생 지표 계산

> 파생 지표는 **필터 조건에 해당하는 `dailyStats` 합산 데이터**를 기준으로 **실시간 계산**합니다.

| 파생 지표 | 계산식                              |
| --------- | ----------------------------------- |
| CTR (%)   | (총 클릭 수 / 총 노출 수) × 100     |
| CPC (원)  | 총 집행 비용 / 총 클릭 수           |
| ROAS (%)  | (총 전환 가치 / 총 집행 비용) × 100 |

- 분모가 0이 되는 경우(노출 0, 클릭 0, 비용 0)의 UI 표기는 구현 시 `0` 또는 `-` 로 일관 처리

### 검색

- 캠페인명 실시간 검색 (입력 즉시 필터링)
- **테이블에만 적용** (차트에는 영향 없음)
- 검색 결과 건수 / 전체 건수 표시 (예: `25건`, 검색 시 `3 / 25건`)

### 정렬

- 집행기간, 집행금액, CTR, CPC, ROAS 컬럼 오름차순/내림차순 토글
- 컬럼 헤더 클릭 시 정렬 방향 순환: 없음 → 내림차순 → 오름차순

### 페이지네이션

- 1페이지당 10건
- 하단 좌측: `1-10 / 25` 형식
- 하단 우측: 페이지 번호 버튼 + 이전/다음 화살표

### 일괄 상태 변경 (평가 포인트)

1. 체크박스로 캠페인 선택 (헤더 체크박스로 전체 선택/해제)
2. 선택된 항목이 있으면 드롭다운 노출 (진행중 / 일시중지 / 종료)
3. 상태 변경 시 `PATCH /api/campaigns/:id/status` 호출
4. 성공 후 `invalidateQueries`로 목록 갱신

---

## 4. CampaignRegisterModal

### 파일 구조

```
features/dashboard/ui/CampaignRegisterModal.tsx   # 모달 프레젠테이션
features/dashboard/form/campaign-register.ts      # Zod 스키마 + 타입
features/dashboard/hooks/useCreateCampaign.ts     # 등록 Mutation 훅
```

### UI 구성 (레퍼런스 이미지 참고)

- 트리거: 캠페인 목록 우측 상단 `+ 캠페인 등록` 버튼
- 모달 헤더: `+ 캠페인 등록`, 우측 닫기(X) 버튼
- 하단 액션: `취소` / `등록` 버튼

### 입력 필드

| 필드        | UI 타입                           | placeholder             | 유효성 검사                              |
| ----------- | --------------------------------- | ----------------------- | ---------------------------------------- |
| 캠페인명    | 텍스트                            | "캠페인명을 입력하세요" | 필수, 2~100자                            |
| 광고 매체   | 버튼 그룹 (Google / Meta / Naver) | -                       | 필수, 택 1                               |
| 예산        | 숫자 + "원" 접미사                | "0"                     | 필수, 정수, 100 ~ 1,000,000,000          |
| 집행금액    | 숫자 + "원" 접미사                | "0"                     | 필수, 정수, 0 ~ 1,000,000,000, 예산 이하 |
| 집행 시작일 | DatePicker                        | "시작일 선택"           | 필수                                     |
| 집행 종료일 | DatePicker                        | "종료일 선택"           | 필수, 시작일 이후                        |

### Zod 스키마 (예시)

```typescript
z.object({
  name: z.string().min(2).max(100),
  platform: z.enum(["Google", "Meta", "Naver"]),
  budget: z.number().int().min(100).max(1_000_000_000),
  cost: z.number().int().min(0).max(1_000_000_000),
  startDate: z.string(),
  endDate: z.string(),
})
  .refine((data) => data.cost <= data.budget, {
    message: "집행금액은 예산을 초과할 수 없습니다",
    path: ["cost"],
  })
  .refine((data) => new Date(data.endDate) > new Date(data.startDate), {
    message: "종료일은 시작일 이후여야 합니다",
    path: ["endDate"],
  });
```

### 자동 설정 값

- `id`: 고유 식별값 자동 생성 (예: `crypto.randomUUID()`)
- `status`: `"active"` 고정

### 상태 동기화 (평가 포인트)

- 등록 성공 시 **새로고침 없이** 테이블 + 차트 즉시 반영
- `POST /api/campaigns` → `onSuccess: invalidateQueries(queryKeys.campaign.all())`
- 신규 캠페인은 daily_stats가 없으므로 테이블 지표는 `0` 또는 `-` 표시

### 데이터 영속성

- MSW 핸들러 내 인메모리 저장 (브라우저 세션 내 유지)
- 새로고침 시 초기화 허용

---

## 5. DashboardContainer 조합

### 파일

```
widgets/dashboard/DashboardContainer.tsx
```

### 레이아웃 구성

```
┌─────────────────────────────────────┐
│           GlobalFilter              │
├─────────────────────────────────────┤
│         DailyStatsGraph             │
├─────────────────────────────────────┤
│ 캠페인 목록  [+ 캠페인 등록] 버튼    │
│ [검색]                      [25건]  │
│ CampaignTable                       │
│ 페이지네이션                         │
├─────────────────────────────────────┤
│ CampaignRegisterModal (오버레이)     │
└─────────────────────────────────────┘
```

### 데이터 흐름

1. DashboardContainer에서 GlobalFilter 상태를 관리
2. 필터 상태를 DailyStatsGraph, CampaignTable에 props로 전달
3. 각 위젯은 전달받은 필터를 query key에 포함하여 데이터 요청
4. CampaignRegisterModal은 CampaignTable 영역에서 트리거

---

## 6. 공통 작업

### Zod 스키마 (`validators/campaign.ts`)

Campaign, DailyStat 도메인 스키마 정의 + 더티 데이터 대응:

- `status` → `z.enum(["active", "paused", "ended"])`
- `platform` → `z.enum(["Google", "Meta", "Naver"])`
- `startDate` → 날짜 포맷 정규화 (`/` → `-`)
- `name`, `budget` → nullable 대응

### 서비스 레이어 (`services/campaign.service.ts`)

```
getCampaigns(filters?) → apiClient.get → validateResponse
getDailyStats(filters?) → apiClient.get → validateResponse
createCampaign(data) → apiClient.post
updateCampaignStatus(id, status) → apiClient.patch
```
