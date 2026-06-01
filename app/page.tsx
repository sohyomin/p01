'use client'

import { useState, useEffect, useRef } from 'react'
import { Bus, Clock, MapPin, ChevronRight, Navigation, ArrowLeftRight, Search, X, Shuffle } from 'lucide-react'

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

type Phase = 'selectDeparture' | 'riding' | 'alighted'

// 타원형 시각화 - 글자 잘림 없게 수정
function BusRouteVisual({ stops, currentIdx, boardStopId }: {
  stops: Stop[], currentIdx: number, boardStopId: string
}) {
  const total = stops.length
  if (total === 0) return null

  const W = 360, H = 240
  const cx = W / 2, cy = H / 2
  // 타원 크기를 줄여서 라벨 공간 확보
  const rx = cx - 70, ry = cy - 50

  const getPos = (i: number) => {
    const angle = (2 * Math.PI * i) / total - Math.PI / 2
    return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) }
  }

  return (
    <div className="w-full flex justify-center my-2">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 380, overflow: 'visible' }}>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry}
          fill="none" stroke="#6366f1" strokeWidth="2" strokeDasharray="6 3" opacity="0.5" />

        {stops.map((stop, i) => {
          const pos = getPos(i)
          const isCurrent = i === currentIdx
          const isBoard = stop.stop_id === boardStopId
          const isPassed = i < currentIdx

          // 라벨을 점에서 바깥쪽으로 충분히 떨어뜨림
          const dx = pos.x - cx
          const dy = pos.y - cy
          const dist = Math.sqrt(dx * dx + dy * dy)
          const labelDist = dist + 22
          const lx = cx + (dx / dist) * labelDist
          const ly = cy + (dy / dist) * labelDist

          const name = stop.stop_name.length > 7 ? stop.stop_name.slice(0, 7) + '…' : stop.stop_name

          return (
            <g key={stop.stop_id}>
              {isCurrent && <circle cx={pos.x} cy={pos.y} r={16} fill="none" stroke="#a5b4fc" strokeWidth="1.5" opacity="0.5" />}
              <circle cx={pos.x} cy={pos.y}
                r={isCurrent ? 11 : isBoard ? 9 : 6}
                fill={isCurrent ? '#6366f1' : isBoard ? '#10b981' : isPassed ? '#4338ca' : '#1e1b4b'}
                stroke={isCurrent ? '#c7d2fe' : isBoard ? '#6ee7b7' : '#818cf8'}
                strokeWidth={isCurrent ? 2.5 : 1.5} />
              {isCurrent && <text x={pos.x} y={pos.y + 1.5} textAnchor="middle" dominantBaseline="middle" fontSize="9">🚌</text>}
              {isBoard && !isCurrent && <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle" fontSize="8" fill="white">★</text>}
              {!isCurrent && !isBoard && (
                <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle" fontSize="7" fill={isPassed ? '#818cf8' : '#64748b'}>{i + 1}</text>
              )}
              {/* 라벨 배경 */}
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                fontSize="9.5"
                fill={isCurrent ? '#e0e7ff' : isBoard ? '#a7f3d0' : '#94a3b8'}
                fontWeight={isCurrent || isBoard ? 'bold' : 'normal'}
                stroke="#0f172a" strokeWidth="3" paintOrder="stroke">
                {name}
              </text>
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                fontSize="9.5"
                fill={isCurrent ? '#e0e7ff' : isBoard ? '#a7f3d0' : '#94a3b8'}
                fontWeight={isCurrent || isBoard ? 'bold' : 'normal'}>
                {name}
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
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  return <span className="font-mono text-indigo-300 text-sm">{now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
}

function useBusPosition(stops: Stop[], durationMin: number, boardStopId: string, active: boolean) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [nextArrivalMs, setNextArrivalMs] = useState(0)
  const [arrived, setArrived] = useState(false)

  useEffect(() => {
    if (!active || stops.length === 0) return
    setArrived(false)
    const boardIdx = Math.max(0, stops.findIndex(s => s.stop_id === boardStopId))
    setCurrentIdx(boardIdx)
    const msPerStop = Math.max(3000, (durationMin * 60 * 1000) / Math.max(stops.length - 1, 1))
    setNextArrivalMs(Date.now() + msPerStop)
    let iid: ReturnType<typeof setInterval>
    iid = setInterval(() => {
      setCurrentIdx(prev => {
        const next = prev + 1
        if (next >= stops.length - 1) {
          clearInterval(iid)
          setArrived(true)
          setNextArrivalMs(0)
          return stops.length - 1
        }
        setNextArrivalMs(Date.now() + msPerStop)
        return next
      })
    }, msPerStop)
    return () => clearInterval(iid)
  }, [active, stops.length, boardStopId, durationMin])

  return { currentIdx, nextArrivalMs, arrived }
}

function StopSearchSelect({ stops, value, onChange, placeholder }: {
  stops: Stop[], value: string, onChange: (id: string) => void, placeholder: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const filtered = query.length >= 1
    ? stops.filter(s => s.stop_name.includes(query) || (s.district ?? '').includes(query)).slice(0, 50)
    : stops.slice(0, 50)
  const selected = stops.find(s => s.stop_id === value)
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  return (
    <div ref={ref} className="relative w-full">
      <div className="w-full bg-slate-800 border border-white/20 text-white rounded-lg px-3 py-2.5 text-sm flex items-center gap-2 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <MapPin size={13} className="text-indigo-400 shrink-0" />
        <span className={selected ? 'text-white' : 'text-gray-400'}>
          {selected ? `[${selected.district}] ${selected.stop_name}` : placeholder}
        </span>
        {value && <X size={13} className="ml-auto text-gray-400 hover:text-white shrink-0" onClick={e => { e.stopPropagation(); onChange(''); setQuery('') }} />}
      </div>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-white/20 rounded-lg shadow-xl overflow-hidden">
          <div className="p-2 border-b border-white/10 flex items-center gap-2">
            <Search size={13} className="text-indigo-400 shrink-0" />
            <input autoFocus className="bg-transparent text-white text-sm w-full outline-none placeholder-gray-500"
              placeholder="정류장 이름 검색..." value={query} onChange={e => setQuery(e.target.value)} />
            {query && <X size={13} className="text-gray-400 cursor-pointer shrink-0" onClick={() => setQuery('')} />}
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0
              ? <div className="px-3 py-2 text-gray-400 text-sm">검색 결과 없음</div>
              : filtered.map(stop => (
                <div key={stop.stop_id}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-indigo-600/30 flex items-center gap-2 ${stop.stop_id === value ? 'bg-indigo-600/40 text-white' : 'text-gray-200'}`}
                  onClick={() => { onChange(stop.stop_id); setOpen(false); setQuery('') }}>
                  <span className="text-xs text-indigo-400 shrink-0">[{stop.district}]</span>
                  {stop.stop_name}
                </div>
              ))}
            {!query && stops.length > 50 && <div className="px-3 py-2 text-xs text-gray-500 text-center">검색어를 입력해 정류장을 찾으세요</div>}
          </div>
        </div>
      )}
    </div>
  )
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

  const { currentIdx, nextArrivalMs, arrived } = useBusPosition(currentStops, route?.estimated_duration_min ?? 30, departureStopId, phase === 'riding')
  const currentStop = currentStops[currentIdx]
  const nextStop = currentStops[currentIdx + 1]
  const returnTime = route ? new Date(Date.now() + route.estimated_duration_min * 2 * 60 * 1000 + 20 * 60 * 1000) : null

  useEffect(() => { fetch('/api/stops').then(r => r.json()).then(d => setAllStops(d.stops ?? [])) }, [])

  // 랜덤 정류장 선택
  function pickRandom(stops: Stop[]) {
    return stops[Math.floor(Math.random() * stops.length)]?.stop_id ?? ''
  }

  async function handleRecommend(stopId?: string) {
    const sid = stopId ?? departureStopId
    setLoading(true)
    try {
      const res = await fetch(`/api/recommend${sid ? `?stopId=${sid}` : ''}`)
      const data = await res.json()
      if (data.error) return
      setRoute(data.route); setSessionId(data.sessionId)
      setCurrentStops(data.route.stops)
      setDepartureStopId(sid || data.route.stops[0]?.stop_id || '')
      setTransferHistory([{ route: data.route.route_name + '번', stop: allStops.find(s => s.stop_id === sid)?.stop_name ?? '' }])
      setPhase('riding'); setSelectedAlight('')
    } finally { setLoading(false) }
  }

  async function handleAlight() {
    if (!selectedAlight || !sessionId) return
    setLoading(true)
    try {
      await fetch('/api/reboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, alightStopId: selectedAlight }) })
      setPhase('alighted')
    } finally { setLoading(false) }
  }

  async function handleTransfer(stopId: string) {
    if (!stopId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/recommend?stopId=${stopId}`)
      const data = await res.json()
      if (data.error) return
      setRoute(data.route); setSessionId(data.sessionId)
      setCurrentStops(data.route.stops); setDepartureStopId(stopId)
      setTransferHistory(prev => [...prev, { route: data.route.route_name + '번', stop: allStops.find(s => s.stop_id === stopId)?.stop_name ?? '' }])
      setPhase('riding'); setSelectedAlight(''); setSelectedTransferStop('')
    } finally { setLoading(false) }
  }

  async function handleReboard(stopId: string) {
    if (!stopId || !sessionId) return
    setLoading(true)
    try {
      const res = await fetch('/api/reboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId, reboardStopId: stopId }) })
      const data = await res.json()
      setCurrentStops(data.remaining); setDepartureStopId(stopId); setPhase('riding')
    } finally { setLoading(false) }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Bus className="text-indigo-400" size={26} />
            <h1 className="text-2xl font-bold text-white">버스 룰렛</h1>
          </div>
          <p className="text-indigo-400 text-xs mb-1">청주 전체 · 당일 왕복 가능 노선</p>
          <LiveClock />
        </div>

        {/* 출발 정류장 선택 */}
        {phase === 'selectDeparture' && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-5 mb-4 border border-white/10">
            <p className="text-white font-bold text-base mb-3">🚏 어디서 출발할까요?</p>
            <div className="mb-3">
              <StopSearchSelect stops={allStops} value={departureStopId} onChange={setDepartureStopId} placeholder="정류장 검색 또는 선택..." />
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleRecommend()} disabled={!departureStopId || loading}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold py-3 rounded-xl shadow-xl transition-all disabled:opacity-50">
                {loading ? '탐색 중...' : '🎲 추천받기'}
              </button>
              <button onClick={() => { const r = pickRandom(allStops); setDepartureStopId(r); handleRecommend(r) }}
                disabled={loading || allStops.length === 0}
                className="px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition disabled:opacity-50 flex items-center gap-1">
                <Shuffle size={15} /> 랜덤
              </button>
            </div>
          </div>
        )}

        {/* 노선 카드 */}
        {route && phase !== 'selectDeparture' && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-5 mb-4 border border-white/10">
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
              <span className="bg-indigo-500 text-white font-bold px-3 py-1 rounded-full text-sm">{route.route_name}번</span>
              <button onClick={() => { setPhase('selectDeparture'); setRoute(null); setTransferHistory([]) }}
                className="text-indigo-300 text-xs border border-indigo-600 rounded-lg px-2 py-1">처음부터</button>
            </div>
            <div className="flex items-center gap-2 text-white text-sm mb-3">
              <MapPin size={13} className="text-green-400 shrink-0" />
              <span className="truncate">{route.start_stop}</span>
              <ChevronRight size={13} className="text-indigo-400 shrink-0" />
              <MapPin size={13} className="text-red-400 shrink-0" />
              <span className="truncate">{route.end_stop}</span>
            </div>
            <div className="bg-indigo-900/50 rounded-xl px-4 py-2 text-sm text-indigo-200 flex items-center gap-2 mb-2">
              <Clock size={13} />
              <span>편도 <b>{route.estimated_duration_min}분</b> · 왕복 약 <b>{route.estimated_duration_min * 2 + 20}분</b></span>
              {returnTime && <span className="ml-auto text-xs text-indigo-400 shrink-0">귀환 {returnTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>}
            </div>
            <BusRouteVisual stops={currentStops} currentIdx={phase === 'riding' ? currentIdx : -1} boardStopId={departureStopId} />
            {phase === 'riding' && currentStop && (
              <div className="bg-indigo-800/50 rounded-xl px-4 py-2.5 text-sm">
                <div className="flex items-center gap-2 text-white font-semibold">
                  <Navigation size={13} className="text-indigo-300 animate-pulse" />
                  현재: <span className="text-indigo-200">{currentStop.stop_name}</span>
                </div>
                {nextStop && nextArrivalMs > 0 && (
                  <div className="text-indigo-300 text-xs mt-1">
                    ▶ 다음: <b className="text-white">{nextStop.stop_name}</b> 도착 예정 <b className="text-yellow-300">{new Date(nextArrivalMs).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</b>
                  </div>
                )}
                {(arrived || !nextStop) && <div className="text-green-300 text-xs mt-1">🏁 종점 도착! 수고하셨어요 🎉</div>}
              </div>
            )}
          </div>
        )}

        {/* 중도 하차 */}
        {phase === 'riding' && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-4 mb-4 border border-white/10">
            <p className="text-white font-semibold mb-2 text-sm">중도 하차</p>
            <StopSearchSelect stops={currentStops} value={selectedAlight} onChange={setSelectedAlight} placeholder="내릴 정류장 선택..." />
            <div className="flex gap-2 mt-3">
              <button onClick={handleAlight} disabled={!selectedAlight || loading}
                className="flex-1 bg-orange-500 hover:bg-orange-400 text-white font-bold py-2 rounded-xl transition disabled:opacity-40">
                여기서 내릴게요
              </button>
              <button onClick={() => { const r = pickRandom(currentStops); setSelectedAlight(r) }}
                className="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-xl transition flex items-center gap-1 text-sm">
                <Shuffle size={13} /> 랜덤
              </button>
            </div>
          </div>
        )}

        {/* 하차 후: 환승 or 재승차 */}
        {phase === 'alighted' && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-4 mb-4 border border-white/10 space-y-3">
            <p className="text-white font-semibold text-sm">환승 또는 재승차</p>
            <StopSearchSelect stops={allStops} value={selectedTransferStop} onChange={setSelectedTransferStop} placeholder="정류장 검색..." />
            <div className="flex gap-2">
              <button onClick={() => handleTransfer(selectedTransferStop)} disabled={!selectedTransferStop || loading}
                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 rounded-xl transition disabled:opacity-40 text-sm">🔄 환승</button>
              <button onClick={() => handleReboard(selectedTransferStop)} disabled={!selectedTransferStop || loading}
                className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded-xl transition disabled:opacity-40 text-sm">🚌 재승차</button>
              <button onClick={() => { const r = pickRandom(allStops); setSelectedTransferStop(r) }}
                className="px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-xl transition flex items-center gap-1 text-sm">
                <Shuffle size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
