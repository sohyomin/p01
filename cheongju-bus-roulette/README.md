# 🚌 버스 룰렛 — 청주 상당구

오늘 하루 다녀올 수 있는 청주 시내버스 노선을 무작위로 추천해주는 웹앱입니다.

## 기술 스택
- **프론트/백엔드**: Next.js 14 (App Router) — Vercel 배포
- **DB**: Supabase (PostgreSQL)

---

## 로컬 실행

```bash
npm install
cp .env.local.example .env.local
# .env.local에 Supabase URL과 키 입력
npm run dev
```

---

## Supabase 세팅

1. Supabase 대시보드 → SQL Editor
2. `sql/01_schema.sql` 실행 (테이블 생성)
3. `sql/02_seed.sql` 실행 (예시 데이터 삽입)
4. `.env.local`에 프로젝트 URL과 anon key 입력

---

## Vercel 배포

```bash
npx vercel
```

환경변수 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`를  
Vercel 대시보드 → Settings → Environment Variables에 등록하세요.

---

## 실제 청주 버스 API 연동 시

공공데이터포털(data.go.kr)에서 **충청북도_청주시_버스노선정보** API 키를 발급받은 후  
`lib/busLogic.ts`의 `getRandomRoute()` 함수를 실제 API 호출로 교체하세요.

> ※ 예시 데이터(seed)는 저작권 문제 없이 직접 작성한 목업 데이터입니다.

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| 무작위 노선 추천 | 왕복 기준 하루 이내 가능한 노선만 필터링 |
| 중도 하차 | 탑승 중 내릴 정류장 선택 및 기록 |
| 재승차 | 재탑승 정류장 기준으로 남은 구간 재계산 |
| 세션 저장 | Supabase에 이동 이력 저장 (추후 통계 활용 가능) |
