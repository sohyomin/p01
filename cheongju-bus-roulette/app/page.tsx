'use client'

import { useState } from 'react'
import { Bus, MapPin, RefreshCw, ArrowRight } from 'lucide-react'

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

export default function Home() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [route, setRoute] = useState<Route | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [remainingStops, setRemainingStops] = useState<Stop[]>([])
  const [selectedAlight, setSelectedAlight] = useState<string>('')
  const [selectedReboard, setSelectedReboard] = useState<string>('')
  const [loading, setLoading] = useState(false)

  async function handleRecommend() {
    setLoading(true)
    try {
      const res = await fetch('/api/recommend')
      const data = await res.json()
      setRoute(data.route)
      setSessionId(data.sessionId)
      setRemainingStops(data.route.stops)
      setPhase('riding')
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

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-start py-12 px-4">
      <div className="w-full max-w-md">

        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Bus className="text-indigo-600" size={32} />
            <h1 className="text-3xl font-bold text-indigo-700">버스 룰렛</h1>
          </div>
          <p className="text-gray-500 text-sm">청주 상당구 · 오늘 하루 다녀올 수 있는 노선 추천</p>
        </div>

        {/* 추천 버튼 */}
        {phase === 'idle' && (
          <button
            onClick={handleRecommend}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-2xl shadow-lg transition disabled:opacity-50"
          >
            {loading ? '추천 중...' : '🎲 무작위 노선 추천받기'}
          </button>
        )}

        {/* 노선 정보 */}
        {route && phase !== 'idle' && (
          <div className="bg-white rounded-2xl shadow-md p-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-indigo-100 text-indigo-700 font-bold px-3 py-1 rounded-full text-sm">
                {route.route_name}번
              </span>
              <span className="text-gray-400 text-sm">편도 약 {route.estimated_duration_min}분</span>
            </div>
            <div className="flex items-center gap-2 text-gray-700 font-medium">
              <MapPin size={16} className="text-green-500" />
              <span>{route.start_stop}</span>
              <ArrowRight size={16} className="text-gray-400" />
              <MapPin size={16} className="text-red-500" />
              <span>{route.end_stop}</span>
            </div>

            {/* 정류장 목록 */}
            <div className="mt-4">
              <p className="text-xs text-gray-400 mb-2">정류장 순서</p>
              <div className="flex flex-wrap gap-1">
                {remainingStops.map((stop, i) => (
                  <span
                    key={stop.stop_id}
                    className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                  >
                    {i + 1}. {stop.stop_name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 중도 하차 입력 */}
        {phase === 'riding' && (
          <div className="bg-white rounded-2xl shadow-md p-5 mb-4">
            <p className="font-semibold text-gray-700 mb-3">중도 하차할 정류장을 선택하세요</p>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={selectedAlight}
              onChange={(e) => setSelectedAlight(e.target.value)}
            >
              <option value="">-- 정류장 선택 --</option>
              {route?.stops.map((stop) => (
                <option key={stop.stop_id} value={stop.stop_id}>
                  {stop.stop_name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleAlight}
                disabled={!selectedAlight || loading}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 rounded-xl transition disabled:opacity-40"
              >
                {loading ? '처리 중...' : '여기서 내릴게요'}
              </button>
              <button
                onClick={handleRecommend}
                disabled={loading}
                className="px-3 py-2 border border-gray-300 rounded-xl text-gray-500 hover:bg-gray-50 transition"
                title="다시 추천"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>
        )}

        {/* 재승차 입력 */}
        {phase === 'alighted' && (
          <div className="bg-white rounded-2xl shadow-md p-5 mb-4">
            <p className="font-semibold text-gray-700 mb-1">잠깐 내렸군요!</p>
            <p className="text-sm text-gray-400 mb-3">어느 정류장에서 다시 탈 예정인가요?</p>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={selectedReboard}
              onChange={(e) => setSelectedReboard(e.target.value)}
            >
              <option value="">-- 재승차 정류장 선택 --</option>
              {route?.stops.map((stop) => (
                <option key={stop.stop_id} value={stop.stop_id}>
                  {stop.stop_name}
                </option>
              ))}
            </select>
            <button
              onClick={handleReboard}
              disabled={!selectedReboard || loading}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 rounded-xl transition disabled:opacity-40"
            >
              {loading ? '계산 중...' : '여기서 다시 탈게요'}
            </button>
          </div>
        )}

        {/* 재승차 후 남은 구간 */}
        {phase === 'reboarded' && (
          <div className="bg-white rounded-2xl shadow-md p-5 mb-4">
            <p className="font-semibold text-green-600 mb-3">🚌 다시 탑승! 남은 구간이에요</p>
            <div className="flex flex-wrap gap-1 mb-4">
              {remainingStops.map((stop, i) => (
                <span
                  key={stop.stop_id}
                  className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200"
                >
                  {i + 1}. {stop.stop_name}
                </span>
              ))}
            </div>
            <button
              onClick={() => { setPhase('idle'); setRoute(null) }}
              className="w-full border border-indigo-300 text-indigo-600 font-bold py-2 rounded-xl hover:bg-indigo-50 transition"
            >
              🎲 새 노선 추천받기
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
