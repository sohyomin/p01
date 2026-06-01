-- 청주 상당구 시내버스 정류장 테이블
CREATE TABLE IF NOT EXISTS stops (
  id          SERIAL PRIMARY KEY,
  stop_id     TEXT UNIQUE NOT NULL,       -- 공공데이터 정류장 ID
  stop_name   TEXT NOT NULL,
  district    TEXT NOT NULL DEFAULT '상당구',
  lat         NUMERIC(10, 7),
  lng         NUMERIC(10, 7),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 노선 테이블
CREATE TABLE IF NOT EXISTS routes (
  id          SERIAL PRIMARY KEY,
  route_id    TEXT UNIQUE NOT NULL,       -- 공공데이터 노선 ID
  route_name  TEXT NOT NULL,              -- ex) "747", "청주 310"
  start_stop  TEXT NOT NULL,
  end_stop    TEXT NOT NULL,
  district    TEXT NOT NULL DEFAULT '상당구',
  estimated_duration_min INTEGER,        -- 편도 소요 시간(분)
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 노선-정류장 연결 (순서 포함)
CREATE TABLE IF NOT EXISTS route_stops (
  id          SERIAL PRIMARY KEY,
  route_id    TEXT NOT NULL REFERENCES routes(route_id) ON DELETE CASCADE,
  stop_id     TEXT NOT NULL REFERENCES stops(stop_id) ON DELETE CASCADE,
  stop_order  INTEGER NOT NULL,           -- 노선 내 정류장 순서
  UNIQUE(route_id, stop_order)
);

-- 세션 테이블 (추천 이력 + 중도하차 기록)
CREATE TABLE IF NOT EXISTS sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id      TEXT NOT NULL REFERENCES routes(route_id),
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  board_stop_id TEXT NOT NULL,           -- 최초 승차 정류장
  alight_stop_id TEXT,                   -- 중도 하차 정류장 (nullable)
  reboard_stop_id TEXT,                  -- 재승차 정류장 (nullable)
  status        TEXT DEFAULT 'active'    -- active | completed | cancelled
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_route_stops_route ON route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_sessions_route    ON sessions(route_id);
