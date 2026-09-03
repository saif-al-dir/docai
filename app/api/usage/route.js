import { pool } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { rows } = await pool.query(
    `select
       count(*) as total_messages,
       coalesce(sum(input_tokens), 0)  as input_tokens,
       coalesce(sum(output_tokens), 0) as output_tokens,
       coalesce(sum(input_tokens + output_tokens), 0) as total_tokens,
       coalesce(round(avg(latency_ms)), 0) as avg_latency_ms
     from chat_logs
     where user_id = $1`,
    [user.id]
  )
  return Response.json({ usage: rows[0] })
}