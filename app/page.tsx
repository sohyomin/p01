'use client'

import { useState, useEffect, useRef } from 'react'
import { Bus, RefreshCw, Clock, MapPin, ChevronRight } from 'lucide-react'

interface Stop {
  stop_id: string
  stop_name: string
  lat: number
  lng: number
}

interface Route {
  route_id: string
  route_name: string
  start_stop: string
  end_stop: string
  estimated_duration_min: number
  stops: Stop[]
}

type Phase = 'idle' | 'riding' | 'alighted' | 'reboarded'

function BusRouteVisual({ stops, currentStopId, phase }: {
  stops: Stop[]
  currentStopId?: string
  phase: Phase
}) {
  const total = stops.length
  if (total === 0) return null

  // 타원형 경로 계산
  const W = 340, H = 180
  const cx = W / 2, cy = H / 2
  const rx = cx - 36, ry = cy - 28

  const getPos = (i: number, n: number) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2
    return {
      x: cx + rx * Math.cos(angle),
      y: cy + ry * Math.sin(angle),
    }
  }

  // 타원 경로 문자열
  const ellipsePath = `M ${cx} ${cy - ry} A ${rx} ${ry} 0 1 1 ${cx - 0.01} ${cy - ry}`

  return (
    <div className="w-full flex justify-center my-2">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 360 }}>
        {/* 타원 트랙 */}
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry}
          fill="none" stroke="#c7d2fe" strokeWidth="3" strokeDasharray="6 3" />

        {/* 정류장 점들 */}
        {stops.map((stop, i) => {
          const pos = getPos(i, total)
          const isCurrent = stop.stop_id === currentStopId
          const isPassed = currentStopId
            ? stops.findIndex(s => s.stop_id === currentStopId) > i
            : false

          return (
            <g key={stop.stop_id}>
              <circle
                cx={pos.x} cy={pos.y} r={isCurrent ? 10 : 6}
                fill={isCurrent ? '#6366f1' : isPassed ? '#a5b4fc' : '#e0e7ff'}
                stroke={isCurrent ? '#4338ca' : '#818cf8'}
                strokeWidth={isCurrent ? 2.5 : 1.5}
              />
              {isCurrent && (
                <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle"
                  fontSize="8" fill="white" fontWeight="bold">🚌</text>
              )}
              {/* 정류장 이름 - 바깥쪽에 표시 */}
              <text
                x={pos.x + (pos.x - cx) * 0.38}
                y={pos.y + (pos.y - cy) * 0.38}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="7.5"
                fill={isCurrent ? '#4338ca' : '#6b7280'}
                fontWeight={isCurrent ? 'bold' : 'normal'}
              >
                {stop.stop_name.length > 5 ? stop.stop_name.slice(0, 5) + '…' : stop.stop_name}
              </text>
            </g>
          )
        })}

        {/* 시작점 표시 */}
        {(() => {
          const pos = getPos(0, total)
          return (
            <text x={pos.x - 2} y={pos.y - 14} textAnchor="middle"
              fontSize="8" fill="#10b981">출발</text>
          )
        })()}
      </svg>
    </div>
  )
}

function TimeDisplay() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="flex items-center gap-1 text-sm text-indigo-400 font-mono">
      <Clock size={14} />
      {now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
    </div>
  )
}

