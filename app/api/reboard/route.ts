import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { calcRemainingStops, recordAlight, recordReboard } from '@/lib/busLogic'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { sessionId, alightStopId, reboardStopId } = body

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId가 필요합니다.' }, { status: 400 })
  }

  // 세션에서 노선 정보 조회
  const { data: session, error: sessionErr } = await supabase
    .from('sessions')
    .select('route_id')
    .eq('id', sessionId)
    .single()

  if (sessionErr || !session) {
    return NextResponse.json({ error: '세션을 찾을 수 없습니다.' }, { status: 404 })
  }

  // 노선의 전체 정류장 조회
  const { data: routeStops } = await supabase
    .from('route_stops')
    .select('stop_order, stops(stop_id, stop_name, lat, lng)')
    .eq('route_id', session.route_id)
    .order('stop_order', { ascending: true })

  const allStops = (routeStops ?? []).map((rs: any) => rs.stops)

  // 중도 하차 기록
  if (alightStopId) {
    await recordAlight(sessionId, alightStopId)
  }

  // 재승차 기록 + 남은 구간 계산
  if (reboardStopId) {
    await recordReboard(sessionId, reboardStopId)
    const remaining = calcRemainingStops(allStops, reboardStopId)
    return NextResponse.json({ remaining })
  }

  return NextResponse.json({ allStops })
}
