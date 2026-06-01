'use client'

import { useState, useEffect } from 'react'
import { Bus, RefreshCw, Clock, MapPin, ChevronRight, Navigation } from 'lucide-react'

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

type Phase = 'idle' | 'selectStop' | 'riding' | 'alighted' | 'reboarded'

// 타원형 노선 시각화
function BusRouteVisual({ stops, currentStopId, boardStopId }: {
  stops: Stop[]
  currentStopId?: string
  boardStopId?: string
}) {
  const total = stops.length
  if (total === 0) return null

  const W = 340, H = 190
  const cx = W / 2, cy = H / 2
  const rx = cx - 40, ry = cy - 30

  const getPos = (i: number) => {
    const angle = (2 * Math.PI * i) / total - Math.PI / 2
    return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) }
  }

  const currentIdx = stops.findIndex(s => s.stop_id === currentStopId)
  const boardIdx = stops.findIndex(s => s.stop_id === boardStopId)

  return (
    <div className="w-full flex justify-center my-3">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 360 }}>
        {/* 타원 트랙 */}
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry}
          fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeDasharray="5 3" opacity="0.4" />

        {/* 정류장 */}
        {stops.map((stop, i) => {
          const pos = getPos(i)
          const isCurrent = stop.stop_id === currentStopId
          const isBoard = stop.stop_id === boardStopId
          const isPassed = currentIdx >= 0 && i < currentIdx

          const labelX = pos.x + (pos.x - cx) * 0.42
          const labelY = pos.y + (pos.y - cy) * 0.42

          return (
            <g key={stop.stop_id}>
              <circle cx={pos.x} cy={pos.y}
                r={isCurrent ? 11 : isBoard ? 9 : 5}
                fill={isCurrent ? '#6366f1' : isBoard ? '#10b981' : isPassed ? '#818cf8' : '#1e1b4b'}
                stroke={isCurrent ? '#a5b4fc' : isBoard ? '#6ee7b7' : '#6366f1'}
                strokeWidth={isCurrent ? 2.5 : 1.5}
              />
              {isCurrent && (
                <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle"
                  fontSize="9" fill="white">🚌</text>
              )}
              {isBoard && !isCurrent && (
                <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle"
                  fontSize="8" fill="white">★</text>
              )}
              <text x={labelX} y={labelY} textAnchor="middle" dominantBaseline="middle"
                fontSize="7.2"
                fill={isCurrent ? '#a5b4fc' : isBoard ? '#6ee7b7' : '#94a3b8'}
                fontWeight={isCurrent || isBoard ? 'bold' : 'normal'}>
                {stop.stop_name.length > 5 ? stop.stop_name.slice(0, 5) + '…' : stop.stop_name}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function LiveClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <span className="font-mono text-indigo-300 text-sm">
      {now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  )
}

// 버스 위치 시뮬레이션 (정류장간 이동 시간 기반)
function useBusPosition(stops: Stop[], durationMin: number, boardStopId: string, active: boolean) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [nextArrival, setNextArrival] = useState<Date | null>(null)

  useEffect(() => {
    if (!active || stops.length === 0) return
    const boardIdx = stops.findIndex(s => s.stop_id === boardStopId)
    setCurrentIdx(boardIdx >= 0 ? boardIdx : 0)

    const msPerStop = (durationMin * 60 * 1000) / Math.max(stops.length - 1, 1)

    const next = new Date(Date.now() + msPerStop)
    setNextArrival(next)

    const interval = setInterval(() => {
      setCurrentIdx(prev => {
        const nextIdx = prev + 1
        if (nextIdx >= stops.length) {
          clearInterval(interval)
          return prev
        }
        setNextArrival(new Date(Date.now() + msPerStop))
        return nextIdx
      })
    }, msPerStop)

    return () => clearInterval(interval)
  }, [active, stops.length, boardStopId, durationMin])

  return { currentIdx, nextArrival }
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [route, setRoute] = useState<Route | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [remainingStops, setRemainingStops] = useState<Stop[]>([])
  const [selectedAlight, setSelectedAlight] = useState('')
  const [selectedReboard, setSelectedReboard] = useState('')
  const [boardStopId, setBoardStopId] = useState('')
  const [loading, setLoading] = useState(false)

  const { currentIdx, nextArrival } = useBusPosition(
    remainingStops,
    route?.estimated_duration_min ?? 30,
    boardStopId,
    phase === 'riding'
  )

  const currentStop = remainingStops[currentIdx]

  // 현재 시각 기준 귀환 예정 시각
  const returnTime = route ? new Date(Date.now() + route.estimated_duration_min * 2 * 60 * 1000 + 20 * 60 * 1000) : null

  async function handleRecommend() {
    setLoading(true)
    try {
      const res = await fetch('/api/recommend')
      const data = await res.json()
      if (data.error) { alert(data.error); return }
      setRoute(data.route)
      setSessionId(data.sessionId)
      setRemainingStops(data.route.stops)
      setBoardStopId(data.route.stops[0]?.stop_id ?? '')
      setPhase('selectStop')
      setSelectedAlight('')
      setSelectedReboard('')
    } finally {
      setLoading(false)
    }
  }

  function handleConfirmBoard() {
    setPhase('riding')
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
      setBoardStopId(selectedReboard)
      setPhase('reboarded')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-md">

        {/* 헤더 */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Bus className="text-indigo-400" size={26} />
            <h1 className="text-2xl font-bold text-white">버스 룰렛</h1>
          </div>
          <p className="text-indigo-400 text-xs mb-1">청주 전체 · 당일 왕복 가능 노선</p>
          <LiveClock />
        </div>

        {/* 추천 버튼 */}
        {phase === 'idle' && (
          <button onClick={handleRecommend} disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold py-5 rounded-2xl shadow-xl transition-all disabled:opacity-50 text-lg">
            {loading ? '노선 탐색 중...' : '🎲 무작위 노선 추천받기'}
          </button>
        )}

        {/* 노선 카드 */}
        {route && phase !== 'idle' && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-5 mb-4 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <span className="bg-indigo-500 text-white font-bold px-3 py-1 rounded-full text-sm">
                {route.route_name}번 · {route.stops[0] && remainingStops.find(s => s.stop_id === route.stops[0].stop_id) ? (route as any).district ?? '' : ''}
              </span>
              <button onClick={handleRecommend} disabled={loading} className="text-indigo-300 hover:text-white p-1">
                <RefreshCw size={15} />
              </button>
            </div>

            <div className="flex items-center gap-2 text-white text-sm mb-3">
              <MapPin size={13} className="text-green-400 shrink-0" />
              <span>{route.start_stop}</span>
              <ChevronRight size={13} className="text-indigo-400" />
              <MapPin size={13} className="text-red-400 shrink-0" />
              <span>{route.end_stop}</span>
            </div>

            {/* 왕복 예상 시간 */}
            <div className="bg-indigo-900/50 rounded-xl px-4 py-2 text-sm text-indigo-200 flex items-center gap-2 mb-1">
              <Clock size={13} />
              <span>편도 <b>{route.estimated_duration_min}분</b> · 왕복 약 <b>{route.estimated_duration_min * 2 + 20}분</b></span>
              {returnTime && (
                <span className="ml-auto text-xs text-indigo-400">
                  귀환 {returnTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            {/* 타원형 시각화 */}
            <BusRouteVisual
              stops={remainingStops}
              currentStopId={phase === 'riding' || phase === 'reboarded' ? currentStop?.stop_id : undefined}
              boardStopId={boardStopId}
            />

            {/* 실시간 버스 위치 */}
            {(phase === 'riding' || phase === 'reboarded') && currentStop && (
              <div className="bg-indigo-800/40 rounded-xl px-4 py-2 text-sm">
                <div className="flex items-center gap-2 text-white">
                  <Navigation size={13} className="text-indigo-300 animate-pulse" />
                  <span>현재: <b>{currentStop.stop_name}</b></span>
                </div>
                {nextArrival && currentIdx + 1 < remainingStops.length && (
                  <div className="text-indigo-300 text-xs mt-1">
                    다음 정류장 <b>{remainingStops[currentIdx + 1]?.stop_name}</b> 도착 예정:{' '}
                    <b>{nextArrival.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</b>
                  </div>
                )}
                {currentIdx + 1 >= remainingStops.length && (
                  <div className="text-green-300 text-xs mt-1">🏁 종점 도착!</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 승차 정류장 선택 */}
        {phase === 'selectStop' && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-4 mb-4 border border-white/10">
            <p className="text-white font-semibold mb-2 text-sm">🚏 어디서 탈까요?</p>
            <select
              className="w-full bg-slate-800 border border-white/20 text-white rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={boardStopId}
              onChange={e => setBoardStopId(e.target.value)}
            >
              {route?.stops.map(stop => (
                <option key={stop.stop_id} value={stop.stop_id}>{stop.stop_name}</option>
              ))}
            </select>
            <button onClick={handleConfirmBoard}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-xl transition">
              여기서 탈게요 🚌
            </button>
          </div>
        )}

        {/* 중도 하차 */}
        {phase === 'riding' && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-4 mb-4 border border-white/10">
            <p className="text-white font-semibold mb-2 text-sm">중도 하차할 정류장</p>
            <select
              className="w-full bg-slate-800 border border-white/20 text-white rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={selectedAlight}
              onChange={e => setSelectedAlight(e.target.value)}
            >
              <option value="">-- 정류장 선택 --</option>
              {remainingStops.map(stop => (
                <option key={stop.stop_id} value={stop.stop_id}>{stop.stop_name}</option>
              ))}
            </select>
            <button onClick={handleAlight} disabled={!selectedAlight || loading}
              className="w-full bg-orange-500 hover:bg-orange-400 text-white font-bold py-2 rounded-xl transition disabled:opacity-40">
              여기서 내릴게요
            </button>
          </div>
        )}

        {/* 재승차 */}
        {phase === 'alighted' && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-4 mb-4 border border-white/10">
            <p className="text-white font-semibold mb-1 text-sm">어디서 다시 탈까요?</p>
            <select
              className="w-full bg-slate-800 border border-white/20 text-white rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={selectedReboard}
              onChange={e => setSelectedReboard(e.target.value)}
            >
              <option value="">-- 재승차 정류장 선택 --</option>
              {remainingStops.map(stop => (
                <option key={stop.stop_id} value={stop.stop_id}>{stop.stop_name}</option>
              ))}
            </select>
            <button onClick={handleReboard} disabled={!selectedReboard || loading}
              className="w-full bg-green-500 hover:bg-green-400 text-white font-bold py-2 rounded-xl transition disabled:opacity-40">
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
            <button onClick={() => { setPhase('idle'); setRoute(null) }}
              className="w-full border border-indigo-400 text-indigo-300 font-bold py-2 rounded-xl hover:bg-indigo-500/20 transition">
              🎲 새 노선 추천받기
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
