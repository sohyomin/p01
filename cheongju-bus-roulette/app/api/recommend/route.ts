import { NextResponse } from 'next/server'
import { getRandomRoute, createSession } from '@/lib/busLogic'

export async function GET() {
  const route = await getRandomRoute()
  if (!route) {
    return NextResponse.json({ error: '추천할 노선이 없습니다.' }, { status: 404 })
  }

  // 첫 정류장에서 승차 기준으로 세션 생성
  const sessionId = await createSession(route.route_id, route.stops[0]?.stop_id ?? '')

  return NextResponse.json({ route, sessionId })
}

export const dynamic = 'force-dynamic'
