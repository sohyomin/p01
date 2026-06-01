import { NextResponse } from 'next/server'
import { getRandomRouteFromStop, createSession } from '@/lib/busLogic'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const stopId = searchParams.get('stopId')

  const route = await getRandomRouteFromStop(stopId ?? undefined)
  if (!route) {
    return NextResponse.json({ error: '추천할 노선이 없습니다.' }, { status: 404 })
  }
  const sessionId = await createSession(route.route_id, stopId ?? route.stops[0]?.stop_id ?? '')
  return NextResponse.json({ route, sessionId })
}