function EstimatedReturn({ startMin, durationMin }: { startMin: number, durationMin: number }) {
  const returnMin = startMin + durationMin * 2 + 20 // 왕복 + 여유 20분
  const h = Math.floor(returnMin / 60)
  const m = returnMin % 60
  const now = new Date()
  const returnTime = new Date(now.getTime() + returnMin * 60000)
  return (
    <div className="bg-indigo-50 rounded-xl px-4 py-2 text-sm text-indigo-700 flex items-center gap-2">
      <Clock size={14} />
      <span>왕복 예상 <b>{h > 0 ? `${h}시간 ` : ''}{m}분</b> · 귀환 약 <b>{returnTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</b></span>
    </div>
  )
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [route, setRoute] = useState<Route | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [remainingStops, setRemainingStops] = useState<Stop[]>([])
  const [selectedAlight, setSelectedAlight] = useState('')
  const [selectedReboard, setSelectedReboard] = useState('')
  const [loading, setLoading] = useState(false)
  const [departureTime] = useState(() => {
    const now = new Date()
    return now.getHours() * 60 + now.getMinutes()
  })
  const [currentStopIdx, setCurrentStopIdx] = useState(0)

  // 버스 위치 애니메이션
  useEffect(() => {
    if (phase !== 'riding' || !route) return
    const interval = setInterval(() => {
      setCurrentStopIdx(i => (i + 1) % route.stops.length)
    }, 1800)
    return () => clearInterval(interval)
  }, [phase, route])

  async function handleRecommend() {
    setLoading(true)
    try {
      const res = await fetch('/api/recommend')
      const data = await res.json()
      setRoute(data.route)
      setSessionId(data.sessionId)
      setRemainingStops(data.route.stops)
      setPhase('riding')
      setCurrentStopIdx(0)
      setSelectedAlight('')
      setSelectedReboard('')
    } finally {
      setLoading(false)
    }
  }

  async function handleAlight() {
    if (!selectedAlight || !sessionId) return
    setLoading(true)
    try {
      await fetch('/api/reboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, alightStopId: selectedAlight }),
      })
      setPhase('alighted')
    } finally {
      setLoading(false)
    }
  }

  async function handleReboard() {
    if (!selectedReboard || !sessionId) return
    setLoading(true)
    try {
      const res = await fetch('/api/reboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, reboardStopId: selectedReboard }),
      })
      const data = await res.json()
      setRemainingStops(data.remaining)
      setPhase('reboarded')
    } finally {
      setLoading(false)
    }
  }

  const currentStop = route?.stops[currentStopIdx]

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-start py-10 px-4">
      <div className="w-full max-w-md">

        {/* 헤더 */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Bus className="text-indigo-400" size={28} />
            <h1 className="text-2xl font-bold text-white tracking-tight">버스 룰렛</h1>
          </div>
          <p className="text-indigo-300 text-xs mb-2">청주 전체 · 하루 안에 다녀올 수 있는 노선</p>
          <TimeDisplay />
        </div>

        {/* 추천 버튼 */}
        {phase === 'idle' && (
          <button
            onClick={handleRecommend}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold py-5 px-6 rounded-2xl shadow-xl transition-all disabled:opacity-50 text-lg"
          >
            {loading ? '노선 탐색 중...' : '🎲 무작위 노선 추천받기'}
          </button>
        )}

        {/* 노선 카드 */}
        {route && phase !== 'idle' && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-5 mb-4 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <span className="bg-indigo-500 text-white font-bold px-3 py-1 rounded-full text-sm">
                {route.route_name}번
              </span>
              <button onClick={handleRecommend} disabled={loading}
                className="text-indigo-300 hover:text-white transition p-1">
                <RefreshCw size={16} />
              </button>
            </div>

            <div className="flex items-center gap-2 text-white text-sm mb-3">
              <MapPin size={13} className="text-green-400 shrink-0" />
              <span>{route.start_stop}</span>
              <ChevronRight size={13} className="text-indigo-400" />
              <MapPin size={13} className="text-red-400 shrink-0" />
              <span>{route.end_stop}</span>
            </div>

            {/* 예상 소요 시간 */}
            <EstimatedReturn startMin={departureTime} durationMin={route.estimated_duration_min} />

            {/* 타원형 노선 시각화 */}
            <BusRouteVisual
              stops={remainingStops}
              currentStopId={phase === 'riding' ? currentStop?.stop_id : undefined}
              phase={phase}
            />

            {/* 현재 정류장 표시 */}
            {phase === 'riding' && currentStop && (
              <p className="text-center text-indigo-200 text-xs mt-1">
                🚌 현재 위치: <span className="font-bold text-white">{currentStop.stop_name}</span>
              </p>
            )}
          </div>
        )}

        {/* 중도 하차 */}
        {phase === 'riding' && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-4 mb-4 border border-white/10">
            <p className="text-white font-semibold mb-2 text-sm">중도 하차할 정류장</p>
            <select
              className="w-full bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={selectedAlight}
              onChange={e => setSelectedAlight(e.target.value)}
            >
              <option value="" className="text-gray-800">-- 정류장 선택 --</option>
              {route?.stops.map(stop => (
                <option key={stop.stop_id} value={stop.stop_id} className="text-gray-800">
                  {stop.stop_name}
                </option>
              ))}
            </select>
            <button
              onClick={handleAlight}
              disabled={!selectedAlight || loading}
              className="w-full bg-orange-500 hover:bg-orange-400 text-white font-bold py-2 rounded-xl transition disabled:opacity-40"
            >
              여기서 내릴게요
            </button>
          </div>
        )}

        {/* 재승차 */}
        {phase === 'alighted' && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-4 mb-4 border border-white/10">
            <p className="text-white font-semibold mb-1 text-sm">어디서 다시 탈까요?</p>
            <select
              className="w-full bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={selectedReboard}
              onChange={e => setSelectedReboard(e.target.value)}
            >
              <option value="" className="text-gray-800">-- 재승차 정류장 선택 --</option>
              {route?.stops.map(stop => (
                <option key={stop.stop_id} value={stop.stop_id} className="text-gray-800">
                  {stop.stop_name}
                </option>
              ))}
            </select>
            <button
              onClick={handleReboard}
              disabled={!selectedReboard || loading}
              className="w-full bg-green-500 hover:bg-green-400 text-white font-bold py-2 rounded-xl transition disabled:opacity-40"
            >
              여기서 다시 탈게요
            </button>
          </div>
        )}

        {/* 재승차 후 */}
        {phase === 'reboarded' && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-4 mb-4 border border-white/10">
            <p className="text-green-400 font-semibold mb-3 text-sm">🚌 다시 탑승! 남은 구간</p>
            <div className="flex flex-wrap gap-1 mb-4">
              {remainingStops.map((stop, i) => (
                <span key={stop.stop_id}
                  className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full border border-green-500/30">
                  {i + 1}. {stop.stop_name}
                </span>
              ))}
            </div>
            <button
              onClick={() => { setPhase('idle'); setRoute(null) }}
              className="w-full border border-indigo-400 text-indigo-300 font-bold py-2 rounded-xl hover:bg-indigo-500/20 transition"
            >
              🎲 새 노선 추천받기
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
