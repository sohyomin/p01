'use client'

import { useState, useEffect } from 'react'
import { Bus, RefreshCw, Clock, MapPin, ChevronRight, Navigation, ArrowLeftRight } from 'lucide-react'

interface Stop {
  stop_id: string
  stop_name: string
  district?: string
}

interface Route {
  route_id: string
  route_name: string
  start_stop: string
  end_stop: string
  estimated_duration_min: number
  stops: Stop[]
}

type Phase = 'selectDeparture' | 'riding' | 'alighted' | 'transfer'

function BusRouteVisual({ stops, currentIdx, boardStopId }: {
  stops: Stop[]
  currentIdx: number
  boardStopId: string
}) {
  const total = stops.length
  if (total === 0) return null

  const W = 360, H = 210
  const cx = W / 2, cy = H / 2
  const rx = cx - 44, ry = cy - 32

  const getPos = (i: number) => {
    const angle = (2 * Math.PI * i) / total - Math.PI / 2
    return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) }
  }

  return (
    <div className="w-full flex justify-center my-2">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 380 }}>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry}
          fill="none" stroke="#6366f1" strokeWidth="2" strokeDasharray="6 3" opacity="0.5" />

        {stops.map((stop, i) => {
          const pos = getPos(i)
          const isCurrent = i === currentIdx
          const isBoard = stop.stop_id === boardStopId
          const isPassed = i < currentIdx
          const labelR = 1.48
          const labelX = cx + (pos.x - cx) * labelR
          const labelY = cy + (pos.y - cy) * labelR

          return (
            <g key={stop.stop_id}>
              {/* 버스 위치 강조 링 */}
              {isCurrent && (
                <circle cx={pos.x} cy={pos.y} r={18}
                  fill="none" stroke="#a5b4fc" strokeWidth="1.5" opacity="0.5" />
              )}
              <circle cx={pos.x} cy={pos.y}
                r={isCurrent ? 12 : isBoard ? 9 : 6}
                fill={isCurrent ? '#6366f1' : isBoard ? '#10b981' : isPassed ? '#4338ca' : '#1e1b4b'}
                stroke={isCurrent ? '#c7d2fe' : isBoard ? '#6ee7b7' : '#6366f1'}
                strokeWidth={isCurrent ? 2.5 : 1.5}
              />
              {isCurrent && (
                <text x={pos.x} y={pos.y + 1.5} textAnchor="middle" dominantBaseline="middle"
                  fontSize="10">🚌</text>
              )}
              {isBoard && !isCurrent && (
                <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle"
                  fontSize="9" fill="white">★</text>
              )}
              {/* 정류장 이름 - 크게 */}
              <text x={labelX} y={labelY} textAnchor="middle" dominantBaseline="middle"
                fontSize={isCurrent ? '10' : '9'}
                fill={isCurrent ? '#e0e7ff' : isBoard ? '#a7f3d0' : '#94a3b8'}
                fontWeight={isCurrent || isBoard ? 'bold' : 'normal'}>
                {stop.stop_name.length > 6 ? stop.stop_name.slice(0, 6) + '…' : stop.stop_name}
              </text>
              {/* 순서 번호 */}
              {!isCurrent && (
                <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle"
                  fontSize="7" fill={isPassed ? '#818cf8' : '#64748b'}>
                  {i + 1}
                </text>
              )}
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

function useBusPosition(stops: Stop[], durationMin: number, boardStopId: string, active: boolean) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [nextArrivalMs, setNextArrivalMs] = useState(0)

  useEffect(() => {
    if (!active || stops.length === 0) return
    const boardIdx = Math.max(0, stops.findIndex(s => s.stop_id === boardStopId))
    setCurrentIdx(boardIdx)
    const msPerStop = Math.max(3000, (durationMin * 60 * 1000) / Math.max(stops.length - 1, 1))
    setNextArrivalMs(Date.now() + msPerStop)
    const interval = setInterval(() => {
      setCurrentIdx(prev => {
        const next = prev + 1
        if (next >= stops.length) { clearInterval(interval); return prev }
        setNextArrivalMs(Date.now() + msPerStop)
        return next
      })
    }, msPerStop)
    return () => clearInterval(interval)
  }, [active, stops.length, boardStopId, durationMin])

  return { currentIdx, nextArrivalMs }
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>('selectDeparture')
  const [allStops, setAllStops] = useState<Stop[]>([])
  const [departureStopId, setDepartureStopId] = useState('')
  const [route, setRoute] = useState<Route | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [currentStops, setCurrentStops] = useState<Stop[]>([])
  const [selectedAlight, setSelectedAlight] = useState('')
  const [selectedTransferStop, setSelectedTransferStop] = useState('')
  const [loading, setLoading] = useState(false)
  const [transferHistory, setTransferHistory] = useState<{ route: string, stop: string }[]>([])

  const { currentIdx, nextArrivalMs } = useBusPosition(
    currentStops,
    route?.estimated_duration_min ?? 30,
    departureStopId,
    phase === 'riding'
  )

  // 정류장 목록 로드
  useEffect(() => {
    fetch('/api/stops').then(r => r.json()).then(d => {
      setAllStops(d.stops ?? [])
      if (d.stops?.length > 0) setDepartureStopId(d.stops[0].stop_id)
    })
  }, [])

  async function handleRecommend() {
    if (!departureStopId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/recommend?stopId=${departureStopId}`)
      const data = await res.json()
      if (data.error) { alert('해당 정류장에서 탈 수 있는 노선이 없어요. 다른 정류장을 선택해주세요.'); return }
      setRoute(data.route)
      setSessionId(data.sessionId)
      setCurrentStops(data.route.stops)
      setTransferHistory([{ route: data.route.route_name + '번', stop: allStops.find(s => s.stop_id === departureStopId)?.stop_name ?? '' }])
      setPhase('riding')
      setSelectedAlight('')
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

  async function handleTransfer() {
    if (!selectedTransferStop) return
    setLoading(true)
    try {
      // 환승: 현재 하차 정류장에서 탈 수 있는 새 노선 추천
      const res = await fetch(`/api/recommend?stopId=${selectedTransferStop}`)
      const data = await res.json()
      if (data.error) { alert('해당 정류장에서 환승 가능한 노선이 없어요.'); return }
      setRoute(data.route)
      setSessionId(data.sessionId)
      setCurrentStops(data.route.stops)
      setDepartureStopId(selectedTransferStop)
      setTransferHistory(prev => [...prev, {
        route: data.route.route_name + '번',
        stop: allStops.find(s => s.stop_id === selectedTransferStop)?.stop_name ?? ''
      }])
      setPhase('riding')
      setSelectedAlight('')
      setSelectedTransferStop('')
    } finally {
      setLoading(false)
    }
  }

  const nextStop = currentStops[currentIdx + 1]
  const returnTime = route ? new Date(Date.now() + route.estimated_duration_min * 2 * 60 * 1000 + 20 * 60 * 1000) : null

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

        {/* 1단계: 출발 정류장 선택 */}
        {phase === 'selectDeparture' && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-5 mb-4 border border-white/10">
            <p className="text-white font-bold text-base mb-3">🚏 어디서 출발할까요?</p>
            <select
              className="w-full bg-slate-800 border border-white/20 text-white rounded-lg px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={departureStopId}
              onChange={e => setDepartureStopId(e.target.value)}
            >
              {allStops.map(stop => (
                <option key={stop.stop_id} value={stop.stop_id}>
                  [{stop.district}] {stop.stop_name}
                </option>
              ))}
            </select>
            <button onClick={handleRecommend} disabled={!departureStopId || loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold py-4 rounded-2xl shadow-xl transition-all disabled:opacity-50 text-base">
              {loading ? '노선 탐색 중...' : '🎲 무작위 노선 추천받기'}
            </button>
          </div>
        )}

        {/* 노선 카드 */}
        {route && phase !== 'selectDeparture' && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-5 mb-4 border border-white/10">
            {/* 환승 이력 */}
            {transferHistory.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap mb-3">
                {transferHistory.map((t, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <span className="bg-indigo-700 text-white text-xs px-2 py-0.5 rounded-full">{t.route}</span>
                    <span className="text-indigo-400 text-xs">{t.stop}</span>
                    {i < transferHistory.length - 1 && <ArrowLeftRight size={10} className="text-indigo-400" />}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between mb-3">
              <span className="bg-indigo-500 text-white font-bold px-3 py-1 rounded-full text-sm">
                {route.route_name}번
              </span>
              <button onClick={() => { setPhase('selectDeparture'); setRoute(null); setTransferHistory([]) }}
                className="text-indigo-300 hover:text-white p-1 text-xs border border-indigo-600 rounded-lg px-2">
                처음부터
              </button>
            </div>

            <div className="flex items-center gap-2 text-white text-sm mb-3">
              <MapPin size={13} className="text-green-400 shrink-0" />
              <span>{route.start_stop}</span>
              <ChevronRight size={13} className="text-indigo-400" />
              <MapPin size={13} className="text-red-400 shrink-0" />
              <span>{route.end_stop}</span>
            </div>

            <div className="bg-indigo-900/50 rounded-xl px-4 py-2 text-sm text-indigo-200 flex items-center gap-2 mb-2">
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
              stops={currentStops}
              currentIdx={phase === 'riding' ? currentIdx : -1}
              boardStopId={departureStopId}
            />

            {/* 실시간 버스 위치 */}
            {phase === 'riding' && currentStops[currentIdx] && (
              <div className="bg-indigo-800/50 rounded-xl px-4 py-2.5 text-sm">
                <div className="flex items-center gap-2 text-white font-semibold">
                  <Navigation size={13} className="text-indigo-300 animate-pulse" />
                  현재 위치: <span className="text-indigo-200">{currentStops[currentIdx].stop_name}</span>
                </div>
                {nextStop && nextArrivalMs > 0 && (
                  <div className="text-indigo-300 text-xs mt-1">
                    ▶ 다음: <b className="text-white">{nextStop.stop_name}</b> 도착 예정{' '}
                    <b className="text-yellow-300">
                      {new Date(nextArrivalMs).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </b>
                  </div>
                )}
                {!nextStop && <div className="text-green-300 text-xs mt-1">🏁 종점 도착!</div>}
              </div>
            )}
          </div>
        )}

        {/* 중도 하차 */}
        {phase === 'riding' && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-4 mb-4 border border-white/10">
            <p className="text-white font-semibold mb-2 text-sm">중도 하차</p>
            <select
              className="w-full bg-slate-800 border border-white/20 text-white rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={selectedAlight}
              onChange={e => setSelectedAlight(e.target.value)}
            >
              <option value="">-- 내릴 정류장 선택 --</option>
              {currentStops.map(stop => (
                <option key={stop.stop_id} value={stop.stop_id}>{stop.stop_name}</option>
              ))}
            </select>
            <button onClick={handleAlight} disabled={!selectedAlight || loading}
              className="w-full bg-orange-500 hover:bg-orange-400 text-white font-bold py-2 rounded-xl transition disabled:opacity-40">
              여기서 내릴게요
            </button>
          </div>
        )}

        {/* 하차 후: 환승 or 재승차 */}
        {phase === 'alighted' && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-4 mb-4 border border-white/10 space-y-3">
            <p className="text-white font-semibold text-sm">
              <span className="text-orange-300">{allStops.find(s => s.stop_id === selectedAlight)?.stop_name}</span>에서 내렸어요
            </p>

            <select
              className="w-full bg-slate-800 border border-white/20 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={selectedTransferStop}
              onChange={e => setSelectedTransferStop(e.target.value)}
            >
              <option value="">-- 환승/재승차 정류장 선택 --</option>
              {allStops.map(stop => (
                <option key={stop.stop_id} value={stop.stop_id}>
                  [{stop.district}] {stop.stop_name}
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              {/* 환승: 새 노선 추천 */}
              <button onClick={handleTransfer} disabled={!selectedTransferStop || loading}
                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 rounded-xl transition disabled:opacity-40 text-sm">
                🔄 환승
              </button>
              {/* 재승차: 같은 노선 계속 */}
              <button onClick={async () => {
                if (!selectedTransferStop || !sessionId) return
                const res = await fetch('/api/reboard', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ sessionId, reboardStopId: selectedTransferStop }),
                })
                const data = await res.json()
                setCurrentStops(data.remaining)
                setDepartureStopId(selectedTransferStop)
                setPhase('riding')
              }} disabled={!selectedTransferStop || loading}
                className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded-xl transition disabled:opacity-40 text-sm">
                🚌 재승차
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
