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

/** 하루 이내(왕복 기준 480분 이하)로 다녀올 수 있는 노선 중 무작위 1개 추천 */
export async function getRandomRoute(): Promise<RouteWithStops | null> {
  const MAX_ONE_WAY_MIN = 240 // 왕복 8시간 기준 편도 4시간

  const { data: routes, error } = await supabase
    .from('routes')
    .select('*')
    .lte('estimated_duration_min', MAX_ONE_WAY_MIN)

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

/** 중도 하차 후 재승차 정류장 기준으로 남은 구간 반환 */
export function calcRemainingStops(
  allStops: Stop[],
  reboardStopId: string
): Stop[] {
  const idx = allStops.findIndex((s) => s.stop_id === reboardStopId)
  if (idx === -1) return allStops
  return allStops.slice(idx)
}

/** 세션 저장 */
export async function createSession(
  routeId: string,
  boardStopId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('sessions')
    .insert({ route_id: routeId, board_stop_id: boardStopId })
    .select('id')
    .single()

  if (error) return null
  return data.id
}

/** 중도 하차 기록 */
export async function recordAlight(
  sessionId: string,
  alightStopId: string
): Promise<void> {
  await supabase
    .from('sessions')
    .update({ alight_stop_id: alightStopId })
    .eq('id', sessionId)
}

/** 재승차 기록 */
export async function recordReboard(
  sessionId: string,
  reboardStopId: string
): Promise<void> {
  await supabase
    .from('sessions')
    .update({ reboard_stop_id: reboardStopId })
    .eq('id', sessionId)
}
