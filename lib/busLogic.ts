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

// 현재 시각 기준 당일 왕복 가능한 노선 중 무작위 추천
export async function getRandomRoute(): Promise<RouteWithStops | null> {
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const END_OF_DAY = 23 * 60
  const maxOneWay = Math.floor((END_OF_DAY - nowMin - 30) / 2) // 왕복+여유30분

  if (maxOneWay <= 0) return null

  // district 필터 없이 전체 조회
  const { data: routes, error } = await supabase
    .from('routes')
    .select('*')
    .lte('estimated_duration_min', maxOneWay)

  if (error || !routes || routes.length === 0) return null

  const picked: Route = routes[Math.floor(Math.random() * routes.length)]
  return await getRouteWithStops(picked)
}

export async function getRouteWithStops(route: Route): Promise<RouteWithStops> {
  const { data: routeStops } = await supabase
    .from('route_stops')
    .select('stop_order, stops(stop_id, stop_name, lat, lng)')
    .eq('route_id', route.route_id)
    .order('stop_order', { ascending: true })

  const stops: Stop[] = (routeStops ?? []).map((rs: any) => rs.stops)
  return { ...route, stops }
}

export function calcRemainingStops(allStops: Stop[], reboardStopId: string): Stop[] {
  const idx = allStops.findIndex(s => s.stop_id === reboardStopId)
  if (idx === -1) return allStops
  return allStops.slice(idx)
}

// 두 정류장 사이 예상 소요 시간 계산 (정류장 수 기반)
export function calcSegmentTime(totalStops: number, totalMin: number, fromIdx: number, toIdx: number): number {
  if (totalStops <= 1) return totalMin
  const perStop = totalMin / (totalStops - 1)
  return Math.round(Math.abs(toIdx - fromIdx) * perStop)
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
