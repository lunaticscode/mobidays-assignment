# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

광고 캠페인 대시보드 SPA — Google/Meta/Naver 매체의 캠페인 성과(노출수, 클릭수, 전환수, 비용)를 시각화하고 관리하는 프론트엔드 애플리케이션.

## Tech Stack

- **Vite 8** + **React 19** + **TypeScript 6**
- **ESLint 9** (Flat Config)
- **MSW 2** (Mock Service Worker) — API 모킹
- **Vitest 4** — 테스트 러너

## Commands

```bash
npm run dev        # 개발 서버 (Vite)
npm run build      # tsc -b && vite build
npm run lint       # eslint .
npm run preview    # 빌드 결과 프리뷰
```

Vitest는 package.json scripts에 아직 등록되지 않음. 직접 실행:
```bash
npx vitest run              # 전체 테스트
npx vitest run src/path     # 특정 경로 테스트
npx vitest --watch          # 워치 모드
```

## Architecture

컨벤션 상세는 `.claude/rules/frontend-vite-conventions.md`와 `.claude/rules/frontend-vite-structure.md`에 정의되어 있음. 핵심만 요약:

### 컴포넌트 계층

```
routes/[Feature]Page.tsx  →  widgets/[Feature]Container.tsx  →  features/[feature]/ui/
       (라우트 진입)            (데이터 패칭 + 상태)              (프레젠테이션)
```

- **Page**: URL 파라미터 처리, Container에 위임. `default export` 필수 (React Router lazy)
- **Widget/Container**: `useQuery`/`useMutation` 호출, 이벤트 핸들링
- **Feature UI**: props만 받는 프레젠테이션 컴포넌트

### 데이터 흐름

- 읽기: Container → `useQuery` (features/hooks/) → Service (services/) → `apiClient` (libs/api-client.ts)
- 쓰기: Feature UI 이벤트 → Container → `useMutation` → Service → `onSuccess: invalidateQueries()`
- API 응답은 Zod 스키마(`validators/`)로 런타임 검증

### 상태 관리 원칙

| 관심사 | 방법 |
|--------|------|
| 서버 데이터 | React Query (`@tanstack/react-query`) |
| 폼 | `react-hook-form` + Zod |
| UI 상태 | 로컬 `useState` |
| 필터/페이지네이션 | URL SearchParams |
| 전역 UI | Zustand (필요시에만) |

### Import Alias

`@/*` → `./src/*` (tsconfig paths + vite alias 설정 필요 — vite.config.ts에 아직 미설정)

## Domain Model

```typescript
Campaign    { id, name, platform("Google"|"Meta"|"Naver"), status("active"|"paused"|"ended"), budget, startDate, endDate }
DailyStat   { id, campaignId, date, impressions, clicks, conversions, cost, conversionsValue }
```

관계: Campaign 1:N DailyStat (campaignId로 연결)

## MSW Mock Data

- `mocks/data.json` — campaigns + daily_stats 목 데이터
- `mocks/handlers.ts` — MSW 핸들러 (현재 placeholder, 도메인 핸들러 추가 필요)
- `mocks/node.ts` — Vitest용 서버 설정
- `vitest.setup.ts` — MSW 서버 lifecycle 연동 완료
- `public/mockServiceWorker.js` — 브라우저용 워커

## 주요 컴포넌트 스펙

`docs/main-components-spec/` 참조 (이미지 포함):

- **GlobalFilter** — 집행기간/상태/매체 AND 필터, 하단 모든 위젯과 실시간 동기화
- **DailyStatsGraph** — 일별 노출수/클릭수 추이 차트, 메트릭 토글, 호버 툴팁
- **CampaignTable** — 정렬/검색/페이지네이션/체크박스 일괄 상태 변경
- **CampaignRegisterModal** — react-hook-form + Zod 검증, 등록 후 새로고침 없이 반영
- **PlatformResultGraph** — 플랫폼별 비중 도넛 차트, 클릭 시 글로벌 필터 양방향 연동
- **CampaignRanking** — ROAS/CTR/CPC 기준 Top3 (CPC는 낮을수록 상위)

## Hooks (Claude Code)

`.claude/hooks/`에 자동화 훅 설정됨:

- **PreToolUse**: 보호 파일(.env, lock 파일, node_modules 등) 편집 차단 + 위험한 git/DB 명령 차단
- **PostToolUse**: Edit/Write 후 Prettier → ESLint --fix → tsc --noEmit 자동 실행
- **Stop**: 작업 종료 시 타입 체크 + 테스트 자동 실행
