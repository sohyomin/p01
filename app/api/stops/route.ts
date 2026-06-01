import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabase
    .from('stops')
    .select('stop_id, stop_name, district')
    .order('district')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ stops: data })
}
