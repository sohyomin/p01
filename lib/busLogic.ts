import { supabase } from './supabase'

export interface Route {
  route_id: string
  route_name: string
  start_stop: string
  end_stop: string
  estimated_duration_min: number
}

export interface Stop {
  stop_id: string
  stop_name: string
  lat: number
  lng: number
}

export interface RouteWithStops extends Route {
  stops: Stop[]
}

/**
 * 현재 시각 기준으로 왕복이 가능한 노선만 필터링 후 무작위 추천
 * - 운행 종료 시각: 23:00 (1380분) 기준
 * - 왕복 소요 + 여유 20분이 자정 이전이어야 함
 */
export async function getRandomRoute(): Promise<RouteWithStops | null> {
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const END_OF_DAY = 23 * 60 // 23:00
  const availableMin = END_OF_DAY - nowMin - 20 // 여유 20분

  if (availableMin <= 0) return null

  const { data: routes, error } = await supabase
    .from('routes')
    .select('*')
    // 왕복(x2) + 여유 20분 이내인 노선만
    .lte('estimated_duration_min', Math.floor(availableMin / 2))

  if (error || !routes || routes.length === 0) return null

  const picked: Route = routes[Math.floor(Math.random() * routes.length)]

  const { data: routeStops } = await supabase
    .from('route_stops')
    .select('stop_order, stops(stop_id, stop_name, lat, lng)')
    .eq('route_id', picked.route_id)
    .order('stop_order', { ascending: true })

  const stops: Stop[] = (routeStops ?? []).map((rs: any) => rs.stops)

  return { ...picked, stops }
}

export function calcRemainingStops(allStops: Stop[], reboardStopId: string): Stop[] {
  const idx = allStops.findIndex(s => s.stop_id === reboardStopId)
  if (idx === -1) return allStops
  return allStops.slice(idx)
}

export async function createSession(routeId: string, boardStopId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('sessions')
    .insert({ route_id: routeId, board_stop_id: boardStopId })
    .select('id')
    .single()
  if (error) return null
  return data.id
}

export async function recordAlight(sessionId: string, alightStopId: string): Promise<void> {
  await supabase.from('sessions').update({ alight_stop_id: alightStopId }).eq('id', sessionId)
}

export async function recordReboard(sessionId: string, reboardStopId: string): Promise<void> {
  await supabase.from('sessions').update({ reboard_stop_id: reboardStopId }).eq('id', sessionId)
}
