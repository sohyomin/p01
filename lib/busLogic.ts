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
  district?: string
  lat?: number
  lng?: number
}

export interface RouteWithStops extends Route {
  stops: Stop[]
}

export async function getRandomRouteFromStop(stopId?: string): Promise<RouteWithStops | null> {
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const END_OF_DAY = 23 * 60
  const maxOneWay = Math.floor((END_OF_DAY - nowMin - 30) / 2)
  if (maxOneWay <= 0) return null

  let routeIds: string[] | null = null

  // 특정 정류장을 지나는 노선만 필터
  if (stopId) {
    const { data: rs } = await supabase
      .from('route_stops')
      .select('route_id')
      .eq('stop_id', stopId)
    routeIds = (rs ?? []).map((r: any) => r.route_id)
    if (routeIds.length === 0) return null
  }

  let query = supabase.from('routes').select('*').lte('estimated_duration_min', maxOneWay)
  if (routeIds) query = query.in('route_id', routeIds)

  const { data: routes, error } = await query
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

export async function createSession(routeId: string, boardStopId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('sessions')
    .insert({ route_id: routeId, board_stop_id: boardStopId })
    .select('id')
    .single()
  if (error) return null
  return data.id
}

export async function recordAlight(sessionId: string, alightStopId: string) {
  await supabase.from('sessions').update({ alight_stop_id: alightStopId }).eq('id', sessionId)
}

export async function recordReboard(sessionId: string, reboardStopId: string) {
  await supabase.from('sessions').update({ reboard_stop_id: reboardStopId }).eq('id', sessionId)
}
